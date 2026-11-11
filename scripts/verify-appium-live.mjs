import assert from 'node:assert/strict';
import { createAndroidBridge } from '../services/android/bridge.mjs';
import { createAppium } from '../services/android/appium.mjs';
const profileId = 'f925bea2-31be-4974-963a-293b05f11270';
const bridge = createAndroidBridge(), appium = createAppium(bridge, { onSession: async session => { const source = await session.source(); console.log('Settings resource IDs: ' + [...new Set([...source.matchAll(/resource-id="([^"]+)"/g)].map(match => match[1]))].slice(0, 25).join(', ')); } });
let serial;
try {
  await appium.start(); console.log('Appium ready.');
  await bridge.prepareProfile(profileId);
  serial = (await bridge.startProfile(profileId)).started[0]; console.log('Verification phone starting: ' + serial);
  const deadline = Date.now() + 300000;
  while (!(await bridge.status()).devices.some(device => device.serial === serial && device.booted)) {
    if (Date.now() > deadline) throw new Error('驗證手機開機逾時。');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  console.log('Verification phone ready.');
  const passed = await appium.run(serial, { appPackage: 'com.android.settings', steps: [{ name: '設定畫面內容可見', action: 'assertVisible', using: 'id', value: 'android:id/content' }] });
  console.log(JSON.stringify(passed)); assert.equal(passed.status, 'passed');
  const failed = await appium.run(serial, { appPackage: 'com.android.settings', steps: [{ name: '刻意找不存在元件', action: 'assertVisible', using: 'id', value: 'com.android.settings:id/archify_nonexistent_element' }] });
  console.log(JSON.stringify(failed)); assert.equal(failed.status, 'failed');
  console.log('PASS real Appium session, visible assertion, failing assertion and cleanup. No LINE account or screenshot accessed.');
} finally { if (serial) { try { await bridge.stop(serial); } catch { console.error('驗證手機尚未確認關閉，請檢查裝置狀態。'); } } appium.close(); bridge.close(); }
