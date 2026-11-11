import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { loadConfig } from './config.mjs';
import { createWorkspace } from './workspace.mjs';
import { createHandler } from './plugin.mjs';
import { noLinks } from './paths.mjs';

import {fixture,request} from './test-support.mjs';
import { operationStems } from './naming.mjs';
import { renameLegacyArtifacts } from './rename-artifacts.mjs';

test('新專案內建型別檢查，生成稿與 BFF 可用且錯誤會被攔截', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize();
    const scan = await f.workspace.scan();
    await f.workspace.generate({ scanId: scan.scanId, ids: scan.requests.map(item => item.id) });
    await f.attachDependencies();
    const pkg = JSON.parse(await readFile(join(f.project, 'package.json'), 'utf8'));
    assert.equal(pkg.scripts['check:types'], 'tsc --noEmit');
    assert.ok(pkg.devDependencies.typescript && pkg.devDependencies['@types/node']);
    const check = () => spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit'], { cwd: f.project, encoding: 'utf8' });
    await writeFile(join(f.project, 'tests/api/type-check.spec.ts'), `import { randomUUID } from 'node:crypto';
import { bffHeaders, bffUrl, resolveData } from '../../support/bff.mjs';
const body = resolveData({ variables: { request: { useNonMobile: true } } });
const enabled: boolean = body.variables.request.useNonMobile;
const headers: Record<string, string> = bffHeaders({}, { satoken: null });
const url: string = bffUrl('/graphql');
const device: string = randomUUID() + process.platform;
`);
    const valid = check(); assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    await writeFile(join(f.project, 'tests/api/type-check.spec.ts'), 'const invalid: boolean = "true";\n');
    const invalid = check(); assert.notEqual(invalid.status, 0);
    assert.match(invalid.stdout, /TS2322/);
  } finally { await f.dispose(); }
});

test('重疊分析讀取合併且等待寫入，重複寫入仍拒絕，失敗後可重試', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize();
    const first = await f.workspace.scan();
    const handler = createHandler(f.workspace, 'test-session');
    const reads = await Promise.all(Array.from({ length: 6 }, () => request(handler, '/local-api/analysis', {})));
    assert.ok(reads.every(result => result.status === 200 && result.body.scanId === first.scanId));
    const writing = f.workspace.scan();
    const waiting = f.workspace.analysis();
    await assert.rejects(() => f.workspace.scan(), /另一項檔案操作/);
    const next = await writing;
    assert.equal((await waiting).scanId, next.scanId, 'read observes completed write');
    const failed = f.workspace.scan({ apiDir: '../outside' });
    const afterFailure = f.workspace.analysis();
    await assert.rejects(() => failed);
    assert.equal((await afterFailure).scanId, next.scanId);
    const broken = createWorkspace({ ...f.config, projectRoot: '' });
    await assert.rejects(() => broken.analysis(), /請先使用初始設定/);
    await assert.rejects(() => broken.analysis(), /請先使用初始設定/);
  } finally { await f.dispose(); }
});

