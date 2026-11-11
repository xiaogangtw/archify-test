import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {registerAndroidAgentTasks,memoryAgentTasks,agentToolSchema,redactAgentXml} from '../src/androidAgentTasks.ts';
const source='export const flow={appPackage:"com.example.app",steps:[{name:"確認",action:"assertAppForeground"}]} as const;';
const headers={'x-archify-user':'alice'};
async function settled(app:any,id:string){for(let i=0;i<200;i++){const row=(await app.inject({url:'/api/android/agent-tasks/'+id,headers})).json();if(row.state!=='running')return row;await pause(5);}throw new Error('did not settle');}
const create=(app:any)=>app.inject({method:'POST',url:'/api/android/agent-tasks',headers,payload:{requestId:randomUUID(),scriptId:'s',threadId:'t',source,serial:'emulator-5554',question:'尋找Email'}});
test('swipe contract accepts fine movement, rejects offscreen regions and retains geometry without input text',()=>{
 assert.equal(agentToolSchema.parse({kind:'swipe',direction:'down',percent:.1,area:{left:.1,top:.3,width:.8,height:.4}}).kind,'swipe');
 assert.throws(()=>agentToolSchema.parse({kind:'swipe',direction:'up',percent:0}));
 assert.throws(()=>agentToolSchema.parse({kind:'swipe',direction:'up',area:{left:.8,top:0,width:.5,height:.5}}));
 const xml=redactAgentXml('<node class="android.widget.EditText" text="secret" bounds="[0,100][300,200]"/>');
 assert.match(xml,/bounds="\[0,100\]\[300,200\]"/);assert.ok(!xml.includes('secret'));
});
test('a correction discards an in-flight plan and forces observation before another action',async()=>{
 const app=Fastify(),store=memoryAgentTasks();let unblock!:()=>void,entered!:()=>void;
 const started=new Promise<void>(r=>entered=r),blocked=new Promise<void>(r=>unblock=r);let plans=0,mutations=0;
 registerAndroidAgentTasks(app,{store,references:async()=>[],plan:async(task,ctx:any)=>{
  if(plans++===0){entered();await blocked;return {kind:'swipe',direction:'up'};}
  assert.equal(task.messages.at(-1)?.content,'滑過頭，往回一點');
  if(plans===2)return {kind:'swipe',direction:'down'};
  if(plans===3){assert.match(ctx.feedback,/observe/);return {kind:'observe'};}
  return {kind:'ask',question:'已重新觀察',options:[]};
 },device:async(_task,tool:any)=>{if(tool.kind!=='observe')mutations++;return {xml:'<hierarchy/>',fingerprint:'a'.repeat(64)};},release:async()=>{},verify:async()=>({status:'failed',message:''})});
 const created=(await create(app)).json();await started;
 const requestId=randomUUID(),payload={requestId,question:'滑過頭，往回一點'};
 const denied=await app.inject({method:'POST',url:'/api/android/agent-tasks/'+created.id+'/corrections',headers:{'x-archify-user':'bob'},payload});assert.equal(denied.statusCode,404);
 for(let i=0;i<2;i++)assert.ok((await app.inject({method:'POST',url:'/api/android/agent-tasks/'+created.id+'/corrections',headers,payload})).statusCode<300);
 unblock();const result=await settled(app,created.id);assert.equal(result.state,'waiting');assert.equal(mutations,0);
 assert.equal((await store.get(created.id))!.messages.filter(m=>m.content===payload.question).length,1);await app.close();
});
test('two unchanged swipes stop exploration instead of repeating until the turn limit',async()=>{
 const app=Fastify();let swipes=0;
 registerAndroidAgentTasks(app,{store:memoryAgentTasks(),references:async()=>[],plan:async()=>({kind:'swipe',direction:'up',percent:.1}),device:async(_task,tool:any)=>{if(tool.kind==='swipe')swipes++;return {accepted:true,xml:'<hierarchy><node bounds="[0,0][100,100]"/></hierarchy>',fingerprint:'a'.repeat(64)};},release:async()=>{},verify:async()=>({status:'failed',message:''})});
 const created=(await create(app)).json(),result=await settled(app,created.id);assert.equal(swipes,2);assert.equal(result.state,'uncertain');assert.match(result.message,/沒有變化/);await app.close();
});
