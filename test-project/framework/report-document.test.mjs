import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { renderHtml } from './journey-report.mjs';
import { readReportDocument } from './report-document.mjs';
import Reporter from '../support/archify-reporter.mjs';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGOwyduHFTEMLQkAClVaAWgW32sAAAAASUVORK5CYII=';
const row = { id: 'TC-SYNTHETIC', caseId: 'TC-SYNTHETIC', name: '合成圖文', purpose: '範本回歸',
  preconditions: 'ONLY_IN_DATA', source: 'tests/ui/Synthetic.spec.ts', sourceHash: 'a'.repeat(64), target: 'web',
  status: 'passed', expected: '保留全部畫面', actual: '合成資料', steps: [{ name: '驗證', expected: '相等', status: 'passed' }],
  screenshots: Array.from({ length: 25 }, (_, index) => ({ caption: `${index + 1}. A／頁面1｜操作 ${index + 1}｜完成後`, data: png })) };
const report = { schemaVersion: 1, kind: 'execution', testType: 'ui', runStatus: 'finished',
  project: '合成預覽', runId: 'abcdef12-3456', createdAt: '2026-11-10T00:00:00Z', cases: [row] };

test('單檔保留超過八張圖片及JSON資料，前置不在閱讀正文顯示，資料不能跳出script', () => {
  const value = structuredClone(report);
  value.cases[0].name = '</script><script>INJECTED()</script>';
  const html = renderHtml(value);
  assert.deepEqual(readReportDocument(html), value);
  assert.equal((html.match(/<figure>/g) || []).length, 25);
  assert.equal((html.match(new RegExp(png, 'g')) || []).length, 25, '圖片只在內嵌資料保存一次');
  const visible = html.split('<script id="archify-report-data"')[0];
  assert.ok(!visible.includes('ONLY_IN_DATA'));
  assert.ok(!html.includes('</script><script>INJECTED()'));
  assert.ok(html.includes('IntersectionObserver'));
  value.cases[0].scenarioSteps = [{ action: '你與小明都關閉自動同意，彼此沒有對方名片。', expected: '維持未交換關係' }, { action: '小明向你索取名片，你先不點同意，再查看你的待同意與小明的待審核。', expected: '兩邊各一筆申請' }];
  const narrative = renderHtml(value);
  assert.ok(narrative.includes('情境與操作'));
  assert.ok(narrative.includes('小明向你索取名片，你先不點同意'));
  assert.deepEqual(readReportDocument(narrative), value);
  assert.deepEqual(readReportDocument(JSON.stringify(value)), value, '舊JSON仍可讀');
  assert.throws(() => readReportDocument('<html>舊HTML</html>'), /同名JSON/);
});

test('同一執行的進行中快照與完成結果更新同一HTML，不產生分卷或JSON/TXT', async () => {
  const root = await mkdtemp(join(tmpdir(), 'archify-single-report-'));
  try {
    await mkdir(join(root, 'reports'));
    const reporter = new Reporter();
    reporter.root = root; reporter.config = {}; reporter.options = { screenshots: true };
    reporter.createdAt = report.createdAt; reporter.runId = report.runId;
    reporter.writeReports([row], false, 'running');
    const second = { ...row, id: 'SECOND', caseId: 'SECOND', screenshots: row.screenshots.slice(0, 12) };
    reporter.writeReports([row, second], false, 'finished');
    const names = await readdir(join(root, 'reports/ui'));
    assert.equal(names.length, 1);
    assert.ok(names[0].endsWith('.html') && !names[0].includes('-part-'));
    const saved = readReportDocument(await readFile(join(root, 'reports/ui', names[0]), 'utf8'));
    assert.equal(saved.runStatus, 'finished');
    assert.equal(saved.cases.length, 2);
    assert.equal(saved.cases[0].screenshots.length, 25);
  } finally {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(root.includes('archify-single-report-'));
    await rm(root, { recursive: true, force: true });
  }
});
