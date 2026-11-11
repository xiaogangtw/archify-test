import assert from 'node:assert/strict';

export const check = assert;
export function defineCase(value) {
  if (!value || typeof value.id !== 'string' || !value.id.trim() || typeof value.name !== 'string' || !value.name.trim() ||
      typeof value.purpose !== 'string' || !Array.isArray(value.steps) || !value.steps.length ||
      value.steps.some(step => !step || typeof step.name !== 'string' || !step.name.trim() || typeof step.expected !== 'string' || !step.expected.trim() || typeof step.run !== 'function') ||
      (value.cleanup !== undefined && typeof value.cleanup !== 'function')) throw new Error('案例必須有 id、name、purpose、具名 steps、expected 與 run。');
  return value;
}
export function describeCase(value, source, sourceHash) {
  return { id: value.id, name: value.name, purpose: value.purpose, source, sourceHash,
    steps: value.steps.map(step => ({ name: step.name, expected: step.expected, status: 'not-run' })), status: 'not-run' };
}
export async function executeCase(value, source, sourceHash) {
  const result = describeCase(value, source, sourceHash);
  const context = {};
  const start = performance.now();
  let failed = false;
  for (const [index, step] of value.steps.entries()) {
    const output = result.steps[index];
    if (failed) { output.status = 'skipped'; continue; }
    const stepStart = performance.now();
    let assertions = 0;
    const verify = (actual, expected) => { assertions++; assert.deepStrictEqual(actual, expected, '結果與預期不符'); };
    try {
      await step.run(context, verify);
      assert.ok(assertions > 0, '步驟未執行 verify 斷言');
      output.status = 'passed';
    } catch (error) {
      failed = true;
      output.status = 'failed';
      output.error = typeof error?.reportMessage === 'string' ? error.reportMessage.slice(0, 500) : '步驟執行失敗或斷言不符；請於本機檢查腳本與測試資料。報告不收錄原始例外，避免洩漏秘密。';
    }
    output.durationMs = Math.round(performance.now() - stepStart);
  }
  if (value.cleanup) {
    try { await value.cleanup(context); result.cleanup = { status: 'passed' }; }
    catch { failed = true; result.cleanup = { status: 'failed', error: '清理失敗，請於本機確認殘留資料。' }; }
  }
  result.status = failed ? 'failed' : 'passed';
  result.durationMs = Math.round(performance.now() - start);
  return result;
}
