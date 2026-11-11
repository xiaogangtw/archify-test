import { FLOW_LIMITS } from '../../android/flow-limits.mjs';
import type { FastifyInstance } from 'fastify';
import {parseFlow,requiresAppiumCommands} from '../../android/flow-contract.mjs';
import {resolveFlowDependencies} from '../../android/flow-dependencies.mjs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { registerAndroidStream } from './androidStream.ts';
import { registerAndroidScrcpy } from './androidScrcpy.ts';
import { memoryAndroidProfiles, type AndroidProfiles } from './androidProfiles.ts';
import { registerAndroidExecution, type ExecutionStore } from './androidExecution.ts';

const deviceSchema = z.object({ serial: z.string().regex(/^emulator-\d+$/), state: z.string().max(30), booted: z.boolean(), managed: z.boolean(), avd: z.string().max(200), error: z.string().max(500), profileId: z.string().uuid().optional(), appiumBusy: z.boolean().optional(), appiumBatch: z.string().uuid().optional(), appiumTask:z.string().max(300).optional() });
const statusSchema = z.object({ adb: z.object({ ready: z.boolean(), canRetry: z.boolean(), error: z.string().max(500) }).optional(), sdk: z.object({ ready: z.boolean(), path: z.string().max(1000) }), avds: z.array(z.string().max(200)).max(100), devices: z.array(deviceSchema).max(32), issues: z.array(z.string().max(500)).max(20), appium: z.object({ reachable: z.boolean(), ready: z.boolean(), multiDevice: z.boolean().optional(), conditionalFlows: z.boolean().optional(), apiFlows:z.boolean().optional(), batchSessionReuse: z.boolean().optional(), exploreToast:z.boolean().optional(),agentTasks:z.boolean().optional(),agentProtocol:z.number().int().optional() }) });
function fail(statusCode: number, message: string): never { throw Object.assign(new Error(message), { statusCode }); }
type Command = { id: string; action: string; serial?: string; payload: unknown; owner: string; state: 'queued' | 'running'; timer: ReturnType<typeof setTimeout>; resolve: (value: any) => void; reject: (reason: Error) => void };

