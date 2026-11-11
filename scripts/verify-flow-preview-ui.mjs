import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..',import.meta.url)),dir=join(root,'.local/flow-preview-ui');await mkdir(dir,{recursive:true});
const {build}=createRequire(new URL('../apps/web/package.json',import.meta.url))('esbuild'),{chromium}=createRequire(import.meta.url)('playwright');
const check=name=>({name,action:'assertAppForeground'});
const definition={appPackage:'com.example.chat',variables:{receiverIntegrationReady:false},routines:{receiverInspectCard:[check('接收者前景'),check('接收聊天室'),check('資料可見'),check('核對顯示名稱'),check('核對補充欄位'),check('必須完成本次新訊息辨識')]},steps:[check('確認位於 DemoOfficial 官方聊天室'),check('確認 rich menu 圖片顯示'),{name:'點擊項目詳情',action:'tapPoint',x:0.23,y:0.82},{name:'顯示分享按鈕並點擊',action:'repeat',times:1,steps:[check('必要時滑動'),check('確認分享按鈕'),check('點擊分享按鈕')]},{name:'Agent 實際操作紀錄',action:'repeat',times:1,steps:[check('選擇好友 friend-a'),check('確認 Share 可用'),check('點擊 Share')]},check('確認分享後返回官方聊天室'),{name:'接收端紀錄隔離',action:'optional',condition:{kind:'variable',variable:'receiverIntegrationReady',equals:true},steps:[check('進入 friend-b 聊天室'),check('確認接收端聊天室')]},{name:'雙裝置整合未完成時禁止成功',action:'assert',condition:{kind:'variable',variable:'receiverIntegrationReady',equals:true}}]};
const source=flow=>'export const flow = '+JSON.stringify(flow,null,2)+' as const;';
const entry=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {AppiumFlowPreview} from '../../apps/web/src/features/testing/AppiumFlowPreview';
function Harness(){const [source,setSource]=useState(${JSON.stringify(source(definition))}),[expanded,setExpanded]=useState(true);window.setSource=setSource;return <main className="min-h-screen bg-canvas p-3 font-sans text-ink"><h1 className="mb-3 text-title font-bold">案例撰寫</h1><section aria-label="測試流程預覽" className="min-w-0 rounded-xl border border-line bg-surface p-3"><AppiumFlowPreview source={source} expanded={expanded} onToggle={()=>setExpanded(value=>!value)}/></section></main>;}createRoot(document.getElementById('root')).render(<Harness/>);`;
const result=await build({stdin:{contents:entry,resolveDir:dir,loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',nodePaths:[join(root,'apps/web/node_modules')]});
const assets=join(root,'apps/web/dist/assets'),css=await readFile(join(assets,(await readdir(assets)).find(name=>name.endsWith('.css'))),'utf8');
await writeFile(join(dir,'index.html'),`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>流程預覽驗證</title><style>${css}</style></head><body><div id="root"></div><script>${result.outputFiles[0].text}</script></body></html>`);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
try{
 const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(pathToFileURL(join(dir,'index.html')).href);
 const heading=page.getByRole('button',{name:/測試流程 · 8 個主流程步驟/});await heading.waitFor();
 const main=page.getByRole('list',{name:'案例主流程',exact:true});assert.equal(await main.locator(':scope > li').count(),8);assert.match(await main.locator(':scope > li').first().innerText(),/確認位於 DemoOfficial/);
 assert.equal(await page.getByText('1. 接收者前景',{exact:true}).isVisible(),false);assert.equal(await main.getByText('接收者前景',{exact:false}).count(),0);
 await page.getByText('4. 顯示分享按鈕並點擊',{exact:false}).click();await page.getByText('1. 必要時滑動',{exact:true}).waitFor();assert.equal(await main.locator(':scope > li').count(),8);
 const optional=page.locator('summary').filter({hasText:'7. 接收端紀錄隔離'});await optional.focus();await page.keyboard.press('Enter');await page.getByText('條件成立時執行',{exact:true}).waitFor();await page.getByText('1. 進入 friend-b 聊天室',{exact:true}).waitFor();
 await page.getByText('未被流程引用的共用定義 · 1',{exact:true}).click();await page.getByText('只有定義，沒有安排執行。',{exact:true}).waitFor();await page.locator('summary').filter({hasText:/^receiverInspectCard$/}).click();await page.getByText('1. 接收者前景',{exact:true}).waitFor();
 await heading.click();await main.waitFor({state:'hidden'});await heading.focus();await page.keyboard.press('Space');await main.waitFor();
 const withCall={...definition,before:[check('前置啟動')],after:[check('清理操作')],steps:[{name:'真的呼叫接收端',action:'call',routine:'receiverInspectCard'}]};await page.evaluate(value=>window.setSource(value),source(withCall));await page.getByRole('button',{name:/1 個主流程步驟/}).waitFor();assert.equal(await page.getByText('未被流程引用的共用定義 · 1',{exact:true}).count(),0);await page.locator('summary').filter({hasText:'1. 真的呼叫接收端'}).click();await page.getByText('1. 接收者前景',{exact:true}).waitFor();await page.getByRole('region',{name:'前置流程',exact:true}).waitFor();await page.getByRole('region',{name:'清理流程',exact:true}).waitFor();
 const cyclic={...definition,routines:{a:[{name:'再呼叫自己',action:'call',routine:'a'}]},steps:[{name:'呼叫 a',action:'call',routine:'a'}]};await page.evaluate(value=>window.setSource(value),source(cyclic));await page.locator('summary').filter({hasText:'1. 呼叫 a'}).click();await page.locator('summary').filter({hasText:'1. 再呼叫自己'}).click();await page.getByText('循環引用，無法展開。',{exact:true}).waitFor();
 await page.evaluate(()=>window.setSource('export const flow = (()=>{window.executed=true;return {}})();'));await page.getByText(/流程預覽無法解析/).waitFor();assert.equal(await page.evaluate(()=>!!window.executed),false);
 await page.evaluate(value=>window.setSource(value),source(definition));await heading.waitFor();
 for(const width of [280,320,390,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.deepEqual(errors,[]);console.log('PASS structural preview: 8 ordered main nodes, unused routines excluded, nested groups and conditional labels, reachable routine expansion, before/after, cycle guard, parse failure, keyboard toggles and responsive widths. No device actions.');
}finally{await browser.close();}
