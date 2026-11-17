# 初始設定前置 AI CLI、全面 Toast 通知與結構化 JSON 修復

## 範圍
- **4 步工作區引導精靈（`SetupWizard`）與多 CLI／模型選擇**：在既有「前端來源 → 測試專案 → 專案知識」前新增第 1 步「AI CLI 設定」，支援切換 `Codex CLI`／`Claude Code CLI`／`Gemini CLI`、各工具本機安裝與登入狀態偵測、以無障礙 `Dropdown`（禁止原生 `<select>`）挑選本機快取／預設模型或自訂輸入模型、進階執行檔路徑設定、獨立「儲存 CLI 設定」與「測試 CLI 連線」按鈕，並在側欄及功能地圖顯示目前使用中的 AI 工具與模型名稱（非秘密摘要）。
- **設定保存與檢查契約（`services/local-workspace`）**：新增 `/local-api/ai-inspect`、`/local-api/ai-test`、`/local-api/ai-settings`，`GET /local-api/config` 回傳非秘密 `ai` 狀態摘要（含 `provider`、`providerLabel`、`supportsImages`、`model`）；在選出獨立測試專案前先保存非秘密 `aiProvider`／`aiCli`／`aiModel` 至平台 `.local/ai.json`（排除 Git），綁定或更新測試專案後同步寫入該專案 `.env`，維持程序環境變數 > 測試專案 `.env` > 平台 `.env` > `.local/ai.json` 優先序，不改動 `.local/workspace.json` 單一 `projectRoot` 結構。
- **多工具安全隔離與圖片邊界**：Codex／Claude Code／Gemini CLI 皆以 `shell: false`、唯讀／停用工具／停用外部設定或 MCP 的方式呼叫（與 `services/agents/adapter.mjs` 隔離原則對齊），其中知識圖片辨識維持僅 Codex CLI 支援，選用 Claude／Gemini 上傳圖片時明示拒絕並引導切回 Codex。
- **全面 Toast 化（「有錯誤或是辨識中」不再固定佔據上方）**：重整 `AiJobStatus` 與共用的 `WorkspaceToast`，於功能地圖、專案知識、知識匯入、工作區引導及工作區各頁將 AI 辨識／分析進度、完成通知與操作／驗證錯誤改以頂端置中浮動 Toast 呈現（分析中保留取消按鈕，完成／錯誤／通知均不設關閉按鈕並於 3 秒後自動退場），`useAiJob` 依工作類型區分且重載時只接續仍在執行中的背景工作，避免舊失敗橫幅一直固定在頁面頂端。
- **修復「`AI 未回傳合法 JSON，原資料保留。`」**：`runAiJson`（含 `runCodexJson`）支援直接傳入嚴格 JSON Schema（不再一律以 `resultJson` 字串二次轉義包覆），為功能分析、知識合併、候選檢索與圖片觀察提供對應結構化輸出指引與 JSON Schema，並在輸出解析器補齊 Markdown 圍欄剝除、安全診斷區分與 `parentId` 空字串正規化。
- 不包含：於瀏覽器接收或儲存 API key／token、恢復舊版 Control API／聊天 Agent，或修改產品端測試腳本與報告格式。

## 影響檔案
- `services/local-workspace/config.mjs`、`services/local-workspace/setup.mjs`、`services/local-workspace/workspace.mjs`、`services/local-workspace/plugin.mjs`、`test-project/.env.example`
- `services/local-workspace/ai-jobs.mjs`、`services/local-workspace/ai-analysis.mjs`、`services/local-workspace/knowledge-analysis.mjs`
- `apps/web/src/features/workspace/client.ts`、`useAiJob.ts`、`WorkspaceToast.tsx`、`AiJobStatus.tsx`、`SetupWizard.tsx`、`WorkspaceApp.tsx`、`CatalogWorkspace.tsx`、`KnowledgeWorkspace.tsx`、`KnowledgeImport.tsx`、`SourceWorkspace.tsx`、`FlowWorkspace.tsx`、`ScriptWorkspace.tsx`、`ConfiguredReports.tsx`、`UiTestEnvironment.tsx`
- 測試與瀏覽器 gate：`services/local-workspace/ai-cli.test.mjs`、`ai-analysis.test.mjs`、`knowledge.test.mjs`、`workspace.test.mjs`、`scripts/verify-knowledge-ui.mjs`、`scripts/verify-website-ai-ui.mjs`
- 規範與設計文件：`AGENTS.md`、`ARCHIFY-CURRENT-SPEC.md`、`README.md`、`docs/local-workspace.md`、`docs/website-ai-analysis.md`、`docs/frontend-feature-overview.md`、`docs/decisions/README.md`、`docs/decisions/2026-11-11-cli-setup-and-ai-toast.md`、`docs/decisions/2026-11-08-onboarding-clone.md`、`docs/decisions/2026-11-09-project-local-environment.md`

