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
 await page.goto('http://127.0.0.1:5191/?view=scripts');
 await page.getByText('共 0 支腳本',{exact:true}).waitFor();
 await page.getByText('尚無測試腳本。',{exact:false}).waitFor();
 await page.route('**/local-api/scripts',route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'首次讀取失敗'})}));
 await page.reload();await page.getByRole('alert').waitFor();
 await page.getByText('尚未取得腳本數量。',{exact:true}).waitFor();
 assert.equal(await page.getByRole('table').count(),0);
 await page.unroute('**/local-api/scripts');
 const path=join(f.project,'tests/api/Manual.spec.ts');
 await writeFile(path, "test('讀取資料', async()=>{throw new Error('DO_NOT_EXECUTE')});");
 await writeFile(join(f.project,'tests/api/Draft.spec.ts'), "test.skip('草稿', async()=>{});");
 await mkdir(join(f.project,'tests/ui'),{recursive:true});
 await writeFile(join(f.project,'tests/ui/'+ 'long-name-'.repeat(15)+'.spec.ts'), "test('畫面', async()=>{expect(1).toBe(1)});");
 await page.goto('http://127.0.0.1:5191/?view=flows');
 await page.getByRole('button',{name:'測試腳本',exact:true}).click();
 await page.getByRole('heading',{name:'測試腳本',exact:true}).waitFor();
 await page.getByText('共 3 支腳本',{exact:true}).waitFor();
 assert.equal(new URL(page.url()).searchParams.get('view'),'scripts');
 assert.equal(await page.getByRole('button',{name:'測試腳本',exact:true}).getAttribute('aria-current'),'page');
 await axe();
 const api=page.getByRole('button',{name:'API 單支（2）',exact:true});
 await api.focus();await page.keyboard.press('Enter');assert.equal(await api.getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('tbody tr').count(),2);
 const web=page.getByRole('button',{name:'網頁（1）',exact:true});await web.click();assert.equal(await page.locator('tbody tr').count(),1);
 await page.getByRole('button',{name:'Android（0）',exact:true}).click();await page.getByText('此分類尚無測試腳本。',{exact:true}).waitFor();
 await page.getByRole('button',{name:'全部（3）',exact:true}).click();
 await page.reload();await page.getByText('共 3 支腳本',{exact:true}).waitFor();
 for(const width of [390,1024,1280,1440,1920]){
   await page.setViewportSize({width,height:1000});
   for(const zoom of [1,1.25]){
     await page.evaluate(zoom=>document.documentElement.style.zoom=String(zoom),zoom);
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow '+width+' '+zoom);
   }
 }
 await page.evaluate(()=>document.documentElement.removeAttribute('style'));await page.setViewportSize({width:1440,height:1000});
 const metrics=await page.locator('main button').evaluateAll(elements=>elements.map(el=>({height:el.getBoundingClientRect().height,font:getComputedStyle(el).fontSize,animation:getComputedStyle(el).animationName,transition:getComputedStyle(el).transitionDuration})));
 assert.ok(metrics.every(row=>row.height>=32&&row.font==='14px'&&row.animation==='none'&&row.transition==='0s'));
 assert.equal(await page.locator('#root select, #root [style], main input, main textarea').count(),0);
 const refresh=page.getByRole('button',{name:'重新讀取',exact:true});await refresh.hover();await axe();await refresh.focus();await axe();
 let delay=true;
 await page.route('**/local-api/scripts',async route=>{if(delay){await new Promise(resolve=>setTimeout(resolve,200));}await route.fallback();});
 await refresh.click();await page.getByRole('button',{name:'正在讀取…',exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'正在讀取…',exact:true}).isDisabled());await refresh.waitFor();delay=false;
 await writeFile(join(f.project,'tests/api/New.spec.ts'),"test('新增',()=>{expect(true).toBe(true)});");await refresh.click();await page.getByText('共 4 支腳本',{exact:true}).waitFor();
 await page.route('**/local-api/scripts',route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'測試讀取失敗'})}));
 await refresh.click();await page.getByRole('alert').waitFor();assert.ok((await page.getByRole('alert').innerText()).includes('原清單已保留'));assert.equal(await page.locator('tbody tr').count(),4);
 if(process.env.ARCHIFY_GATE_REVIEW==='1')console.log('REVIEW_IMAGE:'+(await page.screenshot({type:'jpeg',quality:65})).toString('base64'));
 assert.deepEqual(errors,[]);
 console.log('PASS scripts: actual readonly files/counts, navigation/deep link, filters/empty project/empty category/initial failure, refresh/loading/error retention, axe default/hover/focus, keyboard, 32px targets/14px tokens, no select/inline styles, 390/1024/1280/1440/1920 at 100/125%, reduce mode has no button animations/transitions. No scripts executed.');
}finally{await browser.close();await f.dispose();}
