import assert from 'node:assert/strict';
import { createAndroidBridge } from '../services/android/bridge.mjs';
import { createAppium } from '../services/android/appium.mjs';

// Dedicated verification profiles; never launch or change the user's account phones.
const profiles = ['f925bea2-31be-4974-963a-293b05f11270', '06c18628-2359-4ee3-890a-4a5288e297c1'];
const bridge = createAndroidBridge(), appium = createAppium(bridge), started = [];
try {
  await appium.start();
  for (const id of profiles) {
    await bridge.prepareProfile(id);
    const existing = (await bridge.status()).devices.find(device => device.profileId === id);
    if (existing) throw new Error('Verification profile already running; refusing to take over.');
    const serial = (await bridge.startProfile(id)).started[0]; started.push(serial);
    const deadline = Date.now() + 300000;
    while (!(await bridge.status()).devices.some(device => device.serial === serial && device.booted)) {
      if (Date.now() > deadline) throw new Error('Verification phone boot timed out.');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    console.log('Verification phone ready: ' + serial);
  }
  const bindings = { sender: started[0], receiver: started[1] };
  const step = actor => ({ actor, name: 'Settings content visible', action: 'assertVisible', using: 'id', value: 'android:id/content' });
  const definition = { appPackage: 'com.android.settings', actors: ['sender','receiver'], steps: [step('sender'),step('receiver'),step('sender')] };
  const passed = await appium.run(bindings, definition);
  console.log(JSON.stringify(passed)); assert.equal(passed.status, 'passed');
  const failed = await appium.run(bindings, { ...definition, steps: [step('sender'), { ...step('receiver'), value: 'com.android.settings:id/archify_nonexistent_element' },step('sender')] });
  console.log(JSON.stringify(failed)); assert.equal(failed.status, 'failed'); assert.equal(failed.steps[2].status, 'pending');
  for (const serial of started) assert.equal(appium.busy(serial), false);
  console.log('PASS real two-phone sessions, actor switching, assertion failure and cleanup. Settings only; no business exchange verified.');
} finally {
  for (const serial of started) { try { await bridge.stop(serial); } catch { console.error('Verification phone shutdown unconfirmed: ' + serial); } }
  appium.close(); bridge.close();
}
