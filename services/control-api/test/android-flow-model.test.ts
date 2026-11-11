import test from 'node:test';
import assert from 'node:assert/strict';
import { definitionSource, flowKey, flowPreview, readFlowCases } from '../../../apps/web/src/features/testing/androidFlowModel.ts';
test('legacy Android draft imports without deleting Web plans and without evaluating code', () => {
  const store = new Map([['archify.e2e-plans.v1.project', JSON.stringify([{ id: 'a', name: '交換', platform: 'android', target: 'com.example.app', actors: [{ id: 'a', name: 'A' }], steps: [{ actorId: 'a', action: '接受邀請', expected: '顯示完成' }] }, { id: 'web', platform: 'web' }])]]);
  const original = store.get('archify.e2e-plans.v1.project');
  const rows = readFlowCases({ getItem: key => store.get(key) || null }, 'project');
  assert.equal(rows.length, 1); assert.equal(rows[0].id, 'a'); assert.equal(flowPreview(rows[0].source)[0].actor, 'A');
  assert.equal(store.get('archify.e2e-plans.v1.project'), original);
  assert.deepEqual(flowPreview('throw new Error("must not execute")'), []);
  assert.deepEqual(flowPreview(definitionSource({ steps: [] })), []);
  store.set(flowKey('project'), 'broken'); assert.throws(() => readFlowCases({ getItem: key => store.get(key) || null }, 'project'));
});
