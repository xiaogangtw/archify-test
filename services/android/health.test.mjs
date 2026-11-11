import test from 'node:test';
import assert from 'node:assert/strict';
import { createAndroidHealth } from './health.mjs';

const drain = () => new Promise(resolve => setImmediate(resolve));
test('automatic recovery is bounded, backs off, and never blocks heartbeats', async () => {
  let clock = 0, starts = 0, release;
  const failure = Object.assign(new Error('failed'), { code: 'ADB_UNAVAILABLE', androidStatus: { sdk: { ready: true, path: '/sdk' }, avds: ['Pixel'], issues: ['ADB unavailable'] } });
  const read = createAndroidHealth({ status: async () => { throw failure; }, ensureAdb: async () => {
    starts++;
    if (starts === 1) await new Promise(resolve => { release = resolve; });
    throw new Error('denied');
  } }, { now: () => clock });
  assert.equal((await read()).sdk.ready, true);
  await drain();
  assert.match((await read()).adb.error, /正在重試/);
  assert.equal(starts, 1);
  release(); await drain();
  await read(); assert.equal(starts, 1);
  clock = 5000; await read(); await drain(); assert.equal(starts, 2);
  clock = 14999; await read(); assert.equal(starts, 2);
  clock = 15000; await read(); await drain(); assert.equal(starts, 3);
  clock = 100000; const stopped = await read();
  assert.equal(starts, 3);
  assert.match(stopped.adb.error, /自動復原未成功/);
  assert.equal(stopped.adb.ready, false);
});

test('recovery requires an ADB failure and an idle executor; healthy reads reset the budget', async () => {
  let idle = false, broken = true, starts = 0;
  const failure = Object.assign(new Error('failed'), { code: 'ADB_UNAVAILABLE' });
  const read = createAndroidHealth({ status: async () => {
    if (broken) throw failure;
    return { sdk: { ready: true }, devices: [], appium: {}, issues: [] };
  }, ensureAdb: async () => { starts++; } }, { canRecover: () => idle });
  await read(); await drain(); assert.equal(starts, 0);
  idle = true; await read(); await drain(); assert.equal(starts, 1);
  broken = false; assert.equal((await read()).adb.ready, true);
  broken = true; await read(); await drain(); assert.equal(starts, 2);
  failure.code = 'EMULATOR_UNAVAILABLE';
  await read(); await drain(); assert.equal(starts, 2);
});

test('missing SDK never reports ADB ready or attempts daemon recovery', async () => {
  let starts = 0;
  const read = createAndroidHealth({ status: async () => ({ sdk: { ready: false }, devices: [], issues: ['Missing SDK'] }), ensureAdb: async () => { starts++; } });
  const status = await read();
  assert.equal(status.adb.ready, false);
  assert.equal(status.adb.canRetry, false);
  assert.equal(starts, 0);
});

test('ADB failure preserves identities but clears readiness and still advertises recovery', async () => {
  let fail = false, calls = 0;
  const original = { sdk: { ready: true, path: '/sdk' }, avds: ['Pixel'], devices: [{ serial: 'emulator-5554', profileId: 'phone', managed: true, booted: true, state: 'device' }], appium: { ready: true, reachable: true }, issues: [] };
  const health = createAndroidHealth({ status: async () => { calls++; if (fail) throw new Error('ADB unavailable'); return original; } });
  assert.equal((await health()).adb.ready, true);
  fail = true;
  const broken = await health();
  assert.equal(broken.adb.canRetry, true);
  assert.equal(broken.adb.ready, false);
  assert.equal(broken.devices[0].profileId, 'phone');
  assert.equal(broken.devices[0].state, 'offline');
  assert.equal(broken.devices[0].booted, false);
  assert.equal(broken.appium.ready, false);
  const before = calls;
  assert.equal((await health(true)).adb.ready, false);
  assert.equal(calls, before, 'do not race status reads with an intentional ADB reset');
  fail = false;
  assert.equal((await health()).devices[0].booted, true);
  assert.equal(original.devices[0].booted, true, 'fallback must not mutate the last successful status');
});

test('recovery is reachable even if the first ADB inventory fails', async () => {
  const read = createAndroidHealth({ status: async () => { throw new Error('ADB unavailable'); } });
  const status = await read();
  assert.equal(status.adb.canRetry, true);
  assert.equal(status.adb.ready, false);
  assert.deepEqual(status.devices, []);
});
