import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from '../services/local-workspace/test-support.mjs';

const defaultSource = `import { test, expect } from '@playwright/test';
import { callApi } from '../../api/SyntheticLogin.js';
import { showResponse } from '../../support/response.mjs';

test('合成登入契約驗證', async ({ request }, testInfo) => {
  const response = await test.step('送出登入', () => callApi(request, { headers: { satoken: null } }));
  expect(response.status()).toBe(200);
  await showResponse(response, testInfo);
  const body = await response.json();
  expect(body.errors ?? []).toHaveLength(0);
  expect(body.data.syntheticLogin.token).toEqual(expect.any(String));
  expect(body.data.syntheticLogin.accountId).toBeTruthy();
});
`;
const defaultApiModule = `import { sendApi, type ApiCallOptions } from '../support/api-client.mjs';
import type { APIRequestContext } from '@playwright/test';
export const operation = {
  kind: 'graphql',
  method: 'POST',
  endpoint: '{{BASE_URL}}',
  headers: { deviceData: JSON.stringify({ deviceName: 'Archify API Test' }) },
  queryParams: {},
  body: {
    query: 'mutation SyntheticLogin($request: LoginInput) { syntheticLogin(request: $request) { token accountId status needBindPhone } }',
    variables: { request: { useNonMobile: true } },
  },
};
export function callApi(request: APIRequestContext, options: ApiCallOptions = {}) {
  return sendApi(request, operation, options);
}
`;
const source = process.argv[2] ? await readFile(process.argv[2], 'utf8') : defaultSource;
const f = await fixture(); let mode = 'success'; const requests = [];
const marker = 'SYNTHETIC_LOGIN_RESPONSE_SECRET';
const server = createServer((req, res) => {
  let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => {
    requests.push({ body: JSON.parse(body), headers: req.headers });
    res.setHeader('Content-Type', 'application/json');
    const result = { token: marker, accountId: 'synthetic-account', status: 'REGISTERED', needBindPhone: false };
    res.end(JSON.stringify(mode === 'graphql-error' ? { errors: [{ message: marker }] } : { data: { syntheticLogin: { ...result, ...(mode === 'missing-token' ? { token: null } : {}) } } }));
  });
});
async function run() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(f.project, 'node_modules/@playwright/test/cli.js'), 'test', 'SyntheticLogin.spec.ts'], {
      cwd: f.project, windowsHide: true, env: { ...process.env, BFF_BASE_URL: `http://127.0.0.1:${server.address().port}/graphql` },
    });
    let output = ''; child.stdout.on('data', value => { output += value; }); child.stderr.on('data', value => { output += value; });
    child.on('error', reject); child.on('close', code => resolve({ code, output }));
  });
}
try {
  await f.workspace.initialize(); await f.attachDependencies();
  await writeFile(join(f.project, 'api/SyntheticLogin.ts'), defaultApiModule);
  await writeFile(join(f.project, 'tests/api/SyntheticLogin.spec.ts'), source);
  await writeFile(join(f.project, 'config/http.json'), JSON.stringify({ headers: { Accept: 'application/json', satoken: '{{MISSING_OLD_TOKEN}}' } }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  for (const expected of ['success', 'missing-token', 'graphql-error']) {
    mode = expected; const result = await run(); assert.equal(result.code, mode === 'success' ? 0 : 1, result.output);
    assert.ok(!result.output.includes(marker));
  }
  assert.equal(requests.length, 3);
  assert.ok(requests.every(row => typeof row.body.variables.request.useNonMobile === 'boolean' && !row.headers.satoken));
  assert.ok(requests.every(row => JSON.parse(row.headers.devicedata).deviceName === 'Archify API Test'));
  for (const file of await f.workspace.reports()) {
    const report = await f.workspace.report(file.name); assert.ok(!JSON.stringify(report).includes(marker));
    if (source.includes('showResponse(response, testInfo)')) {
      assert.equal(report.cases[0].responses.length, 1);
      assert.equal(report.cases[0].responses[0].status, 200);
      if (report.cases[0].status === 'passed') assert.equal(report.cases[0].responses[0].body.data.syntheticLogin.accountId, 'synthetic-account');
    }
  }
  console.log('PASS synthetic login case: real Playwright against loopback, typed input, deviceData, no old token required, valid login passes, missing token/GraphQL errors fail, response secrets absent from reports. Product requests: 0.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await f.dispose(); }
