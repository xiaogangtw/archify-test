export function legacyPlaywrightSource(item, settings, supportImport, id = 'API-' + item.id) {
  const data = settings || { enabled: false, allowWrite: false, variables: {}, headers: {}, expectedStatus: null, assertions: [] };
  const steps = ['確認測試設定', '呼叫中間層', '確認業務結果'];
  const checks = (data.assertions || []).map((assertion, index) => {
    const path = JSON.stringify(assertion.path);
    if (assertion.operator === 'exists') return `    expect(readPath(result, ${path})).not.toBeNull();\n    expect(readPath(result, ${path})).not.toBeUndefined();`;
    const value = `expected[${index}]`;
    return `    expect(readPath(result, ${path})).${assertion.operator === 'contains' ? 'toContain' : 'toEqual'}(${value});`;
  }).join('\n');
  const request = { kind: item.kind, method: item.method, endpoint: item.endpoint, operationType: item.operationType || '',
    headers: item.headers || {}, queryParams: item.queryParams || {}, body: item.body ?? null };
  let requestSource = JSON.stringify(request, null, 2);
  if (item.kind === 'graphql' && typeof request.body?.query === 'string') {
    const prefix = '\n    "query": ';
    const bodyStart = requestSource.indexOf('\n  "body": {');
    const field = requestSource.indexOf(prefix, bodyStart);
    if (bodyStart >= 0 && field >= 0) {
      const start = field + prefix.length, encoded = JSON.stringify(request.body.query);
      const literal = '`' + request.body.query.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${') + '`';
      if (requestSource.slice(start, start + encoded.length) === encoded) requestSource = requestSource.slice(0, start) + literal + requestSource.slice(start + encoded.length);
    }
  }
  return `import { test, expect } from '@playwright/test';
import { bffUrl, bffHeaders, resolveData, readPath } from ${JSON.stringify(supportImport)};

// 平常只需修改這份測試檔。網址與共用 Header 在 .env／config/http.json。
// scenario.variables 填 {{名稱}} 的實際測試值；GraphQL 傳送結構在下方 body.variables。
const scenario = ${JSON.stringify({ ready: data.enabled === true, allowWrite: data.allowWrite === true, variables: data.variables || {}, headers: data.headers || {}, expectedStatus: data.expectedStatus, ...(checks ? { expectedValues: data.assertions.map(value => value.value ?? null) } : { expectedResult: null }) }, null, 2)};

const operation = ${requestSource};
const steps = ${JSON.stringify(steps)};

test(${JSON.stringify(item.name)}, { annotation: [
  { type: 'archify-id', description: ${JSON.stringify(id)} },
  { type: 'archify-plan', description: JSON.stringify(steps) }
] }, async ({ request }) => {
  test.skip(!scenario.ready, '草稿：請先補齊資料、預期與業務斷言，再將 ready 設為 true。');
  const expected = resolveData(scenario.${checks ? 'expectedValues' : 'expectedResult'}, scenario.variables);
  await test.step(steps[0], async () => {
    expect(scenario.expectedStatus, '請設定 expectedStatus').not.toBeNull();
    expect(Number.isInteger(scenario.expectedStatus), 'expectedStatus 必須是 HTTP 狀態碼').toBe(true);
    expect(scenario.expectedStatus).toBeGreaterThanOrEqual(100);
    expect(scenario.expectedStatus).toBeLessThanOrEqual(599);
    expect(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']).toContain(operation.method);
${checks ? '' : "    expect(expected, '請先設定 expectedResult 或改寫下方業務斷言').not.toBeNull();\n"}    const writes = !['GET', 'HEAD', 'OPTIONS'].includes(operation.method) && !(operation.kind === 'graphql' && operation.operationType === 'query');
    if (writes) expect(scenario.allowWrite, '請確認寫入授權與清理方式').toBe(true);
    expect(operation.operationType, '尚未支援 subscription').not.toBe('subscription');
  });
  const response = await test.step(steps[1], async () => {
    if (operation.kind === 'graphql' && typeof operation.body?.query === 'string' && operation.body.query.includes('{{')) throw new Error('query 請改用 GraphQL variables，不直接插入動態字串。');
    const body = resolveData(operation.body, scenario.variables);
    return request.fetch(bffUrl(operation.endpoint, scenario.variables), {
      method: operation.method,
      headers: bffHeaders(operation.headers, scenario.headers, scenario.variables),
      params: resolveData(operation.queryParams, scenario.variables),
      ...(!['GET', 'HEAD'].includes(operation.method) && body !== null ? { data: body } : {}),
      timeout: 30000, maxRedirects: 0, failOnStatusCode: false
    }).catch(() => { throw new Error('中間層請求未完成，請在本機核對環境與連線；不輸出 Header 或原始回應。'); });
  });
  await test.step(steps[2], async () => {
    try {
    expect(response.status()).toBe(scenario.expectedStatus);
    const result = await response.json();
    if (operation.kind === 'graphql') expect(result.errors || []).toHaveLength(0);
${checks || '    expect(result).toMatchObject(expected);'}
    } catch { throw new Error('HTTP 或業務斷言未符合預期，請核對本檔資料與斷言；不輸出原始回應。'); }
  });
});
`;
}
