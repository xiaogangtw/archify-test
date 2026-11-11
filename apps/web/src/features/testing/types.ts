export type TestKind = 'api' | 'playwright' | 'visual';
export type BrowserActionKind = 'goto' | 'click' | 'fill' | 'visible';

export interface BrowserAction {
  id: string;
  kind: BrowserActionKind;
  target: string;
  value: string;
}

export interface TestCase {
  projectId?: string;
  apiCaseId?: string;
  apiCatalogVersion?: number;
  id: string;
  version: number;
  name: string;
  kind: TestKind;
  description: string;
  target: string;
  expected: string;
  method: string;
  expectedStatus: number;
  actions: BrowserAction[];
  baseline: string;
  viewport: { width: number; height: number };
}

export interface FrontendProject {
  sourceType?: 'git' | 'upload';
  id?: string;
  sourceSnapshotId?: string;
  importedFileCount?: number;
  importedAt?: string;
  name: string;
  repositoryUrl: string;
  branch: string;
  websiteUrl: string;
  bffRepositoryUrl?: string;
  backendRepositoryUrl?: string;
  frontendConnectionId?: string;
  bffConnectionId?: string;
  backendConnectionId?: string;
}

export interface FlowStep {
  id: string;
  caseId: string;
  caseVersion: number;
  snapshot: TestCase;
}

export interface TestFlow {
  id: string;
  name: string;
  version: number;
  steps: FlowStep[];
  projectId: string;
  variables: Record<string, string>;
  updatedAt: string;
}

export interface TestingData {
  projects?: FrontendProject[];
  project: FrontendProject;
  cases: TestCase[];
  flows: TestFlow[];
}

export const kindNames: Record<TestKind, string> = {
  api: 'API 測試',
  playwright: '瀏覽器操作',
  visual: '畫面比對',
};

export const kindDescriptions: Record<TestKind, string> = {
  api: '檢查前端呼叫 API 的回應。',
  playwright: '以 Playwright 開啟頁面、填表與點擊。執行器尚未串接。',
  visual: '比較頁面截圖與基準圖。執行器尚未串接。',
};

