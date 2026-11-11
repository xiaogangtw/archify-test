import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineCase, executeCase, describeCase } from './runtime.mjs';
import { renderHtml } from './html.mjs';
import { mkdtemp, cp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

test('失敗中止主流程，仍執行清理，不把秘密例外寫入報告', async () => {
  let cleaned = false;
  const value = defineCase({ id: 'failure', name: '失敗', purpose: '', steps: [
    { name: '失敗步驟', expected: '成功', run() { throw new Error('SECRET'); } },
    { name: '不應執行', expected: '成功', run() { assert.fail('不可執行'); } }
  ], cleanup() { cleaned = true; } });
  const result = await executeCase(value, 'test', 'hash');
  assert.equal(cleaned, true);
  assert.equal(result.status, 'failed');
  assert.equal(result.steps[1].status, 'skipped');
  assert.ok(!JSON.stringify(result).includes('SECRET'));
});
test('無斷言拒絕通過，清理失敗也使案例失敗', async () => {
  const value = defineCase({ id: 'empty', name: '無斷言', purpose: '', steps: [{ name: '空', expected: '有結果', run() {} }] });
  assert.equal((await executeCase(value)).status, 'failed');
  value.steps[0].run = (_, verify) => verify(true, true);
  value.cleanup = () => { throw new Error('cleanup'); };
  assert.equal((await executeCase(value)).status, 'failed');
});
test('流程描述不執行步驟，結果包含預期與來源 hash', async () => {
  const value = defineCase({ id: 'pass', name: '成功', purpose: '', steps: [{ name: '驗證', expected: '相等', run(_, verify) { verify(1, 1); } }] });
  assert.equal(describeCase(value, 'source', 'hash').status, 'not-run');
  const result = await executeCase(value, 'source', 'hash');
  assert.equal(result.status, 'passed');
  assert.equal(result.sourceHash, 'hash');
});
test('獨立複製框架仍可執行，失敗退出碼與 HTML escape 正確', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'archify-runtime-'));
  assert.equal(dirname(resolve(directory)), resolve(tmpdir()), '暫存測試目錄必須位於系統 temp 內');
  assert.ok(basename(directory).startsWith('archify-runtime-'));
  try {
    await cp(new URL('./', import.meta.url), join(directory, 'framework'), { recursive: true });
    await mkdir(join(directory, 'tests'));
    await writeFile(join(directory, 'tests', 'failure.case.mjs'), `import {defineCase} from '../framework/runtime.mjs';export default defineCase({id:'F',name:'<script>unsafe</script>',purpose:'fixture',steps:[{name:'失敗',expected:'相等',run(_,verify){verify(1,2)}}],cleanup(){}});`);
    const run = spawnSync(process.execPath, ['framework/cli.mjs', 'run', '--case', 'F'], { cwd: directory, encoding: 'utf8' });
    assert.equal(run.status, 1, run.stderr);
    const files = await readdir(join(directory, 'reports'));
    const data = JSON.parse(await readFile(join(directory, 'reports', files.find(file => file.endsWith('.json'))), 'utf8'));
    assert.equal(data.cases[0].status, 'failed');
    assert.equal(data.cases[0].cleanup.status, 'passed');
    assert.equal(data.cases.length, 1);
    assert.equal(spawnSync(process.execPath, ['framework/cli.mjs', 'run', '--case', 'NOT_FOUND'], { cwd: directory, encoding: 'utf8' }).status, 1);
    const html = renderHtml(data);
    assert.ok(html.includes('&lt;script&gt;unsafe&lt;/script&gt;'));
    assert.ok(!html.includes('<script>'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
