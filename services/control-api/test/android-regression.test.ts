import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {registerAndroidExecution} from '../src/androidExecution.ts';
import {memoryAndroidRuns} from '../src/androidRuns.ts';
import {executeFlow} from '../../android/flow-engine.mjs';

test('nested regression flows freeze source, execute the selected path and persist cleanup/branch evidence',async()=>{
 const app=Fastify(),runs=memoryAndroidRuns();
 const source=`export const flow={appPackage:'com.example.app',variables:{ready:true},before:[{name:'準備',action:'back'}],steps:[{name:'已登入分支',action:'if',condition:{kind:'variable',variable:'ready',equals:true},then:[{name:'共用驗證',action:'callFlow',scriptId:'shared',scriptVersion:2}],else:[{name:'未登入',action:'assertAppForeground'}]}],after:[{name:'清理',action:'back'}]} as const;`;
 const sharedSource=`export const flow={appPackage:'com.example.app',routines:{check:[{name:'確認前景',action:'assertAppForeground',timeoutMs:0}]},steps:[{name:'共用檢查',action:'call',routine:'check'}]} as const;`;
 registerAndroidExecution(app,{fresh:()=>true,conditionalFlows:()=>true,session:()=>'',owns:()=>true,ready:()=>true,enqueue:async(_action,_owner,payload:any)=>{
  assert.ok(Object.keys(payload.dependencies).length===1);
  return executeFlow(payload.definition,{execute:async(path:string)=>path.endsWith('/current_package')?'com.example.app':null,routeFor:()=>'/session/test',dependencies:payload.dependencies});
 }},{runs,script:async(id,version)=>id==='shared'&&version===2?{caseType:'flow',source:sharedSource,name:'共用驗證',version:2}:{caseType:'flow',source,name:'回歸測試',version:1}});
 try {
  const response=await app.inject({method:'POST',url:'/api/android/runs',payload:{scriptId:'regression',scriptVersion:1,serial:'emulator-5554',requestId:randomUUID()}});
  assert.equal(response.statusCode,202);
  const id=response.json().id;
  let saved=await runs.get(id);
  for(let i=0;i<20&&saved?.status==='queued';i++){await new Promise(resolve=>setTimeout(resolve,10));saved=await runs.get(id);}
  assert.equal(saved?.status,'passed');assert.equal(saved?.source,source);
  assert.equal(saved?.dependencies?.[0].source,sharedSource);
  assert.ok(saved?.trace?.some(entry=>entry.path==='main.1.then.1.flow.1.call.1'));
  assert.ok(saved?.trace?.some(entry=>entry.phase==='after'&&entry.status==='passed'));
  assert.ok(!saved?.trace?.some(entry=>entry.path.includes('.else')));
  const detail=await app.inject({url:'/api/android/runs/'+id});assert.equal(detail.statusCode,200);
  assert.deepEqual(detail.json().trace,saved?.trace);
 }finally{await app.close();}
});

test('conditional flows cannot run on an executor that has not reported support',async()=>{
 const app=Fastify(),runs=memoryAndroidRuns();let supported=false,enqueued=0;
 app.setErrorHandler((error:any,_request,reply)=>reply.code(error.statusCode||500).send({error:error.message}));
 const source=`export const flow={appPackage:'com.example.app',steps:[{name:'分支',action:'if',condition:{kind:'foreground'},then:[{name:'檢查',action:'assertAppForeground'}]}]} as const;`;
 registerAndroidExecution(app,{fresh:()=>true,conditionalFlows:()=>supported,session:()=>'',owns:()=>true,ready:()=>true,enqueue:async()=>{enqueued++;return {status:'failed',completed:0,steps:[{name:'分支',status:'failed'}],message:'測試'};}},{runs,script:async()=>({caseType:'flow',source,name:'條件測試',version:1})});
 try {
  const request=()=>app.inject({method:'POST',url:'/api/android/runs',payload:{scriptId:'conditional',scriptVersion:1,serial:'emulator-5554',requestId:randomUUID()}});
  const unavailable=await request();assert.equal(unavailable.statusCode,409);assert.match(unavailable.json().error,/尚未確認支援條件流程/);assert.equal(enqueued,0);
  supported=true;assert.equal((await request()).statusCode,202);assert.equal(enqueued,1);
 }finally{await app.close();}
});
