// Describe only completed operations and explicitly attached observations.
export function reportActual(record) {
  const value = record.actual;
  return typeof value === 'string' && value && !/^(本次測試執行完成|等待操作目標|畫面或資料斷言|步驟失敗；|測試失敗，)/.test(value) ? value : caseActual(record);
}
export function caseActual(record, observed) {
  if (record.status === 'not-run') return '尚未執行，以下情境與操作為規劃內容。';
  if (record.status === 'skipped') return '案例略過，未完成業務驗證。';
  const steps = record.steps || [];
  if (record.status === 'passed') {
    if (typeof observed === 'string' && observed.trim()) return observed.trim();
    const completed = steps.filter(s => s.status === 'passed' && !/^\d+\.|^清理|^前置/.test(s.name)).slice(-2);
    return completed.length ? '完成：' + completed.map(s => s.name).join(' → ') + '。' : '通過；未保存具體業務結果。';
  }
  const failed = steps.filter(s => s.status === 'failed' && !/清理/.test(s.name));
  const failure = failed.at(-1) || steps.find(s => s.status === 'failed');
  const before = failure ? steps.slice(0, steps.indexOf(failure)) : steps;
  const completed = before.filter(s => s.status === 'passed' && !/^\d+\.|^清理|^前置/.test(s.name)).slice(-2);
  return (completed.length ? '完成：' + completed.map(s => s.name).join(' → ') + '。' : '')
    + (failure ? '停在「' + failure.name + '」：' + (failure.actual || failure.error || '未保存失敗原因。') : '未保存失敗位置。')
    + '後續結果未驗證。';
}
