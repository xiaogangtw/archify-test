import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {parseFlow} from '../services/android/flow-contract.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),dir=join(root,'.local/shared-flow-ui');await mkdir(dir,{recursive:true});
const require=createRequire(import.meta.url),{build}=createRequire(new URL('../apps/web/package.json',import.meta.url))('esbuild'),{chromium}=require('playwright');
let axeModule;try{axeModule=require.resolve('axe-core');}catch{try{axeModule=createRequire(new URL('../.local/gate-deps/package.json',import.meta.url)).resolve('axe-core');}catch{}}
// Render gates must wait for the asynchronous React dialog to open before auditing.
await writeFile(join(dir,'gate-loader.mjs'),`import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){if(specifier==='playwright')return {url:new URL('./gate-playwright.mjs',import.meta.url).href,shortCircuit:true};${axeModule?`if(specifier==='axe-core')return {url:${JSON.stringify(pathToFileURL(axeModule).href)},shortCircuit:true};`:''}return next(specifier,context);}});`);
await writeFile(join(dir,'gate-playwright.mjs'),`import {createRequire} from 'node:module';
const api=createRequire(import.meta.url)(${JSON.stringify(require.resolve('playwright'))});
export const chromium={launch:async options=>{
 const browser=await api.chromium.launch(options),newPage=browser.newPage.bind(browser);
 browser.newPage=async(...args)=>{const page=await newPage(...args),goto=page.goto.bind(page);
  page.goto=async(url,...rest)=>{const response=await goto(url,...rest);
   if(String(url).includes('shared-flow-ui')&&(String(url).endsWith('apply.html')||String(url).endsWith('extract.html'))){await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:/^套用方式 |^抽取步驟範圍 /}).waitFor();}
   return response;};return page;};return browser;
}};`);
const fixture=join(dir,'api.ts');
await writeFile(fixture,`export const scriptHistoryKey='archify.script-history.v1';export function loadScripts(){return window.cases;} export async function saveScript(input){if(window.failSave)throw new Error('儲存測試失敗');const saved={...input,version:1};window.cases.push(saved);return saved;}`);
const entry=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {SharedFlowControls} from '../../apps/web/src/features/testing/SharedFlowControls';import {readSharedDefinition,sharedSource,extractShared,prependShared,applyShared,insertionOptions} from '../../apps/web/src/features/testing/sharedFlow';
window.helpers={readSharedDefinition,sharedSource,extractShared,prependShared,applyShared,insertionOptions};
const definition={appPackage:'jp.naver.line.android',steps:[{name:'開啟官方聊天室',action:'click',using:'id',value:'official'},{name:'確認輸入框',action:'assertVisible',using:'id',value:'input'},{name:'傳送訊息',action:'type',using:'id',value:'input',text:'你好'},{name:'確認訊息',action:'assertText',using:'id',value:'message',text:'你好'}]};
window.cases=[{id:'shared',name:'進入官方聊天室',version:2,caseType:'flow',source:sharedSource({...definition,steps:definition.steps.slice(0,2)}),messages:[]}];
function Harness(){const [draft,setDraft]=useState({id:'current',name:'傳送文字',version:1,caseType:'flow',messages:[],source:sharedSource(definition)}),[busy,setBusy]=useState(false);window.source=draft.source;window.setSource=source=>setDraft({...draft,source});return <main className="min-h-screen space-y-3 bg-canvas p-4 font-sans text-ink"><h1 className="text-title font-bold">共用流程</h1><section className="space-y-3 rounded-xl border border-line bg-surface p-3"><SharedFlowControls draft={draft} disabled={busy} onBusy={setBusy} onChange={source=>setDraft({...draft,source})}/><pre className="overflow-auto text-menu">{draft.source}</pre></section></main>;}createRoot(document.getElementById('root')).render(<Harness/>);`;
const result=await build({stdin:{contents:entry,resolveDir:dir,loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',nodePaths:[join(root,'apps/web/node_modules')],plugins:[{name:'mock-api',setup(b){b.onResolve({filter:/\/(controlApi|scriptStorage)$/},()=>({path:fixture}));}}]});
const assets=join(root,'apps/web/dist/assets'),css=await readFile(join(assets,(await readdir(assets)).find(name=>name.endsWith('.css'))),'utf8');
const html=`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>共用流程驗證</title><style>${css}</style></head><body><div id="root"></div><script>${result.outputFiles[0].text}</script></body></html>`;
await writeFile(join(dir,'index.html'),html);
for(const [file,label] of [['extract','抽成共用流程'],['apply','套用共用流程']])await writeFile(join(dir,file+'.html'),html.replace('</body>',`<script>const observer=new MutationObserver(()=>{const button=[...document.querySelectorAll('button')].find(el=>el.textContent==='${label}');if(button){observer.disconnect();requestAnimationFrame(()=>requestAnimationFrame(()=>button.click()));}});observer.observe(document.body,{childList:true,subtree:true});document.body.appendChild(document.createTextNode(""));</script></body>`));
await writeFile(join(dir,'roles.html'),html.replace('</body>',`<script>const observer=new MutationObserver(()=>{if(window.setSource&&window.source){observer.disconnect();const flow={appPackage:'jp.naver.line.android',actors:['sender','receiver'],before:[{name:'共用前置：進入官方聊天室 · v2',action:'callFlow',scriptId:'shared',scriptVersion:2}],steps:[{name:'發送者檢查',action:'assertAppForeground',actor:'sender'},{name:'接收者檢查',action:'assertAppForeground',actor:'receiver'}]};window.setSource(window.helpers.sharedSource(flow));}});observer.observe(document.body,{childList:true,subtree:true});document.body.appendChild(document.createTextNode(''));</script></body>`));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(pathToFileURL(join(dir,'index.html')).href);
 await page.getByRole('button',{name:'抽成共用流程',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await page.getByRole('button',{name:'取消',exact:true}).focus();await page.keyboard.press('Tab');
 assert.equal(await page.getByRole('button',{name:'關閉抽成共用流程',exact:true}).evaluate(el=>el===document.activeElement),true);
 await page.getByLabel('共用流程名稱',{exact:true}).fill('開啟聊天室');
 await page.getByRole('button',{name:/^抽取步驟範圍 /}).click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await page.evaluate(()=>window.failSave=true);await page.getByRole('button',{name:'建立並替換步驟',exact:true}).click();await page.getByText('儲存測試失敗',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>JSON.parse(window.source.match(/= ([\s\S]*) as const/)[1]).steps.length),4);
 await page.evaluate(()=>window.failSave=false);await page.getByRole('button',{name:'建立並替換步驟',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>window.cases.at(-1).name),'開啟聊天室');
 parseFlow(await page.evaluate(()=>window.cases.at(-1).source));parseFlow(await page.evaluate(()=>window.source));
 const extracted=await page.evaluate(()=>JSON.parse(window.source.match(/= ([\s\S]*) as const/)[1]));assert.equal(extracted.steps.length,3);assert.equal(extracted.steps[0].scriptVersion,1);
 await page.getByRole('button',{name:'套用共用流程',exact:true}).click();await page.getByRole('button',{name:/^共用流程 /}).click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.getByRole('button',{name:'插入共用流程',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>JSON.parse(window.source.match(/= ([\s\S]*) as const/)[1]).before[0].scriptVersion),2);
 // Verify hostile source is rejected without executing it, and role/package rules.
 const checks=await page.evaluate(async()=>{const {readSharedDefinition,prependShared}=window.helpers;let rejected=0;for(const source of ['export const flow = (()=>{window.executed=true;return {}})();','export const flow = {appPackage:"a.b",steps:[],...other} as const;','export const flow = {appPackage:"a.b",actors:"sender",steps:[{name:"check",action:"assertAppForeground"}]} as const;'])try{await readSharedDefinition(source);}catch{rejected++;}const child=await readSharedDefinition(window.cases[0].source);for(const parent of [{...child,actors:['sender','receiver']}])try{prependShared(parent,window.cases[0],child);}catch{rejected++;}return {rejected,executed:!!window.executed};});assert.deepEqual(checks,{rejected:4,executed:false});

 // A case upgraded from one phone must bind its existing pinned reference.
 const dual=await page.evaluate(()=>({...JSON.parse(window.source.match(/= ([\s\S]*) as const/)[1]),actors:['sender','receiver']}));
 await page.evaluate(flow=>window.setSource(window.helpers.sharedSource(flow)),dual);
 await page.getByRole('button',{name:/^共用流程 1 的操作角色 /}).waitFor();
 assert.equal((await page.evaluate(()=>JSON.parse(window.source.match(/= ([\s\S]*) as const/)[1]))).before[0].actor,undefined);
 await page.getByRole('button',{name:/^共用流程 1 的操作角色 /}).click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 let bound=await page.evaluate(()=>JSON.parse(window.source.match(/= ([\s\S]*) as const/)[1]));assert.equal(bound.before[0].actor,'sender');assert.equal(bound.before[0].scriptVersion,2);
 await page.getByRole('button',{name:'套用共用流程',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/^共用流程 /}).click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await page.getByRole('button',{name:/^操作手機的角色 /}).waitFor();assert.equal(await page.getByRole('button',{name:'插入共用流程',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:/^操作手機的角色 /}).click();await page.keyboard.press('End');await page.keyboard.press('Enter');
 await page.getByRole('button',{name:'插入共用流程',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 bound=await page.evaluate(()=>JSON.parse(window.source.match(/= ([\s\S]*) as const/)[1]));assert.deepEqual(bound.before.map(step=>step.actor),['sender','receiver']);assert.ok(bound.before.every(step=>step.scriptVersion===2));
 console.log('PASS single-to-dual role repair, keyboard role selection, required-role guard, per-phone reuse and immutable versions.');

 // Place a shared reference between existing steps without losing surrounding data.
 const settings={appPackage:'com.android.settings',variables:{keep:true},before:[{name:'準備',action:'back'}],after:[{name:'清理',action:'back'}],steps:[{name:'第一步',action:'back'},{name:'第二步',action:'assertAppForeground'}]};
 await page.evaluate(flow=>window.setSource(window.helpers.sharedSource(flow)),settings);
 await page.getByRole('button',{name:'套用共用流程',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:/^共用流程 /}).click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await page.getByRole('button',{name:/^插入位置 /}).click();await page.getByRole('option',{name:'主流程 / 第 2 步「第二步」之前',exact:true}).click();
 await page.getByText(/執行此共用流程時切換至 jp.naver.line.android/).waitFor();
 await page.getByRole('button',{name:'插入共用流程',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 let inserted=await page.evaluate(()=>JSON.parse(window.source.match(/= ([\s\S]*) as const/)[1]));
 assert.equal(inserted.appPackage,'com.android.settings');assert.deepEqual(inserted.steps.map(step=>step.action),['back','callFlow','assertAppForeground']);assert.deepEqual(inserted.variables,{keep:true});assert.deepEqual(inserted.before,settings.before);assert.deepEqual(inserted.after,settings.after);parseFlow(await page.evaluate(()=>window.source));
 // Overwrite only changes the draft source and uses an immutable reference.
 await page.getByRole('button',{name:'套用共用流程',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/^共用流程 /}).click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await page.getByRole('button',{name:/^套用方式 /}).click();await page.keyboard.press('End');await page.keyboard.press('Enter');
 assert.equal(await page.getByRole('button',{name:/^插入位置 /}).count(),0);
 await page.getByRole('button',{name:'覆蓋目前流程',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 const replaced=await page.evaluate(()=>JSON.parse(window.source.match(/= ([\s\S]*) as const/)[1]));assert.equal(replaced.appPackage,'jp.naver.line.android');assert.equal(replaced.steps.length,1);assert.equal(replaced.steps[0].scriptVersion,2);assert.equal(replaced.before,undefined);assert.equal(replaced.after,undefined);assert.equal(replaced.variables,undefined);parseFlow(await page.evaluate(()=>window.source));

 // Cancelling overwrite leaves the source unchanged; replacement adopts the child's phone mode.
 await page.evaluate(()=>window.setSource(window.helpers.sharedSource({appPackage:'com.android.settings',actors:['sender','receiver'],steps:[{name:'A',action:'assertAppForeground',actor:'sender'},{name:'B',action:'assertAppForeground',actor:'receiver'}]})));
 const unchanged=await page.evaluate(()=>window.source);
 await page.getByRole('button',{name:'套用共用流程',exact:true}).click();await page.getByRole('button',{name:/^套用方式 /}).click();await page.keyboard.press('End');await page.keyboard.press('Enter');await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.evaluate(()=>window.source),unchanged);
 const singleReplacement=await page.evaluate(async()=>{const original=await window.helpers.readSharedDefinition(window.source);return window.helpers.applyShared(original,window.cases[0],await window.helpers.readSharedDefinition(window.cases[0].source),'replace');});assert.equal(singleReplacement.actors,undefined);assert.equal(singleReplacement.steps[0].actor,undefined);parseFlow('export const flow='+JSON.stringify(singleReplacement)+' as const;');
 const positions=await page.evaluate(()=>{const flow={appPackage:'a.b',steps:[{name:'分支',action:'if',then:[{name:'內部',action:'back'}],else:[]}]};const point=window.helpers.insertionOptions(flow).find(item=>item.label.includes('條件成立')&&item.label.includes('之前'));const next=window.helpers.applyShared(flow,window.cases[0],{appPackage:'other.app',steps:[]},JSON.parse(point.value));return {actions:next.steps[0].then.map(step=>step.action),original:flow.steps[0].then.length};});assert.deepEqual(positions,{actions:['callFlow','back'],original:1});
 console.log('PASS chosen middle insertion, nested branch positions, cross-App notice, preservation of original sections, overwrite with pinned reference and draft-only updates.');
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.deepEqual(errors,[]);console.log('PASS shared-flow extraction, failed-save preservation, pinned prepend, keyboard selection, static parser rejection, actor guards and responsive layout. Mock API only.');
}finally{await browser.close();}

