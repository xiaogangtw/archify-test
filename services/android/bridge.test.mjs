import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { createAndroidBridge, parseDevices } from './bridge.mjs';
import { createAndroidHealth } from './health.mjs';

test('first ADB failure retains installed SDK and AVD inventory for recovery', async () => {
  const bridge = createAndroidBridge({ env: { ANDROID_HOME: '/sdk' }, exists: async () => true,
    execute: async (_file, args) => {
      if (args[0] === '-list-avds') return 'Pixel\n';
      throw new Error('ADB unavailable');
    },
  });
  const status = await createAndroidHealth(bridge, { canRecover: () => false })();
  assert.equal(status.sdk.ready, true);
  assert.equal(status.sdk.path, '/sdk');
  assert.deepEqual(status.avds, ['Pixel']);
  assert.equal(status.adb.ready, false);
  assert.match(status.issues[0], /ADB/);
  await assert.rejects(bridge.start('Pixel', 1), /ADB/);
  bridge.close();
});

test('only emulator devices are listed; physical devices are excluded', () => {
  assert.deepEqual(parseDevices('List of devices attached\nphysical123 device\nemulator-5554 device product:sdk\nemulator-5556 offline\n'), [{ serial: 'emulator-5554', state: 'device' }, { serial: 'emulator-5556', state: 'offline' }]);
});
test('missing SDK is truthful and cannot launch', async () => {
  const bridge = createAndroidBridge({ exists: async () => false, fetch: async () => { throw new Error(); } });
  assert.equal((await bridge.status()).sdk.ready, false);
  await assert.rejects(bridge.start('Pixel', 2), /SDK/);
});

test('inventory probes have a bounded budget below the worker freshness window', async () => {
  const calls = [];
  const bridge = createAndroidBridge({ exists: async () => true,
    catalog: {list: async () => [{id: 'phone', avd: 'Pixel'}]},
    fetch: async () => { throw new Error('unavailable'); },
    execute: async (_file, args, _binary, timeout) => {
      calls.push({args, timeout});
      if (args[0] === '-list-avds') return 'Pixel';
      if (args[0] === 'devices') return 'emulator-5554 device';
      if (args.includes('getprop')) throw new Error('timed out');
      if (args.includes('emu')) return 'Pixel\nOK';
      return '';
    },
  });
  const status = await bridge.status();
  assert.equal(status.devices[0].booted, false);
  assert.equal(status.devices[0].profileId, 'phone');
  assert.equal(calls.length, 5);
  assert.ok(calls.every(call => call.timeout === 2000));
  bridge.close();
});
function fixture(accelerated = true, xml = '<hierarchy><node text="DemoAccount" /></hierarchy>', gpu) {
  const launched = [], calls = [];
  let devices = '';
  const bridge = createAndroidBridge({ env: { ANDROID_HOME: '/sdk', ARCHIFY_ANDROID_GPU: gpu }, exists: async () => true, portFree: async () => true, fetch: async () => { throw new Error(); },
    execute: async (file, args) => {
      calls.push(args);
      if (args[0] === '-list-avds') return 'Pixel\n';
      if (args[0] === '-accel-check') return accelerated ? 'accel:\n0\nWHPX usable' : 'accel:\n1\nnot usable';
      if (args[0] === 'devices') return devices;
      if (args.includes('getprop')) return '1';
      if (args.includes('check')) return 'Service activity: found\nService window: found';
      if (args.includes('cat')) return xml;
      if (args.includes('size')) return 'Physical size: 1080x1920';
      return '';
    }, launch: (file, args, options) => { const child = new EventEmitter(); child.kill = () => {}; launched.push({ file, args, options, child }); return child; },
  });
  return { bridge, launched, calls, setDevices: value => { devices = value; } };
}
test('parallel launch uses distinct ports, read-only AVDs, no shell and validates inputs', async () => {
  const f = fixture();
  assert.deepEqual(await f.bridge.start('Pixel', 2), { started: ['emulator-5554', 'emulator-5556'] });
  assert.equal(f.launched.length, 2);
  assert.equal(f.launched[0].options.windowsHide, true);
  assert.equal(f.launched[0].options.shell, undefined);
  assert.ok(f.launched.every(c => c.args.includes('-read-only') && c.args.includes('-no-window')));
  assert.ok(f.launched.every(c => c.args.includes('-no-snapshot-save')));
  assert.ok(f.launched.every(c => c.args[c.args.indexOf('-gpu') + 1] === 'host'));
  await assert.rejects(f.bridge.start('Pixel;calc', 1), /不存在/);
  await assert.rejects(f.bridge.start('Pixel', 5), /1 至 4/);
  f.setDevices('emulator-5554 device\nemulator-5556 device\nemulator-5558 device\n');
  await assert.rejects(f.bridge.start('Pixel', 2), /最多/);
  await f.bridge.input('emulator-5554', { action: 'tap', x: 100, y: 200 });
  await f.bridge.input('emulator-5554', { action: 'swipe', x: 900, y: 800, endX: 100, endY: 800, duration: 300 });
  assert.ok(f.calls.some(args => args.includes('swipe') && args.slice(-5).join(',') === '900,800,100,800,300'));
  await assert.rejects(f.bridge.input('emulator-5554', { action: 'swipe', x: 100, y: 200, endX: 1080, endY: 200, duration: 300 }), /超出/);
  await assert.rejects(f.bridge.input('emulator-5554', { action: 'swipe', x: 100, y: 200, endX: 200, endY: 200, duration: '300;calc' }), /滑動時間/);
  await assert.rejects(f.bridge.input('emulator-5554', { action: 'tap', x: 1080, y: 0 }), /超出/);
  await assert.rejects(f.bridge.input('emulator-5554', { action: 'shell', command: 'echo hi' }), /不支援/);
  await assert.rejects(f.bridge.stop('emulator-5558'), /只能停止/);
  f.bridge.close();
});
test('GPU compatibility modes are explicit and invalid values never launch a phone', async () => {
  for (const gpu of ['auto', 'software']) {
    const f = fixture(true, undefined, gpu);
    await f.bridge.start('Pixel', 1);
    assert.equal(f.launched[0].args[f.launched[0].args.indexOf('-gpu') + 1], gpu);
    f.bridge.close();
  }
  const invalid = fixture(true, undefined, 'host -wipe-data');
  await assert.rejects(invalid.bridge.start('Pixel', 1), /ARCHIFY_ANDROID_GPU/);
  assert.equal(invalid.launched.length, 0);
});

