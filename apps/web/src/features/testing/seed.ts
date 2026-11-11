import type { TestCase, TestingData } from './types';

const base: Omit<TestCase, 'id' | 'name' | 'kind' | 'target' | 'expected'> = {
  version: 1,
  description: '',
  method: 'GET',
  expectedStatus: 200,
  actions: [],
  baseline: '',
  viewport: { width: 1280, height: 720 },
};

export const seedCases: TestCase[] = [
  { ...base, id: 'case-projects', name: '取得專案列表', kind: 'api', target: '/bff/projects', expected: '狀態碼 200，items 為陣列。', description: '示範案例，預期結果由測試者定義。' },
  { ...base, id: 'case-project-detail', name: '查看專案詳情', kind: 'api', target: '/bff/projects/{{projectId}}', expected: '狀態碼 200，id 與指定專案一致。' },
  { ...base, id: 'case-favorite', name: '加入收藏', kind: 'api', target: '/bff/favorites', expected: '狀態碼 201，回傳指定的 projectId。', method: 'POST', expectedStatus: 201 },
  {
    ...base, id: 'case-browser-login', name: '登入網站', kind: 'playwright', target: '/login', expected: '登入後可看到帳號選單。',
    actions: [
      { id: 'login-1', kind: 'goto', target: '/login', value: '' },
      { id: 'login-2', kind: 'fill', target: '[data-testid="email"]', value: '{{testEmail}}' },
      { id: 'login-3', kind: 'fill', target: '[data-testid="password"]', value: '{{secretRef}}' },
      { id: 'login-4', kind: 'click', target: '[data-testid="login-submit"]', value: '' },
      { id: 'login-5', kind: 'visible', target: '[data-testid="account-menu"]', value: '' },
    ],
  },
  { ...base, id: 'case-browser-project', name: '點開專案卡片', kind: 'playwright', target: '/projects', expected: '專案詳情標題出現在頁面。', actions: [{ id: 'browse-1', kind: 'goto', target: '/projects', value: '' }, { id: 'browse-2', kind: 'click', target: '[data-testid="project-card"]', value: '' }, { id: 'browse-3', kind: 'visible', target: '[data-testid="project-title"]', value: '' }] },
  { ...base, id: 'case-home-visual', name: '首頁桌機畫面', kind: 'visual', target: '/', expected: '首頁版面與已保存的基準圖一致。', baseline: '首頁桌機版（尚未建立）' },
];

export const seedTestingData: TestingData = {
  project: { name: 'Archify Web', repositoryUrl: '', branch: 'release', websiteUrl: '' },
  cases: seedCases,
  flows: [{
    id: 'flow-projects', name: '瀏覽專案', version: 1, projectId: 'archify-web',
    steps: seedCases.slice(0, 2).map((testCase, index) => ({ id: 'flow-step-' + index, caseId: testCase.id, caseVersion: testCase.version, snapshot: testCase })),
    variables: { projectId: 'demo-project-17' }, updatedAt: '2026-10-23T00:00:00.000Z',
  }],
};


