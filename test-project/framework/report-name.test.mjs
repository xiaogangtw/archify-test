import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reportBasename, isReportFilename } from './report-name.mjs';
test('報告採台北日期時間並保留毫秒與碰撞尾碼，舊報告仍可讀', () => {
  const name = reportBasename('execution', '2026-11-07T03:04:05.006Z', 'abcdef01-1234');
  assert.equal(name, 'report-2026-11-07_11-04-05-006-abcdef01');
  assert.ok(isReportFilename(name + '.json'));
  assert.ok(isReportFilename('report-abcdef01-1234.json'));
  assert.ok(!isReportFilename('../report-test.json'));
  assert.notEqual(name, reportBasename('execution', '2026-11-07T03:04:05.006Z', 'abcdef02-1234'));
});
