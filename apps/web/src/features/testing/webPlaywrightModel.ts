import type { ScriptMessage } from './scriptModel';

export const browserOptions = [{ value: 'chromium', label: 'Chromium' }, { value: 'webkit', label: 'WebKit' }];
export const viewportOptions = [{ value: 'mobile-small', label: '小型手機 · 360 × 740' }, { value: 'mobile', label: '手機 · 390 × 844' }, { value: 'mobile-large', label: '大型手機 · 430 × 932' }];
export const dataOptions = [{ value: 'normal', label: '一般輸入' }, { value: 'chinese', label: '超長中文' }, { value: 'english', label: '無空白英文' }, { value: 'multiline', label: '多行文字' }, { value: 'boundary', label: '長度邊界' }];
export const ruleOptions = [{ value: 'overflow', label: '頁面水平溢出' }, { value: 'clipping', label: '指定容器裁切' }, { value: 'overlap', label: '指定元件重疊' }, { value: 'button', label: '按鈕可見與可操作' }];
export interface WebCase {
  id: string; name: string; url: string; environment: string; login: string;
  browsers: string[]; viewports: string[]; inputs: string[]; rules: string[];
  scope: string; source: string; messages: ScriptMessage[];
}
export const webCaseKey = (projectId: string) => `archify.web-playwright.v1.${projectId}`;
export function removeLegacyWebPlans(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, projectId: string): void {
  const key = `archify.e2e-plans.v1.${projectId}`;
  const raw = storage.getItem(key);
  if (!raw) return;
  let rows: unknown;
  try { rows = JSON.parse(raw); } catch { throw new Error('舊 Web 草稿清理失敗：資料格式損壞，未刪除無法辨識的內容。'); }
  if (!Array.isArray(rows)) throw new Error('舊 Web 草稿清理失敗：資料格式損壞，未刪除無法辨識的內容。');
  const remaining = rows.filter(row => row?.platform !== 'web');
  if (remaining.length === rows.length) return;
  if (remaining.length) storage.setItem(key, JSON.stringify(remaining));
  else storage.removeItem(key);
}
export function newWebCase(): WebCase {
  return { id: crypto.randomUUID(), name: '', url: '', environment: '測試環境', login: 'none', browsers: ['chromium'], viewports: ['mobile'], inputs: ['normal'], rules: ['overflow', 'button'], scope: '', source: '', messages: [] };
}
export function validWebUrl(value: string): boolean {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
export function readWebCases(storage: Pick<Storage, 'getItem'>, projectId: string): WebCase[] {
  const raw = storage.getItem(webCaseKey(projectId));
  if (!raw) return [];
  const rows: unknown = JSON.parse(raw);
  const strings = ['id', 'name', 'url', 'environment', 'login', 'scope', 'source'] as const;
  const arrays = { browsers: browserOptions, viewports: viewportOptions, inputs: dataOptions, rules: ruleOptions };
  if (!Array.isArray(rows) || !rows.every(row => row && strings.every(key => typeof row[key] === 'string') &&
    ['none', 'test-state', 'session'].includes(row.login) && Object.entries(arrays).every(([key, options]) =>
      Array.isArray(row[key]) && row[key].length > 0 && new Set(row[key]).size === row[key].length && row[key].every((value: unknown) => options.some(option => option.value === value))) &&
    Array.isArray(row.messages) && row.messages.every((message: ScriptMessage) => message && ['user', 'assistant'].includes(message.role) && typeof message.text === 'string')) || new Set(rows.map(row => row.id)).size !== rows.length) {
    throw new Error('無法讀取 Web 案例，原始資料未被覆蓋。');
  }
  return rows;
}
export function caseErrors(draft: WebCase): string[] {
  return [!draft.name.trim() && '請填寫案例名稱。', !validWebUrl(draft.url) && '請填寫不含帳密的完整 HTTP 或 HTTPS 網址。',
    !draft.environment.trim() && '請填寫測試環境名稱。', !draft.source.trim() && '請填寫或產生 TypeScript 腳本。',
    (!draft.browsers.length || !draft.viewports.length || !draft.inputs.length || !draft.rules.length) && '瀏覽器、尺寸、輸入資料與檢查規則各需至少選一項。'].filter((value): value is string => !!value);
}
export const matrixCount = (rows: WebCase[]) => rows.reduce((sum, row) => sum + row.browsers.length * row.viewports.length * row.inputs.length, 0);
