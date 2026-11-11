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
const {createWorkspace}=await import('../services/local-workspace/workspace.mjs');
let imageCalls=0;
const workspace=createWorkspace(f.config,{aiRunner:async(_config,prompt,options)=>{
 if(options.images?.length){imageCalls++;return {content:'上方為 MEMBER，下方為 HELP 按鈕，兩區水平排列。',uncertainties:['實際點擊動作尚未提供']};}
 if(prompt.includes('你是知識候選檢索器'))return {ids:[],tooMany:false};
 const data=JSON.parse(prompt.slice(prompt.indexOf('{"existing":')));
 return {documents:data.incoming.map((row,index)=>({title:row.name,content:row.content.length>5000?'大型文件已分段整理，尾端標記：LARGE_END':row.content,category:'business',featureIds:[],keepId:null,replaces:[],inputIndices:[index]})),conflicts:[]};
}});
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

try {
 await page.setContent('<html><body style="font:24px Arial;background:white;color:black"><h1>MEMBER</h1><button>HELP</button></body></html>');
 const png=await page.screenshot({type:'png'});
 await page.goto('http://127.0.0.1:5191/?view=knowledge');
 await page.getByRole('button',{name:'新增知識',exact:true}).click();
 await page.getByLabel('匯入知識文件',{exact:true}).setInputFiles({name:'RichMenu.png',mimeType:'image/png',buffer:png});
 await page.getByRole('button',{name:'RichMenu 圖片觀察.md',exact:true}).waitFor();
 assert.equal(imageCalls,1);
 await page.getByRole('button',{name:'RichMenu 圖片觀察.md',exact:true}).click();
 await page.getByRole('button',{name:'查看原圖：RichMenu.png',exact:true}).click();
 const original=page.getByRole('img',{name:'RichMenu.png',exact:true});await original.waitFor();assert.ok(await original.evaluate(el=>el.complete&&el.naturalWidth>0));
 await page.getByText('實際點擊動作尚未提供',{exact:true}).first().waitFor();
 await axe();
 for(const width of [390,1024,1280,1440,1920]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 await page.setViewportSize({width:1440,height:1000});
 if(process.env.ARCHIFY_GATE_REVIEW==='1')console.log('REVIEW_IMAGE:'+(await page.screenshot({type:'jpeg',quality:55})).toString('base64'));
 await page.getByLabel('匯入知識文件',{exact:true}).setInputFiles({name:'大規格.md',mimeType:'text/markdown',buffer:Buffer.from('# 大文件\n'+'規格資料\n'.repeat(160000)+'LARGE_END')});
 await page.getByRole('button',{name:'大規格 第1段.md',exact:true}).waitFor({timeout:30000});
 await page.getByRole('button',{name:'大規格 第1段.md',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'下載原檔：大規格.md',exact:true}).click();assert.equal((await download).suggestedFilename(),'大規格.md');
 await page.getByLabel('匯入知識文件',{exact:true}).setInputFiles({name:'超大.md',mimeType:'text/markdown',buffer:Buffer.alloc(10*1024*1024+1,120)});
 await page.getByRole('alert').filter({hasText:'每份最多 10 MB'}).waitFor();
 await page.getByLabel('匯入知識文件',{exact:true}).setInputFiles({name:'偽裝.png',mimeType:'image/png',buffer:Buffer.from('<script>bad()</script>')});
 await page.getByRole('alert').filter({hasText:'圖片檔案無法辨識'}).waitFor();
 const formats=await page.evaluate(()=>{const canvas=window.document.createElement('canvas');canvas.width=80;canvas.height=40;const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,80,40);context.fillStyle='black';context.fillText('MENU',8,24);return {jpg:canvas.toDataURL('image/jpeg').split(',')[1],webp:canvas.toDataURL('image/webp').split(',')[1]};});
 await page.getByLabel('匯入知識文件',{exact:true}).setInputFiles([{name:'補充JPEG.jpg',mimeType:'image/jpeg',buffer:Buffer.from(formats.jpg,'base64')},{name:'補充WebP.webp',mimeType:'image/webp',buffer:Buffer.from(formats.webp,'base64')}]);
 await page.getByRole('button',{name:'補充WebP 圖片觀察.md',exact:true}).waitFor();assert.equal(imageCalls,3);
 await page.getByRole('button',{name:'補充WebP 圖片觀察.md',exact:true}).click();await page.getByRole('button',{name:'查看原圖：補充WebP.webp',exact:true}).click();const webp=page.getByRole('img',{name:'補充WebP.webp',exact:true});await webp.waitFor();assert.ok(await webp.evaluate(el=>el.complete&&el.naturalWidth===80));
 assert.equal(await page.locator('select').count(),0);assert.equal(await page.getByRole('checkbox').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS knowledge assets UI: PNG/JPEG/WebP upload/extraction, source image preview, unknown action, >1MB file segmentation, original download, 10MB rejection, malformed image rejection, no category controls, axe/contrast and responsive overflow. Model injected, no product requests.');
}finally{await browser.close();await f.dispose();}
