// Live application gates; no screenshots are written. Start the reader first.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('../.local/gate-deps/node_modules/playwright')); }
assert.equal(process.env.DS_REQUIRE_BROWSER, '1', 'Set DS_REQUIRE_BROWSER=1 for measured browser gates');
const { build } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');
const bundle = await build({ entryPoints: ['apps/web/src/features/reader/report.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { parseReport } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const tokens = await build({ entryPoints: ['apps/web/tailwind.config.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { default: theme } = await import('data:text/javascript;base64,' + Buffer.from(tokens.outputFiles[0].text).toString('base64'));
assert.equal(theme.theme.fontSize.body[0], '0.875rem');
assert.equal(theme.theme.fontSize.heading[0], '1.25rem');
assert.deepEqual(theme.theme.fontWeight, { normal: '400', medium: '500', bold: '700' });
assert.equal(theme.theme.borderRadius.lg, '0.5rem');
assert.equal(theme.theme.borderRadius.xl, '0.75rem');
const report = parseReport(JSON.stringify({schemaVersion:1,kind:'execution',project:'閱讀器合成驗證資料，不是產品結果',runId:'fixture-run',createdAt:'2026-11-07T03:04:05Z',cases:[{id:'EXAMPLE',name:'合成案例',purpose:'閱讀器測試替身',source:'tests/example.case.mjs',sourceHash:'a'.repeat(64),status:'passed',steps:[{name:'步驟一',expected:'合成結果一',status:'passed'},{name:'步驟二',expected:'合成結果二',status:'passed'}]}]}));
assert.throws(() => parseReport(JSON.stringify({ ...report, schemaVersion: 2 })));
assert.throws(() => parseReport(JSON.stringify({ ...report, cases: [{ ...report.cases[0], status: 'passed', steps: [{ ...report.cases[0].steps[0], status: 'failed' }] }] })));
const long = '長案例名稱與流程內容'.repeat(35);
report.cases[0].name = long;
report.cases[0].steps[0].name = 'x'.repeat(180);
report.cases[0].expected='名片列表應顯示本輪建立的合成名片。';
report.cases[0].actual='合成報告展示，並非產品驗收結果。';
report.cases[0].scenarioSteps=[{action:'開啟合成案例',expected:'本機顯示合成情境'}];
report.cases[0].screenshots=[{caption:'1. A／頁面1｜合成圖片｜完成後',data:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j/p0AAAAASUVORK5CYII='}];
const failed = structuredClone(report.cases[0]);
failed.id = 'FAILURE'; failed.name = '驗證用失敗案例'; failed.status = 'failed'; failed.steps[0].status = 'failed'; failed.steps[0].error = '<script>window.injected=true</script>';
failed.steps[1].status = 'skipped'; failed.cleanup = { status: 'failed', error: '清理失敗' };
report.cases.push(failed);
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const assets = await readdir('apps/web/dist/assets');
const css = await readFile('apps/web/dist/assets/' + assets.find(name => name.endsWith('.css')), 'utf8');
const js = await readFile('apps/web/dist/assets/' + assets.find(name => name.endsWith('.js')), 'utf8');
const url = process.env.READER_URL || 'http://127.0.0.1:5192/?view=reports';
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(5000);
const errors = [], api = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api')) api.push(request.url()); });
let currentReport;
const historyRows=Array.from({length:1105},(_,index)=>({name:index===0?'report-synthetic.json':`report-history-${String(index).padStart(4,'0')}.html`,modifiedAt:'2026-11-08T00:00:00Z',size:100,testType:'api'}));
const html='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>報告驗證</title><style>'+css+'</style><body><div id="root"></div><script>'+js.replaceAll('</script','<\\/script')+'</script></body></html>';
const {fixture}=await import('../services/local-workspace/test-support.mjs');const {createHandler}=await import('../services/local-workspace/plugin.mjs');const {Readable}=await import('node:stream');const fixtureState=await fixture();await fixtureState.workspace.initialize();await fixtureState.enableUi();const handler=createHandler(fixtureState.workspace,'reader-ui');
await page.route('**/local-api/**',async route=>{const request=route.request(),url=new URL(request.url());if(url.pathname==='/local-api/reports')return route.fulfill({json:currentReport?historyRows:[]});if(url.pathname==='/local-api/report')return route.fulfill({json:currentReport});const req=Readable.from(request.postData()?[request.postData()]:[]);req.url=url.pathname;req.method=request.method();req.socket={remoteAddress:'127.0.0.1'};req.headers={...request.headers(),host:url.host};let status=200,body;await handler(req,{set statusCode(v){status=v},setHeader(){},end(v){body=v}});await route.fulfill({status,contentType:'application/json',body});});
if(!process.env.READER_URL)await page.route(/http:\/\/127\.0\.0\.1:5192\/(?:\?.*)?$/,route=>route.fulfill({contentType:'text/html',body:html}));
const upload=async value=>{currentReport=value;await page.getByRole('button',{name:'重新整理',exact:true}).click();await page.getByRole('button',{name:'重新整理',exact:true}).waitFor();};
try {
  await page.goto(url);
  await page.getByText('目前沒有符合此類型的報告。',{exact:true}).waitFor();
  assert.equal(await page.locator('select,input[type=file]').count(),0);
  await page.getByRole('button',{name:'重新整理',exact:true}).focus();assert.equal(await page.locator(':focus').textContent(),'重新整理');
  await upload(report);
  await page.getByText('1105 份報告',{exact:true}).waitFor();
  const latestOpen = page.getByRole('button', { name: '開啟 report-synthetic.json', exact: true });
  assert.equal(await latestOpen.textContent(), '開啟');
  if (process.env.ARCHIFY_GATE_REVIEW === '1') console.log('REPORT_LIST_IMAGE:' + (await page.screenshot({ type: 'png' })).toString('base64'));
  const [bannerDownload] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '下載', exact: true }).first().click()]);
  assert.match(bannerDownload.suggestedFilename(), /\.html$/);
  const [htmlTab] = await Promise.all([page.waitForEvent('popup'), latestOpen.click()]);
  await htmlTab.getByText('情境與操作', { exact: true }).first().waitFor();
  assert.equal(await htmlTab.getByText(/關鍵畫面/).count(), 0, 'old HTML layout without key-images section');
  assert.ok(await htmlTab.locator('.shot img').count() > 0, 'existing screenshot evidence is retained in the original gallery');
  await htmlTab.close();
  const detailUrl = new URL(page.url()); detailUrl.searchParams.set('report', 'report-synthetic.json'); detailUrl.searchParams.set('reportType', 'api');
  await page.goto(detailUrl.toString());
  await page.getByText('2 案例',{exact:true}).waitFor();
  const search = page.getByRole('searchbox', { name: '搜尋案例' });
  await search.fill('不存在');
  await page.getByText('沒有符合條件的案例。').waitFor();
  await search.fill('');
  const failure = page.getByRole('button', { name: '失敗', exact: true });
  await failure.focus(); await page.keyboard.press('Enter');
  assert.equal(await failure.getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('img').count(),0,'report reader omits screenshots');
  assert.equal(await page.getByRole('list',{name:'案例結果'}).locator(':scope > li').count(),1);
  await page.getByRole('article',{name:/FAILURE 驗證用失敗案例/}).waitFor();
  await page.getByText('清理：未完成 · 清理失敗',{exact:true}).waitFor();
  assert.equal(await page.getByText('清理：未完成 · 清理失敗',{exact:true}).evaluate(el=>el.classList.contains('text-danger')),true,'cleanup failure is highlighted');
  await page.getByRole('button', { name: '全部', exact: true }).click();
  await page.getByRole('article',{name:/EXAMPLE/}).getByText('正常流程',{exact:true}).waitFor();
  assert.equal(await page.evaluate(() => window.injected), undefined);
  const axePath = require.resolve('../.local/gate-deps/node_modules/axe-core/axe.min.js');
  await page.addScriptTag({ path: axePath });
  const axe = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations);
  assert.deepEqual(axe.map(item => ({ id: item.id, nodes: item.nodes.length })), [], 'axe WCAG');
  const [htmlDownload]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'下載圖文報告',exact:true}).click()]);
  const downloadStream=await htmlDownload.createReadStream();const downloadChunks=[];for await(const chunk of downloadStream)downloadChunks.push(chunk);
  const downloaded=Buffer.concat(downloadChunks).toString('utf8');
  assert.match(htmlDownload.suggestedFilename(),/\.html$/);assert.match(downloaded,/--navy:#102e50/);assert.match(downloaded,/名片列表應顯示本輪建立的合成名片/);
  for (const width of [390, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.evaluate(() => [...document.querySelectorAll('main, body, .app-shell')].some(el => el.scrollWidth > el.clientWidth + 1));
    assert.equal(overflow, false, `overflow at ${width}`);
  }
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.evaluate(() => document.documentElement.style.zoom = '2');
  assert.equal(await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1), false, '200% zoom');
  await page.evaluate(() => document.documentElement.style.zoom = '1');
  await page.bringToFront();
  async function contrast(locator) {
    const ratio = await locator.evaluate(el => {
      const rgb = text => text.match(/[\d.]+/g).map(Number);
      const style = getComputedStyle(el);
      let bg = style.backgroundColor;
      let parent = el;
      while (rgb(bg)[3] === 0 && parent.parentElement) { parent = parent.parentElement; bg = getComputedStyle(parent).backgroundColor; }
      const luminance = color => { const v = rgb(color).slice(0, 3).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4); return v[0] * .2126 + v[1] * .7152 + v[2] * .0722; };
      const a = luminance(style.color), b = luminance(bg);
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    assert.ok(ratio >= 4.5, `state contrast ${ratio}`);
  }
  await page.getByText('1105 份報告',{exact:true}).waitFor();
  await page.getByRole('button',{name:/顯示更早的報告/}).click();
  assert.equal(await page.locator('button[aria-label^="開啟 report-"]').count(),100);
  const historySearch=page.getByRole('searchbox',{name:'搜尋報告'});
  await historySearch.fill('history-1104');
  const historyOpen=page.getByRole('button',{name:'開啟 report-history-1104.html',exact:true});
  const [historyTab]=await Promise.all([page.waitForEvent('popup'),historyOpen.click()]);
  await historyTab.getByText('情境與操作',{exact:true}).first().waitFor();
  await historyTab.close();
  await page.getByText('1105 份報告',{exact:true}).waitFor();
  for (const button of await page.locator('main button, main a[href]').all()) {
    const box = await button.boundingBox(); assert.ok(box.height >= 32 && box.width >= 24, 'compact target size');
    await contrast(button);
    await button.hover(); await page.keyboard.press('Tab'); await button.focus();
    await contrast(button);
    assert.notEqual(await button.evaluate(el => getComputedStyle(el).boxShadow), 'none', 'focus ring');
    await button.hover(); await page.mouse.down();
    try { await contrast(button); } finally { await page.mouse.move(0, 0); await page.mouse.up(); }
  }
  await historySearch.fill('');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const motion = await page.locator('button').evaluateAll(elements => elements.every(el => getComputedStyle(el).animationName === 'none' && getComputedStyle(el).transitionDuration === '0s'));
  assert.equal(motion, true, 'reduced motion');
  if(process.env.ARCHIFY_GATE_REVIEW==='1'){
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('main').evaluate(el=>el.scrollTop=0);
    console.log('REVIEW_IMAGE:'+(await page.screenshot({type:'png'})).toString('base64'));
  }
  const draft = structuredClone(report.cases[0]); draft.id = 'DRAFT'; draft.name = '尚未設定的 Playwright 草稿'; draft.status = 'skipped'; draft.steps.forEach(step => step.status = 'skipped');
  await upload({ ...report, cases: [report.cases[0], draft] });
  await page.getByText('2 案例', { exact: true }).waitFor();
  await page.getByRole('button', { name: '略過', exact: true }).click();
  await page.getByRole('article',{name:/DRAFT 尚未設定的 Playwright 草稿/}).waitFor();
  await upload('{broken'); await page.getByRole('alert').waitFor();
  assert.ok(await page.getByText('原報告已保留。', { exact: false }).count());
  const flow = structuredClone(report); flow.kind = 'flow'; flow.cases = [flow.cases[0]];
  flow.cases[0].status = 'not-run'; flow.cases[0].steps.forEach(step => step.status = 'not-run');
  await upload(flow);
  await page.getByRole('alert').filter({hasText:'流程檔'}).waitFor();
  await page.getByRole('button',{name:'測試流程',exact:true}).click();
  await page.getByRole('heading',{name:'測試流程',exact:true}).waitFor();
  assert.equal(await page.locator('main input[type=file]').count(),0);
  await page.reload();await page.getByRole('heading',{name:'測試流程',exact:true}).waitFor();
  assert.deepEqual(errors, []); assert.deepEqual(api, []);
  for (const path of ['apps/web/src/features/reader/ReportReader.tsx', 'apps/web/src/features/reader/report.ts']) {
    const source = await readFile(path, 'utf8');
    assert.ok(!/\bstyle\s*=|<select\b|\p{Extended_Pictographic}|#[a-f\d]{3,8}\b/iu.test(source), 'hardcode, emoji, native select');
  }
  console.log('PASS reader: fixed project automatic loading, flow/execution, search, filters, keyboard, error preservation, HTML escape, axe, 390/1024/1280/1440/1920 overflow, 200% zoom, targets, focus, active/hover contrast, reduced motion, no product API calls.');
} finally { await browser.close(); await fixtureState.dispose(); }
