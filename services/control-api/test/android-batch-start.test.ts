import test from 'node:test';
import assert from 'node:assert/strict';
import {AndroidRunNotStarted,startBatchCase,waitForBatchCase} from '../../../apps/web/src/features/testing/androidBatchStart.ts';

const ready=(serials=['emulator-5554'])=>({connected:true,appium:{ready:true},devices:serials.map(serial=>({serial,booted:true,canControl:true}))});
const rejected=(status:number,message:string)=>Object.assign(new Error(message),{status});
function clock(){let time=0;return {now:()=>time,pause:async(ms:number)=>{time+=ms;}};}

test('first case completes after a lost poll and the second is submitted once in the same batch',async()=>{
 const c=clock(),batchId='same-batch',posts:any[]=[],reads:string[]=[];let waiting=0;
 const api=async(path:string,init?:RequestInit)=>{
  if(path==='/android/status')return ready();
  if(init?.method==='POST'){const body=JSON.parse(init.body as string);posts.push(body);return {id:body.scriptId,status:body.scriptId==='first'?'running':'passed'};}
  reads.push(path);if(reads.length===1)throw new TypeError('connection lost');
  if(reads.length===2)throw rejected(503,'temporarily unavailable');
  return {id:'first',status:'passed'};
 };
 for(const scriptId of ['first','second']){
  let run=await startBatchCase<{id:string;status:string}>({api:api as any,body:{scriptId,batchId,requestId:scriptId},serials:['emulator-5554'],batchId,waitBefore:posts.length>0,active:()=>true,onWaiting:()=>{},...c});
  run=await waitForBatchCase({api:api as any,run,active:()=>true,onWaiting:()=>waiting++,...c});
  assert.equal(run.status,'passed');
 }
 assert.deepEqual(posts.map(row=>row.scriptId),['first','second']);
 assert.equal(posts.every(row=>row.batchId===batchId),true);
 assert.deepEqual(reads,Array(3).fill('/android/runs/first'));
 assert.equal(waiting,2);
});

test('persistent polling failure stops without resubmission and access errors are not retried',async()=>{
 for(const failure of [new TypeError('offline'),rejected(403,'forbidden'),rejected(404,'missing')]){
  const c=clock(),calls:string[]=[];
  await assert.rejects(waitForBatchCase({api:(async(path:string)=>{calls.push(path);throw failure;}) as any,run:{id:'accepted',status:'running'},active:()=>true,onWaiting:()=>{},...c}),error=>error===failure);
  assert.equal(calls.every(path=>path==='/android/runs/accepted'),true);
  assert.equal(calls.length,failure instanceof TypeError?21:1);
 }
});

test('leaving while waiting for a poll sends no further requests',async()=>{
 let active=true,reads=0;
 const result=await waitForBatchCase({api:(async()=>{reads++;}) as any,run:{id:'accepted',status:'running'},active:()=>active,onWaiting:()=>{},pause:async()=>{active=false;}});
 assert.equal(reads,0);assert.equal(result.status,'running');
});

test('next case waits for both owned phones and sends exactly once with the frozen request',async()=>{
 const c=clock(),calls:{path:string;body?:string}[]=[];let polls=0,waiting=0;
 const api=async(path:string,init?:RequestInit)=>{calls.push({path,body:init?.body as string});if(path==='/android/status'){polls++;return polls<3?ready(['emulator-5554']):ready(['emulator-5554','emulator-5556']);}return {id:'second'};};
 const body={requestId:'stable',scriptId:'case-2'};
 const result=await startBatchCase({api:api as any,body,serials:['emulator-5554','emulator-5556'],waitBefore:true,active:()=>true,onWaiting:()=>waiting++,...c});
 assert.deepEqual(result,{id:'second'});assert.equal(polls,3);assert.equal(waiting,1);
 assert.equal(calls.filter(call=>call.path==='/android/runs').length,1);
 assert.deepEqual(JSON.parse(calls.at(-1)!.body!),body);
});

test('a device reserved for this batch is ready for the next case but not for another batch',async()=>{
 const c=clock();let posts=0;
 const api=async(path:string)=>path==='/android/status'?{connected:true,appium:{ready:true},devices:[{serial:'emulator-5554',booted:true,canControl:false,appiumBatch:'batch-a'}]}:(posts++,{id:'accepted'});
 assert.deepEqual(await startBatchCase({api:api as any,body:{},batchId:'batch-a',serials:['emulator-5554'],waitBefore:true,active:()=>true,onWaiting:()=>{},...c}),{id:'accepted'});
 assert.equal(posts,1);
 const other=clock();posts=0;
 await assert.rejects(startBatchCase({api:api as any,body:{},batchId:'batch-b',serials:['emulator-5554'],waitBefore:true,active:()=>true,onWaiting:()=>{},...other}),AndroidRunNotStarted);
 assert.equal(posts,0);
});

test('a definite busy rejection is retried only after readiness, with the same request id',async()=>{
 const c=clock(),posts:string[]=[];let checks=0;
 const api=async(path:string,init?:RequestInit)=>{if(path==='/android/status'){checks++;return ready();}posts.push(init!.body as string);if(posts.length===1)throw rejected(503,'手機或 Appium 執行器尚未就緒。');return {id:'accepted'};};
 const result=await startBatchCase({api:api as any,body:{requestId:'same-id'},serials:['emulator-5554'],waitBefore:false,active:()=>true,onWaiting:()=>{},...c});
 assert.deepEqual(result,{id:'accepted'});assert.equal(posts.length,2);assert.equal(posts[0],posts[1]);assert.equal(checks,1);
});

test('unknown delivery errors are never retried or falsely called not-started',async()=>{
 for(const failure of [new TypeError('network failed'),rejected(502,'gateway error'),rejected(408,'request timeout')]){
  let posts=0;
  await assert.rejects(startBatchCase({api:(async()=>{posts++;throw failure;}) as any,body:{requestId:'id'},serials:['emulator-5554'],waitBefore:false,active:()=>true,onWaiting:()=>{},...clock()}),error=>error===failure&&!(error instanceof AndroidRunNotStarted));
  assert.equal(posts,1);
 }
});

test('explicit validation rejection and readiness timeout report not-started without resending',async()=>{
 let posts=0;
 await assert.rejects(startBatchCase({api:(async()=>{posts++;throw rejected(409,'請先完成設定。');}) as any,body:{},serials:['emulator-5554'],waitBefore:false,active:()=>true,onWaiting:()=>{},...clock()}),AndroidRunNotStarted);
 assert.equal(posts,1);
 const c=clock();let checks=0;
 await assert.rejects(startBatchCase({api:(async(path:string)=>{assert.equal(path,'/android/status');checks++;return {connected:true,appium:{ready:true},devices:[{serial:'emulator-5554',booted:true,canControl:false}]};}) as any,body:{},serials:['emulator-5554'],waitBefore:true,active:()=>true,onWaiting:()=>{},...c}),AndroidRunNotStarted);
 assert.equal(checks,20);
});

test('leaving the page before readiness does not send a run',async()=>{
 let active=true,posts=0;
 await assert.rejects(startBatchCase({api:(async(path:string)=>{if(path==='/android/runs')posts++;return ready();}) as any,body:{},serials:['emulator-5554'],waitBefore:true,active:()=>active,onWaiting:()=>{active=false;},...clock()}),AndroidRunNotStarted);
 assert.equal(posts,0);
});
