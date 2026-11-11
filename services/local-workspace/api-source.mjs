import { operationSource } from './playwright-source.mjs';

export function apiModuleSource(item, declaration = operationSource(item)) {
  return `import type { APIRequestContext } from '@playwright/test';
import { sendApi, type ApiCallOptions } from '../support/api-client.mjs';

export const operation = ${declaration};

export function callApi(request: APIRequestContext, options: ApiCallOptions = {}) {
  return sendApi(request, operation, options);
}
`;
}
export function apiTestSource(item, moduleImport) {
  return `import { test } from '@playwright/test';
import { callApi, operation } from ${JSON.stringify(moduleImport)};

// 請求與預設資料在 api/；由 AI 補實際步驟與斷言，不可只移除 skip。
// callApi(request, { variables, headers }) 可供單支及流程測試重用。
test.skip(${JSON.stringify(item.name)}, { annotation: [
  { type: 'archify-id', description: ${JSON.stringify('API-' + item.id)} }
] }, async () => {});
`;
}
