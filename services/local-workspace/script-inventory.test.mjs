import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, request } from './test-support.mjs';
import { createHandler } from './plugin.mjs';
import { inspectScript } from './script-inventory.mjs';

test('靜態辨識有內容、空草稿、略過與非標準測試，不執行來源', () => {
  assert.deepEqual(inspectScript("test.skip('草稿',async()=>{});", 'draft.spec.ts'), { state: 'draft', tests: 1, withContent: 0, skipped: 1 });
  const content = inspectScript("import {test as check} from '@playwright/test'; check('a',async()=>{throw new Error('DO_NOT_EXECUTE')}); test.skip('b',()=>{ expect(1).toBe(1) });", 'manual.spec.ts');
  assert.equal(content.state, 'content'); assert.equal(content.tests, 2); assert.equal(content.skipped, 1);
  assert.equal(inspectScript("// test('comment',()=>{})\nconst text=\"test('text',()=>{})\";", 'text.spec.ts').state, 'unknown');
  assert.equal(inspectScript("test('broken',()=>{", 'broken.spec.ts').state, 'unknown');
  assert.equal(inspectScript("test.step('step',()=>{});", 'step.spec.ts').tests, 0);
});

test('唯讀清單涵蓋手寫與生成稿、分類、空目錄及傳輸權限，排除模組與封存', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize();
    assert.equal((await f.workspace.scripts()).summary.total, 0);
    for (const part of ['api', 'flows', 'ui', 'web', 'mobile', 'custom', 'legacy']) await mkdir(join(f.project, 'tests', part), { recursive: true });
    for (const part of ['api', 'flows', 'ui', 'web', 'mobile', 'custom']) await writeFile(join(f.project, 'tests', part, 'manual.spec.ts'), "test('manual',async()=>{throw new Error('DO_NOT_EXECUTE')});");
    await writeFile(join(f.project, 'tests/api/draft.spec.ts'), "test.skip('draft',async()=>{});");
    await writeFile(join(f.project, 'tests/custom/unknown.test.js'), "console.log('DO_NOT_EXECUTE');");
    await writeFile(join(f.project, 'tests/legacy/archived.spec.ts'), "test('old',()=>{});");
    await writeFile(join(f.project, 'api/helper.ts'), "throw new Error('DO_NOT_EXECUTE');");
    const result = await f.workspace.scripts();
    assert.deepEqual(result.summary, { total: 8, content: 6, draft: 1, unknown: 1 });
    assert.equal(result.scripts.filter(row => row.category === 'web').length, 2);
    const handler = createHandler(f.workspace, 'test-session');
    assert.equal((await request(handler, '/local-api/scripts', {}, { headers: { 'x-archify-session': 'wrong' } })).status, 403);
    assert.deepEqual((await request(handler, '/local-api/scripts', {})).body.summary, result.summary);
    await writeFile(join(f.project, 'tests/api/large.spec.ts'), 'x'.repeat(1024 * 1024 + 1));
    const large = await f.workspace.scripts();
    assert.equal(large.summary.unknown, 2); assert.equal(large.warnings.length, 1);
  } finally { await f.dispose(); }
});
