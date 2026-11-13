import test from 'node:test';
import assert from 'node:assert/strict';
import { caseQuality } from '../support/case-quality.mjs';

test('品質提醒指出模糊預期、重複步驟與不完整矩陣，且不修改案例', () => {
  const row = { expected: '正常', steps: [{ action: '輸入正確資料', expected: '' }, { action: '輸入正確資料', expected: '成功' }], decisionTable: [{ point: '空值', input: '', expected: '失敗' }] };
  const before = JSON.stringify(row);
  const codes = caseQuality(row).map(value => value.code);
  for (const code of ['VAGUE_EXPECTED', 'DUPLICATE_STEP', 'UNRESOLVED_DATA', 'MISSING_BASIS', 'MISSING_CLEANUP', 'INCOMPLETE_MATRIX']) assert.ok(codes.includes(code));
  assert.equal(JSON.stringify(row), before);
});

test('具體預期與無副作用案例不因缺少輸入資料或輸入步驟預期而誤報', () => {
  assert.deepEqual(caseQuality({ expected: '顯示三筆商品', cleanup: '不需清理', steps: [{ action: '開啟商品列表', expected: '' }], knowledgeIds: ['reference'] }), []);
});
