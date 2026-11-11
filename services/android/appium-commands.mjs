import { createRequire } from 'node:module';
const { z } = createRequire(new URL('../control-api/package.json', import.meta.url))('zod');

// Shared by the public agent tool, static Flow Case validator and worker.
const json = z.lazy(() => z.union([z.string().max(16000), z.number().finite(), z.boolean(), z.null(), z.array(json).max(1000), z.record(z.string().max(200), json)]));
const boundedJson = z.unknown().superRefine((value, ctx) => {
  let count = 0;
  function visit(item, depth = 0) {
    if (++count > 4000 || depth > 16) throw new Error('Appium 參數結構過大。');
    if (item && typeof item === 'object') for (const [key, child] of Object.entries(item)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Appium 參數名稱無效。');
      visit(child, depth + 1);
    }
  }
  try { visit(value); if (JSON.stringify(value).length > 32000) throw new Error('Appium 參數過長。'); }
  catch (error) { ctx.addIssue({ code: 'custom', message: error.message }); }
}).pipe(json);
export const editorActions = ['unspecified', 'none', 'go', 'search', 'send', 'next', 'done', 'previous'];
export const editorActionFields = { editorAction: z.enum(editorActions) };
export const mobileCommandFields = {
  command: z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/).max(100),
  params: boundedJson.optional(),
  resultPath: z.array(z.string().min(1).max(200)).max(10).optional(),
};
export const webdriverCommandFields = {
  method: z.enum(['GET', 'POST', 'DELETE']),
  // Session ownership remains in Archify. No absolute URL, traversal, query,
  // session lifecycle or arbitrary script escape through this transport.
  path: z.string().max(500).regex(/^\/(?:[A-Za-z0-9_-]|\{\{[A-Za-z][A-Za-z0-9_]*\}\})+(?:\/(?:[A-Za-z0-9_-]|\{\{[A-Za-z][A-Za-z0-9_]*\}\})+)*$/)
    .refine(path => !/^\/(?:session|execute)(?:\/|$)/.test(path), '請用 mobileCommand 呼叫 mobile 擴充；session 由執行器管理。'),
  params: boundedJson.optional(),
  resultPath: z.array(z.string().min(1).max(200)).max(10).optional(),
};
const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('editorAction'), ...editorActionFields }).strict(),
  z.object({ action: z.literal('mobileCommand'), ...mobileCommandFields }).strict(),
  z.object({ action: z.literal('webdriverCommand'), ...webdriverCommandFields }).strict(),
]);
export function appiumRequest(input) {
  const spec = commandSchema.parse(Object.fromEntries(Object.entries(input).filter(([key]) => ['action', 'editorAction', 'command', 'params', 'method', 'path'].includes(key))));
  if (spec.action === 'editorAction') return { path: '/execute/sync', method: 'POST', body: { script: 'mobile: performEditorAction', args: [{ action: spec.editorAction }] } };
  if (spec.action === 'mobileCommand') {
    if (spec.params !== undefined && (spec.params === null || Array.isArray(spec.params) || typeof spec.params !== 'object')) throw new Error('mobileCommand params 必須是物件。');
    return { path: '/execute/sync', method: 'POST', body: { script: 'mobile: ' + spec.command, args: [spec.params || {}] } };
  }
  if (spec.method !== 'POST' && spec.params !== undefined) throw new Error('GET/DELETE 不接受 params。');
  return { path: spec.path, method: spec.method, body: spec.params ?? (spec.method === 'POST' ? {} : undefined) };
}
export function commandValue(value, resultPath = []) {
  for (const key of resultPath) {
    if (['__proto__','constructor','prototype'].includes(key) || value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) throw new Error('Appium 回傳缺少 resultPath 欄位。');
    value = value[key];
  }
  const serialized = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  if (serialized.length > 4000) throw new Error('Appium 回傳超過變數長度上限。');
  return typeof value === 'number' || typeof value === 'boolean' ? value : serialized;
}
