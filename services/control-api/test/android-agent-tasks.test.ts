import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {registerAndroidAgentTasks,memoryAgentTasks,redactAgentXml,type AgentTask} from '../src/androidAgentTasks.ts';
import {createAgentDraft,patchAgentDraft} from '../src/androidAgentDraft.ts';
import {registerAndroid} from '../src/android.ts';
import {memoryAndroidProfiles} from '../src/androidProfiles.ts';

const source=(count=1)=>`export const flow=${JSON.stringify({appPackage:'com.example.app',steps:Array.from({length:count},(_,i)=>({name:'步驟'+i,action:'assertVisible',using:'id',value:'field'+i}))})} as const;`;
async function settled(app:any,id:string){for(let i=0;i<100;i++){const row=(await app.inject({url:'/api/android/agent-tasks/'+id,headers:{'x-archify-user':'alice'}})).json();if(row.state!=='running')return row;await pause(5);}throw new Error('task did not settle');}

test('a proven-unsent read failure can recover and retain a large screen without asking the user',async()=>{
 const app=Fastify(),store=memoryAgentTasks();let reads=0,plans=0;
 registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async(_task,context:any)=>{
  if(plans++<2)return {kind:'observe'};
  assert.match(context.observations[0].xml,/最後一項/);return {kind:'finish',result:'answer',summary:'已取得畫面'};
 },device:async()=>{if(++reads===1)throw Object.assign(new Error('暫時無法讀取'),{notDispatched:true});return {xml:'<hierarchy>'+('<node text="列表資料"/>'.repeat(5000))+'<node text="最後一項"/></hierarchy>',fingerprint:'a'.repeat(64)};},release:async()=>{},verify:async()=>({status:'passed',message:''})});
 const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',headers:{'x-archify-user':'alice'},payload:{requestId:randomUUID(),scriptId:'large',threadId:'t',source:source(),serial:'emulator-5554',question:'查看畫面'}})).json();
 const result=await settled(app,created.id);assert.equal(result.state,'ready');assert.equal(reads,2);assert.equal(result.question,undefined);assert.equal(result.verification,undefined);await app.close();
});

test('long press is recorded immediately and a draft cannot finish until its expected result is asserted',async()=>{
 const app=Fastify(),store=memoryAgentTasks();let plans=0,presses=0;
 registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async(task,context:any)=>{
  const turn=plans++;
  if(turn===0)return {kind:'longPress',locator:{kind:'text',value:'DemoAccount'},durationMs:800};
  assert.match(task.draft.source,/longPress/);assert.match(task.draft.source,/步驟0/);
  if(turn===1)return {kind:'finish',summary:'已寫好測試'};
  if(turn===2){assert.match(context.feedback,/斷言/);const node=task.draft.nodes.at(-1)!;return {kind:'patch',patch:{revision:task.draft.revision,operations:[{op:'insert',container:node.path.slice(0,-1),after:node.id,steps:[{name:'確認刪除選單',action:'assertVisible',using:'id',value:'delete'}]}]}};}
  return {kind:'finish',summary:'已補上長按及選單斷言，尚未驗證'};
 },device:async(_task,tool:any)=>{if(tool.kind==='longPress'){presses++;return {accepted:true,replayStep:{name:'長按帳號',action:'longPress',using:'id',value:'account',durationMs:800},xml:'<hierarchy><node resource-id="delete" text="刪除帳號"/></hierarchy>',fingerprint:'b'.repeat(64)};}return {xml:'<hierarchy><node text="DemoAccount"/></hierarchy>',fingerprint:'a'.repeat(64)};},release:async()=>{},verify:async()=>({status:'passed',message:''})});
 const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',headers:{'x-archify-user':'alice'},payload:{requestId:randomUUID(),scriptId:'long',threadId:'t',source:source(),serial:'emulator-5554',question:'長按帳號開啟刪除選單並寫測試'}})).json();
 const result=await settled(app,created.id);assert.equal(result.state,'ready');assert.equal(presses,1);assert.match(result.draft.source,/確認刪除選單/);assert.equal(result.verification,undefined);assert.ok(result.events.find((event:any)=>event.kind==='longPress').recorded);await app.close();
});

