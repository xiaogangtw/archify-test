import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fixture } from '../services/local-workspace/test-support.mjs';
import { createHandler } from '../services/local-workspace/plugin.mjs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('../.local/gate-deps/node_modules/playwright')); }
assert.equal(process.env.DS_REQUIRE_BROWSER, '1');
const f = await fixture();
let browser;
try {
  await f.workspace.initialize(); await f.enableUi();
  const scan = await f.workspace.scan();
  await f.workspace.generate({ scanId: scan.scanId, ids: scan.requests.map(item => item.id) });
  const view = await f.workspace.catalog();
  const base = { featureId: 'F-CARD', kind: 'api', purpose: '核對合成名片', preconditions: '合成測試資料', data: '', expected: '顯示指定名片', target: 'api', cleanup: '不需清理', knowledgeIds: [], questions: [], steps: [{ action: '讀取名片', expected: '回傳指定 ID' }] };
  await f.workspace.saveCatalog({ revision: view.revision, catalog: { schemaVersion: 1, features: [{ id: 'F-CARD', name: '名片管理', sources: [] }], cases: [
    { ...base, id: 'TC-QUALITY', title: '登入後讀取自己的名片', expected: '正常' },
    { ...base, id: 'TC-FAILED', title: '讀取不存在的名片', script: 'tests/api/GetCard.spec.ts' },
    { ...base, id: 'TC-LONG', title: '長篇案例名稱'.repeat(15), target: 'web' },
  ] } });
  await mkdir(join(f.project, 'reports'), { recursive: true });
  await writeFile(join(f.project, 'reports/report-tracking.json'), JSON.stringify({ schemaVersion: 1, project: '合成追蹤', runId: 'tracking-run', kind: 'execution', createdAt: '2026-11-13T01:00:00Z', cases: [{ id: 'TC-FAILED', caseId: 'TC-FAILED', name: '讀取不存在的名片', source: 'tests/api/GetCard.spec.ts', status: 'failed', steps: [{ name: '讀取名片', expected: '回傳指定 ID', status: 'failed' }] }] }));
  const handler = createHandler(f.workspace, 'tracking-ui');
  const assets = await readdir('apps/web/dist/assets');
  const html = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>測試追蹤驗證</title><style>${await readFile('apps/web/dist/assets/' + assets.find(name => name.endsWith('.css')), 'utf8')}</style><body><div id="root"></div><script>${(await readFile('apps/web/dist/assets/' + assets.find(name => name.endsWith('.js')), 'utf8')).replaceAll('</script', '<\\/script')}</script></body></html>`;
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    assert.equal(url.hostname, '127.0.0.1', '不得發出產品請求');
    if (!url.pathname.startsWith('/local-api/')) return route.fulfill({ status: 200, contentType: 'text/html', body: html });
    const req = Readable.from(request.postData() ? [request.postData()] : []);
    req.url = url.pathname; req.method = request.method(); req.socket = { remoteAddress: '127.0.0.1' }; req.headers = { ...request.headers(), host: url.host };
    let status = 200, body;
    await handler(req, { set statusCode(value) { status = value; }, setHeader() {}, end(value) { body = value; } });
    await route.fulfill({ status, contentType: 'application/json', body });
  });
  await page.goto('http://127.0.0.1:5191/?view=catalog');
  await page.getByRole('button', { name: '測試清單', exact: true }).click();
  const tracking = page.getByRole('region', { name: '測試追蹤', exact: true });
  const table = tracking.getByRole('table', { name: '測試清單', exact: true });
  await table.waitFor();
  assert.equal(await table.locator('tbody tr').count(), 3);
  assert.match(await table.locator('tbody tr').first().innerText(), /讀取不存在的名片/);
  await tracking.getByRole('button', { name: '最近失敗（1）', exact: true }).click();
  assert.equal(await table.locator('tbody tr').count(), 1);
  await tracking.getByRole('button', { name: '全部（3）', exact: true }).click();
  await tracking.getByRole('searchbox', { name: '搜尋測試案例', exact: true }).fill('TC-QUALITY');
  await table.locator('summary').filter({ hasText: '查看待補項目' }).focus(); await page.keyboard.press('Enter');
  await table.getByText('請描述可核對的畫面、回應欄位或狀態，避免只寫正常或成功。', { exact: true }).waitFor();
  await table.getByRole('button', { name: '登入後讀取自己的名片', exact: true }).click();
  await page.getByRole('button', { name: '關閉詳情', exact: true }).click();
  assert.equal(await tracking.getByRole('searchbox', { name: '搜尋測試案例', exact: true }).inputValue(), 'TC-QUALITY');
  await page.waitForFunction(() => document.activeElement?.textContent === '登入後讀取自己的名片');
  await tracking.getByRole('searchbox', { name: '搜尋測試案例', exact: true }).fill('查無資料');
  await tracking.getByText('沒有符合條件的案例。', { exact: true }).waitFor();
  await tracking.getByRole('button', { name: '清除篩選', exact: true }).click();
  await tracking.getByRole('button', { name: '畫面', exact: true }).click();
  assert.equal(await table.locator('tbody tr').count(), 1);
  await tracking.getByRole('button', { name: '全部類型', exact: true }).click();
  await tracking.getByRole('button', { name: '版本待核對（1）', exact: true }).click();
  assert.equal(await table.locator('tbody tr').count(), 1);
  await table.getByText('報告版本未知', { exact: true }).waitFor();
  await tracking.getByRole('button', { name: '全部（3）', exact: true }).click();
  await page.addScriptTag({ path: require.resolve('../.local/gate-deps/node_modules/axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations);
  assert.deepEqual(violations.map(item => ({ id: item.id, nodes: item.nodes.map(n => n.target) })), []);
  for (const width of [390, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `overflow ${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, '200% zoom');
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });
  async function contrast(locator) {
    const ratio = await locator.evaluate(el => {
      const rgb = text => text.match(/[\d.]+/g).map(Number);
      const style = getComputedStyle(el);
      let bg = style.backgroundColor, parent = el;
      while (rgb(bg)[3] === 0 && parent.parentElement) { parent = parent.parentElement; bg = getComputedStyle(parent).backgroundColor; }
      const luminance = color => { const v = rgb(color).slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4); return v[0] * .2126 + v[1] * .7152 + v[2] * .0722; };
      const a = luminance(style.color), b = luminance(bg);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    assert.ok(ratio >= 4.5, `control contrast ${ratio}`);
  }
  for (const button of await tracking.locator('button, summary, input').all()) {
    if (!await button.isVisible()) continue;
    const box = await button.boundingBox(); assert.ok(box.height >= 32 && box.width >= 24, 'compact target');
    await contrast(button); await button.hover(); await contrast(button); await page.keyboard.press('Tab'); await button.focus(); await contrast(button);
    assert.notEqual(await button.evaluate(el => getComputedStyle(el).boxShadow), 'none', 'focus ring');
    await button.hover(); await page.mouse.down();
    try { await contrast(button); } finally { await page.mouse.move(0, 0); await page.mouse.up(); }
  }
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  assert.equal(await tracking.locator('select, [style]').count(), 0);
  assert.deepEqual(errors, []);
  if (process.env.ARCHIFY_GATE_REVIEW === '1') {
    await page.evaluate(() => { getSelection()?.removeAllRanges(); document.activeElement?.blur(); });
    console.log('REVIEW_IMAGE:' + (await page.screenshot({ type: 'png' })).toString('base64'));
  }
  const source = await readFile('apps/web/src/features/workspace/CaseTrackingTable.tsx', 'utf8');
  assert.ok(!/style\s*=|<select\b|\p{Extended_Pictographic}|#[a-f\d]{3,8}\b/iu.test(source));
  console.log('PASS tracking: real local fixture, quality details, filters/counts, search/reset, result/version separation, detail return/focus, axe/contrast, compact targets, 390/1024/1280/1440/1920 overflow and 200% zoom. Product requests 0.');
} finally { if (browser) await browser.close(); await f.dispose(); }

