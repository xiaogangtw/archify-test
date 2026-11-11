import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fixture, request } from './test-support.mjs';
import { createHandler } from './plugin.mjs';
import { intentHash } from '../../test-project/support/script-evidence.mjs';

test('案例規劃先補資料才可確認，步驟／知識／來源更新使確認失效；CLI 唯讀且版本一致', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize();
    const doc = (await f.workspace.importKnowledge([{ name: '規則.md', content: '預覽文字為會員', category: 'business' }])).created[0];
    const handler = createHandler(f.workspace, 'test-session');
    let view = await f.workspace.catalog();
    const row = { id: 'TC-MENU', featureId: 'F-MENU', title: '點會員入口', kind: 'flow', purpose: '檢查訊息文字', preconditions: '已加入測試帳號', data: '測試選單', expected: '顯示會員', steps: [], cleanup: '不需清理', target: 'mobile', questions: [{ text: '哪個入口？', answer: '' }], knowledgeIds: [doc.id] };
    await f.workspace.saveCatalog({ revision: view.revision, catalog: { schemaVersion: 1, features: [{ id: 'F-MENU', name: '會員選單', sources: [{ path: 'src/api.ts', line: 1 }] }], cases: [row] } });
    view = await f.workspace.catalog();
    const input = () => ({ id: row.id, revision: view.revision, fingerprint: view.cases[0].review.fingerprint });
    assert.equal(view.cases[0].review.status, 'incomplete');
    await assert.rejects(() => f.workspace.confirmCase(input()), /步驟|問題/);
    assert.equal((await request(handler, '/local-api/case-confirm', input(), { headers: { 'x-archify-session': 'wrong' } })).status, 403);
    row.questions[0].answer = '測試選單左上角'; row.steps = [{ action: '點左上角會員入口', expected: '收到會員訊息' }];
    await f.workspace.saveCatalog({ revision: view.revision, catalog: { ...view.catalog, cases: [row] } });
    view = await f.workspace.catalog(); assert.equal(view.cases[0].review.status, 'pending');
    const cli = () => spawnSync(process.execPath, ['support/case-plan-cli.mjs', row.id, '--review'], { cwd: f.project, encoding: 'utf8' });
    assert.equal(cli().status, 1);
    const ready=spawnSync(process.execPath,['support/case-plan-cli.mjs',row.id],{cwd:f.project,encoding:'utf8'});
    assert.equal(ready.status,0,ready.stderr);assert.equal(JSON.parse(ready.stdout).status,'ready');
    const snapshot=await readFile(join(f.project,'test-cases/catalog.json'),'utf8');
    assert.equal((await request(handler,'/local-api/case-plans',{})).status,200);
    assert.equal((await f.workspace.casePlans()).catalog.cases[0].id,row.id);
    assert.equal(await readFile(join(f.project,'test-cases/catalog.json'),'utf8'),snapshot);
    assert.equal((await request(handler,'/local-api/case-plans',{}, {headers:{'x-archify-session':'wrong'}})).status,403);
    assert.equal((await request(handler, '/local-api/case-confirm', input())).status, 200);
    view = await f.workspace.catalog(); assert.equal(view.cases[0].review.status, 'confirmed'); assert.equal(cli().status, 0, cli().stderr);
    const oldIntent = intentHash(row), previous = input();
    row.steps[0].expected = '收到會員文字與按鈕';
    assert.notEqual(intentHash(row), oldIntent);
    // Simulate a local AI writing the catalog directly, bypassing the website save.
    await writeFile(join(f.project, 'test-cases/catalog.json'), JSON.stringify({ ...view.catalog, cases: [row] }));
    view = await f.workspace.catalog(); assert.equal(view.cases[0].review.status, 'changed'); assert.equal(cli().status, 1);
    await assert.rejects(() => f.workspace.confirmCase(previous), /其他工具修改/);
    await f.workspace.confirmCase(input()); view = await f.workspace.catalog();
    const staleKnowledge = input();
    await writeFile(join(f.project, `knowledge/documents/${doc.id}.md`), '預期文字改為我的會員');
    assert.equal((await f.workspace.catalog()).cases[0].review.status, 'changed'); assert.equal(cli().status, 1);
    await assert.rejects(() => f.workspace.confirmCase(staleKnowledge), /知識已變更/);
    view = await f.workspace.catalog(); await f.workspace.confirmCase(input());
    await writeFile(join(f.source, 'src/api.ts'), (await readFile(join(f.source, 'src/api.ts'), 'utf8')) + '\n// changed');
    view = await f.workspace.catalog(); assert.equal(view.cases[0].review.status, 'changed');
    await assert.rejects(() => f.workspace.confirmCase(input()), /前端來源/);
    await assert.rejects(() => f.workspace.confirmCase({ ...input(), id: '../escape' }), /識別碼/);
    await assert.rejects(() => f.workspace.saveCatalog({ revision: view.revision, catalog: { ...view.catalog, cases: [{ ...row, steps: [{ action: 'x', expected: 1 }] }] } }), /步驟/);
  } finally { await f.dispose(); }
});
