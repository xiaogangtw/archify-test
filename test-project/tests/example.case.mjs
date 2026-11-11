import { defineCase } from '../framework/runtime.mjs';

export default defineCase({
  id: 'EXAMPLE-001',
  name: '框架範例：計算訂單總額',
  purpose: '只驗證本機範例運算，不代表受測產品或外部 API 已通過。',
  steps: [
    { name: '準備兩筆品項', expected: '測試資料包含兩筆品項', async run(context, verify) {
      context.items = [120, 80]; verify(context.items.length, 2);
    } },
    { name: '確認訂單總額', expected: '總額為 200', async run(context, verify) {
      verify(context.items.reduce((total, price) => total + price, 0), 200);
    } }
  ]
});
