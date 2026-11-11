// A broken ADB must not take down the worker's separate control connection.
export function createAndroidHealth(bridge, options = {}) {
  const now = options.now || Date.now;
  const log = options.log || (() => {});
  let attempts = 0, nextAttempt = 0, pending, lastCode = '';
  let previous = { sdk: { ready: false, path: '' }, avds: [], devices: [], issues: [], appium: { ready: false, reachable: false } };
  return async function read(recovering = false) {
    try {
      if (recovering || pending) throw new Error('正在重試手機連線。');
      previous = await bridge.status();
      if (lastCode && previous.sdk.ready) log({ event: 'android-health-restored' });
      attempts = 0; nextAttempt = 0; lastCode = '';
      return { ...previous, adb: { ready: previous.sdk.ready, canRetry: previous.sdk.ready, error: '' } };
    } catch (reason) {
      if (reason.androidStatus) previous = { ...previous, ...reason.androidStatus };
      if (!recovering && !pending && reason.code === 'ADB_UNAVAILABLE' && bridge.ensureAdb && attempts < 3 && now() >= nextAttempt && (options.canRecover?.() ?? true)) {
        attempts++;
        log({ event: 'adb-recovery', attempt: attempts, code: reason.code });
        pending = Promise.resolve().then(() => bridge.ensureAdb()).catch(error => {
          log({ event: 'adb-recovery-failed', attempt: attempts, code: error.code || 'ADB_START_FAILED' });
        }).finally(() => { nextAttempt = now() + 5000 * 2 ** (attempts - 1); pending = undefined; });
      }
      if (reason.code && reason.code !== lastCode) {
        lastCode = reason.code;
        log({ event: 'android-health-failed', code: reason.code });
      }
      const error = recovering || pending ? '正在重試手機連線。'
        : attempts >= 3 ? 'ADB 自動復原未成功，請按「重試連線」；若仍失敗，請由主機管理者檢查 ADB 權限與連接埠。'
        : reason.androidStatus?.issues[0] || '無法讀取手機狀態，請按「重試連線」。';
      return { ...previous, devices: previous.devices.map(device => ({ ...device, state: 'offline', booted: false, error })),
        appium: { ...previous.appium, ready: false }, issues: [error], adb: { ready: false, canRetry: true, error } };
    }
  };
}
