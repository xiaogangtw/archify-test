import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {assertAgentRequest,validateWorkflowPlan,caseFingerprint,registerApiWorkflow} from '../src/apiWorkflow.ts';
import {editableRequestSchema,executeRequest,environmentSchema,importSchema} from '../src/requestTransport.ts';
const request=()=>editableRequestSchema.parse({environmentId:'dev',method:'POST',endpoint:'{{BASE_URL}}',body:'{"query":"query Item { item }"}',operationName:'Item',assertions:[{path:'data.item',operator:'equals',value:'ok'}]});
const catalog:any={id:randomUUID(),version:1,revision:1,requests:[{id:'r',name:'Item',method:'POST',endpoint:'{{BASE_URL}}',kind:'graphql',body:request().body,operationName:'Item',definitionHash:'h'}]};
const plan=()=>({reply:'新增指定案例',steps:[{requestId:'r',name:'讀取項目',scenario:'positive',request:request(),save:'always',execute:false}]});

test('agent plan has no deletion/overwrite tool and cannot escape source, scope or environment',()=>{
 assert.equal(validateWorkflowPlan(plan(),catalog,'dev',['r']).steps.length,1);
 for(const change of [{method:'DELETE'},{endpoint:'https://other.test'},{environmentId:'qa'},{body:'{"query":"mutation Remove { deleteItem }"}'}])assert.throws(()=>validateWorkflowPlan({...plan(),steps:[{...plan().steps[0],request:{...request(),...change}}]},catalog,'dev',['r']));
 assert.throws(()=>validateWorkflowPlan(plan(),catalog,'dev',[]));
 assert.throws(()=>validateWorkflowPlan({...plan(),deleteCase:'x'},catalog,'dev',['r']));
 assert.throws(()=>assertAgentRequest({...request(),body:'{"query":"mutation { alias: removeUser }"}'}));
 assert.throws(()=>assertAgentRequest({...request(),endpoint:'/users/delete'}));
 assert.equal(caseFingerprint({requestId:'r',scenario:'positive',request:request()}),caseFingerprint({requestId:'r',scenario:'positive',request:Object.fromEntries(Object.entries(request()).reverse()) as any}));
});

test('negative GraphQL passes only explicit expected error checks and never captures an accidental failure',async()=>{
 const environment=environmentSchema.parse({id:'dev',name:'Dev',baseUrl:'https://example.test/graphql'});const schema=importSchema('type Query { item: String }');
 const input={...request(),expectedGraphqlErrors:true,assertions:[{path:'errors.0.extensions.code',operator:'equals' as const,value:'UNAUTHENTICATED'}]};let sends=0;
 const send=(code:string)=>async()=>{sends++;return {status:200,contentType:'application/json',body:JSON.stringify({errors:[{extensions:{code}}]})};};
 assert.equal((await executeRequest(environment,input,schema,send('UNAUTHENTICATED'))).outcome,'passed');
 assert.equal((await executeRequest(environment,input,schema,send('INTERNAL_SERVER_ERROR'))).outcome,'failed');
 await assert.rejects(executeRequest(environment,{...input,assertions:[]},schema,send('UNAUTHENTICATED')),/明確檢查/);assert.equal(sends,2,'missing error assertion must fail before transport');
 const required=importSchema('type Query { item(id: ID!): String }');const missing={...input,body:'{"query":"query Item($id: ID!) { item(id:$id) }"}',variables:{},expectedStatus:400,assertions:[{path:'errors.0.extensions.code',operator:'equals' as const,value:'BAD_USER_INPUT'}]};
 const rejected=await executeRequest(environment,missing,required,async()=>({status:400,contentType:'application/json',body:'{"errors":[{"extensions":{"code":"BAD_USER_INPUT"}}]}'}));assert.equal(rejected.outcome,'passed','an explicit missing-variable negative test reaches the server and checks the exact expected rejection');
});

