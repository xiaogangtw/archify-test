import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import Fastify from 'fastify';
import { registerAndroid } from '../src/android.ts';
import { memoryAndroidProfiles } from '../src/androidProfiles.ts';
import { setImmediate as tick } from 'node:timers/promises';
test('create, prepare result validation, start and retry preserve a stable phone identity', async () => {
  const store = memoryAndroidProfiles(), app = Fastify(), session = randomUUID(); registerAndroid(app, store);
  const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload: payload as any, headers: { 'x-archify-user': 'alice' } });
  try {
    await post('/internal/android/status', { session, status: { sdk: { ready: true, path: '/sdk' }, avds: [], devices: [], issues: [], appium: { reachable: false, ready: false } } });
    const create = post('/api/android/profiles', { name: 'LINE A' }); void create.then(() => {}); await tick(); await tick();
    const command = (await post('/internal/android/claim', { session })).json();
    assert.equal(command.action, 'prepareProfile');
    const row = (await store.list())[0]; assert.equal(row.id, command.payload.id);
    await post(`/internal/android/result/${command.id}`, { session, result: { profileId: row.id, avd: row.avd } });
    assert.equal((await create).statusCode, 200);
    assert.equal((await store.list())[0].state, 'ready');
    assert.equal((await post('/api/android/profiles', { name: 'LINE A' })).statusCode, 409);
    assert.equal((await post('/api/android/start', { avd: row.avd, count: 1 })).statusCode, 403);
    const start = post(`/api/android/profiles/${row.id}/start`, {}); void start.then(() => {}); await tick(); await tick();
    const launch = (await post('/internal/android/claim', { session })).json(); assert.equal(launch.action, 'startProfile');
    await post(`/internal/android/result/${launch.id}`, { session, result: { started: ['emulator-5554'] } });
    assert.equal((await start).statusCode, 200); assert.equal((await store.list())[0].id, row.id);
  } finally { await app.close(); }
});
test('fixed phone owner survives API and worker restart; other users cannot list or start it', async () => {
  const store = memoryAndroidProfiles(), id = randomUUID(), avd = `Archify_Device_${id.replaceAll('-','')}`;
  await store.put({ id, avd, owner: 'alice', name: 'LINE A', state: 'ready' });
  for (let pass = 0; pass < 2; pass++) {
    const app = Fastify(); registerAndroid(app, store);
    try {
      await app.inject({ method: 'POST', url: '/internal/android/status', payload: { session: randomUUID(), status: { sdk: { ready: true, path: '/sdk' }, avds: [avd], devices: [{ serial: 'emulator-5554', state: 'device', booted: true, managed: true, avd, profileId: id, error: '' }], issues: [], appium: { reachable: false, ready: false } } } });
      const alice = (await app.inject({ url: '/api/android/status', headers: { 'x-archify-user': 'alice' } })).json();
      assert.equal(alice.profiles[0].serial, 'emulator-5554'); assert.equal(alice.devices[0].canControl, true);
      const bob = (await app.inject({ url: '/api/android/status', headers: { 'x-archify-user': 'bob' } })).json();
      assert.deepEqual(bob.profiles, []); assert.equal(bob.devices[0].canControl, false);
      assert.equal((await app.inject({ method: 'POST', url: `/api/android/profiles/${id}/start`, headers: { 'x-archify-user': 'bob' }, payload: {} })).statusCode, 404);
      assert.equal((await app.inject({ method: 'POST', url: `/api/android/profiles/${id}/start`, headers: { 'x-archify-user': 'alice' }, payload: {} })).statusCode, 409);
    } finally { await app.close(); }
  }
});
