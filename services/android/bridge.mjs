import { execFile, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createServer as createTcpServer } from 'node:net';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createProfileCatalog, prepareProfile } from './profiles.mjs';
import { createHostControl } from './host-process.mjs';

export function runFile(file, args, binary = false, timeout = 15000) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024, encoding: binary ? 'buffer' : 'utf8' },
      (error, stdout) => error ? reject(Object.assign(new Error('Android 指令執行失敗，請檢查 SDK 與模擬器狀態。'),
        { code: error.killed ? 'ANDROID_COMMAND_TIMEOUT' : String(error.code || 'ANDROID_COMMAND_FAILED') })) : resolve(stdout));
  });
}

export function parseDevices(output) {
  return output.split(/\r?\n/).flatMap(line => {
    const match = /^(emulator-\d+)\s+(device|offline|unauthorized)\b/.exec(line);
    return match ? [{ serial: match[1], state: match[2] }] : [];
  });
}

const availablePort = port => new Promise(resolve => {
  const server = createTcpServer();
  server.once('error', () => resolve(false));
  server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
});

export function createAndroidBridge(options = {}) {
  const execute = options.execute || runFile;
  const launch = options.launch || spawn;
  const exists = options.exists || (async path => { try { await access(path); return true; } catch { return false; } });
  const portFree = options.portFree || availablePort;
  const env = options.env || process.env;
  const managed = new Map();
  const host = options.hostControl ?? (process.platform === 'win32' && !options.execute ? createHostControl(execute) : null);
  const catalog = options.catalog || createProfileCatalog();
  const busy = new Set();
  let launching = false;
  let recovering = false;
  let sequence = 0;

  async function sdk() {
    const candidates = [...new Set([
      env.ARCHIFY_ANDROID_SDK, env.ANDROID_HOME, env.ANDROID_SDK_ROOT,
      fileURLToPath(new URL('../../.local/android-sdk', import.meta.url)),
      join(homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
      join(homedir(), 'Android', 'Sdk'), join(homedir(), 'Library', 'Android', 'sdk'),
    ].filter(Boolean))];
    const suffix = process.platform === 'win32' ? '.exe' : '';
    for (const root of candidates) {
      const adb = join(root, 'platform-tools', `adb${suffix}`);
      const emulator = join(root, 'emulator', `emulator${suffix}`);
      if (await exists(adb) && await exists(emulator)) return { root, adb, emulator };
    }
    return null;
  }

  async function inventory() {
    const tools = await sdk();
    if (!tools) return { tools: null, avds: [], devices: [], issues: ['找不到完整的 Android SDK。請安裝 Android Emulator、Platform-Tools 與系統映像，並建立虛擬裝置。'] };
    // Rediscover fixed phones even when ADB or Android is unresponsive, including
    // after the worker restarts. Only catalogued AVDs from this SDK are adopted.
    if (host) {
      const profiles = await catalog.list();
      const processes = await host.list(tools.root);
      for (const process of processes) {
        const profile = profiles.find(row => row.avd === process.avd);
        if (profile && !managed.has(process.serial)) managed.set(process.serial, { avd: profile.avd, profileId: profile.id, id: ++sequence, hostTracked: true, error: '' });
      }
      for (const [serial, entry] of managed) entry.hostAlive = processes.some(row => row.serial === serial && row.avd === entry.avd);
    }
    const [avdResult, deviceResult] = await Promise.allSettled([
      execute(tools.emulator, ['-list-avds'], false, 2000), execute(tools.adb, ['devices', '-l'], false, 2000),
    ]);
    if (avdResult.status === 'rejected' || deviceResult.status === 'rejected') {
      const issue = deviceResult.status === 'rejected'
        ? 'Android SDK 已偵測，但 ADB 無法讀取裝置。請重試連線或檢查 Windows 主機的 ADB 背景服務。'
        : 'Android SDK 已偵測，但無法讀取虛擬裝置清單。請檢查模擬器狀態。';
      const error = new Error(issue);
      error.code = deviceResult.status === 'rejected' ? 'ADB_UNAVAILABLE' : 'EMULATOR_UNAVAILABLE';
      error.androidStatus = { sdk: { ready: true, path: tools.root },
        ...(host ? { devices: [...managed].filter(([, entry]) => entry.hostAlive).map(([serial, entry]) => ({ serial, state: 'offline', booted: false, managed: true, avd: entry.avd, error: issue, ...(entry.profileId ? { profileId: entry.profileId } : {}) })) } : {}),
        avds: avdResult.status === 'fulfilled' ? avdResult.value.split(/\r?\n/).map(s => s.trim()).filter(s => /^[A-Za-z0-9_.-]+$/.test(s)) : [],
        issues: [issue] };
      throw error;
    }
    const avdText = avdResult.value, deviceText = deviceResult.value;
    const avds = avdText.split(/\r?\n/).map(s => s.trim()).filter(s => /^[A-Za-z0-9_.-]+$/.test(s));
    const profiles = await catalog.list();
    const devices = await Promise.all(parseDevices(deviceText).map(async device => {
      let booted = false;
      if (device.state === 'device') {
        try {
          const [boot, services] = await Promise.all([
            execute(tools.adb, ['-s', device.serial, 'shell', 'getprop', 'sys.boot_completed'], false, 2000),
            execute(tools.adb, ['-s', device.serial, 'shell', 'service', 'check', 'activity', '&&', 'service', 'check', 'window'], false, 2000),
          ]);
          booted = boot.trim() === '1' && /Service activity: found/.test(services) && /Service window: found/.test(services);
        }
        catch { /* An offline or disappearing emulator is not ready. */ }
      }
      if (!managed.has(device.serial) && device.state === 'device' && profiles.length) {
        try {
          const avd = (await execute(tools.adb, ['-s', device.serial, 'emu', 'avd', 'name'], false, 2000)).split(/\r?\n/)[0].trim();
          const profile = profiles.find(row => row.avd === avd);
          if (profile) managed.set(device.serial, { avd, profileId: profile.id, error: '', id: ++sequence });
        } catch { /* An unavailable console cannot prove this device's identity. */ }
      }
      const own = managed.get(device.serial);
      return { ...device, booted, managed: !!own, avd: own?.avd || '', error: own?.error || (device.state === 'device' && !booted ? 'Android 核心服務尚未就緒或已失去回應；可關機後重新啟動。' : ''), ...(own?.profileId ? { profileId: own.profileId } : {}) };
    }));
    for (const [serial, entry] of managed) {
      if (!devices.some(d => d.serial === serial)) {
        if (entry.profileId && !entry.child && !entry.hostAlive) { managed.delete(serial); continue; }
        devices.push({ serial, state: entry.error ? 'error' : 'starting', booted: false, managed: true, avd: entry.avd, error: entry.error || '', ...(entry.profileId ? { profileId: entry.profileId } : {}) });
      }
    }
    return { tools, avds, devices, issues: avds.length ? [] : ['尚未建立虛擬裝置。請先在 Android Studio 的 Device Manager 建立一個裝置。'] };
  }

  async function status() {
    const data = await inventory();
    let appium = { reachable: false, ready: false };
    try {
      const response = await (options.fetch || fetch)('http://127.0.0.1:4723/status', { signal: AbortSignal.timeout(1500) });
      const body = await response.json();
      appium = { reachable: response.ok, ready: response.ok && body.value?.ready === true };
    } catch { /* No Appium service is a truthful unavailable state. */ }
    return { sdk: { ready: !!data.tools, path: data.tools?.root || '' }, avds: data.avds, devices: data.devices, issues: data.issues, appium };
  }

  async function start(avd, count, profileId) {
    if (recovering) throw new Error('正在重試手機連線，請稍後操作。');
    if (busy.size) throw new Error('手機正在處理操作或關機，請等待完成。');
    if (launching) throw new Error('已有啟動作業，請等待後重試。');
    if (typeof avd !== 'string' || !Number.isInteger(count) || count < 1 || count > 4) throw new Error('請選擇有效裝置與啟動數量（1 至 4）。');
    launching = true;
    try {
      const current = await inventory();
      if (!current.tools) throw new Error('Android SDK 尚未就緒。');
      if (!current.avds.includes(avd)) throw new Error('選擇的虛擬裝置不存在，請重新整理。');
      if (!profileId && avd.startsWith('Archify_Device_')) throw new Error('固定手機必須從固定手機清單啟動。');
      if (profileId) {
        if (count !== 1 || !(await catalog.list()).some(row => row.id === profileId && row.avd === avd)) throw new Error('固定手機尚未建立，請先準備手機。');
        if (current.devices.some(device => device.avd === avd)) throw new Error('這台固定手機已在執行，請選擇現有裝置。');
      }
      let accelerated = false;
      try { accelerated = /accel:\s*0(?:\s|$)/.test(await execute(current.tools.emulator, ['-accel-check'])); } catch { /* Refuse unaccelerated launches. */ }
      if (!accelerated) throw new Error('模擬器硬體加速尚未就緒，請先啟用 Windows Hypervisor Platform 並重新開機。');
      // Headless auto selection can fall back to CPU-based SwiftShader. Prefer
      // the host GPU; allow an explicit compatibility fallback for driver issues.
      const gpu = env.ARCHIFY_ANDROID_GPU || 'host';
      if (!['host', 'auto', 'software'].includes(gpu)) throw new Error('ARCHIFY_ANDROID_GPU 必須是 host、auto 或 software。');
      const active = current.devices.filter(d => d.state !== 'error');
      if (active.length + count > 4) throw new Error('此本機服務最多同時管理 4 台模擬器，請先停止不使用的裝置。');
      const ports = [];
      for (let port = 5554; port <= 5584 && ports.length < count; port += 2) {
        if (!current.devices.some(d => d.serial === `emulator-${port}`) && await portFree(port) && await portFree(port + 1)) ports.push(port);
      }
      if (ports.length !== count) throw new Error('沒有足夠的可用模擬器連接埠。');
      const started = [];
      for (const port of ports) {
        const serial = `emulator-${port}`;
        const child = launch(current.tools.emulator, [
          // Writable phones save Quick Boot on normal shutdown. Temporary copies
          // must never overwrite the shared AVD's snapshot.
          '-avd', avd, '-port', String(port), '-gpu', gpu, ...(profileId ? ['-no-snapshot-load'] : ['-read-only', '-no-snapshot-save']), '-no-window', '-no-audio', '-no-boot-anim',
        ], { windowsHide: true, stdio: 'ignore' });
        const entry = { avd, child, error: '', id: ++sequence, profileId };
        managed.set(serial, entry);
        child.once('error', () => { entry.error = '模擬器啟動失敗，請檢查硬體加速與系統映像。'; });
        child.once('exit', () => { if (managed.get(serial) === entry) { if (profileId) managed.delete(serial); else entry.error = '模擬器已結束，請移除此工作階段後重新啟動。'; } });
        started.push(serial);
      }
      return { started };
    } finally { launching = false; }
  }

  async function useDevice(serial, action, requireBoot = true) {
    if (recovering) throw new Error('正在重試手機連線，請稍後操作。');
    if (!/^emulator-\d+$/.test(serial)) throw new Error('無效的模擬器識別碼。');
    if (busy.has(serial)) throw new Error('裝置正在處理上一個操作。');
    busy.add(serial);
    try {
      const current = await inventory();
      const device = current.devices.find(d => d.serial === serial);
      if (!current.tools || !device || (requireBoot && !device.booted)) throw new Error('模擬器尚未就緒，請等待或重新整理。');
      return await action(current.tools, device);
    } finally { busy.delete(serial); }
  }

  async function stop(serial) {
    if (!managed.has(serial)) throw new Error('只能停止由 Archify 啟動的模擬器。');
    if (recovering || busy.has(serial) || api.appiumBusy?.(serial)) throw new Error('裝置正在處理操作，請結束工作後再關機。');
    busy.add(serial);
    const entry = managed.get(serial);
    try {
      const tools = await sdk();
      if (!tools) throw new Error('找不到 Android SDK，請由主機管理者檢查。');
      if (host) {
        const rows = (await host.list(tools.root)).filter(row => row.serial === serial);
        if (rows.some(row => row.avd !== entry.avd)) throw new Error('手機程序身分已變更，未送出關機指令。');
        if (!rows.length) {
          if (managed.get(serial) === entry) managed.delete(serial);
          return { stopped: serial };
        }
      }
      let forced = false;
      try {
        await execute(tools.adb, ['-s', serial, 'emu', 'kill'], false, 5000);
        const deadline = Date.now() + 12000;
        while (true) {
          const alive = host
            ? (await host.list(tools.root)).some(row => row.serial === serial)
            : parseDevices(await execute(tools.adb, ['devices', '-l'], false, 2000)).some(row => row.serial === serial) || entry.child?.exitCode === null;
          if (!alive) break;
          if (Date.now() >= deadline) throw new Error('正常關機逾時。');
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch {
        if (!host) throw new Error('正常關機失敗；此主機不支援獨立程序復原，請由管理者處理。');
        await host.stop(tools.root, serial, entry.avd);
        forced = true;
      }
      if (managed.get(serial) === entry) managed.delete(serial);
      return { stopped: serial, ...(forced ? { forced: true, warning: '已強制停止，未清除手機資料；尚未寫入的狀態可能遺失。' } : {}) };
    } finally { busy.delete(serial); }
  }

  async function screen(serial) {
    return useDevice(serial, (tools, device) => {
      if (device.state !== 'device') throw new Error('裝置尚未連線。');
      return execute(tools.adb, ['-s', serial, 'exec-out', 'screencap', '-p'], true);
    }, false);
  }

  async function inspect(serial) {
    return useDevice(serial, async tools => {
      await execute(tools.adb, ['-s', serial, 'shell', 'uiautomator', 'dump', '/sdcard/archify-window.xml']);
      const xml = await execute(tools.adb, ['-s', serial, 'exec-out', 'cat', '/sdcard/archify-window.xml']);
      if (!xml.includes('<hierarchy') || xml.length > 60000) throw new Error('無法取得有效畫面元素，請重新整理手機後重試。');
      return { xml, capturedAt: new Date().toISOString(), fingerprint: createHash('sha256').update(xml).digest('hex') };
    });
  }

  async function input(serial, body) {
    return useDevice(serial, async tools => {
      const keys = { back: '4', home: '3', recent: '187' };
      if (Object.hasOwn(keys, body.action)) {
        await execute(tools.adb, ['-s', serial, 'shell', 'input', 'keyevent', keys[body.action]]);
      } else if (['tapObserved','typeObserved','swipeObserved','backObserved'].includes(body.action)) {
        await execute(tools.adb, ['-s', serial, 'shell', 'uiautomator', 'dump', '/sdcard/archify-window.xml']);
        const xml = await execute(tools.adb, ['-s', serial, 'exec-out', 'cat', '/sdcard/archify-window.xml']);
        if (!xml.includes('<hierarchy') || createHash('sha256').update(xml).digest('hex') !== body.fingerprint) throw new Error('手機畫面已變更，未執行操作；請重新觀察。');
        if (body.action === 'backObserved') {
          await execute(tools.adb, ['-s', serial, 'shell', 'input', 'keyevent', '4']);
          return { accepted: true };
        }
        if (body.action === 'swipeObserved') {
          if (!['up','down','left','right'].includes(body.direction)) throw new Error('無效的滑動方向。');
          const size = await execute(tools.adb, ['-s', serial, 'shell', 'wm', 'size']);
          const dimensions = [...size.matchAll(/(?:Physical|Override) size:\s*(\d+)x(\d+)/g)].at(-1);
          if (!dimensions) throw new Error('無法確認手機畫面大小，未滑動。');
          const w=Number(dimensions[1]), h=Number(dimensions[2]);
          const points={up:[w*.5,h*.75,w*.5,h*.25],down:[w*.5,h*.25,w*.5,h*.75],left:[w*.75,h*.5,w*.25,h*.5],right:[w*.25,h*.5,w*.75,h*.5]}[body.direction].map(n=>String(Math.floor(n)));
          await execute(tools.adb, ['-s',serial,'shell','input','swipe',...points,'400']);
          return { accepted: true };
        }
        const attribute = { id: 'resource-id', text: 'text', description: 'content-desc' }[body.locator?.kind];
        if (!attribute || typeof body.locator?.value !== 'string' || !body.locator.value || body.locator.value.length > 500) throw new Error('無效的畫面目標。');
        const encoded = body.locator.value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll("'", '&apos;');
        const nodes = (xml.match(/<node\b[^>]*>/g) || []).filter(node => node.includes(` ${attribute}="${encoded}"`));
        if (nodes.length !== 1 || !/\benabled="true"/.test(nodes[0])) throw new Error('畫面目標不存在、不唯一或不可操作，未點擊。');
        if (body.action === 'typeObserved' && (!/\bclass="(?:android\.widget\.EditText|[^\"]*EditText)"/.test(nodes[0]) || /\bpassword="true"/.test(nodes[0]) || /password|passwd|otp|verification.?code|驗證碼|密碼/i.test(nodes[0].replace(/\bpassword="[^"]*"/g,'')) || !/^[a-zA-Z0-9 ._@-]{1,100}$/.test(body.text || ''))) throw new Error('欄位或內容不適合自動輸入，請手動處理。');
        const bounds = /\bbounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(nodes[0]);
        const size = await execute(tools.adb, ['-s', serial, 'shell', 'wm', 'size']);
        const dimensions = [...size.matchAll(/(?:Physical|Override) size:\s*(\d+)x(\d+)/g)].at(-1);
        if (!bounds || !dimensions) throw new Error('無法確認畫面目標位置，未點擊。');
        const [left, top, right, bottom] = bounds.slice(1).map(Number);
        if (left >= right || top >= bottom || right > Number(dimensions[1]) || bottom > Number(dimensions[2])) throw new Error('畫面目標位置無效，未點擊。');
        await execute(tools.adb, ['-s', serial, 'shell', 'input', 'tap', String(Math.floor((left + right) / 2)), String(Math.floor((top + bottom) / 2))]);
        if (body.action === 'typeObserved') await execute(tools.adb, ['-s', serial, 'shell', 'input', 'text', body.text.replaceAll(' ','%s')]);
      } else if (body.action === 'clearRecent') {
        const size = await execute(tools.adb, ['-s', serial, 'shell', 'wm', 'size']);
        const match = [...size.matchAll(/(?:Physical|Override) size:\s*(\d+)x(\d+)/g)].at(-1);
        if (!match) throw new Error('無法讀取手機畫面大小，請手動清除最近使用的應用程式。');
        const width = Number(match[1]), height = Number(match[2]);
        await execute(tools.adb, ['-s', serial, 'shell', 'input', 'keyevent', '187']);
        for (let attempt = 0; attempt < 4; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 400));
          await execute(tools.adb, ['-s', serial, 'shell', 'uiautomator', 'dump', '/sdcard/archify-recent.xml']);
          const xml = await execute(tools.adb, ['-s', serial, 'exec-out', 'cat', '/sdcard/archify-recent.xml']);
          if (!xml.includes('<hierarchy')) throw new Error('無法讀取最近使用畫面，請手動清除。');
          const node = (xml.match(/<node\b[^>]*>/g) || []).find(item => /(?:text|content-desc)="(?:Clear all|清除全部|全部清除|全部清理|清除所有)"/i.test(item));
          const bounds = node && /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node);
          if (bounds) {
            const [left, top, right, bottom] = bounds.slice(1).map(Number);
            if (left >= right || top >= bottom || right > width || bottom > height) throw new Error('無法確認清除按鈕的位置，請手動清除。');
            await execute(tools.adb, ['-s', serial, 'shell', 'input', 'tap', String(Math.floor((left + right) / 2)), String(Math.floor((top + bottom) / 2))]);
            return { accepted: true };
          }
          if (attempt < 3) await execute(tools.adb, ['-s', serial, 'shell', 'input', 'swipe', String(Math.floor(width * 0.2)), String(Math.floor(height * 0.5)), String(Math.floor(width * 0.8)), String(Math.floor(height * 0.5)), '300']);
        }
        throw new Error('找不到「全部清除」按鈕；可能沒有最近使用的應用程式，請在手機畫面確認。');
      } else if (body.action === 'tap' || body.action === 'swipe') {
        const size = await execute(tools.adb, ['-s', serial, 'shell', 'wm', 'size']);
        const match = [...size.matchAll(/(?:Physical|Override) size:\s*(\d+)x(\d+)/g)].at(-1);
        const points = body.action === 'tap' ? [[body.x, body.y]] : [[body.x, body.y], [body.endX, body.endY]];
        if (!match || points.some(([x, y]) => !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= Number(match[1]) || y >= Number(match[2]))) throw new Error('操作位置超出裝置畫面。');
        if (body.action === 'tap') await execute(tools.adb, ['-s', serial, 'shell', 'input', 'tap', String(body.x), String(body.y)]);
        else {
          if (!Number.isInteger(body.duration) || body.duration < 100 || body.duration > 2000) throw new Error('無效的滑動時間。');
          await execute(tools.adb, ['-s', serial, 'shell', 'input', 'swipe', String(body.x), String(body.y), String(body.endX), String(body.endY), String(body.duration)]);
        }
      } else throw new Error('不支援的裝置操作。');
      return { accepted: true };
    });
  }

  const api = { status, start, stop, screen, inspect, input, tools: sdk,
    async ensureAdb() {
      if (recovering || launching || busy.size) throw new Error('手機正在處理操作，請稍後重試連線。');
      recovering = true;
      try {
        const tools = await sdk();
        if (!tools) throw new Error('Android SDK 尚未就緒，請先檢查執行主機。');
        // Automatic recovery only starts the daemon. Never kill a shared server,
        // replay device actions, or reset emulator data in the background.
        await execute(tools.adb, ['start-server'], false, 8000);
        await execute(tools.adb, ['devices', '-l'], false, 8000);
      } finally { recovering = false; }
    },
    async retryAdb() {
      if (recovering || launching || busy.size) throw new Error('手機正在處理操作，請稍後重試連線。');
      recovering = true;
      try {
        const tools = await sdk();
        if (!tools) throw new Error('Android SDK 尚未就緒，請先檢查執行主機。');
        await execute(tools.adb, ['kill-server'], false, 8000);
        await execute(tools.adb, ['start-server'], false, 8000);
        await execute(tools.adb, ['devices', '-l'], false, 8000);
        return { restarted: true };
      } catch (error) {
        if (error.message.includes('SDK')) throw error;
        throw new Error('手機連線重試失敗。請在 Windows 主機檢查 ADB 權限；手機資料未清除。');
      } finally { recovering = false; }
    },
    async prepareProfile(id) { const tools = await sdk(); if (!tools) throw new Error('Android SDK 尚未就緒。'); return prepareProfile(tools, id, catalog, env); },
    async startProfile(id) { const row = (await catalog.list()).find(row => row.id === id); if (!row) throw new Error('固定手機尚未建立。'); return start(row.avd, 1, id); },
    close() { for (const entry of managed.values()) if (!entry.profileId) entry.child?.kill(); managed.clear(); },
  };
  return api;
}
