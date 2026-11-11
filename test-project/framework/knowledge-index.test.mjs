import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { planFile } from '../support/case-plan.mjs';
import { caseEvidence } from '../support/script-evidence.mjs';

test('來源關聯讓索引超過 1 MB 時仍可核對案例與報告，2 MB 上限保留', async () => {
  const root = await mkdtemp(join(tmpdir(), 'archify-knowledge-index-'));
  try {
    await mkdir(join(root, 'knowledge/documents'), { recursive: true }); await mkdir(join(root, 'test-cases'));
    const id = '11111111-1111-1111-1111-111111111111';
    await writeFile(join(root, `knowledge/documents/${id}.md`), '會員文字規則');
    const index = { schemaVersion: 1, documents: [{ id, format: 'md' }], fixturePadding: 'x'.repeat(1100000) };
    await writeFile(join(root, 'knowledge/index.json'), JSON.stringify(index));
    await writeFile(join(root, 'test-cases/catalog.json'), JSON.stringify({ schemaVersion: 1, features: [], cases: [{ id: 'TC-INDEX', knowledgeIds: [id] }] }));
    assert.equal(JSON.parse(await planFile(root, 'knowledge/index.json')).documents.length, 1);
    assert.equal(caseEvidence(root, 'tests/api/Example.spec.ts', 'TC-INDEX').complete, true);
    await writeFile(join(root, 'knowledge/index.json'), JSON.stringify({ ...index, fixturePadding: 'x'.repeat(2 * 1024 * 1024) }));
    await assert.rejects(() => planFile(root, 'knowledge/index.json'), /過大/);
    assert.equal(caseEvidence(root, 'tests/api/Example.spec.ts', 'TC-INDEX'), null);
  } finally { assert.equal(dirname(resolve(root)), resolve(tmpdir())); assert.ok(basename(root).startsWith('archify-knowledge-index-')); await rm(root, { recursive: true, force: true }); }
});
