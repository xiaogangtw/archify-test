import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

export async function loadPlaywright() {
  const require = createRequire(resolve(process.cwd(), 'package.json'));
  if (process.env.PLAYWRIGHT_MODULE_PATH) return require(process.env.PLAYWRIGHT_MODULE_PATH);
  try { return require('playwright'); }
  catch { throw new Error('找不到 Playwright；請提供已安裝的套件，或設定 PLAYWRIGHT_MODULE_PATH 指向套件路徑。'); }
}

export async function createMobileContext(browser, options = {}) {
  return browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, locale: 'zh-TW', ...options });
}

export async function captureMobile(page, file, { hideDiagnostics = false } = {}) {
  assert.deepEqual(page.viewportSize(), { width: 390, height: 844 }, '證據必須是手機 viewport');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(img => img.complete ? null : new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 5000);
    })));
  });
  await mkdir(dirname(file), { recursive: true });
  await page.screenshot({ path: file, type: 'png', fullPage: false, animations: 'disabled',
    ...(hideDiagnostics ? { style: '#floating-debug-console-root { visibility: hidden !important; }' } : {}) });
  const bytes = await readFile(file);
  assert.equal(bytes.readUInt32BE(16), 390, '截圖寬度不符');
  assert.equal(bytes.readUInt32BE(20), 844, '截圖高度不符');
  return { width: 390, height: 844, diagnosticsHidden: hideDiagnostics };
}
