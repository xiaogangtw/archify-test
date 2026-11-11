import { appiumRequest, editorActionFields, mobileCommandFields, webdriverCommandFields } from './appium-commands.mjs';
import { FLOW_LIMITS } from './flow-limits.mjs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../control-api/package.json', import.meta.url));
const ts = require('typescript');
const { z } = require('zod');
const locator = { using: z.enum(['id', 'accessibility id', 'xpath']), value: z.string().min(1).max(2000) };
const actor = { actor: z.enum(['sender', 'receiver']).optional() };
const gesture = {
  direction: z.enum(['up', 'down', 'left', 'right']),
  percent: z.number().finite().gt(0).max(1).optional(),
  area: z.object({ left: z.number().min(0).max(1), top: z.number().min(0).max(1), width: z.number().gt(0).max(1), height: z.number().gt(0).max(1) }).strict().refine(area => area.left + area.width <= 1 && area.top + area.height <= 1, '滑動範圍不可超出畫面。').optional(),
};
export function flowStepName(step) { return step.actor ? `${step.actor === 'sender' ? '發送者' : '接收者'} · ${step.name}` : step.name; }
export function requiresAppiumCommands(value) {
  if (!value || typeof value !== 'object') return false;
  if (['editorAction','mobileCommand','webdriverCommand'].includes(value.action)) return true;
  return Object.values(value).some(child => Array.isArray(child) ? child.some(requiresAppiumCommands) : requiresAppiumCommands(child));
}
export function requiresConditionalFlow(flow) {
  const legacy = new Set(['click','type','assertVisible','assertText','back','assertAppForeground']);
  if (flow.before || flow.after || flow.variables || flow.routines) return true;
  return flow.steps.some(step => !legacy.has(step.action) || step.timeoutMs !== undefined || step.clear !== undefined || step.match !== undefined);
}
const variableName = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/).refine(name => !['constructor','prototype','__proto__','runId','timestamp'].includes(name), '變數名稱保留或無效。');
const scalar = z.union([z.string().max(4000), z.number().finite(), z.boolean()]);
const timeout = { timeoutMs: z.number().int().min(0).max(30000).optional() };
const condition = z.lazy(() => z.discriminatedUnion('kind', [
  ...['visible','absent','enabled','selected','checked'].map(kind => z.object({ kind: z.literal(kind), ...locator, ...actor, ...(['enabled','selected','checked'].includes(kind) ? { expected: z.boolean().optional() } : {}) }).strict()),
  z.object({ kind: z.literal('text'), ...locator, ...actor, text: z.string().max(4000), match: z.enum(['equals','contains']).optional() }).strict(),
  z.object({ kind: z.literal('count'), ...locator, ...actor, count: z.number().int().min(0).max(10000) }).strict(),
  z.object({ kind: z.literal('foreground'), ...actor }).strict(),
  z.object({ kind: z.literal('variable'), variable: variableName, equals: scalar }).strict(),
  z.object({ kind: z.literal('any'), conditions: z.array(condition).min(1).max(10), ...actor }).strict(),
  z.object({ kind: z.literal('all'), conditions: z.array(condition).min(1).max(10), ...actor }).strict(),
]));
const baseStep = { name: z.string().min(1).max(200), ...actor, ...timeout };
const step = z.lazy(() => z.discriminatedUnion('action', [
  ...Object.entries({editorAction:editorActionFields,mobileCommand:mobileCommandFields,webdriverCommand:webdriverCommandFields}).map(([action,fields])=>z.object({...baseStep,action:z.literal(action),...fields,variable:variableName.optional()}).strict()),
  z.object({ name:baseStep.name, action:z.literal('apiFlow'), scriptId:z.string().min(1).max(100), scriptVersion:z.number().int().positive(), namespace:z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/), authVariable:variableName.optional(), inputs:z.record(variableName,scalar).optional(), overrides:z.array(z.object({caseId:z.string(),request:z.record(z.string(),z.unknown())}).strict()).max(30).optional(), pollTimeoutMs:z.number().int().min(0).max(20000).optional() }).strict(),
  z.object({ ...baseStep, action: z.literal('click'), ...locator }).strict(),
  z.object({ ...baseStep, action: z.literal('longPress'), ...locator, durationMs:z.number().int().min(400).max(5000).optional() }).strict(),
  z.object({ ...baseStep, action: z.literal('doubleClick'), ...locator }).strict(),
  z.object({...baseStep,action:z.literal('activateApp'),appPackage:z.string().regex(/^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/).max(200)}).strict(),
  ...['tapPoint','longPressPoint'].map(action=>z.object({...baseStep,action:z.literal(action),x:z.number().finite().min(0).max(1),y:z.number().finite().min(0).max(1),...(action==='longPressPoint'?{durationMs:z.number().int().min(400).max(5000).optional()}:{})}).strict()),
  z.object({ ...baseStep, action: z.literal('type'), ...locator, text: z.string().max(4000), clear: z.boolean().optional() }).strict(),
  ...['assertVisible','assertAbsent','assertEnabled','assertSelected','assertChecked'].map(action => z.object({ ...baseStep, action: z.literal(action), ...locator, ...(['assertEnabled','assertSelected','assertChecked'].includes(action) ? { expected: z.boolean().optional() } : {}) }).strict()),
  z.object({ ...baseStep, action: z.literal('assertText'), ...locator, text: z.string().max(4000), match: z.enum(['equals','contains']).optional() }).strict(),
  z.object({ ...baseStep, action: z.literal('assertCount'), ...locator, count: z.number().int().min(0).max(10000) }).strict(),
  ...['back','assertAppForeground','hideKeyboard'].map(action => z.object({ ...baseStep, action: z.literal(action) }).strict()),
  z.object({ ...baseStep, action: z.literal('swipe'), ...gesture }).strict(),
  z.object({ ...baseStep, action: z.literal('scrollUntilVisible'), ...locator, ...gesture, maxSwipes: z.number().int().min(1).max(10).optional() }).strict(),
  z.object({ ...baseStep, action: z.literal('waitFor'), condition }).strict(),
  z.object({ ...baseStep, action: z.literal('assert'), condition }).strict(),
  z.object({ ...baseStep, action: z.literal('if'), condition, then: z.array(step).min(1).max(FLOW_LIMITS.sectionSteps), else: z.array(step).max(FLOW_LIMITS.sectionSteps).optional() }).strict(),
  z.object({ ...baseStep, action: z.literal('optional'), condition, steps: z.array(step).min(1).max(FLOW_LIMITS.sectionSteps) }).strict(),
  z.object({ ...baseStep, action: z.literal('repeat'), times: z.number().int().min(1).max(10), steps: z.array(step).min(1).max(FLOW_LIMITS.sectionSteps) }).strict(),
  z.object({ ...baseStep, action: z.literal('while'), condition, maxIterations: z.number().int().min(1).max(10), steps: z.array(step).min(1).max(FLOW_LIMITS.sectionSteps) }).strict(),
  z.object({ ...baseStep, action: z.literal('call'), routine: variableName }).strict(),
  z.object({ ...baseStep, action: z.literal('callFlow'), scriptId: z.string().min(1).max(100), scriptVersion: z.number().int().positive() }).strict(),
  z.object({ ...baseStep, action: z.literal('set'), variable: variableName, value: scalar }).strict(),
  z.object({ ...baseStep, action: z.literal('generate'), variable: variableName, prefix: z.string().max(100).optional() }).strict(),
  z.object({ ...baseStep, action: z.literal('readText'), ...locator, variable: variableName }).strict(),
]));
// Reject excessive nesting before recursive Zod traversal, including direct worker input.
export const flowSchema = z.unknown().transform((input, context) => {
  let count = 0;
  function inspect(value, depth = 0) {
    if (depth > 24 || ++count > FLOW_LIMITS.structureValues) throw new Error('流程結構過深或過大。');
    if (value && typeof value === 'object') for (const child of Object.values(value)) inspect(child, depth + 1);
  }
  try { inspect(input); } catch (error) { context.addIssue({ code: 'custom', message: error.message }); return z.NEVER; }
  return input;
}).pipe(z.object({
  actors: z.tuple([z.literal('sender'), z.literal('receiver')]).optional(),
  appPackage: z.string().regex(/^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/).max(200),
  variables: z.record(variableName, scalar).optional(),
  routines: z.record(variableName, z.array(step).min(1).max(FLOW_LIMITS.sectionSteps)).optional(),
  before: z.array(step).max(FLOW_LIMITS.sectionSteps).optional(),
  after: z.array(step).max(FLOW_LIMITS.sectionSteps).optional(),
  steps: z.array(step).min(1).max(FLOW_LIMITS.sectionSteps),
}).strict()).superRefine((flow, context) => {
  let count = 0;
  const asserted = new Set();
  const issue = message => context.addIssue({ code: 'custom', message });
  function validateCondition(condition, inherited) {
    const role = condition.actor || inherited;
    if (!flow.actors && condition.actor) issue('使用 actor 時必須宣告 actors: ["sender", "receiver"]。');
    if (condition.conditions) for (const child of condition.conditions) validateCondition(child, role);
    else if (flow.actors && condition.kind !== 'variable' && !role) issue('雙機條件必須指定 actor 或繼承父步驟 actor。');
  }
  function visit(steps, depth = 0, stack = [], inherited, main = false) {
    if (depth > 6) { issue('流程巢狀最多6層，不可循環呼叫共用流程。'); return; }
    for (const item of steps) {
      if (++count > FLOW_LIMITS.structureSteps) { issue(`展開後流程結構最多${FLOW_LIMITS.structureSteps}步。`); return; }
      if(['editorAction','mobileCommand','webdriverCommand'].includes(item.action)){try{appiumRequest(item);}catch{issue('Appium 指令參數或路徑無效。');}}
      const role = item.actor || inherited;
      if (flow.actors && !role && !['if','optional','repeat','while','call','callFlow','apiFlow','set','generate'].includes(item.action)) issue('雙機流程每一步都必須指定 actor 或繼承父步驟 actor。');
      if (!flow.actors && item.actor) issue('使用 actor 時必須宣告 actors: ["sender", "receiver"]。');
      if (item.condition) validateCondition(item.condition,role);
      if (main && item.action.startsWith('assert')) asserted.add(role || 'device');
      // References are resolved from immutable versions at run creation. Actual
      // assertions are still required on every executed path by the interpreter.
      if (main && item.action === 'callFlow') for (const target of role ? [role] : flow.actors || ['device']) asserted.add(target);
      for (const children of [item.then, item.else, item.steps]) if (children) visit(children, depth + 1, stack, role, main);
      if (item.action === 'call') {
        if (!Object.hasOwn(flow.routines || {}, item.routine)) issue('找不到共用流程：' + item.routine);
        else if (stack.includes(item.routine)) issue('共用流程不可循環呼叫。');
        else visit(flow.routines[item.routine], depth + 1, [...stack,item.routine], role, main);
      }
    }
  }
  visit(flow.steps, 0, [], undefined, true);
  visit(flow.before || []); visit(flow.after || []);
  for (const [name, steps] of Object.entries(flow.routines || {})) visit(steps, 0, [name]);
  for (const role of flow.actors || ['device']) if (!asserted.has(role)) issue(role + ' 至少需要一個主流程畫面檢查，不能只操作就判定通過。');
});
function literal(node, depth = 0) {
  if (depth > 24) throw new Error('流程結構過深。');
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node)) return literal(node.expression, depth + 1);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand) && [ts.SyntaxKind.MinusToken,ts.SyntaxKind.PlusToken].includes(node.operator)) return Number(node.operand.text) * (node.operator === ts.SyntaxKind.MinusToken ? -1 : 1);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(child => literal(child, depth + 1));
  if (ts.isObjectLiteralExpression(node)) {
    const result = Object.create(null);
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) throw new Error('流程只允許靜態欄位，不支援函式、變數或展開語法。');
      const key = property.name.text;
      if (['__proto__','constructor','prototype'].includes(key) || Object.hasOwn(result, key)) throw new Error('流程有重複或無效欄位。');
      result[key] = literal(property.initializer, depth + 1);
    }
    return result;
  }
  throw new Error('Flow Case 只接受靜態流程定義，不執行任意 TypeScript。');
}
export function parseFlow(source) {
  if (typeof source !== 'string' || source.length > FLOW_LIMITS.sourceCharacters) throw new Error('流程內容過長或無效。');
  const file = ts.createSourceFile('flow.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (file.parseDiagnostics.length || file.statements.length !== 1) throw new Error('請使用單一 export const flow = { appPackage, steps } as const 定義。');
  const statement = file.statements[0];
  if (!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const) || !statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || statement.declarationList.declarations.length !== 1) throw new Error('請匯出單一 const flow。');
  const declaration = statement.declarationList.declarations[0];
  if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'flow' || !declaration.initializer) throw new Error('流程名稱必須是 flow。');
  const parsed = flowSchema.safeParse(literal(declaration.initializer));
  if (!parsed.success) throw new Error(parsed.error.issues.map(issue => `${issue.path.join('.') || 'flow'}：${issue.message}`).join('\n').slice(0, 1000));
  return parsed.data;
}
