import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './test-support.mjs';
import { planPlaywrightMigration, applyPlaywrightCases } from './playwright-migration.mjs';

function run(project, env, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(project, 'node_modules/@playwright/test/cli.js'), 'test', ...args], { cwd: project, env: { ...process.env, ...env }, windowsHide: true });
    let output = ''; child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
    child.on('error', reject); child.on('close', code => resolve({ code, output }));
  });
}
test('真實 Playwright 單檔請求、原生斷言、略過與報告，保留遷移資料', async () => {
  const f = await fixture();
  const received = [];
  const server = createServer((req, res) => {
    let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => {
      received.push(JSON.parse(body)); res.setHeader('Content-Type', 'application/json'); res.end('{"data":{"card":{"id":7}}}');
    });
  });
  try {
    await f.workspace.initialize(); const scan = await f.workspace.scan();
    const item = scan.requests.find(row => row.kind === 'graphql');
    const settings = { enabled: true, allowWrite: false, variables: { id: 7 }, headers: {}, expectedStatus: 200, assertions: [{ path: 'data.card.id', operator: 'equals', value: '{{id}}' }] };
    await mkdir(join(f.project, 'requests/generated'), { recursive: true }); await mkdir(join(f.project, 'fixtures/api'), { recursive: true });
    await writeFile(join(f.project, 'requests/generated/GetCard.json'), JSON.stringify(item));
    await writeFile(join(f.project, 'fixtures/api/GetCard.json'), JSON.stringify(settings));
    await writeFile(join(f.project, 'tests/api/GetCard.case.mjs'), `export default defineCase({ id: 'API-${item.id}', name: '人工命名保留', steps: [{async run(context, verify) { await executeApi(request, fixture, verify); }}] });`);
    await f.workspace.generate({ scanId: scan.scanId, ids: scan.requests.map(row => row.id) });
    const plan = await planPlaywrightMigration(f.config, scan); const moved = await applyPlaywrightCases(f.config, plan);
    assert.equal(moved.migrated, 1);
    assert.deepEqual(JSON.parse(await readFile(join(f.project, moved.archive, 'fixtures/api/GetCard.json'), 'utf8')), settings);
    const source = await readFile(join(f.project, 'tests/api/GetCard.spec.ts'), 'utf8');
    assert.ok(source.includes('人工命名保留')); assert.ok(!source.includes('fixtures/api')); assert.ok(!source.includes('executeApi'));
    await f.attachDependencies(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const env = { BFF_BASE_URL: `http://127.0.0.1:${server.address().port}` };
    const pass = await run(f.project, env); assert.equal(pass.code, 0, pass.output);
    assert.equal(received.length, 1); assert.equal(received[0].variables.id, 7);
    let reports = await f.workspace.reports(); let report = await f.workspace.report(reports.find(row => /(^|\/)report-/.test(row.name)).name);
    assert.equal(report.cases.filter(row => row.status === 'passed').length, 1); assert.equal(report.cases.filter(row => row.status === 'skipped').length, 2);
    await writeFile(join(f.project, 'tests/api/GetCard.spec.ts'), source.replace('"id": 7', '"id": 8'));
    const fail = await run(f.project, env, ['GetCard.spec.ts']); assert.equal(fail.code, 1);
    reports = await f.workspace.reports(); report = await f.workspace.report(reports.find(row => /(^|\/)report-/.test(row.name)).name);
    assert.equal(report.cases.length, 1); assert.equal(report.cases[0].status, 'failed');
    assert.ok(report.cases[0].steps.some(row => row.status === 'failed')); assert.equal(received.length, 2);
    assert.ok(!fail.output.includes('Expected:') && !fail.output.includes('Received:'));
    assert.ok(!(await readdir(join(f.project, 'reports'), { recursive: true })).some(name => name.endsWith('error-context.md')));
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await writeFile(join(f.project, 'config/http.json'), JSON.stringify({ headers: { satoken: '{{SYNTHETIC_AUTH_FOR_TEST}}' } }));
    const configuration = join(f.project, 'playwright.config.ts');
    await writeFile(configuration, (await readFile(configuration, 'utf8')).replace("preserveOutput: 'never'", "preserveOutput: 'always'"));
    const transportFailure = await run(f.project, { ...env, SYNTHETIC_AUTH_FOR_TEST: 'SYNTHETIC_SECRET_VALUE' }, ['GetCard.spec.ts']);
    assert.equal(transportFailure.code, 1); assert.ok(!transportFailure.output.includes('SYNTHETIC_SECRET_VALUE'));
    const artifacts = await readdir(join(f.project, 'reports'), { recursive: true });
    for (const name of artifacts.filter(name => name.endsWith('error-context.md'))) assert.ok(!(await readFile(join(f.project, 'reports', name), 'utf8')).includes('SYNTHETIC_SECRET_VALUE'));
    reports = await f.workspace.reports(); report = await f.workspace.report(reports.find(row => /(^|\/)report-/.test(row.name)).name);
    assert.ok(!JSON.stringify(report).includes('SYNTHETIC_SECRET_VALUE'));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await f.dispose(); }
});
