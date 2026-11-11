import { createAndroidBridge } from '../services/android/bridge.mjs';

// Local host recovery only. Browser ownership is enforced separately by the API.
const [serial, flag, ...extra] = process.argv.slice(2);
if (!/^emulator-\d+$/.test(serial || '') || (flag && flag !== '--check') || extra.length) throw new Error('用法：npm run android:stop -- emulator-5554 [--check]');
const bridge = createAndroidBridge();
try {
  let status;
  try { status = await bridge.status(); }
  catch (error) { if (!error.androidStatus) throw error; status = error.androidStatus; }
  const device = status.devices?.find(row => row.serial === serial && row.managed && row.avd.startsWith('Archify_'));
  if (!device) throw new Error('無法確認此裝置為 Archify 管理的手機，未停止任何程序。');
  console.log(`已確認 ${serial} 使用 ${device.avd}。`);
  if (flag !== '--check') {
    const result = await bridge.stop(serial);
    console.log(result.warning || `${serial} 已停止。`);
  }
} finally { bridge.close(); }
