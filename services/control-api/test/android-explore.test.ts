import test from 'node:test';
import assert from 'node:assert/strict';
import {exploreAndroid} from '../../../apps/web/src/features/testing/androidExplore.ts';

test('exploration observes after each click, pauses for a question and resumes with history', async()=>{
 const calls:{path:string;body:any}[]=[];let model=0;
 const request=async<T>(path:string, options?:RequestInit):Promise<T>=>{
  const body=options?.body?JSON.parse(String(options.body)):{};calls.push({path,body});
  if(path.endsWith('authoring-context'))return {serial:'emulator-5554',xml:'<hierarchy/>',capturedAt:'now',fingerprint:'a'.repeat(64)} as T;
  if(path==='/llm')return {reply:'',source:JSON.stringify(model++===0?{kind:'tap',locator:{kind:'text',value:'登入'},reason:'檢查提示'}:{kind:'ask',question:'請確認提示內容',options:['未同意條款','其他提示']})} as T;
  return {accepted:true} as T;
 };
 const result=await exploreAndroid({request,serial:'emulator-5554',question:'測試登入',history:[],source:'draft',signal:new AbortController().signal,progress:()=>{}});
 assert.match(result.reply,/已點擊/);assert.match(result.reply,/請確認提示內容/);
 assert.deepEqual(result.question,{prompt:'請確認提示內容',options:['未同意條款','其他提示']});
 assert.deepEqual(calls.map(call=>call.path),['/android/authoring-context','/llm','/android/devices/emulator-5554/observe-tap','/android/authoring-context','/llm']);
 assert.equal(calls[2].body.fingerprint,'a'.repeat(64));
 const resumed=async<T>(path:string,options?:RequestInit):Promise<T>=>{if(path==='/llm'){const body=JSON.parse(String(options?.body));assert.match(JSON.stringify(body.messages),/請確認提示內容/);return {reply:'',source:JSON.stringify({kind:'finish',source:'export const flow = {} as const',summary:'已整理草稿'})} as T;}return {serial:'emulator-5554',xml:'<hierarchy/>',capturedAt:'now',fingerprint:'a'.repeat(64)} as T;};
 const next=await exploreAndroid({request:resumed,serial:'emulator-5554',question:'提示是未同意',history:[{role:'assistant',content:result.reply}],source:'draft',signal:new AbortController().signal,progress:()=>{}});
 assert.match(next.source||'',/export const flow/);
});

test('failed or uncertain tap is never repeated',async()=>{
 let taps=0;
 const request=async<T>(path:string):Promise<T>=>{
  if(path.endsWith('authoring-context'))return {serial:'emulator-5554',xml:'<hierarchy/>',capturedAt:'now',fingerprint:'a'.repeat(64)} as T;
  if(path==='/llm')return {reply:'',source:JSON.stringify({kind:'tap',locator:{kind:'text',value:'登入'},reason:'登入'})} as T;
  taps++;throw new Error('操作逾時');
 };
 await assert.rejects(exploreAndroid({request,serial:'emulator-5554',question:'登入',history:[],source:'',signal:new AbortController().signal,progress:()=>{}}),/不會自動重試/);
 assert.equal(taps,1);
});

test('an unanswered question can include a partial draft without claiming completion',async()=>{
 const request=async<T>(path:string):Promise<T>=>path==='/llm'?{reply:'',source:JSON.stringify({kind:'ask',question:'尚未捕捉到提示，請確認如何繼續。',source:'export const flow = {} as const'})} as T:{serial:'emulator-5554',xml:'<hierarchy/>',capturedAt:'now',fingerprint:'a'.repeat(64)} as T;
 const result=await exploreAndroid({request,serial:'emulator-5554',question:'記錄登入提示',history:[],source:'old',signal:new AbortController().signal,progress:()=>{}});
 assert.match(result.reply,/尚未捕捉/);assert.match(result.source||'',/export const flow/);assert.equal(result.incomplete,true);
});

