import test from 'node:test';
import assert from 'node:assert/strict';
import {driverMessage} from './appium-error.mjs';
import {executeFlow} from './flow-engine.mjs';
import {createAppium} from './appium.mjs';

test('Appium session creation retains redacted driver message in run result', async () => {
  const app=createAppium({status:async()=>({devices:[{serial:'emulator-5554',booted:true}]})},{fetch:async url=>new Response(JSON.stringify({value:url.endsWith('/status')?{ready:true}:{error:'session not created',message:'Device unavailable at https://example.test/private'}}),{status:url.endsWith('/status')?200:500})});
  const result=await app.run('emulator-5554',{appPackage:'com.example.app',steps:[{name:'檢查',action:'assertAppForeground'}]});
  assert.equal(result.status,'failed');
  assert.match(result.message,/session not created/);
  assert.match(result.message,/Device unavailable/);
  assert.equal(result.message.includes('example.test'),false);
  await app.close();
});

test('driver diagnostics redact parameters, credentials and stack traces and remain bounded', () => {
  const message = driverMessage('Unable to click customer-value token=hidden Bearer credential "private" https://example.test/private\n    at internal()', {value:'customer-value'});
  for (const secret of ['customer-value','hidden','credential','private','example.test','internal()']) assert.equal(message.includes(secret),false);
  assert.match(message,/Unable to click/);
  assert.ok(driverMessage('x'.repeat(9000)).length<=1200);
});

test('nested failure retains driver diagnostic, exact path and timing without passing', async () => {
  const result = await executeFlow({appPackage:'com.example.app',steps:[{name:'主流程',action:'repeat',times:1,steps:[{name:'按登入',action:'click',using:'id',value:'login'}]}]}, {
    routeFor:()=>'/session/test',
    execute:async()=>{throw Object.assign(new Error('driver failure'),{webdriver:'invalid session id',driverMessage:'Session is no longer available'});},
  });
  assert.equal(result.status,'failed');
  const failed=result.trace.find(entry=>entry.name==='按登入');
  assert.equal(failed.status,'failed');
  assert.match(failed.path,/main\.1/);
  assert.match(failed.message,/invalid session id/);
  assert.match(failed.message,/Session is no longer available/);
  assert.equal(typeof failed.durationMs,'number');
});