test('a no-change completion cannot claim to have delivered a test script',async()=>{
 const app=Fastify(),store=memoryAgentTasks();registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async()=>({kind:'finish',summary:'已產生測試'}),device:async()=>({}),release:async()=>{},verify:async()=>({status:'passed',message:''})});
 const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',headers:{'x-archify-user':'alice'},payload:{requestId:randomUUID(),scriptId:'empty',threadId:'t',source:source(),serial:'emulator-5554',question:'幫我寫測試'}})).json();
 const result=await settled(app,created.id);assert.equal(result.state,'failed');assert.match(result.message,/未完成測試草稿/);assert.equal(result.draft.source,source());await app.close();
});
test('patch insertion preserves existing steps, stable IDs and rejects stale or invalid targets',()=>{
 const original=createAgentDraft(source(20)),last=original.nodes.at(-1)!;
 const next=patchAgentDraft(original,{revision:0,operations:[{op:'insert',container:['steps'],after:last.id,steps:[{name:'新步驟',action:'assertAppForeground'}]}]});
 assert.equal(next.nodes.length,21);assert.deepEqual(next.nodes.slice(0,20).map(node=>node.id),original.nodes.map(node=>node.id));
 assert.match(next.source,/步驟0/);assert.match(next.source,/步驟19/);
 assert.throws(()=>patchAgentDraft(next,{revision:0,operations:[{op:'remove',id:last.id}]}),/版本/);
 assert.throws(()=>patchAgentDraft(original,{revision:0,operations:[{op:'insert',container:['steps','constructor','prototype'],after:null,steps:[{}]}]}));
 const first=original.nodes[0];
 const sequence=patchAgentDraft(original,{revision:0,operations:[{op:'insert',container:['steps'],after:null,steps:[{name:'開頭',action:'assertAppForeground'}]},{op:'replace',id:first.id,step:{name:'精準更新',action:'assertAppForeground'}}]});
 assert.equal(sequence.nodes[1].name,'精準更新');assert.equal(sequence.nodes[1].id,first.id);assert.equal(sequence.nodes[2].id,original.nodes[1].id);
});
test('adding steps 62 through 70 keeps all earlier 61 leaf steps intact',()=>{
 const leaf=(i:number)=>({name:`第${i}步`,action:'assertAppForeground'});
 const initial=createAgentDraft(`export const flow=${JSON.stringify({appPackage:'com.example.app',steps:[{name:'分支',action:'if',condition:{kind:'foreground'},then:Array.from({length:30},(_,i)=>leaf(i+1)),else:Array.from({length:30},(_,i)=>leaf(i+31))},leaf(61)]})} as const;`);
 const next=patchAgentDraft(initial,{revision:0,operations:[{op:'insert',container:['steps'],after:initial.nodes.at(-1)!.id,steps:Array.from({length:9},(_,i)=>leaf(i+62))}]});
 assert.deepEqual(next.nodes.slice(0,initial.nodes.length).map(node=>[node.id,node.name]),initial.nodes.map(node=>[node.id,node.name]));assert.equal(next.nodes.at(-1)!.name,'第70步');
});
test('a failed cleanup cannot publish a completed or waiting task',async()=>{
 const app=Fastify(),store=memoryAgentTasks();registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async()=>({kind:'finish',result:'answer',summary:'已完成'}),device:async()=>({}),release:async()=>{throw new Error('cleanup');},verify:async()=>({status:'passed',message:''})});
 const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',payload:{requestId:randomUUID(),scriptId:'c',threadId:'t',source:source(),serial:'emulator-5554',question:'處理'},headers:{'x-archify-user':'alice'}})).json();
 const row=await settled(app,created.id);assert.equal(row.state,'uncertain');assert.match(row.message,/釋放未確認/);await app.close();
});
test('task pauses, survives editor reload, retains evidence and resumes without repeating the tap',async()=>{
 const store=memoryAgentTasks();let plans=0,taps=0;
 const make=()=>{const app=Fastify();registerAndroidAgentTasks(app,{store,references:async()=>[{name:'開 LINE',scriptId:'line',scriptVersion:1}],plan:async task=>{
  const tools=[{kind:'observe'},{kind:'tap',locator:{kind:'id',value:'login'}},{kind:'patch',patch:{revision:0,operations:[{op:'insert',container:['steps'],after:task.draft.nodes[0].id,steps:[{name:'捕捉提示',action:'assertText',using:'xpath',value:'//android.widget.Toast',text:'未同意'}]}]}},{kind:'ask',question:'是否繼續？',options:['繼續']},{kind:'recall',query:'未同意'},{kind:'finish',summary:'已完成局部草稿'}];return tools[plans++];
 },device:async(_task,tool:any)=>{if(tool.kind==='tap'){taps++;return {accepted:true,xml:'<hierarchy><node text="未同意"/></hierarchy>'};}return {xml:'<hierarchy><node text="登入"/></hierarchy>',fingerprint:'a'.repeat(64)};},release:async()=>{},verify:async()=>({status:'passed',message:'verified'})});return app;};
 let app=make();const requestId=randomUUID(),input={requestId,scriptId:'case',threadId:'thread',source:source(),serial:'emulator-5554',question:'記錄提示'};
 const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',headers:{'x-archify-user':'alice'},payload:input})).json();
 let row=await settled(app,created.id);assert.equal(row.state,'waiting');assert.equal(taps,1);assert.match(row.draft.source,/步驟0/);assert.match(row.draft.source,/捕捉提示/);
 assert.equal(row.observations.some((item:any)=>Object.hasOwn(item,'xml')),false);
 assert.equal((await app.inject({url:'/api/android/agent-tasks/'+created.id,headers:{'x-archify-user':'bob'}})).statusCode,404);
 const duplicate=(await app.inject({method:'POST',url:'/api/android/agent-tasks',headers:{'x-archify-user':'alice'},payload:input})).json();assert.equal(duplicate.id,created.id);assert.equal(taps,1);
 await app.close();app=make();
 const restored=(await app.inject({url:'/api/android/agent-tasks/latest?scriptId=case&threadId=thread',headers:{'x-archify-user':'alice'}})).json().task;
 assert.equal(restored.state,'waiting');assert.equal(restored.question.prompt,'是否繼續？');
 await app.inject({method:'POST',url:'/api/android/agent-tasks',headers:{'x-archify-user':'alice'},payload:{...input,requestId:randomUUID(),question:'繼續'}});
 row=await settled(app,created.id);assert.equal(row.state,'ready');assert.equal(taps,1);
 assert.ok((await store.recall(created.id,'未同意')).length);await app.close();
});
test('stopping while the model is thinking prevents later device actions',async()=>{
 const store=memoryAgentTasks();let releasePlan:(value:unknown)=>void=()=>{};let taps=0;
 const app=Fastify();registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async()=>new Promise(resolve=>{releasePlan=resolve;}),device:async()=>{taps++;return {};},release:async()=>{},verify:async()=>({status:'passed',message:''})});
 const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',payload:{requestId:randomUUID(),scriptId:'case',threadId:'thread',source:source(),serial:'emulator-5554',question:'執行'},headers:{'x-archify-user':'alice'}})).json();
 await pause(10);await app.inject({method:'POST',url:`/api/android/agent-tasks/${created.id}/stop`,headers:{'x-archify-user':'alice'},payload:{}});
 releasePlan({kind:'tap',locator:{kind:'id',value:'login'}});await pause(10);assert.equal(taps,0);assert.equal((await store.get(created.id))?.state,'stopped');await app.close();
});
test('service recovery marks in-flight tasks uncertain instead of replaying operations',async()=>{
 const store=memoryAgentTasks(),task={id:randomUUID(),owner:'alice',scriptId:'c',threadId:'t',revision:0,state:'running',serial:'emulator-5554',baseSource:source(),draft:createAgentDraft(source()),goal:'test',requestIds:[],messages:[],events:[],observations:[],message:'tap in flight',updatedAt:new Date().toISOString()} as AgentTask;
 await store.save(task,-1);await store.recover();assert.equal((await store.get(task.id))?.state,'uncertain');
 assert.equal(redactAgentXml('<node class="android.widget.EditText" text="secret"/><node text="123456"/>').includes('secret'),false);
 assert.equal(redactAgentXml('<android.widget.EditText class="android.widget.EditText" text="private" password="true"/>').includes('private'),false);
});
test('stale element references trigger re-observation without dispatching a click',async()=>{
 const app=Fastify(),store=memoryAgentTasks();let plans=0,reads=0,taps=0;
 registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async(task,context:any)=>{
  if(plans++===0)return {kind:'observe'};
  if(plans===2)return {kind:'tap',locator:{kind:'ref',value:'e2'},observationId:task.observations[0].id};
  assert.match(context.feedback,/沒有送出操作/);return {kind:'finish',result:'answer',summary:'已確認畫面變更，未點擊'};
 },device:async(_task,tool:any)=>{if(tool.kind!=='observe')taps++;return {xml:'<hierarchy><node agent-ref="e2"/></hierarchy>',fingerprint:(++reads===1?'a':'b').repeat(64)};},release:async()=>{},verify:async()=>({status:'passed',message:''})});
 const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',headers:{'x-archify-user':'alice'},payload:{requestId:randomUUID(),scriptId:'c',threadId:'t',source:source(),serial:'emulator-5554',question:'操作'}})).json();
 assert.equal((await settled(app,created.id)).state,'ready');assert.equal(taps,0);await app.close();
});
test('a task reserves only its owned phone and can reuse its session while other controls are blocked',async()=>{
 const app=Fastify(),profiles=memoryAndroidProfiles(),profileId=randomUUID(),session=randomUUID(),taskId=randomUUID();const serial='emulator-5554',avd='Archify_Device_A';
 await profiles.put({id:profileId,owner:'alice',name:'A',avd,state:'ready'});const android=registerAndroid(app,profiles);
 const post=(url:string,payload:any)=>app.inject({method:'POST',url,payload,headers:{'x-archify-user':'alice'}});
 const heartbeat=(busy=false)=>post('/internal/android/status',{session,status:{sdk:{ready:true,path:'/sdk'},avds:[avd],devices:[{serial,state:'device',booted:true,managed:true,avd,profileId,error:'',appiumBusy:busy,...(busy?{appiumTask:JSON.stringify(['alice',taskId])}:{})}],issues:[],appium:{reachable:true,ready:true,agentTasks:true,agentProtocol:2}}});
 await heartbeat();await assert.rejects(android.agentDevice(serial,'bob',taskId,{kind:'observe'}),/自己/);
 const first=android.agentDevice(serial,'alice',taskId,{kind:'observe'});await pause(1);
 assert.equal((await post(`/api/android/devices/${serial}/input`,{action:'home'})).statusCode,409);
 const command=(await post('/internal/android/claim',{session})).json();assert.equal(command.action,'agentDevice');
 await heartbeat(true);await post(`/internal/android/result/${command.id}`,{session,result:{xml:'<hierarchy/>',fingerprint:'a'.repeat(64)}});await first;
 await assert.rejects(android.agentDevice(serial,'alice',randomUUID(),{kind:'observe'}),/另一個/);
 const second=android.agentDevice(serial,'alice',taskId,{kind:'observe'});await pause(1);const next=(await post('/internal/android/claim',{session})).json();assert.equal(next.payload.key,command.payload.key);
 await post(`/internal/android/result/${next.id}`,{session,result:{xml:'<hierarchy/>',fingerprint:'a'.repeat(64)}});await second;
 // A delayed heartbeat may still say busy after the worker already closed the
 // explorer on an observation error. Cleanup must reach the same owned worker.
 await post('/internal/android/status',{session,status:{sdk:{ready:true,path:'/sdk'},avds:[avd],devices:[{serial,state:'device',booted:true,managed:true,avd,profileId,error:'',appiumBusy:true}],issues:[],appium:{reachable:true,ready:true,agentTasks:true,agentProtocol:2}}});
 const release=android.releaseAgent(serial,'alice',taskId);await pause(1);const close=(await post('/internal/android/claim',{session})).json();assert.equal(close.payload.tool.kind,'close');await heartbeat(false);await post(`/internal/android/result/${close.id}`,{session,result:{accepted:true}});await release;await app.close();
});

