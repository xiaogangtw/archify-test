import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveFlowDependencies,dependencyKey} from './flow-dependencies.mjs';
import {parseFlow} from './flow-contract.mjs';
import {executeFlow} from './flow-engine.mjs';
const check={name:'前景檢查',action:'assertAppForeground',timeoutMs:0};
const base={appPackage:'com.example.app'};
const ref=(id='shared')=>({name:'共用登入',action:'callFlow',scriptId:id,scriptVersion:2});
const saved=flow=>({id:'shared',name:'共用',version:2,caseType:'flow',source:'export const flow='+JSON.stringify(flow)+' as const;'});
test('versioned shared flows are resolved, frozen and can be the actual main assertion',async()=>{
 const root=parseFlow(saved({...base,steps:[ref()]}).source);
 const shared=saved({...base,variables:{expected:'ok'},routines:{verify:[check]},steps:[{name:'共用檢查',action:'call',routine:'verify'}],after:[{name:'共用清理',action:'back'}]});
 const bundle=await resolveFlowDependencies(root,async(id,version)=>{assert.equal(id,'shared');assert.equal(version,2);return shared;});
 assert.equal(bundle.snapshots[0].source,shared.source);
 shared.source='changed after snapshot';
 const result=await executeFlow(root,{dependencies:bundle.definitions,execute:async path=>path.endsWith('/current_package')?'com.example.app':null,routeFor:()=>'/session/test'});
 assert.equal(result.status,'passed');assert.ok(result.trace.some(t=>t.path.includes('.flow.1.call.1')));
 assert.ok(result.trace.some(t=>t.name==='共用清理'&&t.phase==='after'));
});
test('shared references inside local routines resolve and reject missing versions, cycles',async()=>{
 const root=parseFlow(saved({...base,routines:{login:[ref()]},steps:[{name:'本地共用',action:'call',routine:'login'}]}).source);
 assert.equal((await resolveFlowDependencies(root,async()=>saved({...base,steps:[check]}))).snapshots.length,1);
 for(const load of [async()=>undefined,async()=>({...saved({...base,steps:[check]}),version:3}),async()=>saved({...base,steps:[ref()]})])await assert.rejects(resolveFlowDependencies(root,load));
 await assert.rejects(resolveFlowDependencies(root,async()=>saved({...base,steps:[check]}),dependencyKey('shared',2)));
});
test('single-phone shared flow binds to explicit dual actor, and unbound use is rejected',async()=>{
 const root=parseFlow(saved({...base,actors:['sender','receiver'],steps:[{...ref(),actor:'sender'},{...ref(),actor:'receiver'}]}).source);
 const bundle=await resolveFlowDependencies(root,async()=>saved({...base,steps:[check]}));
 const calls=[];const result=await executeFlow(root,{dependencies:bundle.definitions,execute:async path=>{calls.push(path);return 'com.example.app';},routeFor:role=>'/session/'+role});
 assert.equal(result.status,'passed');assert.ok(calls.includes('/session/sender/appium/device/current_package'));assert.ok(calls.includes('/session/receiver/appium/device/current_package'));
 const unbound=parseFlow(saved({...base,actors:['sender','receiver'],steps:[ref()]}).source);
 await assert.rejects(resolveFlowDependencies(unbound,async()=>saved({...base,steps:[check]})),/actor/);
});

test('role binding reaches nested shared before, main and cleanup on the selected phone',async()=>{
 const root=parseFlow(saved({...base,actors:['sender','receiver'],steps:[{...ref(),actor:'sender'},{...ref(),actor:'receiver'}]}).source);
 const shared=saved({...base,before:[{name:'準備',action:'back'}],steps:[ref('nested')],after:[{name:'清理',action:'back'}]});
 const bundle=await resolveFlowDependencies(root,async id=>id==='shared'?shared:saved({...base,steps:[check]}));
 const calls=[];
 const result=await executeFlow(root,{dependencies:bundle.definitions,execute:async path=>{calls.push(path);return 'com.example.app';},routeFor:role=>'/session/'+role});
 assert.equal(result.status,'passed');
 assert.deepEqual(calls.map(path=>path.split('/')[2]),['sender','sender','sender','receiver','receiver','receiver']);
});

