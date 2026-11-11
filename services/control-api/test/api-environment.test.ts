import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sealVariables,openVariables,managedEnvironment,readResponseVariables} from '../src/apiEnvironment.ts';
import {environmentSchema,editableRequestSchema,executeRequest} from '../src/requestTransport.ts';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {registerApiLibrary} from '../src/apiLibrary.ts';

test('environment edits remain within server host/path/project scopes and reject raw secrets',()=>{
 const base=environmentSchema.parse({id:'dev',name:'Dev',baseUrl:'https://example.test/api',projectIds:['p']});
 const settings={id:'qa',name:'QA',baseEnvironmentId:'dev',baseUrl:'https://example.test/api/graphql',variables:{locale:'zh-TW'}};
 assert.equal(managedEnvironment([base],settings,'p').variables.locale,'zh-TW');
 for(const change of [{baseUrl:'https://evil.test/api'},{baseUrl:'https://example.test/other'},{variables:{authToken:'raw-token'}}])assert.throws(()=>managedEnvironment([base],{...settings,...change},'p'));
 assert.throws(()=>managedEnvironment([base],settings,'q'));
 assert.equal(managedEnvironment([base],{...settings,variables:{deviceData:'{"type":"web"}'},headerVariables:['deviceData']},'p').headers.deviceData,'{"type":"web"}');
 assert.throws(()=>managedEnvironment([base],{...settings,variables:{deviceData:'line\nbreak'},headerVariables:['deviceData']},'p'),/換行/);
});

test('server secrets are authenticated encrypted and cannot be opened in another project/environment',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'archify-api-test-'));const previous=process.env.WORKER_TOKEN_FILE;
 try{await writeFile(join(dir,'key'),'test-only-server-key-with-enough-characters');process.env.WORKER_TOKEN_FILE=join(dir,'key');
  const sealed=await sealVariables({authToken:'token-value-for-test'},'p:dev');assert.ok(!sealed.includes('token-value-for-test'));assert.deepEqual(await openVariables(sealed,'p:dev'),{authToken:'token-value-for-test'});await assert.rejects(openVariables(sealed,'q:dev'));await assert.rejects(openVariables(sealed,'p:qa'));
 }finally{if(previous===undefined)delete process.env.WORKER_TOKEN_FILE;else process.env.WORKER_TOKEN_FILE=previous;await unlink(join(dir,'key'));await rmdir(dir);}
});

test('login response extraction runs only after checks pass, masks the captured value and rejects missing paths',async()=>{
 const env=environmentSchema.parse({id:'dev',name:'Dev',baseUrl:'https://example.test/api'});const rules=[{name:'authToken',path:'data.login.value'}];const input=editableRequestSchema.parse({environmentId:'dev',method:'POST',endpoint:'{{BASE_URL}}',body:'{}',responseVariables:rules});let saved:any;
 const good=await executeRequest(env,input,null,async()=>({status:200,contentType:'application/json',body:'{"data":{"login":{"value":"secret-token-example"}}}'}),async body=>{saved=readResponseVariables(body,rules);return Object.values(saved);});
 assert.equal(saved.authToken,'secret-token-example');assert.ok(!good.body.includes('secret-token-example'));assert.match(good.body,/REDACTED/);
 saved=undefined;await executeRequest(env,input,null,async()=>({status:401,contentType:'application/json',body:'{}'}),async()=>{saved=true;return [];});assert.equal(saved,undefined);assert.throws(()=>readResponseVariables({},rules),/擷取失敗/);
});

test('server-only credential variables fill login bodies without accepting raw browser passwords',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'archify-api-login-'));const previous=process.env.ARCHIFY_REQUEST_SECRETS_ROOT;
 try{await writeFile(join(dir,'headers.json'),'{}');await writeFile(join(dir,'variables.json'),JSON.stringify({LOGIN_PASSWORD:'server-only-password'}));process.env.ARCHIFY_REQUEST_SECRETS_ROOT=dir;
  const env=environmentSchema.parse({id:'dev',name:'Dev',baseUrl:'https://example.test/api',authReferences:[{id:'login',name:'Login',headersFile:'headers.json',variablesFile:'variables.json'}]});
  const input=editableRequestSchema.parse({environmentId:'dev',authReference:'login',method:'POST',endpoint:'{{BASE_URL}}',body:'{"password":"{{LOGIN_PASSWORD}}"}'});
  const result=await executeRequest(env,input,null,async(_url,_method,_headers,body)=>{assert.equal(JSON.parse(body).password,'server-only-password');return {status:200,contentType:'application/json',body:'{"message":"server-only-password"}'};});assert.ok(!result.body.includes('server-only-password'));
  await assert.rejects(executeRequest(env,{...input,body:'{"password":"browser-password"}'},null),/秘密參照/);
 }finally{if(previous===undefined)delete process.env.ARCHIFY_REQUEST_SECRETS_ROOT;else process.env.ARCHIFY_REQUEST_SECRETS_ROOT=previous;await unlink(join(dir,'headers.json'));await unlink(join(dir,'variables.json'));await rmdir(dir);}
});

