import test from 'node:test';
import assert from 'node:assert/strict';
import {environmentSchema,editableRequestSchema,executeRequest,importSchema,loadSchema,validateTarget,publicAddress,allowedEnvironment,redact,assertSavableRequest} from '../src/requestTransport.ts';
import type {Transport} from '../src/requestTransport.ts';
const environment=environmentSchema.parse({id:'dev',name:'Dev',baseUrl:'https://api.example.test/graphql'});
const schema=importSchema('type Query { item(id: ID!): Item } type Item { id: ID! name: String }');
const request=()=>editableRequestSchema.parse({environmentId:'dev',method:'POST',endpoint:'{{BASE_URL}}',body:JSON.stringify({query:'query Item($id: ID!) { item(id:$id) { id name } }'}),variables:{id:'1'},operationName:'Item',assertions:[{path:'data.item.id',operator:'equals',value:'1'}]});

test('GraphQL validates against schema and variables before making an HTTP request',async()=>{
 let calls=0;const send:Transport=async(url,method,headers,body)=>{calls++;assert.equal(url.href,environment.baseUrl);assert.equal(method,'POST');assert.equal(JSON.parse(body).variables.id,'1');assert.equal(headers['Content-Type'],'application/json');return {status:200,contentType:'application/json',body:'{"data":{"item":{"id":"1","name":"Demo"}}}'};};
 const result=await executeRequest(environment,request(),schema,send);assert.equal(result.outcome,'passed');assert.ok(result.schemaHash);assert.equal(calls,1);
 await assert.rejects(executeRequest(environment,{...request(),variables:{}},schema,send),/變數驗證失敗/);assert.equal(calls,1);
 await assert.rejects(executeRequest(environment,{...request(),body:'{"query":"query Item { unknown }"}'},schema,send),/schema 驗證失敗/);assert.equal(calls,1);
});

test('HTTP 200 with GraphQL errors, failed assertions or non-GraphQL responses never falsely passes',async()=>{
 for(const body of ['{"data":null,"errors":[{"message":"not allowed"}]}','{"data":{"item":{"id":"2"}}}','{"message":"proxy"}']){
  const result=await executeRequest(environment,request(),schema,async()=>({status:200,contentType:'application/json',body}));assert.equal(result.outcome,'failed');
 }
});

test('REST query parameters, templated paths, bodies and expected status are executed with actual checks',async()=>{
 const env=environmentSchema.parse({id:'rest',name:'REST',baseUrl:'https://api.example.test/v1'});
 const input=editableRequestSchema.parse({environmentId:'rest',method:'GET',endpoint:'/items/{{id}}',variables:{id:'42'},queryParams:{q:'a b'},expectedStatus:201,assertions:[{path:'ok',operator:'equals',value:true}]});
 const result=await executeRequest(env,input,null,async(url,method,_headers,body)=>{assert.equal(url.href,'https://api.example.test/v1/items/42?q=a+b');assert.equal(method,'GET');assert.equal(body,'');return {status:201,contentType:'application/json',body:'{"ok":true}'};});assert.equal(result.outcome,'passed');
});

test('request scope, credentials, missing variables and private network targets are rejected',async()=>{
 for(const url of ['http://api.example.test/graphql','https://evil.example.test/graphql','https://api.example.test/other','https://user:pass@api.example.test/graphql'])assert.throws(()=>validateTarget(url,environment));
 assert.throws(()=>allowedEnvironment([{...environment,projectIds:['other']}],'dev','p'));
 assert.throws(()=>allowedEnvironment([{...environment,expiresAt:'2000-01-01'}],'dev','p'));
 for(const address of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.1.1','169.254.169.254','100.64.1.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1'])assert.equal(publicAddress(address),false,address);
 assert.equal(publicAddress('8.8.8.8'),true);
 await assert.rejects(executeRequest(environment,{...request(),headers:{satoken:'private-token'}},schema),/秘密參照/);
 await assert.rejects(executeRequest(environment,{...request(),endpoint:'{{missing}}'},schema),/請提供變數/);
 assert.deepEqual(redact({accessToken:'a',nested:{password:'b'},message:'private-value'},['private-value']),{accessToken:'[REDACTED]',nested:{password:'[REDACTED]'},message:'[REDACTED]'});
});

test('schema import accepts SDL and introspection JSON; schema loading distinguishes GraphQL errors',async()=>{
 assert.equal(importSchema(JSON.stringify({data:schema.data})).hash,schema.hash);
 const loaded=await loadSchema(environment,'',async()=>({status:200,contentType:'application/json',body:JSON.stringify({data:schema.data})}));assert.ok(loaded.typeCount>0);
 await assert.rejects(loadSchema(environment,'',async()=>({status:200,contentType:'application/json',body:'{"errors":[{"message":"disabled"}]}'})),/Schema 無法讀取/);
});

test('JSON template variables retain native types and escaping instead of corrupting the request body',async()=>{
 const input=editableRequestSchema.parse({environmentId:'dev',method:'POST',endpoint:'{{BASE_URL}}',body:JSON.stringify({name:'{{name}}',count:'{{count}}',enabled:'{{enabled}}',items:'{{items}}'}),variables:{name:'A "quoted" name',count:3,enabled:true,items:[1,2]}});
 await executeRequest(environment,input,null,async(_url,_method,_headers,body)=>{assert.deepEqual(JSON.parse(body),input.variables);return {status:200,contentType:'application/json',body:'{}'};});
});

test('credentials are rejected before persistence and unsupported subscriptions never reach the transport',async()=>{
 for(const input of [{...request(),endpoint:'https://user:password@api.example.test/graphql'},{...request(),endpoint:'{{BASE_URL}}?access_token=private'},{...request(),queryParams:{satoken:'private'}},{...request(),body:'{"password":"private"}'}])assert.throws(()=>assertSavableRequest(input),/認證|秘密/);
 let calls=0;await assert.rejects(executeRequest(environment,{...request(),body:'{"query":"subscription Events { events }"}',operationName:'Events'},schema,async()=>{calls++;throw new Error('Must not send');}),/subscription/);assert.equal(calls,0);
});

test('declared GraphQL variables inherit the selected environment, retain scalar types and allow request overrides',async()=>{
 const env=environmentSchema.parse({id:'dev',name:'Dev',baseUrl:environment.baseUrl,variables:{count:'3',active:'true',unrelated:'not-a-query-variable'}});
 const model=importSchema('type Query { sample(count: Int!, active: Boolean!): Boolean! }');
 const input=editableRequestSchema.parse({environmentId:'dev',method:'POST',endpoint:'{{BASE_URL}}',body:'{"query":"query Example($count: Int!, $active: Boolean!) { sample(count:$count,active:$active) }"}',operationName:'Example'});
 const inspect=(count:number):Transport=>async(_url,_method,_headers,body)=>{assert.deepEqual(JSON.parse(body).variables,{count,active:true});return {status:200,contentType:'application/json',body:'{"data":{"sample":true}}'};};
 assert.equal((await executeRequest(env,input,model,inspect(3))).outcome,'passed');
 assert.equal((await executeRequest(env,{...input,variables:{count:5}},model,inspect(5))).outcome,'passed');
});
