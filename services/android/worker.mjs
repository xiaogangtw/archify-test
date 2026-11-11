import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createAndroidBridge } from './bridge.mjs';
import { createScrcpyWorker } from './scrcpy-worker.mjs';
import { createAppium } from './appium.mjs';
import { createAndroidHealth } from './health.mjs';

const base = process.env.CONTROL_API_URL || 'http://127.0.0.1:3001';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Android 執行器只能透過本機 API 或 SSH 通道連線。');
const token = (await readFile(process.env.ANDROID_WORKER_TOKEN_FILE || '.local/android-worker-token', 'utf8')).trim();
if (token.length < 32) throw new Error('缺少有效的 VM Android 配對檔，請依部署說明完成配對。');
const session = randomUUID(), bridge = createAndroidBridge();
const appium = createAppium(bridge);
let recovering = false;
const health = createAndroidHealth(bridge, {
  canRecover: () => !recovering && !stopping && !appium.hasActive(),
  log: event => console.error('[Android health]', JSON.stringify(event)),
});
bridge.appiumBusy = serial => recovering || appium.busy(serial);
void appium.start().catch(error => console.error(error.message));
let stopping = false, connected = false;
const scrcpy = createScrcpyWorker({ base, token, session, bridge, connected: () => connected && !recovering });
let frameIndex = 0;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function call(path, body, timeout = 10000) {
  const response = await fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`Android 控制服務 HTTP ${response.status}`);
  return response.json();
}
async function executorStatus() {
  const status = await health(recovering);
  status.appium.apiFlows = true; status.appium.multiDevice = true; status.appium.conditionalFlows = true; status.appium.batchSessionReuse = true; status.appium.exploreToast = true; status.appium.agentTasks = true; status.appium.agentProtocol=3;
  status.devices = status.devices.map(device => ({ ...device, appiumBusy: appium.busy(device.serial), appiumBatch: appium.leaseFor(device.serial), appiumTask:appium.exploreFor(device.serial) }));
  if (status.devices.some(device => appium.cleanupFailed(device.serial))) status.issues = [...status.issues, 'Appium 工作階段清理未確認，請重新啟動 Android 執行器。'].slice(-20);
  return status;
}
async function heartbeat() {
  while (!stopping) {
    try { await call('/internal/android/status', { session, status: await executorStatus() }); if (!connected) console.log('Android 執行器已配對。'); connected = true; }
    catch { if (connected) console.error('Android 執行器連線中斷，暫停接收操作。'); connected = false; }
    await pause(5000);
  }
}
async function commands() {
  while (!stopping) {
    if (!connected) { await pause(1000); continue; }
    try {
      const command = await call('/internal/android/claim', { session });
      if (!command) { await pause(500); continue; }
      if (command.action === 'stream') {
        const serial = command.serials[frameIndex++ % command.serials.length];
        try {
          const png = await bridge.screen(serial);
          if (png.length > 1400000) throw new Error('裝置畫面過大，請降低虛擬裝置解析度。');
          await call('/internal/android/frame', { session, serial, png: png.toString('base64') });
        } catch (reason) {
          try { await call('/internal/android/frame', { session, serial, error: reason.message }); } catch { /* Next claim revalidates the connection. */ }
        }
        // Commands are checked before every frame; frames never occupy the command queue.
        await pause(200);
        continue;
      }
      let result, error, notDispatched=false;
      try {
        if (command.serial && !['appiumRun','screen','agentDevice'].includes(command.action) && appium.busy(command.serial)) throw new Error('Appium 正在使用此手機，請等待批次完成。');
        if (command.action === 'appiumRun') {
          const target = command.payload.bindings || command.serial;
          for (const serial of typeof target === 'string' ? [target] : Object.values(target)) scrcpy.release(serial);
          result = await appium.run(target, command.payload.definition, command.payload.agentTask ? async()=>{} : progress => call(`/internal/android/progress/${command.payload.runId}`, { session, ...progress }), command.payload.dependencies, { id: command.payload.batchId, owner: command.payload.batchOwner, keep: command.payload.batchContinue === true }, (step,path,inputs)=>call(`/internal/android/api-step/${command.payload.runId}`,{session,key:JSON.stringify([step.scriptId,step.scriptVersion,step.namespace,step.authVariable||'',step.inputs||{},step.overrides||[],step.pollTimeoutMs||0]),path,inputs},285000));
          await call('/internal/android/status',{session,status:await executorStatus()});
        }
        else if (command.action === 'adbRetry') {
          if (appium.hasActive()) throw new Error('測試或 Agent 正在操作手機，請結束後再重試連線。');
          recovering = true; scrcpy.reset();
          try { result = await bridge.retryAdb(); }
          finally { recovering = false; await call('/internal/android/status', { session, status: await executorStatus() }); }
        }
        else if (command.action === 'appiumRetry') { await appium.start(); const status = await executorStatus(); await call('/internal/android/status', { session, status }); result = { ready: status.appium.ready }; }
        else if (command.action === 'prepareProfile') result = await bridge.prepareProfile(command.payload.id);
        else if (command.action === 'startProfile') result = await bridge.startProfile(command.payload.id);
        else if (command.action === 'start') result = await bridge.start(command.payload.avd, command.payload.count);
        else if (command.action === 'stop') {
          scrcpy.release(command.serial);
          result = await bridge.stop(command.serial);
        }
        else if (command.action === 'inspect') result = await bridge.inspect(command.serial);
        else if (command.action === 'agentDevice') {
          const {key,tool}=command.payload;
          if(tool.kind==='close'){await appium.closeExplorer(command.serial,key);result={accepted:true};}
          else{scrcpy.release(command.serial);result=await appium.explore(command.serial,key,tool);}
          await call('/internal/android/status',{session,status:await executorStatus()});
        }
        else if (command.action === 'observeTap') { scrcpy.release(command.serial); result = await appium.captureAfterTap(command.serial, command.payload); }
        else if (command.action === 'input') result = await bridge.input(command.serial, command.payload);
        else if (command.action === 'screen') {
          const png = await bridge.screen(command.serial);
          if (png.length > 1400000) throw new Error('裝置畫面過大，請降低虛擬裝置解析度後重試。');
          result = { png: png.toString('base64') };
        } else throw new Error('不支援的操作。');
      } catch (reason) { error = reason.message; notDispatched=reason.notDispatched===true; }
      // Never repeat a device command when delivery of its result fails.
      try { await call(`/internal/android/result/${command.id}`, { session, result, error,notDispatched }); }
      catch { console.error('操作結果未能回報，請在網頁重新整理裝置狀態；不會重複執行。'); }
    } catch { await pause(1000); }
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; scrcpy.close(); void appium.close(); bridge.close(); });
console.log('Android 執行器啟動中；僅接收已配對 VM 的固定裝置指令。');
await Promise.all([heartbeat(), commands()]);
