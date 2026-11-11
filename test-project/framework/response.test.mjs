import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactResponse, showResponse } from '../support/response.mjs';
import { renderHtml } from './html.mjs';

test('回應預覽保留業務結果、遞迴遮蔽秘密並跳脫 HTML', async () => {
  const value = { data: { token: 'secret-marker', nested: [{ access_token: 'secret-marker', password: 'secret-marker', status: 'REGISTERED', accountId: 'test-account', message: '<script>unsafe</script>' }] } };
  const preview = redactResponse(value);
  assert.equal(preview.data.token, '[REDACTED]');
  assert.equal(preview.data.nested[0].status, 'REGISTERED');
  assert.equal(value.data.token, 'secret-marker');
  const report = { cases: [{ steps: [], responses: [{ status: 200, body: preview }] }] };
  const html = renderHtml(report);
  assert.ok(html.includes('HTTP 200') && html.includes('test-account'));
  assert.ok(!html.includes('secret-marker') && !html.includes('<script>'));
  const attachments = [], logs = [];
  const original = console.log; console.log = text => logs.push(text);
  try {
    await showResponse({ status: () => 400, json: async () => value }, { attach: async (name, item) => attachments.push({ name, ...item }) });
    await showResponse({ status: () => 502, json: async () => { throw new Error('secret-marker'); } }, { attach: async (name, item) => attachments.push({ name, ...item }) });
  } finally { console.log = original; }
  assert.equal(attachments.length, 2);
  assert.equal(JSON.parse(attachments[0].body).status, 400);
  assert.ok(!logs.join('').includes('secret-marker'));
  assert.ok(!attachments.some(item => item.body.toString().includes('secret-marker')));
});
