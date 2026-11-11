import test from 'node:test';
import assert from 'node:assert/strict';
import {createE2eApi,apiStepKey} from '../src/e2eApi.ts';
import {flowSchema} from '../../android/flow-contract.mjs';
import {executeFlow} from '../../android/flow-engine.mjs';
import {executeRequest} from '../src/requestTransport.ts';
import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {registerAndroidExecution} from '../src/androidExecution.ts';
import {memoryAndroidRuns} from '../src/androidRuns.ts';

const request=(method='GET')=>({environmentId:'qa',authReference:'',method,endpoint:'/cards',headers:{},queryParams:{},variables:{},body:'',operationName:'',expectedStatus:200,responseVariables:[],assertions:[{path:'ok',operator:'equals',value:true}]});
const step=(id:string,extra:any={})=>({name:id,action:'apiFlow',scriptId:id,scriptVersion:2,namespace:id,inputs:{},...extra});
function fixture(execute:any){
 const cases:any={login:{id:'login',version:1,projectId:'p',name:'登入',request:{...request('POST'),responseVariables:[{name:'token',path:'token'}]}},query:{id:'query',version:1,projectId:'p',name:'查詢',request:request()}};
 const scripts:any=Object.fromEntries(Object.keys(cases).map(id=>[id,{id,name:id,version:2,apiFlow:{projectId:'p',environmentId:'qa',cases:[{id,version:1}]}}]));
 const api=createE2eApi({pool:{query:async(_sql:string,args:any[])=>({rows:cases[args[0]]?[{body:structuredClone(cases[args[0]])}]:[]})},script:async id=>structuredClone(scripts[id]),environment:async()=>({id:'qa',baseUrl:'https://qa.example.test',headers:{},variables:{}}),execute});
 return {api,cases,scripts};
}
test('login token stays per run, pinned cases are immutable, and API failure stops UI but runs cleanup',async()=>{
 const calls:any[]=[];
 const {api,cases}=fixture(async(env:any,input:any,_schema:any,_send:any,onResponse:any)=>{calls.push({env,input});if(input.method==='POST')await onResponse({token:'PRIVATE-TOKEN'});return {outcome:input.method==='GET'?'failed':'passed'};});
 const login=step('login'),query=step('query',{authVariable:'login_token'});
 const flow=flowSchema.parse({appPackage:'com.example.app',steps:[login,{name:'畫面',action:'assertAppForeground'},query,{name:'不得執行',action:'back'}],after:[{name:'收鍵盤',action:'back'}]});
 const frozen=await api.prepare([flow]);cases.query.request.endpoint='/changed';
 const run=api.execution(frozen);const deviceCalls:string[]=[];
 const result=await executeFlow(flow,{execute:async(path:string)=>{deviceCalls.push(path);return 'com.example.app';},routeFor:()=>'/session/device',executeApi:(item:any,path:string,inputs:any)=>run(apiStepKey(item),path,inputs)});
 assert.equal(result.status,'failed');assert.equal(calls[1].env.headers.Authorization,'Bearer PRIVATE-TOKEN');assert.equal(calls[1].input.endpoint,'/cards');
 assert.equal(deviceCalls.filter(path=>path.endsWith('/back')).length,1);assert.equal(result.trace.at(-1).phase,'after');
 assert.ok(!JSON.stringify({result,frozen}).includes('PRIVATE-TOKEN'));
 await assert.rejects(api.execution(frozen)(apiStepKey(query),'main.1'),/授權變數/);
 await assert.rejects(run(apiStepKey(login),'main.1'),/重複/);
});
test('dual-device API has no actor and never replaces either device assertion',()=>{
 const flow={appPackage:'com.example.app',actors:['sender','receiver'],steps:[step('query'),{name:'A',actor:'sender',action:'assertAppForeground'},{name:'B',actor:'receiver',action:'assertAppForeground'}]};
 assert.equal(flowSchema.safeParse(flow).success,true);
 assert.equal(flowSchema.safeParse({...flow,steps:[step('query')]}).success,false);
});
test('missing output fails, writes cannot poll, invalid overrides and raw credentials rejected',async()=>{
 const {api}=fixture(async()=>({outcome:'passed'}));
 await assert.rejects(api.prepare([step('login',{pollTimeoutMs:1000})]),/唯讀/);
 await assert.rejects(api.prepare([step('login',{inputs:{password:'plain-secret'}})]),/秘密參照/);
 await assert.rejects(api.prepare([step('query',{overrides:[{caseId:'other',request:request()}]})]),/無效/);
 const frozen=await api.prepare([step('query',{inputs:{id:'{{unknown}}'}})]);
 await assert.rejects(api.execution(frozen)(Object.keys(frozen)[0],'main.1'),/尚未產生/);
});
test('read-only polling waits for assertion and outputs become available only after success',async()=>{
 let count=0;
 const {api}=fixture(async()=>({outcome:++count===1?'failed':'passed'}));
 const frozen=await api.prepare([step('query',{pollTimeoutMs:1000})]);
 assert.equal((await api.execution(frozen)(Object.keys(frozen)[0],'main.1')).passed,true);assert.equal(count,2);
});
test('real request renderer carries token, numeric output, parameters and typed assertions without publishing secrets',async()=>{
 const sent:any[]=[];
 const {api,cases}=fixture((env:any,input:any,schema:any,_send:any,onResponse:any)=>executeRequest(env,input,schema,async(url,method,headers,body)=>{
  sent.push({url:String(url),method,headers,body});return {status:200,contentType:'application/json',body:JSON.stringify(method==='POST'?{ok:true,token:'SECRET-RUNTIME',memberId:42}:{ok:true,memberId:42})};
 },onResponse));
 cases.login.request.responseVariables.push({name:'memberId',path:'memberId'});
 cases.query.request.queryParams={memberId:'{{memberId}}'};
 cases.query.request.assertions.push({path:'memberId',operator:'equals',value:'{{memberId}}'});
 const login=step('login'),query=step('query',{authVariable:'login_token',inputs:{memberId:'{{login_memberId}}'}});
 const frozen=await api.prepare([login,query]),run=api.execution(frozen);
 assert.equal((await run(apiStepKey(login),'main.1')).passed,true);
 assert.equal((await run(apiStepKey(query),'main.2')).passed,true);
 assert.equal(sent[1].headers.Authorization,'Bearer SECRET-RUNTIME');assert.match(sent[1].url,/memberId=42/);
 assert.ok(!JSON.stringify(frozen).includes('SECRET-RUNTIME'));
});
test('run creation gates old workers; API bridge requires active session and rejects replay after completion',async()=>{
 const {api}=fixture(async()=>({outcome:'passed'}));
 const definition={appPackage:'com.example.app',steps:[step('query'),{name:'畫面檢查',action:'assertAppForeground'}]};
 const app=Fastify(),session=randomUUID(),runs=memoryAndroidRuns();let supported=false,finish:(result:any)=>void=()=>{};
 const execution=registerAndroidExecution(app,{fresh:()=>true,conditionalFlows:()=>true,apiFlows:()=>supported,session:()=>session,owns:()=>true,ready:()=>true,enqueue:()=>new Promise(resolve=>{finish=resolve;})},{runs,api:()=>api,script:async()=>({caseType:'flow',source:'export const flow='+JSON.stringify(definition),name:'測試',version:1})});
 const payload={scriptId:'flow',scriptVersion:1,serial:'emulator-5554',requestId:randomUUID()};
 try{
  assert.equal((await app.inject({method:'POST',url:'/api/android/runs',payload})).statusCode,409);
  supported=true;const response=await app.inject({method:'POST',url:'/api/android/runs',payload});assert.equal(response.statusCode,202);const row=response.json();
  let active=true;
  const task=await execution.prepareApiTask([definition],{},()=>active);
  const taskUrl='/internal/android/api-step/'+task.id;
  const taskBody={session,key:apiStepKey(definition.steps[0]),path:'main.1',inputs:{}};
  assert.equal((await app.inject({method:'POST',url:taskUrl,payload:taskBody})).json().passed,true);
  active=false;assert.equal((await app.inject({method:'POST',url:taskUrl,payload:{...taskBody,path:'main.2'}})).statusCode,409);task.dispose();
  await execution.claimed(row.id);const url='/internal/android/api-step/'+row.id;
  const body={session,key:apiStepKey(definition.steps[0]),path:'main.1',inputs:{}};
  assert.equal((await app.inject({method:'POST',url,payload:{...body,session:randomUUID()}})).statusCode,409);
  assert.equal((await app.inject({method:'POST',url,payload:body})).json().passed,true);
  assert.equal((await app.inject({method:'POST',url,payload:body})).json().passed,false);
  finish({status:'passed',completed:2,message:'完成',steps:row.steps.map((item:any)=>({...item,status:'passed'}))});
  for(let index=0;index<20&&execution.busy(payload.serial);index++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal((await app.inject({method:'POST',url,payload:{...body,path:'main.2'}})).statusCode,409);
 }finally{await app.close();}
});
