import { legacyPlaywrightSource } from './legacy-playwright-source.mjs';

export function operationSource(item) {
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
  return requestSource;
}

export function playwrightSource(item, settings, supportImport, id = 'API-' + item.id) {
  if (settings !== undefined) return legacyPlaywrightSource(item, settings, supportImport, id);
  const requestSource = operationSource(item);
  return `import { test } from '@playwright/test';

export const operation = ${requestSource};

// 填寫 variables 後，交由 AI 撰寫實際測試與斷言。此草稿不發送請求。
test.skip(${JSON.stringify(item.name)}, { annotation: [
  { type: 'archify-id', description: ${JSON.stringify(id)} }
] }, async () => {});
`;
}