## 資料庫影響
無；本機工作區與檔案式 JSON／`.env` 設定。

## 風險
- `SetupWizard` 由 3 步改為 4 步，既有的瀏覽器測試 `scripts/verify-knowledge-ui.mjs` 依賴初始步驟標題與進度，必須同步更新並補測第 1 步互動與儲存邏輯。
- OpenAI／Codex CLI `--output-schema` 嚴格模式要求所有物件皆設定 `additionalProperties: false` 且全部欄位列於 `required`（可空欄位需用 `['string', 'null']` 等 union type）；需同時保留向下相容 `resultJson` 字串與 Markdown 圍欄解析，避免破壞現有單元測試或舊回應。
- 將錯誤與進度全面改為 Toast 時，不可破壞既有 `role="alert"`／`role="status"` 無障礙定位與 `verify-local-workspace-ui.mjs`、`verify-knowledge-assets-ui.mjs`、`verify-case-plans-ui.mjs`、`verify-script-inventory-ui.mjs`、`verify-ui-reports-ui.mjs`、`verify-catalog-ui.mjs` 的按鈕數量、對比度與 `390–1920px` 無水平溢位檢查。

## 設計文件同步
- 新增決策紀錄 `docs/decisions/2026-11-11-cli-setup-and-ai-toast.md`，並於 `docs/decisions/README.md`、相關既有決策、`AGENTS.md`、`ARCHIFY-CURRENT-SPEC.md`、`README.md`、`docs/local-workspace.md`、`docs/website-ai-analysis.md` 與 `docs/frontend-feature-overview.md` 同步 4 步引導、`.local/ai.json` 暫存邊界、新增 `/local-api/ai-inspect`／`ai-test`／`ai-settings` 契約、結構化 JSON Schema 與 Toast 行為。

## 領域
全端本機服務（Node.js）、前端 UI／UX（React + TypeScript）、AI CLI 整合、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
- `npm.cmd run build --prefix apps/web`：通過（`tsc -b && vite build` 完成，64 modules，`dist/assets/` 產出成功）。
- `node --test services/local-workspace/ai-cli.test.mjs services/local-workspace/ai-analysis.test.mjs services/local-workspace/knowledge.test.mjs services/local-workspace/required-setup.test.mjs`：13/13 通過（含 Codex／Claude Code／Gemini CLI 隔離參數、圖片僅限 Codex、多工具 `inspectAiCli` 模型清單、直接結構化 schema、Markdown 圍欄容錯、`.local/ai.json` 含 `aiProvider`／`aiModel` 與測試專案 `.env` 同步且維持 `.local/workspace.json` 僅含 `projectRoot`）。
- `npm.cmd run test:workspace`（前次完整回歸）：46/51 通過，5 項受 Windows 沙盒權限／本機迴圈連線限制（`workspace.test.mjs` `EPERM symlink`、`playwright.test.mjs`、`reusable-api.test.mjs`、`ui-report.test.mjs` x2）未通過。
- `npm.cmd test`（前次完整框架測試）：21/22 通過（既有未變動 `test-project/framework/case-narrative.test.mjs:7` 失敗）。
- `node scripts/verify-reader-dev-css.mjs`、`node scripts/verify-feature-graph.mjs`、`apps/web/tailwind.config.ts` Token 檢查：均通過。
- Headless Chromium 實機 DOM／互動／指標驗證（`scratch/verify-ui-bundle.mjs`，於最終建置後重跑）：通過 4 步 `SetupWizard`（切換 Codex／Claude Code／Gemini、`Dropdown` 模型選擇＋自訂模型名稱、獨立「儲存」與「測試連線」Toast、無重複 `Gemini CLI CLI`、重開工作區設定後切換回傳）、側欄即時更新 `AI：Codex · o4-mini` 與 `AI：Claude Code · sonnet`、所有錯誤／完成／通知 Toast 3 秒自動消失且無關閉按鈕、`CatalogWorkspace` 與 `KnowledgeWorkspace` 浮動 Toast 及重載不重現、`FlowWorkspace` 按鈕數維持 3、靜態 `style=`/`<select>`/emoji/`#hex` 檢查、按鈕尺寸 >= 32x24、對比 >= 4.5:1、Tab 焦點環、reduced motion、390–1920px 與 200% 縮放無水平溢位及 0 `pageerror`。
- 未完成／受阻範圍：`scripts/verify-knowledge-ui.mjs` 與 `scripts/verify-website-ai-ui.mjs` 因本機未安裝 `.local/gate-deps/node_modules/axe-core/axe.min.js` 而無法完成 `axe-core` 自動掃描；未執行真實遠端 Codex／Claude／Gemini CLI 端對端連線呼叫（僅檢查本機 `codex --help`／`exec --help`／`login --help` 旗標與子程序模擬）。
- `npm.cmd run docs:plans:index`、`npm.cmd run docs:check`：通過。
