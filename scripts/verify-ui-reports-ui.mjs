import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile, writeFile, mkdir, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fixture } from '../services/local-workspace/test-support.mjs';
import { createHandler } from '../services/local-workspace/plugin.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('../.local/gate-deps/node_modules/playwright');
assert.equal(process.env.DS_REQUIRE_BROWSER, '1');
const f = await fixture();
await f.workspace.initialize();await f.enableUi();
const {createWorkspace}=await import('../services/local-workspace/workspace.mjs');let appium=false,started=false;
const androidHost={status:async()=>({sdkReady:true,avds:['Synthetic_35'],devices:started?[{serial:'emulator-5554',avd:'Synthetic_35',state:'device',booted:true}]:[],appiumReady:appium,issues:[]}),start:async avd=>{assert.equal(avd,'Synthetic_35');started=true;return {starting:true};},startAppium:async()=>{appium=true;return {ready:true};}};
const workspace=createWorkspace(f.config,{androidHost});
const handler = createHandler(workspace, 'catalog-ui');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(10000);
const assets = await readdir('apps/web/dist/assets');
const css = await readFile('apps/web/dist/assets/' + assets.find(name => name.endsWith('.css')), 'utf8');
const js = await readFile('apps/web/dist/assets/' + assets.find(name => name.endsWith('.js')), 'utf8');
const html = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>互動地圖驗證</title><style>' + css + '</style><body><div id="root"></div><script>' + js.replaceAll('</script', '<\\/script') + '</script></body></html>';
const errors = []; page.on('pageerror', error => errors.push(error.message));
await page.route('http://127.0.0.1:5191/**', async route => {
  const request = route.request(), url = new URL(request.url());
  if (!url.pathname.startsWith('/local-api/')) return route.fulfill({ status: 200, contentType: 'text/html', body: html });
  const req = Readable.from(request.postData() ? [request.postData()] : []);
  req.url = url.pathname; req.method = request.method(); req.socket = { remoteAddress: '127.0.0.1' }; req.headers = { ...request.headers(), host: url.host };
  let status = 200, body;
  await handler(req, { set statusCode(value) { status = value; }, setHeader() {}, end(value) { body = value; } });
  await route.fulfill({ status, contentType: 'application/json', body });
});
async function axe() {
  await page.addScriptTag({ path: require.resolve('../.local/gate-deps/node_modules/axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations);
  assert.deepEqual(violations.map(item => ({ id: item.id, nodes: item.nodes.map(n => n.target) })), []);
}

try{
 await page.setContent('<html><body style="background:white;color:black;font:24px Arial"><h1>SYNTHETIC CARD</h1><p>Data id: 7</p></body></html>');const png=await page.screenshot({type:'png'});
 const base={schemaVersion:1,kind:'execution',project:'合成分類報告',createdAt:new Date().toISOString(),screenshotsEnabled:false};const api={...base,runId:'synthetic-api',testType:'api',cases:[{id:'API-SYN',name:'合成 API',purpose:'資料欄位',source:'tests/api/Synthetic.spec.ts',sourceHash:'a'.repeat(64),target:'api',status:'passed',steps:[{name:'驗證 id',expected:'id = 7',status:'passed'}],responses:[{status:200,body:{id:7}}]}]};const ui={...base,runId:'synthetic-ui',testType:'ui',screenshotsEnabled:true,cases:[{id:'UI-SYN',name:'合成網頁資料與畫面',purpose:'資料與 DOM',source:'tests/web/Synthetic.spec.ts',sourceHash:'b'.repeat(64),target:'web',dataMode:'liff-mock-real-api',status:'passed',steps:[{name:'檢查文字',expected:'SYNTHETIC CARD',status:'passed'}],screenshots:[{caption:'合成測試畫面',data:png.toString('base64')}]}]};
 await mkdir(join(f.project,'reports/api'),{recursive:true});await mkdir(join(f.project,'reports/ui'),{recursive:true});await writeFile(join(f.project,'reports/api/report-synthetic-api.json'),JSON.stringify(api));const uiFile=join(f.project,'reports/ui/report-synthetic-ui.json');const original=JSON.stringify(ui);await writeFile(uiFile,original);await writeFile(join(f.project,'reports/api/report-older.json'),JSON.stringify({...api,project:'較舊的合成報告'}));await utimes(join(f.project,'reports/api/report-older.json'),new Date('2020-01-01'),new Date('2020-01-01'));
 await page.goto('http://127.0.0.1:5191/?view=reports');
 await page.getByText('合成 API',{exact:true}).waitFor();assert.equal(await page.locator('input[type=file]').count(),0);assert.equal(await page.getByRole('button',{name:'讀取設定的報告資料夾',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'開啟 ui/report-synthetic-ui.json',exact:true}).count(),0);
 await page.getByRole('button',{name:'API 測試',exact:true}).click();await page.getByText('合成 API',{exact:true}).waitFor();await page.getByText('歷次報告',{exact:false}).click();await page.getByRole('button',{name:'開啟 api/report-older.json',exact:true}).click();await page.getByRole('heading',{name:'較舊的合成報告',exact:true}).waitFor();await page.getByRole('button',{name:'重新整理',exact:true}).click();await page.getByRole('heading',{name:'合成分類報告',exact:true}).waitFor();await page.reload();await page.getByText('合成 API',{exact:true}).waitFor();
 await page.getByRole('button',{name:'畫面測試',exact:true}).click();await page.getByText('合成網頁資料與畫面',{exact:true}).click();
 const image=page.getByRole('img',{name:'合成測試畫面',exact:true});await image.waitFor();assert.ok(await image.evaluate(el=>el.complete&&el.naturalWidth>0));
 await page.getByText('畫面測試設定',{exact:true}).click();await page.getByLabel('保留畫面截圖（下次畫面測試生效）',{exact:true}).check();await page.getByRole('status').filter({hasText:'已儲存'}).waitFor();assert.equal((await workspace.reportSettings()).screenshots,true);assert.equal(await readFile(uiFile,'utf8'),original);
 await page.getByText('Android 推播測試環境',{exact:true}).click();await page.getByRole('button',{name:'啟動 Synthetic_35',exact:true}).click();await page.getByRole('button',{name:'使用這台',exact:true}).click();await page.getByRole('button',{name:'啟動 Appium',exact:true}).click();await page.getByRole('status').filter({hasText:'Appium 已就緒'}).waitFor();assert.equal((await workspace.reportSettings()).androidSerial,'emulator-5554');assert.equal(appium,true);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'下載純文字報告',exact:true}).click();assert.match((await download).suggestedFilename(),/\.txt$/);
 await axe();for(const width of [390,1024,1280,1440,1920]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 await page.setViewportSize({width:1440,height:1000});await page.keyboard.press('Tab');await page.getByRole('button',{name:'畫面測試',exact:true}).focus();assert.notEqual(await page.getByRole('button',{name:'畫面測試',exact:true}).evaluate(el=>getComputedStyle(el).boxShadow),'none');
 if(process.env.ARCHIFY_GATE_REVIEW==='1'){await page.getByText('畫面測試設定',{exact:true}).click();await page.evaluate(()=>document.querySelector('main').scrollTop=0);console.log('REVIEW_IMAGE:'+(await page.screenshot({type:'jpeg',quality:55})).toString('base64'));}
 assert.deepEqual(errors,[]);console.log('PASS report UI: API/UI grouping, web source/mode, inline screenshot, persisted next-run checkbox, old report unchanged, native environment controls with injected host, selected device, text download, axe/contrast, keyboard/focus and responsive overflow. No product tests.');
}finally{await browser.close();await f.dispose();}