test('login route captures a token, subsequent requests send it automatically and a failed login invalidates it',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'archify-api-session-'));const previous=process.env.WORKER_TOKEN_FILE;const app=Fastify();
 try{await writeFile(join(dir,'key'),'test-only-key-with-at-least-32-characters');process.env.WORKER_TOKEN_FILE=join(dir,'key');
  const catalogId=randomUUID();let encrypted='';const runs=new Map<string,any>();const headersSeen:any[]=[];
  const db={query:async(sql:string,args:any[]=[])=>{
   if(sql.includes('FROM documents'))return {rows:[{value:{project:{id:'p'}}}]};
   if(sql.includes('FROM request_catalogs'))return {rows:[{body:{id:catalogId,snapshotId:randomUUID(),version:1,requests:[{id:'login',name:'Login',definitionHash:'hash'},{id:'items',name:'Items',definitionHash:'hash'}]}}]};
   if(sql.includes('FROM api_environment_settings'))return {rows:[{body:{id:'dev',name:'Dev',baseEnvironmentId:'dev',baseUrl:'https://example.test/api',tokenHeader:'satoken',tokenPrefix:'',tokenVariable:'authToken'}}]};
   if(sql.includes('FROM api_environment_secrets'))return {rows:encrypted?[{body:encrypted}]:[]};
   if(sql.startsWith('INSERT INTO api_environment_secrets')){encrypted=args[2];return {rows:[],rowCount:1};}
   if(sql.includes('FROM api_schemas'))return {rows:[]};
   if(sql.includes('FROM api_request_runs WHERE request_id'))return {rows:runs.has(args[0])?[runs.get(args[0])]:[]};
   if(sql.startsWith('INSERT INTO api_request_runs')){runs.set(args[1],{id:args[0],status:'running',body:JSON.parse(args[5])});return {rows:[{id:args[0]}],rowCount:1};}
   if(sql.startsWith('UPDATE api_request_runs'))return {rows:[],rowCount:1};
   throw new Error('Unexpected SQL '+sql);
  }};
  registerApiLibrary(app,{pool:db as any,capture:async()=>{},environments:async()=>[environmentSchema.parse({id:'dev',name:'Dev',baseUrl:'https://example.test/api'})],execute:async(env,input,schema,_send,onResponse)=>executeRequest(env,input,schema,async(_url,method,headers,body)=>{
   headersSeen.push(headers);if(method==='GET')return {status:200,contentType:'application/json',body:'{}'};
   return {status:body.includes('fail')?401:200,contentType:'application/json',body:'{"data":{"login":{"value":"test-session-token"}}}'};
  },onResponse)});
  const run=async(request:any,requestKey:string)=>(await app.inject({method:'POST',url:'/api/api-library/p/execute',payload:{requestId:randomUUID(),catalogId,requestKey,request}})).json();
  const login=editableRequestSchema.parse({environmentId:'dev',method:'POST',endpoint:'{{BASE_URL}}',body:'{}',responseVariables:[{name:'authToken',path:'data.login.value'}]});
  const first=await run(login,'login');assert.equal(first.status,'passed');assert.ok(!JSON.stringify(first).includes('test-session-token'));assert.ok(!encrypted.includes('test-session-token'));
  await run(editableRequestSchema.parse({environmentId:'dev',method:'GET',endpoint:'{{BASE_URL}}'}),'items');assert.equal(headersSeen[1].satoken,'test-session-token');
  const failed=await run({...login,body:'{"mode":"fail"}'},'login');assert.equal(failed.status,'failed');assert.ok(!JSON.stringify(failed).includes('test-session-token'));
  await run(editableRequestSchema.parse({environmentId:'dev',method:'GET',endpoint:'{{BASE_URL}}'}),'items');assert.equal(headersSeen[3].satoken,undefined);
 }finally{await app.close();if(previous===undefined)delete process.env.WORKER_TOKEN_FILE;else process.env.WORKER_TOKEN_FILE=previous;await unlink(join(dir,'key'));await rmdir(dir);}
});
