import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, request } from './test-support.mjs';
import { scriptEvidence, caseEvidence } from '../../test-project/support/script-evidence.mjs';
import { createHandler } from './plugin.mjs';
import { renderHtml } from '../../test-project/framework/journey-report.mjs';
import { validateCatalog } from './catalog.mjs';
import { intentHash } from '../../test-project/support/script-evidence.mjs';

test('序列互動保持選填、驗證安全來源且納入案例版本', () => {
  const row = { id:'TC-SEQUENCE', featureId:'F-SEQ', title:'登入', kind:'flow', purpose:'核對順序', preconditions:'無', data:'無', expected:'成功', knowledgeIds:[], questions:[], steps:[{action:'登入請求',expected:'回傳結果'}] };
  const catalog = {schemaVersion:1,features:[{id:'F-SEQ',name:'登入',sources:[]}],cases:[row]};
  assert.equal(validateCatalog(catalog), catalog);
  const previous = intentHash(row);
  row.steps[0].interaction = {from:'前端',to:'API',source:{path:'src/login.ts',line:12}};
  assert.equal(validateCatalog(catalog), catalog);
  assert.notEqual(intentHash(row), previous);
  for (const source of [{path:'../outside.ts',line:1},{path:'.env',line:1},{path:'src/a.ts',line:0},{path:'C:/secret.ts',line:1}]) {
    assert.throws(() => validateCatalog({...catalog,cases:[{...row,steps:[{...row.steps[0],interaction:{from:'前端',to:'API',source}}]}]}), /互動來源/);
  }
  assert.throws(() => validateCatalog({...catalog,cases:[{...row,steps:[{...row.steps[0],interaction:{from:'',to:'API',source:{path:'src/a.ts',line:1}}}]}]}), /互動來源/);
});

