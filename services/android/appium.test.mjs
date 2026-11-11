import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFlow } from './flow-contract.mjs';
import { createAppium } from './appium.mjs';
import { randomUUID } from 'node:crypto';
import {createHash} from 'node:crypto';
const dualFlow = { appPackage: 'com.android.settings', actors: ['sender','receiver'], steps: [
  { name: '發出交換', actor: 'sender', action: 'click', using: 'id', value: 'send' },
  { name: '等待邀請', actor: 'receiver', action: 'assertVisible', using: 'id', value: 'invitation' },
  { name: '接受交換', actor: 'receiver', action: 'click', using: 'id', value: 'accept' },
  { name: '確認收錄', actor: 'sender', action: 'assertText', using: 'id', value: 'result', text: '已收錄' },
] };
test('all session entry points reduce idle wait and disable animations without clearing app data', async () => {
  const calls = [];
  const bridge = { status: async () => ({ devices: [{ serial: 'emulator-5554', booted: true }] }), input: async () => ({ accepted: true }) };
  const app = createAppium(bridge, { fetch: async (url, options = {}) => {
    const body = options.body && JSON.parse(options.body); calls.push({ url, body, method: options.method });
    const value = url.endsWith('/status') ? { ready: true } : url.endsWith('/session') ? { sessionId: 'performance' } : url.endsWith('/source') ? '<hierarchy/>' : url.endsWith('/current_package') ? 'com.android.settings' : {};
    return new Response(JSON.stringify({ value }));
  } });
  await app.captureAfterTap('emulator-5554', { action: 'tapObserved' });
  await app.explore('emulator-5554', 'performance', { kind: 'observe' });
  await app.closeExplorer('emulator-5554', 'performance');
  const result = await app.run('emulator-5554', { appPackage: 'com.android.settings', steps: [{ name: '確認前景', action: 'assertAppForeground' }] });
  assert.equal(result.status, 'passed');
  const sessions = calls.filter(call => call.url.endsWith('/session') && call.method === 'POST');
  assert.equal(sessions.length, 3);
  for (const { body } of sessions) {
    assert.equal(body.capabilities.alwaysMatch['appium:disableWindowAnimation'], true);
    assert.equal(body.capabilities.alwaysMatch['appium:noReset'], true);
    assert.equal(body.capabilities.alwaysMatch['appium:fullReset'], false);
  }
  const settings = calls.filter(call => call.url.endsWith('/appium/settings'));
  assert.equal(settings.length, 3);
  assert.ok(settings.every(call => call.body.settings.waitForIdleTimeout === 1000));
});

test('performance setup failure prevents device actions and cleans the created session', async () => {
  let taps = 0, deleted = 0;
  const app = createAppium({ status: async () => ({ devices: [{ serial: 'emulator-5554', booted: true }] }), input: async () => { taps++; } }, {
    fetch: async (url, options = {}) => {
      if (options.method === 'DELETE') deleted++;
      return new Response(JSON.stringify({ value: url.endsWith('/status') ? { ready: true } : url.endsWith('/session') ? { sessionId: 'performance' } : url.endsWith('/appium/settings') ? { error: 'unknown error' } : {} }));
    },
  });
  await assert.rejects(app.captureAfterTap('emulator-5554', {}), /Appium/);
  assert.equal(taps, 0); assert.equal(deleted, 1); assert.equal(app.busy('emulator-5554'), false);
});

