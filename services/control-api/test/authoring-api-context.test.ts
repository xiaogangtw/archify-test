import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAuthoringApiContext,authoringApiInstruction} from '../src/authoringApiContext.ts';
import {environmentSchema} from '../src/requestTransport.ts';

const login={environmentId:'dev',method:'POST',endpoint:'{{BASE_URL}}',body:JSON.stringify({query:'mutation Login($scopeId: String!) { loginWithToken(scopeId: $scopeId) { token status } }',variables:{scopeId:'saved-scope'}}),variables:{scopeId:'saved-scope'},responseVariables:[{name:'authToken',path:'data.loginWithToken.token'}],expectedStatus:200,assertions:[]};
function fixture(){
 const data:any={catalog:{id:'catalog',projectId:'p',version:4,revision:2,snapshotId:'source',requests:[{id:'login',name:'登入',kind:'graphql',body:'stale source',defaults:login,evidence:[{path:'src/login.ts',line:12}]},{id:'delete',name:'刪除帳號',kind:'graphql',body:JSON.stringify({query:'mutation { deleteAccount }'}),method:'POST',endpoint:'{{BASE_URL}}'}]},cases:[{id:'case',projectId:'p',version:3,catalogVersion:2,requestId:'login',name:'已保存登入案例',request:{...login,variables:{scopeId:'case-scope'}}}],runs:[{id:'run',request_key:'login',status:'passed',body:{caseId:'case',caseVersion:2,caseModified:true,environmentId:'dev',catalogVersion:2,result:{status:200,outcome:'passed',checks:[{name:'HTTP 200',passed:true}],body:JSON.stringify({data:{loginWithToken:{token:'PRIVATE_LOGIN_TOKEN',status:'REGISTERED'}}})}}}],settings:[{id:'dev',name:'Dev',baseEnvironmentId:'dev',baseUrl:'https://api.example.test/graphql',variables:{channel:'web'},tokenVariable:'authToken',tokenHeader:'satoken',tokenPrefix:''}]};
 const reads:string[]=[];
 const db={query:async(sql:string,args:any[]=[])=>{
  reads.push(sql);
  if(sql.includes('FROM documents'))return {rows:[{value:{projects:[{id:'p'}]}}]};
  assert.equal(args[0],'p','all API reads must have the validated project scope');
  assert.doesNotMatch(sql,/api_environment_secrets|source_snapshots|INSERT|UPDATE|DELETE/);
  if(sql.includes('FROM request_catalogs')){assert.match(sql,/NOT \(body \? 'deletedAt'\).*ORDER BY version DESC LIMIT 1/);return {rows:data.catalog?[{body:data.catalog}]:[]};}
  if(sql.includes('FROM api_environment_settings'))return {rows:data.settings.map((body:any)=>({body}))};
  if(sql.includes('FROM api_cases')){assert.deepEqual(args[1].sort(),['delete','login']);return {rows:data.cases.map((body:any)=>({body}))};}
  if(sql.includes('FROM api_request_runs'))return {rows:data.runs};
  throw new Error('unexpected query '+sql);
 }};
 const environments=async()=>[environmentSchema.parse({id:'dev',name:'Dev',baseUrl:'https://api.example.test/graphql',projectIds:['p'],headers:{satoken:'PRIVATE_CONFIG_TOKEN'},authReferences:[{id:'qa',name:'QA',headersFile:'PRIVATE_HEADERS_FILE',variablesFile:'PRIVATE_VARIABLES_FILE'}]})];
 return {data,db,reads,environments};
}

test('authoring receives saved API definitions, independent case versions and historical protocol results without secrets',async()=>{
 const f=fixture();const context=await loadAuthoringApiContext(f.db,'p','先 loginWithToken 再 deleteAccount',f.environments);
 assert.equal(context.catalog.version,4);assert.equal(context.catalog.revision,2);
 const request=context.interfaces.find((item:any)=>item.requestId==='login').request;
 assert.match(request.body,/loginWithToken/);assert.doesNotMatch(request.body,/stale source/);
 assert.deepEqual(request.responseVariables,login.responseVariables);
 assert.equal(context.cases[0].version,3);assert.equal(context.cases[0].catalogVersion,2);assert.equal(context.cases[0].request.variables.scopeId,'case-scope');
 assert.equal(context.runs[0].caseVersion,2);assert.equal(context.runs[0].caseModified,true);assert.equal(context.runs[0].result.outcome,'passed');
 assert.equal(context.runs[0].result.response.data.loginWithToken.token,'[REDACTED]');
 assert.equal(context.environments[0].tokenHeader,'satoken');assert.equal(context.environments[0].tokenPrefix,'');assert.equal(context.environments[0].tokenVariable,'authToken');
 assert.deepEqual(context.environments[0].authReferences,[{id:'qa',name:'QA'}]);assert.deepEqual(context.environments[0].variableNames,['channel']);
 assert.doesNotMatch(JSON.stringify(context),/PRIVATE_/);assert.match(authoringApiInstruction,/不會注入 Playwright Runner/);
});

