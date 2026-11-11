import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { setImmediate as tick } from 'node:timers/promises';
import { registerAndroid } from '../src/android.ts';

const inventory = { sdk: { ready: true, path: '/sdk' }, avds: ['Pixel'], devices: [] as any[], issues: [], appium: { reachable: false, ready: false } };
function server() {
  const app = Fastify();
  app.setErrorHandler((error: any, _req, reply) => reply.code(error.name === 'ZodError' ? 400 : error.statusCode || 500).send({ error: error.message }));
  registerAndroid(app); return app;
}

test('a crashed owned phone can shut down while ADB is unavailable; failures retain ownership', async () => {
  const app = server(), session = randomUUID();
  const post = (url: string, payload: any, user = 'alice') => app.inject({ method: 'POST', url, payload, headers: { 'x-archify-user': user } });
  const heartbeat = (devices: any[]) => post('/internal/android/status', { session, status: { ...inventory, devices, adb: { ready: false, canRetry: true, error: 'ADB unavailable' } } });
  try {
    await app.ready(); await heartbeat([]);
    const start = post('/api/android/start', { avd: 'Pixel', count: 1 });
    void start.then(() => {}); await tick(); await tick();
    const launch = (await post('/internal/android/claim', { session })).json();
    await post('/internal/android/result/' + launch.id, { session, result: { started: ['emulator-5554'] } });
    assert.equal((await start).statusCode, 200);
    await heartbeat([{ serial: 'emulator-5554', state: 'offline', booted: false, managed: true, avd: 'Pixel', error: 'System crashed' }]);
    const view = () => app.inject({ url: '/api/android/status', headers: { 'x-archify-user': 'alice' } });
    assert.equal((await view()).json().devices[0].canControl, true);
    assert.equal((await post('/api/android/devices/emulator-5554/stop', {}, 'bob')).statusCode, 403);
    for (const failed of [true, false]) {
      const stop = post('/api/android/devices/emulator-5554/stop', {});
      void stop.then(() => {}); await tick(); await tick();
      const job = (await post('/internal/android/claim', { session })).json();
      assert.equal(job.action, 'stop');
      const body = failed ? { session, error: 'Identity could not be verified' } : { session, result: { stopped: 'emulator-5554', forced: true } };
      await post('/internal/android/result/' + job.id, body);
      assert.equal((await stop).statusCode, failed ? 400 : 200);
      assert.equal((await view()).json().devices[0].canControl, failed);
    }
    await heartbeat([]);
    assert.deepEqual((await view()).json().devices, []);
  } finally { await app.close(); }
});
test('offline executor refuses commands; fresh heartbeat and session fencing', async () => {
  const app = server();
  try {
    assert.equal((await app.inject('/api/android/status')).json().connected, false);
    const failed = await app.inject({ method: 'POST', url: '/api/android/start', payload: { avd: 'Pixel', count: 1 } });
    assert.equal(failed.statusCode, 503);
    const session = randomUUID();
    await app.inject({ method: 'POST', url: '/internal/android/status', payload: { session, status: inventory } });
    assert.equal((await app.inject('/api/android/status')).json().connected, true);
    assert.equal((await app.inject('/api/android/status')).json().capabilities.conditionalFlows, false);
    await app.inject({ method: 'POST', url: '/internal/android/status', payload: { session, status: { ...inventory, appium: { ...inventory.appium, conditionalFlows: true } } } });
    assert.equal((await app.inject('/api/android/status')).json().capabilities.conditionalFlows, true);
    assert.equal((await app.inject({ method: 'POST', url: '/internal/android/status', payload: { session: randomUUID(), status: inventory } })).statusCode, 409);
    assert.equal((await app.inject({ method: 'POST', url: '/internal/android/claim', payload: { session: randomUUID() } })).statusCode, 409);
  } finally { await app.close(); }
});
test('device ownership, serialized dispatch, result fencing and reconnect do not invent success', async () => {
  const app = server(); const session = randomUUID();
  const post = (url: string, payload: any, user = 'alice') => app.inject({ method: 'POST', url, payload, headers: { 'x-archify-user': user } });
  const heartbeat = (status: any) => post('/internal/android/status', { session, status });
  try {
    await app.ready(); await heartbeat(inventory);
    const start = post('/api/android/start', { avd: 'Pixel', count: 2 });
    void start.then(() => {}); await tick(); await tick();
    const job = (await post('/internal/android/claim', { session })).json();
    assert.equal(job.action, 'start');
    assert.equal((await post('/internal/android/claim', { session })).json(), null);
    assert.equal((await post('/internal/android/result/' + job.id, { session: randomUUID(), result: { started: [] } })).statusCode, 409);
    await post('/internal/android/result/' + job.id, { session, result: { started: ['emulator-5554', 'emulator-5556'] } });
    assert.equal((await start).statusCode, 200);
    const devices = ['emulator-5554', 'emulator-5556'].map(serial => ({ serial, state: 'device', booted: true, managed: true, avd: 'Pixel', error: '' }));
    await heartbeat({ ...inventory, devices });
    const alice = await app.inject({ url: '/api/android/status', headers: { 'x-archify-user': 'alice' } });
    const bob = await app.inject({ url: '/api/android/status', headers: { 'x-archify-user': 'bob' } });
    assert.equal(alice.json().devices[0].canControl, true); assert.equal(bob.json().devices[0].canControl, false);
    assert.equal((await post('/api/android/devices/emulator-5554/input', { action: 'home' }, 'bob')).statusCode, 403);
    assert.equal((await post('/api/android/devices/emulator-5554/stop', {}, 'bob')).statusCode, 403);
    assert.equal((await post('/api/android/devices/emulator-5554/input', { action: 'shell' })).statusCode, 400);
    assert.equal((await post('/api/android/devices/emulator-5554/input', { action: 'swipe', x: 10, y: 20, endX: -1, endY: 20, duration: 300 })).statusCode, 400);
    assert.equal((await post('/api/android/authoring-context', {}, 'bob')).statusCode, 409);
    assert.equal((await post('/api/android/authoring-context', { serial: 'emulator-5554' }, 'bob')).statusCode, 403);
    assert.equal((await post('/api/android/authoring-context', {})).statusCode, 409);
    const inspecting = post('/api/android/authoring-context', { serial: 'emulator-5554' });
    void inspecting.then(() => {}); await tick(); await tick();
    const inspectJob = (await post('/internal/android/claim', { session })).json();
    assert.equal(inspectJob.action, 'inspect'); assert.equal(inspectJob.serial, 'emulator-5554');
    const xml = '<hierarchy><node text="DemoAccount" package="jp.naver.line.android" /></hierarchy>';
    await post('/internal/android/result/' + inspectJob.id, { session, result: { xml, capturedAt: new Date().toISOString() } });
    const snapshot = await inspecting;
    assert.equal(snapshot.statusCode, 200); assert.equal(snapshot.json().xml, xml);
    assert.equal(snapshot.headers['cache-control'], 'no-store');
    const swiping = post('/api/android/devices/emulator-5554/input', { action: 'swipe', x: 900, y: 800, endX: 100, endY: 800, duration: 300 });
    void swiping.then(() => {}); await tick(); await tick();
    const swipeJob = (await post('/internal/android/claim', { session })).json();
    assert.equal(swipeJob.payload.action, 'swipe'); assert.equal(swipeJob.payload.endX, 100);
    await post('/internal/android/result/' + swipeJob.id, { session, result: { accepted: true } });
    assert.equal((await swiping).statusCode, 200);
    const action = post('/api/android/devices/emulator-5554/input', { action: 'home' });
    void action.then(() => {}); await tick(); await tick();
    const next = (await post('/internal/android/claim', { session })).json();
    assert.equal(next.action, 'input');
    assert.equal((await post('/api/android/devices/emulator-5554/input', { action: 'back' })).statusCode, 409);
    await post('/internal/android/result/' + next.id, { session, error: '模擬器已離線。' });
    assert.equal((await action).statusCode, 400);
    assert.equal((await post('/internal/android/result/' + next.id, { session, result: { accepted: true } })).statusCode, 409);
  } finally { await app.close(); }
});
test('ADB recovery requires support, exclusive idle devices and serializes commands', async () => {
  const app = server(), session = randomUUID();
  const post = (url: string, payload: any = {}, user = 'alice') => app.inject({ method: 'POST', url, payload, headers: { 'x-archify-user': user } });
  const heartbeat = (value: any) => post('/internal/android/status', { session, status: value });
  const supported = { ...inventory, adb: { ready: false, canRetry: true, error: 'ADB unavailable' } };
  try {
    assert.equal((await post('/api/android/adb/retry')).statusCode, 503);
    await heartbeat(inventory);
    assert.equal((await post('/api/android/adb/retry')).statusCode, 409);
    await heartbeat(supported);
    assert.equal((await app.inject('/api/android/status')).json().capabilities.adbRecovery, true);
    assert.equal((await post('/api/android/adb/retry', { command: 'anything' })).statusCode, 400);
    const starting = post('/api/android/start', { avd: 'Pixel', count: 1 });
    starting.then(() => {}); await tick(); await tick();
    assert.equal((await post('/api/android/adb/retry')).statusCode, 409);
    const startJob = (await post('/internal/android/claim', { session })).json();
    await post('/internal/android/result/' + startJob.id, { session, result: { started: ['emulator-5554'] } });
    await starting;
    const device = { serial: 'emulator-5554', state: 'offline', booted: false, managed: true, avd: 'Pixel', error: '' };
    await heartbeat({ ...supported, devices: [device] });
    assert.equal((await post('/api/android/adb/retry', {}, 'bob')).statusCode, 403);
    await heartbeat({ ...supported, devices: [{ ...device, appiumBusy: true }] });
    assert.equal((await post('/api/android/adb/retry')).statusCode, 409);
    await heartbeat({ ...supported, devices: [device] });
    const pending = post('/api/android/adb/retry'); pending.then(() => {}); await tick(); await tick();
    assert.equal((await post('/api/android/adb/retry')).statusCode, 409);
    assert.equal((await post('/api/android/start', { avd: 'Pixel', count: 1 })).statusCode, 409);
    const job = (await post('/internal/android/claim', { session })).json();
    assert.equal(job.action, 'adbRetry');
    await post('/internal/android/result/' + job.id, { session, error: 'ADB permission denied' });
    assert.equal((await pending).statusCode, 400);
    const retry = post('/api/android/adb/retry'); retry.then(() => {}); await tick(); await tick();
    await heartbeat({ ...supported, devices: [device] });
    const second = (await post('/internal/android/claim', { session })).json();
    await post('/internal/android/result/' + second.id, { session, result: { restarted: true } });
    assert.equal((await retry).json().restarted, true);
    await heartbeat({ ...supported, devices: [] });
    assert.equal((await post('/api/android/adb/retry', {}, 'bob')).statusCode, 403);
    await heartbeat({ ...supported, devices: [device] });
    const state = (await app.inject({ url: '/api/android/status', headers: { 'x-archify-user': 'alice' } })).json();
    assert.equal(state.devices[0].canControl, true, 'recovery must retain ownership of offline devices');
    const third = post('/api/android/adb/retry'); third.then(() => {}); await tick(); await tick();
    const thirdJob = (await post('/internal/android/claim', { session })).json();
    await post('/internal/android/result/' + thirdJob.id, { session, result: { restarted: true } });
    await third;
    await heartbeat({ ...supported, devices: [{ ...device, avd: 'OtherPhone' }] });
    assert.equal((await app.inject({ url: '/api/android/status', headers: { 'x-archify-user': 'alice' } })).json().devices[0].canControl, false, 'reused ports must not inherit phone ownership');
  } finally { await app.close(); }
});

