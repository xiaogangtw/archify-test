import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {registerAndroidAgentTasks,memoryAgentTasks,type AgentTask} from '../src/androidAgentTasks.ts';
import {createAgentDraft} from '../src/androidAgentDraft.ts';
const base='export const flow={appPackage:"com.example.app",steps:[{name:"確認",action:"assertAppForeground"}]} as const;';
const headers={'x-archify-user':'alice'};
async function fixture(){
 const store=memoryAgentTasks(),app=Fastify();
 registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async()=>({kind:'ask',question:'新問題',options:[]}),device:async()=>({}),release:async()=>{},verify:async()=>({status:'failed',message:''})});
 await app.ready();
 const row:AgentTask={id:randomUUID(),owner:'alice',scriptId:'s',scriptVersion:1,threadId:'t',revision:0,state:'waiting',serial:'emulator-5554',baseSource:base,draft:{...createAgentDraft(base.replace('確認','新確認')),revision:3},goal:'修改',requestIds:[],messages:[],events:[],observations:[],message:'等待回答',question:{prompt:'是否繼續？',options:['繼續']},updatedAt:new Date().toISOString()};
 await store.save(row,-1);return {app,store,row};
}
for(const action of ['applied','dismissed'] as const)test(action+' persists across reopening, clears questions, and is revision fenced',async()=>{
 const {app,store,row}=await fixture();const url='/api/android/agent-tasks/'+row.id+'/resolution';
 const payload={action,draftRevision:3};
 assert.equal((await app.inject({method:'POST',url,headers:{'x-archify-user':'bob'},payload})).statusCode,404);
 assert.equal((await app.inject({method:'POST',url,headers,payload:{...payload,draftRevision:2}})).statusCode,409);
 for(let i=0;i<2;i++)assert.equal((await app.inject({method:'POST',url,headers,payload})).statusCode,200);
 const restored=(await app.inject({url:'/api/android/agent-tasks/latest?scriptId=s&threadId=t',headers})).json().task;
 assert.equal(restored.resolution.action,action);assert.equal(restored.question,undefined);assert.equal(restored.state,'ready');assert.equal(restored.draft.source,row.draft.source);
 assert.equal((await app.inject({method:'POST',url,headers,payload:{...payload,action:action==='applied'?'dismissed':'applied'}})).statusCode,409);
 assert.equal((await store.get(row.id))!.question,undefined);await app.close();
});
test('resolution cannot race an active operation and stopping a waiting task clears its question',async()=>{
 const {app,store,row}=await fixture();const running={...row,state:'running' as const,revision:1};await store.save(running,0);
 assert.equal((await app.inject({method:'POST',url:'/api/android/agent-tasks/'+row.id+'/resolution',headers,payload:{action:'dismissed',draftRevision:3}})).statusCode,409);
 await store.save({...running,state:'waiting',revision:2},1);
 const stopped=(await app.inject({method:'POST',url:'/api/android/agent-tasks/'+row.id+'/stop',headers,payload:{}})).json();assert.equal(stopped.state,'stopped');assert.equal(stopped.question,undefined);await app.close();
});
test('a new request after dismissal starts from the current editor instead of reviving the rejected draft',async()=>{
 const {app,store,row}=await fixture();await app.inject({method:'POST',url:'/api/android/agent-tasks/'+row.id+'/resolution',headers,payload:{action:'dismissed',draftRevision:3}});
 const response=await app.inject({method:'POST',url:'/api/android/agent-tasks',headers,payload:{requestId:randomUUID(),scriptId:'s',scriptVersion:1,threadId:'t',source:base,serial:'emulator-5554',question:'以目前內容重新修改'}});
 assert.equal(response.statusCode,202);assert.equal(response.json().draft.source,base);assert.equal(response.json().resolution,undefined);
 for(let i=0;i<50;i++){if((await store.get(row.id))?.state!=='running')break;await new Promise(resolve=>setTimeout(resolve,5));}
 assert.equal((await store.get(row.id))!.question?.prompt,'新問題');await app.close();
});
