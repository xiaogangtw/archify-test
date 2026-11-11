import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {writeFile,readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {fixture,request} from './test-support.mjs';
import {renderText} from '../../test-project/framework/text-report.mjs';
import {createWorkspace} from './workspace.mjs';
import {createHandler} from './plugin.mjs';
import {createAndroidHost} from './android-host.mjs';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j/p0AAAAASUVORK5CYII=';
const run=(project,args,env={})=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[join(project,'node_modules/@playwright/test/cli.js'),'test',...args],{cwd:project,windowsHide:true,env:{...process.env,...env}});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);child.once('error',reject);child.once('close',code=>resolve({code,output}));});

test('真實 Playwright 網頁同時斷言 HTTP 資料與 DOM，API／畫面分目錄單檔HTML及按需TXT，截圖選項生效',async()=>{
 const f=await fixture();const server=createServer((req,res)=>{if(req.url==='/data'){res.setHeader('Content-Type','application/json');res.end('{"id":7,"name":"Synthetic Card"}');}else{res.setHeader('Content-Type','text/html');res.end('<html><body><h1 id="name"></h1><script>fetch("/data").then(r=>r.json()).then(row=>document.querySelector("h1").textContent=row.name)</script></body></html>');}});
 try{await f.workspace.initialize();assert.equal((await f.workspace.reportSettings()).screenshots,true);await f.attachDependencies();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
  await writeFile(join(f.project,'tests/api/Synthetic.spec.ts'),"import {test,expect} from '@playwright/test';test('合成 API',async({request})=>{await test.step('驗證資料',async()=>{const response=await request.get(process.env.WEB_BASE_URL+'/data');expect((await response.json()).id).toBe(7);});});");
  await writeFile(join(f.project,'tests/ui/Synthetic.spec.ts'),"import {test,expect} from '../../support/web-test.js';test('合成畫面與資料',async({page})=>{await test.step('確認資料與 DOM',async()=>{const promise=page.waitForResponse(r=>r.url().endsWith('/data'));await page.goto('/');const response=await promise;expect(response.status()).toBe(200);const body=await response.json();expect(body.id).toBe(7);expect(body.name).toBe('Synthetic Card');await expect(page.locator('h1')).toHaveText('Synthetic Card');});});");
  let result=await run(f.project,[],{WEB_BASE_URL:base,ARCHIFY_SCREENSHOTS:'0'});assert.equal(result.code,0,result.output);
  let rows=await f.workspace.reports();assert.ok(rows.some(row=>row.name.startsWith('api/report-')));assert.ok(rows.some(row=>row.name.startsWith('ui/report-')));
  let report=await f.workspace.report(rows.find(row=>row.name.startsWith('ui/report-')).name);assert.equal(report.testType,'ui');assert.equal(report.cases[0].target,'web');assert.equal(report.cases[0].status,'passed');assert.ok(!report.cases[0].screenshots?.length);
  await writeFile(join(f.project,'config/report.json'),JSON.stringify({screenshots:true,androidSerial:''}));result=await run(f.project,['--project','web'],{WEB_BASE_URL:base});assert.equal(result.code,0,result.output);
  rows=await f.workspace.reports();const latest=rows.find(row=>row.name.startsWith('ui/report-'));report=await f.workspace.report(latest.name);assert.equal(report.cases[0].screenshots.length,2);assert.ok(report.cases[0].screenshots[0].data.startsWith('iVBOR'));
  assert.match(await readFile(join(f.project,'reports',latest.name.replace('.json','.html')),'utf8'),/data:image\/png;base64/);assert.ok(latest.name.endsWith('.html'));const related=(await readdir(join(f.project,'reports/ui'))).filter(name=>name.startsWith(latest.name.split('/').at(-1).replace(/\.html$/,'')));assert.equal(related.length,1);const txt=renderText(report);assert.match(txt,/合成畫面與資料/);assert.ok(!txt.includes('iVBOR'));
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await f.dispose();}
});

