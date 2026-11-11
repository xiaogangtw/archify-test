import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { setImmediate as tick } from 'node:timers/promises';
import { registerAndroid } from '../src/android.ts';
import { memoryAndroidProfiles } from '../src/androidProfiles.ts';
import { memoryAndroidRuns } from '../src/androidRuns.ts';

test('Dual run locks both owned phones, freezes bindings, validates mode and unlocks after result', async () => {
  const app=Fastify(),profiles=memoryAndroidProfiles(),runs=memoryAndroidRuns(),session=randomUUID();
  const devices=[];
  for (const [serial,owner] of [['emulator-5554','alice'],['emulator-5556','alice'],['emulator-5558','bob']]) {
    const id=randomUUID(),avd=`Archify_Device_${id.replaceAll('-','')}`;
    await profiles.put({id,owner,name:serial,avd,state:'ready'});
    devices.push({serial,state:'device',booted:true,managed:true,avd,profileId:id,error:''});
  }
  const definition={appPackage:'com.android.settings',actors:['sender','receiver'],steps:['sender','receiver'].map(actor=>({actor,name:'visible',action:'assertVisible',using:'id',value:'android:id/content'}))};
  const source=`export const flow=${JSON.stringify(definition)} as const`;
  registerAndroid(app,profiles,{runs,script:async()=>({caseType:'flow',source,name:'Exchange',version:1})});
  const post=(url:string,body:any)=>app.inject({method:'POST',url,payload:body,headers:{'x-archify-user':'alice'}});
  const input={executionOrigin:'e2e-batch',batchId:randomUUID(),batchName:'E2E smoke',manualCommits:{frontend:'a'.repeat(40)},scriptId:'flow',scriptVersion:1,bindings:{sender:'emulator-5554',receiver:'emulator-5556'},requestId:randomUUID()};
  try {
    await post('/internal/android/status',{session,status:{sdk:{ready:true,path:'/sdk'},avds:devices.map(d=>d.avd),devices,appium:{reachable:true,ready:true,multiDevice:true},issues:[]}});
    assert.equal((await post('/api/android/runs',{...input,bindings:{sender:'emulator-5554',receiver:'emulator-5554'}})).statusCode,400);
    assert.equal((await post('/api/android/runs',{...input,bindings:{sender:'emulator-5554',receiver:'emulator-5558'}})).statusCode,403);
    assert.equal((await post('/api/android/runs',{scriptId:'flow',scriptVersion:1,serial:'emulator-5554',requestId:randomUUID()})).statusCode,400);
    const created=await post('/api/android/runs',input);assert.equal(created.statusCode,202);
    const row=created.json();assert.equal(row.batchName,input.batchName);assert.deepEqual(row.manualCommits,input.manualCommits);
    assert.equal(row.executionOrigin,'e2e-batch');assert.equal(row.testVersion,'ANDROID-BATCH-'+input.batchId);
    assert.equal((await post('/api/android/runs',{...input,executionOrigin:'appium'})).statusCode,409);
    assert.equal((await post('/api/android/runs',{...input,batchId:undefined,requestId:randomUUID()})).statusCode,400);
    const remove=(user='alice')=>app.inject({method:'DELETE',url:'/api/android/runs/'+row.id,headers:{'x-archify-user':user}});
    assert.equal((await remove()).statusCode,409);
    assert.equal((await remove('bob')).statusCode,404);
    assert.deepEqual(row.bindings,input.bindings);assert.equal(row.source,source);
    assert.equal((await post('/api/android/runs',input)).json().id,row.id);
    assert.equal((await post('/api/android/runs',{...input,bindings:{sender:'emulator-5556',receiver:'emulator-5554'}})).statusCode,409);
    for(const serial of Object.values(input.bindings)) {
      assert.equal((await post(`/api/android/devices/${serial}/input`,{action:'home'})).statusCode,409);
      assert.equal((await post(`/api/android/devices/${serial}/stop`,{})).statusCode,409);
    }
    const command=(await post('/internal/android/claim',{session})).json();assert.equal((await remove()).statusCode,409);assert.deepEqual(command.payload.bindings,input.bindings);
    await post(`/internal/android/result/${command.id}`,{session,result:{status:'passed',completed:2,steps:row.steps.map((step:any)=>({...step,status:'passed'})),message:'checked both'}});
    await tick();await tick();assert.equal((await runs.get(row.id))?.status,'passed');
    const status=(await app.inject({url:'/api/android/status',headers:{'x-archify-user':'alice'}})).json();
    assert.equal(status.devices.filter((d:any)=>Object.values(input.bindings).includes(d.serial)).every((d:any)=>d.canControl),true);
    assert.equal((await remove()).statusCode,200);
    assert.equal((await app.inject({url:'/api/android/runs/'+row.id,headers:{'x-archify-user':'alice'}})).statusCode,404);
    assert.equal((await runs.list('alice')).length,0);
    assert.equal((await remove()).statusCode,404);
    assert.equal((await post('/api/android/runs',input)).statusCode,409);
    assert.equal((await runs.find(input.requestId))?.source,source);

  }finally{await app.close();}
});
test('Appium executes immutable saved flow, fences device/user/session and never invents success', async () => {
  const app = Fastify(), profiles = memoryAndroidProfiles(), runs = memoryAndroidRuns(), profileId = randomUUID(), session = randomUUID();
  const avd = `Archify_Device_${profileId.replaceAll('-','')}`;
  const source = `export const flow={appPackage:'com.android.settings',steps:[{name:'visible',action:'assertVisible',using:'id',value:'android:id/content'}]} as const;`;
  await profiles.put({ id: profileId, owner: 'alice', name: 'A', avd, state: 'ready' });
  registerAndroid(app, profiles, { runs, script: async () => ({ id: 'flow', caseType: 'flow', source, name: 'Settings', version: 1 }) });
  const post = (url: string, body: any, user = 'alice') => app.inject({ method: 'POST', url, payload: body, headers: { 'x-archify-user': user } });
  try {
    await post('/internal/android/status', { session, status: { sdk: { ready: true, path: '/sdk' }, avds: [avd], devices: [{ serial: 'emulator-5554', state: 'device', booted: true, managed: true, avd, profileId, error: '' }], appium: { reachable: true, ready: true }, issues: [] } });
    const input = { batchId:randomUUID(), scriptId: 'flow', scriptVersion: 1, serial: 'emulator-5554', requestId: randomUUID() };
    assert.equal((await post('/api/android/runs', input, 'bob')).statusCode, 403);
    const created = await post('/api/android/runs', input); assert.equal(created.statusCode, 202);
    const run = created.json(); assert.equal(run.status, 'queued'); assert.equal(run.source, source);
    assert.equal(run.executionOrigin,'appium');assert.equal(run.batchId,input.batchId);assert.equal(run.testVersion,'ANDROID-'+run.id);
    assert.equal((await post('/api/android/runs', input)).json().id, run.id);
    assert.equal((await post('/api/android/devices/emulator-5554/input', { action: 'home' })).statusCode, 409);
    assert.equal((await post('/api/android/runs', { ...input, requestId: randomUUID() })).statusCode, 409);
    const command = (await post('/internal/android/claim', { session })).json(); assert.equal(command.action, 'appiumRun');
    assert.equal((await post(`/internal/android/progress/${run.id}`, { session: randomUUID(), completed: 0, steps: [] })).statusCode, 409);
    await post(`/internal/android/result/${command.id}`, { session, result: { status: 'passed', completed: 0, steps: [{ name: 'visible', status: 'pending' }], message: 'fake' } });
    await tick(); await tick(); assert.equal((await runs.get(run.id))?.status, 'failed');
    assert.equal((await app.inject({ url: `/api/android/runs/${run.id}`, headers: { 'x-archify-user': 'bob' } })).statusCode, 404);
  } finally { await app.close(); }
});

