# 共用 API 契約與流程範例

每個 api/操作名稱.ts 匯出 operation 與 callApi(request, options = {})，回傳 Promise<APIResponse>，import 時以功能別名辨識。

| options | 用途 |
| --- | --- |
| variables | GraphQL variables 頂層覆寫，巢狀物件完整傳入 |
| values | {{名稱}} 占位值，不等同 GraphQL variables |
| headers | 合併共用 Header；null 移除，例如 satoken: null |
| body | 完整取代 body，適用 REST 或 GraphQL |
| queryParams | 覆寫 URL query，值限 string、number、boolean |

呼叫只送一次，不自動登入、不存 token、不斷言、不重試。預設 timeout 30 秒、不跟隨 redirect；HTTP 4xx／5xx 回傳 response 供案例斷言。沿用 support/bff.mjs 的 .env 與 Header。傳輸失敗沒有 response。

以下為 tests/flows/PinCardFlow.spec.ts 的結構參考，回應欄位與資料僅示意，需讀實際 query／variables／知識及登入裝置 Header 契約後補齊才啟用。不可把示意欄位當成既有產品契約。

```ts
import { test, expect } from '@playwright/test';
import { callApi as login } from '../../api/Login.js';
import { callApi as getCard } from '../../api/GetCardPreview.js';
import { callApi as pinCard } from '../../api/PinCard.js';

test.skip('登入後釘選名片並確認', async ({ request }) => {
  const token = await test.step('登入', async () => {
    const response = await login(request, { headers: { satoken: null } });
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.errors ?? []).toHaveLength(0);
    expect(result.data.login.token).toEqual(expect.any(String));
    return result.data.login.token as string;
  });
  const cardId = await test.step('取得名片', async () => {
    const response = await getCard(request, { headers: { satoken: token } });
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.errors ?? []).toHaveLength(0);
    expect(result.data.card.id).toEqual(expect.any(String));
    return result.data.card.id as string;
  });
  await test.step('釘選名片', async () => {
    const response = await pinCard(request, { variables: { cardId }, headers: { satoken: token } });
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.errors ?? []).toHaveLength(0);
    expect(result.data.pinCard.success).toBe(true);
  });
  await test.step('再次查詢確認釘選', async () => {
    const response = await getCard(request, { variables: { cardId }, headers: { satoken: token } });
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.errors ?? []).toHaveLength(0);
    expect(result.data.card.pinned).toBe(true);
  });
  // 啟用前補核准的清理方式，必要時使用 try/finally。
});
```

單支 tests/api/ 也匯入同一 callApi，以該情境的資料呼叫並斷言，不需要經過流程。API 模組不是另一支測試，不可在流程呼叫 CLI 啟動其他 spec，也不可依賴檔案順序、全域或報告中的 token。
