import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {recordCatalog,registerApiLibrary} from '../src/apiLibrary.ts';
import {environmentSchema,editableRequestSchema} from '../src/requestTransport.ts';

test('catalog versions are immutable and repeated snapshots reuse the same catalog',async()=>{
 const saved:any[]=[];const client={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('FROM source_snapshots'))return {rows:[{body:snapshot}]};
  if(sql.includes('snapshot_id=$2'))return {rows:saved.filter(item=>item.snapshotId===args[1]).map(body=>({body}))};
  if(sql.includes('ORDER BY version'))return {rows:saved.slice(-1).map(body=>({body}))};
  if(sql.startsWith('INSERT INTO request_catalogs'))saved.push(JSON.parse(args[4]));
  return {rows:[]};
 }};
 const snapshot={id:randomUUID(),projectId:'p',files:[{path:'src/api.ts',source:'export const load=()=>fetch("/items")',hash:'one'}]};
 const first=await recordCatalog(client,snapshot);assert.equal(first.version,1);
 assert.deepEqual(await recordCatalog(client,snapshot),first);assert.equal(saved.length,1);
 assert.equal((await recordCatalog(client,{...snapshot,id:randomUUID()})).id,first.id);assert.equal(saved.length,1,'identical new imports must not stack a version');
 saved[0].folders=['空資料夾'];
 const second=await recordCatalog(client,{...snapshot,id:randomUUID(),files:[{path:'src/api.ts',source:'export const load=()=>fetch("/items",{method:"POST"})',hash:'two'}]});
 assert.equal(second.version,2);assert.deepEqual(second.folders,['空資料夾']);assert.equal(second.changes[0].kind,'changed');assert.equal(saved[0].requests[0].method,'GET');
});

test('request routes isolate projects, preserve frozen history and do not resend an idempotent mutation',async()=>{
 const id=randomUUID();const source:any={id,projectId:'p',snapshotId:randomUUID(),version:2,requests:[{id:'request',definitionHash:'hash'}]};
 const runs=new Map<string,any>();let sent=0;
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('FROM documents'))return {rows:[{value:{project:{id:'p'},projects:[{id:'q'}],flows:[]}}]};
  if(sql.includes('FROM request_catalogs'))return {rows:args[1]==='p'?[{body:source}]:[]};
  if(sql.includes('FROM api_schemas')||sql.includes('FROM api_environment_'))return {rows:[]};
  if(sql.includes('FROM api_request_runs r')){assert.ok(sql.includes("NOT (r.body ? 'deletedAt')"));assert.ok(sql.includes('c.project_id=r.project_id'));return {rows:[...runs.values()].filter(run=>run.projectId===args[0]&&!run.body.deletedAt).map(run=>({...run,catalog_name:source.name}))};}
  if(sql.includes('FROM api_request_runs WHERE request_id')){const run=runs.get(args[0]);return {rows:run&&run.projectId===args[1]?[run]:[]};}
  if(sql.startsWith('INSERT INTO api_request_runs')){runs.set(args[1],{id:args[0],projectId:args[2],status:'running',body:JSON.parse(args[5])});return {rows:[{id:args[0]}],rowCount:1};}
  if(sql.includes("SET body=jsonb_build_object('deletedAt'")){const run=[...runs.values()].find(run=>run.id===args[0]&&run.projectId===args[1]);if(!run||['running','queued'].includes(run.status))return {rows:[],rowCount:0};run.body={deletedAt:'now'};return {rows:[{id:run.id}],rowCount:1};}
  if(sql.startsWith('UPDATE api_request_runs')){const run=[...runs.values()].find(run=>run.id===args[0]);run.status=args[1];run.body=JSON.parse(args[2]);return {rows:[],rowCount:1};}
  throw new Error('Unexpected SQL '+sql);
 }};
 const app=Fastify();registerApiLibrary(app,{capture:async()=>{},pool:db as any,environments:async()=>[environmentSchema.parse({id:'dev',name:'Dev',baseUrl:'https://example.test/graphql',projectIds:['p','q']})],execute:async()=>{sent++;return {status:200,durationMs:1,body:'{"ok":true}',contentType:'application/json',outcome:'passed',checks:[],message:'HTTP checked'};}});
 const payload={requestId:randomUUID(),catalogId:id,requestKey:'request',request:editableRequestSchema.parse({environmentId:'dev',method:'POST',endpoint:'{{BASE_URL}}',body:'{"value":1}'})};
 const first=await app.inject({method:'POST',url:'/api/api-library/p/execute',payload});assert.equal(first.statusCode,200);assert.equal(first.json().body.sourceSnapshotId,source.snapshotId);assert.equal(first.json().body.deploymentVerified,false);
 const again=await app.inject({method:'POST',url:'/api/api-library/p/execute',payload});assert.equal(again.json().id,first.json().id);assert.equal(sent,1);
 const other=await app.inject({method:'POST',url:'/api/api-library/q/execute',payload});assert.equal(other.statusCode,404);assert.equal(sent,1);
 source.name='V1';const renamedHistory=await app.inject({method:'GET',url:'/api/api-library/p/runs'});assert.equal(renamedHistory.json()[0].catalog_name,'V1');assert.equal(renamedHistory.json()[0].body.catalogVersion,2);
 const wrongDelete=await app.inject({method:'DELETE',url:'/api/api-library/q/runs/'+first.json().id});assert.equal(wrongDelete.statusCode,409);
 const stored=runs.get(payload.requestId);stored.status='running';const runningDelete=await app.inject({method:'DELETE',url:'/api/api-library/p/runs/'+stored.id});assert.equal(runningDelete.statusCode,409);stored.status='passed';
 const deleted=await app.inject({method:'DELETE',url:'/api/api-library/p/runs/'+stored.id});assert.equal(deleted.statusCode,200);assert.deepEqual(stored.body,{deletedAt:'now'});const hidden=await app.inject({method:'GET',url:'/api/api-library/p/runs'});assert.deepEqual(hidden.json(),[]);
 const retryDeleted=await app.inject({method:'POST',url:'/api/api-library/p/execute',payload});assert.equal(retryDeleted.json().id,stored.id);assert.equal(sent,1,'deleting a response must retain request deduplication');
 const secret=await app.inject({method:'POST',url:'/api/api-library/p/execute',payload:{...payload,requestId:randomUUID(),request:{...payload.request,endpoint:'https://user:password@example.test/graphql'}}});assert.notEqual(secret.statusCode,200);assert.equal(runs.size,1);assert.equal(sent,1);
 await app.close();
});

