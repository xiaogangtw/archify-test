import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setImmediate as turn} from 'node:timers/promises';
import Fastify from 'fastify';
import limits from '../src/llmTimeouts.json' with {type:'json'};
import {registerAndroidAgentTasks,memoryAgentTasks} from '../src/androidAgentTasks.ts';
import {androidDecision} from '../src/androidDecision.ts';

test('a 30-second decision timeout asks the user, retains evidence and ignores late actions after resuming',async t=>{
 assert.equal(limits.androidDecisionMs,30000);
 t.mock.timers.enable({apis:['setTimeout']});
 const app=Fastify(),store=memoryAgentTasks();
 let started!:()=>void,late!:(value:unknown)=>void,plans=0,deviceActions=0;
 const thinking=new Promise<void>(resolve=>{started=resolve;});
 const source='export const flow={appPackage:"com.example.app",steps:[{name:"確認起點",action:"assertAppForeground"}]} as const;';
 registerAndroidAgentTasks(app,{store,references:async()=>[],
  plan:async()=>{
   plans++;
   if(plans===1)return {kind:'observe'};
   if(plans===2)return {kind:'verify'};
   if(plans===3){started();return new Promise(resolve=>{late=resolve;});}
   return {kind:'ask',question:'請確認目前畫面',options:[]};
  },
  device:async(_task,tool:any)=>{if(tool.kind!=='observe')deviceActions++;return {xml:'<hierarchy><node text="實際畫面"/></hierarchy>',fingerprint:'a'.repeat(64)};},
  release:async()=>{},verify:async()=>({status:'failed',message:'相機許可視窗文字不符合預期。'})});
 const headers={'x-archify-user':'alice'},payload={requestId:randomUUID(),scriptId:'case',threadId:'chat',source,serial:'emulator-5554',question:'幫我寫測試'};
 try{
  const created=(await app.inject({method:'POST',url:'/api/android/agent-tasks',headers,payload})).json();
  await thinking;
  t.mock.timers.tick(29999);await turn();
  assert.equal((await store.get(created.id))?.state,'running');
  t.mock.timers.tick(1);
  for(let i=0;i<20&&(await store.get(created.id))?.state==='running';i++)await turn();
  const paused=(await app.inject({url:'/api/android/agent-tasks/'+created.id,headers})).json();
  assert.equal(paused.state,'waiting');assert.match(paused.question.prompt,/30 秒/);
  assert.match(paused.question.prompt,/相機許可視窗/);assert.equal(paused.draft.source,source);
  assert.ok((await store.recall(created.id,'實際畫面')).length);
  assert.ok(paused.events.some((item:any)=>item.kind==='decisionTimeout'));
  const revision=paused.revision;
  await app.inject({method:'POST',url:'/api/android/agent-tasks',headers,payload:{...payload,requestId:randomUUID(),question:'目前在相機畫面，請繼續'}});
  for(let i=0;i<20&&(await store.get(created.id))?.state==='running';i++)await turn();
  late({kind:'tap',locator:{kind:'text',value:'不應點擊'}});await turn();
  const resumed=await store.get(created.id);
  assert.equal(deviceActions,0);assert.equal(resumed?.state,'waiting');
  assert.equal(resumed?.question?.prompt,'請確認目前畫面');assert.ok(resumed!.revision>revision);
 }finally{await app.close();t.mock.timers.reset();}
});

test('fast decisions and service errors retain their original result',async()=>{
 assert.deepEqual(await androidDecision(async()=>({kind:'observe'})),{kind:'observe'});
 await assert.rejects(androidDecision(async()=>{throw new Error('模型連線失敗');}),/模型連線失敗/);
});
