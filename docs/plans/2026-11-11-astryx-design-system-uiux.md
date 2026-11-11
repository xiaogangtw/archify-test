# 導入 Astryx Design System 與全面重整工作區 UI/UX

## 範圍
- 於 `.agents/skills/astryx/` 安裝來自 `meta/astryx`（`@astryxdesign/cli@0.7.13`）的官方 skill 與設計規範參考，保留專案原有 `AGENTS.md` 治理規則。
- 依據 `apps/web/tailwind.config.ts` 單一 token 來源建立 Astryx 結構的共用意圖元件系統（`apps/web/src/components/ui/ds/` + `WorkspaceIcons.tsx`），補齊 `surface-subtle` 與 `surface-active` 表面階層語意色，維持既有 `body`、`heading`、`fontWeight`、`borderRadius` 與 `.app-shell` CSS 規則不變。
- 全面重整現行工作區與報告閱讀器介面（`WorkspaceApp`、`SetupWizard`、`SourceWorkspace`、`CatalogWorkspace`、`FeatureMap`、`MapDetails`、`CaseEditor`、`GapReport`、`FlowWorkspace`、`ScriptWorkspace`、`ConfiguredReports`、`ReportReader`、`UiTestEnvironment`、`KnowledgeWorkspace`、`KnowledgeImport`、`AiJobStatus`、`WorkspaceDialog`），精簡冗長 AI 說明文字、消除重複 JSX 外殼與原生散落樣式，提升排版層次、表單兩欄對齊、工具列切換與狀態可視性。
- 不包含：恢復舊版 Dashboard / Control API / 聊天 Agent、修改後端 API 契約、執行真實產品測試或儲存在倉截圖檔案。

## 影響檔案
- `.agents/skills/astryx/SKILL.md`、`.agents/skills/astryx/references/*.md`（本地忽略目錄）
- `apps/web/tailwind.config.ts`
- `apps/web/src/components/ui/ds/Primitives.tsx`、`apps/web/src/components/ui/ds/WorkspaceShell.tsx`、`apps/web/src/components/ui/ds/WorkspaceIcons.tsx`、`apps/web/src/components/ui/ds/index.ts`
- `apps/web/src/features/workspace/*.tsx`
- `apps/web/src/features/reader/ReportReader.tsx`
- `DESIGN.md`

## 資料庫影響
無；純前端設計系統、元件重構與靜態文件同步。

## 風險
- 既有瀏覽器 gate 腳本（`verify-local-workspace-ui.mjs`、`verify-catalog-ui.mjs`、`verify-script-inventory-ui.mjs`、`verify-case-plans-ui.mjs`、`verify-reader-ui.mjs`、`verify-knowledge-ui.mjs`、`verify-website-ai-ui.mjs`、`verify-frontend-overview-ui.mjs`、`verify-ui-reports-ui.mjs`）依賴特定按鈕無障礙名稱、DOM 文字、`<main>` 按鈕數量、按鈕最小 32x24 尺寸、AA 對比與開發模式 CSS 解析；重構必須完整保留對應標籤與尺寸契約，並以實際 Headless Chrome 跑完所有受影響視圖檢查。
- `apps/web/tailwind.config.ts` 不得新增未經 `verify-reader-ui.mjs` 允許的字級／字重／圓角鍵值，或改動 `spacing.sidebar`（`16rem`）與 `api-shell`（`12rem minmax(0, 1fr)`）。

## 設計文件同步
- 已更新 [DESIGN.md](../../DESIGN.md)（v1.24）：記錄 Astryx（`.agents/skills/astryx/`）設計方法落地、新增 `surface-subtle`／`surface-active` 表面階層語意色、`map-browser` 14rem、`apps/web/src/components/ui/ds/` 共用意圖設計系統與工作區精簡重整，並標明未改路由、守衛、導向、API、GraphQL payload 或 DB schema。
- 已同步 [apps/web/README.md](../../apps/web/README.md)（v2.30）：記錄 `src/components/ui/ds/` 共用設計系統位置與現行 UI 入口一致。

## 領域
前端、設計系統、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- `npm.cmd run build --prefix apps/web`：通過（`tsc -b && vite build` 完成，`dist/assets/` 產出成功）。
- `node scripts/verify-reader-dev-css.mjs`：通過（`PASS: root-cwd Vite development CSS resolves sidebar token and reader utilities`）。
- `node scripts/verify-feature-graph.mjs`：通過（功能節點、階層與覆蓋計算正確）。
- 靜態原始碼門檻（`apps/web/src/components/ui/ds/*`、`features/workspace/*`、`features/reader/*`）：通過（無行內 `style=`、無 `<select>`、無硬編碼 `#hex`、無 emoji）。
- Tailwind Token 合規檢查（`esbuild` 解析 `apps/web/tailwind.config.ts`）：通過（`body: 0.875rem`、`heading: 1.25rem`、`fontWeight: 400/500/700`、`borderRadius.lg: 0.5rem`、`borderRadius.xl: 0.75rem`）。
- 無頭 Chrome 完整互動與視圖驗證（涵蓋 `SetupWizard`、`SourceWorkspace`、`CatalogWorkspace` 地圖／清單／缺口報表／`CaseEditor`／`MapDetails`、`FlowWorkspace`、`ScriptWorkspace`、`ReportReader`＋`ConfiguredReports`、`KnowledgeWorkspace`）：通過（對比 >= 4.5:1、按鈕高度 >= 32px 且寬度 >= 24px、`ScriptWorkspace` 按鈕 14px、焦點環 `boxShadow` 非 `none`、`prefers-reduced-motion: reduce` 動畫與 transition 為 `0s`、390/1024/1280/1440/1920 及 200% 縮放無水平溢位、0 個 `pageerror`；因本機未安裝 `.local/gate-deps/node_modules/axe-core`，未包含 axe 自動掃描規則）。
- `npm.cmd run docs:plans:index`、`npm.cmd run docs:check`：通過。
- 既有未變動模組註記：`npm test` 為 21/22 通過（預先存在的 `test-project/framework/case-narrative.test.mjs:7` 敘述字串差異未改動）；`npm run test:workspace` 46/51 通過，另 5 項因 Windows 沙盒權限／本機迴圈連線限制（`EPERM symlink` 與 Playwright/Appium 測試案例）受阻。
