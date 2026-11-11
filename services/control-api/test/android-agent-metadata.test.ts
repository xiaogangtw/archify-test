import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Fastify from 'fastify';
import {createAgentDraft,patchAgentDraft,draftExecutionHash} from '../src/androidAgentDraft.ts';
import {appendAgentInstruction} from '../src/androidAgentMemory.ts';
import {registerAndroidAgentTasks,memoryAgentTasks} from '../src/androidAgentTasks.ts';

const source='export const flow={appPackage:"com.example.app",steps:[{name:"前景",action:"assertAppForeground"}]} as const;';
const metadata=(revision:number,value:unknown)=>({revision,operations:[{op:'metadata',value}]});

test('metadata uses the same revision as steps and an invalid combined patch changes nothing',()=>{
 const draft=createAgentDraft(source);
 const next=patchAgentDraft(draft,{revision:0,operations:[{op:'metadata',value:{title:'儲存後重開保留姓名',expectedResults:['姓名保持不變']}},{op:'insert',container:['steps'],after:draft.nodes[0].id,steps:[{name:'確認姓名',action:'assertText',using:'id',value:'name',text:'測試姓名'}]}]});
 assert.equal(next.revision,1);assert.equal(next.metadata?.titleOrigin,'agent');assert.equal(next.nodes[0].id,draft.nodes[0].id);
 assert.throws(()=>patchAgentDraft(next,metadata(0,{title:'過期修改'})),/版本/);
 assert.throws(()=>patchAgentDraft(draft,{revision:0,operations:[{op:'metadata',value:{title:'不應套用'}},{op:'remove',id:randomUUID()}]}));
 assert.equal(draft.metadata,undefined);assert.equal(draft.source,source);
 for(const value of [{title:' '},{caseCode:'TC-001'},{categoryId:'guessed'},{titleOrigin:'agent'},{expectedResults:['']},{sourceRefs:Array(51).fill('ref')}])assert.throws(()=>patchAgentDraft(draft,metadata(0,value)));
});

test('manual title is protected and title-only changes preserve exact source, IDs and execution hash',()=>{
 const draft=createAgentDraft(source,{title:'人工名稱',expectedResults:['姓名保持不變']});
 assert.throws(()=>patchAgentDraft(draft,metadata(0,{title:'覆寫名稱',objective:'另一目標'})),/不可由 Agent 覆寫/);
 assert.equal(draft.metadata?.objective,undefined);
 const same=patchAgentDraft(draft,metadata(0,{title:'人工名稱',categorySuggestion:'名片'}));
 assert.equal(same.metadata?.titleOrigin,'user');assert.equal(same.source,source);assert.deepEqual(same.nodes,draft.nodes);assert.equal(draftExecutionHash(same),draftExecutionHash(draft));
 const agent=createAgentDraft(source),renamed=patchAgentDraft(agent,metadata(0,{title:'開啟後顯示目標 App'}));
 assert.equal(draftExecutionHash(agent),draftExecutionHash(renamed));
 for(const value of [{expectedResults:['新預期']},{dataRefs:['新資料版本']},{preconditions:['另一帳號']},{cleanup:['還原姓名']},{objective:'另一業務目標'}]){
  assert.notEqual(draftExecutionHash(patchAgentDraft(draft,metadata(0,value))),draftExecutionHash(draft));
 }
});

test('durable instructions are idempotent and overflow is refused without discarding old requirements',()=>{
 const current=appendAgentInstruction([],'first','只操作測試帳號');
 assert.deepEqual(appendAgentInstruction(current,'first','重複'),current);
 assert.throws(()=>appendAgentInstruction(current,'next','x'.repeat(100000)),/上限/);
 assert.deepEqual(current,[{requestId:'first',content:'只操作測試帳號'}]);
 assert.throws(()=>appendAgentInstruction(Array.from({length:100},(_,i)=>({requestId:String(i),content:'限制'})),'next','新限制'),/上限/);
});

async function settled(store:ReturnType<typeof memoryAgentTasks>,id:string){
 for(let i=0;i<300;i++){const task=await store.get(id);if(task?.state!=='running')return task!;await new Promise(resolve=>setTimeout(resolve,5));}throw new Error('task did not settle');
}

