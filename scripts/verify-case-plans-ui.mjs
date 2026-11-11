import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fixture } from '../services/local-workspace/test-support.mjs';
import { createHandler } from '../services/local-workspace/plugin.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('../.local/gate-deps/node_modules/playwright');
assert.equal(process.env.DS_REQUIRE_BROWSER, '1');
const f = await fixture();
await f.workspace.initialize();await f.enableUi();
await f.workspace.importKnowledge([{name:'入口.md',content:'點左上角會員入口，收到會員訊息',category:'business'}]);
const handler = createHandler(f.workspace, 'catalog-ui');
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

try {
 const doc=(await f.workspace.knowledge()).documents[0];
 const row={id:'TC-MENU',featureId:'F-MENU',title:'點會員入口看訊息',kind:'flow',purpose:'檢查文字樣式',preconditions:'已加入測試帳號',data:'測試選單 v1',target:'mobile',steps:[{action:'輸入查詢條件',data:'member-01',expected:''},{action:'點 Rich Menu 左上角會員區塊',data:'點擊左上角',expected:'收到會員 Flex Message'}],expected:'會員文字正確，按鈕靠右',cleanup:'不需清理',knowledgeIds:[doc.id],questions:[{text:'樣式基準是哪個版本？',answer:''}]};
 const catalog={schemaVersion:1,features:[{id:'F-MENU',name:'LINE OA 會員',sources:[]}],cases:[row]};
 const path=join(f.project,'test-cases/catalog.json');await writeFile(path,JSON.stringify(catalog));
 await page.goto('http://127.0.0.1:5191/?view=flows');
 await page.getByRole('button',{name:'畫面流程',exact:true}).click();
 await page.getByRole('table',{name:'測試流程案例'}).waitFor();
 await page.getByRole('rowheader',{name:/點會員入口看訊息/}).waitFor();
 await page.getByText('member-01',{exact:true}).waitFor();
 await page.getByText('收到會員 Flex Message',{exact:true}).waitFor();
 await page.getByText('樣式基準是哪個版本？',{exact:true}).waitFor();
 assert.equal(await page.locator('main button').count(),3);
 assert.equal(await page.locator('main input,main textarea,main select,main [contenteditable=true]').count(),0);
 assert.equal(await page.getByRole('table').getByRole('button').count(),0);
 assert.ok((await page.locator('main').textContent()).includes(f.project));
 assert.equal(await readFile(path,'utf8'),JSON.stringify(catalog),'reading never writes catalog');
 await page.addScriptTag({path:require.resolve('../.local/gate-deps/node_modules/axe-core/axe.min.js')});
 assert.deepEqual(await page.evaluate(async()=> (await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(value=>value.id)),[]);
 for(const width of [390,1024,1280,1440,1920]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.documentElement.style.zoom='2');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.evaluate(()=>document.documentElement.style.zoom='1');
 const button=page.getByRole('button',{name:'重新讀取',exact:true});await page.keyboard.press('Tab');await button.focus();assert.notEqual(await button.evaluate(el=>getComputedStyle(el).boxShadow),'none');assert.ok((await button.boundingBox()).height>=32);
 await writeFile(path,JSON.stringify({...catalog,cases:[{...row,expected:'最新版會員文字'}]}));await button.click();await page.getByText('最新版會員文字',{exact:true}).waitFor();
 await writeFile(path,'{broken');await button.click();await page.getByRole('alert').filter({hasText:'原表格已保留'}).waitFor();await page.getByText('最新版會員文字',{exact:true}).waitFor();
 await writeFile(path,JSON.stringify({...catalog,cases:[]}));await button.click();await page.getByText('尚無測試流程。',{exact:false}).waitFor();assert.equal(await page.getByRole('alert').count(),0);
 await writeFile(path,JSON.stringify(catalog));await page.reload();await page.getByRole('button',{name:'畫面流程',exact:true}).click();await page.getByRole('rowheader',{name:/點會員入口看訊息/}).waitFor();
 if(process.env.ARCHIFY_GATE_REVIEW==='1')console.log('REVIEW_IMAGE:'+(await page.screenshot({type:'jpeg',quality:55})).toString('base64'));
 assert.deepEqual(errors,[]);
 console.log('PASS read-only case table: actual catalog, no editing/confirmation/tasks, one refresh action, local AI edits reflected, invalid data preserves previous table, empty/reload, axe, keyboard/focus/targets, zoom and responsive overflow. No model or product execution.');
}finally{await browser.close();await f.dispose();}
