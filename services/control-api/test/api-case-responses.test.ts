import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {registerApiCaseResponses} from '../src/apiCaseResponses.ts';
import {editableRequestSchema} from '../src/requestTransport.ts';

test('positive/negative case responses survive reload, isolate projects and preserve request/revision identity',async()=>{
 const positive=randomUUID(),negative=randomUUID();const request=editableRequestSchema.parse({environmentId:'dev',method:'POST',endpoint:'{{BASE_URL}}',body:'{"scopeId":"test"}'});
 const cases=[{id:positive,projectId:'p',version:1,requestId:'login',name:'正向登入',scenario:'positive',request},{id:negative,projectId:'p',version:1,requestId:'login',name:'缺少 scopeId',scenario:'negative',request:{...request,body:'{}',expectedStatus:400}}];
 const runs=cases.map(item=>({id:randomUUID(),projectId:'p',request_key:'login',status:'passed',created_at:'2026-10-25T00:00:00Z',body:{caseId:item.id,caseVersion:1,request:item.request,result:{status:item.request.expectedStatus,body:item.scenario==='positive'?'{}':'{"error":"MISSING_SCOPE"}',checks:[]}}}));
 const snapshots=new Map<string,any>();
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('FROM api_cases'))return {rows:cases.filter(item=>item.id===args[0]&&item.projectId===args[1]).map(body=>({body}))};
  if(sql.startsWith('SELECT id,status,body,request_key'))return {rows:runs.filter(item=>item.id===args[0]&&item.projectId===args[1]).map(item=>structuredClone(item))};
  if(sql.startsWith('SELECT id,status,body,created_at'))return {rows:runs.filter(item=>item.projectId===args[0]&&(item.body as any).caseId===args[1]&&!(item.body as any).deletedAt)};
  if(sql.startsWith('SELECT body FROM api_case_responses'))return {rows:snapshots.has(args[1])?[{body:snapshots.get(args[1])}]:[]};
  if(sql.startsWith('INSERT INTO api_case_responses')){snapshots.set(args[0],JSON.parse(args[3]));return {rows:[],rowCount:1};}
  throw new Error('Unexpected SQL '+sql);
 }};
 function server(){const app=Fastify();registerApiCaseResponses(app,{pool:db,transaction:async(fn:any)=>fn(db),project:async()=>{}});return app;}
 let app=server();assert.equal(snapshots.size,0,'executing does not automatically save case responses');
 for(let index=0;index<cases.length;index++){const response=await app.inject({method:'POST',url:'/api/api-library/p/cases/'+cases[index].id+'/responses',payload:{runId:runs[index].id,caseVersion:1}});assert.equal(response.statusCode,200);assert.equal(response.json().body.scenario,cases[index].scenario);}
 const wrong=await app.inject({method:'POST',url:'/api/api-library/p/cases/'+negative+'/responses',payload:{runId:runs[0].id,caseVersion:1}});assert.equal(wrong.statusCode,409);
 await app.close();app=server();
 const restored=await app.inject({method:'GET',url:'/api/api-library/p/cases/'+negative+'/responses'});assert.equal(restored.json().length,1);assert.equal(restored.json()[0].body.result.body,'{"error":"MISSING_SCOPE"}');assert.equal(restored.json()[0].body.caseVersion,1);
 assert.equal((await app.inject({method:'GET',url:'/api/api-library/q/cases/'+negative+'/responses'})).statusCode,404);
 cases[1].version=2;const reSave=(await app.inject({method:'POST',url:'/api/api-library/p/cases/'+negative+'/responses',payload:{runId:runs[1].id,caseVersion:2}}));assert.equal(reSave.statusCode,200);assert.equal(reSave.json().body.caseVersion,1);assert.equal(snapshots.size,2,'explicit re-save replaces the same case slot');
 const replacement={...structuredClone(runs[0]),id:randomUUID(),status:'failed',body:{...structuredClone(runs[0].body),result:{status:500,body:'{"error":"SERVER_ERROR"}',checks:[]}}};runs.push(replacement);const replaced=await app.inject({method:'POST',url:'/api/api-library/p/cases/'+positive+'/responses',payload:{runId:replacement.id,caseVersion:1}});assert.equal(replaced.statusCode,200);assert.equal(snapshots.size,2);assert.equal(snapshots.get(positive).id,replacement.id,'a second explicit save overwrites the single saved response');assert.equal(snapshots.get(positive).status,'failed','saving a failed response never relabels it as passed');
 const unrelated={...structuredClone(runs[0]),id:randomUUID(),body:{request:{...request,body:'{"scopeId":"different"}'},result:{body:'{}'}}};runs.push(unrelated as any);
 assert.equal((await app.inject({method:'POST',url:'/api/api-library/p/cases/'+positive+'/responses',payload:{runId:unrelated.id,caseVersion:1}})).statusCode,409,'cannot attach a response from different input');
 assert.notEqual((await app.inject({method:'POST',url:'/api/api-library/p/cases/'+positive+'/responses',payload:{runId:runs[0].id,caseVersion:1,result:{body:'invented'}}})).statusCode,200,'response data is server-owned; clients cannot fabricate it');
 await app.close();
});
