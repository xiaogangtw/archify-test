import {parseFlow} from './flow-contract.mjs';
export const dependencyKey = (id, version) => JSON.stringify([id,version]);

export async function resolveFlowDependencies(root, load, rootKey) {
  const definitions = Object.create(null), snapshots = [];
  let nodes = 0;
  async function visit(flow, list, stack, inherited) {
    for (const step of list) {
      if (++nodes > 600 || stack.length > 6) throw new Error('共用流程引用過多或過深。');
      const role = step.actor || inherited;
      if (step.action === 'call') await visit(flow,flow.routines[step.routine],stack,role);
      for (const children of [step.then,step.else,step.steps]) if (children) await visit(flow,children,stack,role);
      if (step.action !== 'callFlow') continue;
      const key = dependencyKey(step.scriptId,step.scriptVersion);
      if (stack.includes(key)) throw new Error('共用 Flow Case 不可循環引用。');
      if (!Object.hasOwn(definitions,key)) {
        if (snapshots.length >= 20) throw new Error('共用 Flow Case 最多20個版本。');
        const script = await load(step.scriptId,step.scriptVersion);
        if (!script || script.caseType !== 'flow' || script.version !== step.scriptVersion) throw new Error('找不到指定版本的共用 Flow Case。');
        const definition = parseFlow(script.source);
        definitions[key] = definition;
        snapshots.push({scriptId:step.scriptId,scriptVersion:step.scriptVersion,name:script.name,source:script.source});
      }
      const child = definitions[key];
      if (child.actors && !root.actors) throw new Error('多機共用流程必須由多機案例呼叫。');
      if (child.actors && role) throw new Error('多機共用流程使用流程內的角色，不能指定單一手機。');
      if (root.actors && role && !root.actors.includes(role)) throw new Error('共用流程的 actor 不在目前案例中，請重新指定角色。');
      if (root.actors && !child.actors && !role) throw new Error(`「${step.name}」待指定角色：單機共用流程必須指定執行 actor，請選擇要操作的手機角色。`);
      for (const steps of [child.before || [],child.steps,child.after || []]) await visit(child,steps,[...stack,key],child.actors ? undefined : role);
    }
  }
  for (const list of [root.before || [],root.steps,root.after || []]) await visit(root,list,rootKey ? [rootKey] : []);
  return {definitions,snapshots};
}
