import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { createProfileCatalog, profileAvd } from './profiles.mjs';
import { createAndroidBridge } from './bridge.mjs';
test('catalog survives recreation, rejects path injection and serializes independent profiles', async () => {
  const root = await mkdtemp(join(tmpdir(), 'archify-profiles-')), catalog = createProfileCatalog(root);
  const ids = [randomUUID(), randomUUID()];
  await Promise.all(ids.map(id => catalog.add({ id, avd: profileAvd(id) })));
  assert.equal((await createProfileCatalog(root).list()).length, 2);
  assert.throws(() => profileAvd('../../other'));
  assert.ok(!(await readFile(join(root, 'catalog.json'), 'utf8')).includes('password'));
});
test('persistent launch is writable, exclusive, rediscovered after worker restart and preserved on close', async () => {
  const id = randomUUID(), avd = profileAvd(id), launched = [];
  let online = false, killed = 0;
  const options = { env: { ANDROID_HOME: '/sdk' }, exists: async () => true, portFree: async () => true, catalog: { list: async () => [{ id, avd }] }, fetch: async () => { throw new Error(); },
    execute: async (_file, args) => {
      if (args[0] === '-list-avds') return avd;
      if (args[0] === '-accel-check') return 'accel:\n0\n';
      if (args[0] === 'devices') return online ? 'emulator-5554 device' : '';
      if (args.includes('getprop')) return '1';
      if (args.includes('check')) return 'Service activity: found\nService window: found';
      if (args.includes('name')) return avd + '\nOK';
      if (args.includes('kill')) { online = false; killed++; }
      return '';
    }, launch: (_file, args) => { const child = new EventEmitter(); child.kill = () => { killed++; }; launched.push(args); return child; },
  };
  const first = createAndroidBridge(options); await first.startProfile(id);
  assert.ok(!launched[0].includes('-read-only')); assert.ok(!launched[0].includes('-wipe-data'));
  assert.ok(!launched[0].includes('-no-snapshot-save'));
  assert.ok(launched[0].includes('-no-snapshot-load'));
  assert.ok(!launched[0].includes('-no-snapshot'));
  online = true;
  await assert.rejects(first.startProfile(id), /已在執行/);
  first.close(); assert.equal(killed, 0);
  const restarted = createAndroidBridge(options);
  assert.equal((await restarted.status()).devices[0].profileId, id);
  await restarted.stop('emulator-5554'); assert.equal(killed, 1);
  assert.equal((await restarted.status()).devices.length, 0);
});

test('shutdown waits for snapshot flush after ADB disconnect and blocks reopening until exit', async () => {
  const id = randomUUID(), avd = profileAvd(id), child = new EventEmitter();
  child.exitCode = null;
  child.kill = () => assert.fail('A writable phone must not be force-killed while saving');
  let online = false, disconnected;
  const adbDisconnected = new Promise(resolve => { disconnected = resolve; });
  const bridge = createAndroidBridge({
    env: { ANDROID_HOME: '/sdk' }, exists: async () => true, portFree: async () => true,
    catalog: { list: async () => [{ id, avd }] }, launch: () => child,
    execute: async (_file, args) => {
      if (args[0] === '-list-avds') return avd;
      if (args[0] === '-accel-check') return 'accel:\n0\n';
      if (args[0] === 'devices') return online ? 'emulator-5554 device' : '';
      if (args.includes('getprop')) return '1';
      if (args.includes('check')) return 'Service activity: found\nService window: found';
      if (args.includes('kill')) { online = false; disconnected(); }
      return '';
    },
  });
  await bridge.startProfile(id); online = true;
  let completed = false;
  const stopped = bridge.stop('emulator-5554').then(result => { completed = true; return result; });
  await adbDisconnected;
  await assert.rejects(bridge.startProfile(id), /關機/);
  assert.equal(completed, false);
  child.exitCode = 0; child.emit('exit', 0);
  assert.deepEqual(await stopped, { stopped: 'emulator-5554' });
  assert.equal(completed, true);
  await bridge.startProfile(id);
  bridge.close();
});
