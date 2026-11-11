// Opt-in against a running development site and an existing device. Injects
// one browser decode failure; sends no device controls and saves no images.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const Original = VideoDecoder;
    window.recoveryConfigs = [];
    let failed = false;
    window.VideoDecoder = class {
      constructor(options) { this.options = options; this.inner = new Original(options); }
      get state() { return this.inner.state; }
      get decodeQueueSize() { return this.inner.decodeQueueSize; }
      configure(config) { window.recoveryConfigs.push(config.hardwareAcceleration); this.inner.configure(config); }
      decode(chunk) {
        if (!failed) { failed = true; this.options.error(new DOMException('Injected test failure', 'EncodingError')); return; }
        this.inner.decode(chunk);
      }
      reset() { this.inner.reset(); }
      close() { this.inner.close(); }
    };
  });
  await page.goto(process.env.ARCHIFY_TEST_URL || 'http://localhost:5173');
  await page.getByRole('button', { name: 'Android Appium', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'EncodingError' }).waitFor({ timeout: 20000 });
  await page.getByRole('status').filter({ hasText: '即時串流中' }).waitFor({ timeout: 20000 });
  assert.ok((await page.evaluate(() => window.recoveryConfigs)).includes('prefer-software'));
  assert.equal(await page.getByRole('alert').count(), 0);
  console.log('PASS visible decode error, software fallback, actual video recovery and error clearing. One injected browser failure; no screenshots saved.');
} finally { await browser.close(); }