test('toast observation starts a session before one tap and reads source before cleanup',async()=>{
 const events=[];
 const app=createAppium({status:async()=>({devices:[{serial:'emulator-5554',booted:true}]}),input:async()=>{events.push('tap');return {accepted:true};}},{fetch:async(url,options={})=>{
  if(url.endsWith('/status'))return new Response(JSON.stringify({value:{ready:true}}));
  if(url.endsWith('/session')&&options.method==='POST'){events.push('session');return new Response(JSON.stringify({value:{sessionId:'explore'}}));}
  if(url.endsWith('/source')){events.push('source');return new Response(JSON.stringify({value:'<hierarchy><node text="提示"/></hierarchy>'}));}
  if(options.method==='DELETE')events.push('delete');
  return new Response(JSON.stringify({value:{}}));
 }});
 const result=await app.captureAfterTap('emulator-5554',{action:'tapObserved'});
 assert.match(result.xml,/提示/);assert.deepEqual(events,['session','tap','source','delete']);assert.equal(app.busy('emulator-5554'),false);
});
test('agent tools share a session, fill Unicode, capture the result and release on pause',async()=>{
 const calls=[];const xml='<hierarchy><android.widget.EditText resource-id="name" class="android.widget.EditText" text="" enabled="true" password="false"/></hierarchy>';
 const app=createAppium({status:async()=>({devices:[{serial:'emulator-5554',booted:true}]})},{fetch:async(url,options={})=>{
  const body=options.body&&JSON.parse(options.body);calls.push({url,body,method:options.method});
  const value=url.endsWith('/status')?{ready:true}:url.endsWith('/session')?{sessionId:'agent'}:url.endsWith('/source')?xml:url.endsWith('/elements')?[{'element-6066-11e4-a52e-4f735466cecf':'name'}]:url.endsWith('/enabled')||url.endsWith('/displayed')?true:url.endsWith('/attribute/password')?'false':{};
  return new Response(JSON.stringify({value}));
 }});
 const first=await app.explore('emulator-5554','task-a',{kind:'observe'});assert.equal(app.exploreFor('emulator-5554'),'task-a');
 await assert.rejects(app.explore('emulator-5554','task-b',{kind:'observe'}),/其他工作/);
 await app.explore('emulator-5554','task-a',{kind:'type',locator:{kind:'id',value:'name'},text:'測試姓名',clear:true,fingerprint:first.fingerprint});
 await app.explore('emulator-5554','task-a',{kind:'tap',locator:{kind:'ref',value:'e2'},fingerprint:first.fingerprint});
 assert.equal(calls.filter(call=>call.url.endsWith('/session')&&call.method==='POST').length,1);
 assert.equal(calls.find(call=>call.url.endsWith('/value')).body.text,'測試姓名');
 assert.ok(calls.some(call=>call.url.endsWith('/clear')));assert.ok(calls.some(call=>call.body?.settings?.enableNotificationListener));
 assert.ok(first.xml.includes('agent-ref="e2"'));assert.ok(calls.some(call=>call.body?.value==='(//*)[2]'));
 await app.closeExplorer('emulator-5554','task-a');assert.equal(app.busy('emulator-5554'),false);assert.equal(calls.filter(call=>call.method==='DELETE').length,1);
});
test('stale agent targets are reported as not dispatched and never clicked',async()=>{
 const xml='<hierarchy><node resource-id="button" enabled="true"/></hierarchy>';let clicked=0;
 const app=createAppium({status:async()=>({devices:[{serial:'emulator-5554',booted:true}]})},{fetch:async(url,options={})=>{
  if(url.endsWith('/click'))clicked++;return new Response(JSON.stringify({value:url.endsWith('/status')?{ready:true}:url.endsWith('/session')?{sessionId:'agent'}:url.endsWith('/source')?xml:{}}));
 }});
 const old=createHash('sha256').update('old').digest('hex');await assert.rejects(app.explore('emulator-5554','task',{kind:'tap',locator:{kind:'id',value:'button'},fingerprint:old}),error=>error.notDispatched===true);assert.equal(clicked,0);assert.equal(app.busy('emulator-5554'),false);
});

