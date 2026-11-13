import { planFile, planState, planId } from './case-plan.mjs';
import { caseQuality } from './case-quality.mjs';
try {
  const id = process.argv[2];
  if (id !== '--all' && !planId(id)) throw new Error('用法：node support/case-plan-cli.mjs TC-CASE-ID 或 --all');
  const catalog = JSON.parse(await planFile(process.cwd(), 'test-cases/catalog.json'));
  if (id === '--all') {
    if (process.argv.includes('--review')) throw new Error('--all 不支援歷史確認核對。');
    const cases = [];
    for (const row of catalog.cases) {
      if (!planId(row.id)) throw new Error('案例 ID 格式不合法。');
      const state = await planState(process.cwd(), catalog, row, false);
      cases.push({ caseId: row.id, status: state.problems.length ? 'incomplete' : 'ready', problems: state.problems, warnings: caseQuality(row, catalog.features.find(feature => feature.id === row.featureId)) });
    }
    console.log(JSON.stringify({ cases, note: '品質提醒為啟發式檢查；ready 不代表需求完整、矩陣已實作或產品通過。' }, null, 2));
    if (cases.some(row => row.problems.length)) process.exitCode = 1;
  } else {
  const row = catalog.cases.find(row => row.id === id);
  if (!row) throw new Error('找不到案例');
  const review = process.argv.includes('--review');
  const state = await planState(process.cwd(), catalog, row, review);
  if (state.problems.length) throw new Error(`流程資料待補：${state.problems.join('；')}`);
  if (review && state.status !== 'confirmed') throw new Error('舊確認版本不相符；此選項只供歷史核對，不是撰寫腳本的前置條件。');
  console.log(JSON.stringify({ caseId: id, status: review ? state.status : 'ready', fingerprint: state.fingerprint, warnings: caseQuality(row, catalog.features.find(feature => feature.id === row.featureId)), ...(review ? { confirmedAt: state.confirmedAt } : {}) }));
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