test('changing single phone to dual keeps the pinned source and blocks an unassigned reference',async()=>{
 const single=parseFlow(saved({...base,before:[ref()],steps:[check]}).source);
 const child=saved({...base,steps:[check]});
 await resolveFlowDependencies(single,async()=>child);
 const upgraded=parseFlow(saved({...single,actors:['sender','receiver'],steps:[{...check,actor:'sender'},{...check,actor:'receiver'}]}).source);
 await assert.rejects(resolveFlowDependencies(upgraded,async()=>child),/待指定角色/);
 assert.equal(upgraded.before[0].scriptVersion,2);
 upgraded.before[0].actor='receiver';
 await resolveFlowDependencies(upgraded,async()=>child);
 assert.equal(upgraded.before[0].scriptVersion,2);
});

for(const mode of ['passed','assertion-failed','enter-failed','no-switch','cleanup-failed','restore-failed'])test(`cross-App shared flow switches and restores without retry: ${mode}`,async()=>{
 const root=parseFlow(saved({...base,steps:[{name:'原案例檢查',action:'assertAppForeground',timeoutMs:0},ref(),{name:'返回後檢查',action:'assertAppForeground',timeoutMs:0}]}).source);
 const child=saved({appPackage:'com.other.app',steps:[check],after:[{name:'共用清理',action:'back'}]});
 const bundle=await resolveFlowDependencies(root,async()=>child);
 let active=base.appPackage,tick=0,childReads=0;const calls=[];
 const result=await executeFlow(root,{dependencies:bundle.definitions,now:()=>tick,sleep:async ms=>{tick+=ms;},routeFor:()=>'/session/device',execute:async(path,body)=>{
  if(body?.script==='mobile: activateApp'){
   const app=body.args[0].appId;calls.push(app);
   if(mode==='enter-failed'&&app==='com.other.app'||mode==='restore-failed'&&app===base.appPackage)throw new Error('切換失敗');
   if(mode!=='no-switch')active=app;return null;
  }
  if(path.endsWith('/back')){calls.push('cleanup');if(mode==='cleanup-failed')throw new Error('清理失敗');return null;}
  return mode==='assertion-failed'&&active==='com.other.app'&&++childReads>1?'com.wrong.app':active;
 }});
 assert.equal(result.status,mode==='passed'?'passed':'failed');
 assert.deepEqual(calls,(mode==='enter-failed'||mode==='no-switch')?['com.other.app',base.appPackage]:['com.other.app','cleanup',base.appPackage]);
 assert.ok(result.trace.some(item=>item.path.includes('.restore.')));
});

test('cross-App shared flow switches only the selected role and restores before the other phone runs',async()=>{
 const root=parseFlow(saved({...base,actors:['sender','receiver'],steps:[{...ref(),actor:'receiver'},{...check,actor:'sender'}]}).source);
 const bundle=await resolveFlowDependencies(root,async()=>saved({appPackage:'com.other.app',steps:[check]}));
 const active={sender:base.appPackage,receiver:base.appPackage},switches=[];
 const result=await executeFlow(root,{dependencies:bundle.definitions,routeFor:role=>'/session/'+role,execute:async(path,body)=>{
  const role=path.split('/')[2];
  if(body?.script==='mobile: activateApp'){active[role]=body.args[0].appId;switches.push([role,active[role]]);return null;}
  return active[role];
 }});
 assert.equal(result.status,'passed');assert.deepEqual(switches,[['receiver','com.other.app'],['receiver',base.appPackage]]);
});

test('nested cross-App references restore each caller App in order',async()=>{
 const root=parseFlow(saved({...base,steps:[ref(),check]}).source);
 const bundle=await resolveFlowDependencies(root,async id=>saved({appPackage:id==='shared'?'com.second.app':'com.third.app',steps:id==='shared'?[ref('nested'),check]:[check]}));
 let active=base.appPackage;const switches=[];
 const result=await executeFlow(root,{dependencies:bundle.definitions,routeFor:()=>'/session/device',execute:async(path,body)=>{
  if(body?.script==='mobile: activateApp'){active=body.args[0].appId;switches.push(active);return null;}
  return active;
 }});
 assert.equal(result.status,'passed');assert.deepEqual(switches,['com.second.app','com.third.app','com.second.app',base.appPackage]);
});
