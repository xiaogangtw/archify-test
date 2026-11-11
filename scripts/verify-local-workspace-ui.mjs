import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile, lstat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { fixture } from '../services/local-workspace/test-support.mjs';
import { createHandler } from '../services/local-workspace/plugin.mjs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('../.local/gate-deps/node_modules/playwright')); }
assert.equal(process.env.DS_REQUIRE_BROWSER, '1');
const f = await fixture();await f.workspace.initialize();await f.enableUi();const handler = createHandler(f.workspace, 'ui-session');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const assets = await readdir('apps/web/dist/assets');
const css = await readFile('apps/web/dist/assets/' + assets.find(name => name.endsWith('.css')), 'utf8');
const js = await readFile('apps/web/dist/assets/' + assets.find(name => name.endsWith('.js')), 'utf8');
const html = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Archify 本機分析驗證</title><style>'+css+'</style><body><div id="root"></div><script>'+js.replaceAll('</script', '<\\/script')+'</script></body></html>';
const errors = [];
page.on('pageerror', error => errors.push(error.message));
// Route only the transport: run the actual middleware, scanner and file service against temporary folders.
await page.route('http://127.0.0.1:5189/**', async route => {
  const request = route.request(), url = new URL(request.url());
  if (!url.pathname.startsWith('/local-api/')) return route.fulfill({ status: 200, contentType: 'text/html', body: html });
  const req = Readable.from(request.postData() ? [request.postData()] : []);
  req.url = url.pathname; req.method = request.method(); req.socket = { remoteAddress: '127.0.0.1' };
  req.headers = { ...request.headers(), host: url.host };
  let status = 200, contents;
  const res = { set statusCode(value) { status = value; }, setHeader() {}, end(value) { contents = value; } };
  await handler(req, res);
  await route.fulfill({ status, contentType: 'application/json', body: contents });
});
try {
  await page.goto('http://127.0.0.1:5189/');
  await page.getByText('資料夾設定', { exact: true }).click();
  await page.getByLabel('中間層腳本輸出資料夾', { exact: true }).fill('tests/api/converted');
  await page.getByRole('button', { name: '瀏覽來源子資料夾' }).click();
  await page.getByRole('button', { name: 'src', exact: true }).click();
  assert.equal(await page.getByLabel('來源子資料夾（留空分析根目錄）').inputValue(), 'src');
  await page.getByLabel('來源子資料夾（留空分析根目錄）').fill('');
  const scan = page.getByRole('button', { name: '分析前端' });
  await scan.focus(); await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: /3 支中間層/ }).waitFor();
  await page.getByRole('searchbox', { name: '搜尋中間層接口' }).fill('login');
  await page.getByRole('checkbox', { name: '選取目前結果（1）', exact: true }).check();
  await page.getByRole('button', { name: '建立所選腳本（1）' }).click();
  await page.getByRole('status').filter({ hasText: '已建立 1 支腳本' }).waitFor();
  const output = join(f.project, 'tests/api/converted');
  const cases = await readdir(output); assert.equal(cases.length, 1);
  const before = await readFile(join(output, cases[0]), 'utf8');
  await page.getByRole('button', { name: '建立所選腳本（1）' }).click();
  await page.getByRole('status').filter({ hasText: '1 支保留原檔' }).waitFor();
  assert.equal(await readFile(join(output, cases[0]), 'utf8'), before);
  await page.getByRole('searchbox', { name: '搜尋中間層接口' }).fill('');
  assert.deepEqual((await page.locator('[data-script-status]').allTextContents()).sort(), ['尚未建立','尚未建立','已建立腳本'].sort());
  for (const width of [1024,1280,1440,1920]) {
    await page.setViewportSize({width,height:1000});
    const boxes = await page.locator('[data-catalog-details]').evaluateAll(nodes => nodes.map(node => ({left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right})));
    assert.ok(boxes.every(box=>Math.abs(box.left-boxes[0].left)<1&&Math.abs(box.right-boxes[0].right)<1), 'details aligned '+width);
  }
  await page.getByRole('searchbox', { name: '搜尋中間層接口' }).fill('login');
  const fill = page.getByRole('button', { name: '補齊缺少腳本（2）', exact:true });
  await contrast(fill); await fill.hover(); await contrast(fill); await fill.click();
  await page.getByRole('status').filter({hasText:'已建立 2 支腳本'}).waitFor();
  assert.equal((await readdir(output)).length,3);
  assert.equal(await readFile(join(output,cases[0]),'utf8'),before, 'fill keeps existing bytes');
  assert.equal(await page.getByRole('button',{name:'補齊缺少腳本（0）',exact:true}).isDisabled(),true);
  await page.getByRole('searchbox', { name: '搜尋中間層接口' }).fill('');
  assert.ok((await page.locator('[data-script-status]').allTextContents()).every(text=>text==='已建立腳本'));
  await page.getByRole('checkbox', { name: '選取目前結果（3）', exact: true }).check();
  await page.getByRole('button', { name: '建立所選腳本（3）' }).click();
  await page.getByRole('status').filter({ hasText: '3 支保留原檔' }).waitFor();
  await page.getByLabel('中間層腳本輸出資料夾', { exact: true }).fill('tests/elsewhere');
  assert.equal(await page.getByRole('button', { name: '建立所選腳本（3）' }).isDisabled(), true);
  await page.getByLabel('中間層腳本輸出資料夾', { exact: true }).fill('tests/api/converted');
  const graphql = page.getByRole('button', { name: 'GraphQL', exact: true }); await graphql.focus(); await page.keyboard.press('Space');
  assert.equal(await page.locator('article').count(), 1);
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.locator('article summary').first().click();
  const axePath = require.resolve('../.local/gate-deps/node_modules/axe-core/axe.min.js');
  await page.addScriptTag({ path: axePath });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations);
  assert.deepEqual(violations.map(item => item.id), [], 'axe WCAG');
  for (const width of [390, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('main,body,.app-shell')].some(el => el.scrollWidth > el.clientWidth + 1)), false, 'overflow '+width);
  }
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.evaluate(() => document.documentElement.style.zoom = '2');
  assert.equal(await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1), false, '200% zoom');
  await page.evaluate(() => document.documentElement.style.zoom = '1');
  async function contrast(locator) {
    const ratio = await locator.evaluate(el => {
      const rgb = text => text.match(/[\d.]+/g).map(Number);
      const style = getComputedStyle(el); let bg = style.backgroundColor, parent = el;
      while (rgb(bg)[3] === 0 && parent.parentElement) { parent = parent.parentElement; bg = getComputedStyle(parent).backgroundColor; }
      const luminance = color => { const v = rgb(color).slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4); return v[0] * .2126 + v[1] * .7152 + v[2] * .0722; };
      const a = luminance(style.color), b = luminance(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    assert.ok(ratio >= 4.5, `state contrast ${ratio}`);
  }
  for (const button of await page.locator('button:enabled').all()) {
    const box = await button.boundingBox(); assert.ok(box.height >= 32 && box.width >= 24);
    await contrast(button); await button.hover(); await contrast(button);
    await page.keyboard.press('Tab'); await button.focus(); assert.notEqual(await button.evaluate(el => getComputedStyle(el).boxShadow), 'none');
    await contrast(button); await button.hover(); await page.mouse.down();
    try { await contrast(button); } finally { await page.mouse.move(0, 0); await page.mouse.up(); }
  }
  assert.equal(await page.locator('select').count(), 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('button').evaluateAll(elements => elements.every(el => getComputedStyle(el).animationName === 'none' && getComputedStyle(el).transitionDuration === '0s')), true);
  await f.attachDependencies();
  const run = spawnSync(process.execPath, ['support/commands.mjs', 'flow'], { cwd: f.project, encoding: 'utf8' }); assert.equal(run.status, 0, run.stderr);
  await page.getByRole('button', { name: '測試流程', exact: true }).click();
  await page.getByRole('table',{name:'測試流程案例'}).waitFor();
  assert.equal(await page.locator('main button').count(),3);
  await page.getByRole('button',{name:'測試報告',exact:true}).click();
  await page.getByRole('heading',{name:'尚無測試報告',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/^flow-/}).count(),0);
  await page.getByRole('button', { name: '前端程式碼分析', exact: true }).click();
  await page.getByRole('heading', { name: /3 支中間層/ }).waitFor();
  await page.reload();
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('heading', { name: /3 支中間層/ }).waitFor();
  assert.ok((await lstat(join(f.project, 'framework/http.mjs'))).isFile());
  // Exercise removal with a real source change, not a mocked response.
  const removedFile = join(f.project, 'tests/api/converted/GetCard.spec.ts');
  const originalRemoved = await readFile(removedFile);
  await unlink(join(f.source, 'src/cards.gql'));
  await page.getByText('資料夾設定', { exact: true }).click();
  await page.getByLabel('中間層腳本輸出資料夾', { exact: true }).fill('tests/api/converted');
  await page.getByRole('button', { name: '分析前端', exact: true }).click();
  await page.getByRole('heading', { name: '2 支中間層', exact: true }).waitFor();
  await page.getByText('前端未再出現（1 支腳本）', { exact: true }).click();
  await page.getByRole('checkbox', { name: /^GetCard tests\/api\/converted\/GetCard/ }).check();
  await page.getByRole('button', { name: '移除所選腳本（1）', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  assert.deepEqual(await readFile(removedFile), originalRemoved);
  await page.getByRole('button', { name: '移除所選腳本（1）', exact: true }).click();
  await page.addScriptTag({ path: axePath });
  const removalAxe = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations);
  assert.deepEqual(removalAxe.map(row => row.id), []);
  for (const width of [390, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.querySelector('dialog').scrollWidth > document.querySelector('dialog').clientWidth + 1), false);
  }
  const confirm = page.getByRole('dialog').getByRole('button', { name: '確認移除並封存', exact: true });
  await page.keyboard.press('Tab'); await confirm.focus(); await contrast(confirm); await confirm.hover(); await contrast(confirm);
  if (process.env.ARCHIFY_GATE_REVIEW === '1') console.log('REVIEW_IMAGE:' + (await page.screenshot({ type: 'jpeg', quality: 45 })).toString('base64'));
  await confirm.click();
  await page.getByRole('status').filter({ hasText: '已移出 1 支腳本' }).waitFor();
  await assert.rejects(() => lstat(removedFile), { code: 'ENOENT' });
  await page.getByRole('button', { name: '還原上次移除', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '已還原 1 支腳本' }).waitFor();
  assert.deepEqual(await readFile(removedFile), originalRemoved);
  assert.deepEqual(errors, []);
  for (const name of ['WorkspaceApp.tsx', 'SourceWorkspace.tsx', 'ConfiguredReports.tsx']) {
    const source = await readFile('apps/web/src/features/workspace/'+name, 'utf8');
    assert.ok(!/\bstyle\s*=|<select\b|\p{Extended_Pictographic}|#[a-f\d]{3,8}\b/iu.test(source), 'hardcode/emoji/native-select gate');
  }
  console.log('PASS local workspace UI: actual middleware/files/scanner, generate/no-overwrite, removed source detection, cancel/archive/restore with exact bytes, destructive confirmation contrast/axe/overflow, restart, keyboard, axe, 390/1024/1280/1440/1920 overflow, zoom, focus/targets, reduced motion. Browser transport intercepted; no product API executed.');
} finally { await browser.close(); await f.dispose(); }
