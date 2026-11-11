import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Reporter from '../support/archify-reporter.mjs';
import {readReportDocument} from './report-document.mjs';

test('逐案快照只含已結束案例，結束後同檔更新且不保留暫存檔', () => {
  const root = mkdtempSync(join(tmpdir(), 'archify-progress-'));
  try {
    const reporter = new Reporter();
    reporter.root = root; reporter.options = { screenshots: false };
    mkdirSync(join(root, 'tests/ui'), { recursive: true });
    const source = 'tests/ui/demo.spec.ts';
    writeFileSync(join(root, source), '// synthetic');
    const row = { id: 'one', name: '合成案例', purpose: '合成', source, target: 'web', status: 'not-run', steps: [] };
    reporter.records.set('one', row);
    reporter.records.set('two', { ...row, id: 'two' });
    reporter.onTestEnd({ id: 'one' }, { status: 'failed', duration: 1, attachments: [
      { name: '待核對清理', body: Buffer.from(JSON.stringify([{ accountId: 'owned-account' }, { accountId: 'unsafe value' }])) },
    ], steps: [] });
    const directory = join(root, 'reports/ui');
    const filename = readdirSync(directory).find(name => name.endsWith('.html'));
    let report = readReportDocument(readFileSync(join(directory, filename), 'utf8'));
    assert.equal(report.runStatus, 'running');
    assert.equal(report.cases.length, 1);
    assert.equal(report.cases[0].status, 'failed');
    assert.match(report.cases[0].cleanup.error, /owned-account/);
    assert.doesNotMatch(report.cases[0].cleanup.error, /unsafe value/);
    assert.match(report.cases[0].purpose, /整批尚未完成/);
    assert.equal(row.purpose, '合成');
    reporter.writeReports([row], false, 'finished');
    report = readReportDocument(readFileSync(join(directory, filename), 'utf8'));
    assert.equal(report.runStatus, 'finished');
    assert.equal(report.cases[0].purpose, '合成');
    assert.equal(readdirSync(directory).length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
