import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {recordCatalog,registerApiLibrary} from '../src/apiLibrary.ts';
import {initialRequest} from '../../../apps/web/src/features/testing/apiRequestDefaults.ts';
import type {RequestDefinition} from '../src/apiContracts.ts';

test('scan preview has no persistent writes; discard removes it; named confirmation commits once and detects baseline edits',async()=>{
 const catalogs:any[]=[];const snapshots:any[]=[];const sources=new Map<string,any>();
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('FROM source_snapshots'))return {rows:sources.has(args[0])?[{body:structuredClone(sources.get(args[0]))}]:[]};
  if(sql.includes('FROM documents'))return {rows:[{value:{project:{id:'p'},projects:[{id:'q'}],flows:[]}}]};
  if(sql.includes('FROM request_catalogs WHERE id=$1'))return {rows:catalogs.filter(item=>item.id===args[0]&&item.projectId===args[1]).map(body=>({body:structuredClone(body)}))};
  if(sql.includes('snapshot_id=$2'))return {rows:catalogs.filter(item=>item.projectId===args[0]&&item.snapshotId===args[1]).map(body=>({body:structuredClone(body)}))};
  if(sql.includes('FROM request_catalogs')&&sql.includes('ORDER BY version'))return {rows:catalogs.filter(item=>item.projectId===args[0]).slice(-1).map(body=>({body:structuredClone(body)}))};
  if(sql.startsWith('INSERT INTO request_catalogs'))catalogs.push(JSON.parse(args[4]));
  else if(sql.startsWith('INSERT INTO source_snapshots'))snapshots.push(JSON.parse(args[1]));
  else if(!sql.includes('advisory'))throw new Error('Unexpected SQL '+sql);
  return {rows:[],rowCount:1};
 }};
 const source=(method='GET')=>{const value={id:randomUUID(),projectId:'p',files:[{path:'src/api.ts',source:`export const load=()=>fetch('/items',{method:'${method}'})`,hash:method}]};sources.set(value.id,value);return value;};
 await recordCatalog(db,source());catalogs[0].name='原版';
 const app=Fastify();registerApiLibrary(app,{pool:db as any,transaction:(async(fn:any)=>fn(db)) as any,capture:async()=>source('POST'),environments:async()=>[]});
 const scan=()=>app.inject({method:'POST',url:'/api/api-library/p/refresh',payload:{catalogId:catalogs.at(-1)?.id||null}});
 const save=(id:string,name:string,project='p')=>app.inject({method:'POST',url:`/api/api-library/${project}/refresh/${id}`,payload:{name}});
 let result=await scan();assert.equal(result.statusCode,200);
 let preview=result.json();assert.equal(preview.baselineName,'原版');assert.equal(preview.changes[0].kind,'changed');assert.equal(preview.version,undefined);assert.equal(preview.requests,undefined);assert.equal(preview.files,undefined);assert.equal(catalogs.length,1);assert.equal(snapshots.length,0);
 assert.notEqual((await save(preview.id,'   ')).statusCode,200);assert.equal(catalogs.length,1);
 assert.equal((await save(preview.id,'其他專案','q')).statusCode,410);assert.equal(snapshots.length,0);
 result=await app.inject({method:'DELETE',url:'/api/api-library/p/refresh/'+preview.id});assert.equal(result.statusCode,200);assert.equal((await save(preview.id,'不應儲存')).statusCode,410);assert.equal(catalogs.length,1);
 preview=(await scan()).json();result=await save(preview.id,'登入功能更新');assert.equal(result.statusCode,200);assert.equal(result.json().name,'登入功能更新');assert.equal(result.json().version,2);assert.equal(catalogs.length,2);assert.equal(snapshots.length,1);
 const retry=await save(preview.id,'登入功能更新');assert.equal(retry.json().id,result.json().id);assert.equal(catalogs.length,2,'confirmation retries must not create another version');
 assert.equal((await app.inject({method:'DELETE',url:'/api/api-library/p/refresh/'+preview.id})).statusCode,409,'discard cannot delete a committed version');
 preview=(await scan()).json();assert.equal(preview.changes.length,0);assert.equal(catalogs.length,2);result=await save(preview.id,'同來源重新命名版本');assert.equal(result.statusCode,200);assert.equal(result.json().version,3);assert.equal(catalogs[1].name,'登入功能更新');
 preview=(await scan()).json();catalogs[2].revision=2;const count=snapshots.length;result=await save(preview.id,'過期比較');assert.equal(result.statusCode,409);assert.equal(catalogs.length,3);assert.equal(snapshots.length,count);
 await app.close();
});

