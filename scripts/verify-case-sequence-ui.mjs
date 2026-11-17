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
let browser;
try {
  await f.workspace.initialize(); await f.enableUi();
  const scan = await f.workspace.scan();
  await f.workspace.generate({scanId:scan.scanId,ids:scan.requests.map(row=>row.id)});
  const script = 'tests/flows/Sequence.spec.ts';
  await writeFile(join(f.project,script), "import {test} from '@playwright/test';\ntest('序列案例',{annotation:[{type:'archify-case',description:'TC-SEQ'}]},async()=>{await test.step('發出查詢',async()=>{});await test.step('核對結果',async()=>{});});");
  const row = {id:'TC-SEQ',featureId:'F-SEQ',title:'查詢會員資料',kind:'flow',target:'api',purpose:'確認查詢順序',preconditions:'已登入',data:'測試資料',expected:'會員資料正確',script,knowledgeIds:[],questions:[],steps:[
    {action:'發出查詢',expected:'收到 API 回應',interaction:{from:'前端',to:'會員 API',source:{path:'src/cards.gql',line:1}}},
    {action:'核對結果',expected:'顯示會員資料',interaction:{from:'會員 API',to:'前端',source:{path:'src/cards.gql',line:1}}},
    {action:'後續操作',expected:'保留原畫面'},
  ]};
  let view = await f.workspace.catalog();
  await f.workspace.saveCatalog({revision:view.revision,catalog:{schemaVersion:1,features:[{id:'F-SEQ',name:'會員查詢',sources:[{path:'src/cards.gql',line:1}]}],cases:[row]}});
  const proof = scriptEvidence(f.project,script);
  assert.equal(proof.complete,true);
  await mkdir(join(f.project,'reports'),{recursive:true});
  const report = {schemaVersion:1,project:'序列圖替身驗證',kind:'execution',runId:'sequence-ui',createdAt:new Date().toISOString(),cases:[{id:'TC-SEQ',caseId:'TC-SEQ',name:row.title,source:script,status:'failed',sourceHash:proof.hash,scriptEvidence:proof,caseEvidence:caseEvidence(f.project,script,row.id),steps:[{name:'發出查詢',expected:'收到 API 回應',status:'passed'},{name:'核對結果',expected:'顯示會員資料',status:'failed',error:'合成失敗'}]}]};
  const reportPath = join(f.project,'reports/report-sequence.json');
  await writeFile(reportPath,JSON.stringify(report));
  const handler = createHandler(f.workspace,'sequence-ui');
  const assets = await readdir('apps/web/dist/assets');
  const css = await readFile('apps/web/dist/assets/'+assets.find(name=>name.endsWith('.css')),'utf8');
  const js = await readFile('apps/web/dist/assets/'+assets.find(name=>name.endsWith('.js')),'utf8');
  const html = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>案例序列驗證</title><style>'+css+'</style><body><div id="root"></div><script>'+js.replaceAll('</script','<\\/script')+'</script></body></html>';
  browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://127.0.0.1:5191/**',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(!url.pathname.startsWith('/local-api/'))return route.fulfill({status:200,contentType:'text/html',body:html});
    const req=Readable.from(request.postData()?[request.postData()]:[]);
    Object.assign(req,{url:url.pathname,method:request.method(),socket:{remoteAddress:'127.0.0.1'},headers:{...request.headers(),host:url.host}});
    let status=200,body;
    await handler(req,{set statusCode(value){status=value;},setHeader(){},end(value){body=value;}});
    await route.fulfill({status,contentType:'application/json',body});
  });
  await page.goto('http://127.0.0.1:5191/?view=catalog');
  await page.getByRole('button',{name:'測試清單',exact:true}).click();
  const select = async()=>page.getByRole('button',{name:row.title,exact:true}).click();
  const reload = async()=>{
    await Promise.all([page.waitForResponse(response=>response.url().endsWith('/local-api/catalog')),page.getByRole('button',{name:'重新讀取',exact:true}).click()]);
    await page.getByRole('button',{name:'重新讀取',exact:true}).waitFor();
    await select();
  };
  await select();
  const region=page.getByRole('region',{name:'案例流程',exact:true});
  await region.getByText('失敗',{exact:true}).waitFor();
  assert.equal(await region.getByText('通過',{exact:true}).count(),1);
  assert.equal(await region.getByText('未對應',{exact:true}).count(),1,'absent report step is not inferred as not-run');
  const summary=region.locator('summary').filter({hasText:'序列圖'});
  await summary.focus();await page.keyboard.press('Enter');
  await region.getByRole('img',{name:/規劃序列圖/}).waitFor();
  await page.keyboard.press('Enter');
  assert.equal(await region.getByRole('img',{name:/規劃序列圖/}).isVisible(),false);
  await page.keyboard.press('Enter');
  await region.getByRole('button',{name:'1. src/cards.gql:1',exact:true}).click();
  await page.getByRole('region',{name:'程式碼預覽'}).getByText(/query GetCard/).waitFor();
  await page.addScriptTag({path:require.resolve('../.local/gate-deps/node_modules/axe-core/axe.min.js')});
  assert.deepEqual(await page.evaluate(async()=>(await window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(row=>({id:row.id,targets:row.nodes.map(node=>node.target)}))),[]);
  for(const width of [390,1024,1280,1440,1920]){
    await page.setViewportSize({width,height:1100});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`overflow ${width}`);
  }
  await page.setViewportSize({width:1440,height:1100});
  await page.evaluate(()=>document.documentElement.style.zoom='2');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'200% zoom');
  await page.evaluate(()=>document.documentElement.style.zoom='');
  for(const button of await region.getByRole('button').all())assert.ok((await button.boundingBox()).height>=32);
  assert.equal(await page.locator('select').count(),0);
  if(process.env.ARCHIFY_GATE_REVIEW==='1')console.log('REVIEW_SEQUENCE_IMAGE:'+(await page.getByRole('region',{name:'節點詳情',exact:true}).screenshot({type:'jpeg',quality:70})).toString('base64'));
  report.cases[0].steps.push({name:'核對結果',expected:'另一筆',status:'passed'});
  await writeFile(reportPath,JSON.stringify(report));
  await reload();
  assert.equal(await region.getByText('失敗',{exact:true}).count(),0,'duplicate report names never map');
  assert.equal(await region.getByText('未對應',{exact:true}).count(),2);
  const originalSource = await readFile(join(f.source,'src/cards.gql'),'utf8');
  await writeFile(join(f.source,'src/cards.gql'),originalSource+'\n# changed');
  await reload();
  assert.equal(await region.getByText('通過',{exact:true}).count(),0,'changed frontend evidence never maps');
  await writeFile(join(f.source,'src/cards.gql'),originalSource);
  await writeFile(join(f.project,script),(await readFile(join(f.project,script),'utf8'))+'\n// changed');
  await reload();
  assert.equal(await region.getByText('通過',{exact:true}).count(),0,'stale result never maps');
  assert.equal(await region.getByText('未對應',{exact:true}).count(),3);
  await page.getByRole('button',{name:'編輯測試',exact:true}).click();
  await Promise.all([page.waitForResponse(response=>response.url().endsWith('/local-api/catalog-save')),page.getByRole('button',{name:'儲存測試',exact:true}).click()]);
  await page.getByRole('form',{name:'測試案例編輯'}).waitFor({state:'hidden'});
  view=await f.workspace.catalog();
  assert.deepEqual(view.catalog.cases[0].steps[0].interaction,row.steps[0].interaction,'editor preserves interaction metadata');
  assert.deepEqual(errors,[]);
  console.log('PASS case sequence: exact/duplicate/stale mapping, absent evidence, source preview, editor preservation, axe, keyboard, target size, 390–1920 widths, zoom, reduced motion');
} finally {await browser?.close();await f.dispose();}