test('saved API flow runs its immutable case revision and rejects a changed catalog',async()=>{
 const caseId=randomUUID();const script={id:'flow',version:1,name:'登入流程',apiFlow:{projectId:'p',catalogId:catalog.id,catalogRevision:1,environmentId:'dev',cases:[{id:caseId,version:2}]}};let job:any;const source=structuredClone(catalog);
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('JOIN script_versions'))return {rows:[{body:script}]};
  if(sql.includes('FROM api_case_versions')){assert.deepEqual(args,[caseId,2]);return {rows:[{body:{id:caseId,version:2,projectId:'p',requestId:'r',name:'舊版案例',request:request(),scenario:'positive'}}]};}
  if(sql.includes('pg_advisory')||sql.includes("body->>'scriptId'"))return {rows:[]};
  if(sql.startsWith('INSERT INTO api_workflow_jobs')){job={id:args[0],project_id:args[1],status:'queued',body:JSON.parse(args[2])};return {rows:[]};}
  if(sql.startsWith('SELECT * FROM api_workflow_jobs'))return {rows:[job]};
  throw new Error('Unexpected SQL '+sql);
 }};
 const app=Fastify();registerApiWorkflow(app,{pool:db,transaction:async(fn:any)=>fn(db),project:async()=>{},catalog:async()=>source,environments:async()=>[]});
 const input={requestId:randomUUID(),version:1};const result=await app.inject({method:'POST',url:'/api/scripts/flow/api-execute',payload:input});assert.equal(result.statusCode,202);assert.equal(job.body.caseRefs[0].version,2);assert.equal(job.body.plan.steps[0].name,'舊版案例');assert.equal(job.body.plan.steps[0].save,'never');
 source.revision=2;const stale=await app.inject({method:'POST',url:'/api/scripts/flow/api-execute',payload:{...input,requestId:randomUUID()}});assert.equal(stale.statusCode,409);
 await app.close();
});

for(const mode of ['draft','execute','no-permission','failure','reuse','malformed','stop','script'] as const)test('persistent workflow '+mode,async()=>{
 const jobs=new Map<string,any>();const cases:any[]=[];let sends=0;let saves=0;const scripts=new Map<string,any>();const source=structuredClone(catalog);
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.startsWith('INSERT INTO api_workflow_jobs')){if(!jobs.has(args[0]))jobs.set(args[0],{id:args[0],project_id:args[1],status:'queued',body:JSON.parse(args[2])});return {rows:[]};}
  if(sql.startsWith('SELECT id FROM api_workflow_jobs'))return {rows:[...jobs.values()].filter(job=>job.status==='queued').slice(0,1)};
  if(sql.startsWith("UPDATE api_workflow_jobs SET status='running'")){const job=jobs.get(args[0]);job.status='running';return {rows:[structuredClone(job)]};}
  if(sql.includes("updated_at<now()"))return {rows:[]};
  if(sql.startsWith('SELECT status,body FROM api_workflow_jobs'))return {rows:[jobs.get(args[0])]};
  if(sql.startsWith('SELECT * FROM api_workflow_jobs'))return {rows:sql.includes('WHERE id=$1')?[jobs.get(args[0])].filter(job=>job&&job.project_id===args[1]):[...jobs.values()].filter(job=>job.project_id===args[0])};
  if(sql.startsWith('UPDATE api_workflow_jobs SET body=')){const job=jobs.get(args[0]);job.body={...JSON.parse(args[1]),cancelRequested:job.body.cancelRequested||false};return {rows:[]};}
  if(sql.startsWith('UPDATE api_workflow_jobs SET status=')){const job=jobs.get(args[0]);job.status=sql.includes("status='failed'")?'failed':sql.includes("status='cancelled'")?'cancelled':args[2];job.body=JSON.parse(args[1]);return {rows:[]};}
  if(sql.startsWith('UPDATE api_request_runs'))return {rows:[],rowCount:1};
  if(sql.includes('pg_advisory'))return {rows:[]};
  if(sql.startsWith('SELECT version FROM scripts'))return {rows:scripts.has(args[0])?[{version:1}]:[]};
  if(sql.startsWith('INSERT INTO scripts')){scripts.set(args[0],{});return {rows:[]};}
  if(sql.startsWith('INSERT INTO script_versions')){scripts.set(args[0],JSON.parse(args[1]));return {rows:[]};}
  if(sql.includes('FROM api_cases'))return {rows:cases.map(body=>({body}))};
  throw new Error('Unexpected SQL '+sql);
 }};
 const app=Fastify();app.post('/api/api-library/p/execute',async()=>{sends++;if(mode==='stop'){const job=[...jobs.values()][0];job.body.cancelRequested=true;}return {id:randomUUID(),status:mode==='failure'?'failed':'passed',body:{result:{message:'檢查已評估'}}};});
 app.post('/api/api-library/p/cases',async req=>{saves++;const body={...(req.body as any),id:randomUUID(),projectId:'p',version:1};cases.push(body);return body;});
 const planned:any=plan();if(['execute','no-permission','failure','stop'].includes(mode))planned.steps[0].execute=true;
 if(mode==='script')planned.script={name:'會員流程'};
 if(mode==='failure'||mode==='stop')planned.steps.push({...planned.steps[0],name:'後續不得發送'});
 if(mode==='reuse')cases.push({id:randomUUID(),projectId:'p',version:1,requestId:'r',scenario:'positive',request:request()});
 const worker=registerApiWorkflow(app,{pool:db,transaction:async(fn:any)=>fn(db),project:async id=>{if(id!=='p')throw Object.assign(new Error('missing'),{statusCode:404});},catalog:async()=>source,environments:async()=>[{id:'dev'}],plan:async()=>({reply:mode==='malformed'?'not JSON':JSON.stringify(planned)})});
 const input={requestId:randomUUID(),catalogId:source.id,environmentId:'dev',requestIds:['r'],question:'建立測試',allowExecution:mode!=='no-permission'};
 const response=await app.inject({method:'POST',url:'/api/api-library/p/assistant',payload:input});assert.equal(response.statusCode,202);
 await worker.tick();const job=jobs.get(input.requestId);assert.equal(job.status,mode==='stop'?'cancelled':['no-permission','malformed','failure'].includes(mode)?'failed':'completed');
 assert.equal(sends,['execute','failure','stop'].includes(mode)?1:0);assert.equal(saves,['no-permission','malformed','reuse'].includes(mode)?0:1);
 if(mode==='script'){assert.ok(job.body.scriptId);assert.equal(scripts.size,1);assert.equal(scripts.get(job.body.scriptId).apiFlow.cases[0].id,cases[0].id);}
 if(mode==='failure')assert.equal(job.body.tasks[1].status,'skipped');
 const repeated=await app.inject({method:'POST',url:'/api/api-library/p/assistant',payload:input});assert.equal(repeated.json().id,input.requestId);assert.equal(jobs.size,1);
 const view=await app.inject({method:'GET',url:'/api/api-library/p/assistant'});assert.equal(view.json()[0].context,undefined);assert.equal(view.json()[0].plan,undefined);
 const other=await app.inject({method:'GET',url:'/api/api-library/q/assistant'});assert.equal(other.statusCode,404);
 await app.close();
});