test('stale heartbeat hides device readiness and rejects commands until a new executor reports', async t => {
  const app = server(); let now = 100000;
  t.mock.method(Date, 'now', () => now);
  const session = randomUUID();
  try {
    await app.inject({ method: 'POST', url: '/internal/android/status', payload: { session, status: inventory } });
    now += 16000;
    const status = (await app.inject('/api/android/status')).json();
    assert.equal(status.connected, false); assert.deepEqual(status.devices, []); assert.equal(status.sdk.ready, false);
    assert.equal((await app.inject({ method: 'POST', url: '/api/android/start', payload: { avd: 'Pixel', count: 1 } })).statusCode, 503);
    const nextSession = randomUUID();
    assert.equal((await app.inject({ method: 'POST', url: '/internal/android/status', payload: { session: nextSession, status: inventory } })).statusCode, 200);
    assert.equal((await app.inject({ method: 'POST', url: '/internal/android/claim', payload: { session } })).statusCode, 409);
  } finally { await app.close(); }
});

test('Appium retry requires connected worker, prevents duplicates and returns worker failure', async () => {
 const app=server(),session=randomUUID();
 const post=(url:string,payload:any={})=>app.inject({method:'POST',url,payload});
 try {
  assert.equal((await post('/api/android/appium/retry')).statusCode,503);
  await post('/internal/android/status',{session,status:inventory});
  const pending=post('/api/android/appium/retry');pending.then(()=>{});await tick();
  assert.equal((await post('/api/android/appium/retry')).statusCode,409);
  const job=(await post('/internal/android/claim',{session})).json();
  assert.equal(job.action,'appiumRetry');
  await post('/internal/android/result/'+job.id,{session,error:'Appium 啟動失敗'});
  assert.equal((await pending).statusCode,400);
  const next=post('/api/android/appium/retry');next.then(()=>{});await tick();
  const retry=(await post('/internal/android/claim',{session})).json();
  await post('/internal/android/result/'+retry.id,{session,result:{ready:true}});
  assert.deepEqual((await next).json(),{ready:true});
 } finally {await app.close();}
});