test('dual authoring promotes a single-phone draft atomically and records the receiver role',async()=>{
 const app=Fastify(),store=memoryAgentTasks();let turn=0;const operated:string[]=[];
 registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async(task,context:any)=>{
  assert.deepEqual(context.device.bindings,{sender:'emulator-5554',receiver:'emulator-5556'});
  switch(turn++){
   case 0:return {kind:'patch',patch:{revision:task.draft.revision,operations:[{op:'configure',field:'actors',value:['sender','receiver']},{op:'replace',id:task.draft.nodes[0].id,step:{name:'A 畫面',action:'assertAppForeground',actor:'sender'}},{op:'insert',container:['steps'],after:task.draft.nodes[0].id,steps:[{name:'B 畫面',action:'assertAppForeground',actor:'receiver'}]}]}};
   case 1:return {kind:'switchActor',actor:'receiver'};
   case 2:assert.equal(task.serial,'emulator-5556');assert.equal(task.observations.length,0);return {kind:'observe'};
   case 3:assert.equal(context.observations.at(-1).actor,'receiver');return {kind:'tap',locator:{kind:'id',value:'open'}};
   case 4:assert.match(task.draft.source,/"actor": "receiver"/);return {kind:'patch',patch:{revision:task.draft.revision,operations:[{op:'insert',container:['steps'],after:task.draft.nodes.filter(n=>n.path.length===2).at(-1)!.id,steps:[{name:'B 已開啟',action:'assertVisible',using:'id',value:'details',actor:'receiver'}]}]}};
   default:return {kind:'finish',result:'draft',summary:'雙機草稿，尚未驗證'};
  }
 },device:async(task,tool:any)=>{operated.push(task.serial+':'+tool.kind);return {xml:'<hierarchy><node resource-id="open"/></hierarchy>',fingerprint:'a'.repeat(64),accepted:true,...(tool.kind==='tap'?{replayStep:{name:'點開名片',action:'click',using:'id',value:'open'}}:{})};},release:async()=>{},verify:async()=>({status:'passed',message:''})});
 const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',headers:{'x-archify-user':'alice'},payload:{requestId:randomUUID(),scriptId:'dual-author',threadId:'t',source:source(),serial:'emulator-5554',bindings:{sender:'emulator-5554',receiver:'emulator-5556'},activeActor:'sender',question:'補上另一台手機確認'}})).json();
 const result=await settled(app,created.id);assert.equal(result.state,'ready',result.message);assert.ok(operated.includes('emulator-5556:tap'));assert.ok(result.events.find((e:any)=>e.kind==='tap').recorded);assert.equal(result.verification,undefined);await app.close();
});