test('manual conversion pins destructive saved cases without sending requests and rejects foreign/stale input',async()=>{
 const ref=randomUUID();let foreign=false,saved:any;
 const deletion={...request(),body:'{"query":"mutation Delete { deleteAccount }"}',operationName:'Delete'};
 const definition={...catalog,requests:[{...catalog.requests[0],body:'{"query":"mutation LatestDelete { deleteAccount }"}',operationName:'LatestDelete'}]};
 const previous={id:'existing',version:5,name:'刪除帳號',projectId:'p',source:'old Playwright source',messages:[],caseType:'test'};
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('JOIN script_versions'))return {rows:[{body:previous}]};
  if(sql.includes('FROM api_case_versions'))return {rows:[{body:{id:ref,version:1,projectId:foreign?'other':'p',requestId:'r',name:'刪除帳號',request:deletion}}]};
  if(sql.includes('FROM scripts WHERE'))return {rows:[{version:5,case_number:8}]};
  if(sql.includes('FROM documents'))return {rows:[{value:{folders:[],scriptFolders:{}}}]};
  if(sql.includes('FROM script_versions'))return {rows:[{body:previous}]};
  if(sql.startsWith('INSERT INTO scripts('))return {rows:[{case_number:8}]};
  if(sql.startsWith('UPDATE scripts SET test_case_number'))return {rows:[{test_case_number:1}]};
  if(sql.startsWith('INSERT INTO script_versions')){saved=JSON.parse(args[2]);return {rows:[]};}
  if(sql.includes('pg_advisory'))return {rows:[]};
  throw new Error('Unexpected SQL '+sql);
 }};
 const app=Fastify();registerApiWorkflow(app,{pool:db,transaction:async(fn:any)=>fn(db),project:async()=>{},catalog:async()=>definition,environments:async()=>[{id:'dev'}]});
 try{
  const payload={version:5,projectId:'p',catalogId:catalog.id,environmentId:'dev',cases:[{id:ref,version:1}]};
  const result=await app.inject({method:'POST',url:'/api/scripts/existing/api-flow',payload});
  assert.equal(result.statusCode,200,result.body);assert.equal(saved.version,6);assert.equal(saved.caseCode,'TC-000001');assert.equal(saved.apiFlow.cases[0].id,ref);assert.match(saved.source,/伺服器 API 流程/);assert.equal(previous.source,'old Playwright source');
  foreign=true;assert.equal((await app.inject({method:'POST',url:'/api/scripts/existing/api-flow',payload})).statusCode,404);
  foreign=false;assert.equal((await app.inject({method:'POST',url:'/api/scripts/existing/api-flow',payload:{...payload,version:4}})).statusCode,409);
  assert.throws(()=>validateWorkflowPlan({reply:'agent',steps:[{requestId:'r',name:'刪除',scenario:'positive',request:deletion,execute:true,save:'never'}]},definition,'dev',['r']),/GraphQL/);
 }finally{await app.close();}
});
