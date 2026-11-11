import { planFile, planState, planId } from './case-plan.mjs';
try {
  const id = process.argv[2];
  if (!planId(id)) throw new Error('用法：node support/case-plan-cli.mjs TC-CASE-ID');
  const catalog = JSON.parse(await planFile(process.cwd(), 'test-cases/catalog.json'));
  const row = catalog.cases.find(row => row.id === id);
  if (!row) throw new Error('找不到案例');
  const review = process.argv.includes('--review');
  const state = await planState(process.cwd(), catalog, row, review);
  if (state.problems.length) throw new Error(`流程資料待補：${state.problems.join('；')}`);
  if (review && state.status !== 'confirmed') throw new Error('舊確認版本不相符；此選項只供歷史核對，不是撰寫腳本的前置條件。');
  console.log(JSON.stringify({ caseId: id, status: review ? state.status : 'ready', fingerprint: state.fingerprint, ...(review ? { confirmedAt: state.confirmedAt } : {}) }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