test('unknown projects and foreign/deleted catalogs are rejected before evidence is shared',async()=>{
 const f=fixture();await assert.rejects(loadAuthoringApiContext(f.db,'foreign','',f.environments),/找不到.*專案/);assert.equal(f.reads.length,1);
 f.data.catalog.projectId='foreign';await assert.rejects(loadAuthoringApiContext(f.db,'p','',f.environments),/不屬於/);
 f.data.catalog.projectId='p';f.data.catalog.deletedAt='today';await assert.rejects(loadAuthoringApiContext(f.db,'p','',f.environments),/不屬於/);
});

test('deleted/foreign cases and unavailable environment settings are excluded; credentials never load',async()=>{
 const f=fixture();f.data.cases.push({...f.data.cases[0],id:'foreign',projectId:'other'},{...f.data.cases[0],id:'deleted',deletedAt:'today'});f.data.settings.push({...f.data.settings[0],id:'foreign',baseEnvironmentId:'other'});
 const context=await loadAuthoringApiContext(f.db,'p','登入',f.environments);
 assert.deepEqual(context.cases.map((item:any)=>item.caseId),['case']);assert.deepEqual(context.environments.map((item:any)=>item.id),['dev']);assert.match(context.warnings.join(' '),/環境 foreign 不可用/);
});

test('environment IDs restricted to another project never enter evidence or warnings',async()=>{
 const f=fixture();const context=await loadAuthoringApiContext(f.db,'p','登入',async()=>[...await f.environments(),environmentSchema.parse({id:'OTHER_PROJECT_ONLY',name:'Other',baseUrl:'https://other.example.test',projectIds:['other']})]);
 assert.doesNotMatch(JSON.stringify(context),/OTHER_PROJECT_ONLY|other.example.test/);
});

test('JSON and GraphQL credential literals are masked while secret placeholders and token selections survive',async()=>{
 const f=fixture();f.data.catalog.requests[0].defaults={...login,headers:{satoken:'PRIVATE_HEADER'},variables:{password:'{{LOGIN_PASSWORD}}',access_token:'PRIVATE_VAR'},body:JSON.stringify({query:'mutation Login($password: String = "PRIVATE_DEFAULT") { login(password: "PRIVATE_ARGUMENT", input: {secret: "PRIVATE_NESTED"}) { token } }',variables:{password:'PRIVATE_BODY'}})};
 f.data.cases=[];f.data.runs=[];const context=await loadAuthoringApiContext(f.db,'p','登入',f.environments);
 assert.doesNotMatch(JSON.stringify(context),/PRIVATE_/);assert.match(JSON.stringify(context),/LOGIN_PASSWORD/);assert.match(context.interfaces[0].request.body,/token/);
});

test('large definitions and responses are omitted whole with limits made explicit',async()=>{
 const f=fixture();f.data.catalog.requests.push({id:'huge',name:'large',body:JSON.stringify({query:'query { field }',variables:{text:'x'.repeat(90000)}})});
 f.data.runs[0].body.result.body=JSON.stringify({text:'y'.repeat(7000)});
 const context=await loadAuthoringApiContext(f.db,'p','loginWithToken',f.environments);
 assert.equal(context.omissions.interfaces,1);assert.ok(context.interfaces.some((item:any)=>item.requestId==='login'));assert.match(context.runs[0].result.response.omitted,/超過容量/);assert.ok(JSON.stringify(context).length<80000);
});

test('empty API libraries and unreadable environment config remain explicit, never fabricate requests',async()=>{
 const f=fixture();f.data.catalog=null;const context=await loadAuthoringApiContext(f.db,'p','登入',async()=>{throw new Error('missing config');});
 assert.equal(context.catalog,null);assert.deepEqual(context.interfaces,[]);assert.deepEqual(context.cases,[]);assert.deepEqual(context.runs,[]);assert.match(context.warnings.join(' '),/無法讀取/);
});