test('unsaved interfaces initialize from source; saved source/manual definitions retain edits independently',()=>{
 const item={id:'login',name:'Login',kind:'graphql',origin:'source',method:'POST',endpoint:'{{BASE_URL}}',headers:{},queryParams:{},body:'{"query":"old","variables":{"scopeId":"wrong"}}',variables:'{}',operationName:'Old',parameterTypes:'',evidence:[],dependencies:{},issues:[],definitionHash:'',implementationHash:'',sourceRequest:{body:'{"query":"query Login($scopeId: ID!) { login(scopeId: $scopeId) { id } }"}',variables:'{"scopeId":"from-source"}',operationName:'Login',method:'POST',endpoint:'{{BASE_URL}}'},defaults:{environmentId:'old-env',authReference:'',method:'POST',endpoint:'{{BASE_URL}}',headers:{'X-Project':'kept'},queryParams:{},body:'{"query":"old"}',variables:{scopeId:'wrong'},operationName:'Old',expectedStatus:201,assertions:[]}} as RequestDefinition;
 const original=structuredClone(item.defaults);
 for(let i=0;i<2;i++){const value=initialRequest({...item,defaults:undefined},'qa');assert.equal(value.body,item.sourceRequest!.body);assert.deepEqual(value.variables,{scopeId:'from-source'});assert.equal(value.operationName,'Login');assert.equal(value.expectedStatus,200);assert.deepEqual(value.headers,{'Content-Type':'application/json'});assert.deepEqual(value.queryParams,{});assert.deepEqual(value.assertions,[]);assert.equal(value.environmentId,'qa');}
 assert.deepEqual(item.defaults,original,'opening an interface must not mutate stored data or case history');
 for(const origin of ['source','manual'] as const){
  const saved=initialRequest({...item,origin},'qa');
  assert.deepEqual(saved,{...original,environmentId:'qa',authReference:''});
  saved.variables.scopeId='edited-after-open';saved.headers['X-Project']='changed';
  assert.deepEqual(item.defaults,original,'editing the returned request must not mutate saved defaults');
 }
 assert.equal(item.sourceRequest!.operationName,'Login');
 const auth={...item,origin:'manual' as const,defaults:{...item.defaults!,authReference:'old-auth'}};assert.equal(initialRequest(auth,'qa').authReference,'');assert.equal(initialRequest(auth,'old-env').authReference,'old-auth');
});

