import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..',import.meta.url));
const {build}=createRequire(new URL('../apps/web/package.json',import.meta.url))('esbuild');
const {chromium}=createRequire(import.meta.url)('playwright');
const dir=join(root,'.local/authoring-request');await mkdir(dir,{recursive:true});
const provider=join(dir,'provider.tsx');
await writeFile(provider,`export function useTesting(){return {data:{project:{id:'test',name:'Test'}},inlineRuns:{},startInlineRun:async()=>{},refreshData:async()=>{}};}`);
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {ScriptWorkspace} from '../../apps/web/src/features/testing/ScriptWorkspace';
const key='archify.api-chat.v2.test:flow:case-1';
localStorage.setItem(key,JSON.stringify([{id:'thread',title:'長對話',updatedAt:new Date().toISOString(),messages:Array.from({length:35},(_,i)=>({id:'msg-'+i,role:i%2?'assistant':'user',text:'舊訊息 '+i}))}]));
window.requests=[];window.rejectRequest=false;
window.fetch=async(url,options={})=>{
 const path=String(url);
 if(path.endsWith('/android/authoring-context'))return new Response(JSON.stringify({error:'手機尚未連線'}),{status:503,headers:{'Content-Type':'application/json'}});
 if(path.endsWith('/llm')){const body=JSON.parse(options.body);window.requests.push(body);if(window.rejectRequest||body.messages.length>30)return new Response(JSON.stringify({error:'Invalid request'}),{status:400,headers:{'Content-Type':'application/json'}});return new Response(JSON.stringify({reply:'已收到問題。',source:null}),{headers:{'Content-Type':'application/json'}});}
 return new Response('{}',{headers:{'Content-Type':'application/json'}});
};
const script={id:'case-1',name:'案例',source:'export const flow = {appPackage: "com.android.settings", steps: [{name: "前景", action: "assertAppForeground"}]} as const;',caseType:'flow',version:1,messages:[]};
createRoot(document.getElementById('root')).render(<main className="p-4"><ScriptWorkspace initialScript={script}/></main>);`;
const result=await build({stdin:{contents:entry,resolveDir:dir,loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',nodePaths:[join(root,'apps/web/node_modules')],plugins:[{name:'fixture-provider',setup(build){build.onResolve({filter:/TestingProvider$/},()=>({path:provider}));}}]});
const assets=join(root,'apps/web/dist/assets');const css=await readFile(join(assets,(await readdir(assets)).find(name=>name.endsWith('.css'))),'utf8');
const html='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Authoring request</title><style>'+css+'</style><body><div id="root"></div><script>'+result.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></body></html>';
await writeFile(join(dir,'index.html'),html);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(pathToFileURL(join(dir,'index.html')).href);
 await page.getByRole('complementary',{name:'案例聊天助手',exact:true}).waitFor();
 const input=page.getByRole('textbox',{name:'傳送訊息',exact:true});
 await input.fill('如果網頁逾時，就會失敗嗎？');
 await page.getByRole('button',{name:'傳送訊息',exact:true}).click();
 await page.getByText('已收到問題。',{exact:true}).waitFor();
 const request=await page.evaluate(()=>window.requests[0]);
 assert.equal(request.messages.length,30);assert.match(request.messages.at(-1).content,/如果網頁逾時，就會失敗嗎/);
 assert.match(request.messages.at(-1).content,/較早的 6 則對話未包含/);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('archify.api-chat.v2.test:flow:case-1'))[0].messages.length),37,'the full local history must remain intact');
 await page.evaluate(()=>window.rejectRequest=true);
 await input.fill('再試一次');await page.getByRole('button',{name:'傳送訊息',exact:true}).click();
 await page.getByText('AI 服務拒絕了這次對話資料，請重新整理後再試。',{exact:true}).waitFor();
 assert.equal(await page.getByText('Invalid request',{exact:true}).count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS long authoring conversation stays within API limits, preserves local history and shows a readable rejection (mock service only).');
}finally{await browser.close();}