test('ADB retry uses fixed commands without needing a working inventory or touching phone data', async () => {
  const calls = [];
  let fail = true;
  const bridge = createAndroidBridge({ env: { ANDROID_HOME: '/sdk' }, exists: async () => true,
    execute: async (_file, args, _binary, timeout) => {
      calls.push({ args, timeout });
      if (fail && args[0] === 'kill-server') throw new Error('denied');
      return '';
    },
  });
  await assert.rejects(bridge.retryAdb(), /Windows.*ADB/);
  fail = false;
  assert.deepEqual(await bridge.retryAdb(), { restarted: true });
  assert.deepEqual(calls.slice(1).map(call => call.args), [['kill-server'], ['start-server'], ['devices', '-l']]);
  assert.ok(calls.every(call => call.timeout === 8000));
  bridge.close();
});

test('automatic ADB recovery only starts and verifies the daemon, serializing recovery', async () => {
  const calls = [];
  let release;
  const bridge = createAndroidBridge({ env: { ANDROID_HOME: '/sdk' }, exists: async () => true,
    execute: async (_file, args, _binary, timeout) => {
      calls.push({ args, timeout });
      if (args[0] === 'start-server') await new Promise(resolve => { release = resolve; });
      return '';
    },
  });
  const pending = bridge.ensureAdb();
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(bridge.ensureAdb(), /正在處理/);
  await assert.rejects(bridge.retryAdb(), /正在處理/);
  await assert.rejects(bridge.start('Pixel', 1), /正在重試/);
  release(); await pending;
  assert.deepEqual(calls.map(call => call.args), [['start-server'], ['devices', '-l']]);
  assert.ok(calls.every(call => call.timeout === 8000));
  bridge.close();
});

test('ADB retry rejects duplicate recovery while the first reset is pending', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const bridge = createAndroidBridge({ env: { ANDROID_HOME: '/sdk' }, exists: async () => true,
    execute: async (_file, args) => { if (args[0] === 'kill-server') await pending; return ''; },
  });
  const reset = bridge.retryAdb();
  await assert.rejects(bridge.retryAdb(), /正在處理/);
  await assert.rejects(bridge.start('Pixel', 1), /正在重試/);
  release(); await reset; bridge.close();
});

test('unavailable acceleration prevents launching a fake usable device', async () => {
  const f = fixture(false);
  await assert.rejects(f.bridge.start('Pixel', 1), /硬體加速/);
  assert.equal(f.launched.length, 0);
});

