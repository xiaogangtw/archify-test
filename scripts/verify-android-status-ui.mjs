import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, readdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { build } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
import {AndroidWorkspace} from './apps/web/src/features/testing/AndroidWorkspace';
import {TestingProvider} from './apps/web/src/features/testing/TestingProvider';
window.statusMode='online';window.statusCalls=0;
window.fetch=async(url)=>{
 if(String(url).endsWith('/android/status')){
  window.statusCalls++;
  if(window.statusMode==='error')throw new Error('Temporary connection failure');
  const connected=window.statusMode!=='expired';
  return new Response(JSON.stringify({connected,queued:0,checkedAt:null,sdk:{ready:true,path:''},avds:[],profiles:[],issues:[],capabilities:{appiumRuns:true,persistentDevices:true},appium:{ready:connected,reachable:connected},devices:!connected||window.statusMode==='removed'?[]:[{serial:'emulator-5554',state:'device',booted:false,managed:true,canControl:true,avd:'Pixel',error:''}]}));
 }
 return new Response('{}');
};
createRoot(document.getElementById('root')).render(<TestingProvider><main className="font-sans text-ink"><h1 className="text-title">Android Appium</h1><AndroidWorkspace projectId="status-regression"/></main></TestingProvider>);`;
const bundle = await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',nodePaths:['apps/web/node_modules']});
const assets='apps/web/dist/assets';
const css=await readFile(`${assets}/${(await readdir(assets)).find(name=>name.endsWith('.css'))}`,'utf8');
const html=`<!doctype html><html lang="zh-Hant"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Android status regression</title><style>${css}</style><body><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`;
await writeFile('.local/android-status-ui.html',html);
const server=createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end(html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
 const page=await browser.newPage({viewport:{width:1280,height:1000}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.getByRole('img',{name:'emulator-5554 實際裝置畫面',exact:true}).waitFor();
 await page.evaluate(()=>window.originalCanvas=document.querySelector('canvas'));
 for(const mode of ['error','online','expired','online','error','online']){
  const previous=await page.evaluate(mode=>{window.statusMode=mode;return window.statusCalls;},mode);
  await page.getByRole('button',{name:'重新整理',exact:true}).click();
  await page.waitForFunction(previous=>window.statusCalls>previous,previous);
  if(mode==='error')await page.getByRole('alert').filter({hasText:'Temporary connection failure'}).waitFor();
  else await page.getByText(mode==='expired'?'執行主機未連線':'執行主機已連線',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.querySelector('canvas')===window.originalCanvas),true,mode+' must retain the canvas');
  assert.equal(await page.getByRole('button',{name:'主畫面',exact:true}).isDisabled(),true);
 }
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await page.evaluate(()=>window.statusMode='removed');
 await page.getByRole('button',{name:'重新整理',exact:true}).click();
 await page.getByRole('img',{name:'尚未選擇裝置的手機外框',exact:true}).waitFor();
 assert.equal(await page.locator('canvas').count(),0);
 assert.deepEqual(errors,[]);
 console.log('PASS: failed polls and expired worker retain canvas; recovery and confirmed removal; disabled device input; responsive overflow. Mock status only; no screenshots saved.');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
