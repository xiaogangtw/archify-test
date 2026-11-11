import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {registerApiCaseResponses} from '../src/apiCaseResponses.ts';

test('case rename preserves revisions; deletion isolates projects and refuses active work',async()=>{
 const id=randomUUID();let body:any={id,projectId:'p',version:1,name:'Original',requestId:'login',request:{body:'{}'}};
 const versions=[structuredClone(body)];let activeRun=false,activeWorkflow=false;
 let document:any={cases:[{id,name:'Original',version:1}],scripts:[{caseId:id,version:1}]};
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('pg_advisory'))return {rows:[]};
  if(sql.includes('FROM api_cases'))return {rows:args[0]===id&&args[1]==='p'?[{body:structuredClone(body)}]:[]};
  if(sql.includes('FROM api_request_runs'))return {rows:activeRun?[{id:'active'}]:[]};
  if(sql.includes('FROM api_workflow_jobs'))return {rows:activeWorkflow?[{id:'active'}]:[]};
  if(sql.startsWith('UPDATE api_cases')){body=JSON.parse(args[sql.includes('version=$3')?3:2]);return {rows:[]};}
  if(sql.startsWith('INSERT INTO api_case_versions')){versions.push(JSON.parse(args[2]));return {rows:[]};}
  if(sql.includes('FROM documents'))return {rows:[{value:structuredClone(document)}]};
  if(sql.startsWith('UPDATE documents')){document=JSON.parse(args[1]);return {rows:[]};}
  throw new Error('Unexpected SQL '+sql);
 }};
 const app=Fastify();registerApiCaseResponses(app,{pool:db,transaction:async(fn:any)=>fn(db),project:async()=>{}});
 const url='/api/api-library/p/cases/'+id;
 const rename=(version:number,name:string)=>app.inject({method:'PATCH',url,payload:{version,name}});
 assert.equal((await app.inject({method:'PATCH',url:url.replace('/p/','/other/'),payload:{version:1,name:'Other'}})).statusCode,404);
 assert.equal((await rename(1,'Renamed')).statusCode,200);assert.equal(body.version,2);assert.equal(document.cases[0].name,'Renamed');assert.equal(versions[0].name,'Original');
 assert.equal((await rename(2,'Renamed')).statusCode,200);assert.equal(versions.length,2);
 assert.equal((await rename(1,'Stale')).statusCode,409);
 const remove=()=>app.inject({method:'DELETE',url,payload:{version:2}});
 activeRun=true;assert.equal((await remove()).statusCode,409);activeRun=false;
 activeWorkflow=true;assert.equal((await remove()).statusCode,409);activeWorkflow=false;
 assert.equal((await remove()).statusCode,200);assert.ok(body.deletedAt);assert.equal(document.cases.length,0);assert.equal(document.scripts[0].caseId,id);assert.equal(versions.length,2);
 assert.equal((await rename(2,'Restore')).statusCode,404);assert.equal((await app.inject({method:'GET',url:url+'/responses'})).statusCode,404);
 await app.close();
});
