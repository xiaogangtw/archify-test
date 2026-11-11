import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { fixture } from './test-support.mjs';
import { apiModuleSource } from './api-source.mjs';
import { splitApiSource, planReusableApiMigration, applyReusableApiMigration } from './reusable-api-migration.mjs';

test('同一 API 可被單支與流程重用，明確傳 token／variables，無額外測試或狀態污染', async () => {
  const f = await fixture(), received = [];
  const server = createServer((req, res) => {
    let text = ''; req.on('data', part => { text += part; }); req.on('end', () => {
      const body = JSON.parse(text); received.push({ body, token: req.headers.satoken });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ data: body.operationName === 'Login' ? { token: 'synthetic-flow-token' } : { cardId: body.variables.id } }));
    });
  });
  try {
    await f.workspace.initialize();
    assert.ok((await lstat(join(f.project, 'tests/flows'))).isDirectory());
    await assert.rejects(() => lstat(join(f.project, 'tests/example.case.mjs')), { code: 'ENOENT' });
    const scan = await f.workspace.scan();
    const generated = await f.workspace.generate({ scanId: scan.scanId, ids: scan.requests.map(item => item.id) });
    assert.equal(generated.apiModules.length, generated.created.length);
    await f.attachDependencies();
    const item = { kind: 'graphql', method: 'POST', endpoint: '{{BASE_URL}}', headers: {}, queryParams: {}, body: { query: 'query Card($id: ID!) { card(id:$id) { id } }', operationName: 'Card', variables: { id: '{{cardId}}' } } };
    await writeFile(join(f.project, 'api/Card.ts'), apiModuleSource(item));
    await writeFile(join(f.project, 'api/Login.ts'), apiModuleSource({ ...item, body: { query: 'mutation Login { login { token } }', operationName: 'Login', variables: {} } }));
    await writeFile(join(f.project, 'tests/flows/CardFlow.spec.ts'), `import { test, expect } from '@playwright/test';
import { callApi as login } from '../../api/Login.js';
import { callApi as card, operation } from '../../api/Card.js';
test('flow', async ({ request }) => {
 const original = JSON.stringify(operation);
 const response = await test.step('登入', () => login(request, { headers: {satoken: null} }));
 const token = (await response.json()).data.token;
 const first = await test.step('讀取名片', () => card(request, { variables: {id: 'card-a'}, headers: {satoken: token} }));
 expect((await first.json()).data.cardId).toBe('card-a');
 const second = await test.step('確認另一筆資料', () => card(request, {values: {cardId: 'card-b'}, headers: {satoken: token}}));
 expect((await second.json()).data.cardId).toBe('card-b');
 expect(JSON.stringify(operation)).toBe(original);
});`);
    await writeFile(join(f.project, 'tests/api/CardSingle.spec.ts'), `import {test,expect} from '@playwright/test';
import {callApi as card} from '../../api/Card.js';
test('single', async ({request}) => { const r=await card(request,{variables:{id:'single'}}); expect((await r.json()).data.cardId).toBe('single'); });`);
    await writeFile(join(f.project, 'test-cases/catalog.json'), JSON.stringify({ schemaVersion: 1, features: [{ id: 'F-CARD', name: '測試名片', sources: [] }], cases: [{ id: 'TC-FLOW', featureId: 'F-CARD', title: 'flow', kind: 'flow', purpose: '測試替身流程', preconditions: '', data: '', expected: '指定 cardId', script: 'tests/flows/CardFlow.spec.ts', knowledgeIds: [], questions: [] }] }));
    const typeCheck = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { cwd: f.project, encoding: 'utf8' });
    assert.equal(typeCheck.status, 0, typeCheck.stdout + typeCheck.stderr);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const { spawn } = await import('node:child_process');
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', 'CardFlow.spec.ts', 'CardSingle.spec.ts'], { cwd: f.project, windowsHide: true, env: { ...process.env, BFF_BASE_URL: `http://127.0.0.1:${server.address().port}/graphql` } });
      let output = ''; child.stdout.on('data', part => { output += part; }); child.stderr.on('data', part => { output += part; });
      child.on('error', reject); child.on('close', code => resolve({ code, output }));
    });
    assert.equal(result.code, 0, result.output);
    assert.equal(received.length, 4);
    assert.deepEqual(received.filter(row => row.token).map(row => row.body.variables.id), ['card-a', 'card-b']);
    const report = await f.workspace.report((await f.workspace.reports())[0].name);
    assert.equal(report.cases.length, 2, 'API 模組匯入不能註冊額外測試');
    assert.ok(report.cases.every(item => item.status === 'passed'));
    const flowEvidence = report.cases.find(item => item.caseId === 'TC-FLOW');
    assert.equal(flowEvidence.caseEvidence.complete, true);
    assert.equal(flowEvidence.scriptEvidence.complete, true);
    assert.ok(!JSON.stringify(report).includes('synthetic-flow-token'));
  } finally { server.closeAllConnections(); if (server.listening) await new Promise(resolve => server.close(resolve)); await f.dispose(); }
});

test('配對生成保留碰撞檔，遷移保留資料、斷言與備份並拒絕過期來源', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize(); const scan = await f.workspace.scan();
    await writeFile(join(f.project, 'api/GetCard.ts'), '// manual API');
    const generated = await f.workspace.generate({ scanId: scan.scanId, ids: [scan.requests.find(item => item.kind === 'graphql').id] });
    assert.equal(generated.created.length, 0); assert.equal(await readFile(join(f.project, 'api/GetCard.ts'), 'utf8'), '// manual API');
    const original = `import {test,expect} from '@playwright/test';\nexport const operation={kind:'graphql',method:'POST',endpoint:'{{BASE_URL}}',headers:{},queryParams:{},body:{query:\`query Q { card }\`,variables:{id:'user-data'}}};\ntest('manual',async()=>{expect(operation.body.variables.id).toBe('user-data');});`;
    await writeFile(join(f.project, 'tests/api/Manual.spec.ts'), original);
    await writeFile(join(f.project, 'tests/api/Dynamic.spec.ts'), 'export const operation=makeOperation();');
    let plan = await planReusableApiMigration(f.config);
    assert.equal(plan.rows.length, 1); assert.equal(plan.skipped.length, 1);
    await writeFile(join(f.project, 'tests/api/Manual.spec.ts'), original + '\n// changed');
    await assert.rejects(() => applyReusableApiMigration(f.config, plan), /已變更/);
    await writeFile(join(f.project, 'tests/api/Manual.spec.ts'), original);
    plan = await planReusableApiMigration(f.config);
    const result = await applyReusableApiMigration(f.config, plan);
    assert.equal(result.migrated, 1);
    assert.equal(await readFile(join(f.project, result.archive, 'tests/api/Manual.spec.ts'), 'utf8'), original);
    const migrated = await readFile(join(f.project, 'tests/api/Manual.spec.ts'), 'utf8');
    assert.ok(migrated.includes("expect(operation.body.variables.id).toBe('user-data')"));
    assert.ok((await readFile(join(f.project, 'api/Manual.ts'), 'utf8')).includes("id:'user-data'"));
    assert.equal((await planReusableApiMigration(f.config)).rows.length, 0);
    assert.throws(() => splitApiSource('export const operation={body: userData};', '../../api/X.js'), /動態/);
  } finally { await f.dispose(); }
});
