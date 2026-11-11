import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {memoryAgentTasks,registerAndroidAgentTasks,type AgentTask} from '../src/androidAgentTasks.ts';
import Fastify from 'fastify';
import {createAgentDraft} from '../src/androidAgentDraft.ts';

test('accepted corrections survive task recovery, stay ordered and acknowledge only after a checkpoint',async()=>{
 const store=memoryAgentTasks(),id=randomUUID();
 const task:AgentTask={id,owner:'alice',scriptId:'case',threadId:'thread',revision:0,state:'running',serial:'emulator-5554',baseSource:'',draft:createAgentDraft('export const flow={appPackage:"com.example.app",steps:[{name:"確認",action:"assertAppForeground"}]} as const;'),goal:'原目標',requestIds:[],messages:[],events:[],observations:[],message:'',updatedAt:new Date().toISOString()};
 await store.save(task,-1);const first={requestId:randomUUID(),question:'只改姓名'},second={requestId:randomUUID(),question:'不送訊息'};
 await store.enqueue(id,first);await store.enqueue(id,first);await store.enqueue(id,second);await store.recover();
 assert.equal((await store.get(id))?.state,'uncertain');assert.deepEqual(await store.pending(id),[first,second]);
 await store.acknowledge(id,[first.requestId]);assert.deepEqual(await store.pending(id),[second]);
 for(let i=0;i<9;i++)await store.enqueue(id,{requestId:randomUUID(),question:'補充'});
 await assert.rejects(store.enqueue(id,{requestId:randomUUID(),question:'超量'}),/稍後/);assert.equal((await store.pending(id)).length,10);
});
test('fact memory requires real evidence and action budget is saved without granting new permissions',async()=>{
 const store=memoryAgentTasks(),app=Fastify();let turn=0;
 registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async(task,context:any)=>{
  if(turn++===0)return {kind:'remember',memory:{facts:[{statement:'猜測結果',evidenceId:'invented'}],unknowns:[],nextAction:'觀察'}};
  if(turn===2){assert.match(context.feedback,/未知證據/);return {kind:'remember',memory:{facts:[{statement:'只使用測試帳號',evidenceId:task.instructions![0].requestId}],unknowns:['接收者'],nextAction:'先觀察畫面'}};}
  if(turn===3){assert.equal(context.memory.facts[0].statement,'只使用測試帳號');assert.equal(context.budget.maxActions,300);return {kind:'observe'};}
  return {kind:'ask',question:'接收者測試帳號參照為何？',options:[]};
 },device:async()=>({xml:'<hierarchy/>'}),release:async()=>{},verify:async()=>({status:'failed',message:''})});
 const response=await app.inject({method:'POST',url:'/api/android/agent-tasks',payload:{requestId:randomUUID(),scriptId:'case',threadId:'thread',serial:'emulator-5554',source:'export const flow={appPackage:"com.example.app",steps:[{name:"確認",action:"assertAppForeground"}]} as const;',question:'只使用測試帳號'}});
 const id=response.json().id;
 for(let i=0;i<100;i++){if((await store.get(id))?.state!=='running')break;await new Promise(resolve=>setTimeout(resolve,5));}
 const task=await store.get(id);assert.equal(task?.phase,'waiting');assert.equal(task?.budget?.actionsUsed,1);assert.equal(task?.memory?.facts.length,1);assert.equal(task?.memory?.unknowns[0],'接收者');await app.close();
});
