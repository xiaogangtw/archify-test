import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { operationStems, operationTitle, legacyOperationStems } from './naming.mjs';
import { fixture } from './test-support.mjs';

test('通用 GraphQL 名稱採實際頂層欄位，保留有意義名稱並處理真正碰撞', () => {
  const card = { id: 'a'.repeat(20), kind: 'graphql', name: 'Query', operationName: 'Query', body: { query: 'query Query { alias: checkCard }' } };
  const mobile = { ...card, id: 'b'.repeat(20), body: { query: 'query Query { ...Root } fragment Root on Query { checkMobile }' } };
  const names = operationStems([card, mobile]);
  assert.equal(names.get(card.id), 'CheckCard'); assert.equal(names.get(mobile.id), 'CheckMobile');
  assert.equal(operationTitle(card), 'CheckCard');
  assert.equal(legacyOperationStems([card, mobile]).get(card.id), 'Query-aaaaaaaa');
  assert.equal(operationStems([{ ...card, operationName: 'FindCard' }]).get(card.id), 'FindCard');
  assert.equal(operationStems([{ ...card, operationName: '', body: { query: '{ checkCard checkMobile }' } }]).get(card.id), 'CheckCardAndCheckMobile');
  const duplicate = { ...mobile, operationName: 'CheckCard' };
  assert.equal(operationStems([card, duplicate]).get(card.id), 'CheckCard-aaaaaaaa');
});

test('產生器辨識舊 Query 檔避免重複；新檔改名但 query、operationName 與 ID 不變', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize();
    await writeFile(join(f.source, 'src/cards.gql'), 'query Query { checkCard }');
    const scan = await f.workspace.scan(), item = scan.requests.find(row => row.kind === 'graphql');
    const old = join(f.project, 'tests/api/Query.spec.ts'); await writeFile(old, '// existing user content');
    const recovered = await f.workspace.analysis(); assert.ok(recovered.existingIds.includes(item.id));
    assert.equal(recovered.requests.find(row => row.id === item.id).name, 'CheckCard');
    assert.equal((await f.workspace.generate({ scanId: scan.scanId, ids: [item.id] })).created.length, 0);
    assert.equal(await readFile(old, 'utf8'), '// existing user content');
    await unlink(old);
    const made = await f.workspace.generate({ scanId: scan.scanId, ids: [item.id] }); assert.deepEqual(made.created, ['tests/api/CheckCard.spec.ts']);
    const source = await readFile(join(f.project, made.created[0]), 'utf8');
    const api = await readFile(join(f.project, 'api/CheckCard.ts'), 'utf8');
    assert.match(api, /query Query/); assert.match(api, /"operationName": "Query"/);
    assert.ok(source.includes('API-' + item.id)); assert.match(source, /test.skip\("CheckCard"/);
  } finally { await f.dispose(); }
});
