import test from 'node:test';
import assert from 'node:assert/strict';
import { androidRecord, matchesHistory } from '../../../apps/web/src/features/testing/executionHistoryModel.ts';
import { androidReportRecord } from '../src/androidReport.ts';

test('Android history retains explicit batch membership and groups legacy per-case versions', () => {
  const first = { executionOrigin: 'e2e-batch', id: 'one', scriptId: 'case-one', batchId: 'batch-id', batchName: 'E2E', testVersion: 'ANDROID-one', status: 'failed', name: '登入', scriptVersion: 2, completed: 0, steps: [{ name: '確認登入', status: 'failed' }] };
  const row = androidRecord(first), second = androidRecord({ ...first, id: 'two', testVersion: 'ANDROID-two' });
  assert.equal(row.batchId, first.batchId); assert.equal(row.batchName, 'E2E'); assert.equal(row.scriptId, 'case-one');
  assert.equal(row.testVersion, second.testVersion); assert.equal(row.android.testVersion, 'ANDROID-one');
  assert.equal(matchesHistory(row, { type: 'batch', outcome: 'all', version: 'all' }), true);
  assert.equal(androidRecord({ ...first, batchId: undefined }).testVersion, 'ANDROID-one');
  const report = androidReportRecord(first);
  assert.equal(report.events[0].event.status, 'failed');
  assert.equal(report.testVersion, 'ANDROID-one');
  assert.equal(report.reportVersion, row.testVersion);
});

test('Appium and unclassified legacy runs stay in execution history even with operational batch IDs', () => {
  for (const executionOrigin of ['appium', undefined]) {
    const original = { id: 'appium', executionOrigin, batchId: 'lease-id', name: '手機案例', testVersion: 'ANDROID-appium', status: 'passed', steps: [], completed: 0, scriptVersion: 1 };
    const row = androidRecord(original);
    assert.equal(row.batchId, undefined);
    assert.equal(row.testVersion, original.testVersion);
    assert.equal(row.android.batchId, 'lease-id');
    assert.equal(matchesHistory(row, { type: 'flow', outcome: 'all', version: 'all' }), true);
    assert.equal(matchesHistory(row, { type: 'batch', outcome: 'all', version: 'all' }), false);
    assert.equal(androidReportRecord(original).batchId, undefined);
  }
});

test('Android report preserves nested failure context and safe driver text',()=>{const report=androidReportRecord({name:'登入',steps:[],trace:[{path:'main.2.1',name:'點擊',action:'click',phase:'main',actor:'receiver',status:'failed',durationMs:1234,message:'Appium 操作失敗：invalid session id'}]});assert.deepEqual(report.events[0].event,{type:'step-end',title:'點擊',status:'failed',message:'Appium 操作失敗：invalid session id',path:'main.2.1',action:'click',phase:'main',actor:'receiver',durationMs:1234});});
