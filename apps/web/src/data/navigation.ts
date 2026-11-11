import { pages as originalPages } from './pages';
import type { PageSpec } from '../types';
const words=(text:string)=>text.replace(/Journey Builder/g,'流程編輯器').replace(/Journey 設計/g,'測試流程').replace(/Journeys/g,'測試流程列表').replace(/Journey/g,'測試流程').replace(/Test Suites/g,'測試集合').replace(/Suite/g,'測試集合');
const shortDescriptions:Record<string,string>={dashboard:'查看測試結果與待辦事項。',journeys:'把使用者操作整理成一組測試步驟。',builder:'編輯步驟、預期結果與程式碼依據。',review:'確認流程內容，再核准版本。',suites:'將多個測試流程組成一次執行。',evidence:'查看測試步驟的程式碼來源。',project:'管理這個專案的測試與來源。',gitlab:'管理程式碼來源。',scans:'查看掃描進度與結果。'};
export const pages:PageSpec[]=originalPages.map(p=>({...p,group:words(p.group),title:words(p.title),subtitle:shortDescriptions[p.id]||words(p.subtitle),action:p.action?{...p.action,label:words(p.action.label)}:undefined,metrics:p.metrics?.map(m=>({...m,label:words(m.label),note:words(m.note)})),columns:p.columns?.map(words),rows:p.rows?.map(row=>row.map(words)),sections:p.sections.map(s=>({...s,title:words(s.title),body:s.body&&words(s.body),items:s.items?.map(words)}))}));
pages.push(
 {id:'e2e-batch',group:'E2E 自動化測試',title:'批次執行',subtitle:'',route:'/e2e/batches',sections:[]},
 {id:'automation-cases',group:'E2E 自動化測試',title:'自動化案例庫',subtitle:'',route:'/e2e/cases',sections:[]},
 {id:'web-e2e',group:'E2E 自動化測試',title:'Web Playwright',subtitle:'',route:'/e2e/web',sections:[]},
 {id:'android-e2e',group:'E2E 自動化測試',title:'Android Appium',subtitle:'',route:'/e2e/android',sections:[]},
 {id:'e2e',group:'測試流程',title:'E2E 自動化測試',subtitle:'管理網頁與 Android 多裝置端到端測試流程。',route:'/e2e',sections:[]},
 {id:'llm-status',group:'LLM',title:'連線狀態',subtitle:'查看各個 Agent 與模型連線的最近驗證結果。',route:'/assistant/status',sections:[]},
 {id:'git-connections',group:'工作台',title:'Git 管理',subtitle:'',route:'/git/connections',sections:[]},
 {id:'api-tests',group:'測試流程',title:'單點 API 測試',subtitle:'從前端建立請求，驗證回應並追蹤版本對測試的影響。',route:'/api-tests',sections:[]},
 {id:'chat',group:'AI 助理',title:'AI 對話',subtitle:'選擇 Agent，一起規劃與分析測試。',route:'/assistant/chat',sections:[]},
 {id:'agents',group:'LLM',title:'Agent 管理',subtitle:'設定不同助理的角色與工作指示。',route:'/assistant/agents',sections:[]},
 {id:'llm',group:'LLM',title:'模型連線',subtitle:'選擇帳號登入或 API 連線方式。',route:'/assistant/connections',sections:[]},
);
const dashboard = pages.find(page => page.id === 'dashboard')!;
dashboard.title = '總覽';
dashboard.subtitle = '掌握最近的測試結果與待辦事項。';
dashboard.action = undefined;
const runs = pages.find(page => page.id === 'runs')!;
runs.title = '執行紀錄';
runs.subtitle = '查看每次測試的執行結果與詳細紀錄。';
runs.action = undefined;
const reports=pages.find(page=>page.id==='reports')!;
reports.subtitle='批次執行的品質報告，可查看結果或下載 PDF。';
reports.action=undefined;
const suites = pages.find(page => page.id === 'suites')!;
suites.action = { label: '執行測試集合', target: 'run-new' };
pages.find(page => page.id === 'review')!.title = '流程審核';
pages.find(page => page.id === 'review')!.action = { label: '查看測試集合', target: 'suites' };
pages.push({ id: 'cases', group: '測試流程', title: '腳本案例庫', subtitle: '保存白話測試案例、腳本與內容版本。', route: '/cases', sections: [] });
for (const page of pages) {
  if (page.id === 'projects') Object.assign(page, { title: '測試專案', subtitle: '以測試版本記錄前端、中間層與後端三個倉庫。', action: undefined });
  if (page.id === 'project' || page.id === 'gitlab') Object.assign(page, { title: page.id === 'gitlab' ? '前端程式碼來源' : '測試版本', subtitle: page.id === 'gitlab' ? '僅取得前端 release 程式碼，本機前端透過 env 連到 dev。' : '保存前端、中間層與後端的 release commit、QA tag 與環境。', action: undefined });
  if (page.id === 'journeys') Object.assign(page, { title: '案例撰寫', subtitle: '和 AI 討論測試，查看流程與 TypeScript。', action: undefined });
  if (page.id === 'builder' || page.id === 'review') Object.assign(page, { title: '設定測試流程', subtitle: '命名、勾選案例、確認順序，再直接儲存。', action: undefined });
  if (page.id === 'suites') Object.assign(page, { title: '批次執行', group:'測試流程', subtitle: '', action: undefined });
  if (page.id === 'run-new') Object.assign(page, { title: '確認執行內容', subtitle: '確認流程、案例版本與測試資料。', action: undefined });
  page.rows = page.rows?.map(row => row.map(value => value.replace(/web-bff/g, 'archify-web（前端）').replace(/projects\.controller\.ts/g, 'src/api/projects.ts').replace(/favorites\.controller\.ts/g, 'src/api/favorites.ts')));
}
export const navigation=[
 {title:'工作台',ids:['dashboard','projects','git-connections']},
 {title:'測試流程',ids:['journeys','cases','api-tests','suites']},
 {title:'E2E 自動化測試',ids:['web-e2e','android-e2e','automation-cases','e2e-batch']},
 {title:'測試結果',ids:['runs','reports']},
 {title:'執行管理',ids:['schedules','jobs']},
 {title:'LLM',ids:['agents','llm']},
] as const;