test('agent reads a native screen larger than 60000 characters without rejecting it',async()=>{
 const xml='<hierarchy>'+Array.from({length:450},(_,i)=>`<android.widget.TextView class="android.widget.TextView" text="項目 ${i}" resource-id="row-${i}" enabled="true" displayed="true" bounds="[0,0][100,100]"/>`).join('')+'</hierarchy>';
 assert.ok(xml.length>60000);
 const app=createAppium({status:async()=>({devices:[{serial:'emulator-5554',booted:true}]})},{fetch:async(url)=>new Response(JSON.stringify({value:url.endsWith('/status')?{ready:true}:url.endsWith('/session')?{sessionId:'large'}:url.endsWith('/source')?xml:{}}))});
 const observed=await app.explore('emulator-5554','task',{kind:'observe'});
 assert.match(observed.xml,/項目 449/);assert.match(observed.xml,/agent-ref="e451"/);
 await app.closeExplorer('emulator-5554','task');assert.equal(app.busy('emulator-5554'),false);
});

test('failed read is proven unsent, closes its session and permits a fresh observation',async()=>{
 let reads=0,sessions=0,clicks=0;
 const app=createAppium({status:async()=>({devices:[{serial:'emulator-5554',booted:true}]})},{fetch:async(url)=>{
  if(url.endsWith('/click'))clicks++;
  return new Response(JSON.stringify({value:url.endsWith('/status')?{ready:true}:url.endsWith('/session')?{sessionId:'read-'+(++sessions)}:url.endsWith('/source')?(++reads===1?'':'<hierarchy/>'):{}}));
 }});
 await assert.rejects(app.explore('emulator-5554','task',{kind:'observe'}),error=>error.notDispatched===true);
 assert.equal(app.busy('emulator-5554'),false);
 assert.match((await app.explore('emulator-5554','task',{kind:'observe'})).xml,/<hierarchy/);
 assert.equal(sessions,2);assert.equal(clicks,0);await app.closeExplorer('emulator-5554','task');
});

test('long press opens the account menu once and returns a replayable step without deleting it',async()=>{
 let menu=false;const calls=[];
 const app=createAppium({status:async()=>({devices:[{serial:'emulator-5554',booted:true}]})},{sleep:async()=>{},fetch:async(url,options={})=>{
  const body=options.body&&JSON.parse(options.body);calls.push({url,body});
  if(body?.script==='mobile: longClickGesture')menu=true;
  const xml=`<hierarchy><android.widget.TextView class="android.widget.TextView" resource-id="account" text="DemoAccount" enabled="true"/>${menu?'<android.widget.TextView resource-id="delete" text="刪除帳號" enabled="true"/>':''}</hierarchy>`;
  const value=url.endsWith('/status')?{ready:true}:url.endsWith('/session')?{sessionId:'long'}:url.endsWith('/source')?xml:url.endsWith('/elements')?[{'element-6066-11e4-a52e-4f735466cecf':'account-element'}]:url.endsWith('/enabled')||url.endsWith('/displayed')?true:{};
  return new Response(JSON.stringify({value}));
 }});
 const before=await app.explore('emulator-5554','task',{kind:'observe'});
 const result=await app.explore('emulator-5554','task',{kind:'longPress',locator:{kind:'text',value:'DemoAccount'},durationMs:900,fingerprint:before.fingerprint});
 assert.match(result.xml,/刪除帳號/);assert.deepEqual(result.replayStep,{name:'長按目標',action:'longPress',using:'id',value:'account',durationMs:900});
 assert.equal(calls.filter(call=>call.body?.script==='mobile: longClickGesture').length,1);assert.equal(calls.some(call=>call.url.endsWith('/click')),false);
 assert.deepEqual(calls.find(call=>call.body?.script==='mobile: longClickGesture').body.args,[{elementId:'account-element',duration:900}]);await app.closeExplorer('emulator-5554','task');
});

