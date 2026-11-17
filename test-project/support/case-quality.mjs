// 唯讀啟發式提醒；不能判定需求完整度或腳本實際覆蓋。
export function caseQuality(row, feature) {
  const warnings = [];
  const add = (code, location, message) => warnings.push({ code, location, message });
  const vague = /^(正常|成功|失敗|正確|符合預期|顯示正常|操作成功|驗證成功|頁面正常|功能正常)[。.!！\s]*$/;
  const placeholder = /待補|待填|TODO|TBD|輸入正確資料|合法預設值|其餘填寫合法值/i;
  for (const [location, value] of [['expected', row.expected], ...(row.steps || []).map((step, i) => [`steps[${i}].expected`, step.expected])]) {
    if (typeof value === 'string' && vague.test(value.trim())) add('VAGUE_EXPECTED', location, '請描述可核對的畫面、回應欄位或狀態，避免只寫正常或成功。');
  }
  const names = new Set();
  for (const [i, step] of (row.steps || []).entries()) {
    if (names.has(step.action?.trim())) add('DUPLICATE_STEP', `steps[${i}].action`, '步驟名稱重複，報告無法唯一對應；請描述此步驟的角色或核對位置。');
    names.add(step.action?.trim());
    if (placeholder.test(`${step.action || ''} ${step.data || ''}`)) add('UNRESOLVED_DATA', `steps[${i}]`, '請提供具體非秘密資料或可追查的共用資料來源。');
  }
  if (!(row.knowledgeIds || []).length && !(feature?.sources || []).length) add('MISSING_BASIS', 'knowledgeIds', '尚未關聯知識或功能來源，請確認預期行為的依據。');
  if (!row.cleanup?.trim()) add('MISSING_CLEANUP', 'cleanup', '請說明資料如何清理；沒有副作用時明示不需清理。');
  for (const [i, entry] of (row.decisionTable || []).entries()) {
    if (![entry.point, entry.input, entry.expected].every(value => typeof value === 'string' && value.trim())) add('INCOMPLETE_MATRIX', `decisionTable[${i}]`, '請補齊測試點、輸入資料及對應預期。');
    else if (vague.test(entry.expected.trim()) || placeholder.test(`${entry.input} ${entry.expected}`)) add('UNCLEAR_MATRIX', `decisionTable[${i}]`, '矩陣需具體輸入及可驗證預期；列出矩陣不代表腳本已執行每一列。');
  }
  return warnings;
}
