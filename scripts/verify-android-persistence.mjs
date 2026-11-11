// Creates a dedicated verification phone, writes a harmless /sdcard marker,
// shuts it down and reopens it. No existing phone or account data is changed.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createAndroidBridge, runFile } from '../services/android/bridge.mjs';
import { createProfileCatalog } from '../services/android/profiles.mjs';
const id = process.env.ARCHIFY_PROFILE_TEST_ID || randomUUID();
console.log('Verification profile: ' + id);
const bridge = createAndroidBridge(), tools = await bridge.tools();
await bridge.prepareProfile(id);
const marker = 'archify-persistence-' + id, path = resolve('.local/persistence-marker.txt');
await mkdir('.local', { recursive: true }); await writeFile(path, marker);
let serial;
async function boot(label) {
  const start = performance.now();
  const { started } = await bridge.startProfile(id);
  serial = started[0];
  const deadline = Date.now() + 360000;
  while (Date.now() < deadline) {
    if ((await bridge.status()).devices.some(device => device.serial === serial && device.booted)) {
      console.log(label + ' readiness: ' + Math.round(performance.now() - start) + ' ms (includes status polling)');
      return serial;
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error('Verification phone did not complete boot; it was stopped and its data has been preserved.');
}
try {
  serial = await boot('First boot'); console.log('First boot ready: ' + serial);
  await runFile(tools.adb, ['-s', serial, 'push', path, '/sdcard/archify-persistence-marker.txt']); console.log('Marker written.');
  await runFile(tools.adb, ['-s', serial, 'shell', 'sync']);
  await bridge.stop(serial); serial = undefined; console.log('Shutdown completed; reopening same phone.');
  const snapshot = join(createProfileCatalog().path(id), 'snapshots', 'default_boot', 'snapshot.pb');
  assert.ok((await stat(snapshot)).size > 0, 'Quick Boot snapshot must be saved on normal shutdown');
  console.log('Quick Boot snapshot exists.');
  serial = await boot('Second boot');
  console.log('Second boot ready: ' + serial);
  assert.equal((await runFile(tools.adb, ['-s', serial, 'shell', 'cat', '/sdcard/archify-persistence-marker.txt'])).trim(), marker);
  console.log('PASS real writable phone retains data after shutdown and restart. LINE login was not tested.');
} finally { if (serial) await bridge.stop(serial); bridge.close(); }
