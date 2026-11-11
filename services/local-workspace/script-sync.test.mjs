import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, appendFile, unlink, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './test-support.mjs';
import { createWorkspace } from './workspace.mjs';

async function seeded(f) {
  await f.workspace.initialize();
  const scan = await f.workspace.scan();
  assert.deepEqual(scan.warnings, []);
  await f.workspace.generate({ scanId: scan.scanId, ids: scan.requests.map(row => row.id) });
  return scan;
}

test('前端移除只提出受管腳本，確認封存完整原文，重啟可還原且拒絕覆寫', async () => {
  const f = await fixture();
  try {
    await seeded(f);
    const file = join(f.project, 'tests/api/GetCard.spec.ts');
    await appendFile(file, '\n// 人工補充的業務案例與斷言要保留。\n');
    const before = await readFile(file);
    const manual = join(f.project, 'tests/api/Manual.spec.ts'); await writeFile(manual, '// 人工腳本');
    await unlink(join(f.source, 'src/cards.gql'));
    const next = await f.workspace.scan({ apiDir: 'tests\\api' });
    assert.equal(next.apiDir, 'tests/api');
    assert.equal(next.removed.length, 1); assert.equal(next.removed[0].path, 'tests/api/GetCard.spec.ts');
    assert.ok((await lstat(file)).isFile(), 'scanning never removes files');
    const input = { scanId: next.scanId, ids: next.removed.map(row => row.id) };
    const result = await f.workspace.archiveRemoved(input);
    await assert.rejects(() => lstat(file), { code: 'ENOENT' });
    assert.deepEqual(result.analysis.removed, []);
    assert.deepEqual(await readFile(join(f.project, `legacy/removed-api/${result.archive}/files/tests/api/GetCard.spec.ts`)), before);
    assert.equal(await readFile(manual, 'utf8'), '// 人工腳本');
    const restoredWorkspace = createWorkspace(f.config);
    await writeFile(file, '// 新的人工內容');
    await assert.rejects(() => restoredWorkspace.restoreRemoved({ archive: result.archive }), /已有檔案/);
    assert.equal(await readFile(file, 'utf8'), '// 新的人工內容');
    await unlink(file);
    await restoredWorkspace.restoreRemoved({ archive: result.archive });
    assert.deepEqual(await readFile(file), before);
    await assert.rejects(() => restoredWorkspace.restoreRemoved({ archive: '../../.env' }), /不合法/);
  } finally { await f.dispose(); }
});

test('來源／腳本變更與不完整掃描不誤移除，同名 GraphQL 修改保留', async () => {
  const f = await fixture();
  try {
    await seeded(f);
    await writeFile(join(f.source, 'src/cards.gql'), 'query GetCard($id: ID!) { card(id: $id) { id name } }');
    assert.deepEqual((await f.workspace.scan()).removed, [], 'query changes are not removal');
    await unlink(join(f.source, 'src/cards.gql'));
    const scan = await f.workspace.scan(); assert.equal(scan.removed.length, 1);
    const input = { scanId: scan.scanId, ids: [scan.removed[0].id] };
    await appendFile(join(f.project, scan.removed[0].path), '\n// 新的變更');
    await assert.rejects(() => f.workspace.archiveRemoved(input), /腳本已變更/);
    const again = await f.workspace.scan();
    await writeFile(join(f.source, 'src/extra.ts'), 'export const value = 1;');
    await assert.rejects(() => f.workspace.archiveRemoved({ scanId: again.scanId, ids: [again.removed[0].id] }), /來源已變更/);
    const subdir = await f.workspace.scan({ sourceSubdir: 'src' });
    assert.deepEqual(subdir.removed, []); assert.match(subdir.removalNotice, /來源根目錄/);
    const complete = await f.workspace.scan();
    await writeFile(join(f.source, 'src/large.ts'), ' '.repeat(1024 * 1024 + 1));
    await assert.rejects(() => f.workspace.archiveRemoved({ scanId: complete.scanId, ids: [complete.removed[0].id] }), /分析不完整/);
    const partial = await f.workspace.scan();
    assert.ok(partial.warnings.length); assert.deepEqual(partial.removed, []);
  } finally { await f.dispose(); }
});

test('首次基準與人工檔案不追溯清理，快照與移除 ID 不可偽造', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize();
    await writeFile(join(f.project, 'tests/api/Unknown.spec.ts'), '// 沒有來源的案例');
    const old = await f.workspace.scan();
    await f.workspace.generate({ scanId: old.scanId, ids: old.requests.map(row => row.id) });
    const managed = join(f.project, 'tests/api/GetCard.spec.ts');
    const content = await readFile(managed, 'utf8');
    await writeFile(managed, content.replace('archify-id', 'manual-id'));
    await unlink(join(f.source, 'src/cards.gql'));
    const scan = await f.workspace.scan(); assert.deepEqual(scan.removed, []);
    await assert.rejects(() => f.workspace.archiveRemoved({ scanId: old.scanId, ids: ['invalid'] }), /分析已失效/);
    await assert.rejects(() => f.workspace.archiveRemoved({ scanId: scan.scanId, ids: [old.requests[0].id] }), /不屬於/);
    assert.equal(await readFile(join(f.project, 'tests/api/Unknown.spec.ts'), 'utf8'), '// 沒有來源的案例');
  } finally { await f.dispose(); }
});
