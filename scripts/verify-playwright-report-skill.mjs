import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createMobileContext, captureMobile } from '../test-project/skills/playwright-test-report/scripts/playwright-harness.mjs';
import { buildReport } from '../test-project/skills/playwright-test-report/scripts/build-report.mjs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('../.local/gate-deps/node_modules/playwright')); }
assert.equal(process.env.DS_REQUIRE_BROWSER, '1');
const directory = await mkdtemp(join(tmpdir(), 'archify-report-skill-'));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const context = await createMobileContext(browser);
  const page = await context.newPage();
  await page.setContent('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>合成驗證</title><h1>報告工具合成驗證頁</h1><p>不是產品測試證據。</p></html>');
  const shot = await captureMobile(page, join(directory, 'screenshots', 'fixture.png'));
  assert.deepEqual(shot, { width: 390, height: 844, diagnosticsHidden: false });
  const data = { title: '合成報告工具驗證', startedAt: '2026-11-07T03:04:05.006Z', date: '2026-11-07', environment: '本機合成資料', method: '工具回歸，未執行產品', summary: '只驗證報告產生與離線互動。', limitations: ['不是產品驗收'], cleanup: [], cases: [{ id: 'fixture', title: '合成案例', status: 'NOT_RUN', expected: '<script>window.injected=true</script>', actual: '未執行產品', steps: ['合成證據'], screenshots: [{ file: 'screenshots/fixture.png', caption: '合成頁面，非產品畫面', role: '驗證替身' }] }] };
  await writeFile(join(directory, 'results.json'), JSON.stringify(data));
  const report = await buildReport(directory);
  assert.match(report.files.html, /^report-2026-11-07_11-04-05-006-[a-f0-9]{8}\.html$/);
  const html = await readFile(join(directory, report.files.html), 'utf8');
  const markdown = await readFile(join(directory, report.files.markdown), 'utf8');
  assert.ok(markdown.startsWith('# 合成報告工具驗證\n\n'), 'Markdown 必須使用實際換行');
  assert.ok(html.includes('data:image/png;base64,')); assert.ok(html.includes('&lt;script&gt;'));
  const repeat = await buildReport(directory); assert.notEqual(report.files.html, repeat.files.html);
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await desktop.goto(pathToFileURL(join(directory, report.files.html)).href);
  await desktop.locator('.shot img').evaluate(img => img.decode());
  assert.equal(await desktop.evaluate(() => window.injected), undefined);
  await desktop.getByRole('button', { name: '放大：合成頁面，非產品畫面' }).click();
  await desktop.locator('dialog[open]').waitFor(); await desktop.keyboard.press('Escape');
  assert.equal(await desktop.locator('dialog').getAttribute('open'), null);
  await desktop.getByRole('button', { name: '放大：合成頁面，非產品畫面' }).click();
  await desktop.getByRole('button', { name: '關閉 ×' }).click();
  for (const width of [390, 1280]) {
    await desktop.setViewportSize({ width, height: 1000 });
    assert.equal(await desktop.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  }
  data.cases[0].screenshots[0].file = '../outside.png';
  await writeFile(join(directory, 'results.json'), JSON.stringify(data));
  await assert.rejects(buildReport(directory), /超出報告資料夾/);
  console.log('PASS Playwright report skill: synthetic 390x844 capture, timestamp outputs, offline embedded PNG, escaping, zoom/Escape/close, 390/1280 overflow, path rejection. No product tested.');
} finally {
  await browser.close(); assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(basename(directory).startsWith('archify-report-skill-'));
  await rm(directory, { recursive: true, force: true });
}
