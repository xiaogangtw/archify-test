import test from 'node:test';
import assert from 'node:assert/strict';
import { reportParts } from './report-parts.mjs';
import { checkUiEvidence } from '../support/check-ui-evidence.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
test('逐操作證據依張數及 bytes 分卷，所有圖片保留且不修改原案例', () => {
  const images = Array.from({ length: 21 }, (_, index) => ({ caption: String(index), data: Buffer.alloc(3).toString('base64') }));
  const original = { id: 'case', purpose: '原目的', screenshots: images };
  const parts = reportParts([original], { imageLimit: 8, byteLimit: 12 });
  assert.equal(parts.length, 6);
  assert.deepEqual(parts.flatMap(rows => rows.flatMap(row => row.screenshots)), images);
  assert.equal(original.purpose, '原目的');
  for (const part of parts) { assert.ok(part[0].evidencePart); assert.ok(part[0].screenshots.length <= 4); }
  assert.equal(reportParts([{ id: 'one' }, { id: 'two' }]).length, 1);
  const steps = Array.from({ length: 2100 }, (_, index) => ({ name: String(index), status: 'passed' }));
  const logs = reportParts([{ id: 'long', steps, status: 'passed' }]);
  assert.equal(logs.length, 3);
  assert.deepEqual(logs.flatMap(rows => rows[0].steps), steps);
});
test('畫面腳本 gate 阻擋裸 test 並允許共用 fixture 及 type imports', () => {
  const root = mkdtempSync(join(tmpdir(), 'archify-evidence-gate-'));
  try {
    mkdirSync(join(root, 'tests/ui'), { recursive: true });
    const file = join(root, 'tests/ui/demo.spec.ts');
    writeFileSync(file, "import {test,expect} from '@playwright/test';");
    assert.throws(() => checkUiEvidence(root), /共用|必須/);
    writeFileSync(file, "import {test,expect} from '../../support/web-test.js';import type {Page} from '@playwright/test';");
    assert.doesNotThrow(() => checkUiEvidence(root));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
