import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {registerApiUiChat,validateUiReply} from '../src/apiUiChat.ts';
import {registerApiWorkflow} from '../src/apiWorkflow.ts';
import {busyThread,readChats} from '../../../apps/web/src/features/testing/apiChatHistory.ts';

const catalog={id:randomUUID(),projectId:'p',snapshotId:randomUUID(),revision:3,requests:[{id:'login',name:'登入',method:'POST',endpoint:'{{BASE_URL}}/login',body:'{}',evidence:[{path:'src/login.ts',line:1}],usages:[{path:'src/login.ts',line:1,caller:'login',parameters:{scopeId:'scope.id'},notes:[]}]},{id:'members',name:'會員',evidence:[],usages:[]}]};
const output=(actions:any[])=>({reply:'準備操作畫面。',actions});

test('UI tools preserve omitted editor fields and validate IDs, usage positions and tool allowlist',()=>{
 const result=validateUiReply(output([{tool:'select_request',requestId:'login'},{tool:'fill_request',requestId:'login',patch:{variables:{scopeId:'test'}}},{tool:'set_tab',page:'requests',tab:'body'}]),catalog,false);
 assert.deepEqual((result.actions[1] as any).patch,{variables:{scopeId:'test'}},'patch must not acquire schema defaults which erase existing fields');
 assert.throws(()=>validateUiReply(output([{tool:'select_request',requestId:'foreign'}]),catalog,false),/版本以外/);
 assert.throws(()=>validateUiReply(output([{tool:'load_usage',requestId:'login',index:3}]),catalog,false),/用法不存在/);
 assert.throws(()=>validateUiReply(output([{tool:'eval',code:'alert(1)'}]),catalog,false));
 assert.throws(()=>validateUiReply(output([{tool:'fill_request',requestId:'login',patch:{authReference:'raw'}}]),catalog,false));
 assert.throws(()=>validateUiReply(output([{tool:'fill_request',requestId:'login',patch:{method:'INVALID'}}]),catalog,false));
 assert.throws(()=>validateUiReply(output([{tool:'fill_request',requestId:'login',patch:{body:'{}'}},{tool:'select_request',requestId:'members'}]),catalog,false),/完成目前接口編輯/);
});

test('workflow tools require execution permission and reject multiple jobs or edits of multiple interfaces',()=>{
 assert.throws(()=>validateUiReply(output([{tool:'start_workflow',requestIds:['login'],execute:true}]),catalog,false),/未允許/);
 assert.equal(validateUiReply(output([{tool:'start_workflow',requestIds:['login'],execute:false}]),catalog,false).actions.length,1);
 assert.equal(validateUiReply(output([{tool:'start_workflow',requestIds:['login'],execute:true}]),catalog,true).actions.length,1);
 assert.throws(()=>validateUiReply(output([{tool:'start_workflow',requestIds:['login'],execute:false},{tool:'start_workflow',requestIds:['members'],execute:false}]),catalog,false),/一個案例/);
 assert.throws(()=>validateUiReply(output([{tool:'fill_request',requestId:'login',patch:{body:'{}'}},{tool:'fill_request',requestId:'members',patch:{body:'{}'}}]),catalog,false),/只能編輯一個/);
});

test('UI chat is scoped to project/catalog and provides bounded source plus live editor context without applying writes',async()=>{
 let context:any;let response:any=output([{tool:'select_request',requestId:'login'}]);let modelCalls=0;
 const reads:string[]=[];
 const app=Fastify();
 registerApiUiChat(app,{
  pool:{query:async(sql:string)=>{reads.push(sql);return {rows:[{body:{projectId:'p',files:[{path:'src/login.ts',source:'login(scope.id)'}]}}]};}},
  project:async id=>{if(id!=='p')throw Object.assign(new Error('project missing'),{statusCode:404});return {};},
  catalog:async(id,project)=>{assert.equal(project,'p');assert.equal(id,catalog.id);return catalog;},
  chat:async(_question,data)=>{modelCalls++;context=data;return {reply:typeof response==='string'?response:JSON.stringify(response)};},
 });
 const input={catalogId:catalog.id,currentId:'login',environmentId:'qa',page:'requests',tab:'body',question:'幫我選登入接口',messages:[{role:'user',content:'前一個問題'}],editor:{method:'POST',endpoint:'{{BASE_URL}}/login',query:'',variables:'{"scopeId":"current"}',params:'{}',body:'{}',assertions:'[]'}};
 let result=await app.inject({method:'POST',url:'/api/api-library/p/ui-chat',payload:input});
 assert.equal(result.statusCode,200);assert.equal(result.json().actions[0].requestId,'login');
 assert.equal(context.editor.variables,input.editor.variables);assert.equal(context.history.length,1);assert.equal(context.evidence[0].path,'src/login.ts');
 assert.ok(reads.every(sql=>sql.startsWith('SELECT')),'planning may not mutate saved assets');
 result=await app.inject({method:'POST',url:'/api/api-library/q/ui-chat',payload:input});assert.equal(result.statusCode,404);
 result=await app.inject({method:'POST',url:'/api/api-library/p/ui-chat',payload:{...input,currentId:'foreign'}});assert.equal(result.statusCode,409);assert.equal(modelCalls,1);
 response='not json';result=await app.inject({method:'POST',url:'/api/api-library/p/ui-chat',payload:input});assert.equal(result.statusCode,502);
 response=output([]);result=await app.inject({method:'POST',url:'/api/api-library/p/ui-chat',payload:{...input,currentId:undefined}});assert.equal(result.statusCode,200,'chat without a selected interface can find one in catalog metadata');
 await app.close();
});

