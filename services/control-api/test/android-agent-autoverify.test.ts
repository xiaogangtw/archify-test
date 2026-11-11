import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {registerAndroidAgentTasks,memoryAgentTasks} from '../src/androidAgentTasks.ts';

const source='export const flow={appPackage:"com.example.app",steps:[{name:"確認前景",action:"assertAppForeground"}]} as const;';
async function run(plan:any,verify:any){
 const app=Fastify(),store=memoryAgentTasks();let checks=0;
 registerAndroidAgentTasks(app,{store,references:async()=>[],plan,device:async()=>({xml:'<hierarchy/>',fingerprint:'a'}),release:async()=>{},verify:async task=>{checks++;return verify(task,checks);}});
 const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',payload:{requestId:randomUUID(),scriptId:'c',threadId:'t',serial:'emulator-5554',source,question:'寫好後重跑驗證',autoVerify:true}})).json();
 for(let i=0;i<300;i++){
  const task=await store.get(created.id);
  if(task&&task.state!=='running'){await app.close();return {task,checks};}
  await new Promise(resolve=>setTimeout(resolve,5));
 }
 await app.close();throw new Error('task did not settle');
}
const patch=(task:any,name='檢查名片')=>({kind:'patch',patch:{revision:task.draft.revision,operations:[{op:'insert',container:['steps'],after:task.draft.nodes.at(-1).id,steps:[{name,action:'assertText',using:'id',value:'card',text:'預期姓名'}]}]}});
const finish={kind:'finish',result:'draft',summary:'完成'};

test('automatic authoring refuses an unverified finish and completes only the current verified source',async()=>{
 let turn=0;
 const {task,checks}=await run((task:any,context:any)=>{
  assert.equal(context.autoVerify,true);
  if(turn++===0)return patch(task);
  if(turn===2)return finish;
  if(turn===3){assert.match(context.feedback,/自動重跑/);return {kind:'verify'};}
  return finish;
 },async()=>({status:'passed',message:'驗證通過'}));
 assert.equal(checks,1);assert.equal(task.state,'ready');assert.equal(task.verification?.source,task.draft.source);
});

test('failed verification is marked failed and a repaired source must be verified again',async()=>{
 let turn=0;
 const {task,checks}=await run((task:any)=>{
  if(turn++===0)return patch(task);
  if(turn===2)return {kind:'verify'};
  if(turn===3)return {kind:'patch',patch:{revision:task.draft.revision,operations:[{op:'replace',id:task.draft.nodes.at(-1).id,step:{name:'檢查名片',action:'assertText',using:'id',value:'correct-card',text:'預期姓名'}}]}};
  if(turn===4)return finish;
  if(turn===5)return {kind:'verify'};
  return finish;
 },async(_:any,n:number)=>({status:n===1?'failed':'passed',message:n===1?'找不到元件':'驗證通過'}));
 assert.equal(checks,2);assert.equal(task.state,'ready');assert.equal(task.events.filter(e=>e.kind==='verify')[0].status,'failed');
});

test('repair cannot weaken expected text or hide assertions even across multiple patches',async()=>{
 let turn=0;
 const {task}=await run((task:any,context:any)=>{
  if(turn++===0)return patch(task);
  if(turn===2)return {kind:'verify'};
  if(turn===3)return {kind:'patch',patch:{revision:task.draft.revision,operations:[{op:'replace',id:task.draft.nodes.at(-1).id,step:{name:'改定位',action:'assertText',using:'id',value:'correct',text:'預期姓名'}}]}};
  if(turn===4)return {kind:'patch',patch:{revision:task.draft.revision,operations:[{op:'replace',id:task.draft.nodes.at(-1).id,step:{name:'改預期',action:'assertText',using:'id',value:'correct',text:'錯誤姓名'}}]}};
  assert.match(context.feedback,/不得移除結果斷言/);return {kind:'ask',question:'資料與預期不符',options:[]};
 },async()=>({status:'failed',message:'文字不符'}));
 assert.equal(task.state,'waiting');assert.match(task.draft.source,/預期姓名/);assert.doesNotMatch(task.draft.source,/錯誤姓名/);
});

test('three failed replays stop automatically without a false completion',async()=>{
 let turn=0;
 const {task,checks}=await run((task:any)=>turn++===0?patch(task):{kind:'verify'},async()=>({status:'failed',message:'元件不可見'}));
 assert.equal(checks,3);assert.equal(task.state,'failed');assert.match(task.message,/三次/);assert.equal(task.events.filter(e=>e.kind==='verify'&&e.status==='failed').length,3);
});
