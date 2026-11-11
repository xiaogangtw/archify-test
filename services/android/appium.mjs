import {driverMessage} from './appium-error.mjs';
import { installedAppiumHelp } from './appium-knowledge.mjs';
import { appiumRequest, commandValue } from './appium-commands.mjs';
import { FLOW_LIMITS } from './flow-limits.mjs';
import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { flowSchema, flowStepName } from './flow-contract.mjs';
import { executeFlow } from './flow-engine.mjs';
import {createHash} from 'node:crypto';
import {replayLocator} from './agent-locator.mjs';
const runtime = fileURLToPath(new URL('../../.local/appium', import.meta.url));
const serverFile = fileURLToPath(new URL('../../.local/appium/node_modules/appium/index.js', import.meta.url));
const base = 'http://127.0.0.1:4723';
// Keep a bounded idle wait. Explicit element waits and result assertions remain
// responsible for readiness; never turn off synchronization completely.
const performanceCapabilities = { 'appium:disableWindowAnimation': true };
const performanceSettings = { waitForIdleTimeout: 1000 };
export function createAppium(bridge, options = {}) {
  const request = options.fetch || fetch;
  let child, launching;
  const active = new Set();
  const quarantined = new Set(), leases = new Map(), explorers = new Map();
  let closing = false;
  async function ready() { try { const r = await request(base + '/status', { signal: AbortSignal.timeout(2000) }); return r.ok && (await r.json()).value?.ready === true; } catch { return false; } }
  async function start() {
    if (await ready()) return;
    if (launching) return launching;
    launching = (async () => {
      try { await access(serverFile); } catch { throw new Error('尚未安裝 Appium，請執行 npm run android:appium:setup。'); }
      const tools = await bridge.tools(); if (!tools) throw new Error('Android SDK 尚未就緒。');
      child = spawn(process.execPath, [serverFile, '--address', '127.0.0.1', '--port', '4723', '--use-drivers', 'uiautomator2', '--log-level', 'error'], { cwd: runtime, windowsHide: true, env: { ...process.env, ANDROID_HOME: tools.root, ANDROID_SDK_ROOT: tools.root }, stdio: 'ignore' });
      let failed = false; child.on('error', () => { failed = true; }); child.on('exit', () => { failed = true; });
      const deadline = Date.now() + 30000;
      while (!failed && Date.now() < deadline) { if (await ready()) return; await new Promise(resolve => setTimeout(resolve, 500)); }
      child?.kill(); throw new Error('Appium 未能啟動，請檢查安裝與4723連接埠。');
    })().finally(() => { launching = undefined; });
    return launching;
  }
  async function call(path, body, method = body === undefined ? 'GET' : 'POST', timeout = 30000) {
    const response = await request(base + path, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(timeout) });
    const json = await response.json();
    if (!response.ok || json.value?.error) throw Object.assign(new Error('Appium 操作失敗：'+String(json.value?.error || response.status).slice(0,100)), { webdriver: json.value?.error, driverMessage: driverMessage(json.value?.message, body) });
    return json.value;
  }
  async function release(sessions, bindings) {
    let failed = false;
    for (const [role, session] of sessions) {
      const serial = bindings[role];
      try { await call(`/session/${encodeURIComponent(session)}`, undefined, 'DELETE', 10000); }
      catch (error) { if (error.webdriver !== 'invalid session id') { quarantined.add(serial); failed = true; } }
      finally { active.delete(serial); }
    }
    return !failed;
  }
  async function expireLease(id, expected) {
    if (leases.get(id) !== expected) return;
    leases.delete(id); clearTimeout(expected.timer);
    if (!await release(expected.sessions, expected.bindings)) console.error('Appium 工作階段清理未確認，請重啟 Appium 執行器。');
  }
  async function captureAfterTap(serial, payload) {
    const port=Number(serial.split('-')[1]);
    if (closing || !/^emulator-\d+$/.test(serial) || port<5554 || port>5584 || port%2 || active.has(serial) || quarantined.has(serial)) throw new Error('手機正在使用中，無法觀察提示。');
    active.add(serial);
    const sessions = new Map(), bindings = {device:serial};
    try {
      const inventory=await bridge.status();
      if (!inventory.devices.some(device=>device.serial===serial&&device.booted)) throw new Error('手機尚未就緒。');
      await start();
      const value=await call('/session',{capabilities:{alwaysMatch:{...performanceCapabilities,platformName:'Android','appium:automationName':'UiAutomator2','appium:udid':serial,'appium:noReset':true,'appium:fullReset':false,'appium:autoLaunch':false,'appium:shouldTerminateApp':false,'appium:newCommandTimeout':60,'appium:systemPort':8200+(Number(serial.split('-')[1])-5554)/2},firstMatch:[{}]}},'POST',90000);
      if (!value.sessionId) throw new Error('無法建立 Appium 工作階段。');
      sessions.set('device',value.sessionId);
      await call(`/session/${encodeURIComponent(value.sessionId)}/appium/settings`, { settings: performanceSettings });
      await bridge.input(serial,payload);
      let xml='';
      try { const source=await call(`/session/${encodeURIComponent(value.sessionId)}/source`); if(typeof source==='string'&&source.includes('<hierarchy')&&source.length<=60000)xml=source; } catch { /* The tap may have happened; never retry it. */ }
      return {accepted:true,xml};
    } finally { if(!await release(sessions,bindings)) console.error('Appium 工作階段清理未確認，請重啟執行器。'); active.delete(serial); }
  }
  async function closeExplorer(serial,key){
    const entry=explorers.get(serial);if(!entry||entry.key!==key)return;
    if(entry.inFlight)throw new Error('手機操作仍在進行，請等待結果。');
    clearTimeout(entry.timer);explorers.delete(serial);
    if(!await release(new Map([['device',entry.session]]),{device:serial}))throw new Error('Appium 工作階段清理未確認，請重新啟動執行器。');
  }
  async function explore(serial,key,tool){
    if(tool.kind==='appiumHelp')return installedAppiumHelp(tool.query);
    const port=Number(serial.split('-')[1]);let entry=explorers.get(serial);
    if(closing||!/^emulator-\d+$/.test(serial)||port<5554||port>5584||port%2||typeof key!=='string'||!key||quarantined.has(serial)||entry&&entry.key!==key||entry?.inFlight||active.has(serial)&&!entry)throw new Error('此手機正被其他工作使用。');
    active.add(serial);
    if(entry)clearTimeout(entry.timer);
    let dispatched=false,replayStep,commandResult;
    try{
      if(!entry){
        const inventory=await bridge.status();if(!inventory.devices.some(device=>device.serial===serial&&device.booted))throw new Error('手機尚未就緒。');
        await start();const value=await call('/session',{capabilities:{alwaysMatch:{...performanceCapabilities,platformName:'Android','appium:automationName':'UiAutomator2','appium:udid':serial,'appium:noReset':true,'appium:fullReset':false,'appium:autoLaunch':false,'appium:shouldTerminateApp':false,'appium:newCommandTimeout':900,'appium:systemPort':8200+(port-5554)/2},firstMatch:[{}]}},'POST',90000);
        if(!value.sessionId)throw new Error('無法建立探索工作階段。');
        entry={key,session:value.sessionId,inFlight:true};explorers.set(serial,entry);
        await call(`/session/${encodeURIComponent(entry.session)}/appium/settings`,{settings:{...performanceSettings,enableNotificationListener:true}});
      }
      entry.inFlight=true;const route=`/session/${encodeURIComponent(entry.session)}`;
      const source=async()=>{const xml=await call(route+'/source');if(typeof xml!=='string'||!xml.includes('<hierarchy'))throw new Error('手機畫面來源格式無效，尚未送出操作。');if(xml.length>1000000)throw new Error(`手機畫面來源過大（${xml.length} 字元，上限 1000000），尚未送出操作。`);return xml;};
      const screenshot=async(xml)=>{
        if(!tool.includeScreenshot||/password="true"|驗證碼|verification.?code|\botp\b|text="\d{4,8}"/i.test(xml))return undefined;
        try{const png=await call(route+'/screenshot');return typeof png==='string'&&png.length<=1500000&&Buffer.from(png,'base64').subarray(0,8).toString('hex')==='89504e470d0a1a0a'?png:undefined;}catch{return undefined;}
      };
      const xml=await source(),fingerprint=createHash('sha256').update(xml).digest('hex');
      const referenced=value=>{let ref=0;return value.replace(/<[A-Za-z_][\w:.$-]*\b[^>]*>/g,node=>node.replace(/\s*\/?>$/,end=>` agent-ref="e${++ref}"${end}`));};
      if(tool.kind==='observe'){const png=await screenshot(xml);return {xml:referenced(xml),fingerprint,png,imageFingerprint:png?createHash('sha256').update(png).digest('hex'):undefined,capturedAt:new Date().toISOString()};}
      if(tool.fingerprint!==fingerprint)throw new Error('手機畫面已變更；未執行操作，請重新觀察。');
      if(['tap','type','longPress','doubleTap'].includes(tool.kind)){
        const attribute={id:'resource-id',description:'content-desc',text:'text'}[tool.locator?.kind];
        const ref=tool.locator?.kind==='ref'&&/^e[1-9]\d{0,4}$/.test(tool.locator.value)?Number(tool.locator.value.slice(1)):undefined;
        if((!attribute&&!ref)||typeof tool.locator.value!=='string'||!tool.locator.value||tool.locator.value.length>500)throw new Error('定位器無效，未執行操作。');
        const encoded=tool.locator.value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll("'",'&apos;');
        const allNodes=xml.match(/<[A-Za-z_][\w:.$-]*\b[^>]*>/g)||[];
        const nodes=ref?(allNodes[ref-1]?[allNodes[ref-1]]:[]):allNodes.filter(node=>node.includes(` ${attribute}="${encoded}"`));
        if(nodes.length!==1||!/\benabled="true"/.test(nodes[0]))throw new Error('目標不存在、不唯一或未啟用；未執行操作。');
        if(tool.kind==='type'&&(!/\bclass="[^"]*EditText"/.test(nodes[0])||/\bpassword="true"/.test(nodes[0])||/password|passwd|verification.?code|驗證碼|密碼|\botp\b/i.test(nodes[0].replace(/\bpassword="[^"]*"/g,''))||typeof tool.text!=='string'||!tool.text||tool.text.length>1000||/[\u0000-\u001f]/.test(tool.text)))throw new Error('此欄位需要人工輸入，未執行操作。');
        const quote=value=>!value.includes("'")?`'${value}'`:!value.includes('"')?`"${value}"`:`concat(${value.split("'").map(part=>`'${part}'`).join(',"\'",')})`;
        const using={id:'id',description:'accessibility id',text:'xpath',ref:'xpath'}[tool.locator.kind];
        const value=ref?`(//*)[${ref}]`:tool.locator.kind==='text'?`//*[@text=${quote(tool.locator.value)}]`:tool.locator.value;
        const elements=await call(route+'/elements',{using,value});
        if(!Array.isArray(elements)||elements.length!==1)throw new Error('無法唯一辨識目標；未執行操作。');
        const id=elements[0]['element-6066-11e4-a52e-4f735466cecf']||elements[0].ELEMENT;if(!id)throw new Error('目標元素無效。');
        const element=`${route}/element/${encodeURIComponent(id)}`;
        if(!await call(element+'/enabled')||!await call(element+'/displayed'))throw new Error('目標尚未可操作。');
        replayStep={name:({tap:'點擊目標',type:'填寫資料',longPress:'長按目標',doubleTap:'連點目標'})[tool.kind],action:({tap:'click',type:'type',longPress:'longPress',doubleTap:'doubleClick'})[tool.kind],...replayLocator(xml,nodes[0],ref?ref-1:allNodes.indexOf(nodes[0])),...(tool.kind==='type'?{text:tool.text,clear:tool.clear!==false}:{}),...(tool.kind==='longPress'?{durationMs:tool.durationMs??800}:{})};
        if(tool.kind==='tap'){dispatched=true;await call(element+'/click',{});}
        else if(tool.kind==='longPress'||tool.kind==='doubleTap'){
          if(tool.kind==='longPress'&&(!Number.isInteger(tool.durationMs??800)||(tool.durationMs??800)<400||(tool.durationMs??800)>5000))throw new Error('長按時間無效，未執行操作。');
          dispatched=true;await call(route+'/execute/sync',{script:tool.kind==='longPress'?'mobile: longClickGesture':'mobile: doubleClickGesture',args:[{elementId:id,...(tool.kind==='longPress'?{duration:tool.durationMs??800}:{})}]});
        }
        else{
          const password=await call(element+'/attribute/password');if(password===true||password==='true')throw new Error('密碼欄位需人工處理。');
          dispatched=true;if(tool.clear!==false)await call(element+'/clear',{});
          await call(element+'/value',{text:tool.text,value:[...tool.text]});
        }
      }else if(tool.kind==='tapPoint'||tool.kind==='longPressPoint'){
        const image=await screenshot(xml);if(!image||tool.imageFingerprint!==createHash('sha256').update(image).digest('hex'))throw new Error('截圖已變更或無法取得；未執行座標操作，請重新觀察。');
        if(!Number.isFinite(tool.x)||!Number.isFinite(tool.y)||tool.x<0||tool.x>1||tool.y<0||tool.y>1)throw new Error('畫面座標無效，未執行操作。');
        if(tool.kind==='longPressPoint'&&(!Number.isInteger(tool.durationMs??800)||(tool.durationMs??800)<400||(tool.durationMs??800)>5000))throw new Error('長按時間無效，未執行操作。');
        const rect=await call(route+'/window/rect');if(!rect||!Number.isFinite(rect.width)||!Number.isFinite(rect.height)||rect.width<=0||rect.height<=0)throw new Error('無效的手機畫面尺寸。');
        replayStep={name:'依畫面位置'+(tool.kind==='tapPoint'?'點擊':'長按'),action:tool.kind,x:tool.x,y:tool.y,...(tool.kind==='longPressPoint'?{durationMs:tool.durationMs??800}:{})};
        dispatched=true;await call(route+'/execute/sync',{script:tool.kind==='tapPoint'?'mobile: clickGesture':'mobile: longClickGesture',args:[{x:Math.min(rect.width-1,Math.floor(rect.width*tool.x)),y:Math.min(rect.height-1,Math.floor(rect.height*tool.y)),...(tool.kind==='longPressPoint'?{duration:tool.durationMs??800}:{})}]});
      }else if(tool.kind==='activateApp'){
        if(typeof tool.appPackage!=='string'||!(/^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/).test(tool.appPackage)||tool.appPackage.length>200)throw new Error('應用程式套件無效，未執行操作。');
        replayStep={name:'開啟應用程式',action:'activateApp',appPackage:tool.appPackage};dispatched=true;await call(route+'/execute/sync',{script:'mobile: activateApp',args:[{appId:tool.appPackage}]});
      }else if(tool.kind==='back'){replayStep={name:'返回前一頁',action:'back'};dispatched=true;await call(route+'/back',{});}
      else if(['editorAction','mobileCommand','webdriverCommand'].includes(tool.kind)){
        const request=appiumRequest({...tool,action:tool.kind});
        replayStep={name:tool.kind==='editorAction'?'鍵盤動作':'Appium 指令',action:tool.kind,...Object.fromEntries(Object.entries(tool).filter(([key])=>['editorAction','command','method','path','params','resultPath'].includes(key)))};
        dispatched=true;const value=await call(route+request.path,request.body,request.method);
        if(tool.returnValue)commandResult=commandValue(value,tool.resultPath);
      }
      else if(tool.kind==='hideKeyboard'){replayStep={name:'隱藏鍵盤',action:'hideKeyboard'};dispatched=true;await call(route+'/appium/device/hide_keyboard',{});}
      else if(tool.kind==='swipe'){
        if(!['up','down','left','right'].includes(tool.direction))throw new Error('無效的滑動方向。');
        const percent=tool.percent??.25,area=tool.area??{left:.15,top:.25,width:.7,height:.5};
        if(!Number.isFinite(percent)||percent<.05||percent>1||!['left','top','width','height'].every(k=>Number.isFinite(area[k]))||area.left<0||area.top<0||area.width<=0||area.height<=0||area.left+area.width>1||area.top+area.height>1)throw Object.assign(new Error('無效的滑動幅度或範圍。'),{notDispatched:true});
        const rect=await call(route+'/window/rect');
        replayStep={name:'滑動手機',action:'swipe',direction:tool.direction,percent,area};
        dispatched=true;await call(route+'/execute/sync',{script:'mobile: swipeGesture',args:[{left:Math.floor(rect.width*area.left),top:Math.floor(rect.height*area.top),width:Math.max(1,Math.floor(rect.width*area.width)),height:Math.max(1,Math.floor(rect.height*area.height)),direction:tool.direction,percent}]});
      }else throw new Error('不支援的探索操作。');
      // Capture before model/network latency can hide a transient notification.
      let after='',observationError='';try{after=await source();}catch{observationError='操作已送出，但操作後畫面擷取失敗。';}
      if(['tap','longPress','doubleTap','tapPoint','longPressPoint'].includes(tool.kind)&&after&&!/android\.widget\.Toast/.test(after)){
        for(const delay of [150,300]){await (options.sleep||((ms)=>new Promise(resolve=>setTimeout(resolve,ms))))(delay);try{const sample=await source();if(/android\.widget\.Toast/.test(sample)){after=sample;break;}}catch{break;}}
      }
      const png=after?await screenshot(after):undefined;
      return {accepted:true,replayStep,commandResult,xml:after?referenced(after):'',fingerprint:after?createHash('sha256').update(after).digest('hex'):undefined,png,imageFingerprint:png?createHash('sha256').update(png).digest('hex'):undefined,observationError,capturedAt:new Date().toISOString()};
    }catch(error){
      let cleaned=true;
      if(entry){entry.inFlight=false;try{await closeExplorer(serial,key);}catch{cleaned=false;}}else active.delete(serial);
      if(!dispatched&&cleaned&&(entry||error.webdriver==='invalid session id'))error.notDispatched=true;
      throw error;
    }finally{
      if(entry&&explorers.get(serial)===entry){entry.inFlight=false;entry.timer=setTimeout(()=>{void closeExplorer(serial,key).catch(()=>{});},options.explorerTtlMs??750000);entry.timer.unref?.();}
    }
  }
  async function run(target, definition, onStep = async () => {}, dependencies = {}, batch = {}, executeApi) {
    const flow = flowSchema.parse(definition);
    if (Object.keys(dependencies).length > 20) throw new Error('共用流程版本過多。');
    dependencies = Object.fromEntries(Object.entries(dependencies).map(([key,value]) => [key,flowSchema.parse(value)]));
    const bindings = flow.actors ? target : { device: target };
    const roles = flow.actors || ['device'];
    if (!bindings || typeof bindings !== 'object' || Object.keys(bindings).length !== roles.length) throw new Error('請為每個角色指定手機。');
    const serials = roles.map(role => bindings[role]);
    if (batch.keep && (!batch.id || !/^[0-9a-f-]{36}$/i.test(batch.id) || typeof batch.owner !== 'string' || !batch.owner)) throw new Error('批次識別碼無效。');
    const leaseKey = batch.id && batch.owner ? JSON.stringify([batch.owner,batch.id]) : undefined;
    const lease = leaseKey ? leases.get(leaseKey) : undefined;
    if (closing || new Set(serials).size !== serials.length || serials.some(serial => typeof serial !== 'string' || !/^emulator-\d+$/.test(serial) || Number(serial.split('-')[1]) < 5554 || Number(serial.split('-')[1]) > 5584 || Number(serial.split('-')[1]) % 2 || quarantined.has(serial) || active.has(serial) && !lease?.serials.includes(serial))) throw new Error('裝置正在執行測試、重複或識別碼無效。');
    if (lease) { clearTimeout(lease.timer); leases.delete(leaseKey); }
    const compatible = lease && roles.length === lease.roles.length && roles.every(role => lease.bindings[role] === bindings[role]);
    serials.forEach(serial => active.add(serial));
    const sessions = compatible ? new Map(lease.sessions) : new Map();
    const started = performance.now();
    const timings = [];
    async function timed(phase, operation) {
      const before = performance.now();
      try { return await operation(); }
      finally { timings.push({ phase, ms: Math.round(performance.now() - before) }); }
    }
    const budget = Date.now() + FLOW_LIMITS.sessionSetupMs + FLOW_LIMITS.mainMs + FLOW_LIMITS.cleanupMs;
    const execute = (path, body, method, timeout = 30000) => { const remaining = budget - Date.now(); if (remaining <= 0) throw new Error('Appium 執行逾時。'); return timed(path === '/session' ? '建立工作階段' : path.split('/').slice(3).join('/'), () => call(path, body, method, Math.min(timeout, remaining))); };
    const steps = flow.steps.map(step => ({ name: flowStepName(step), status: 'pending' }));
    let result = { status: 'failed', steps, completed: 0, message: '尚未完成測試。' };
    try {
      if (lease && !compatible) {
        if (!await release(lease.sessions, lease.bindings)) throw new Error('Appium 工作階段清理未確認，請重新啟動執行器。');
        serials.forEach(serial => active.add(serial));
      }
      const inventory = await timed('裝置檢查', () => bridge.status());
      if (serials.some(serial => !inventory.devices.some(device => device.serial === serial && device.booted))) throw new Error('指定手機尚未就緒。');
      await timed('啟動 Appium', start);
      for (const role of roles) {
      const serial = bindings[role];
      let session = sessions.get(role);
      if (!session) {
        const value = await execute('/session', { capabilities: { alwaysMatch: { ...performanceCapabilities, platformName: 'Android', 'appium:automationName': 'UiAutomator2', 'appium:udid': serial, 'appium:noReset': true, 'appium:skipLogcatCapture': true, 'appium:fullReset': false, 'appium:autoLaunch': false, 'appium:shouldTerminateApp': false, 'appium:newCommandTimeout': 360, 'appium:systemPort': 8200 + (Number(serial.split('-')[1]) - 5554) / 2 }, firstMatch: [{}] } }, 'POST', 90000);
        session = value.sessionId;
        if (!session) throw new Error('Appium 沒有建立有效工作階段。');
        sessions.set(role, session);
        await execute(`/session/${encodeURIComponent(session)}/appium/settings`, { settings: performanceSettings });
      }
      const route = `/session/${encodeURIComponent(session)}`;
      await execute(route + '/execute/sync', { script: 'mobile: activateApp', args: [{ appId: flow.appPackage }] });
      if (options.onSession) await options.onSession({ role, serial, source: () => call(route + '/source') });
      }
      result = await executeFlow(flow, { execute, routeFor: role => `/session/${encodeURIComponent(sessions.get(role))}`, onStep, mainDeadline: Math.min(Date.now() + FLOW_LIMITS.mainMs, budget - FLOW_LIMITS.cleanupMs), dependencies, executeApi });
      return result;
    } catch (error) { result.message = error.driverMessage ? (error.message + '：' + error.driverMessage).slice(0,1000) : error.message.includes('Appium') ? error.message : '無法完成 Appium 工作階段。'; return result; }
    finally {
      if (!closing && result.status === 'passed' && batch.keep && sessions.size === roles.length) {
        const entry = { batchId: batch.id, sessions: new Map(sessions), bindings: {...bindings}, roles: [...roles], serials: [...serials] };
        entry.timer = setTimeout(() => { void expireLease(leaseKey, entry); }, options.leaseTtlMs ?? 30000);
        entry.timer.unref?.();
        leases.set(leaseKey, entry);
      } else {
        if (!await timed('清理工作階段', () => release(sessions, bindings))) { result.status = 'failed'; result.message = '測試工作階段清理未確認，請重新啟動 Appium 執行器。'; }
        serials.forEach(serial => active.delete(serial));
      }
      console.info('[Android 執行耗時] ' + JSON.stringify({ totalMs: Math.round(performance.now() - started), timings, stepTimings: (result.trace || []).map(({path,name,action,status,durationMs}) => ({path,name,action,status,durationMs})) }));
    }
  }
  return {
    start, run, captureAfterTap, explore, closeExplorer,
    exploreFor:serial=>explorers.get(serial)?.key,
    busy: serial => active.has(serial) || quarantined.has(serial),
    hasActive: () => active.size > 0 || quarantined.size > 0,
    cleanupFailed: serial => quarantined.has(serial),
    leaseFor: serial => [...leases.values()].find(lease => lease.serials.includes(serial))?.batchId,
    async close() { closing = true; await Promise.all([...leases.entries()].map(([id, lease]) => expireLease(id, lease))); await Promise.all([...explorers.entries()].filter(([,entry])=>!entry.inFlight).map(([serial,entry])=>closeExplorer(serial,entry.key).catch(()=>{}))); child?.kill(); },
  };
}
