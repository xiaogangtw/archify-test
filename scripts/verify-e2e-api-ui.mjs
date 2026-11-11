import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {parseFlow} from '../services/android/flow-contract.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),dir=join(root,'.local/e2e-api-ui');await mkdir(dir,{recursive:true});
const runtime=createRequire(import.meta.url);
const {chromium}=runtime('playwright'),{build}=createRequire(new URL('../apps/web/package.json',import.meta.url))('esbuild');
const fixture=join(dir,'mock.ts');
await writeFile(fixture,`export const loadScripts=()=>window.cases;export async function api(path,options){if(path.includes('validate')){if(window.reject)throw new Error('API 參數無效');return {valid:true};}return {scriptId:'api',scriptVersion:2,name:'查詢收藏',cases:[{id:'case',name:'收藏紀錄',request:{environmentId:'qa',authReference:'',method:'GET',endpoint:'/cards',headers:{},queryParams:{memberId:'{{memberId}}'},variables:{},body:'',operationName:'',expectedStatus:200,responseVariables:[],assertions:[{path:'ok',operator:'equals',value:true}]}}]};}`);
const entry=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {ApiFlowControls} from '../../apps/web/src/features/testing/ApiFlowControls';import {AppiumFlowPreview} from '../../apps/web/src/features/testing/AppiumFlowPreview';
window.cases=[{id:'api',name:'查詢收藏',version:2,apiFlow:{},source:'',messages:[]}];
const initial={appPackage:'com.example.app',actors:['sender','receiver'],steps:[{name:'分享',action:'assertAppForeground',actor:'sender'},{name:'收藏',action:'assertAppForeground',actor:'receiver'}]};
function Harness(){const [source,setSource]=useState('export const flow='+JSON.stringify(initial)+' as const;'),[busy,setBusy]=useState(false);window.source=source;return <main className="min-h-screen bg-canvas p-4 font-sans text-ink"><h1 className="text-title font-bold">案例撰寫</h1><section className="space-y-3 rounded-xl border border-line bg-surface p-3"><ApiFlowControls draft={{id:'current',name:'雙機',version:1,source,messages:[]}} disabled={busy} onBusy={setBusy} onChange={setSource}/><AppiumFlowPreview source={source} expanded={true} onToggle={()=>{}}/></section></main>;}createRoot(document.getElementById('root')).render(<Harness/>);`;
const result=await build({stdin:{contents:entry,resolveDir:dir,loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',nodePaths:[join(root,'apps/web/node_modules')],plugins:[{name:'mock',setup(b){b.onResolve({filter:/\/(controlApi|scriptStorage)$/},()=>({path:fixture}));}}]});
const assets=join(root,'apps/web/dist/assets'),css=await readFile(join(assets,(await readdir(assets)).find(name=>name.endsWith('.css'))),'utf8');
const html=`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>API 流程編輯驗證</title><style>${css}</style></head><body><div id="root"></div><script>${result.outputFiles[0].text}</script></body></html>`;
await writeFile(join(dir,'index.html'),html);
await writeFile(join(dir,'dialog.html'),html.replace('</body>',`<script>const observer=new MutationObserver(()=>{const button=[...document.querySelectorAll('button')].find(el=>el.textContent==='帶入／編輯 API 流程');if(button){observer.disconnect();button.click();const next=new MutationObserver(()=>{const check=document.querySelector('input[type=checkbox]');if(check){next.disconnect();check.click();}});next.observe(document.body,{childList:true,subtree:true});}});observer.observe(document.body,{childList:true,subtree:true});</script></body>`));
const browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(pathToFileURL(join(dir,'index.html')).href);
 await page.getByRole('button',{name:'帶入／編輯 API 流程'}).click();
 await page.getByRole('checkbox').check();await page.getByLabel('輸出變數前綴',{exact:true}).fill('cards');
 await page.getByLabel('本次輸入參數（JSON）',{exact:true}).fill('{"memberId":"B"}');
 await page.getByRole('button',{name:/^插入位置 /}).click();
 await page.getByRole('option',{name:'主流程 / 第 2 步「收藏」之前',exact:true}).click();
 await page.getByRole('button',{name:'插入流程',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 const flow=parseFlow(await page.evaluate(()=>window.source));assert.deepEqual(flow.steps.map(item=>item.action),['assertAppForeground','apiFlow','assertAppForeground']);assert.equal(flow.steps[1].inputs.memberId,'B');assert.equal(flow.steps[1].actor,undefined);
 await page.getByRole('button',{name:'帶入／編輯 API 流程'}).click();await page.getByRole('button',{name:'編輯參數',exact:true}).click();
 await page.getByLabel('授權 token 變數名稱（選填）',{exact:true}).fill('login_token');
 await page.evaluate(()=>{window.reject=true;});await page.getByRole('button',{name:'套用參數',exact:true}).click();await page.getByText('API 參數無效',{exact:true}).waitFor();assert.equal(parseFlow(await page.evaluate(()=>window.source)).steps[1].authVariable,undefined);
 await page.evaluate(()=>{window.reject=false;});await page.getByRole('button',{name:'套用參數',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(parseFlow(await page.evaluate(()=>window.source)).steps[1].authVariable,'login_token');
 await page.getByRole('button',{name:'帶入／編輯 API 流程'}).click();await page.getByRole('button',{name:'移除步驟',exact:true}).click();assert.equal(parseFlow(await page.evaluate(()=>window.source)).steps.length,2);
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});await page.goto(pathToFileURL(join(dir,'dialog.html')).href);await page.getByLabel('輸出變數前綴',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'});}
 assert.deepEqual(errors,[]);console.log('PASS API selection, middle insertion, per-use inputs, editing, validation failure preservation, removal, Escape and responsive layouts. Mock API only. No screenshots saved.');
}finally{await browser.close();}