test('Android fixture 直接走 Appium W3C，保留資料並關閉 session，未勾截圖不呼叫 screenshot',async()=>{
 const f=await fixture();const calls=[];const server=createServer((req,res)=>{let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{calls.push({path:req.url,method:req.method,body:body?JSON.parse(body):null});const value=req.url==='/session'?{sessionId:'synthetic-session',capabilities:{}}:req.url.endsWith('/source')?'<hierarchy><node text="SYNTHETIC_PUSH"/></hierarchy>':req.url.endsWith('/screenshot')?png:null;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({value}));});});
 try{await f.workspace.initialize();await f.attachDependencies();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));await writeFile(join(f.project,'tests/mobile/Synthetic.spec.ts'),"import {test,expect} from '../../support/android-test.js';test('合成 Appium 連線',async({android})=>{await test.step('查看指定訊息',async()=>{expect(await android.source()).toContain('SYNTHETIC_PUSH');});});");
  const env={APPIUM_URL:'http://127.0.0.1:'+server.address().port,ANDROID_UDID:'emulator-5554',ARCHIFY_SCREENSHOTS:'0'};let result=await run(f.project,['--project','android'],env);assert.equal(result.code,0,result.output);assert.ok(!calls.some(row=>row.path.endsWith('/screenshot')));assert.equal(calls[0].body.capabilities.alwaysMatch['appium:noReset'],true);assert.equal(calls[0].body.capabilities.alwaysMatch['appium:fullReset'],false);assert.ok(calls.some(row=>row.method==='DELETE'));
  result=await run(f.project,['--project','android'],{...env,ARCHIFY_SCREENSHOTS:'1'});assert.equal(result.code,0,result.output);assert.equal(calls.filter(row=>row.path.endsWith('/screenshot')).length,1);
  const rows=await f.workspace.reports(),report=await f.workspace.report(rows.find(row=>row.name.startsWith('ui/report-')).name);assert.equal(report.cases[0].target,'android');assert.equal(report.cases[0].screenshots.length,1);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await f.dispose();}
});

test('本機環境啟動只接受既有 AVD，不清資料；設定保持 session 限制及 partial update',async()=>{
 const calls=[];let appium=false;const host=createAndroidHost({platformRoot:'C:/platform',androidSdk:'C:/sdk'},{exists:async()=>true,portFree:async()=>true,execute:async(_file,args)=>args[0]==='-list-avds'?'Phone_35\n':args[0]==='devices'?'List of devices attached\n':args[0]==='-accel-check'?'accel: 0\n':'',fetch:async()=>({ok:true,json:async()=>({value:{ready:appium}})}),launch:(file,args,options)=>{calls.push({file,args,options});const child=new EventEmitter();child.unref=()=>{};child.kill=()=>{};if(file===process.execPath)appium=true;return child;}});
 await assert.rejects(()=>host.start('Phone_35 --wipe-data'),/既有|存在/);await host.start('Phone_35');assert.ok(calls[0].args.includes('Phone_35'));assert.ok(!calls[0].args.includes('-wipe-data'));assert.ok(!calls[0].args.includes('-no-window'));assert.equal(calls[0].options.shell,false);await host.startAppium();assert.ok(calls[1].args.includes('127.0.0.1'));
 const f=await fixture();try{await f.workspace.initialize();const w=createWorkspace(f.config,{androidHost:{status:async()=>({devices:[{serial:'emulator-5554',booted:true}]})}}),handler=createHandler(w,'test-session');
  assert.equal((await request(handler,'/local-api/report-settings-save',{screenshots:true},{headers:{'x-archify-session':'bad'}})).status,403);
  await w.saveReportSettings({screenshots:true});await w.saveReportSettings({androidSerial:'emulator-5554'});assert.deepEqual(await w.reportSettings(),{screenshots:true,androidSerial:'emulator-5554'});await assert.rejects(()=>w.saveReportSettings({androidSerial:'emulator-9999'}),/就緒/);
  await assert.rejects(()=>w.report('../outside.json'),/檔名/);
 }finally{await f.dispose();}
});
