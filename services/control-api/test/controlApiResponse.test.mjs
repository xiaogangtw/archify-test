import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../../../apps/web/src/features/testing/controlApi.ts';

test('API errors preserve status and route without exposing proxy body; malformed success must fail',async()=>{
 const original=globalThis.fetch;
 try{
  for(const status of [200,404,413,502,503,504]){
   globalThis.fetch=async()=>new Response('<html>private upstream content</html>',{status});
   await assert.rejects(api('/api-analyses/latest?projectId=private-project'),error=>{
    assert.ok(error instanceof Error);assert.match(error.message,new RegExp(`HTTP ${status}`));assert.ok(error.message.includes('/api/api-analyses/latest'));assert.ok(!error.message.includes('private'));return true;
   });
  }
  globalThis.fetch=async()=>Response.json({error:'來源快照不存在'},{status:404});
  await assert.rejects(api('/sources/refresh'),/來源快照不存在/);
  globalThis.fetch=async()=>Response.json({id:'valid'});
  assert.deepEqual(await api('/source-imports'),{id:'valid'});
  globalThis.fetch=async()=>Response.json(null);
  assert.equal(await api('/api-analyses/latest?projectId=original'),null);
  await assert.rejects(api('/source-imports'),/回應格式錯誤/);
 }finally{globalThis.fetch=original;}
});


test('browser requests omit JSON content type for empty bodies and retain JSON payloads and caller headers',async()=>{
 const {default:Fastify}=await import('fastify');const app=Fastify();const original=globalThis.fetch;
 app.route({method:['GET','DELETE','POST'],url:'/api/empty',handler:async req=>{assert.equal(req.headers['content-type'],undefined);assert.equal(req.headers['x-archify-client'],'web');assert.equal(req.body,undefined);return {deleted:true};}});
 app.route({method:['POST','DELETE'],url:'/api/json',handler:async req=>{assert.equal(req.headers['content-type'],'application/json');assert.equal(req.headers['x-test'],'preserved');return {received:req.body};}});
 try{
  globalThis.fetch=async(url,init)=>{const result=await app.inject({method:init.method||'GET',url:String(url),headers:Object.fromEntries(new Headers(init.headers)),payload:init.body??undefined});return new Response(result.body,{status:result.statusCode,headers:result.headers});};
  for(const init of [{method:'DELETE'},{method:'DELETE',body:''},{method:'POST'},{}])assert.deepEqual(await api('/empty',init),{deleted:true});
  for(const headers of [new Headers({'X-Test':'preserved'}),[['X-Test','preserved']],{'X-Test':'preserved'}]){
   for(const method of ['POST','DELETE'])assert.deepEqual(await api('/json',{method,body:JSON.stringify({revision:2}),headers}),{received:{revision:2}});
  }
 }finally{globalThis.fetch=original;await app.close();}
});
