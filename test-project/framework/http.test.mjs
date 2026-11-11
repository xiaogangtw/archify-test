import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeApi, mergeHeaders, readHttpConfig } from './http.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';

test('草稿、缺少斷言、寫入未授權時都不發送請求', async () => {
  let calls = 0;
  const transport = async () => { calls++; throw new Error('不應送出'); };
  const definition = { method: 'POST', endpoint: '/cards', kind: 'http' };
  await assert.rejects(executeApi(definition, { enabled: false }, assert.deepStrictEqual, transport), /草稿/);
  await assert.rejects(executeApi(definition, { enabled: true, expectedStatus: 200, assertions: [] }, assert.deepStrictEqual, transport), /斷言/);
  await assert.rejects(executeApi(definition, { enabled: true, expectedStatus: 200, assertions: [{ path: 'missing', operator: 'equals' }] }, assert.deepStrictEqual, transport), /value/);
  await assert.rejects(executeApi(definition, { enabled: true, expectedStatus: 200, assertions: [{ path: 'id', operator: 'exists' }] }, assert.deepStrictEqual, transport), /寫入/);
  assert.equal(calls, 0);
});
test('共用 Header 載入、格式錯誤與不分大小寫的覆寫／移除', async () => {
  assert.deepEqual(mergeHeaders({ Authorization: 'common', Accept: 'application/json' }, { authorization: 'request' }, { AUTHORIZATION: null }), { accept: 'application/json' });
  assert.throws(() => mergeHeaders({ Authorization: 123 }), /Header/);
  const directory = await mkdtemp(join(tmpdir(), 'archify-headers-'));
  try {
    const path = join(directory, 'http.json');
    assert.deepEqual(await readHttpConfig(path), { headers: {} });
    await writeFile(path, JSON.stringify({ headers: { Authorization: 'Bearer {{AUTH_TOKEN}}' } }));
    assert.equal((await readHttpConfig(path)).headers.Authorization, 'Bearer {{AUTH_TOKEN}}');
    await writeFile(path, 'not JSON');
    await assert.rejects(readHttpConfig(path), /共用 Header/);
  } finally {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(basename(directory).startsWith('archify-headers-'));
    await rm(directory, { recursive: true, force: true });
  }
});
test('共用認證變數於送出前解析；缺值不送出，個案可覆寫或移除', async () => {
  const old = process.env.BFF_BASE_URL;
  process.env.BFF_BASE_URL = 'https://qa.example.test';
  try {
    const definition = { method: 'GET', endpoint: '/cards', headers: { 'X-Client': 'request' } };
    const fixture = { enabled: true, expectedStatus: 200, variables: { TEST_AUTH_TOKEN: 'test-only-token' }, assertions: [{ path: 'ok', operator: 'equals', value: true }] };
    let calls = 0;
    const transport = async (_, options) => { calls++; assert.equal(options.headers.authorization, 'Bearer test-only-token'); assert.equal(options.headers['x-client'], 'case'); return new Response('{"ok":true}'); };
    await executeApi(definition, { ...fixture, headers: { 'x-client': 'case' } }, assert.deepStrictEqual, transport, { headers: { Authorization: 'Bearer {{TEST_AUTH_TOKEN}}', 'X-Client': 'common' } });
    await assert.rejects(executeApi(definition, fixture, assert.deepStrictEqual, transport, { headers: { Authorization: 'Bearer {{ARCHIFY_MISSING_HEADER_TEST}}' } }), /變數/);
    assert.equal(calls, 1);
    await executeApi(definition, { ...fixture, headers: { AUTHORIZATION: null } }, assert.deepStrictEqual, async (_, options) => { assert.equal(options.headers.authorization, undefined); return new Response('{"ok":true}'); }, { headers: { Authorization: 'Bearer {{ARCHIFY_MISSING_HEADER_TEST}}' } });
  } finally { if (old === undefined) delete process.env.BFF_BASE_URL; else process.env.BFF_BASE_URL = old; }
});
test('測試環境替換來源 origin、保留型別並檢查業務斷言與 GraphQL errors', async () => {
  const old = process.env.BFF_BASE_URL;
  process.env.BFF_BASE_URL = 'https://qa.example.test';
  try {
    const fixture = { enabled: true, expectedStatus: 200, variables: { id: 7 }, assertions: [{ path: 'data.card.id', operator: 'equals', value: '{{id}}' }] };
    const definition = { method: 'POST', kind: 'graphql', operationType: 'query', endpoint: 'https://source.example.test/graphql', body: { variables: { id: '{{id}}' } } };
    let calls = 0;
    const transport = async (url, options) => {
      calls++; assert.equal(url.origin, 'https://qa.example.test'); assert.equal(url.pathname, '/graphql');
      assert.equal(JSON.parse(options.body).variables.id, 7); assert.equal(options.redirect, 'error');
      return new Response(JSON.stringify({ data: { card: { id: 7 } } }), { status: 200 });
    };
    await executeApi(definition, fixture, assert.deepStrictEqual, transport, { headers: {} });
    assert.equal(calls, 1);
    await assert.rejects(executeApi(definition, fixture, assert.deepStrictEqual, async () => new Response(JSON.stringify({ errors: [{ message: 'failure' }] }), { status: 200 }), { headers: {} }));
    await assert.rejects(executeApi({ ...definition, endpoint: '//other.example.test/graphql' }, fixture, assert.deepStrictEqual, transport, { headers: {} }), /origin/);
    await assert.rejects(executeApi({ ...definition, body: { value: '{{MISSING_VARIABLE_FOR_TEST}}' } }, fixture, assert.deepStrictEqual, transport, { headers: {} }), /變數/);
    await assert.rejects(executeApi({ ...definition, body: { query: 'query { card(secret:"{{SECRET}}") { id } }' } }, fixture, assert.deepStrictEqual, transport, { headers: {} }), /GraphQL variables/);
    assert.equal(calls, 1);
  } finally { if (old === undefined) delete process.env.BFF_BASE_URL; else process.env.BFF_BASE_URL = old; }
});