test('delayed Toast is captured by read-only polling without resending the click',async()=>{
 let clicked=false,reads=0,clicks=0;
 const app=createAppium({status:async()=>({devices:[{serial:'emulator-5554',booted:true}]})},{sleep:async()=>{},fetch:async(url)=>{
  if(url.endsWith('/click')){clicked=true;clicks++;}
  const xml='<hierarchy><node resource-id="login" enabled="true"/>'+(clicked&&++reads>=3?'<android.widget.Toast text="請先同意服務條款"/>':'')+'</hierarchy>';
  return new Response(JSON.stringify({value:url.endsWith('/status')?{ready:true}:url.endsWith('/session')?{sessionId:'toast'}:url.endsWith('/source')?xml:url.endsWith('/elements')?[{'element-6066-11e4-a52e-4f735466cecf':'button'}]:url.endsWith('/enabled')||url.endsWith('/displayed')?true:{}}));
 }});
 const before=await app.explore('emulator-5554','task',{kind:'observe'});
 const result=await app.explore('emulator-5554','task',{kind:'tap',locator:{kind:'id',value:'login'},fingerprint:before.fingerprint});
 assert.equal(clicks,1);assert.match(result.xml,/android.widget.Toast/);await app.closeExplorer('emulator-5554','task');
});

