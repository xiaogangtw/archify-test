import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('..',import.meta.url));
const assets=join(root,'apps/web/dist/assets');
const css=await readFile(join(assets,(await readdir(assets)).find(name=>name.endsWith('.css'))),'utf8');
const {build}=createRequire(new URL('../apps/web/package.json',import.meta.url))('esbuild');
const {chromium}=createRequire(import.meta.url)('playwright');
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {ScriptWorkspace} from './apps/web/src/features/testing/ScriptWorkspace';
const draft={id:'explore-case',name:'測試案例',source:'export const flow = {appPackage: "com.example", steps: [{name:"原有步驟",action:"assertAppForeground"}]} as const;',caseType:'flow',version:1,messages:[]};
window.calls=[];window.deviceCalls=0;let polls=0;
window.fetch=async(url,options={})=>{const path=String(url),body=options.body?JSON.parse(options.body):{};window.calls.push({path,body});let value={};let task=JSON.parse(sessionStorage.getItem('agentTask')||'null');
if(path.includes('/android/agent-tasks/latest'))value={task:task?.threadId===new URL(path,'http://localhost').searchParams.get('threadId')?task:null};
else if(path.endsWith('/android/agent-tasks')&&options.method==='POST'){
 const second=!!task;task={id:'task-1',scriptVersion:1,state:'running',revision:second?3:1,message:'正在觀察手機',baseSource:draft.source,draft:{revision:second?2:1,source:second&&window.removeStep?draft.source.replace('原有步驟','新步驟'):draft.source+'\\n'},events:[],threadId:body.threadId,turn:second?2:1};polls=0;if(!second)window.deviceCalls++;value=task;
}else if(path.endsWith('/android/agent-tasks/task-1/stop')){task.state='stopped';task.message='已停止後續操作';value=task;}
else if(path.endsWith('/android/agent-tasks/task-1')){
 if(task.state==='running'&&++polls>=2){task.state=task.turn===1?'waiting':'ready';task.message=task.turn===1?'請問預期提示是什麼？':'已整理局部草稿';task.question=task.turn===1?{prompt:'請問預期提示是什麼？',options:['未同意條款','其他提示']}:undefined;}value=task;
}
if(task)sessionStorage.setItem('agentTask',JSON.stringify(task));
if(window.delaySubmit&&path.endsWith('/android/agent-tasks')&&options.method==='POST')await new Promise(resolve=>setTimeout(resolve,1200));
return new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}})};
createRoot(document.getElementById('root')).render(<ScriptWorkspace flowOnly initialScript={draft} deviceSerial="emulator-5554"/>);`;
const bundle=await build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},nodePaths:[join(root,'apps/web/node_modules')],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',plugins:[{name:'test-provider',setup(b){b.onResolve({filter:/^\.\/TestingProvider$/},()=>({path:'provider',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:`export function useTesting(){return {data:{project:{id:'test',name:'Test'}},inlineRuns:{},startInlineRun:async()=>{},refreshData:async()=>{}}}`,loader:'tsx'}));}}]});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
const html=`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>案例編輯驗證</title><style>${css}</style></head><body><main class="font-sans text-menu text-ink bg-canvas"><h1 class="sr-only">案例編輯驗證</h1><div id="root"></div></main><script>${bundle.outputFiles[0].text}</script></body></html>`;
if(process.env.PREVIEW_HTML)await writeFile(process.env.PREVIEW_HTML,html);
try{
 const page=await browser.newPage({viewport:{width:Number(process.env.VIEWPORT_WIDTH||1280),height:720}});page.on("pageerror",error=>console.error(error));page.setDefaultTimeout(5000);
 await page.route('http://localhost:45678/',route=>route.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://localhost:45678/');
 assert.equal(await page.getByLabel('讓 AI 操作手機並觀察').isChecked(),true);
 await page.getByRole('textbox',{name:'傳送訊息'}).fill('請實際測試登入');await page.getByRole('button',{name:'傳送訊息'}).click();
 await page.getByRole('region',{name:'等待你的回答'}).waitFor();await page.getByText(/局部修改已合併至預覽/).waitFor();await page.getByRole('region',{name:'AI 修改預覽'}).waitFor();
 assert.equal(await page.evaluate(()=>window.deviceCalls),1);
 await page.waitForFunction(()=>Object.keys(localStorage).some(key=>localStorage.getItem(key)?.includes('請問預期提示是什麼')));
 await page.reload();await page.getByRole('region',{name:'等待你的回答'}).waitFor();
 assert.equal(await page.evaluate(()=>window.deviceCalls),0);
 if(process.env.TEST_REMOVAL)await page.evaluate(()=>window.removeStep=true);
 await page.getByRole('textbox',{name:'回答 Agent 的問題'}).fill('自行輸入測試');assert.equal(await page.getByRole('button',{name:'回答並繼續'}).isEnabled(),true);
 await page.getByRole('button',{name:'未同意條款',exact:true}).click();
 await page.getByRole('region',{name:'AI 修改預覽'}).waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='套用'&&!button.disabled));
 assert.equal(await page.getByRole('button',{name:'套用',exact:true}).isVisible(),true);
 const applyBounds=await page.getByRole('button',{name:'套用',exact:true}).boundingBox();assert.ok(applyBounds&&applyBounds.y>=0&&applyBounds.y+applyBounds.height<=await page.evaluate(()=>innerHeight),'確認按鈕應顯示在視窗內');
 assert.equal(await page.getByLabel('修改後片段').isVisible(),true);
 if(process.env.PREVIEW_IMAGE)console.log('PREVIEW_IMAGE:'+String(await page.screenshot({type:'png'}).then(data=>data.toString('base64'))));
 await page.getByText('查看完整程式碼比較').click();
 await page.getByLabel('AI 修改建議內容').waitFor();
 const flow=page.getByRole('button',{name:/測試流程/});assert.equal(await flow.getAttribute('aria-expanded'),'false');await flow.click();assert.equal(await flow.getAttribute('aria-expanded'),'true');await flow.click();assert.equal(await flow.getAttribute('aria-expanded'),'false');
 const requests=await page.evaluate(()=>window.calls.filter(call=>call.path.endsWith('/android/agent-tasks')&&call.body.requestId).map(call=>call.body));
 assert.equal(requests.length,1);assert.equal(requests[0].question,'未同意條款');
 await page.getByRole('button',{name:'套用',exact:true}).click();
 if(process.env.TEST_REMOVAL){await page.getByRole('dialog',{name:'確認原有步驟'}).waitFor();await page.getByRole('button',{name:'返回檢查'}).click();assert.match(await page.getByLabel('TypeScript 程式碼',{exact:true}).inputValue(),/原有步驟/);await page.getByRole('button',{name:'套用',exact:true}).click();await page.getByRole('button',{name:'仍要套用修改'}).click();}
 assert.match(await page.getByLabel('TypeScript 程式碼',{exact:true}).inputValue(),/com.example/);
 if(process.env.TEST_STOP){
  await page.getByRole('button',{name:'新增對話',exact:true}).click();await page.evaluate(()=>window.delaySubmit=true);
  await page.getByRole('textbox',{name:'傳送訊息'}).fill('開始後立即停止');await page.getByRole('button',{name:'傳送訊息',exact:true}).click();await page.getByRole('button',{name:'停止任務',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('agentTask')).state==='stopped');await page.getByRole('button',{name:'傳送訊息',exact:true}).waitFor();
 }
 console.log('PASS durable task restoration, question answer, draft review and original-step protection (mock backend).');
}finally{await browser.close();}