test('local chat history validates corruption, isolates project keys and recovers interrupted replies',()=>{
 const thread={id:'thread',title:'Login',updatedAt:'2026-10-27',messages:[{id:'message',role:'assistant',text:'回覆中…',pending:true}]};
 const keys:string[]=[];const storage={getItem:(key:string)=>{keys.push(key);return JSON.stringify([thread]);}};
 const chats=readChats(storage,'p');assert.equal(chats[0].messages[0].pending,false);assert.match(chats[0].messages[0].text,/中斷/);assert.match(keys[0],/\.p$/);
 assert.throws(()=>readChats({getItem:()=>'{broken'},'p'));
 assert.throws(()=>readChats({getItem:()=>JSON.stringify([{...thread,messages:[{role:'system',text:'bad'}]}])},'p'));
 assert.equal(busyThread({...thread,messages:[{id:'m',role:'assistant',text:'job',job:{id:'j',status:'running',message:'',tasks:[]}}]}),true);
});

test('persisted chat job polling isolates projects and does not reveal internal model context',async()=>{
 const jobId=randomUUID();const app=Fastify();
 registerApiWorkflow(app,{
  pool:{query:async(sql:string,args:any[])=>{assert.match(sql,/project_id=\$1 AND id=\$2/);return {rows:args[0]==='p'&&args[1]===jobId?[{id:jobId,project_id:'p',status:'running',body:{message:'執行中',tasks:[],context:{private:'source'},plan:{steps:[]}}}]:[]};}},
  transaction:async()=>{},project:async()=>({}),catalog:async()=>catalog as any,environments:async()=>[],
 });
 const own=await app.inject('/api/api-library/p/assistant/'+jobId);assert.equal(own.statusCode,200);assert.equal(own.json().status,'running');assert.equal(own.json().context,undefined);assert.equal(own.json().plan,undefined);
 const other=await app.inject('/api/api-library/q/assistant/'+jobId);assert.equal(other.statusCode,404);await app.close();
});

test('workflow receives current editor values without changing source contracts and rejects stale or out-of-scope editor data',async()=>{
 const app=Fastify();let queued:any;
 const source={...catalog,requests:[{...catalog.requests[0],kind:'graphql',operationName:'Login',body:'{"query":"query Login { login { id } }"}'}]} as any;
 registerApiWorkflow(app,{
  pool:{query:async(sql:string,args:any[])=>{if(sql.startsWith('INSERT INTO api_workflow_jobs'))queued=JSON.parse(args[2]);return {rows:[]};}},
  transaction:async()=>{},project:async()=>({}),catalog:async()=>source,environments:async()=>[{id:'qa'}],
 });
 const values={method:'POST',endpoint:catalog.requests[0].endpoint,query:'query Login { login { id } }',variables:'{"scopeId":"edited-scope"}',params:'{}',body:source.requests[0].body,assertions:'[]',expectedStatus:'201',expectedGraphqlErrors:'false'};
 const input={requestId:randomUUID(),catalogId:catalog.id,environmentId:'qa',requestIds:['login'],question:'使用目前畫面的值建立案例',editorContext:{requestId:'login',values}};
 const send=(payload:any)=>app.inject({method:'POST',url:'/api/api-library/p/assistant',payload});
 let response=await send(input);assert.equal(response.statusCode,202);assert.equal(queued.context.editorContext.values.variables,values.variables);assert.equal(queued.context.editorContext.values.expectedStatus,'201');
 response=await send({...input,editorContext:{requestId:'foreign',values}});assert.equal(response.statusCode,400);
 response=await send({...input,editorContext:{requestId:'login',values:{...values,query:'mutation Delete { deleteUser }'}}});assert.equal(response.statusCode,400);
 response=await send({...input,editorContext:{requestId:'login',values:{...values,variables:'broken'}}});assert.equal(response.statusCode,400);
 await app.close();
});