test('retains the observed pre-click screen for later decisions and answers within the same conversation',async()=>{
 const evidence={serial:'emulator-5554',observations:[] as {action:string;xml:string}[]};let models=0;
 const request=async<T>(path:string,options?:RequestInit):Promise<T>=>{
  if(path.endsWith('authoring-context'))return {serial:'emulator-5554',xml:models===0?'<hierarchy><node text="服務條款" checked="false"/></hierarchy>':'<hierarchy><node text="登入"/></hierarchy>',capturedAt:'now',fingerprint:'a'.repeat(64)} as T;
  if(path==='/llm'){const content=JSON.stringify(JSON.parse(String(options?.body)).messages);if(models>0)assert.match(content,/服務條款/);return {reply:'',source:JSON.stringify(models++===0?{kind:'tap',locator:{kind:'text',value:'登入'},reason:'查看提示'}:{kind:'ask',question:'提示未捕捉到'})} as T;}
  return {accepted:true} as T;
 };
 await exploreAndroid({request,serial:'emulator-5554',question:'測試登入',history:[],source:'draft',signal:new AbortController().signal,progress:()=>{},evidence});
 assert.match(evidence.observations[0].xml,/服務條款/);
 await exploreAndroid({request,serial:'emulator-5554',question:'繼續',history:[{role:'assistant',content:'提示未捕捉到'}],source:'draft',signal:new AbortController().signal,progress:()=>{},evidence});
});

test('fills an allowed test value and carries captured toast into the next decision',async()=>{
 const evidence={serial:'emulator-5554',observations:[] as {action:string;xml:string}[]};let model=0;const paths:string[]=[];
 const request=async<T>(path:string,options?:RequestInit):Promise<T>=>{
  paths.push(path);if(path.endsWith('authoring-context'))return {serial:'emulator-5554',xml:'<hierarchy/>',capturedAt:'now',fingerprint:'a'.repeat(64)} as T;
  if(path==='/llm'){const content=JSON.stringify(JSON.parse(String(options?.body)).messages);if(model===2)assert.match(content,/請先同意/);const steps=[{kind:'type',locator:{kind:'id',value:'name'},text:'Test 123',reason:'填寫測試資料'},{kind:'tap',locator:{kind:'text',value:'登入'},reason:'查看提示'},{kind:'finish',source:'',summary:'已觀察提示'}];return {reply:'',source:JSON.stringify(steps[model++])} as T;}
  if(path.endsWith('observe-tap'))return {accepted:true,xml:'<hierarchy><node text="請先同意"/></hierarchy>'} as T;
  const body=JSON.parse(String(options?.body));assert.equal(body.action,'typeObserved');assert.equal(body.text,'Test 123');return {accepted:true} as T;
 };
 const result=await exploreAndroid({request,serial:'emulator-5554',question:'填入 Test 123 並觀察提示',history:[],source:'draft',signal:new AbortController().signal,progress:()=>{},evidence});
 assert.match(result.reply,/已觀察提示/);assert.equal(paths.filter(path=>path.endsWith('observe-tap')).length,1);
});

test('the model receives the saved flow names, identifiers and versions without needing a phone',async()=>{
 const references=[{name:'開 LINE',scriptId:'open-line',scriptVersion:3}];let calls=0;
 const request=async<T>(path:string,options?:RequestInit):Promise<T>=>{
  assert.equal(path,'/llm');calls++;const content=JSON.stringify(JSON.parse(String(options?.body)).messages);
  assert.match(content,/開 LINE/);assert.match(content,/open-line/);assert.match(content,/scriptVersion/);
  return {reply:'',source:JSON.stringify({kind:'finish',source:'export const flow = {} as const',summary:'已加入共用案例'})} as T;
 };
 const result=await exploreAndroid({request,serial:'',question:'加入開 LINE',history:[],source:'draft',signal:new AbortController().signal,progress:()=>{},references});
 assert.equal(calls,1);assert.match(result.reply,/已加入/);
});
