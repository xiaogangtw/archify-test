import test from 'node:test';
import assert from 'node:assert/strict';
import { unavailableAndroidStatus, updateAndroidStatus } from '../../../apps/web/src/features/testing/androidStatus.ts';

const online = () => ({ connected: true, appium: {ready: true}, devices: [{serial: 'emulator-5554', booted: true, canControl: true}] });

test('failed status polls retain device identity without retaining operation permission', () => {
  const previous = online();
  const failed = unavailableAndroidStatus(previous)!;
  assert.equal(failed.devices[0].serial, previous.devices[0].serial);
  assert.equal(failed.connected, false);
  assert.equal(failed.devices[0].booted, false);
  assert.equal(failed.devices[0].canControl, false);
  assert.equal(failed.appium.ready, false);
  assert.deepEqual(previous, online());
  assert.equal(unavailableAndroidStatus(null), null);
});

test('expired worker retains the viewer, recovery restores it, confirmed removal removes it', () => {
  const expired = updateAndroidStatus(online(), {...online(), connected: false, devices: []});
  assert.equal(expired.devices.length, 1);
  assert.equal(expired.devices[0].canControl, false);
  const recovered = updateAndroidStatus(expired, online());
  assert.deepEqual(recovered, online());
  assert.deepEqual(updateAndroidStatus(recovered, {...online(), devices: []}).devices, []);
});