test('來源唯讀掃描、去重、遮蔽與獨立測試專案往返', async () => {
  const f = await fixture();
  try {
    const before = await readFile(join(f.source, 'src/api.ts'), 'utf8');
    assert.equal((await f.workspace.describe()).initialized, false);
    await f.workspace.initialize();
    const androidSkill=await readFile(join(f.project,'skills/setup-android/SKILL.md'),'utf8');assert.equal(androidSkill,await readFile(new URL('../../test-project/skills/setup-android/SKILL.md',import.meta.url),'utf8'));assert.match(androidSkill,/Google Play/);
    await writeFile(join(f.project,'skills/setup-android/SKILL.md'),androidSkill+'\n本機補充保留。');await f.workspace.initialize();assert.equal(await readFile(join(f.project,'skills/setup-android/SKILL.md'),'utf8'),androidSkill+'\n本機補充保留。');
    const result = await f.workspace.scan();
    assert.equal(result.requests.length, 3);
    assert.ok(!JSON.stringify(result).includes('DO_NOT_'));
    assert.ok(result.requests.find(item => item.kind === 'graphql').body.variables.id.includes('{{'));
    assert.equal(result.requests.find(item => item.method === 'GET').evidence.length, 2);
    const generated = await f.workspace.generate({ scanId: result.scanId, ids: result.requests.map(item => item.id) });
    assert.equal(generated.created.length, 3);
    assert.ok(generated.created.some(path => path.endsWith('/GetCard.spec.ts')));
    const original = await readFile(join(f.project, generated.created[0]), 'utf8');
    const repeat = await f.workspace.generate({ scanId: result.scanId, ids: result.requests.map(item => item.id) });
    assert.equal(repeat.created.length, 0); assert.equal(repeat.skipped.length, 3);
    assert.equal(await readFile(join(f.project, generated.created[0]), 'utf8'), original);
    assert.equal(await readFile(join(f.source, 'src/api.ts'), 'utf8'), before);
    const restored = createWorkspace(f.config);
    const restoredAnalysis = await restored.analysis();
    assert.equal(restoredAnalysis.scanId, result.scanId);
    assert.equal(restoredAnalysis.existingIds.length, 3);
    await f.attachDependencies();
    const flow = spawnSync(process.execPath, ['support/commands.mjs', 'flow'], { cwd: f.project, encoding: 'utf8' });
    assert.equal(flow.status, 0, flow.stderr);
    const draft = spawnSync(process.execPath, [join(f.project, 'node_modules/@playwright/test/cli.js'), 'test'], { cwd: f.project, encoding: 'utf8' });
    assert.equal(draft.status, 0, draft.stdout + draft.stderr);
    const files = await f.workspace.reports(); assert.equal(files.length, 2);
    const report = await f.workspace.report(files.find(item => /(^|\/)report-/.test(item.name)).name);
    assert.equal(report.cases.every(item => item.status === 'skipped'), true);
    const packageJson = await readFile(join(f.project, 'package.json'), 'utf8');
    assert.ok(!packageJson.includes('control-api') && !packageJson.includes('file:'));
    const custom = await loadConfig(f.platform, { ARCHIFY_SOURCE_DIR: f.source, ARCHIFY_TEST_PROJECT_DIR: join(f.root, 'custom-project'), ARCHIFY_REPORT_DIR: 'artifacts/reports' });
    await createWorkspace(custom).initialize();
    assert.ok((await readFile(join(custom.projectRoot, '.gitignore'), 'utf8')).includes('/artifacts/reports/'));
  } finally { await f.dispose(); }
});
test('操作命名處理碰撞與舊 ID 檔名遷移，保留內容與內部 ID', async () => {
  const names = operationStems([{ id: 'aaaaaaaaaaaaaaaaaaaa', operationName: 'GetCard' }, { id: 'bbbbbbbbbbbbbbbbbbbb', operationName: 'getcard' }]);
  assert.equal(names.get('aaaaaaaaaaaaaaaaaaaa'), 'GetCard-aaaaaaaa');
  const f = await fixture();
  try {
    await f.workspace.initialize(); const scan = await f.workspace.scan();
    await f.workspace.generate({ scanId: scan.scanId, ids: scan.requests.map(item => item.id) });
    assert.equal((await renameLegacyArtifacts(f.config, scan)).files, 0);
    const item = scan.requests.find(row => row.kind === 'graphql');
    await mkdir(join(f.project, 'requests/generated'), {recursive:true});
    await mkdir(join(f.project, 'fixtures/api'), {recursive:true});
    await writeFile(join(f.project,'requests/generated/'+item.id+'.json'), JSON.stringify(item));
    await writeFile(join(f.project,'fixtures/api/'+item.id+'.json'), '{}');
    await writeFile(join(f.project,'tests/api/'+item.id+'.case.mjs'), 'import request from "../../requests/generated/'+item.id+'.json" with {type:"json"};\nimport fixture from "../../fixtures/api/'+item.id+'.json" with {type:"json"};\nexport const id = "API-'+item.id+'";');
    const moved = await renameLegacyArtifacts(f.config, scan, true); assert.equal(moved.cases, 1);
    const source = await readFile(join(f.project, 'tests/api/GetCard.case.mjs'), 'utf8');
    assert.ok(source.includes('API-' + item.id)); assert.ok(source.includes('generated/GetCard.json'));
  } finally { await f.dispose(); }
});
test('目錄邊界、連結、衝突與無效版本均拒絕，不覆寫框架', async () => {
  const f = await fixture();
  try {
    await assert.rejects(loadConfig(f.platform, { ARCHIFY_SOURCE_DIR: f.source, ARCHIFY_TEST_PROJECT_DIR: join(f.source, 'tests') }), /互相包含/);
    await assert.rejects(loadConfig(f.platform, { ARCHIFY_TEST_PROJECT_DIR: join(f.platform, 'tests') }), /獨立/);
    await assert.rejects(f.workspace.folders('../'), /不可離開/);
    await mkdir(f.project); await writeFile(join(f.project, 'package.json'), 'KEEP_USER_CONTENT');
    await assert.rejects(f.workspace.initialize(), /既有檔案/);
    assert.equal(await readFile(join(f.project, 'package.json'), 'utf8'), 'KEEP_USER_CONTENT');
    const link = join(f.root, 'linked'); await symlink(f.source, link, 'junction');
    await assert.rejects(noLinks(join(link, 'src')), /連結/);
    await assert.rejects(f.workspace.scan({ apiDir: '../outside' }));
  } finally { await f.dispose(); }
});
test('本機 HTTP 邊界：同來源與 session，限制操作與 report 名稱', async () => {
  const f = await fixture();
  try {
    const handler = createHandler(f.workspace, 'test-session');
    assert.equal((await request(handler, '/local-api/config', undefined, { method: 'GET' })).status, 200);
    assert.equal((await request(handler, '/local-api/initialize', {}, { headers: { origin: 'https://evil.example' } })).status, 403);
    assert.equal((await request(handler, '/local-api/initialize', {}, { headers: { host: 'evil.example' } })).status, 403);
    assert.equal((await request(handler, '/local-api/initialize', {}, { headers: { 'x-archify-session': '' } })).status, 403);
    assert.equal((await request(handler, '/local-api/initialize', {})).status, 200);
    const scan = await request(handler, '/local-api/scan', {}); assert.equal(scan.status, 200);
    assert.equal((await request(handler, '/local-api/generate', { scanId: 'stale', ids: [scan.body.requests[0].id] })).status, 400);
    assert.equal((await request(handler, '/local-api/report', { name: '../../.env' })).status, 400);
  } finally { await f.dispose(); }
});
