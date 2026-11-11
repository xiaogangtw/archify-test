import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {registerApiManagement} from '../src/apiManagement.ts';
import {editableRequestSchema} from '../src/requestTransport.ts';

test('interface create/edit/classification/delete and version rename/delete retain revisions and reject concurrent edits',async()=>{
 const id=randomUUID();let body:any={id,projectId:'p',version:1,revision:1,requests:[],changes:[]};const history:any[]=[];
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.startsWith('SELECT body FROM request_catalogs WHERE id'))return {rows:args[1]==='p'?[{body:structuredClone(body)}]:[]};
  if(sql.startsWith('SELECT body FROM request_catalogs WHERE project_id'))return {rows:[]};
  if(sql.startsWith('INSERT INTO api_catalog_revisions'))history.push(JSON.parse(args[2]));
  else if(sql.startsWith('UPDATE request_catalogs'))body=JSON.parse(args[1]);
  else if(!sql.includes('advisory'))throw new Error('Unexpected SQL '+sql);
  return {rows:[],rowCount:1};
 }};
 const app=Fastify();registerApiManagement(app,{pool:db,transaction:async(fn:any)=>fn(db),project:async()=>({}),catalog:async()=>body,environments:async()=>[]});
 const root='/api/api-library/p/versions/'+id;
 const request=editableRequestSchema.parse({environmentId:'dev',method:'POST',endpoint:'{{BASE_URL}}',expectedStatus:201,responseVariables:[{name:'authToken',path:'data.login.token'}]});
 let response=await app.inject({method:'PUT',url:root+'/requests',payload:{revision:1,name:'Login',category:'登入',kind:'http',request}});assert.equal(response.statusCode,200);assert.equal(body.revision,2);assert.equal(body.requests[0].category,'登入');assert.equal(body.requests[0].defaults.expectedStatus,201);assert.equal(body.requests[0].responseVariables[0].path,'data.login.token');const requestId=body.requests[0].id;
 response=await app.inject({method:'PUT',url:root+'/requests',payload:{revision:1,name:'Stale',kind:'http',request}});assert.equal(response.statusCode,409);assert.equal(body.requests.length,1);
 response=await app.inject({method:'PATCH',url:root,payload:{revision:2,name:'Release API'}});assert.equal(response.statusCode,200);assert.equal(body.name,'Release API');assert.equal(body.changes.length,1,'renaming must preserve source comparison');
 response=await app.inject({method:'DELETE',url:root+'/requests/'+encodeURIComponent(requestId),payload:{revision:3}});assert.equal(response.statusCode,200);assert.equal(body.requests.length,0);assert.equal(history[1].requests[0].name,'Login');
 response=await app.inject({method:'DELETE',url:root,payload:{revision:4}});assert.equal(response.statusCode,200);assert.ok(body.deletedAt);assert.equal(history.length,4);
 response=await app.inject({method:'PATCH',url:root,payload:{revision:5,name:'Restore'}});assert.equal(response.statusCode,404);await app.close();
});

test('legacy cleanup removes only this project draft payload; active jobs are cancelled before payload cleanup',async()=>{
 let active=true;const queries:{sql:string;args:any[]}[]=[];const db={query:async(sql:string,args:any[])=>{queries.push({sql,args});return {rows:sql.startsWith('SELECT id')&&active?[{id:'job'}]:[],rowCount:1};}};
 const app=Fastify();registerApiManagement(app,{pool:db,transaction:async(fn:any)=>fn(db),project:async()=>({}),catalog:async()=>({}),environments:async()=>[]});
 const first=await app.inject({method:'DELETE',url:'/api/api-library/p/legacy-drafts'});assert.equal(first.json().stopping,true);assert.ok(queries.some(item=>item.sql.includes('cancel_requested=true')));assert.ok(!queries.some(item=>item.sql.includes("body-'items'")));
 active=false;const second=await app.inject({method:'DELETE',url:'/api/api-library/p/legacy-drafts'});assert.equal(second.json().cleared,true);assert.ok(queries.some(item=>item.sql.includes("body-'items'")&&item.args[0]==='p'));assert.ok(!queries.some(item=>/^DELETE FROM api_analysis_jobs/.test(item.sql)));await app.close();
});

