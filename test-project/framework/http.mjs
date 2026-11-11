import { readFile } from 'node:fs/promises';

function fail(message) { throw Object.assign(new Error(message), { reportMessage: message }); }
export async function readHttpConfig(url = new URL('../config/http.json', import.meta.url)) {
  try {
    const config = JSON.parse(await readFile(url, 'utf8'));
    if (!config || typeof config !== 'object' || Array.isArray(config) || !config.headers || typeof config.headers !== 'object' || Array.isArray(config.headers)) fail('共用設定 config/http.json 必須有 headers 物件。');
    return config;
  } catch (error) {
    if (error.code === 'ENOENT') return { headers: {} };
    if (error.reportMessage) throw error;
    fail('無法讀取共用 Header 設定，請檢查 config/http.json 的 JSON 格式與權限。');
  }
}
export function mergeHeaders(...layers) {
  const merged = new Map();
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) fail('Header 設定必須是物件。');
    for (const [name, value] of Object.entries(layer)) {
      if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name) || (value !== null && typeof value !== 'string')) fail('Header 名稱或值不合法，請使用文字值或 null。');
      if (value === null) merged.delete(name.toLowerCase()); else merged.set(name.toLowerCase(), value);
    }
  }
  return Object.fromEntries(merged);
}
function substitute(value, variables) {
  if (Array.isArray(value)) return value.map(item => substitute(item, variables));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substitute(item, variables)]));
  if (typeof value !== 'string') return value;
  const read = key => {
    if (Object.hasOwn(variables, key)) return variables[key];
    if (/^[A-Z_][A-Z0-9_]*$/.test(key) && Object.hasOwn(process.env, key)) return process.env[key];
    fail('請求仍有未設定變數，請核對 fixture.variables 與測試專案 .env。');
  };
  const exact = /^\{\{([^{}]+)\}\}$/.exec(value);
  if (exact) return read(exact[1]);
  return value.replace(/\{\{([^{}]+)\}\}/g, (_, key) => String(read(key)));
}
function field(body, path) {
  if (!path) return body;
  let value = body;
  for (const key of path.split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    value = value[key];
  }
  return value;
}
export async function executeApi(definition, fixture, verify, transport = fetch, sharedConfig) {
  if (fixture.enabled !== true) fail('此案例為待設定草稿。請補齊 fixture、業務斷言與環境，再將 enabled 設為 true。');
  if (!Number.isInteger(fixture.expectedStatus) || fixture.expectedStatus < 100 || fixture.expectedStatus > 599 ||
      !Array.isArray(fixture.assertions) || !fixture.assertions.length || fixture.assertions.some(item => !item || typeof item.path !== 'string' || !['equals', 'exists', 'contains'].includes(item.operator) || (item.operator !== 'exists' && !Object.hasOwn(item, 'value')))) fail('請先設定 expectedStatus 與至少一個有效業務斷言。equals／contains 必須有明確的 value。');
  if (definition.operationType === 'subscription') fail('Subscription 尚未接入此 HTTP 執行器。');
  if (definition.kind === 'graphql' && typeof definition.body?.query === 'string' && definition.body.query.includes('{{')) fail('GraphQL 文件內仍有動態或秘密占位值；請改為具型別的 GraphQL variables，勿直接插入 query 字串。');
  if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(definition.method)) fail('HTTP 方法尚未確認。');
  if ((!['GET', 'HEAD', 'OPTIONS'].includes(definition.method) && !(definition.kind === 'graphql' && definition.operationType === 'query')) && fixture.allowWrite !== true) fail('此請求可能寫入資料；確認目標與清理方式後才可設定 allowWrite。');
  const base = process.env.BFF_BASE_URL ?? process.env.ARCHIFY_TARGET_BASE_URL;
  if (!base) fail('請在測試專案 .env 設定 BFF_BASE_URL。');
  let target;
  try { target = new URL(base); } catch { fail('受測環境 URL 格式錯誤。'); }
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.hash || target.search) fail('受測環境僅接受不含帳密、query 或 fragment 的 HTTP／HTTPS URL。');
  const variables = { ...(fixture.variables || {}), BASE_URL: base };
  const rawEndpoint = substitute(definition.endpoint, variables);
  if (typeof rawEndpoint !== 'string' || !rawEndpoint) fail('請設定有效的端點變數。');
  // Absolute source URLs supply the path, while the chosen test environment supplies the origin.
  let path = rawEndpoint;
  if (/^https?:\/\//i.test(path)) { const original = new URL(path); path = original.pathname + original.search; }
  const url = new URL(path, target.href.endsWith('/') ? target.href : target.href + '/');
  if (url.origin !== target.origin) fail('請求不可離開設定的受測環境 origin。');
  for (const [key, value] of Object.entries(substitute(definition.queryParams || {}, variables))) url.searchParams.set(key, String(value));
  const shared = sharedConfig ?? await readHttpConfig();
  const combined = mergeHeaders(shared.headers, definition.headers || {}, fixture.headers || {});
  let headers;
  try { headers = Object.fromEntries(new Headers(substitute(combined, variables))); }
  catch (error) { if (error.reportMessage) throw error; fail('Header 值格式不合法，請檢查共用設定與環境變數，不可包含換行。'); }
  const body = substitute(definition.body, variables);
  const expectedAssertions = fixture.assertions.map(item => ({ ...item, value: substitute(item.value, variables) }));
  const hasBody = body !== null && body !== undefined && definition.method !== 'GET' && definition.method !== 'HEAD';
  if (hasBody && typeof body === 'object' && !Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
  const response = await transport(url, { method: definition.method, headers,
    ...(hasBody ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(30000) });
  try { verify(response.status, fixture.expectedStatus); }
  catch (error) { await response.body?.cancel(); throw error; }
  let text = '', bytes = 0;
  if (response.body) {
    const reader = response.body.getReader(), decoder = new TextDecoder();
    try {
      while (true) { const item = await reader.read(); if (item.done) break; bytes += item.value.byteLength; if (bytes > 2 * 1024 * 1024) fail('回應超過 2 MB 上限。'); text += decoder.decode(item.value, { stream: true }); }
      text += decoder.decode();
    } finally { await reader.cancel(); }
  }
  let result;
  try { result = JSON.parse(text); } catch { result = text; }
  if (definition.kind === 'graphql') verify(Array.isArray(result?.errors) ? result.errors.length : 0, 0);
  for (const assertion of expectedAssertions) {
    const actual = field(result, assertion.path);
    if (assertion.operator === 'exists') verify(actual !== undefined && actual !== null, true);
    else if (assertion.operator === 'contains') verify((Array.isArray(actual) || typeof actual === 'string') && actual.includes(assertion.value), true);
    else verify(actual, assertion.value);
  }
}
