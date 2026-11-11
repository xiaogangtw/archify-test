import { test, expect } from '@playwright/test';
test('唯讀 API Smoke', async ({ request }) => {
  await test.step('確認服務健康狀態', async () => {
    const response = await request.get(`${process.env.ARCHIFY_BASE_URL}/health`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });
  await test.step('確認首頁可讀取', async () => {
    const response = await request.get(`${process.env.ARCHIFY_BASE_URL}/`);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('Archify Smoke');
  });
});
