import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeApi } from './http.mjs';
test('BFF_BASE_URL 優先且舊名稱相容，明確空值不退回舊環境', async () => {
  const previous = { bff: process.env.BFF_BASE_URL, old: process.env.ARCHIFY_TARGET_BASE_URL };
  const fixture = { enabled: true, expectedStatus: 200, assertions: [{ path: 'ok', operator: 'equals', value: true }] };
  const seen = [];
  const transport = async url => { seen.push(url.hostname); return new Response('{"ok":true}'); };
  try {
    delete process.env.BFF_BASE_URL; process.env.ARCHIFY_TARGET_BASE_URL = 'https://legacy.example';
    await executeApi({ method: 'GET', endpoint: '/probe' }, fixture, assert.deepStrictEqual, transport, { headers: {} });
    process.env.BFF_BASE_URL = 'https://qa.example';
    await executeApi({ method: 'GET', endpoint: '/probe' }, fixture, assert.deepStrictEqual, transport, { headers: {} });
    process.env.BFF_BASE_URL = '';
    await assert.rejects(executeApi({ method: 'GET', endpoint: '/probe' }, fixture, assert.deepStrictEqual, transport, { headers: {} }), /BFF_BASE_URL/);
    assert.deepEqual(seen, ['legacy.example', 'qa.example']);
  } finally {
    for (const [key, value] of [['BFF_BASE_URL', previous.bff], ['ARCHIFY_TARGET_BASE_URL', previous.old]]) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