test('scan compares the explicitly selected named version, ignores deleted heads, and revalidates that same baseline on save',async()=>{
 const catalogs:any[]=[];const sources=new Map<string,any>();let writes=0;let captures=0;
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('FROM source_snapshots'))return {rows:sources.has(args[0])?[{body:structuredClone(sources.get(args[0]))}]:[]};
  if(sql.includes('FROM documents'))return {rows:[{value:{project:{id:'p'},projects:[{id:'q'}]}}]};
  if(sql.includes('FROM request_catalogs WHERE id=$1'))return {rows:catalogs.filter(item=>item.id===args[0]&&item.projectId===args[1]).map(body=>({body:structuredClone(body)}))};
  if(sql.includes('snapshot_id=$2'))return {rows:catalogs.filter(item=>item.projectId===args[0]&&item.snapshotId===args[1]).map(body=>({body:structuredClone(body)}))};
  if(sql.includes('FROM request_catalogs')&&sql.includes('ORDER BY version')){const rows=catalogs.filter(item=>item.projectId===args[0]).slice().reverse().map(body=>({body:structuredClone(body)}));return {rows:sql.includes('LIMIT 1')?rows.slice(0,1):rows};}
  if(sql.startsWith('INSERT INTO request_catalogs')){catalogs.push(JSON.parse(args[4]));writes++;}
  else if(sql.startsWith('INSERT INTO source_snapshots'))writes++;
  else if(!sql.includes('advisory'))throw new Error('Unexpected SQL '+sql);
  return {rows:[]};
 }};
 const source=(method:string)=>{const value={id:randomUUID(),projectId:'p',files:[{path:'src/api.ts',source:`export const load=()=>fetch('/items',{method:'${method}'})`}]};sources.set(value.id,value);return value;};
 await recordCatalog(db,source('GET'));catalogs[0].name='我目前選的版本';catalogs[0].folders=['目前分類'];
 await recordCatalog(db,source('PUT'));catalogs[1].name='另一個較新版本';catalogs[1].folders=['較新分類'];
 await recordCatalog(db,source('DELETE'));catalogs[2].name='已刪除版本';catalogs[2].deletedAt=new Date().toISOString();
 const app=Fastify();registerApiLibrary(app,{pool:db as any,transaction:(async(fn:any)=>fn(db)) as any,capture:async()=>{captures++;return source('POST');},environments:async()=>[]});
 const scan=(catalogId:string|null)=>app.inject({method:'POST',url:'/api/api-library/p/refresh',payload:{catalogId}});
 const save=(id:string)=>app.inject({method:'POST',url:'/api/api-library/p/refresh/'+id,payload:{name:'新命名版本'}});
 const before=writes;let result=await scan(catalogs[0].id);assert.equal(result.statusCode,200);const preview=result.json();assert.equal(preview.baselineId,catalogs[0].id);assert.equal(preview.baselineName,'我目前選的版本');assert.ok(JSON.stringify(preview.changes).includes('GET'));assert.ok(!JSON.stringify(preview.changes).includes('PUT'));assert.equal(writes,before);
 result=await save(preview.id);assert.equal(result.statusCode,200);assert.equal(result.json().version,4,'internal version numbering may advance past deleted versions without comparing them');assert.deepEqual(result.json().folders,['目前分類']);assert.deepEqual(result.json().changes,preview.changes,'saving must not recompute against a newer or deleted head');
 const count=captures;assert.equal((await scan(catalogs[2].id)).statusCode,409);assert.equal(captures,count,'deleted comparison source must be rejected before fetching');assert.equal((await scan(randomUUID())).statusCode,409);assert.equal((await scan(null)).statusCode,409);
 const pending=(await scan(catalogs[0].id)).json();catalogs[0].deletedAt=new Date().toISOString();const written=writes;assert.equal((await save(pending.id)).statusCode,409);assert.equal(writes,written);
 for(const item of catalogs)item.deletedAt=new Date().toISOString();
 result=await scan(null);assert.equal(result.statusCode,200);assert.equal(result.json().baselineId,null);assert.equal(result.json().baselineName,'尚無版本');assert.ok(result.json().changes.every((item:any)=>item.kind==='added'));
 await app.close();
});