test('a user switch during planning discards the old action and clears cross-phone evidence',async()=>{
 const app=Fastify(),store=memoryAgentTasks();let ready:()=>void=()=>{},release:(v:unknown)=>void=()=>{};const thinking=new Promise<void>(r=>ready=r);let plans=0;const operated:string[]=[];
 registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async(task)=>{
  if(plans++===0){ready();return new Promise(r=>release=r);}
  assert.equal(task.serial,'emulator-5556');assert.equal(task.activeActor,'receiver');
  if(plans===2){assert.equal(task.observations.length,0);return {kind:'observe'};}
  return {kind:'finish',result:'answer',summary:'已確認切換'};
 },device:async(task,tool:any)=>{operated.push(task.serial+':'+tool.kind);return {xml:'<hierarchy/>',fingerprint:'a'.repeat(64)};},release:async()=>{},verify:async()=>({status:'passed',message:''})});
 const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',headers:{'x-archify-user':'alice'},payload:{requestId:randomUUID(),scriptId:'switch',threadId:'t',source:source(),serial:'emulator-5554',question:'看手機'}})).json();await thinking;
 const url='/api/android/agent-tasks/'+created.id+'/device',payload={serial:'emulator-5556',bindings:{sender:'emulator-5554',receiver:'emulator-5556'},activeActor:'receiver'};
 assert.equal((await app.inject({method:'POST',url,headers:{'x-archify-user':'bob'},payload})).statusCode,404);
 assert.equal((await app.inject({method:'POST',url,headers:{'x-archify-user':'alice'},payload:{...payload,bindings:{sender:'emulator-5556',receiver:'emulator-5556'}}})).statusCode,400);
 assert.equal((await app.inject({method:'POST',url,headers:{'x-archify-user':'alice'},payload})).statusCode,200);
 release({kind:'tap',locator:{kind:'id',value:'old-a'}});const result=await settled(app,created.id);assert.equal(result.state,'ready',result.message);assert.deepEqual(operated,['emulator-5556:observe']);await app.close();
});

