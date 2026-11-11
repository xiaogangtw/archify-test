import test from 'node:test';
import assert from 'node:assert/strict';
import { createHostControl } from './host-process.mjs';
import { createAndroidBridge } from './bridge.mjs';
import { runFile } from './bridge.mjs';
import { fileURLToPath } from 'node:url';

test('Windows process guards reject reused PID, foreign executable, AVD and port', { skip: process.platform !== 'win32' }, async () => {
  const output = await runFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', fileURLToPath(new URL('../../scripts/test-android-host-process.ps1', import.meta.url))], false, 5000);
  assert.match(output, /Host identity guards passed/);
});

test('host stop verifies the exact process identity and checks exit without ADB', async () => {
  const calls = [];
  const rows = [{ pid: 20, launcher: true, createdAt: 'launch-time', avd: 'Archify_Phone', serial: 'emulator-5554' }, { pid: 21, launcher: false, createdAt: 'guest-time', avd: 'Archify_Phone', serial: 'emulator-5554' }];
  const host = createHostControl(async (file, args, _binary, timeout) => {
    calls.push({ file, args, timeout });
    if (args.includes('list')) return JSON.stringify(rows);
    const pid = Number(args[args.indexOf('-TargetId') + 1]);
    rows.splice(rows.findIndex(row => row.pid === pid), 1);
    return '';
  });
  await host.stop('/sdk', 'emulator-5554', 'Archify_Phone');
  const stops = calls.filter(call => call.args.includes('stop'));
  assert.equal(stops.length, 2);
  assert.equal(stops[0].args[stops[0].args.indexOf('-TargetId') + 1], '21');
  assert.ok(stops[0].args.includes('guest-time'));
  assert.ok(calls.every(call => call.timeout > 0 && call.timeout <= 5000));
});

test('host refuses ambiguous or mismatched AVD identity', async () => {
  let stopped = false;
  const host = createHostControl(async (_file, args) => {
    if (args.includes('stop')) stopped = true;
    return JSON.stringify([{ pid: 99, createdAt: 'other', avd: 'Other', serial: 'emulator-5554' }]);
  });
  await assert.rejects(host.stop('/sdk', 'emulator-5554', 'Archify_Phone'), /身分/);
  assert.equal(stopped, false);
});

test('worker rediscovers a crashed fixed phone without ADB and can stop it independently', async () => {
  const id = '8a5173e8-3fe1-42fb-8c58-390fb6aefeea', avd = 'Archify_Device_8a5173e83fe142fb8c58390fb6aefeea';
  let alive = true, failStop = true;
  const calls = [];
  const bridge = createAndroidBridge({ env: { ANDROID_HOME: '/sdk' }, exists: async () => true,
    catalog: { list: async () => [{ id, avd }] },
    hostControl: { list: async () => alive ? [{ serial: 'emulator-5554', avd }] : [],
      stop: async (root, serial, name) => {
        assert.equal(root, '/sdk'); assert.equal(serial, 'emulator-5554'); assert.equal(name, avd);
        if (failStop) throw new Error('permission denied');
        alive = false;
      } },
    execute: async (_file, args) => { calls.push(args); throw new Error('Android is frozen'); },
  });
  await assert.rejects(bridge.status(), error => {
    assert.equal(error.androidStatus.devices[0].profileId, id);
    assert.equal(error.androidStatus.devices[0].booted, false);
    return true;
  });
  await assert.rejects(bridge.stop('emulator-5556'), /只能停止/);
  await assert.rejects(bridge.stop('emulator-5554'), /permission denied/);
  failStop = false;
  const before = calls.length;
  const result = await bridge.stop('emulator-5554');
  assert.equal(result.forced, true);
  assert.equal(result.stopped, 'emulator-5554');
  assert.deepEqual(calls.slice(before), [['-s', 'emulator-5554', 'emu', 'kill']]);
  await assert.rejects(bridge.stop('emulator-5554'), /只能停止/);
  bridge.close();
});

test('boot flag alone cannot mark a phone with dead core services ready', async () => {
  const bridge = createAndroidBridge({ exists: async () => true, fetch: async () => { throw new Error(); },
    execute: async (_file, args) => {
      if (args[0] === '-list-avds') return 'Pixel';
      if (args[0] === 'devices') return 'emulator-5554 device';
      if (args.includes('getprop')) return '1';
      if (args.includes('check')) return 'Service activity: not found\nService window: not found';
      return '';
    },
  });
  const status = await bridge.status();
  assert.equal(status.devices[0].booted, false);
  assert.match(status.devices[0].error, /核心服務/);
  bridge.close();
});

test('a reused serial cannot send even a graceful kill to a different AVD', async () => {
  let changed = false, kills = 0;
  const bridge = createAndroidBridge({ env: { ANDROID_HOME: '/sdk' }, exists: async () => true,
    catalog: { list: async () => [{ id: 'phone', avd: 'Archify_Phone' }] },
    hostControl: { list: async () => [{ serial: 'emulator-5554', avd: changed ? 'Other' : 'Archify_Phone' }], stop: async () => assert.fail('must not force stop') },
    execute: async (_file, args) => { if (args.includes('kill')) kills++; throw new Error('ADB failed'); },
  });
  await assert.rejects(bridge.status());
  changed = true;
  await assert.rejects(bridge.stop('emulator-5554'), /身分已變更/);
  assert.equal(kills, 0);
  bridge.close();
});
