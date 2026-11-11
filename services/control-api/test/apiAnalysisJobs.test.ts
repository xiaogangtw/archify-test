import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerApiAnalysis,analysisView} from '../src/apiAnalysisJobs.ts';
import {apiAnalysisVersion} from '../src/apiAnalysis.ts';

for(const scenario of ['success','cancel','conflict','failure'] as const)test(`background analysis: ${scenario}`,async()=>{
 process.env.NODE_ENV='test';
 const app=Fastify();let calls=0;let saved:any;
 const job:any={id:'job',project_id:'original',status:'queued',cancel_requested:false,body:{project:{},baseline:null,items:[],completed:0}};
 const db={async query(sql:string,args:any[]=[]):Promise<any>{
  if(sql.includes('lease_until<now()'))return {rows:[]};
  if(sql.startsWith('SELECT id FROM api_analysis_jobs'))return {rows:job.status==='queued'?[{id:job.id}]:[]};
  if(sql.includes("SET status='running'")){job.status='running';job.lease_token=args[1];return {rows:[job]};}
  if(sql.startsWith('SELECT cancel_requested') || sql.startsWith('SELECT status,'))return {rows:[job]};
  if(sql.startsWith('SELECT value FROM documents'))return {rows:scenario==='conflict'?[{value:{original:{edited:true}}}]:[]};
  if(sql.startsWith('INSERT INTO documents'))saved=JSON.parse(args[1]);
  if(sql.includes("SET status='succeeded'")){job.status='succeeded';job.body=JSON.parse(args[1]);}
  if(sql.includes('SET status=$3')){job.status=args[2];job.body=JSON.parse(args[3]);}
  return {rows:[]};
 }};
 app.post('/api/llm',async()=>{calls++;if(scenario==='cancel')job.cancel_requested=true;if(scenario==='failure')throw new Error('model unavailable');return {reply:JSON.stringify([{name:'Get items',method:'GET',endpoint:'/items',operationName:'',requestBody:'',variables:'',authReference:'',preconditions:'',assertions:'',missing:'auth',evidence:'src/api.ts:1'}])};});
 const worker=registerApiAnalysis(app,{db,tx:async fn=>fn(db),connections:async()=>[],capture:async()=>({id:'snapshot',files:[{path:'src/api.ts',source:'export const getItems = () => fetch("/items");'}]})});
 await app.ready();await worker.tick();await worker.tick();
 assert.equal(calls,1,'completed jobs must never be resent');
 assert.equal(job.status,scenario==='cancel'?'cancelled':scenario==='failure'?'failed':'succeeded');
 assert.equal(Boolean(saved),scenario==='success');
 if(scenario==='success'){assert.equal(saved.original.items.length,1);assert.equal(job.body.completed,1);}
 if(scenario==='cancel')assert.equal(job.body.items.length,0,'discard responses after cancellation');
 if(scenario==='conflict'){assert.equal(job.body.saved,false);assert.equal(job.body.items.length,1);}
 assert.equal(analysisView(job).project,undefined);
 await app.close();
});

