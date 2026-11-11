import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('..',import.meta.url));
const require=createRequire(import.meta.url);
const {build}=createRequire(new URL('../apps/web/package.json',import.meta.url))('esbuild');
const {chromium}=require('playwright');
const dir=join(root,'.local/authoring-api-context');await mkdir(dir,{recursive:true});
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {TestingProvider} from '../../apps/web/src/features/testing/TestingProvider';import {bootstrap} from '../../apps/web/src/features/testing/controlApi';import {ScriptWorkspace} from '../../apps/web/src/features/testing/ScriptWorkspace';
const projectId=new URLSearchParams(location.search).get('project')||'p';const draftId=new URLSearchParams(location.search).get('draft')||'draft';window.calls=[];
const source="import {test} from '@playwright/test'; test('登入後刪除',async()=>{await test.step('原步驟',async()=>{});});";
const proposal="import {test} from '@playwright/test'; test('登入後刪除',async()=>{await test.step('新步驟',async()=>{});});";
const documents=[{key:'archify.testing.v1',revision:1,value:{project:{id:projectId,name:'隔離測試專案',repositoryUrl:'',branch:'release',websiteUrl:''},cases:[],flows:[]}}];
window.fetch=async(url,init={})=>{const path=String(url).split('?')[0],input=init.body?JSON.parse(init.body):{};window.calls.push({path,method:init.method,input});let value={};if(path.endsWith('/bootstrap'))value={documents,scripts:[],history:[]};else if(path==='/api/llm')value={reply:'已引用此專案 API 證據；這是未執行的建議。',source:proposal};else if(path.startsWith('/api/scripts/')&&init.method==='PUT')value={...input,version:input.version+1};else if(path.endsWith('/runs')||path.endsWith('/llm/connections'))value=[];return Response.json(value);};
async function mount(){await bootstrap();createRoot(document.getElementById('root')).render(<TestingProvider><main className="app-shell"><ScriptWorkspace initialScript={{id:draftId,name:'登入後刪除',source,caseType:'test',version:0,messages:[]}}/></main></TestingProvider>);}void mount();`;
const bundle=await build({stdin:{contents:entry,resolveDir:dir,loader:'tsx'},nodePaths:[join(root,'apps/web/node_modules')],bundle:true,write:false,format:'iife',jsx:'automatic'});
const assets=join(root,'apps/web/dist/assets');const css=await readFile(join(assets,(await readdir(assets)).find(name=>name.endsWith('.css'))),'utf8');
const file=join(dir,'index.html');await writeFile(file,'<!doctype html><html lang="zh-Hant"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>案例 API 證據隔離測試</title><style>'+css+'</style><body><div id="root"></div><script>'+bundle.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></body></html>');
const browser=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const projectId of ['p','second-project']){
  await page.goto(pathToFileURL(file).href+'?project='+projectId);
  await page.getByRole('textbox',{name:'傳送訊息',exact:true}).fill('使用 loginUser，再呼叫 deleteAccount，先產生草稿。');
  await page.getByRole('button',{name:'傳送訊息',exact:true}).click();
  await page.getByRole('region',{name:'AI 修改預覽',exact:true}).waitFor();
  const call=await page.evaluate(()=>window.calls.findLast(call=>call.path==='/api/llm'));
  assert.equal(call.input.projectId,projectId);assert.equal(call.input.purpose,'author');
  assert.match(await page.getByRole('textbox',{name:'TypeScript 程式碼',exact:true}).inputValue(),/原步驟/);
  assert.equal(await page.evaluate(()=>window.calls.filter(call=>call.method==='POST'&&call.path!=='/api/llm'||call.method==='PUT').length),0,'suggestions never execute API or save scripts');
  await page.getByRole('button',{name:'套用',exact:true}).click();
  assert.match(await page.getByRole('textbox',{name:'TypeScript 程式碼',exact:true}).inputValue(),/新步驟/);
  assert.equal(await page.evaluate(()=>window.calls.filter(call=>call.method==='PUT').length),0,'applying remains a draft');
  await page.getByRole('button',{name:'儲存案例',exact:true}).click();await page.getByText('已儲存 v1',{exact:true}).waitFor();
 }
 await page.goto(pathToFileURL(file).href+'?project=p&draft=another-case');
 await page.getByRole('textbox',{name:'傳送訊息',exact:true}).waitFor();
 assert.equal(await page.getByRole('article',{name:'你的訊息',exact:true}).count(),0,'another case starts empty');
 await page.goto(pathToFileURL(file).href+'?project=p');
 await page.getByRole('article',{name:'你的訊息',exact:true}).waitFor();
 assert.match(await page.getByRole('article',{name:'你的訊息',exact:true}).innerText(),/loginUser/,'existing case retains its own history');
 await page.goto(pathToFileURL(file).href+'?project=p&draft=new-case');
 await page.getByRole('textbox',{name:'傳送訊息',exact:true}).waitFor();
 assert.equal(await page.getByRole('article',{name:'你的訊息',exact:true}).count(),0,'new case does not restore prior active chat');
 assert.deepEqual(errors,[]);
 console.log('PASS: two active project IDs reach authoring; proposal/apply/save remain separate; no API execution; case chat isolation and history restoration; no page errors.');
}finally{await browser.close();}