// Ephemeral device commands deliberately expire and are never retried automatically.
// They are not test executions and never create a passing test record.
export function registerAndroid(app: FastifyInstance, profiles: AndroidProfiles = memoryAndroidProfiles(), executionStore?: ExecutionStore) {
  const commands = new Map<string, Command>();
  const owners = new Map<string, string>();
  const agentDevices = new Map<string,string>();
  const reconnecting = new Map<string, { avd: string; until: number }>();
  let worker = '';
  let seen = 0;
  let status: z.infer<typeof statusSchema> | undefined;
  let awaitingStarted = new Set<string>();
  const fresh = () => !!worker && Date.now() - seen < 15000;
  const recovering = () => [...commands.values()].some(command => command.action === 'adbRetry');
  const streams = registerAndroidStream(app, { session: () => worker, fresh, available: serial => !!status?.devices.some(d => d.serial === serial && d.state === 'device') });
  const ownerOf = (req: { headers: Record<string, unknown> }) => String(req.headers['x-archify-user'] || 'local');
  const conditionalFlows = () => fresh() && status?.appium.conditionalFlows === true;
  const batchSessionReuse = () => fresh() && status?.appium.batchSessionReuse === true;
  const execution = registerAndroidExecution(app, { fresh, session: () => worker, multiDevice: () => status?.appium.multiDevice === true, conditionalFlows, appiumCommands:()=>fresh() && (status?.appium.agentProtocol??0)>=3, apiFlows:()=>fresh() && status?.appium.apiFlows===true, batchSessionReuse, owns: (serial, owner) => owners.get(serial) === owner, ready: (serial, batchId) => !agentDevices.has(serial) && !!status?.appium.ready && !!status.devices.some(device => device.serial === serial && device.booted && (!device.appiumBusy || !!batchId && batchSessionReuse() && device.appiumBatch === batchId)) && ![...commands.values()].some(command => command.serial === serial), enqueue }, executionStore);
  registerAndroidScrcpy(app, { session: () => worker, fresh, available: serial => !!status?.devices.some(d => d.serial === serial && d.state === 'device'), owns: (serial, user) => owners.get(serial) === user && !agentDevices.has(serial) && !execution.busy(serial) && !status?.devices.find(d => d.serial === serial)?.appiumBusy });
  function clear(reason: string) {
    for (const command of commands.values()) { clearTimeout(command.timer); command.reject(Object.assign(new Error(reason), { statusCode: 503 })); }
    commands.clear();
  }
  app.addHook('onClose', async () => clear('Android 控制服務已停止，操作結果未知，請重新整理裝置狀態。'));

  app.post('/internal/android/status', async req => {
    const body = z.object({ session: z.string().uuid(), status: statusSchema }).parse(req.body);
    if (worker && worker !== body.session && fresh()) fail(409, '已有另一個 Android 執行器連線。');
    if (worker !== body.session) { clear('Android 執行器已重新連線，上一個操作結果未知。'); owners.clear(); awaitingStarted.clear(); reconnecting.clear(); }
    worker = body.session; seen = Date.now(); status = body.status;
    const saved = await profiles.list();
    for (const device of status.devices) {
      const profile = saved.find(row => row.id === device.profileId && row.avd === device.avd);
      if (profile && device.managed) owners.set(device.serial, profile.owner);
    }
    for (const serial of awaitingStarted) {
      if (status.devices.some(device => device.serial === serial)) awaitingStarted.delete(serial);
    }
    for (const [serial, entry] of reconnecting) {
      const device = status.devices.find(device => device.serial === serial);
      if (device && (!device.managed || device.avd !== entry.avd)) { owners.delete(serial); reconnecting.delete(serial); }
      else if (!recovering() && (device || Date.now() > entry.until)) reconnecting.delete(serial);
    }
    // Remove ownership only after a subsequent inventory confirms disappearance.
    for (const serial of owners.keys()) {
      if (!status.devices.some(device => device.serial === serial) && !awaitingStarted.has(serial) && !reconnecting.has(serial)) owners.delete(serial);
    }
    return { accepted: true };
  });
  app.post('/internal/android/claim', async req => {
    const { session } = z.object({ session: z.string().uuid() }).parse(req.body);
    if (session !== worker || !fresh()) fail(409, '請先回報執行器狀態。');
    if ([...commands.values()].some(c => c.state === 'running')) return null;
    const command = [...commands.values()].find(c => c.state === 'queued');
    if (!command) { const serials = streams.targets(); return serials.length ? { action: 'stream', serials } : null; }
    command.state = 'running';
    if (command.action === 'appiumRun' && !(command.payload as any).agentTask) await execution.claimed((command.payload as { runId: string }).runId);
    return { id: command.id, action: command.action, serial: command.serial, payload: command.payload };
  });
  app.post<{ Params: { id: string } }>('/internal/android/result/:id', async req => {
    const body = z.object({ session: z.string().uuid(), result: z.unknown().optional(), error: z.string().max(500).optional(),notDispatched:z.boolean().optional() }).parse(req.body);
    if (body.session !== worker || !fresh()) fail(409, '執行器工作階段已失效。');
    const command = commands.get(req.params.id);
    if (!command || command.state !== 'running') fail(409, '操作已過期，請重新整理裝置狀態。');
    commands.delete(command.id); clearTimeout(command.timer);
    if (body.error) command.reject(Object.assign(new Error(body.error), { statusCode: 400,notDispatched:body.notDispatched===true }));
    else {
      if (command.action === 'prepareProfile') {
        const id = (command.payload as { id: string }).id;
        const profile = (await profiles.list()).find(row => row.id === id && row.owner === command.owner);
        const result = z.object({ profileId: z.literal(id), avd: z.literal(profile?.avd || '') }).safeParse(body.result);
        if (!profile || !result.success) { command.reject(Object.assign(new Error('手機建立結果不符。'), { statusCode: 502 })); return { accepted: false }; }
        try { await profiles.put({ ...profile, state: 'ready' }); }
        catch {
          command.reject(Object.assign(new Error('手機已準備，但紀錄未能保存；請重新整理後重試建立，不會清除手機資料。'), { statusCode: 503 }));
          return { accepted: false };
        }
      }
      if (command.action === 'start' || command.action === 'startProfile') {
        const result = z.object({ started: z.array(z.string().regex(/^emulator-\d+$/)).max(4) }).safeParse(body.result);
        if (!result.success) { command.reject(Object.assign(new Error('執行器傳回無效結果。'), { statusCode: 502 })); return { accepted: false }; }
        for (const serial of result.data.started) { owners.set(serial, command.owner); awaitingStarted.add(serial); }
      }
      if (command.action === 'stop' && command.serial) owners.delete(command.serial);
      command.resolve(body.result);
    }
    return { accepted: true };
  });

  async function enqueue(action: string, owner: string, payload: unknown = {}, serial?: string) {
    if (!fresh()) fail(503, 'Android 執行器未連線或狀態已過期。請在執行主機啟動 npm run android:worker。');
    if (recovering()) fail(409, '正在重試手機連線，請稍後操作。');
    if (serial && action !== 'screen' && owners.get(serial) !== owner) fail(403, '此裝置不屬於你的工作階段，無法操作或停止。');
    if (serial && action !== 'appiumRun' && execution.busy(serial)) fail(409, 'Appium 正在使用此手機，請等待測試完成。');
    const device = serial ? status?.devices.find(item => item.serial === serial) : undefined;
    const agentKey=(payload as {agentKey?:string}).agentKey;
    if(serial&&agentDevices.has(serial)&&agentDevices.get(serial)!==agentKey&&action!=='screen')fail(409,'Agent 正在操作此手機，請先暫停任務。');
    const releaseOwnedAgent=action==='agentDevice'&&(payload as any).tool?.kind==='close'&&!!agentKey&&agentDevices.get(serial!)===agentKey;
    const reuseAgent=action==='agentDevice'&&!!agentKey&&(device?.appiumTask===agentKey||releaseOwnedAgent);
    const reuseBatch = action === 'appiumRun' && batchSessionReuse() && device?.appiumBatch && device.appiumBatch === (payload as {batchId?:string}).batchId;
    if (serial && device?.appiumBusy && !reuseBatch && !reuseAgent) fail(409, '此手機仍在執行 Appium，請稍後重新整理。');
    if (serial && !status?.devices.some(d => d.serial === serial)) fail(409, '裝置已離線，請重新整理。');
    if (commands.size >= 16) fail(429, '操作佇列已滿，請稍後重試。');
    if (['start','startProfile','prepareProfile'].includes(action) && [...commands.values()].some(c => ['start','startProfile','prepareProfile'].includes(c.action))) fail(409, '已有手機準備或啟動作業，請稍後重試。');
    if (serial && [...commands.values()].some(c => c.serial === serial)) fail(409, '此裝置正在處理操作，請稍後重試。');
    return new Promise<any>((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => { commands.delete(id); reject(Object.assign(new Error('操作逾時，結果未知；請先重新整理裝置狀態，不會自動重試。'), { statusCode: 504 })); }, action === 'appiumRun' ? FLOW_LIMITS.sessionSetupMs + FLOW_LIMITS.mainMs + FLOW_LIMITS.cleanupMs + 60000 : ['observeTap','agentDevice'].includes(action) ? 150000 : action === 'stop' ? 45000 : action === 'adbRetry' ? 60000 : action === 'appiumRetry' ? 45000 : 30000);
      commands.set(id, { id, action, owner, payload, serial, state: 'queued', timer, resolve, reject });
    });
  }

  app.post('/api/android/adb/retry', async req => {
    z.object({}).strict().parse(req.body ?? {});
    if (!fresh()) fail(503, '執行主機未連線，請先在 Windows 主機啟動執行器。');
    if (!status?.adb?.canRetry) fail(409, '請更新並重啟執行器，才能從網頁重試連線。');
    const owner = ownerOf(req);
    if (commands.size || agentDevices.size || status.devices.some(device => device.appiumBusy || execution.busy(device.serial))) fail(409, '測試或手機操作尚未結束，請稍後重試連線。');
    if (status.devices.some(device => owners.get(device.serial) !== owner) || [...owners.values()].some(value => value !== owner)) fail(403, '重試會影響主機上的其他手機，請由執行主機管理者處理。');
    // Preserve ownership across a short ADB disconnect, but never transfer it
    // to an unrelated AVD that later reuses the same port.
    for (const device of status.devices) reconnecting.set(device.serial, { avd: device.avd, until: Date.now() + 60000 });
    return enqueue('adbRetry', owner);
  });
  app.post('/api/android/appium/retry', async req => {
    if ([...commands.values()].some(command => command.action === 'appiumRetry' || command.action === 'appiumRun') || status?.devices.some(device => device.appiumBusy)) fail(409, 'Appium 正在處理操作，請稍後重試。');
    return enqueue('appiumRetry', ownerOf(req));
  });
  app.get('/api/android/status', async req => ({
    capabilities: { adbRecovery: fresh() && status?.adb?.canRetry === true, persistentDevices: true, appiumRuns: true, multiDeviceRuns: fresh() && status?.appium.multiDevice === true, conditionalFlows: conditionalFlows(), batchSessionReuse: batchSessionReuse(), exploreToast:fresh() && status?.appium.exploreToast === true, agentTasks:fresh() && status?.appium.agentTasks === true },
    profiles: (await profiles.list()).filter(row => row.owner === ownerOf(req)).map(({ owner: _owner, ...row }) => ({ ...row, serial: fresh() ? status?.devices.find(device => device.profileId === row.id && device.avd === row.avd && device.managed)?.serial || null : null })),
    connected: fresh(), checkedAt: seen ? new Date(seen).toISOString() : null,
    ...(fresh() && status ? { ...status, devices: status.devices.map(({appiumBatch,appiumTask:_appiumTask, ...d}) => ({ ...d, ...(owners.get(d.serial) === ownerOf(req) && appiumBatch ? {appiumBatch} : {}), canControl: owners.get(d.serial) === ownerOf(req) && !agentDevices.has(d.serial) && !execution.busy(d.serial) && !d.appiumBusy })) } : { sdk: { ready: false, path: '' }, avds: [], devices: [], issues: ['Android 執行器尚未連線。'], appium: { reachable: false, ready: false } }),
    queued: commands.size,
  }));
  app.post('/api/android/authoring-context', async (req, reply) => {
    const { serial } = z.object({ serial: z.string().regex(/^emulator-\d+$/).optional() }).strict().parse(req.body);
    if (!fresh()) fail(503, 'Android 執行器未連線，無法讀取目前畫面。');
    const owner = ownerOf(req);
    const devices = status?.devices.filter(d => owners.get(d.serial) === owner && d.booted && d.state === 'device') || [];
    if (serial && !devices.some(d => d.serial === serial)) fail(403, '無法讀取此手機，請確認裝置歸屬及連線。');
    if (!serial && devices.length !== 1) fail(409, devices.length ? '有多台手機，請在需求中指定裝置序號。' : '沒有此帳號可讀取的手機，請先啟動手機。');
    const target = serial || devices[0].serial;
    const result = z.object({ xml: z.string().min(1).max(60000).refine(value => value.includes('<hierarchy')), capturedAt: z.string().datetime(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional() }).parse(await enqueue('inspect', owner, {}, target));
    return reply.header('Cache-Control', 'no-store').send({ serial: target, ...result });
  });
  app.post('/api/android/start', async req => {
    const body = z.object({ avd: z.string().regex(/^[A-Za-z0-9_.-]+$/).max(200), count: z.number().int().min(1).max(4) }).strict().parse(req.body);
    if (body.avd.startsWith('Archify_Device_')) fail(403, '固定手機必須從所屬帳號的手機清單啟動。');
    return enqueue('start', ownerOf(req), body);
  });
  app.post('/api/android/profiles', async req => {
    if (!fresh()) fail(503, '請先連接 Android 執行器。');
    const { name } = z.object({ name: z.string().trim().min(1).max(80) }).strict().parse(req.body);
    const owner = ownerOf(req), rows = await profiles.list();
    if (rows.filter(row => row.owner === owner).length >= 20) fail(409, '每個帳號最多保留20台固定手機。');
    if (rows.some(row => row.owner === owner && row.name === name)) fail(409, '已有同名手機，請選擇現有手機或使用不同名稱。');
    const id = randomUUID(), row = { id, name, owner, avd: `Archify_Device_${id.replaceAll('-','')}`, state: 'new' as const };
    await profiles.put(row);
    return enqueue('prepareProfile', owner, { id });
  });
  app.post('/api/android/profiles/:id/:action', async req => {
    const { id, action } = z.object({ id: z.string().uuid(), action: z.enum(['prepare','start']) }).parse(req.params);
    const owner = ownerOf(req), profile = (await profiles.list()).find(row => row.id === id && row.owner === owner);
    if (!profile) fail(404, '找不到此帳號的固定手機。');
    if (action === 'start' && profile.state !== 'ready') fail(409, '請先完成手機準備。');
    if (action === 'start' && status?.devices.some(device => device.profileId === id && device.avd === profile.avd)) fail(409, '手機已在執行，請選擇現有裝置。');
    return enqueue(action === 'start' ? 'startProfile' : 'prepareProfile', owner, { id });
  });
  app.post<{ Params: { serial: string } }>('/api/android/devices/:serial/stop', async req => enqueue('stop', ownerOf(req), {}, z.string().regex(/^emulator-\d+$/).parse(req.params.serial)));
  app.post<{ Params: { serial: string } }>('/api/android/devices/:serial/input', async req => {
    const coordinate = z.number().int().min(0).max(10000);
    const body = z.discriminatedUnion('action', [
      z.object({ action: z.enum(['home', 'back', 'recent', 'clearRecent']) }).strict(),
      z.object({ action: z.literal('tapObserved'), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), locator: z.object({kind:z.enum(['id','text','description']), value:z.string().min(1).max(500)}).strict() }).strict(),
      z.object({ action: z.literal('typeObserved'), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), locator: z.object({kind:z.enum(['id','text','description']), value:z.string().min(1).max(500)}).strict(),text:z.string().regex(/^[a-zA-Z0-9 ._@-]{1,100}$/) }).strict(),
      z.object({ action: z.literal('swipeObserved'), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), direction:z.enum(['up','down','left','right']) }).strict(),
      z.object({ action: z.literal('backObserved'), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
      z.object({ action: z.literal('tap'), x: coordinate, y: coordinate }).strict(),
      z.object({ action: z.literal('swipe'), x: coordinate, y: coordinate, endX: coordinate, endY: coordinate, duration: z.number().int().min(100).max(2000) }).strict(),
    ]).parse(req.body);
    return enqueue('input', ownerOf(req), body, z.string().regex(/^emulator-\d+$/).parse(req.params.serial));
  });
  app.post<{ Params: { serial: string } }>('/api/android/devices/:serial/observe-tap', async req => {
    if (!fresh() || !status?.appium.exploreToast) fail(503,'請更新並重新啟動 Android 執行器以擷取提示。');
    const body=z.object({fingerprint:z.string().regex(/^[a-f0-9]{64}$/),locator:z.object({kind:z.enum(['id','text','description']),value:z.string().min(1).max(500)}).strict()}).strict().parse(req.body);
    return enqueue('observeTap',ownerOf(req),{action:'tapObserved',...body},z.string().regex(/^emulator-\d+$/).parse(req.params.serial));
  });
  app.get<{ Params: { serial: string } }>('/api/android/devices/:serial/screen', async (req, reply) => {
    const serial = z.string().regex(/^emulator-\d+$/).parse(req.params.serial);
    const result = z.object({ png: z.string().max(2000000) }).parse(await enqueue('screen', ownerOf(req), {}, serial));
    const png = Buffer.from(result.png, 'base64');
    if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') fail(502, '裝置傳回無效畫面。');
    return reply.header('Cache-Control', 'no-store').type('image/png').send(png);
  });
  return { conditionalFlows,
    async agentDevice(serial:string,owner:string,taskId:string,tool:any){
      if(recovering())fail(409,'正在重試手機連線，請稍後操作。');
      if(['editorAction','mobileCommand','webdriverCommand','appiumHelp'].includes(tool.kind)&&(status?.appium.agentProtocol??0)<3)fail(503,'Android 執行器尚未載入 Appium 指令支援，請重新啟動執行器。');
      if(tool.kind!=='close'&&(status?.appium.agentProtocol??0)<2)fail(503,'Android 執行器尚未載入長按與畫面定位工具，請重新啟動 npm run dev。');
      if(!fresh()||!status?.appium.agentTasks)fail(503,'請更新並重新啟動支援 Agent 任務的 Android 執行器。');
      if(owners.get(serial)!==owner)fail(403,'只能操作自己啟動的手機。');
      const key=JSON.stringify([owner,taskId]);
      if(agentDevices.has(serial)&&agentDevices.get(serial)!==key)fail(409,'另一個 Agent 任務正在操作此手機。');
      agentDevices.set(serial,key);
      return enqueue('agentDevice',owner,{key,agentKey:key,tool},serial);
    },
    async releaseAgent(serial:string,owner:string,taskId:string){
      const key=JSON.stringify([owner,taskId]);if(agentDevices.get(serial)!==key)return;
      try{await enqueue('agentDevice',owner,{key,agentKey:key,tool:{kind:'close'}},serial);}finally{agentDevices.delete(serial);}
    },
    async verifyAgent(serial:string,owner:string,taskId:string,source:string,bindings?:{sender:string;receiver:string}){
      if(!fresh()||!status?.appium.agentTasks)fail(503,'請更新並重新啟動支援 Agent 任務的 Android 執行器。');
      const definition=parseFlow(source);if(definition.actors&&!bindings)fail(400,'請先配對發送者與接收者手機。');
      if(definition.actors){if(!status?.appium.multiDevice)fail(503,'請更新支援雙機的 Android 執行器。');for(const target of Object.values(bindings!)){if(owners.get(target)!==owner)fail(403,'只能操作自己啟動的手機。');if(!status?.devices.some(d=>d.serial===target&&d.booted))fail(409,'雙機必須都已就緒。');if(execution.busy(target)||agentDevices.has(target)||status?.devices.some(d=>d.serial===target&&d.appiumBusy)||[...commands.values()].some(c=>c.serial===target))fail(409,'手機正在處理操作，請稍後驗證。');}if(bindings!.sender===bindings!.receiver)fail(400,'雙機必須使用不同手機。');}
      if(!executionStore)fail(503,'案例版本服務尚未就緒。');
      const dependencies=await resolveFlowDependencies(definition,executionStore.script);
      if([definition,...Object.values(dependencies.definitions)].some(requiresAppiumCommands)&&(status?.appium.agentProtocol??0)<3)fail(503,'Android 執行器尚未載入 Appium 指令支援，請更新並重新啟動執行器。');
      const targets=definition.actors?Object.values(bindings!):[serial],key=JSON.stringify([owner,taskId]);
      for(const target of targets){if(owners.get(target)!==owner)fail(403,'只能操作自己啟動的手機。');if(agentDevices.has(target)||execution.busy(target)||[...commands.values()].some(c=>c.serial===target))fail(409,'手機正在處理操作，請稍後驗證。');}
      for(const target of targets)agentDevices.set(target,key);
      let result:unknown;let apiRun:{id?:string;dispose:()=>void}|undefined;
      try{apiRun=await execution.prepareApiTask([definition,...Object.values(dependencies.definitions)],definition.variables,()=>targets.every(target=>agentDevices.get(target)===key));result=await enqueue('appiumRun',owner,{runId:apiRun.id,definition,dependencies:dependencies.definitions,agentTask:true,agentKey:key,...(definition.actors?{bindings}:{})},definition.actors?bindings!.sender:serial);}
      finally{apiRun?.dispose();for(const target of targets)if(agentDevices.get(target)===key)agentDevices.delete(target);}
      const value=z.object({status:z.enum(['passed','failed']),message:z.string().max(1000),completed:z.number().int().min(0).max(definition.steps.length),steps:z.array(z.object({name:z.string(),status:z.enum(['pending','running','passed','failed'])})).length(definition.steps.length),trace:z.array(z.object({status:z.enum(['running','passed','failed','skipped'])}).passthrough()).optional()}).parse(result);
      if(value.steps.some((step,i)=>step.name!==definition.steps[i].name)||value.status==='passed'&&(value.completed!==definition.steps.length||value.steps.some(step=>step.status!=='passed')||value.trace?.some(item=>item.status==='running'||item.status==='failed')))fail(502,'執行器回傳無效驗證結果，不能視為通過。');
      return {status:value.status,message:value.message,details:{failedSteps:value.steps.filter(step=>step.status==='failed'),failedTrace:value.trace?.filter(item=>item.status==='failed').slice(-8)}};
    },
  };
}