for(const legacy of [false,true])test(legacy?'legacy batches cannot resume with incomplete context':'resume keeps 5/10 checkpoint, original snapshot and drafts, retries only failed batch',async(t)=>{
 process.env.NODE_ENV='test';const app=Fastify();const sent:number[]=[];let fail=true;
 t.after(()=>app.close());
 const item={id:'kept',name:'Previous case',method:'GET',endpoint:'/previous',operationName:'',requestBody:'',variables:'',authReference:'',preconditions:'',assertions:'',missing:'auth',evidence:'src/api.ts:1'};
 const job:any={id:'00000000-0000-4000-8000-000000000001',project_id:'original',status:'failed',cancel_requested:false,body:{snapshotId:'original-snapshot',total:10,completed:5,items:[item],baseline:null}};
 const snapshot={id:'original-snapshot',apiAnalysisVersion:legacy?1:apiAnalysisVersion,files:[{path:'src/api.ts',source:'fetch("/items")'}],apiAnalysisParts:Array.from({length:10},()=>[{path:'src/api.ts',source:'fetch("/items")'}])};
 const db={async query(sql:string,args:any[]=[]):Promise<any>{
  if(sql.includes('lease_until<now()'))return {rows:[]};
  if(sql.startsWith('SELECT id FROM api_analysis_jobs'))return {rows:job.status==='queued'?[{id:job.id}]:[]};
  if(sql.startsWith('SELECT * FROM api_analysis_jobs'))return {rows:[job]};
  if(sql.startsWith('SELECT body FROM source_snapshots')){assert.equal(args[0],snapshot.id);return {rows:[{body:snapshot}]};}
  if(sql.includes("SET status='queued'")){job.status='queued';job.cancel_requested=false;job.body=JSON.parse(args[1]);return {rows:[job]};}
  if(sql.includes("SET status='running'")){job.status='running';job.lease_token=args[1];return {rows:[job]};}
  if(sql.startsWith('SELECT cancel_requested') || sql.startsWith('SELECT status,'))return {rows:[job]};
  if(sql.includes('SET status=$3')){job.status=args[2];job.body=JSON.parse(args[3]);}
  if(sql.includes("SET status='succeeded'")){job.status='succeeded';job.body=JSON.parse(args[1]);}
  if(sql.startsWith('INSERT INTO documents'))assert.equal(JSON.parse(args[1]).original.items[0].id,'kept');
  if(sql.startsWith('INSERT INTO source_snapshots'))assert.fail('must reuse original snapshot');
  return {rows:[]};
 }};
 app.post('/api/llm',async request=>{const part=(request.body as any).sourcePart;sent.push(part);if(fail)throw new Error('temporary CLI failure');return {reply:JSON.stringify([{...item,name:'New case '+part,endpoint:'/items/'+part}])};});
 const worker=registerApiAnalysis(app,{db,tx:async fn=>fn(db),connections:async()=>[],capture:async()=>{throw new Error('must not recapture changed source');}});await app.ready();
 const resume=()=>app.inject({method:'POST',url:`/api/api-analyses/${job.id}/resume`});
 assert.equal((await resume()).statusCode,200);await worker.tick();assert.equal(job.status,'failed');assert.equal(job.body.completed,5);assert.equal(job.body.items[0].id,'kept');
 if(legacy){assert.deepEqual(sent,[]);assert.match(job.body.message,/舊版分析分批/);return;}
 fail=false;await resume();await worker.tick();assert.equal(job.status,'succeeded');assert.equal(job.body.completed,10);assert.deepEqual(sent,[5,5,6,7,8,9]);assert.equal(job.body.items.length,6);
 assert.equal((await resume()).statusCode,409);await app.close();
});

test('new background analyses pin inherited global or agent-specific models before queueing',async()=>{
 const roles:any[]=[{id:'api-analyst',instructions:'API-specific role'}];let saved:any;
 const profiles:any[]=[{id:'global',name:'Global',provider:'codex',agentId:'planner',model:'model-global',enabled:true,globalDefault:true},{id:'special',name:'Special',provider:'gemini',agentId:'debug',model:'model-special',enabled:true}];
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('SELECT value FROM documents'))return {rows:[{value:args[0]==='archify.testing.v1'?{project:{id:'p'}}:args[0]==='archify.agents.v1'?roles:{}}]};
  if(sql.startsWith('INSERT INTO api_analysis_jobs')){saved={id:args[0],project_id:args[2],status:'queued',body:JSON.parse(args[3])};return {rows:[saved]};}
  return {rows:[]};
 }};
 const app=Fastify();registerApiAnalysis(app,{db,tx:async fn=>fn(db),connections:async()=>profiles,capture:async()=>{throw Error('queueing must not read source or invoke model');}});
 let response=await app.inject({method:'POST',url:'/api/api-analyses',payload:{requestId:'11111111-1111-4111-8111-111111111111',projectId:'p'}});assert.equal(response.statusCode,202,response.body);assert.equal(saved.body.connectionId,'global');assert.equal(saved.body.modelSelection.scope,'global');assert.equal(saved.body.modelSelection.requestedModel,'model-global');
 roles[0].modelConnectionId='special';roles[0].modelProvider='gemini';response=await app.inject({method:'POST',url:'/api/api-analyses',payload:{requestId:'22222222-2222-4222-8222-222222222222',projectId:'p'}});assert.equal(response.statusCode,202,response.body);assert.equal(saved.body.connectionId,'special');assert.equal(saved.body.modelSelection.scope,'agent');
 profiles[1].enabled=false;response=await app.inject({method:'POST',url:'/api/api-analyses',payload:{requestId:'33333333-3333-4333-8333-333333333333',projectId:'p'}});assert.equal(response.statusCode,409);await app.close();
});
