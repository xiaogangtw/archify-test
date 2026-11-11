import { appiumRequest, commandValue } from './appium-commands.mjs';
import { FLOW_LIMITS } from './flow-limits.mjs';
import { randomUUID } from 'node:crypto';
import { flowStepName } from './flow-contract.mjs';
import {dependencyKey} from './flow-dependencies.mjs';

// Only this interpreter issues device commands. Drafts remain data, never JavaScript.
export async function executeFlow(flow, { execute: command, routeFor, onStep = async () => {}, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), mainDeadline = now() + FLOW_LIMITS.mainMs, dependencies = {}, executeApi = /** @type {any} */ (undefined) }) {
  const variables = Object.assign(Object.create(null), flow.variables || {}, { runId: randomUUID(), timestamp: String(now()) });
  const steps = flow.steps.map(step => ({ name: flowStepName(step), status: 'pending' }));
  const trace = [], asserted = new Set();
  const assertionCounts = new Map();
  let currentFlow = flow;
  let actions = 0, cleanupActions = 0, cleaning = false;
  let cleanupDeadline = Infinity;
  const started = now();
  const result = { status: 'failed', completed: 0, steps, trace, message: '尚未完成測試。' };
  const fail = message => { throw new Error(message); };
  const execute = (...args) => {
    if (now() >= (cleaning ? cleanupDeadline : mainDeadline)) fail('流程超過執行步數或時間上限。');
    return command(...args);
  };
  function interpolate(value) {
    if (typeof value !== 'string') return value;
    const resolved = value.replace(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g, (_, name) => {
      if (!Object.hasOwn(variables, name)) fail('未定義的變數：' + name);
      return String(variables[name]);
    });
    if (resolved.length > 8000) fail('變數展開後內容過長。');
    return resolved;
  }
  const roleFor = (step, inherited) => step.actor || inherited || 'device';
  const route = role => routeFor(role);
  async function elements(spec, role) {
    const values = await execute(route(role) + '/elements', { using: spec.using, value: interpolate(spec.value) });
    if (!Array.isArray(values)) fail('Appium 元件回應無效。');
    return values;
  }
  async function element(spec, role) {
    const values = await elements(spec, role);
    if (values.length > 1) fail('定位器符合多個元件，請縮小定位範圍。');
    return values[0]?.['element-6066-11e4-a52e-4f735466cecf'];
  }
  const pathFor = (role, id) => route(role) + '/element/' + encodeURIComponent(id);
  async function evaluate(condition, role) {
    if (now() >= (cleaning ? cleanupDeadline : mainDeadline)) fail('流程超過執行步數或時間上限。');
    role = condition.actor || role;
    if (condition.kind === 'any' || condition.kind === 'all') {
      for (const child of condition.conditions) {
        const matched = await evaluate(child, role);
        if (condition.kind === 'any' && matched) return true;
        if (condition.kind === 'all' && !matched) return false;
      }
      return condition.kind === 'all';
    }
    if (condition.kind === 'variable') {
      if (!Object.hasOwn(variables, condition.variable)) fail('未定義的變數：' + condition.variable);
      return variables[condition.variable] === interpolate(condition.equals);
    }
    if (condition.kind === 'foreground') return await execute(route(role) + '/appium/device/current_package') === currentFlow.appPackage;
    try {
      if (condition.kind === 'count') return (await elements(condition, role)).length === condition.count;
      const id = await element(condition, role);
      if (!id) return condition.kind === 'absent';
      const path = pathFor(role, id);
      const visible = await execute(path + '/displayed') === true;
      if (condition.kind === 'absent') return !visible;
      if (condition.kind === 'visible') return visible;
      if (!visible) return false;
      if (condition.kind === 'text') {
        const text = await execute(path + '/text'), expected = String(interpolate(condition.text));
        return typeof text === 'string' && (condition.match === 'contains' ? text.includes(expected) : text === expected);
      }
      if (condition.kind === 'checked') {
        const checked = await execute(path + '/attribute/checked');
        if (![true,false,'true','false'].includes(checked)) fail('元件勾選狀態無效。');
        return (checked === true || checked === 'true') === (condition.expected ?? true);
      }
      if (condition.kind === 'enabled' || condition.kind === 'selected') {
        const actual = await execute(path + '/' + condition.kind);
        if (typeof actual !== 'boolean') fail('元件狀態回應無效。');
        return actual === (condition.expected ?? true);
      }
      fail('不支援的條件。');
    } catch (error) {
      if (error.webdriver === 'no such element') return condition.kind === 'absent' || condition.kind === 'count' && condition.count === 0;
      if (error.webdriver === 'stale element reference') return false;
      throw error;
    }
  }
  async function waitFor(condition, role, timeoutMs) {
    const deadline = now() + timeoutMs;
    do {
      if (await evaluate(condition, role)) return true;
      if (now() >= deadline) return false;
      await sleep(Math.min(200, Math.max(1, deadline - now())));
    } while (true);
  }
  async function swipe(step, role) {
    const rect = await execute(route(role) + '/window/rect');
    if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width < 10 || rect.height < 10) fail('無效的手機畫面尺寸。');
    const area = step.area || { left: 0.1, top: 0.15, width: 0.8, height: 0.7 };
    await execute(route(role) + '/execute/sync', { script: 'mobile: swipeGesture', args: [{ left: Math.floor(area.left * rect.width), top: Math.floor(area.top * rect.height), width: Math.max(1, Math.floor(area.width * rect.width)), height: Math.max(1, Math.floor(area.height * rect.height)), direction: step.direction, percent: step.percent ?? 0.7 }] });
  }
  async function runList(list, prefix, inherited, phase) {
    for (let i = 0; i < list.length; i++) await runStep(list[i], `${prefix}.${i + 1}`, inherited, phase);
  }
  async function runStep(step, path, inherited, phase) {
    if ((cleaning ? ++cleanupActions > FLOW_LIMITS.cleanupActions : ++actions > FLOW_LIMITS.mainActions) || now() >= (cleaning ? cleanupDeadline : Math.min(mainDeadline, started + FLOW_LIMITS.mainMs))) fail('流程超過執行步數或時間上限。');
    const role = step.action === 'apiFlow' ? 'device' : roleFor(step, inherited);
    const entry = { path: path.slice(0,300), name: flowStepName(step), action: step.action, phase, status: 'running', ...(role !== 'device' ? { actor: role } : {}) };
    trace.push(entry);
    const before = now(), timeoutMs = step.timeoutMs ?? 10000;
    try {
      if (step.action === 'apiFlow') {
        if (!executeApi) fail('API 執行能力尚未就緒。');
        const inputs=Object.fromEntries(Object.entries(step.inputs||{}).flatMap(([key,value])=> typeof value==='string' && /\{\{/.test(value) && [...value.matchAll(/\{\{([A-Za-z][A-Za-z0-9_]*)\}\}/g)].every(match=>Object.hasOwn(variables,match[1])) ? [[key,interpolate(value)]] : []));
        const outcome=await executeApi(step,path,inputs);
        if (!outcome?.passed) fail(/^API /.test(outcome?.message||'')?outcome.message:'API 回應未符合預期。');
        entry.message='API 請求與設定的斷言通過。';
      } else if (step.action === 'if' || step.action === 'optional') {
        const matched = await waitFor(step.condition, role, step.timeoutMs ?? 0);
        entry.message = matched ? '條件成立' : '條件不成立';
        if (step.action === 'optional' && !matched) entry.status = 'skipped';
        else await runList(matched ? (step.then || step.steps) : (step.else || []), path + (matched ? '.then' : '.else'), role, phase);
      } else if (step.action === 'repeat') {
        for (let i = 0; i < step.times; i++) await runList(step.steps, `${path}.repeat${i + 1}`, role, phase);
        entry.message = `已重複 ${step.times} 次`;
      } else if (step.action === 'while') {
        let iteration = 0;
        while (await waitFor(step.condition, role, step.timeoutMs ?? 0)) {
          if (iteration === step.maxIterations) fail('已達迴圈上限，條件仍成立。');
          await runList(step.steps, `${path}.while${++iteration}`, role, phase);
        }
        entry.message = `執行 ${iteration} 次，條件已不成立`;
      } else if (step.action === 'call') await runList(currentFlow.routines[step.routine], path + '.call', role, phase);
      else if (step.action === 'callFlow') {
        const key = dependencyKey(step.scriptId,step.scriptVersion);
        if (!Object.hasOwn(dependencies,key)) fail('找不到指定版本的共用 Flow Case。');
        const child = dependencies[key], parent = currentFlow;
        const requiredRoles = child.actors || [role];
        const countsBefore = new Map(requiredRoles.map(target => [target,assertionCounts.get(target) || 0]));
        currentFlow = child;
        for (const [name,value] of Object.entries(child.variables || {})) if (!Object.hasOwn(variables,name)) variables[name] = value;
        let failure, childReady=child.appPackage===parent.appPackage;
        const switchedRoles=[];
        try {
          if(child.appPackage!==parent.appPackage)for(const target of requiredRoles){
            switchedRoles.push(target);
            await runStep({name:'切換至共用流程 App',action:'activateApp',appPackage:child.appPackage,actor:target==='device'?undefined:target},`${path}.enter.${target}`,target,'before');
            await runStep({name:'確認共用流程 App 位於前景',action:'assertAppForeground'},`${path}.enterCheck.${target}`,target,'before');
          }
          childReady=true;
          await runList(child.before || [],path + '.before',child.actors ? undefined : role,'before');
          await runList(child.steps,path + '.flow',child.actors ? undefined : role,phase);
          if (phase === 'main' && requiredRoles.some(target => (assertionCounts.get(target) || 0) === countsBefore.get(target))) fail('共用流程實際路徑未完成必要斷言。');
        } catch (error) { failure = error; }
        finally {
          for (let i=0;childReady&&i<(child.after || []).length;i++) {
            try { await runStep(child.after[i],`${path}.after.${i+1}`,child.actors ? undefined : role,'after'); }
            catch (error) { failure ||= error; }
          }
          for(const target of switchedRoles){
            try{
              await runStep({name:'返回原案例 App',action:'activateApp',appPackage:parent.appPackage,actor:target==='device'?undefined:target},`${path}.restore.${target}`,target,'after');
              currentFlow=parent;
              await runStep({name:'確認原案例 App 位於前景',action:'assertAppForeground'},`${path}.restoreCheck.${target}`,target,'after');
            }
            catch(error){failure ||= error;}
          }
          currentFlow = parent;
        }
        if (failure) throw failure;
      }
      else if (step.action === 'set') variables[step.variable] = interpolate(step.value);
      else if (step.action === 'generate') variables[step.variable] = String(interpolate(step.prefix || '')) + randomUUID();
      else if (['editorAction','mobileCommand','webdriverCommand'].includes(step.action)) {
        const resolve = value => typeof value === 'string' ? interpolate(value) : Array.isArray(value) ? value.map(resolve) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key,child])=>[key,resolve(child)])) : value;
        const request = appiumRequest({...step,...(step.path?{path:interpolate(step.path)}:{}),...(Object.hasOwn(step,'params')?{params:resolve(step.params)}:{})});
        const value = await execute(route(role)+request.path,request.body,request.method);
        if(step.variable) variables[step.variable]=commandValue(value,step.resultPath);
      }
      else if (step.action === 'activateApp') await execute(route(role)+'/execute/sync',{script:'mobile: activateApp',args:[{appId:step.appPackage}]});
      else if (step.action === 'back') await execute(route(role) + '/back', {});
      else if (step.action === 'hideKeyboard') {
        const shown = await execute(route(role) + '/execute/sync', { script: 'mobile: isKeyboardShown', args: [] });
        if (shown === true) await execute(route(role) + '/execute/sync', { script: 'mobile: hideKeyboard', args: [] });
      } else if (step.action === 'tapPoint' || step.action === 'longPressPoint') {
        const rect=await execute(route(role)+'/window/rect');
        if(!rect||!Number.isFinite(rect.width)||!Number.isFinite(rect.height)||rect.width<=0||rect.height<=0)fail('無效的手機畫面尺寸。');
        await execute(route(role)+'/execute/sync',{script:step.action==='tapPoint'?'mobile: clickGesture':'mobile: longClickGesture',args:[{x:Math.min(rect.width-1,Math.floor(step.x*rect.width)),y:Math.min(rect.height-1,Math.floor(step.y*rect.height)),...(step.action==='longPressPoint'?{duration:step.durationMs??800}:{})}]});
      } else if (step.action === 'swipe') await swipe(step, role);
      else if (step.action === 'scrollUntilVisible') {
        let found = false;
        // Bound the whole search rather than resetting its budget after each swipe.
        const searchDeadline = Math.min(cleaning ? cleanupDeadline : mainDeadline, now() + (step.timeoutMs ?? 10000));
        for (let count = 0; count <= (step.maxSwipes ?? 5); count++) {
          found = await waitFor({ ...step, kind: 'visible' }, role, Math.min(1000, Math.max(0, searchDeadline - now())));
          if (!found && now() >= searchDeadline) fail('已達滑動搜尋時間上限，仍找不到可見元件。');
          if (found || count === (step.maxSwipes ?? 5)) break;
          await swipe(step, role);
        }
        if (!found) fail('已達滑動上限，仍找不到可見元件。');
      } else if (step.action === 'waitFor' || step.action === 'assert' || step.action.startsWith('assert')) {
        const kinds = { assertVisible: 'visible', assertAbsent: 'absent', assertText: 'text', assertCount: 'count', assertEnabled: 'enabled', assertSelected: 'selected', assertChecked: 'checked', assertAppForeground: 'foreground' };
        const condition = step.condition || { ...step, kind: kinds[step.action] };
        if (!await waitFor(condition, role, timeoutMs)) {
          const reasons = { assertAppForeground: '應用程式不在前景。', assertText: '畫面文字不符合預期。', assertVisible: '元件不可見。', assertAbsent: '元件仍可見。', assertCount: '元件數量不符合預期。', assertEnabled: '元件操作狀態不符合預期。', assertSelected: '元件選取狀態不符合預期。', assertChecked: '元件勾選狀態不符合預期。' };
          fail(reasons[step.action] || (step.action === 'waitFor' ? '等待條件逾時。' : '檢查條件不成立。'));
        }
        // Setup/cleanup checks never satisfy the main case's assertion requirement.
        if (phase === 'main' && step.action.startsWith('assert')) {
          const target = condition.actor || role;
          asserted.add(target); assertionCounts.set(target,(assertionCounts.get(target) || 0) + 1);
        }
      } else {
        if (!await waitFor({ ...step, kind: 'visible' }, role, timeoutMs)) fail('找不到元件。');
        if (['click','type','longPress','doubleClick'].includes(step.action)) {
          if (!await waitFor({ ...step, kind: 'enabled' }, role, timeoutMs)) fail('元件尚不可操作。');
        }
        const id = await element(step, role);
        if (!id) fail('找不到元件。');
        const path = pathFor(role, id);
        if (step.action === 'click') await execute(path + '/click', {});
        else if (step.action === 'longPress' || step.action === 'doubleClick') await execute(route(role)+'/execute/sync',{script:step.action==='longPress'?'mobile: longClickGesture':'mobile: doubleClickGesture',args:[{elementId:id,...(step.action==='longPress'?{duration:step.durationMs??800}:{})}]});
        else if (step.action === 'type') {
          const text = String(interpolate(step.text));
          if (step.clear) await execute(path + '/clear', {});
          // Mutating commands are sent once. Only read-only state checks are polled.
          await execute(path + '/value', { text });
        } else if (step.action === 'readText') {
          const text = await execute(path + '/text');
          if (typeof text !== 'string' || text.length > 4000) fail('元件文字無效或過長。');
          variables[step.variable] = text;
        } else fail('不支援的流程步驟。');
      }
      if (entry.status === 'running') entry.status = 'passed';
    } catch (error) {
      entry.status = 'failed';
      entry.message = error.flowPath ? String(error.message).slice(0,1500) : error.webdriver ? ('Appium 操作失敗：'+String(error.webdriver).slice(0,100)+(error.driverMessage ? '\nAppium 訊息（已遮蔽）：'+error.driverMessage : '')).slice(0,1500) : error.name === 'TimeoutError' || error.name === 'AbortError' ? 'Appium 請求逾時或已中止。' : error instanceof TypeError ? 'Appium 連線或回應處理失敗。' : safeError(error);
      throw Object.assign(new Error(entry.message), { flowPath: error.flowPath || path });
    } finally { entry.durationMs = Math.max(0, Math.round(now() - before)); }
  }
  function safeError(error) {
    // Never persist driver responses, typed strings, captured text or variables.
    const message = String(error.message || 'Appium 操作失敗。');
    return /^(API |共用流程實際路徑|未定義的變數：|變數展開後|流程超過|定位器符合|找不到元件|找不到指定版本|Appium 元件回應|無效的手機|已達滑動|已達迴圈|應用程式不在|畫面文字不符合|元件不可見|元件仍可見|元件數量|元件尚不可|元件未被|元件勾選|元件操作狀態|元件選取|元件狀態回應|等待條件|檢查條件|元件文字|不支援的流程)/.test(message) ? message.slice(0, 300) : 'Appium 操作失敗。';
  }
  try {
    await runList(flow.before || [], 'before', undefined, 'before');
    for (let i = 0; i < flow.steps.length; i++) {
      steps[i].status = 'running'; await onStep({ completed: result.completed, steps: structuredClone(steps) });
      try { await runStep(flow.steps[i], `main.${i + 1}`, undefined, 'main'); steps[i].status = 'passed'; result.completed = i + 1; }
      catch (error) { steps[i].status = 'failed'; throw new Error(`步驟 ${i + 1}「${steps[i].name}」未通過：${error.message}`); }
    }
    const missing = (flow.actors || ['device']).filter(role => !asserted.has(role));
    if (missing.length) fail('實際路徑未完成必要斷言，不能判定通過。');
    result.status = 'passed'; result.message = '所有畫面操作與檢查通過。';
  } catch (error) { result.message = String(error.message).slice(0, 800); }
  finally {
    cleaning = true;
    cleanupDeadline = now() + FLOW_LIMITS.cleanupMs;
    for (let i = 0; i < (flow.after || []).length; i++) {
      try { await runStep(flow.after[i], `after.${i + 1}`, undefined, 'after'); }
      catch { result.message = result.status === 'passed' ? '主測試已完成，但清理步驟失敗，請查看執行紀錄。' : (result.message + ' 清理步驟失敗，請查看執行紀錄。').slice(0, 1000); result.status = 'failed'; }
    }
  }
  return result;
}
