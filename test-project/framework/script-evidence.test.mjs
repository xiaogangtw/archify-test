import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { scriptEvidence, caseEvidence, intentHash } from '../support/script-evidence.mjs';

test('證據只存 hash、不執行模組，追蹤共用依賴、意圖及知識並拒絕範圍外讀取', async () => {
  const root = await mkdtemp(join(tmpdir(), 'archify-evidence-'));
  try {
    for (const part of ['tests/api', 'api', 'support', 'knowledge/documents', 'test-cases']) await mkdir(join(root, part), { recursive: true });
    await writeFile(join(root, 'package-lock.json'), '{}');
    await writeFile(join(root, '.env'), 'SECRET=NEVER_READ_ENV');
    await writeFile(join(root, 'tests/api/Case.spec.ts'), "import {api} from '../../api/Card.js';\nconst steps=['讀取名片'];\ntest('case',{annotation:[{type:'archify-case',description:'TC-CARD'}]},async()=>{await test.step(steps[0],async()=>{});});\nthrow new Error('DO_NOT_EXECUTE');");
    await writeFile(join(root, 'api/Card.ts'), "import {send} from '../support/transport.mjs';export const api=send;");
    await writeFile(join(root, 'support/transport.mjs'), "export function send(){throw new Error('DO_NOT_EXECUTE');}");
    const before = scriptEvidence(root, 'tests/api/Case.spec.ts');
    assert.equal(before.complete, true); assert.deepEqual(before.caseIds, ['TC-CARD']); assert.deepEqual(before.steps, ['讀取名片']);
    assert.ok(!JSON.stringify(before).includes('NEVER_READ_ENV') && !JSON.stringify(before).includes('DO_NOT_EXECUTE'));
    await writeFile(join(root, 'support/transport.mjs'), 'export function send(){return 2;}');
    assert.notEqual(scriptEvidence(root, 'tests/api/Case.spec.ts').hash, before.hash);
    const knowledgeId = '11111111-1111-1111-1111-111111111111';
    const row = { id: 'TC-CARD', featureId: 'F-CARD', title: '名片', kind: 'api', purpose: '讀取', preconditions: '', data: '', expected: '指定資料', knowledgeIds: [knowledgeId], questions: [], script: 'tests/api/Case.spec.ts' };
    await writeFile(join(root, 'test-cases/catalog.json'), JSON.stringify({ cases: [row] }));
    await writeFile(join(root, 'knowledge/index.json'), JSON.stringify({ documents: [{ id: knowledgeId, format: 'md' }] }));
    await writeFile(join(root, `knowledge/documents/${knowledgeId}.md`), '只允許本人讀取');
    const intent = caseEvidence(root, 'tests/api/Case.spec.ts');
    assert.equal(intent.complete, true); assert.equal(intent.intentHash, intentHash(row));
    await writeFile(join(root, `knowledge/documents/${knowledgeId}.md`), '角色規則已更新');
    assert.notEqual(caseEvidence(root, 'tests/api/Case.spec.ts').knowledgeHash, intent.knowledgeHash);
    await writeFile(join(root, 'api/Card.ts'), "import x from '../../outside-secret.mjs';");
    assert.equal(scriptEvidence(root, 'tests/api/Case.spec.ts').complete, false);
    assert.equal(scriptEvidence(root, '../outside-secret.mjs').complete, false);
  } finally { assert.equal(dirname(resolve(root)), resolve(tmpdir())); assert.ok(basename(root).startsWith('archify-evidence-')); await rm(root, { recursive: true, force: true }); }
});