test('agent verification dispatches both bindings and reserves both phones until completion',async()=>{
 const app=Fastify(),profiles=memoryAndroidProfiles(),session=randomUUID(),devices:any[]=[];
 for(const [serial,owner]of [['emulator-5554','alice'],['emulator-5556','alice'],['emulator-5558','bob']]){const id=randomUUID(),avd='Archify_Device_'+id.replaceAll('-','');await profiles.put({id,owner,name:serial,avd,state:'ready'});devices.push({serial,state:'device',booted:true,managed:true,avd,profileId:id,error:''});}
 const android=registerAndroid(app,profiles,{runs:(await import('../src/androidRuns.ts')).memoryAndroidRuns(),script:async()=>undefined});
 const post=(url:string,payload:any)=>app.inject({method:'POST',url,headers:{'x-archify-user':'alice'},payload});
 await post('/internal/android/status',{session,status:{sdk:{ready:true,path:'/sdk'},avds:[],devices,appium:{reachable:true,ready:true,multiDevice:true,agentTasks:true},issues:[]}});
 const dual=`export const flow=${JSON.stringify({appPackage:'com.android.settings',actors:['sender','receiver'],steps:[{name:'A',action:'assertAppForeground',actor:'sender'},{name:'B',action:'assertAppForeground',actor:'receiver'}]})} as const;`,bindings={sender:'emulator-5554',receiver:'emulator-5556'};
 await assert.rejects(android.verifyAgent(bindings.sender,'alice','task',dual,{...bindings,receiver:'emulator-5558'}),/自己/);
 const pending=android.verifyAgent(bindings.sender,'alice','task',dual,bindings);await pause(10);
 for(const serial of Object.values(bindings))assert.equal((await post('/api/android/devices/'+serial+'/input',{action:'home'})).statusCode,409);
 const command=(await post('/internal/android/claim',{session})).json();assert.deepEqual(command.payload.bindings,bindings);assert.equal(command.serial,bindings.sender);
 await post('/internal/android/result/'+command.id,{session,result:{status:'passed',completed:2,message:'checked',steps:[{name:'A',status:'passed'},{name:'B',status:'passed'}]}});
 assert.equal((await pending).status,'passed');await app.close();
});
