import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appiumRequest, commandValue } from './appium-commands.mjs';
import { flowSchema, requiresAppiumCommands } from './flow-contract.mjs';
import { executeFlow } from './flow-engine.mjs';
import { createAppium } from './appium.mjs';

const foreground = { name: '確認前景', action: 'assertAppForeground', timeoutMs: 0 };
test('IME search is an editor action, with no element, coordinate, Enter or newline', () => {
  assert.deepEqual(appiumRequest({ action: 'editorAction', editorAction: 'search' }), {
    path: '/execute/sync', method: 'POST', body: { script: 'mobile: performEditorAction', args: [{ action: 'search' }] },
  });
});
test('generic transport accepts mobile extensions and session-scoped HTTP methods', () => {
  assert.deepEqual(appiumRequest({ action: 'mobileCommand', command: 'deepLink', params: { url: 'app://screen', package: 'com.example.app' } }).body,
    { script: 'mobile: deepLink', args: [{ url: 'app://screen', package: 'com.example.app' }] });
  assert.deepEqual(appiumRequest({ action: 'webdriverCommand', method: 'DELETE', path: '/actions' }), { path: '/actions', method: 'DELETE', body: undefined });
  assert.deepEqual(appiumRequest({ action: 'webdriverCommand', method: 'GET', path: '/contexts' }), { path: '/contexts', method: 'GET', body: undefined });
});
test('transport rejects escape routes, oversized or executable parameters before dispatch', () => {
  for (const path of ['https://host/session/x', '//host/x', '/session/other/back', '/execute/sync', '/execute/async', '/../status', '/%2e%2e/status', '/a?b=1', '/a\\b', '/a/']) {
    assert.throws(() => appiumRequest({ action: 'webdriverCommand', method: 'POST', path }));
  }
  for (const params of [[], 'text', null, { code: () => 1 }, { text: 'x'.repeat(33000) }, JSON.parse('{"__proto__":{"x":true}}')]) {
    assert.throws(() => appiumRequest({ action: 'mobileCommand', command: 'type', params }));
  }
  let nested = {};
  for (let i = 0; i < 20; i++) nested = { nested };
  assert.throws(() => appiumRequest({ action: 'mobileCommand', command: 'type', params: nested }));
  assert.throws(() => appiumRequest({ action: 'editorAction', editorAction: 'enter' }));
  assert.throws(() => appiumRequest({ action: 'webdriverCommand', method: 'GET', path: '/contexts', params: {} }));
});
test('command values are bounded and never masquerade as a result assertion', () => {
  assert.equal(commandValue({ value: 1 }), '{"value":1}');
  assert.equal(commandValue(true), true);
  assert.throws(() => commandValue('x'.repeat(4001)));
  assert.equal(commandValue({ data: { count: 3 } }, ['data','count']), 3);
  assert.throws(() => commandValue({}, ['missing']));
  assert.throws(() => commandValue({}, ['__proto__']));
  assert.throws(() => flowSchema.parse({ appPackage: 'com.example.app', steps: [{ name: '無效參數', action: 'mobileCommand', command: 'type', params: [] }, foreground] }));
  assert.throws(() => flowSchema.parse({ appPackage: 'com.example.app', steps: [{ name: '搜尋', action: 'editorAction', editorAction: 'search' }] }));
  assert.equal(requiresAppiumCommands({ steps: [{ action: 'repeat', steps: [{ action: 'editorAction' }] }] }), true);
});
test('flow can resolve session element IDs from command results without freezing prior session IDs', async () => {
  const calls = [];
  const flow = flowSchema.parse({ appPackage: 'com.example.app', steps: [
    { name: '找元件', action: 'webdriverCommand', method: 'POST', path: '/element', params: { using: 'id', value: 'actual-id' }, resultPath: ['element-6066-11e4-a52e-4f735466cecf'], variable: 'element' },
    { name: '點元件', action: 'webdriverCommand', method: 'POST', path: '/element/{{element}}/click' }, foreground,
  ] });
  const result = await executeFlow(flow, { routeFor: () => '/session/current', execute: async (path, body, method) => {
    calls.push({ path, body, method });
    return path.endsWith('/element') ? { 'element-6066-11e4-a52e-4f735466cecf': 'fresh-id' } : path.endsWith('/current_package') ? 'com.example.app' : null;
  } });
  assert.equal(result.status, 'passed');
  assert.equal(calls[1].path, '/session/current/element/fresh-id/click');
});
test('flow routes commands by actor, interpolates nested params, saves results and forwards DELETE', async () => {
  const calls = [];
  const flow = flowSchema.parse({ appPackage: 'com.example.app', actors: ['sender', 'receiver'], variables: { id: '@demo_official' }, steps: [
    { name: '搜尋', actor: 'sender', action: 'editorAction', editorAction: 'search' },
    { name: '讀取設定', actor: 'receiver', action: 'webdriverCommand', method: 'GET', path: '/appium/settings', variable: 'settings' },
    { name: '確認回傳', action: 'assert', condition: { kind: 'variable', variable: 'settings', equals: '{"ready":true}' }, actor: 'receiver' },
    { name: '輸入', actor: 'sender', action: 'mobileCommand', command: 'type', params: { text: '{{id}}' } },
    { name: '釋放輸入', actor: 'sender', action: 'webdriverCommand', method: 'DELETE', path: '/actions' },
    { ...foreground, actor: 'sender' }, { ...foreground, actor: 'receiver' },
  ] });
  const result = await executeFlow(flow, { routeFor: role => '/session/' + role, execute: async (path, body, method) => {
    calls.push({ path, body, method });
    return path.endsWith('/current_package') ? 'com.example.app' : path.endsWith('/appium/settings') ? { ready: true } : null;
  } });
  assert.equal(result.status, 'passed');
  assert.deepEqual(calls[0], { path: '/session/sender/execute/sync', body: { script: 'mobile: performEditorAction', args: [{ action: 'search' }] }, method: 'POST' });
  assert.ok(calls.some(item => item.path === '/session/receiver/appium/settings' && item.method === 'GET'));
  assert.ok(calls.some(item => item.body?.args?.[0]?.text === '@demo_official'));
  assert.ok(calls.some(item => item.path === '/session/sender/actions' && item.method === 'DELETE'));
});
test('a failed mobile command is sent once, fails flow and preserves error type', async () => {
  let attempts = 0;
  const flow = flowSchema.parse({ appPackage: 'com.example.app', steps: [{ name: '搜尋', action: 'editorAction', editorAction: 'search' }, foreground] });
  const result = await executeFlow(flow, { routeFor: () => '/session/test', execute: async () => {
    attempts++; throw Object.assign(new Error('unsupported'), { webdriver: 'unsupported operation' });
  } });
  assert.equal(attempts, 1);
  assert.equal(result.status, 'failed');
  assert.match(result.trace[0].message, /unsupported operation/);
});
test('agent keyboard action is replayable and unsupported commands are never resent', async () => {
  const xml = '<hierarchy><node class="android.widget.EditText" focused="true"/></hierarchy>';
  const fingerprint = createHash('sha256').update(xml).digest('hex');
  const calls = [];
  let unsupported = false;
  const app = createAppium({ status: async () => ({ devices: [{ serial: 'emulator-5554', booted: true }] }) }, { fetch: async (url, options = {}) => {
    const body = options.body && JSON.parse(options.body); calls.push({ url, body });
    const value = url.endsWith('/status') ? { ready: true } : url.endsWith('/session') ? { sessionId: 'ime' } : url.endsWith('/source') ? xml : body?.script === 'mobile: missing' && unsupported ? { error: 'unknown command' } : null;
    return new Response(JSON.stringify({ value }));
  } });
  try {
    const result = await app.explore('emulator-5554', 'task', { kind: 'editorAction', editorAction: 'search', fingerprint });
    assert.equal(result.accepted, true);
    assert.deepEqual(result.replayStep, { name: '鍵盤動作', action: 'editorAction', editorAction: 'search' });
    assert.equal(calls.filter(item => item.body?.script === 'mobile: performEditorAction').length, 1);
    unsupported = true;
    await assert.rejects(app.explore('emulator-5554', 'task', { kind: 'mobileCommand', command: 'missing', fingerprint }), /unknown command/);
    assert.equal(calls.filter(item => item.body?.script === 'mobile: missing').length, 1);
  } finally { await app.close(); }
});
