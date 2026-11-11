import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fixture } from '../services/local-workspace/test-support.mjs';
import { createHandler } from '../services/local-workspace/plugin.mjs';
import { scriptEvidence, caseEvidence } from '../test-project/support/script-evidence.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('../.local/gate-deps/node_modules/playwright');
assert.equal(process.env.DS_REQUIRE_BROWSER, '1');
const f = await fixture();
await f.workspace.initialize();await f.enableUi();await mkdir(join(f.source,'src/pages'),{recursive:true});await writeFile(join(f.source,'src/pages/CardPage.tsx'),"import {list} from '../api';export default function CardPage(){return null;}");await writeFile(join(f.source,'src/routes.tsx'),"import React from 'react';const Card=React.lazy(()=>import('./pages/CardPage'));export const routes=[{path:'/cards',component:Card,title:'名片'}];");const analysis=await f.workspace.scan();
await f.workspace.generate({ scanId: analysis.scanId, ids: analysis.requests.map(item => item.id) });
const generated = join(f.project, 'tests/api/GetCard.spec.ts');
await writeFile(generated, (await readFile(generated, 'utf8')).replace('async () => {}', 'async () => { await test.step("讀取名片", async () => {}); await test.step("確認結果", async () => {}); }'));
await f.workspace.importKnowledge([{ name: '名片規則.md', content: '# 名片\n登入後可讀取自己的名片。', category: 'business', featureIds: ['F-CARD'] }]);
const {createWorkspace}=await import('../services/local-workspace/workspace.mjs');
let evidence;
let knowledgeCalls=0;
const workspace=createWorkspace(f.config,{aiRunner:async(_config,prompt)=>{
 await new Promise(resolve=>setTimeout(resolve,250));
 if(prompt.includes('前端功能分析器')){
 const e=JSON.parse(await readFile(join(f.project,'analysis/feature-evidence.json'),'utf8'));
 return {schemaVersion:1,sourceHash:e.sourceHash,catalogRevision:e.catalogRevision,generatedAt:new Date().toISOString(),features:[{id:'F-CARD',name:'名片管理',description:'來源證據的名片功能',evidence:'code',sources:[{path:'src/pages/CardPage.tsx',line:1}],pageIds:e.pages.map(p=>p.id),apiIds:e.apis.map(a=>a.id),questions:[]}],relations:[],unassignedPageIds:[],unassignedApiIds:[],notes:[]};
 }
 knowledgeCalls++;const old=(await workspace.knowledge()).documents;
 return {documents:[{title:'最新版名片規則.md',content:'禁止跨帳號讀取名片。',category:'business',featureIds:['F-CARD'],keepId:old[0].id,replaces:old.map(doc=>doc.id),inputIndices:[0]}],conflicts:['角色例外仍需確認']};
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
 await page.goto('http://127.0.0.1:5191/?view=catalog');
 await page.getByRole('button',{name:'AI 分析功能',exact:true}).click();
 await page.getByRole('region',{name:'AI 分析狀態'}).getByRole('status').filter({hasText:'已完成'}).waitFor();
 await page.getByRole('button',{name:'功能：名片管理',exact:true}).click();
 await page.getByRole('button',{name:'前端頁面：名片',exact:true}).click();
 await page.getByRole('region',{name:'程式碼預覽'}).locator('pre').waitFor();
 await page.getByRole('button',{name:'專案知識',exact:true}).click();
 await page.getByRole('button',{name:'新增知識',exact:true}).click();
 await page.getByLabel('匯入知識文件',{exact:true}).setInputFiles({name:'新規則.html',mimeType:'text/html',buffer:Buffer.from('<h1>名片更新</h1><script>window.injected=true</script><p>禁止跨帳號讀取名片。</p>')});
 assert.equal(await page.getByRole('checkbox').count(),0);
 assert.equal(await page.getByLabel('適用功能編號',{exact:true}).count(),0);
 await page.getByRole('status').filter({hasText:'已完成：已整理'}).waitFor();
 await page.getByRole('button',{name:'最新版名片規則.md',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.injected),undefined);
 await page.getByRole('button',{name:'最新版名片規則.md',exact:true}).click();
 await page.getByText('禁止跨帳號讀取名片。',{exact:true}).waitFor();
 await page.getByText('角色例外仍需確認',{exact:true}).first().waitFor();
 await page.getByRole('button',{name:'還原上次 AI 更新',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'確認還原',exact:true}).click();
 await page.getByRole('button',{name:'名片規則.md',exact:true}).waitFor();
 const base=Array.from({length:20},(_,i)=>`第${i+1}項會員規則：登入後保留會員資料並檢查完整性，不允許讀取其他帳號資料。`).join('\n');
 await workspace.importKnowledge([{name:'長規格.md',content:base,category:'business'}]);
 await page.reload();await page.getByRole('button',{name:'長規格.md',exact:true}).waitFor();
 const calls=knowledgeCalls;
 await page.getByRole('button',{name:'新增知識',exact:true}).click();
 const updated=base.replace('第1項會員規則','第1項新版會員規則');
 await page.getByLabel('匯入知識文件',{exact:true}).setInputFiles({name:'長規格新版.md',mimeType:'text/markdown',buffer:Buffer.from(updated)});
 await page.getByRole('button',{name:'長規格新版.md',exact:true}).waitFor();
 await page.getByRole('status').filter({hasText:'已完成：已整理 1 份、取代 1 份'}).waitFor();
 assert.equal(knowledgeCalls,calls);
 const snapshot=await readFile(join(f.project,'knowledge/index.json'),'utf8');
 await page.getByLabel('匯入知識文件',{exact:true}).setInputFiles({name:'相同副本.md',mimeType:'text/markdown',buffer:Buffer.from(updated)});
 await page.getByRole('status').filter({hasText:'已完成：已整理 0 份、取代 0 份'}).waitFor();
 assert.equal(knowledgeCalls,calls);assert.equal(await readFile(join(f.project,'knowledge/index.json'),'utf8'),snapshot);
 await axe();
 for(const width of [390,1024,1280,1440,1920]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
 await page.setViewportSize({width:1440,height:1000});
 if(process.env.ARCHIFY_GATE_REVIEW==='1')console.log('REVIEW_IMAGE:'+(await page.screenshot({type:'jpeg',quality:55})).toString('base64'));
 assert.deepEqual(errors,[]);
 console.log('PASS website AI UI: actual jobs/middleware, map updates, HTML semantic merge/conflicts/restore with injected model, similar text updates and exact duplicate skips without model calls, axe/contrast and responsive overflow. No product requests or real model call in this gate.');
}finally{await browser.close();await f.dispose();}
