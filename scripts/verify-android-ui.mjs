import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..',import.meta.url));
const {build}=createRequire(new URL('../apps/web/package.json',import.meta.url))('esbuild');
const {chromium}=createRequire(import.meta.url)('playwright');
const dir=join(root,'.local/android-ui');await mkdir(dir,{recursive:true});
const entry=`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {AndroidWorkspace} from '../../apps/web/src/features/testing/AndroidWorkspace';import {E2EWorkspace} from '../../apps/web/src/features/testing/E2EWorkspace';import {Button} from '../../apps/web/src/components/ui/controls';
import {TestingProvider} from '../../apps/web/src/features/testing/TestingProvider';
window.fixture={capabilities:{persistentDevices:true,adbRecovery:true},profiles:[],connected:true,checkedAt:new Date().toISOString(),queued:0,sdk:{ready:true,path:'/sdk'},avds:['Pixel'],devices:[],issues:[],appium:{reachable:false,ready:false}};window.calls=[];window.fail=false;
window.framesSent=0;window.streamClosed=0;window.VideoDecoder=class{state='unconfigured';decodeQueueSize=0;constructor(options){this.options=options;}configure(){this.state='configured';}decode(){const canvas=document.createElement('canvas');canvas.width=576;canvas.height=1024;this.options.output(new VideoFrame(canvas,{timestamp:0}));}reset(){this.state='unconfigured';}close(){this.state='closed';}};
window.WebSocket=class{static OPEN=1;readyState=1;bufferedAmount=0;constructor(url){this.url=url;setTimeout(()=>this.onmessage?.({data:JSON.stringify({type:'connected',control:true})}),0);this.timer=setInterval(()=>{window.framesSent++;const config=new Uint8Array([2,0,0,0,0,0,0,0,0,0,0,0,1,103,66,0,31,0]);this.onmessage?.({data:config.buffer});const key=new Uint8Array([1,0,0,0,0,0,0,0,0,1]);this.onmessage?.({data:key.buffer});},300);}send(data){window.calls.push({path:this.url,payload:JSON.parse(data)});}close(){if(this.readyState===3)return;this.readyState=3;clearInterval(this.timer);window.streamClosed++;setTimeout(()=>this.onclose?.(),0);}};
window.fetch=async(url,options={})=>{const path=String(url),payload=options.body?JSON.parse(options.body):{};window.calls.push({path,payload});if(path.endsWith('/profiles'))window.fixture.profiles.push({id:'profile-test',name:payload.name,state:'ready',serial:null});if(path.endsWith('/profile-test/start'))window.fixture.profiles[0].serial='emulator-5554';if(window.fail)return new Response(JSON.stringify({error:'執行器已離線'}),{status:503});if(path.endsWith('/start'))window.fixture.devices=Array.from({length:payload.count},(_,i)=>({serial:'emulator-'+(5554+i*2),state:'device',booted:window.startBooted!==false,managed:true,canControl:true,avd:payload.avd,error:''}));if(path.endsWith('/stop'))window.fixture.devices=window.fixture.devices.filter(d=>!path.includes(d.serial));if(path.endsWith('/screen')){const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='),c=>c.charCodeAt(0));return new Response(bytes,{headers:{'Content-Type':'image/png'}});}return new Response(JSON.stringify(path.endsWith('/status')?window.fixture:{accepted:true}),{headers:{'Content-Type':'application/json'}});};
function Harness(){const [view,setView]=useState('android');return <main className="bg-canvas p-4 font-sans text-ink"><nav aria-label="測試入口" className="mb-4 flex gap-2"><Button onClick={()=>setView('web')}>Web Playwright</Button><Button onClick={()=>setView('android')}>Android Appium</Button></nav><h1 className="mb-4 text-title font-bold">{view==='android'?'Android Appium':'Web Playwright'}</h1>{view==='android'?<AndroidWorkspace projectId="test"/>:<E2EWorkspace projectId="test" platform="web"/>}</main>}createRoot(document.getElementById('root')).render(<TestingProvider><Harness/></TestingProvider>);`;
const bundle=await build({stdin:{contents:entry,resolveDir:dir,loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',nodePaths:[join(root,'apps/web/node_modules')]});
const assets=join(root,'apps/web/dist/assets'),css=await readFile(join(assets,(await readdir(assets)).find(n=>n.endsWith('.css'))),'utf8');
const html='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Android UI verification</title><style>'+css+'</style><body><div id="root"></div><script>'+bundle.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></body></html>';
await writeFile(join(dir,'index.html'),html);
await writeFile(join(dir,'devices.html'),html.replace('</body>',`<script>window.fixture.devices=[{serial:'emulator-5554',state:'device',booted:true,managed:true,canControl:true,avd:'Pixel',error:''}];</script></body>`));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
try{const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(pathToFileURL(join(dir,'index.html')).href);
assert.equal(await page.getByRole('button',{name:'重試連線',exact:true}).count(),0);
await page.evaluate(()=>window.fixture.devices=[{serial:'emulator-5554',state:'starting',booted:false,managed:true,canControl:true,avd:'Pixel',error:''}]);
await page.getByRole('button',{name:'重新整理',exact:true}).click();
await page.getByRole('button',{name:'重試連線',exact:true}).waitFor();
await page.waitForFunction(()=>document.querySelector('button[aria-label="重試連線"]:not(:disabled)'));
await page.evaluate(()=>{
 const previous=window.fetch;
 window.fetch=async(url,options)=>{
  if(!String(url).endsWith('/adb/retry'))return previous(url,options);
  window.calls.push({path:String(url),payload:{}});
  if(window.retryFailure)return new Response(JSON.stringify({error:'手機正在執行測試，請稍後重試。'}),{status:409,headers:{'Content-Type':'application/json'}});
  await new Promise(resolve=>{window.finishReset=resolve;});
  return new Response(JSON.stringify({restarted:true}),{headers:{'Content-Type':'application/json'}});
 };
});
await page.getByRole('button',{name:'重試連線',exact:true}).focus();await page.keyboard.press('Enter');
await page.getByRole('button',{name:'正在重試連線',exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:'正在重試連線',exact:true}).isDisabled(),true);
assert.equal(await page.getByRole('button',{name:'正在重試連線',exact:true}).getAttribute('aria-busy'),'true');
await page.getByRole('button',{name:'正在重試連線',exact:true}).evaluate(button=>{button.click();button.click();});
assert.equal(await page.evaluate(()=>window.calls.filter(call=>call.path.endsWith('/adb/retry')).length),1);
await page.evaluate(()=>window.finishReset());await page.getByRole('button',{name:'重試連線',exact:true}).waitFor();
await page.evaluate(()=>window.retryFailure=true);
await page.getByRole('button',{name:'重試連線',exact:true}).press('Space');
await page.getByRole('alert').filter({hasText:'手機正在執行測試'}).waitFor();
await page.getByRole('button',{name:'重新整理',exact:true}).click();
assert.equal(await page.getByRole('alert').filter({hasText:'手機正在執行測試'}).count(),1,'status polling must not erase recovery errors');
await page.evaluate(()=>{window.fixture.queued=1;});await page.getByRole('button',{name:'重新整理',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('button[aria-label="重試連線"]')?.disabled);
await page.evaluate(()=>{window.fixture.queued=0;window.retryFailure=false;});await page.getByRole('button',{name:'重新整理',exact:true}).click();
await page.evaluate(()=>{window.fixture.devices[0].state='device';window.fixture.devices[0].booted=true;});await page.getByRole('button',{name:'重新整理',exact:true}).click();await page.waitForFunction(()=>window.framesSent>0);
assert.equal(await page.getByRole('button',{name:'重試連線',exact:true}).isDisabled(),true,'green light cannot retry');
assert.equal(await page.getByRole('button',{name:'重試連線',exact:true}).innerText(),'','icon has no visible label');
await page.evaluate(()=>{window.fixture.devices=[];window.framesSent=0;});await page.getByRole('button',{name:'重新整理',exact:true}).click();
console.log('PASS ADB retry keyboard, duplicate guard, loading, failure retention and busy restrictions (mock executor only).');
await page.getByText('固定手機管理',{exact:true}).click();await page.getByLabel('手機名稱',{exact:true}).fill('LINE 測試 A');await page.getByRole('button',{name:'新增固定手機',exact:true}).click();await page.getByText('LINE 測試 A',{exact:true}).waitFor();
await page.evaluate(() => {
 const originalFetch = window.fetch;
 window.fetch = async (url, options) => {
  if (String(url).endsWith('/profile-test/start')) {
   window.calls.push({path:String(url),payload:{}});
   await new Promise(resolve => { window.finishProfileStart = resolve; });
   return new Response('{}', {headers:{'Content-Type':'application/json'}});
  }
  return originalFetch(url, options);
 };
});
await page.getByRole('button',{name:'啟動手機',exact:true}).evaluate(button => { button.click(); button.click(); });
await page.getByRole('button',{name:'啟動中',exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:'啟動中',exact:true}).isDisabled(),true);
assert.equal(await page.evaluate(()=>window.calls.filter(c=>c.path.endsWith('/profile-test/start')).length),1);
await page.evaluate(()=>window.finishProfileStart());
await page.waitForFunction(()=>window.calls.filter(c=>c.path.endsWith('/status')).length>=3);
assert.equal(await page.getByRole('button',{name:'啟動中',exact:true}).isDisabled(),true,'keep locked after response until inventory reports the device');
await page.evaluate(()=>window.fixture.profiles[0].serial='emulator-5554');
await page.getByRole('button',{name:'重新整理',exact:true}).click();
await page.getByRole('button',{name:'查看手機',exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:'查看手機',exact:true}).isEnabled(),true);
await page.evaluate(()=>{
 window.fixture.profiles[0].serial=null;
 const previous=window.fetch;
 window.fetch=async(url,options)=>String(url).endsWith('/profile-test/start') ? new Response(JSON.stringify({error:'啟動失敗，請重試。'}),{status:503,headers:{'Content-Type':'application/json'}}) : previous(url,options);
});
await page.getByRole('button',{name:'重新整理',exact:true}).click();
await page.getByRole('button',{name:'啟動手機',exact:true}).click();
await page.getByText('啟動失敗，請重試。',{exact:true}).waitFor();
assert.equal(await page.getByRole('button',{name:'啟動手機',exact:true}).isEnabled(),true,'failed starts can be retried');
console.log('PASS profile double-click guard, delayed inventory and failure recovery (mock executor only).');
await page.getByText('臨時模擬器',{exact:true}).click();
await page.getByRole('button',{name:'啟動模擬器',exact:true}).waitFor();
await page.getByRole('button',{name:/啟動數量/}).click();await page.getByRole('listbox').press('ArrowDown');await page.getByRole('listbox').press('Enter');
await page.evaluate(()=>window.startBooted=false);await page.getByRole('button',{name:'啟動模擬器',exact:true}).click();await page.getByRole('img',{name:'emulator-5554 實際裝置畫面',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/emulator-5556/}).count(),1);
await page.getByRole('status').filter({hasText:'等待裝置啟動'}).first().waitFor();assert.equal(await page.evaluate(()=>window.framesSent),0);await page.evaluate(()=>window.fixture.devices.forEach(d=>d.booted=true));await page.getByRole('button',{name:'重新整理',exact:true}).click();await page.getByRole('img').first().waitFor();await page.waitForFunction(()=>window.framesSent>=2);await page.getByRole('button',{name:'全螢幕操作',exact:true}).first().click();await page.getByRole('button',{name:'離開全螢幕',exact:true}).waitFor();assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true);await page.getByRole('button',{name:'離開全螢幕',exact:true}).click();await page.waitForFunction(()=>!document.fullscreenElement);assert.ok((await page.getByRole('img').first().boundingBox()).height>384);assert.equal(await page.getByRole('button',{name:'更新畫面',exact:true}).count(),0);await page.getByRole('button',{name:'暫停串流',exact:true}).first().click();await page.waitForFunction(()=>window.streamClosed>0);await page.getByRole('button',{name:'恢復串流',exact:true}).first().click();await page.getByRole('status').filter({hasText:'串流中'}).first().waitFor();await page.getByRole('button',{name:'主畫面',exact:true}).first().click();await page.waitForFunction(()=>window.calls.some(c=>c.payload.type==='key'&&c.payload.keycode===3));
await page.getByRole('button',{name:/點擊裝置畫面/}).first().press('Enter');await page.waitForFunction(()=>window.calls.some(c=>c.payload.type==='touch'&&c.payload.action===1));
const bounds=await page.getByRole('img').first().boundingBox();
await page.mouse.move(bounds.x+bounds.width/2+50,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width/2-50,bounds.y+bounds.height/2,{steps:6});await page.mouse.up();await page.waitForFunction(()=>window.calls.some(c=>c.payload.type==='touch'&&c.payload.action===2));
await page.getByRole('button',{name:/點擊裝置畫面/}).first().press('ArrowUp');await page.waitForFunction(()=>window.calls.some(c=>c.payload.type==='key'&&c.payload.keycode===19));
for(const width of [320,390,1280]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>{document.activeElement?.blur();document.querySelectorAll('.overflow-x-auto').forEach(el=>el.scrollLeft=0);});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('*')).filter(e=>e.getBoundingClientRect().right>innerWidth).filter(e=>!e.closest('.overflow-x-auto')).map(e=>[e.tagName,e.className,e.getBoundingClientRect().right]))));}
for(const count of [3,4]){
 await page.evaluate(count=>{window.fixture.devices=Array.from({length:count},(_,i)=>({serial:'emulator-'+(5554+i*2),state:'device',booted:true,managed:true,canControl:true,avd:'Pixel',error:''}));},count);
 await page.getByRole('button',{name:'重新整理',exact:true}).click();
 await page.waitForFunction(count=>document.querySelectorAll('canvas').length===count,count);
 assert.equal(await page.getByRole('navigation',{name:'Android 導覽',exact:true}).count(),count);
 const tops=await page.locator('section[aria-label$=" 手機"]').evaluateAll(nodes=>nodes.map(node=>Math.round(node.getBoundingClientRect().top)));assert.equal(new Set(tops).size,1,'all phones must remain in one row');
 for(let i=0;i<count;i++){
  const phone=page.getByRole('region',{name:'emulator-'+(5554+i*2)+' 手機',exact:true});
  await phone.getByRole('button',{name:'主畫面',exact:true}).waitFor({state:'visible'});
  await page.waitForFunction(serial=>Array.from(document.querySelectorAll('section')).find(s=>s.getAttribute('aria-label')===serial+' 手機')?.querySelector('nav button')?.disabled===false,'emulator-'+(5554+i*2));
  await phone.getByRole('button',{name:'主畫面',exact:true}).click();
  assert.equal(await page.evaluate(serial=>window.calls.some(c=>c.path?.includes(serial)&&c.payload.type==='key'&&c.payload.keycode===3),'emulator-'+(5554+i*2)),true);
 }
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>{document.activeElement?.blur();document.querySelectorAll('.overflow-x-auto').forEach(el=>el.scrollLeft=0);});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,JSON.stringify(await page.evaluate(()=>[innerWidth,document.documentElement.scrollWidth,document.body.scrollWidth])));}
}
await page.evaluate(()=>window.fixture.devices=window.fixture.devices.slice(0,2));await page.getByRole('button',{name:'重新整理',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('canvas').length===2);
console.log('PASS three/four simultaneous phones, independent Android navigation and responsive overflow');
await page.getByRole('button',{name:'停止裝置',exact:true}).first().click();await page.getByRole('img',{name:'emulator-5556 實際裝置畫面',exact:true}).waitFor();
await page.evaluate(()=>window.fixture.devices[0].canControl=false);await page.getByRole('button',{name:'重新整理',exact:true}).click();await page.getByRole('button',{name:'停止裝置',exact:true}).first().waitFor();await page.waitForFunction(()=>document.querySelector('button')&&Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='停止裝置')?.disabled);assert.equal(await page.getByRole('button',{name:'主畫面',exact:true}).first().isDisabled(),true);
await page.getByRole('button',{name:/選擇 Flow Case/}).waitFor();const before=await page.getByRole('img').first().boundingBox();await page.getByRole('button',{name:/選擇 Flow Case/}).click();const after=await page.getByRole('img').first().boundingBox();assert.equal(before.y,after.y);await page.keyboard.press('Escape');assert.equal(await page.getByRole('button',{name:/選擇 Flow Case/}).getAttribute('aria-expanded'),'false');assert.equal(await page.getByRole('button',{name:'前往案例撰寫'}).count(),0);assert.equal(await page.getByRole('button',{name:'編輯',exact:true}).count(),0);
await page.getByRole('button',{name:'Web Playwright',exact:true}).click();assert.equal(await page.getByRole('button',{name:'使用名片交換範本'}).count(),0);await page.getByRole('button',{name:'新增流程',exact:true}).click();await page.getByLabel('網站網址').waitFor();assert.equal(await page.getByLabel('Android 套件名稱').count(),0);
await page.getByRole('button',{name:'Android Appium',exact:true}).click();await page.getByText('臨時模擬器',{exact:true}).click();await page.evaluate(()=>window.fail=true);await page.getByRole('button',{name:'重新整理',exact:true}).click();await page.getByRole('alert').first().waitFor();assert.equal(await page.getByRole('button',{name:'啟動模擬器',exact:true}).isDisabled(),true);assert.equal(await page.locator('canvas').count(),0);assert.deepEqual(errors,[]);
console.log('PASS split pages, keyboard count selection, two-device launch payload, screen, home/tap, stop, ownership, offline restrictions, inline flow selection and responsive overflow (mock executor only).');
}finally{await browser.close();}