test('scan reparses immutable source snapshots, repairs scanner coverage without false changes, and ignores legacy edited defaults',async()=>{
 const {buildCatalog}=await import('../src/apiLibrary.ts');
 const original={id:randomUUID(),projectId:'p',files:[
  {path:'src/api.ts',source:`export const login=()=>graphQLClient.post('/graphql',{query:'mutation LoginWithToken($request: TokenLoginInput) { loginWithToken(request: $request) { token } }',variables:{request:{scopeId:'{{scopeId}}'}}});
const PREVIEW='query GetCardPreview($id: ID!) { getCardPreview(id:$id) { id name } }';
const GUEST_PREVIEW='query GetCardPreview($id: ID!) { getCardPreview(id:$id) { id } }';`},
  {path:'src/page.ts',source:`import {login} from './api'; export const submit=()=>login();`}
 ]};
 const catalogs:any[]=[buildCatalog(original)];const old=catalogs[0];old.name='測試版號V1-20261024';old.folders=['登入'];
 old.requests=old.requests.filter((item:any)=>!item.id.includes('GetCardPreview:'));
 for(const item of old.requests){delete item.usages;delete item.sourceRequest;item.dependencies={};item.implementationHash='legacy-scanner';item.category='登入';}
 const login=old.requests.find((item:any)=>item.name==='LoginWithToken');assert.ok(login);
 login.body=JSON.stringify({query:'legacy saved query',variables:{request:{scopeId:'U20261025',thirdChannel:'Line',useNonMobile:true}}});login.headers={'Content-Type':'application/json'};
 login.defaults={environmentId:'old',authReference:'',method:'POST',endpoint:'/overridden',headers:{'X-Test':'saved'},queryParams:{test:'old'},body:login.body,variables:{request:{scopeId:'U20261025'}},operationName:'LoginWithToken',expectedStatus:201,assertions:[]};
 old.requests.push({...structuredClone(login),id:'manual:kept',origin:'manual',name:'手動接口'});
 const sourceSnapshots=new Map<string,any>([[original.id,original]]);let incoming=structuredClone(original.files);let captures=0;let writes=0;
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('FROM documents'))return {rows:[{value:{project:{id:'p'}}}]};
  if(sql.includes('FROM source_snapshots'))return {rows:sourceSnapshots.has(args[0])?[{body:structuredClone(sourceSnapshots.get(args[0]))}]:[]};
  if(sql.includes('FROM request_catalogs WHERE id=$1'))return {rows:catalogs.filter(item=>item.id===args[0]&&item.projectId===args[1]).map(body=>({body:structuredClone(body)}))};
  if(sql.includes('FROM request_catalogs')&&sql.includes('ORDER BY version'))return {rows:catalogs.slice().reverse().map(body=>({body:structuredClone(body)}))};
  if(sql.startsWith('INSERT INTO source_snapshots')){const body=JSON.parse(args[1]);sourceSnapshots.set(body.id,body);writes++;return {rows:[]};}
  if(sql.startsWith('INSERT INTO request_catalogs')){catalogs.push(JSON.parse(args[4]));writes++;return {rows:[]};}
  if(sql.includes('advisory'))return {rows:[]};
  throw new Error('Unexpected SQL '+sql);
 }};
 const before=structuredClone(old);const originalSource=structuredClone(original);
 const app=Fastify();registerApiLibrary(app,{pool:db as any,transaction:(async(fn:any)=>fn(db)) as any,capture:async()=>{captures++;return {id:randomUUID(),projectId:'p',files:structuredClone(incoming)};},environments:async()=>[]});
 const scan=()=>app.inject({method:'POST',url:'/api/api-library/p/refresh',payload:{catalogId:old.id}});
 const save=(id:string)=>app.inject({method:'POST',url:'/api/api-library/p/refresh/'+id,payload:{name:'來源基準修正後'}});
 incoming=incoming.map(file=>({...file,source:file.source.replace(/\n/g,'\r\n')}));
 let response=await scan();assert.equal(response.statusCode,200,response.body);let preview=response.json();assert.deepEqual(preview.changes,[]);assert.equal(preview.requestCount,4);assert.equal(writes,0);
 response=await save(preview.id);assert.equal(response.statusCode,200,response.body);const saved=response.json();assert.deepEqual(saved.changes,[]);assert.equal(saved.requests.filter((item:any)=>item.name==='GetCardPreview').length,2);assert.ok(saved.requests.some((item:any)=>item.id==='manual:kept'));assert.deepEqual(saved.folders,['登入']);
 assert.deepEqual(old,before,'reparsing cannot rewrite legacy templates, case inputs or history');assert.deepEqual(original,originalSource);
 const clean=initialRequest(saved.requests.find((item:any)=>item.name==='LoginWithToken'),'qa');assert.equal(clean.endpoint,'{{BASE_URL}}');assert.equal(clean.expectedStatus,200);assert.equal(clean.authReference,'');assert.ok(!clean.body.includes('legacy saved query'));assert.ok(!JSON.stringify(clean.variables).includes('U20261025'));
 incoming=structuredClone(original.files);incoming[0].source=incoming[0].source.replace('token }','token accountId }');response=await scan();assert.equal(response.statusCode,200);assert.ok(response.json().changes.some((item:any)=>item.name==='LoginWithToken'&&item.details.includes('請求內容變更')),'real query edits remain visible');
 incoming=structuredClone(original.files);incoming[1].source=incoming[1].source.replace('login();','login(); // caller changed');response=await scan();assert.equal(response.statusCode,200);assert.ok(response.json().changes.some((item:any)=>item.details.some((detail:string)=>detail.includes('src/page.ts'))),'real caller source edits remain visible: '+JSON.stringify(response.json().changes));
 const written=writes,captured=captures;sourceSnapshots.delete(original.id);response=await scan();assert.equal(response.statusCode,409);assert.match(response.json().message,/原始碼快照/);assert.equal(captures,captured);assert.equal(writes,written);
 sourceSnapshots.set(original.id,{...original,projectId:'other'});assert.equal((await scan()).statusCode,409);assert.equal(writes,written);
 await app.close();
});