test('case saves preserve each version, synchronize flow cases and reject stale edits',async()=>{
 const catalogId=randomUUID();let saved:any;const versions:any[]=[];let testing:any={project:{id:'p'},cases:[],flows:[]};
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('FROM documents'))return {rows:[{value:structuredClone(testing)}]};
  if(sql.includes('FROM request_catalogs'))return {rows:[{body:{id:catalogId,version:2,requests:[{id:'r'}]}}]};
  if(sql.includes('FROM api_cases WHERE id'))return {rows:saved?[{project_id:'p',version:saved.version,body:saved}]:[]};
  if(sql.includes('FROM api_cases WHERE project_id'))return {rows:saved?[{body:saved}]:[]};
  if(sql.startsWith('INSERT INTO api_cases'))saved=JSON.parse(args[3]);
  else if(sql.startsWith('INSERT INTO api_case_versions'))versions.push(JSON.parse(args[2]));
  else if(sql.startsWith('UPDATE documents'))testing=JSON.parse(args[1]);
  else if(!sql.includes('advisory'))throw new Error('Unexpected SQL '+sql);
  return {rows:[],rowCount:1};
 }};
 const app=Fastify();registerApiLibrary(app,{capture:async()=>{},pool:db as any,transaction:(async(fn:any)=>fn(db)) as any});
 const payload={version:0,catalogId,requestId:'r',name:'Reusable API',request:editableRequestSchema.parse({environmentId:'dev',method:'POST',endpoint:'{{BASE_URL}}'}),scriptLinks:[]};
 const first=await app.inject({method:'POST',url:'/api/api-library/p/cases',payload});assert.equal(first.statusCode,200);const body=first.json();assert.equal(body.version,1);assert.equal(testing.cases[0].apiCaseId,body.id);assert.equal(testing.cases[0].projectId,'p');
 const second=await app.inject({method:'POST',url:'/api/api-library/p/cases',payload:{...payload,id:body.id,version:1,name:'Updated API'}});assert.equal(second.json().version,2);assert.equal(versions[0].name,'Reusable API');assert.equal(versions[1].name,'Updated API');assert.equal(testing.cases.length,1);
 const unchanged=await app.inject({method:'POST',url:'/api/api-library/p/cases',payload:{...payload,id:body.id,version:2,name:'Updated API'}});assert.equal(unchanged.json().version,2);assert.equal(versions.length,2,'saving unchanged inputs must not stack a case revision');
 const stale=await app.inject({method:'POST',url:'/api/api-library/p/cases',payload:{...payload,id:body.id,version:1}});assert.equal(stale.statusCode,409);assert.equal(versions.length,2);
 const dedup=await app.inject({method:'POST',url:'/api/api-library/p/cases',payload:{...payload,deduplicate:true,name:'同內容另一名稱'}});assert.equal(dedup.json().id,body.id);assert.equal(dedup.json().version,2);assert.equal(versions.length,2,'agent dedup does not overwrite or create another revision');
 await app.close();
});