test('visual coordinate actions require the matching screenshot and use normalized device coordinates',async()=>{
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',calls=[];
 const app=createAppium({status:async()=>({devices:[{serial:'emulator-5554',booted:true}]})},{sleep:async()=>{},fetch:async(url,options={})=>{
  const body=options.body&&JSON.parse(options.body);calls.push({url,body});
  return new Response(JSON.stringify({value:url.endsWith('/status')?{ready:true}:url.endsWith('/session')?{sessionId:'visual'}:url.endsWith('/source')?'<hierarchy><node enabled="true"/></hierarchy>':url.endsWith('/screenshot')?png:url.endsWith('/window/rect')?{width:400,height:800}:{}}));
 }});
 let before=await app.explore('emulator-5554','task',{kind:'observe',includeScreenshot:true});
 await assert.rejects(app.explore('emulator-5554','task',{kind:'tapPoint',x:.25,y:.5,includeScreenshot:true,fingerprint:before.fingerprint,imageFingerprint:'old'}),error=>error.notDispatched===true);
 assert.equal(calls.some(call=>call.body?.script==='mobile: clickGesture'),false);
 before=await app.explore('emulator-5554','task',{kind:'observe',includeScreenshot:true});
 const result=await app.explore('emulator-5554','task',{kind:'tapPoint',x:.25,y:.5,includeScreenshot:true,fingerprint:before.fingerprint,imageFingerprint:before.imageFingerprint});
 assert.deepEqual(calls.find(call=>call.body?.script==='mobile: clickGesture').body.args,[{x:100,y:400}]);assert.equal(result.replayStep.action,'tapPoint');await app.closeExplorer('emulator-5554','task');
});
test('Open-app flow activates the package then checks foreground without inventing UI locators', async () => {
  const definition=parseFlow(`export const flow={appPackage:'jp.naver.line.android',steps:[{name:'LINE in foreground',action:'assertAppForeground'}]} as const`);
  const calls=[];let count=0;
  const app=createAppium({status:async()=>({devices:[{serial:'emulator-5554',booted:true}]})},{fetch:async(url,options={})=>{
    calls.push({url,body:options.body&&JSON.parse(options.body)});
    const value=url.endsWith('/status')?{ready:true}:url.endsWith('/session')?{sessionId:'line'}:url.endsWith('/current_package')?(++count===1?'com.android.launcher3':'jp.naver.line.android'):{};
    return new Response(JSON.stringify({value}));
  }});
  assert.equal((await app.run('emulator-5554',definition)).status,'passed');
  assert.equal(count,2);assert.equal(calls.some(call=>call.url.endsWith('/elements')),false);
  assert.equal(calls.find(call=>call.body?.script)?.body.args[0].appId,'jp.naver.line.android');
});
test('Dual flow requires explicit actors and assertions on both phones', () => {
  assert.equal(parseFlow(`export const flow=${JSON.stringify(dualFlow)} as const`).actors.length, 2);
  for (const change of [ { steps: dualFlow.steps.map(({actor,...step}) => step) }, { actors: ['sender'] }, { steps: dualFlow.steps.filter(step => step.actor === 'sender') } ]) assert.throws(() => parseFlow(`export const flow=${JSON.stringify({...dualFlow,...change})}`));
});
test('Dual sessions route interleaved steps, wait for actual state and clean both sessions', async () => {
  const calls = []; let id = 0, visible = 0;
  const fetch = async (url, options = {}) => {
    const body = options.body && JSON.parse(options.body); calls.push({url,body,method:options.method});
    let value = {};
    if (url.endsWith('/status')) value = {ready:true};
    if (url.endsWith('/session')) value = {sessionId:`s${++id}`};
    if (url.endsWith('/elements')) value = [{'element-6066-11e4-a52e-4f735466cecf':'e'}];
    if (url.endsWith('/displayed')) value = ++visible > 1;
    if (url.endsWith('/enabled')) value = true;
    if (url.endsWith('/text')) value = '已收錄';
    return new Response(JSON.stringify({value}));
  };
  const app = createAppium({status:async()=>({devices:['emulator-5554','emulator-5556'].map(serial=>({serial,booted:true}))})},{fetch});
  const result = await app.run({sender:'emulator-5554',receiver:'emulator-5556'},dualFlow);
  assert.equal(result.status,'passed'); assert.ok(visible > 2);
  const targets=calls.filter(c=>c.url.endsWith('/elements')).map(c=>[c.url.split('/session/')[1].split('/')[0],c.body.value]);
  assert.deepEqual(targets.filter((value,index)=>!index||JSON.stringify(value)!==JSON.stringify(targets[index-1])),[['s1','send'],['s2','invitation'],['s2','accept'],['s1','result']]);
  const caps=calls.filter(c=>c.body?.capabilities).map(c=>c.body.capabilities.alwaysMatch);
  assert.notEqual(caps[0]['appium:systemPort'],caps[1]['appium:systemPort']);
  assert.deepEqual(caps.map(c=>c['appium:udid']),['emulator-5554','emulator-5556']);
  assert.equal(calls.filter(c=>c.method==='DELETE').length,2);
  assert.equal(app.busy('emulator-5554'),false); assert.equal(app.busy('emulator-5556'),false);
});
test('Second session creation failure cleans first session and releases both locks', async () => {
  let count=0,deleted=0;
  const app=createAppium({status:async()=>({devices:['emulator-5554','emulator-5556'].map(serial=>({serial,booted:true}))})},{fetch:async(url,options={})=>{
    if(options.method==='DELETE')deleted++;
    if(url.endsWith('/session')&&++count===2)return new Response(JSON.stringify({value:{error:'session not created'}}),{status:500});
    return new Response(JSON.stringify({value:url.endsWith('/status')?{ready:true}:url.endsWith('/session')?{sessionId:'first'}:{}}));
  }});
  assert.equal((await app.run({sender:'emulator-5554',receiver:'emulator-5556'},dualFlow)).status,'failed');
  assert.equal(deleted,1); assert.equal(app.busy('emulator-5556'),false);
  await assert.rejects(app.run({sender:'emulator-5554',receiver:'emulator-5554'},dualFlow));
});
test('Flow parser accepts data definitions and rejects execution, imports and fake no-assert passes', () => {
  assert.equal(parseFlow(`export const flow={appPackage:'com.android.settings',steps:[{name:'畫面',action:'assertVisible',using:'id',value:'android:id/content'}]} as const;`).steps.length, 1);
  for (const source of ["export const flow=process.exit();", "import fs from 'node:fs'; export const flow={};", "export const flow={appPackage:'com.a',steps:[{name:'按',action:'back'}]};", "export const flow={...globalThis};", "export const flow={appPackage:'com.a',steps:[],appPackage:'com.b'};"]) assert.throws(() => parseFlow(source));
});
test('Appium runner checks assertions and deletes session on failure without resetting app data', async () => {
  const calls = [];
  const fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : undefined; calls.push({ url, options, body });
    let value = {};
    if (url.endsWith('/status')) value = { ready: true };
    if (url.endsWith('/session')) value = { sessionId: 'real-protocol-fixture' };
    if (url.endsWith('/elements')) value = [{ 'element-6066-11e4-a52e-4f735466cecf': 'element' }];
    if (url.endsWith('/text')) value = 'different';
    return new Response(JSON.stringify({ value }));
  };
  const app = createAppium({ status: async () => ({ devices: [{ serial: 'emulator-5554', booted: true }] }) }, { fetch });
  const result = await app.run('emulator-5554', { appPackage: 'com.example.app', steps: [{ name: '檢查文字', action: 'assertText', using: 'id', value: 'id', text: 'expected' }] });
  assert.equal(result.status, 'failed'); assert.equal(result.steps[0].status, 'failed');
  assert.ok(calls.some(call => call.options.method === 'DELETE'));
  const capabilities = calls.find(call => call.body?.capabilities).body.capabilities.alwaysMatch;
  assert.equal(capabilities['appium:noReset'], true); assert.equal(capabilities['appium:fullReset'], false);
  assert.equal(capabilities['appium:skipLogcatCapture'], true);
  assert.ok(!JSON.stringify(result).includes('different'));
});