test('only the same owner and batch can continue a reserved Appium session', async () => {
  const app=Fastify(),profiles=memoryAndroidProfiles(),runs=memoryAndroidRuns(),session=randomUUID(),id=randomUUID(),batchId=randomUUID();
  const avd=`Archify_Device_${id.replaceAll('-','')}`;
  const device={serial:'emulator-5554',state:'device',booted:true,managed:true,avd,profileId:id,error:''};
  const status={sdk:{ready:true,path:'/sdk'},avds:[avd],devices:[device],appium:{reachable:true,ready:true,batchSessionReuse:true},issues:[]};
  const source=`export const flow={appPackage:'com.android.settings',steps:[{name:'前景',action:'assertAppForeground'}]} as const`;
  await profiles.put({id,owner:'alice',name:'手機',avd,state:'ready'});
  registerAndroid(app,profiles,{runs,script:async()=>({caseType:'flow',source,name:'案例',version:1})});
  const post=(url:string,body:any,user='alice')=>app.inject({method:'POST',url,payload:body,headers:{'x-archify-user':user}});
  try {
    await post('/internal/android/status',{session,status});
    assert.equal((await app.inject({url:'/api/android/status',headers:{'x-archify-user':'alice'}})).json().capabilities.batchSessionReuse,true);
    const first={batchId,batchContinue:true,scriptId:'flow',scriptVersion:1,serial:device.serial,requestId:randomUUID()};
    const firstResponse=await post('/api/android/runs',first);assert.equal(firstResponse.statusCode,202);
    const command=(await post('/internal/android/claim',{session})).json();
    assert.equal(command.payload.batchId,batchId);assert.equal(command.payload.batchOwner,'alice');assert.equal(command.payload.batchContinue,true);
    await post('/internal/android/status',{session,status:{...status,devices:[{...device,appiumBusy:true,appiumBatch:batchId}]}});
    await post('/internal/android/result/'+command.id,{session,result:{status:'passed',completed:1,steps:[{name:'前景',status:'passed'}],message:'完成'}});
    await tick();await tick();
    const aliceStatus=(await app.inject({url:'/api/android/status',headers:{'x-archify-user':'alice'}})).json();
    assert.equal(aliceStatus.devices[0].canControl,false);assert.equal(aliceStatus.devices[0].appiumBatch,batchId);
    const bobStatus=(await app.inject({url:'/api/android/status',headers:{'x-archify-user':'bob'}})).json();
    assert.equal(bobStatus.devices[0].appiumBatch,undefined);
    assert.equal((await post('/api/android/runs',{...first,batchId:randomUUID(),requestId:randomUUID()})).statusCode,503);
    assert.equal((await post('/api/android/runs',{...first,requestId:randomUUID()},'bob')).statusCode,403);
    assert.equal((await post('/api/android/devices/emulator-5554/input',{action:'home'})).statusCode,409);
    const second=await post('/api/android/runs',{...first,batchContinue:false,requestId:randomUUID()});assert.equal(second.statusCode,202);
    const secondCommand=(await post('/internal/android/claim',{session})).json();assert.equal(secondCommand.payload.batchId,batchId);assert.equal(secondCommand.payload.batchContinue,false);
    await post('/internal/android/result/'+secondCommand.id,{session,result:{status:'passed',completed:1,steps:[{name:'前景',status:'passed'}],message:'完成'}});
    await tick();await tick();
  }finally{await app.close();}
});
