import { FLOW_LIMITS } from '../../android/flow-limits.mjs';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parseFlow, flowStepName, requiresConditionalFlow, requiresAppiumCommands } from '../../android/flow-contract.mjs';
import {resolveFlowDependencies,dependencyKey} from '../../android/flow-dependencies.mjs';
import { memoryAndroidRuns, type AndroidRuns, type AndroidRun } from './androidRuns.ts';
export type ExecutionStore = { api?: () => any; runs: AndroidRuns; script: (id: string, version: number) => Promise<any> };
function fail(statusCode: number, message: string): never { throw Object.assign(new Error(message), { statusCode }); }
const traceSchema = z.array(z.object({ path: z.string().max(300), name: z.string().max(220), action: z.string().max(40), phase: z.enum(['before','main','after']), actor: z.enum(['sender','receiver']).optional(), status: z.enum(['running','passed','failed','skipped']), message: z.string().max(1500).optional(), durationMs: z.number().int().min(0).max(FLOW_LIMITS.mainMs + FLOW_LIMITS.cleanupMs).optional() }).strict()).max(10000);
export function registerAndroidExecution(app: FastifyInstance, state: { fresh: () => boolean; multiDevice?: () => boolean; conditionalFlows?: () => boolean; appiumCommands?: () => boolean; apiFlows?: () => boolean; batchSessionReuse?: () => boolean; session: () => string; owns: (serial: string, owner: string) => boolean; ready: (serial: string, batchId?: string) => boolean; enqueue: (action: string, owner: string, payload: unknown, serial: string) => Promise<any> }, store: ExecutionStore = { runs: memoryAndroidRuns(), script: async () => undefined }) {
  const running = new Map<string, string>();
  const apiRuns = new Map<string,any>();
  const apiTasks = new Map<string,{active:()=>boolean;execute:any}>();
  app.post('/internal/android/api-step/:id',async req=>{
    const {id}=z.object({id:z.uuid()}).parse(req.params);
    const body=z.object({session:z.uuid(),key:z.string().max(100000),path:z.string().max(300),inputs:z.record(z.string(),z.union([z.string().max(8000),z.number(),z.boolean()])).default({})}).strict().parse(req.body);
    const row=await store.runs.get(id);
    if(body.session!==state.session()||!state.fresh())fail(409,'API 執行工作階段已失效。');
    const task=apiTasks.get(id);
    if(!(task?.active())&&(!row||row.status!=='running'||running.get(row.serial)!==id||!apiRuns.has(id)))fail(409,'API 執行工作階段已失效。');
    try{return await (task?.execute||apiRuns.get(id))(body.key,body.path,body.inputs);}catch{return {passed:false,message:'API 執行失敗；請檢查參數、授權與連線。'};}
  });
  const ownerOf = (req: any) => String(req.headers['x-archify-user'] || 'local');
  async function reconcile(row: AndroidRun): Promise<AndroidRun> {
    if (['queued','running'].includes(row.status) && running.get(row.serial) !== row.id) { const interrupted: AndroidRun = { ...row, status: 'failed', message: '執行控制服務已重啟，結果未確認；不會自動重跑。', finishedAt: new Date().toISOString() }; await store.runs.put(interrupted); return interrupted; }
    return row;
  }
  app.get('/api/android/runs', async req => Promise.all((await store.runs.list(ownerOf(req))).map(reconcile)));
  app.post('/api/android/runs', async (req, reply) => {
    const raw = z.object({ executionOrigin:z.enum(['appium','e2e-batch']).default('appium'),batchId:z.string().uuid().optional(),batchContinue:z.boolean().optional(),batchName:z.string().trim().max(100).optional(),manualCommits:z.object({frontend:z.string().regex(/^[a-fA-F0-9]{40}$/).optional(),bff:z.string().regex(/^[a-fA-F0-9]{40}$/).optional(),backend:z.string().regex(/^[a-fA-F0-9]{40}$/).optional()}).strict().optional(),scriptId: z.string().min(1).max(100), scriptVersion: z.number().int().positive(), serial: z.string().regex(/^emulator-\d+$/).optional(), bindings: z.object({ sender: z.string().regex(/^emulator-\d+$/), receiver: z.string().regex(/^emulator-\d+$/) }).strict().optional(), requestId: z.string().uuid() }).strict().parse(req.body);
    if (raw.executionOrigin === 'e2e-batch' && !raw.batchId) fail(400, '批次執行必須指定批次。');
    if (raw.batchContinue && !raw.batchId) fail(400, '共用工作階段必須指定批次。');
    if ((!raw.serial && !raw.bindings) || (raw.serial && raw.bindings)) fail(400, '請選擇單手機或雙機角色配對。');
    const input = { ...raw, serial: raw.serial || raw.bindings!.sender };
    const serials = input.bindings ? Object.values(input.bindings) : [input.serial];
    if (input.bindings && !state.multiDevice?.()) fail(503, '請更新並重新啟動支援雙機的 Android 執行器。');
    if (new Set(serials).size !== serials.length) fail(400, '發送者與接收者必須使用不同手機。');
    const owner = ownerOf(req), existing = await store.runs.find(input.requestId);
    if (existing) { if (existing.deletedAt) fail(409, '此執行紀錄已刪除，請建立新的執行要求。'); if (existing.owner !== owner) fail(403, '無法存取此執行。'); if ((existing.executionOrigin||'appium')!==input.executionOrigin||existing.batchId!==input.batchId||existing.batchContinue!==input.batchContinue||existing.batchName!==input.batchName||JSON.stringify(existing.manualCommits||{})!==JSON.stringify(input.manualCommits||{})||existing.scriptId !== input.scriptId || existing.scriptVersion !== input.scriptVersion || existing.serial !== input.serial || existing.bindings?.sender !== input.bindings?.sender || existing.bindings?.receiver !== input.bindings?.receiver) fail(409, '執行要求編號已用於其他內容。'); return reply.code(202).send(existing); }
    if (!state.fresh()) fail(503, '手機或 Appium 執行器尚未就緒。');
    if (input.batchContinue && !state.batchSessionReuse?.()) fail(409, '目前執行器尚未確認支援批次共用工作階段。');
    if (serials.some(serial => !state.owns(serial, owner))) fail(403, '只能執行自己手機上的測試。');
    if (serials.some(serial => running.has(serial))) fail(409, '此手機已有測試執行中。');
    if (serials.some(serial => !state.ready(serial,input.batchId))) fail(503, '手機或 Appium 執行器尚未就緒。');
    // Reserve before asynchronous script lookup so concurrent requests cannot
    // both acquire the same device.
    const id = randomUUID(); serials.forEach(serial => running.set(serial, id));
    let row: AndroidRun, definition, dependencies: any;
    try {
      const script = await store.script(input.scriptId, input.scriptVersion);
      if (!script || script.caseType !== 'flow') fail(400, '請先儲存 Flow Case 版本。');
      try { definition = parseFlow(script.source); } catch (error: any) { fail(400, error.message); }
      if (requiresConditionalFlow(definition) && !state.conditionalFlows?.()) fail(409, '目前 Android 執行器尚未確認支援條件流程，請更新並重新啟動執行器。');
      if (!!definition.actors !== !!input.bindings) fail(400, definition.actors ? '此案例需要發送者與接收者兩台手機。' : '此案例為單手機流程。');
      try { dependencies = await resolveFlowDependencies(definition, store.script, dependencyKey(input.scriptId,input.scriptVersion)); }
      catch (error: any) { fail(400,error.message); }
      if ([definition,...Object.values(dependencies.definitions)].some(requiresAppiumCommands) && !state.appiumCommands?.()) fail(409,'Android 執行器尚未載入 Appium 指令支援，請更新並重新啟動執行器。');
      row = { ...input, id, testVersion: input.executionOrigin === 'e2e-batch' && input.batchId ? `ANDROID-BATCH-${input.batchId}` : `ANDROID-${id}`, deploymentVerified: false, owner, source: script.source, name: script.name, status: 'queued', completed: 0, steps: definition.steps.map((step: any) => ({ name: flowStepName(step), status: 'pending' })), message: '等待 Appium 執行器。', createdAt: new Date().toISOString() };
      if (dependencies.snapshots.length) row.dependencies = dependencies.snapshots;
      const api=store.api?.();
      if(api){
        const frozen=await api.prepare([definition,...Object.values(dependencies.definitions)]);
        if(Object.keys(frozen).length){
          if(!state.apiFlows?.())fail(409,'請更新並重新啟動支援 API 流程的 Android 執行器。');
          apiRuns.set(id,api.execution(frozen,definition.variables));
          row.apiSnapshots=Object.values(frozen);
        }
      }else if(JSON.stringify([definition,dependencies.definitions]).includes('"apiFlow"'))fail(409,'API 流程服務尚未就緒。');
      await store.runs.put(row);
    } catch (error) { apiRuns.delete(id); serials.forEach(serial => { if (running.get(serial) === id) running.delete(serial); }); throw error; }
    void state.enqueue('appiumRun', owner, { runId: id, definition, dependencies: dependencies.definitions, batchId:input.batchId, batchOwner:owner, batchContinue:input.batchContinue, ...(input.bindings ? { bindings: input.bindings } : {}) }, input.serial).then(async value => {
      const result = z.object({ status: z.enum(['passed','failed']), completed: z.number().int().min(0).max(row.steps.length), message: z.string().max(1000), steps: z.array(z.object({ name: z.string().max(220), status: z.enum(['pending','running','passed','failed']) })).length(row.steps.length), trace: traceSchema.optional() }).parse(value);
      if (result.steps.some((step, i) => step.name !== row.steps[i].name) || result.status === 'passed' && (result.completed !== row.steps.length || result.steps.some(step => step.status !== 'passed'))) throw new Error('無效的執行結果。');
      if (result.status === 'passed' && result.trace?.some(entry => entry.status === 'failed' || entry.status === 'running')) throw new Error('無效的分支執行結果。');
      await store.runs.put({ ...row, ...result, finishedAt: new Date().toISOString() });
    }).catch(async () => { await store.runs.put({ ...row, status: 'failed', message: '執行中斷或結果未確認；不會自動重跑。', finishedAt: new Date().toISOString() }); }).finally(() => { apiRuns.delete(id); serials.forEach(serial => { if (running.get(serial) === id) running.delete(serial); }); }).catch(() => app.log.error('Android execution record could not be saved'));
    return reply.code(202).send(row);
  });
  app.get('/api/android/runs/:id', async req => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const row = await store.runs.get(id); if (!row || row.deletedAt || row.owner !== ownerOf(req)) fail(404, '找不到此執行。');
    return reconcile(row);
  });
  app.delete('/api/android/runs/:id', async req => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const owner = ownerOf(req), row = await store.runs.get(id);
    if (!row || row.deletedAt || row.owner !== owner) fail(404, '找不到此執行。');
    if (['queued','running'].includes(row.status) || [...running.values()].includes(id)) fail(409, '排隊中或執行中的紀錄不能刪除。');
    if (!await store.runs.remove(id, owner)) fail(409, '紀錄狀態已變更，請重新整理。');
    return { deleted: true };
  });
  app.post('/internal/android/progress/:id', async req => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ session: z.string().uuid(), completed: z.number().int().min(0).max(FLOW_LIMITS.sectionSteps), steps: z.array(z.object({ name: z.string().max(220), status: z.enum(['pending','running','passed','failed']) })).max(FLOW_LIMITS.sectionSteps) }).parse(req.body);
    const row = await store.runs.get(id);
    if (body.session !== state.session() || !state.fresh() || !row || running.get(row.serial) !== id || row.status !== 'running') fail(409, '執行工作階段已失效。');
    if (body.steps.length !== row.steps.length || body.completed > row.steps.length || body.steps.some((step, i) => step.name !== row.steps[i].name)) fail(400, '無效進度。');
    await store.runs.put({ ...row, completed: body.completed, steps: body.steps, message: 'Appium 正在執行畫面檢查。' }); return { accepted: true };
  });
  return { async prepareApiTask(definitions:any[],initial:any,active:()=>boolean){
    const api=store.api?.();
    if(!api){if(JSON.stringify(definitions).includes('"apiFlow"'))fail(409,'API 流程服務尚未就緒。');return {id:undefined,dispose:()=>{}};}
    const frozen=await api.prepare(definitions);
    if(!Object.keys(frozen).length)return {id:undefined,dispose:()=>{}};
    if(!state.apiFlows?.())fail(409,'請更新並重新啟動支援 API 流程的 Android 執行器。');
    const id=randomUUID();apiTasks.set(id,{active,execute:api.execution(frozen,initial)});
    return {id,dispose:()=>{apiTasks.delete(id);}};
  }, busy: (serial: string) => running.has(serial), async claimed(id: string) { const row = await store.runs.get(id); if (row) await store.runs.put({ ...row, status: 'running', message: '正在建立 Appium 工作階段。' }); } };
}