test('classification saves incomplete source requests without validating or replacing their payload and rejects stale revisions',async()=>{
 const id=randomUUID();let body:any={id,projectId:'p',version:1,revision:1,requests:[{id:'unresolved',method:'UNKNOWN',endpoint:'',body:'{{missing}}'}],changes:[]};
 const db={query:async(sql:string,args:any[])=>{if(sql.startsWith('SELECT body FROM request_catalogs WHERE id'))return {rows:args[1]==='p'?[{body:structuredClone(body)}]:[]};if(sql.startsWith('SELECT body FROM request_catalogs WHERE project_id'))return {rows:[]};if(sql.startsWith('UPDATE request_catalogs'))body=JSON.parse(args[1]);return {rows:[],rowCount:1};}};
 const app=Fastify();registerApiManagement(app,{pool:db,transaction:async(fn:any)=>fn(db),project:async()=>({}),catalog:async()=>body,environments:async()=>[]});const url='/api/api-library/p/versions/'+id+'/requests/unresolved/category';
 let response=await app.inject({method:'PATCH',url,payload:{revision:1,category:'名片'}});assert.equal(response.statusCode,200);assert.equal(body.requests[0].category,'名片');assert.equal(body.requests[0].method,'UNKNOWN');assert.equal(body.requests[0].body,'{{missing}}');assert.equal(body.revision,2);
 response=await app.inject({method:'PATCH',url,payload:{revision:1,category:'舊視窗'}});assert.equal(response.statusCode,409);assert.equal(body.requests[0].category,'名片');
 response=await app.inject({method:'PATCH',url:url.replace('/p/','/q/'),payload:{revision:2,category:'跨專案'}});assert.equal(response.statusCode,404);await app.close();
});

test('empty folders persist independently of requests, reject duplicates, stale changes and other projects',async()=>{
 const id=randomUUID();let body:any={id,projectId:'p',version:1,revision:1,requests:[],changes:[]};const revisions:any[]=[];
 const db={query:async(sql:string,args:any[])=>{if(sql.startsWith('SELECT body FROM request_catalogs WHERE id'))return {rows:args[1]==='p'?[{body:structuredClone(body)}]:[]};if(sql.startsWith('INSERT INTO api_catalog_revisions'))revisions.push(JSON.parse(args[2]));if(sql.startsWith('UPDATE request_catalogs'))body=JSON.parse(args[1]);return {rows:[],rowCount:1};}};
 const app=Fastify();registerApiManagement(app,{pool:db,transaction:async(fn:any)=>fn(db),project:async()=>({}),catalog:async()=>body,environments:async()=>[]});const url='/api/api-library/p/versions/'+id+'/folders';
 let response=await app.inject({method:'POST',url,payload:{revision:1,name:'會員資料'}});assert.equal(response.statusCode,200);assert.deepEqual(body.folders,['會員資料']);assert.deepEqual(body.requests,[]);assert.equal(body.revision,2);assert.equal(revisions[0].folders,undefined);
 response=await app.inject({method:'POST',url,payload:{revision:2,name:'會員資料'}});assert.equal(response.statusCode,409);
 response=await app.inject({method:'POST',url,payload:{revision:1,name:'舊視窗'}});assert.equal(response.statusCode,409);
 response=await app.inject({method:'POST',url:url.replace('/p/','/q/'),payload:{revision:2,name:'跨專案'}});assert.equal(response.statusCode,404);
 response=await app.inject({method:'POST',url,payload:{revision:2,name:'未分類'}});assert.equal(response.statusCode,409);assert.deepEqual(body.folders,['會員資料']);await app.close();
});
