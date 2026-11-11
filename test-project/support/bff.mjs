import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { mergeHeaders, readHttpConfig } from '../framework/http.mjs';

try {
  for (const [name, value] of Object.entries(parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8')))) if (!Object.hasOwn(process.env, name)) process.env[name] = value;
} catch (error) { if (error.code !== 'ENOENT') throw new Error('無法讀取測試專案 .env'); }
const shared = await readHttpConfig();
export function resolveData(value, variables = {}) {
  if (Array.isArray(value)) return value.map(item => resolveData(item, variables));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveData(item, variables)]));
  if (typeof value !== 'string') return value;
  const read = name => {
    if (Object.hasOwn(variables, name)) return variables[name];
    if (/^[A-Z_][A-Z0-9_]*$/.test(name) && Object.hasOwn(process.env, name)) return process.env[name];
    throw new Error('有未設定的測試變數，請檢查本檔 variables 與 .env。');
  };
  const exact = /^\{\{([^{}]+)\}\}$/.exec(value);
  return exact ? read(exact[1]) : value.replace(/\{\{([^{}]+)\}\}/g, (_, name) => String(read(name)));
}
export function bffUrl(endpoint, variables = {}) {
  const base = process.env.BFF_BASE_URL ?? process.env.ARCHIFY_TARGET_BASE_URL;
  if (!base) throw new Error('請在 .env 設定要連線測試的 BFF_BASE_URL。');
  let target;
  try { target = new URL(base); } catch { throw new Error('BFF_BASE_URL 格式不合法。'); }
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash) throw new Error('BFF_BASE_URL 必須為不含帳密或 query 的 HTTP／HTTPS URL。');
  let path = resolveData(endpoint, { ...variables, BASE_URL: base });
  if (!path || typeof path !== 'string') throw new Error('中間層端點尚未確認。');
  if (/^https?:\/\//i.test(path)) { const original = new URL(path); path = original.pathname + original.search; }
  const result = new URL(path, target.href.endsWith('/') ? target.href : target.href + '/');
  if (result.origin !== target.origin) throw new Error('請求不得離開指定測試環境。');
  return result.href;
}
export function bffHeaders(requestHeaders = {}, caseHeaders = {}, variables = {}) {
  const values = resolveData(mergeHeaders(shared.headers, requestHeaders, caseHeaders), variables);
  try { return Object.fromEntries(new Headers(values)); } catch { throw new Error('Header 格式不合法，請檢查共用設定與 .env。'); }
}
export function readPath(value, path) {
  for (const name of path ? path.split('.') : []) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, name)) return undefined;
    value = value[name];
  }
  return value;
}