test('Ambiguous locators fail before clicking and release the session', async () => {
  let clicked=false, deleted=false;
  const app=createAppium({status:async()=>({devices:[{serial:'emulator-5554',booted:true}]})},{fetch:async(url,options={})=>{
    if(url.endsWith('/click'))clicked=true;
    if(options.method==='DELETE')deleted=true;
    const value=url.endsWith('/status')?{ready:true}:url.endsWith('/session')?{sessionId:'ambiguous'}:url.endsWith('/elements')?[{'element-6066-11e4-a52e-4f735466cecf':'a'},{'element-6066-11e4-a52e-4f735466cecf':'b'}]:{};
    return new Response(JSON.stringify({value}));
  }});
  const result=await app.run('emulator-5554',{appPackage:'jp.naver.line.android',steps:[{name:'點好友',action:'click',using:'id',value:'row'},{name:'確認前景',action:'assertAppForeground'}]});
  assert.equal(result.status,'failed');assert.match(result.message,/符合多個元件/);
  assert.equal(clicked,false);assert.equal(deleted,true);assert.equal(app.busy('emulator-5554'),false);
});

function batchFixture({ttl=30000,failDelete=false}={}) {
  const calls=[];let sessions=0,foreground='com.example.app';
  const app=createAppium({status:async()=>({devices:['emulator-5554','emulator-5556'].map(serial=>({serial,booted:true}))})},{leaseTtlMs:ttl,fetch:async(url,options={})=>{
    const body=options.body&&JSON.parse(options.body);calls.push({url,method:options.method,body});
    if(options.method==='DELETE'&&failDelete)return new Response(JSON.stringify({value:{error:'connection failed'}}),{status:500});
    const value=url.endsWith('/status')?{ready:true}:url.endsWith('/session')?{sessionId:'s'+(++sessions)}:url.endsWith('/current_package')?foreground:{};
    return new Response(JSON.stringify({value}));
  }});
  return {app,calls,setForeground:value=>{foreground=value;}};
}
const batchFlow={appPackage:'com.example.app',steps:[{name:'前景',action:'assertAppForeground',timeoutMs:0}]};
test('successful consecutive cases in the same batch reuse a session and close it after the last case',async()=>{
 const f=batchFixture(),batchId=randomUUID();
 const first=await f.app.run('emulator-5554',batchFlow,undefined,{}, {id:batchId,owner:'alice',keep:true});
 assert.equal(first.status,'passed');assert.equal(f.app.busy('emulator-5554'),true);assert.equal(f.app.leaseFor('emulator-5554'),batchId);
 assert.equal(f.calls.filter(c=>c.method==='DELETE').length,0);
 const second=await f.app.run('emulator-5554',batchFlow,undefined,{}, {id:batchId,owner:'alice',keep:false});
 assert.equal(second.status,'passed');assert.equal(f.calls.filter(c=>c.url.endsWith('/session')).length,1);
 assert.equal(f.calls.filter(c=>c.body?.script==='mobile: activateApp').length,2);
 assert.equal(f.calls.filter(c=>c.method==='DELETE').length,1);assert.equal(f.app.busy('emulator-5554'),false);
 assert.equal(f.app.leaseFor('emulator-5554'),undefined);
});
test('case variables are not shared across reused sessions',async()=>{
 const f=batchFixture(),batchId=randomUUID();
 const first={appPackage:'com.example.app',variables:{privateValue:'from-first'},steps:[batchFlow.steps[0]]};
 assert.equal((await f.app.run('emulator-5554',first,undefined,{}, {id:batchId,owner:'alice',keep:true})).status,'passed');
 const second={appPackage:'com.example.app',steps:[{name:'檢查變數',action:'assert',condition:{kind:'variable',variable:'privateValue',equals:'from-first'},timeoutMs:0}]};
 const result=await f.app.run('emulator-5554',second,undefined,{}, {id:batchId,owner:'alice',keep:false});
 assert.equal(result.status,'failed');assert.match(result.message,/未定義的變數/);
 assert.equal(f.calls.filter(c=>c.url.endsWith('/session')).length,1);assert.equal(f.app.busy('emulator-5554'),false);
});
test('failed case closes the session and cannot be reused; next case starts a new session',async()=>{
 const f=batchFixture(),batchId=randomUUID();f.setForeground('com.other.app');
 const first=await f.app.run('emulator-5554',batchFlow,undefined,{}, {id:batchId,owner:'alice',keep:true});
 assert.equal(first.status,'failed');assert.equal(f.app.busy('emulator-5554'),false);assert.equal(f.app.leaseFor('emulator-5554'),undefined);
 f.setForeground('com.example.app');const second=await f.app.run('emulator-5554',batchFlow,undefined,{}, {id:batchId,owner:'alice',keep:false});
 assert.equal(second.status,'passed');assert.equal(f.calls.filter(c=>c.url.endsWith('/session')).length,2);
 assert.equal(f.calls.filter(c=>c.method==='DELETE').length,2);
});
test('a failure in the second case closes the reused session immediately',async()=>{
 const f=batchFixture(),batchId=randomUUID();
 await f.app.run('emulator-5554',batchFlow,undefined,{}, {id:batchId,owner:'alice',keep:true});
 f.setForeground('com.other.app');const second=await f.app.run('emulator-5554',batchFlow,undefined,{}, {id:batchId,owner:'alice',keep:true});
 assert.equal(second.status,'failed');assert.equal(f.calls.filter(c=>c.url.endsWith('/session')).length,1);
 assert.equal(f.calls.filter(c=>c.method==='DELETE').length,1);assert.equal(f.app.busy('emulator-5554'),false);
});
test('a different batch cannot use a leased device and an abandoned lease expires',async()=>{
 const f=batchFixture({ttl:30}),batchId=randomUUID();
 assert.equal((await f.app.run('emulator-5554',batchFlow,undefined,{}, {id:batchId,owner:'alice',keep:true})).status,'passed');
 await assert.rejects(f.app.run('emulator-5554',batchFlow,undefined,{}, {id:randomUUID(),owner:'alice',keep:false}),/裝置正在執行/);
 await new Promise(resolve=>setTimeout(resolve,80));
 assert.equal(f.app.busy('emulator-5554'),false);assert.equal(f.calls.filter(c=>c.method==='DELETE').length,1);
});
test('identical batch identifiers from different owners never share or evict a lease',async()=>{
 const f=batchFixture(),batchId=randomUUID();
 await f.app.run('emulator-5554',batchFlow,undefined,{}, {id:batchId,owner:'alice',keep:true});
 await assert.rejects(f.app.run('emulator-5554',batchFlow,undefined,{}, {id:batchId,owner:'bob',keep:false}),/裝置正在執行/);
 assert.equal((await f.app.run('emulator-5556',batchFlow,undefined,{}, {id:batchId,owner:'bob',keep:false})).status,'passed');
 assert.equal(f.app.leaseFor('emulator-5554'),batchId);
 assert.equal((await f.app.run('emulator-5554',batchFlow,undefined,{}, {id:batchId,owner:'alice',keep:false})).status,'passed');
 assert.equal(f.calls.filter(c=>c.url.endsWith('/session')).length,2);
});
test('an incompatible phone binding cleans the old lease and creates independent sessions',async()=>{
 const f=batchFixture(),batchId=randomUUID();
 await f.app.run('emulator-5554',batchFlow,undefined,{}, {id:batchId,owner:'alice',keep:true});
 const dual={appPackage:'com.example.app',actors:['sender','receiver'],steps:[{...batchFlow.steps[0],actor:'sender'},{...batchFlow.steps[0],actor:'receiver'}]};
 const result=await f.app.run({sender:'emulator-5554',receiver:'emulator-5556'},dual,undefined,{}, {id:batchId,owner:'alice',keep:false});
 assert.equal(result.status,'passed');assert.equal(f.calls.filter(c=>c.url.endsWith('/session')).length,3);
 assert.equal(f.calls.filter(c=>c.method==='DELETE').length,3);assert.equal(f.app.busy('emulator-5554'),false);assert.equal(f.app.busy('emulator-5556'),false);
});
test('unconfirmed cleanup blocks reuse instead of claiming the device is ready',async()=>{
 const f=batchFixture({ttl:20,failDelete:true}),batchId=randomUUID();
 await f.app.run('emulator-5554',batchFlow,undefined,{}, {id:batchId,owner:'alice',keep:true});
 await new Promise(resolve=>setTimeout(resolve,60));
 assert.equal(f.app.leaseFor('emulator-5554'),undefined);assert.equal(f.app.busy('emulator-5554'),true);
 await assert.rejects(f.app.run('emulator-5554',batchFlow),/裝置正在執行/);
});
test('executor shutdown closes idle batch sessions',async()=>{
 const f=batchFixture(),batchId=randomUUID();
 await f.app.run('emulator-5554',batchFlow,undefined,{}, {id:batchId,owner:'alice',keep:true});
 await f.app.close();
 assert.equal(f.calls.filter(c=>c.method==='DELETE').length,1);assert.equal(f.app.busy('emulator-5554'),false);
 await assert.rejects(f.app.run('emulator-5554',batchFlow),/裝置正在執行/);
});
test('exploration executes and records the requested small swipe and rejects offscreen areas',async()=>{
 const gestures=[];
 const app=createAppium({status:async()=>({devices:[{serial:'emulator-5554',booted:true}]})},{fetch:async(url,options={})=>{
  const body=options.body&&JSON.parse(options.body);if(body?.script==='mobile: swipeGesture')gestures.push(body.args[0]);
  const value=url.endsWith('/status')?{ready:true}:url.endsWith('/session')?{sessionId:'swipe'}:url.endsWith('/source')?'<hierarchy/>':url.endsWith('/window/rect')?{width:400,height:800}:{};
  return new Response(JSON.stringify({value}));
 }});
 const before=await app.explore('emulator-5554','swipe-task',{kind:'observe'});
 const area={left:.1,top:.3,width:.8,height:.4};
 const result=await app.explore('emulator-5554','swipe-task',{kind:'swipe',direction:'down',percent:.1,area,fingerprint:before.fingerprint});
 assert.deepEqual(gestures,[{left:40,top:240,width:320,height:320,direction:'down',percent:.1}]);
 assert.equal(result.replayStep.percent,.1);assert.deepEqual(result.replayStep.area,area);
 await assert.rejects(app.explore('emulator-5554','swipe-task',{kind:'swipe',direction:'up',area:{left:.9,top:0,width:.5,height:.5},fingerprint:result.fingerprint}),error=>error.notDispatched===true);
 assert.equal(gestures.length,1);await app.close();
});
