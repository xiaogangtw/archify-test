const messages = {
  UI_NOT_READY: '頁面尚未呈現可見內容；導頁完成不代表畫面已就緒。',
  RESPONSE_TIMEOUT: '等待指定的網頁 API 回應逾時；未重送請求。',
  NAVIGATION_TIMEOUT: '頁面導向逾時，請核對本機前端與載入環境。',
  ACTION_TIMEOUT: '等待操作目標或操作完成逾時。',
  ASSERTION_FAILED: '畫面或資料斷言未符合指定預期。',
  PAGE_RUNTIME_ERROR: '瀏覽器記錄到 JavaScript 執行錯誤；未保存可能含秘密的原始訊息。',
  NETWORK_FAILURE: '瀏覽器記錄到網路傳輸失敗；未保存 URL、Header 或請求內容。',
  EVIDENCE_INCOMPLETE: '無法取得當步畫面，證據不完整。',
  UNKNOWN_FAILURE: '步驟失敗；舊版或未分類錯誤沒有足夠診斷資訊，不能推定業務原因。',
};
export function uiFailure(code, details = {}) {
  const error = new Error(messages[code] || messages.UNKNOWN_FAILURE);
  error.archifyDiagnostic = { code: messages[code] ? code : 'UNKNOWN_FAILURE', ...details };
  return error;
}
export function safeDiagnostic(error, context = {}) {
  const declared = error?.archifyDiagnostic;
  const timeout = error?.name === 'TimeoutError' || /timeout|timed out/i.test(error?.message || '');
  const code = messages[declared?.code] ? declared.code : timeout ? 'ACTION_TIMEOUT' : /expect\(|AssertionError/.test(error?.message || '') || error?.name === 'AssertionError' ? 'ASSERTION_FAILED' : 'UNKNOWN_FAILURE';
  const result = { code, message: messages[code] };
  const details = { ...context, ...declared };
  if (Number.isFinite(details.timeoutMs) && details.timeoutMs >= 0 && details.timeoutMs <= 3600000) result.timeoutMs = details.timeoutMs;
  if (typeof details.operation === 'string' && /^[A-Z][A-Za-z0-9_]{1,79}$/.test(details.operation)) result.operation = details.operation;
  for (const key of ['pageErrors', 'requestFailures', 'httpErrors']) if (Number.isSafeInteger(details[key]) && details[key] >= 0) result[key] = details[key];
  return result;
}
