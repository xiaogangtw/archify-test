export type FailurePolicy = 'stop' | 'continue' | 'skip-dependent';
export interface Scenario {
  feature: string;
  intent: string;
  setup: string;
  data: string;
  actions: string[];
  expected: string;
  forbidden: string;
  failure: FailurePolicy;
  confirmed: boolean;
}
export const emptyScenario = (): Scenario => ({ feature: '', intent: '', setup: '', data: '', actions: [], expected: '', forbidden: '', failure: 'skip-dependent', confirmed: false });
export const failureNames: Record<FailurePolicy, string> = {
  stop: '停止這個流程', continue: '記錄失敗，繼續不依賴此結果的步驟',
  'skip-dependent': '略過需要此結果的步驟，其他繼續',
};
export function missingScenario(scenario: Scenario): string[] {
  const missing: string[] = [];
  if (!scenario.feature.trim()) missing.push('要測的功能');
  if (!scenario.intent.trim()) missing.push('要確認的事情');
  if (!scenario.setup.trim()) missing.push('測試前準備');
  if (!scenario.data.trim()) missing.push('測試資料');
  if (!scenario.actions.length || scenario.actions.some(action => !action.trim())) missing.push('操作步驟');
  if (!scenario.expected.trim()) missing.push('明確的預期結果');
  else if (/^(正常|成功|沒問題|可以用|應該正常)[。！!\s]*$/.test(scenario.expected.trim())) missing.push('預期結果太籠統，請說明看到的文字或資料');
  if (!scenario.confirmed) missing.push('確認預期結果符合需求');
  return missing;
}
export function registrationExample(): Scenario {
  return { feature: '註冊', intent: '重複 Email 不可以建立第二個帳號', setup: '已建立一個測試帳號', data: '使用測試帳號 A 的 Email；密碼使用憑證參照', actions: ['開啟註冊頁', '填入已註冊的 Email 與有效的其他必填資料', '送出註冊'], expected: '顯示「帳號已存在」提示', forbidden: '建立第二個相同 Email 的帳號', failure: 'skip-dependent', confirmed: false };
}
export function scenarioScaffold(name: string, scenario: Scenario): string {
  const metadata = JSON.stringify({ ...scenario, name }, null, 2);
  const steps = scenario.actions.filter(Boolean).map(action => `  await test.step(${JSON.stringify(action)}, async () => {\n    // 待補：實際頁面定位與操作。\n  });`).join('\n\n');
  return `import { test } from '@playwright/test';

const scenario = ${metadata};

test(${JSON.stringify(name || '未命名案例')}, async () => {
  test.fixme(true, '案例規格草稿：定位、斷言及相依處理尚未實作');
  // 預期結果、失敗策略與相依條件皆尚未轉成可執行邏輯。
${steps}
});
`;
}
export function isScenario(value: unknown): value is Scenario {
  if (!value || typeof value !== 'object') return false;
  const item = value as Scenario;
  return ['feature', 'intent', 'setup', 'data', 'expected', 'forbidden'].every(key => typeof item[key as keyof Scenario] === 'string')
    && Array.isArray(item.actions) && item.actions.every(action => typeof action === 'string')
    && ['stop', 'continue', 'skip-dependent'].includes(item.failure) && typeof item.confirmed === 'boolean';
}