test('案例／知識／來源關聯不執行腳本，版本依賴更新不沿用舊通過', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize(); const scan = await f.workspace.scan();
    await f.workspace.generate({ scanId: scan.scanId, ids: scan.requests.map(row => row.id) });
    const imported = await f.workspace.importKnowledge([{ name: '登入規則.md', content: '登入需有效測試帳號', category: 'business', featureIds: ['F-LOGIN'] }]);
    const doc = imported.created[0];
    const spec = "import {test} from '@playwright/test';\nimport {callApi} from '../../api/GetCard.js';\nthrow new Error('DO_NOT_EXECUTE_CATALOG');\ntest('讀名片',{annotation:[{type:'archify-case',description:'TC-ONE'}]},async()=>{await test.step('讀取名片',async()=>{});});";
    await writeFile(join(f.project, 'tests/flows/Card.spec.ts'), spec);
    let view = await f.workspace.catalog();
    assert.ok(view.unlinkedScripts.includes('tests/flows/Card.spec.ts'));
    const record = { id: 'TC-ONE', featureId: 'F-LOGIN', title: '登入後讀取', kind: 'flow', purpose: '驗證登入後資料', preconditions: '測試帳號', data: '測試名片', expected: '回傳指定名片', knowledgeIds: [doc.id], questions: [{ text: '誰能讀取？', answer: '' }] };
    await f.workspace.saveCatalog({ revision: view.revision, catalog: { schemaVersion: 1, features: [{ id: 'F-LOGIN', name: '登入', sources: [] }], cases: [record] } });
    view = await f.workspace.catalog();
    assert.equal(view.cases[0].script, 'tests/flows/Card.spec.ts');
    assert.equal(view.cases[0].declaredSteps[0], '讀取名片');
    assert.ok(view.cases[0].apis.some(api => api.name === 'GetCard' && api.evidence.length));
    assert.equal(view.cases[0].freshness, 'never');
    assert.ok(view.cases[0].issues.some(issue => issue.text === '誰能讀取？'));
    const evidence = scriptEvidence(f.project, 'tests/flows/Card.spec.ts');
    assert.equal(evidence.complete, true, JSON.stringify(evidence.issues));
    await mkdir(join(f.project, 'reports'), { recursive: true });
    await writeFile(join(f.project, 'reports/report-synthetic.json'), JSON.stringify({ kind: 'execution', createdAt: new Date().toISOString(), cases: [{ caseId: 'TC-ONE', source: 'tests/flows/Card.spec.ts', status: 'passed', scriptEvidence: evidence, caseEvidence: caseEvidence(f.project, 'tests/flows/Card.spec.ts', 'TC-ONE') }] }));
    view = await f.workspace.catalog(); assert.equal(view.cases[0].freshness, 'current');
    const single={schemaVersion:1,kind:'execution',project:'合成單檔歷史',runId:'abcdef12-3456',createdAt:new Date(Date.now()+1000).toISOString(),cases:[{id:'TC-ONE',caseId:'TC-ONE',name:'單檔案例',purpose:'歷史追蹤',source:'tests/flows/Card.spec.ts',sourceHash:evidence.hash,status:'passed',steps:[{name:'讀取名片',expected:'合成',status:'passed'}],scriptEvidence:evidence,caseEvidence:caseEvidence(f.project,'tests/flows/Card.spec.ts','TC-ONE')}]};
    await writeFile(join(f.project,'reports/report-single.html'),renderHtml(single));
    assert.deepEqual((await f.workspace.catalog()).cases[0].latest.steps, [{name:'讀取名片',status:'passed'}]);
    view=await f.workspace.catalog();assert.equal(view.cases[0].latest.report,'report-single.html');assert.equal(view.cases[0].freshness,'current');
    await writeFile(join(f.source, 'src/cards.gql'), 'query GetCard($id: ID!) { card(id:$id) { id } }\n# source changed');
    view = await f.workspace.catalog(); assert.ok(view.cases[0].issues.some(issue => issue.text.includes('前端來源在上次分析後已變更')));
    const apiFile = join(f.project, 'api/GetCard.ts'); await writeFile(apiFile, (await readFile(apiFile, 'utf8')) + '\n// request changed');
    view = await f.workspace.catalog(); assert.equal(view.cases[0].freshness, 'changed'); assert.equal(view.cases[0].latest.status, 'passed');
    const updatedDoc = await f.workspace.updateKnowledge({ id: doc.id, title: doc.title, expectedHash: doc.hash, content: '只允許指定角色讀取', category: 'business', featureIds: ['F-LOGIN'] });
    view = await f.workspace.catalog(); assert.ok(view.cases[0].issues.some(issue => issue.type === 'knowledge'));
    await assert.rejects(() => f.workspace.updateKnowledge({ id: doc.id, title: doc.title, expectedHash: doc.hash, content: 'stale' }), /其他工具修改/);
    await rename(join(f.project, 'tests/flows/Card.spec.ts'), join(f.project, 'tests/flows/Renamed.spec.ts'));
    view = await f.workspace.catalog(); assert.equal(view.cases[0].script, 'tests/flows/Renamed.spec.ts');
    const current = view.revision;
    await f.workspace.saveCatalog({ revision: current, catalog: { ...view.catalog, cases: view.catalog.cases.map(row => ({ ...row, questions: [{ text: '誰能讀取？', answer: '指定角色' }] })) } });
    await assert.rejects(() => f.workspace.saveCatalog({ revision: current, catalog: view.catalog }), /其他工具修改/);
    view = await f.workspace.catalog(); assert.ok(!view.cases[0].issues.some(issue => issue.type === 'knowledge'));
    assert.equal((await f.workspace.knowledgeDocument(updatedDoc.id)).category, 'business');
    assert.ok((await f.workspace.catalogSource({ scope: 'source', path: 'src/api.ts' })).content.includes('DO_NOT_EXECUTE_SOURCE'));
    await assert.rejects(() => f.workspace.catalogSource({ scope: 'source', path: '../.env' }));
    await assert.rejects(() => f.workspace.catalogSource({ scope: 'project', path: 'support/bff.mjs' }));
    await writeFile(join(f.project, `knowledge/documents/${doc.id}.md`), '本機 AI 更新的內容');
    const restoredContent = await f.workspace.importKnowledge([{ name: '原規則.md', content: '只允許指定角色讀取' }]);
    assert.equal(restoredContent.created.length, 1, '去重應使用實體內容，不可沿用外部修改前的舊 hash');
  } finally { await f.dispose(); }
});