test('clear recent applications taps only the identified Android clear-all control', async () => {
  const f = fixture(true, '<hierarchy><node text="Clear all" bounds="[20,100][120,180]" /></hierarchy>');
  f.setDevices('emulator-5554 device');
  assert.deepEqual(await f.bridge.input('emulator-5554', { action: 'clearRecent' }), { accepted: true });
  assert.ok(f.calls.some(args => args.slice(-4).join(',') === 'input,tap,70,140'));
  assert.equal(f.calls.some(args => args.includes('force-stop') || args.includes('clear')), false);
  const missing = fixture(true, '<hierarchy><node text="Something else" bounds="[20,100][120,180]" /></hierarchy>');
  missing.setDevices('emulator-5554 device');
  await assert.rejects(missing.bridge.input('emulator-5554', { action: 'clearRecent' }), /找不到/);
  assert.equal(missing.calls.some(args => args.includes('tap')), false);
});

test('Inspection reads fresh UI hierarchy without tapping and rejects invalid dumps', async () => {
  const f=fixture();f.setDevices('emulator-5554 device');
  const result=await f.bridge.inspect('emulator-5554');
  assert.match(result.xml,/DemoAccount/);assert.ok(Number.isFinite(Date.parse(result.capturedAt)));
  const dump=f.calls.findIndex(args=>args.includes('uiautomator'));
  const read=f.calls.findIndex(args=>args.includes('cat'));
  assert.ok(dump>=0&&read>dump);assert.equal(f.calls.some(args=>args.includes('input')),false);
  const invalid=fixture(true,'old or invalid data');invalid.setDevices('emulator-5554 device');
  await assert.rejects(invalid.bridge.inspect('emulator-5554'),/有效畫面元素/);
  await assert.rejects(f.bridge.inspect('physical123'),/識別碼/);
  f.bridge.close();invalid.bridge.close();
});

test('observed tap requires the same hierarchy and exactly one enabled target', async () => {
  const xml='<hierarchy><node text="登入" enabled="true" bounds="[20,100][120,180]" /></hierarchy>';
  const f=fixture(true,xml);f.setDevices('emulator-5554 device');
  const fingerprint=createHash('sha256').update(xml).digest('hex');
  await f.bridge.input('emulator-5554',{action:'tapObserved',fingerprint,locator:{kind:'text',value:'登入'}});
  assert.ok(f.calls.some(args=>args.slice(-4).join(',')==='input,tap,70,140'));
  const before=f.calls.filter(args=>args.includes('tap')).length;
  await assert.rejects(f.bridge.input('emulator-5554',{action:'tapObserved',fingerprint:'0'.repeat(64),locator:{kind:'text',value:'登入'}}),/畫面已變更/);
  await assert.rejects(f.bridge.input('emulator-5554',{action:'tapObserved',fingerprint,locator:{kind:'text',value:'不存在'}}),/不唯一/);
  assert.equal(f.calls.filter(args=>args.includes('tap')).length,before);
  const duplicate=fixture(true,xml.replace('</hierarchy>','<node text="登入" enabled="true" bounds="[20,100][120,180]" /></hierarchy>'));duplicate.setDevices('emulator-5554 device');
  const snapshot=await duplicate.bridge.inspect('emulator-5554');
  await assert.rejects(duplicate.bridge.input('emulator-5554',{action:'tapObserved',fingerprint:snapshot.fingerprint,locator:{kind:'text',value:'登入'}}),/不唯一/);
  await f.bridge.input('emulator-5554',{action:'swipeObserved',fingerprint,direction:'up'});
  assert.ok(f.calls.some(args=>args.includes('swipe')&&args.slice(-5).join(',')==='540,1440,540,480,400'));
  await f.bridge.input('emulator-5554',{action:'backObserved',fingerprint});
  assert.ok(f.calls.some(args=>args.slice(-3).join(',')==='input,keyevent,4'));
});

test('observed text input accepts a single non-password editable field and rejects unsafe text',async()=>{
 const xml='<hierarchy><node resource-id="field" class="android.widget.EditText" enabled="true" password="false" bounds="[20,100][120,180]" /></hierarchy>';
 const f=fixture(true,xml);f.setDevices('emulator-5554 device');const fingerprint=createHash('sha256').update(xml).digest('hex');
 await f.bridge.input('emulator-5554',{action:'typeObserved',fingerprint,locator:{kind:'id',value:'field'},text:'Test 123'});
 assert.ok(f.calls.some(args=>args.slice(-3).join(',')==='input,text,Test%s123'));
 await assert.rejects(f.bridge.input('emulator-5554',{action:'typeObserved',fingerprint,locator:{kind:'id',value:'field'},text:'bad;cmd'}),/不適合/);
 const password=fixture(true,xml.replace('password="false"','password="true"'));password.setDevices('emulator-5554 device');const snap=await password.bridge.inspect('emulator-5554');
 await assert.rejects(password.bridge.input('emulator-5554',{action:'typeObserved',fingerprint:snap.fingerprint,locator:{kind:'id',value:'field'},text:'123'}),/不適合/);
});