test('metadata survives reopening, manual source edits and bounded chat while all user requests reach planning',async()=>{
 const store=memoryAgentTasks();let turn=0;
 const app=Fastify();registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async(task,context:any)=>{
  assert.ok(context.instructions.some((item:any)=>item.content==='只操作測試帳號'));
  if(turn++===0)return {kind:'patch',patch:metadata(task.draft.revision,{title:'空白手機不能發送驗證碼',objective:'拒絕空白手機'})};
  return {kind:'ask',question:'請提供測試帳號參照',options:[]};
 },device:async()=>({}),release:async()=>{},verify:async()=>({status:'passed',message:''})});
 const input={requestId:randomUUID(),scriptId:'case',threadId:'thread',serial:'emulator-5554',source,question:'只操作測試帳號'};
 const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',payload:input})).json();
 await settled(store,created.id);
 for(let i=0;i<22;i++){
  const response=await app.inject({method:'POST',url:'/api/android/agent-tasks',payload:{...input,requestId:randomUUID(),question:'補充條件'+i,...(i===0?{metadata:{title:'我的案例'},draftRevision:(await store.get(created.id))!.draft.revision}:{})}});
  assert.equal(response.statusCode,202,response.body);await settled(store,created.id);
 }
 const result=await store.get(created.id);assert.equal(result?.instructions?.length,23);assert.ok(result!.messages.length<=41);
 assert.equal(result?.draft.metadata?.title,'我的案例');assert.equal(result?.draft.metadata?.titleOrigin,'user');
 const latest=(await app.inject({url:'/api/android/agent-tasks/latest?scriptId=case&threadId=thread'})).json().task;
 assert.equal(latest.draft.metadata.title,'我的案例');
 const stale=await app.inject({method:'POST',url:'/api/android/agent-tasks',payload:{...input,requestId:randomUUID(),metadata:{title:'過期視窗名稱'},draftRevision:0}});
 assert.equal(stale.statusCode,409);assert.equal((await store.get(created.id))?.draft.metadata?.title,'我的案例');
 const edited=await app.inject({method:'POST',url:'/api/android/agent-tasks',payload:{...input,requestId:randomUUID(),source:source.replace('前景','人工編輯'),question:'保留人工步驟'}});
 assert.equal(edited.statusCode,202);assert.equal(edited.json().draft.metadata.title,'我的案例');await settled(store,created.id);
 await app.close();
});

test('metadata-only authoring finishes as an unverified draft without operating the phone',async()=>{
 const app=Fastify(),store=memoryAgentTasks();let turn=0,operations=0;
 registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async task=>turn++===0?{kind:'patch',patch:metadata(task.draft.revision,{title:'開啟後顯示目標 App'})}:{kind:'finish',result:'draft',summary:'已命名，未執行驗證'},device:async()=>{operations++;return {};},release:async()=>{},verify:async()=>{throw new Error('unexpected replay');}});
 const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',payload:{requestId:randomUUID(),scriptId:'case',threadId:'thread',serial:'emulator-5554',source,question:'幫案例命名'}})).json();
 const task=await settled(store,created.id);assert.equal(task.state,'ready',task.message);assert.equal(task.draft.source,source);assert.equal(task.verification,undefined);assert.equal(operations,0);await app.close();
});

test('failed replay protects business expectations from metadata weakening',async()=>{
 const app=Fastify(),store=memoryAgentTasks();let turn=0;
 registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async(task,context:any)=>{
  if(turn++===0)return {kind:'patch',patch:metadata(task.draft.revision,{expectedResults:['接收者看不到手機欄位']})};
  if(turn===2)return {kind:'verify'};
  if(turn===3)return {kind:'patch',patch:metadata(task.draft.revision,{expectedResults:[]})};
  assert.match(context.feedback,/不得移除或改寫/);return {kind:'ask',question:'接收者結果與預期不符',options:[]};
 },device:async()=>({xml:'<hierarchy/>'}),release:async()=>{},verify:async()=>({status:'failed',message:'模擬失敗'})});
 const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',payload:{requestId:randomUUID(),scriptId:'case',threadId:'thread',serial:'emulator-5554',source,question:'驗證名片',autoVerify:true}})).json();
 const task=await settled(store,created.id);assert.equal(task.state,'waiting');assert.deepEqual(task.draft.metadata?.expectedResults,['接收者看不到手機欄位']);await app.close();
});

test('a passed replay survives rename but business metadata invalidates it',async()=>{
 for(const businessChange of [false,true]){
  const app=Fastify(),store=memoryAgentTasks();let turn=0;
  registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async(task)=>{
   switch(turn++){
    case 0:return {kind:'patch',patch:{revision:task.draft.revision,operations:[{op:'insert',container:['steps'],after:task.draft.nodes[0].id,steps:[{name:'新增斷言',action:'assertAppForeground'}]}]}};
    case 1:return {kind:'verify'};
    case 2:return {kind:'patch',patch:metadata(task.draft.revision,businessChange?{expectedResults:['新的預期']}:{title:'開啟後顯示目標 App'})};
    default:return {kind:'finish',result:'draft',summary:'完成'};
   }
  },device:async()=>({xml:'<hierarchy/>'}),release:async()=>{},verify:async()=>({status:'passed',message:'模擬回報'})});
  const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',payload:{requestId:randomUUID(),scriptId:'case',threadId:'thread',serial:'emulator-5554',source,question:'產生並驗證',autoVerify:true}})).json();
  const task=await settled(store,created.id);
  assert.equal(task.state,businessChange?'failed':'ready',task.message);
  assert.equal(!!task.verification,!businessChange);
  await app.close();
 }
});