test('舊報告、動態依賴與重複案例不能冒認最新版驗證，HTTP 維持 session 限制', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize();
    const source = "import { test } from '@playwright/test'; test('one',{annotation:[{type:'archify-case',description:'TC-DUP'}]},async()=>{await import('./dynamic.js');});";
    await writeFile(join(f.project, 'tests/api/One.spec.ts'), source);
    await writeFile(join(f.project, 'tests/api/Two.spec.ts'), source);
    let view = await f.workspace.catalog();
    const row = { id: 'TC-DUP', featureId: 'F-DUP', title: 'duplicate', kind: 'api', purpose: '', preconditions: '', data: '', expected: '', knowledgeIds: [], questions: [] };
    const catalog = { schemaVersion: 1, features: [{ id: 'F-DUP', name: '功能', sources: [] }], cases: [row] };
    const handler = createHandler(f.workspace, 'test-session');
    assert.equal((await request(handler, '/local-api/catalog-save', { revision: view.revision, catalog }, { headers: { 'x-archify-session': 'wrong' } })).status, 403);
    assert.equal((await request(handler, '/local-api/catalog-save', { revision: view.revision, catalog })).status, 200);
    view = await f.workspace.catalog(); assert.ok(view.cases[0].issues.some(issue => issue.type === 'duplicate'));
    assert.equal(scriptEvidence(f.project, 'tests/api/One.spec.ts').complete, false);
    await mkdir(join(f.project, 'reports'), { recursive: true });
    await writeFile(join(f.project, 'reports/report-old.json'), JSON.stringify({ kind: 'execution', createdAt: new Date().toISOString(), cases: [{ caseId: 'TC-DUP', source: 'tests/api/One.spec.ts', sourceHash: 'a'.repeat(64), status: 'passed' }] }));
    view = await f.workspace.catalog(); assert.equal(view.cases[0].freshness, 'unknown');
    await assert.rejects(() => f.workspace.saveCatalog({ revision: view.revision, catalog: { ...catalog, cases: [{ ...row, script: '../escape.spec.ts' }] } }));
  } finally { await f.dispose(); }
});

test('案例目錄驗證與保留 factor 測試因子及 decisionTable 決策矩陣表', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize();
    let view = await f.workspace.catalog();
    const row = {
      id: 'TC-MATRIX', featureId: 'F-REG', title: '【註冊-邊界】欄位驗證矩陣', kind: 'flow', target: 'web',
      factor: 'boundary', decisionTable: [{ point: '用戶名過短', input: 'user', expected: '提示長度不可少於 6 位' }],
      purpose: '集中驗證邊界條件', preconditions: '已位於註冊頁', data: '其餘填寫合法預設值', expected: '顯示對應錯誤訊息',
      steps: [{ action: '輸入合法密碼', data: '123456', expected: '' }, { action: '輸入非法用戶名並點擊註冊', data: 'user', expected: '表單阻擋並顯示紅字提示' }], cleanup: '不需清理',
      knowledgeIds: [], questions: [],
    };
    const catalog = { schemaVersion: 1, features: [{ id: 'F-REG', name: '註冊帳號', sources: [], frontend: { description: '註冊', pageIds: [], apiIds: [], questions: [], evidence: 'code', state: 'active', level: 4 } }], cases: [row] };
    await f.workspace.saveCatalog({ revision: view.revision, catalog });
    view = await f.workspace.catalog();
    assert.equal(view.cases[0].factor, 'boundary');
    assert.equal(view.cases[0].steps[0].data, '123456');
    assert.equal(view.cases[0].decisionTable[0].point, '用戶名過短');
    assert.equal(view.catalog.features[0].frontend.level, 4);
    await assert.rejects(() => f.workspace.saveCatalog({ revision: view.revision, catalog: { ...catalog, cases: [{ ...row, factor: 'unknown' }] } }));
    await assert.rejects(() => f.workspace.saveCatalog({ revision: view.revision, catalog: { ...catalog, cases: [{ ...row, steps: [{ action: 'x', data: 123, expected: '' }] }] } }));
    await assert.rejects(() => f.workspace.saveCatalog({ revision: view.revision, catalog: { ...catalog, cases: [{ ...row, decisionTable: [{ point: 'x', input: 'y' }] }] } }));
  } finally { await f.dispose(); }
});
