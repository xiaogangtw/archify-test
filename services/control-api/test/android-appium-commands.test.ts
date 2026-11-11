import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { agentToolSchema, memoryAgentTasks, registerAndroidAgentTasks } from '../src/androidAgentTasks.ts';
import { androidAgentPrompt } from '../src/androidAgentPrompt.ts';
import { androidFlowPrompt } from '../src/androidFlowAuthoring.ts';
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import { registerAndroidExecution } from '../src/androidExecution.ts';
import { memoryAndroidRuns } from '../src/androidRuns.ts';

test('native tool JSON schema includes Appium actions and bounded JSON params', () => {
  const schema = JSON.stringify(z.toJSONSchema(agentToolSchema));
  for (const name of ['editorAction', 'mobileCommand', 'webdriverCommand', 'appiumHelp']) assert.ok(schema.includes(name));
  assert.equal(agentToolSchema.parse({ kind: 'editorAction', editorAction: 'search' }).kind, 'editorAction');
  assert.equal(agentToolSchema.parse({ kind: 'mobileCommand', command: 'pressKey', params: { keycode: 66 } }).kind, 'mobileCommand');
  assert.throws(() => agentToolSchema.parse({ kind: 'webdriverCommand', method: 'POST', path: '/execute/sync', params: { script: 'anything' } }));
  assert.throws(() => agentToolSchema.parse({ kind: 'mobileCommand', command: 'type', params: [] }));
  assert.throws(() => agentToolSchema.parse({ kind: 'webdriverCommand', method: 'GET', path: '/contexts', params: {} }));
});
test('both authoring and operating AI receive the same executable Appium knowledge', () => {
  for (const prompt of [androidAgentPrompt([], true), androidFlowPrompt([], true)]) {
    for (const word of ['performEditorAction', 'appiumHelp', 'mobileCommand', 'webdriverCommand', '不是換行', 'elementId']) assert.ok(prompt.includes(word), word);
  }
});
for (const shared of [false, true]) test(`old workers reject Appium commands in ${shared ? 'shared dependencies' : 'root flow'} before enqueue`, async () => {
  const app = Fastify(); let queued = 0;
  const child = 'export const flow={appPackage:"com.example.app",steps:[{name:"搜尋",action:"editorAction",editorAction:"search"},{name:"確認",action:"assertAppForeground"}]} as const;';
  const root = shared ? 'export const flow={appPackage:"com.example.app",steps:[{name:"共用",action:"callFlow",scriptId:"child",scriptVersion:1}]} as const;' : child;
  registerAndroidExecution(app, {
    fresh: () => true, conditionalFlows: () => true, appiumCommands: () => false,
    session: () => 'session', owns: () => true, ready: () => true,
    enqueue: async () => { queued++; throw new Error('must not enqueue'); },
  }, { runs: memoryAndroidRuns(), script: async id => ({ caseType: 'flow', version: 1, name: id, source: id === 'child' ? child : root }) });
  try {
    const response = await app.inject({ method: 'POST', url: '/api/android/runs', payload: { requestId: randomUUID(), scriptId: 'root', scriptVersion: 1, serial: 'emulator-5554' } });
    assert.equal(response.statusCode, 409);
    assert.match(response.json().message, /Appium 指令支援/);
    assert.equal(queued, 0);
  } finally { await app.close(); }
});
test('AI can consult installed capability help without mutating device, draft or assertion history', async () => {
  const app = Fastify(), store = memoryAgentTasks();
  let turns = 0, help = 0;
  const source = 'export const flow={appPackage:"com.example.app",steps:[{name:"確認",action:"assertAppForeground"}]} as const;';
  registerAndroidAgentTasks(app, {
    store, references: async () => [],
    plan: async (_task, context: any) => {
      turns++;
      if (turns === 1) return { kind: 'appiumHelp', query: 'performEditorAction' };
      assert.match(context.feedback, /performEditorAction/);
      return { kind: 'finish', result: 'answer', summary: '可用 editorAction search；尚未操作。' };
    },
    device: async (_task, tool: any) => {
      assert.equal(tool.kind, 'appiumHelp'); help++;
      return { matches: [{ command: 'performEditorAction', required: ['action'] }] };
    },
    release: async () => {}, verify: async () => { throw new Error('should not verify'); },
  });
  try {
    const response = await app.inject({ method: 'POST', url: '/api/android/agent-tasks', payload: { requestId: randomUUID(), scriptId: 's', threadId: 't', source, serial: 'emulator-5554', question: '有哪些搜尋動作？' } });
    assert.equal(response.statusCode, 202);
    const id = response.json().id;
    let task: any;
    for (let i = 0; i < 100; i++) { task = await store.get(id); if (task?.state !== 'running') break; await pause(5); }
    assert.equal(task.state, 'ready');
    assert.equal(task.draft.source, source);
    assert.equal(help, 1);
    assert.equal(task.events.some((event: any) => event.replayStep), false);
  } finally { await app.close(); }
});
