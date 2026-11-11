import type { Scenario } from './scenarioModel.js';
export interface ScriptMessage { role: 'user' | 'assistant'; text: string }
export interface CaseMetadata {
 title?:string;titleOrigin?:'user'|'agent';categorySuggestion?:string;objective?:string;
 preconditions?:string[];dataRefs?:string[];expectedResults?:string[];cleanup?:string[];
 requirementRefs?:string[];sourceRefs?:string[];assumptions?:string[];
 referenceCaseCode?:string;
}
export interface ScriptDraft {
  metadata?:CaseMetadata;
  caseCode?:string;
  categoryId?:string|null;
  maturity?:'candidate'|'draft';
  agentTask?:{id:string;draftRevision:number};
  verification?:{taskId:string;draftRevision:number;executionHash:string;platform:'android';engine:'appium';outcome:'passed';serial:string;bindings?:{sender:string;receiver:string}};
  caseType?: 'test' | 'flow';
  id: string;
  name: string;
  source: string;
  version: number;
  messages: ScriptMessage[];
  apiFlow?: {projectId:string;catalogId:string;environmentId:string;cases:{id:string;version:number;name?:string}[]};
  scenario?: Scenario;
  sourceScenarioKey?: string;
}

export const initialSource = `import { test, expect } from '@playwright/test';

test('首頁 Smoke', async ({ page }) => {
  await test.step('開啟本機首頁', async () => {
    await page.goto('/');
  });

  await test.step('確認主內容顯示', async () => {
    await expect(page.getByRole('main')).toBeVisible();
  });
});
`;

// This preview deliberately supports a small, explicit subset, not arbitrary TS.
export function previewSteps(source: string): string[] {
  return [...source.matchAll(/await\s+test\.step\(\s*(['"])([^'"\n]+)\1\s*,/g)].map(match => match[2]);
}

export function scriptStepLabels(draft: ScriptDraft): string[] {
  if (!draft.scenario) return previewSteps(draft.source);
  return [...draft.scenario.actions.filter(action => action.trim()),
    ...(draft.scenario.expected.trim() ? [`確認：${draft.scenario.expected}`] : [])];
}

export function exampleScript(request: string, name: string) {
  const label = JSON.stringify(name.trim() || '未命名測試');
  const note = request.replace(/[\r\n]+/g, ' ').slice(0, 500);
  return `import { test, expect } from '@playwright/test';

// 需求：${note}
// 固定示範模板，請依真實頁面修改定位與斷言。
// baseURL 與測試版本將由未來 Runner 注入。
test(${label}, async ({ page }) => {
  await test.step('開啟本機首頁', async () => {
    await page.goto('/');
  });

  await test.step('確認主內容顯示', async () => {
    await expect(page.getByRole('main')).toBeVisible();
  });

  await test.step('記錄頁面畫面', async () => {
    await page.screenshot({ path: 'artifacts/home.png' });
  });
});
`;
}

