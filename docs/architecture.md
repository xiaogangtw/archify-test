# 架構與維護地圖

文件版本：1.24

最後更新：2026-11-11

測試報告分 API 與畫面兩類，畫面標示 web／android，分別固定寫入獨立專案 reportDir/api、reportDir/ui，日期時間命名並輸出 JSON／HTML／TXT。schemaVersion 1 新增 testType、screenshotsEnabled、target、dataMode、screenshots，保留舊根目錄報告。config/report.json 的截圖預設關閉，網站可保存下次執行選項；僅新版畫面 fixtures 在開啟時擷取 PNG，API 不留圖。一般畫面使用本機前端 WEB_BASE_URL 與 LIFF mock，並對實際 BFF 資料及 DOM 分別斷言；原生推播另使用 Appium。網站可啟動既有本機 AVD／Appium及選裝置，不提供產品腳本執行，不恢復 VM／舊 Control API。依使用者補充，本輪只準備框架與環境，不開啟 LINE、不擷取實際手機畫面、不發送推播。完整契約見 docs/ui-testing-reports.md。

知識上傳每來源最多 10 MB，每批 20 份、總共 20 MB；支援 MD／HTML／TXT／PNG／JPEG／WebP。原始文件與圖片保存 knowledge/sources，整理文字仍採每份 128 KB、最多 500 份的有效知識；索引 sources 與 README 連結保留原始證據。大型來源逐段分析，超過模型容量的現有知識先檢索候選再比對全文，未選中資料不刪除。圖片只認可見文字及版面，不推測動作或後端，強制標記用途未指定。知識頁可查看原圖及下載原檔；新增 POST /local-api/knowledge-source（id／sha256），同來源 session、路徑、大小與 hash 驗證。完整限制見網站 AI 文件。

## 本機分析框架與閱讀器

apps/web/src/main.tsx 掛載 WorkspaceApp，以 SetupWizard 設定、SourceWorkspace 分析來源、KnowledgeWorkspace 分類／編修文字知識、CatalogWorkspace 管理功能（含摺疊單一純容器 L1 系統外殼、群組覆蓋彙整、分支鑽研與返回／階層麵包屑）、獨立測試清單與 GapReport 雙向缺口覆蓋報表，FlowWorkspace 以同一 catalog 呈現唯讀案例表格（含測試因子與決策矩陣），規劃與實作回到本機測試專案；feature-graph.ts 依既有資料建立純圖模型，FeatureMap 提供原生 SVG 視窗／拖曳／鍵盤操作、頂列返回／階層麵包屑與節點懸停完整名稱讀數列，MapDetails 按需提供節點詳情（含階層麵包屑與子功能鑽研）、ReportReader 閱讀報告。services/local-workspace/plugin.mjs 掛接 Vite dev／preview 同來源 middleware；config.mjs 讀取平台 .env，paths.mjs 檢查邊界與連結，scan.mjs 重用純 AST 模組，workspace.mjs 管理初始化／掃描／生成／讀取。沒有新 DB 或遠端 worker；受控本機 CLI 分析功能與知識，案例規劃與腳本實作使用外部本機 AI 工具。

產品測試寫入平台與來源之外的獨立專案；test-project 僅是框架交付範本。生成器 api-source.mjs 配對建立 api/*.ts 與 tests/api/*.spec.ts；tests/flows/ 匯入相同 API 模組，共用傳輸在 support/api-client.mts，資料與斷言分層，CLI 不 import 平台。reusable-api-migration.mjs 以 AST 核對靜態 operation、預檢、hash 與備份完成明確遷移，動態／碰撞保留。分析快照保存於指定 analysis 目錄，報告讀取指定 report 目錄。完整契約、失敗與相容性見[本機分析文件](local-workspace.md)。舊模組表格只作維護／遷移參照。

## 修訂紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| 1.24 | 2026-11-11 | 優化 `feature-graph.ts`、`FeatureMap.tsx`、`CatalogWorkspace.tsx`、`MapDetails.tsx`、`GapReport.tsx`、`WorkspaceIcons.tsx` 與 `WorkspaceShell.tsx`：支援 L1 系統外殼摺疊、群組覆蓋彙整與分支鑽研、返回／麵包屑、樹狀側欄（去紅點、無滾條獨立捲動區塊與可收合記憶資料夾）、懸停完整名稱列及清單上下文保留；未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.23 | 2026-11-11 | 調整 `workspace.mjs` 初始化新專案寫入空 `test-cases/catalog.json`，並於 `setup()` 掃描後自動非覆寫產生單支 API 草稿；未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.22 | 2026-11-11 | 修正 `directory-picker.mjs` 以置頂前景 `IFileOpenDialog` 開啟現代 Windows 資料夾視窗，並在 `workspace.mjs` 與 `plugin.mjs` 支援重開取代／連線中斷中止舊選擇程序；未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.21 | 2026-11-11 | 功能地圖補齊灰色廢棄狀態、`factor` 測試因子與 `decisionTable` 決策矩陣表，新增 `GapReport` 缺口與覆蓋報表；未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.20 | 2026-11-11 | 調整根目錄 workspaces 為 apps/web 與 test-project（移除 services/control-api 預設安裝並清理已停用舊服務腳本），加入 Node.js >=22.18.0 engines 約束，並新增功能地圖覆蓋率三色標註與分層切換；未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.19 | 2026-11-08 | 報告 API／畫面分類、可選截圖及 TXT，加入本機網頁／Appium fixtures 與受控環境端點；未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.18 | 2026-11-08 | 加入 10 MB 知識來源、圖片辨識、分段整理與原始資產預覽／下載；新增 knowledge-source 本機契約，未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.17 | 2026-11-08 | FlowWorkspace 改為唯讀表格與 case-plans 端點，移除日常確認要求；未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.16 | 2026-11-08 | 加入 FlowWorkspace 案例表格、共享案例確認工具與規劃／實作 skill 分工；新增 case-confirm 本機契約，未改產品 API、GraphQL payload、守衛、導向或 DB schema。 |
| 1.15 | 2026-11-08 | 改為網站按鈕啟動受控本機 Codex 功能／知識分析，支援 HTML、語意去重取代及可還原封存；新增 AI 工作／狀態／取消／還原本機契約，未改產品 API、GraphQL payload、頁面路由、守衛或 DB schema。 |
| 1.14 | 2026-11-08 | 新增前端功能證據包、本機 AI 提案驗證及版本核對套用，總覽與產品／測試分層；新增 frontend-features-prepare／apply 本機契約，未改產品 API、GraphQL payload、守衛、DB schema 或既有頁面路由。 |
| 1.13 | 2026-11-08 | 依使用者校正改為預設 SVG 節點連線地圖，支援縮放平移、節點拖曳與按需詳情；測試清單獨立，表單收斂且技術編號自動產生。未改產品 API、GraphQL payload、守衛、導向、DB schema 或既有本機 API 契約。 |
| 1.12 | 2026-11-08 | 新增專案知識分類編修、固定案例目錄、腳本關聯地圖與依賴／意圖版本提示；新增 catalog／knowledge-update 本機契約及 view=catalog／knowledge 入口，未改產品 API、GraphQL payload、守衛或 DB schema。 |
| 1.11 | 2026-11-07 | 改用 api 請求模組與單支／流程測試分層，新增配對生成、共用呼叫契約與明確備份遷移；本機 generate 回傳新增 apiModules，未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.10 | 2026-11-07 | 通用／匿名 GraphQL 名稱改取頂層實際欄位作檔名與顯示名，支援 alias／fragment 與碰撞；舊檔仍辨識，未改路由、守衛、導向、產品 GraphQL payload 或 DB schema。 |
| 1.9 | 2026-11-07 | 新稿只保留請求資料及最小略過標記，不產生通用 scenario、步驟或斷言，由 AI 後續撰寫；保留 query／variables，未改路由、守衛、導向、API payload、GraphQL payload 或 DB schema。 |
| 1.8 | 2026-11-07 | GraphQL 草稿帶入前端呼叫的 variables 結構及非秘密常數，動態／衝突值保留占位符，query 多行顯示；保留 GraphQL 變數引用，未改路由、守衛、導向、API 契約或 DB schema。 |
| 1.7 | 2026-11-07 | 合併重疊分析讀取並等待既有檔案操作，修正開發模式重複載入誤報忙碌；寫入仍拒絕重複送出，未改路由、守衛、導向、API payload、GraphQL payload 或 DB schema。 |
| 1.6 | 2026-11-07 | 新增來源同步索引、消失腳本候選與確認封存／非覆寫還原；新增本機 archive-removed、restore-removed 契約，未改路由、守衛、導向、GraphQL payload 或 DB schema。 |
| 1.5 | 2026-11-07 | 加入三步工作區設定與獨立專案 Agent 知識庫，新增本機設定／知識契約與知識庫導覽；未改既有路由、守衛、GraphQL payload 或 DB schema。 |
| 1.4 | 2026-11-07 | 新稿改為單一原生 Playwright .spec.ts，接入略過／實際步驟報告並保留舊稿；初始化格式升為 2，本機 caseFile 指向新格式，未改路由、GraphQL payload 或 DB schema。 |
| 1.3 | 2026-11-07 | 加入 .env 控制的本機來源分析、獨立測試專案初始化、單點 API 草稿與報告目錄讀取；新增 /local-api 契約與分析導覽，未改既有 API、GraphQL payload 或 DB schema。 |
| 1.2 | 2026-11-07 | 預設入口改為無後端的本機流程／報告閱讀器，加入獨立測試專案；替換原入口與後端守衛，不再進入舊導覽，未改既有 API、GraphQL payload 或 DB schema。 |
| 1.1 | 2026-11-02 | Runner 領取、心跳與事件回報抽離為 runnerRoutes；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.0 | 2026-11-02 | 查證程式入口、責任、共用契約與後續拆分順序；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |

本文件回答「改哪裡、如何驗證」，功能與限制仍以[目前規格](../ARCHIFY-CURRENT-SPEC.md)及專題文件為準。以下是靜態程式盤點，不是部署驗收。

## 目錄責任與入口

| 位置 | 責任與閱讀入口 | 驗證入口（根目錄執行） |
| --- | --- | --- |
| `apps/web` | React 閱讀器；`src/main.tsx` 掛載 `features/workspace/WorkspaceApp.tsx`，`report.ts` 驗證 JSON。舊 App 未掛載 | `npm run build --prefix apps/web`；UI 另依 AGENTS.md 實際操作與 gates |
| `services/local-workspace` | 本機設定、路徑邊界、AST 掃描、獨立專案與非覆寫生成；Vite dev／preview middleware | `npm run test:workspace`、本機 UI gate |
| `test-project` | 交付用獨立框架範本，產品測試實際放在平台外 | `npm test` |
| `services/control-api` | `src/main.ts` 組裝 Fastify、授權 hook、路由與工作；現行本機掃描／功能分析仍重用其 `requestCatalog.ts` 與 `sourceModuleResolver.ts`，目錄保留但已移出根 workspaces | 依舊服務封存狀態按需單獨安裝後執行 `npm run check --prefix services/control-api`、`npm run test:legacy`（舊服務） |
| `services/android` | `worker.mjs` 為舊 Windows 執行入口；流程契約與測試保留 | `npm run android:test`；真機另依專題驗證 |
| `services/agents` | 舊模型橋接服務（已停用對應根腳本） | 歷史參照 |
| `services/launcher` | 舊隔離 Runner 啟動器（已停用對應根腳本） | 歷史參照 |
| `services/runner` | `harness.mjs`、`reporter.cjs` 歷史隔離執行器 | 歷史參照 |
| `services/mobile` | `mac-check.mjs` 舊唯讀前置檢查（已移除根腳本） | 僅歷史參照 |
| `scripts` | 本機啟動、部署輔助、回歸及上游設計檢查混存；先查 package.json，再讀腳本用法 | 不把上游套件自測視為 Archify 驗收 |
| 根目錄設計參考資料夾 | `components/`、`tokens/` 等上游設計參考（已移除未引用的 `examples/` 與 `design-systems/library/`） | 不作為前端 token 權威來源 |

根 `package.json` 的 npm workspaces 包含 `apps/web` 與 `test-project`（`npm install` 一次完成前端與獨立範本依賴安裝），並宣告 `engines.node >=22.18.0`；舊 `services/control-api` 已移出預設 workspaces。

## 舊模組變更入口（遷移參照）

| 要修改的行為 | 優先閱讀 |
| --- | --- |
| 導覽、頁面常駐與離頁保護 | `apps/web/src/App.tsx`、`data/navigation.ts`、`features/testing/TestingPages.tsx`、`navigationGuard.ts` |
| 案例撰寫、正式儲存與 Agent 同步 | `ScriptWorkspace.tsx`、`agentDraftSync.ts`、Control API `scriptCases.ts`、`androidAgentDraft.ts`；契約見 [Agent 文件](android-agent-authoring.md) |
| 專案與來源匯入 | `TestingProvider.tsx`、`sourceImportModel.ts`、Control API `sourceImportRoutes.ts`、`sourceImport.ts` |
| API 請求與流程 | `ApiWorkbench.tsx`、Control API `apiLibrary.ts`、`apiWorkflow.ts`、`e2eApi.ts`；見 [API 文件](../API-REQUEST-LIBRARY.md) |
| Android 裝置、流程與 Agent | `AndroidWorkspace.tsx`、`AndroidFlowExecution.tsx`、Control API `android.ts`、`androidAgentTasks.ts`、`mobileEngine.ts`；worker 見 `services/android` |
| 執行紀錄及報告 | `VersionResults.tsx`、`executionHistoryModel.ts`、`reportPdf.ts`、Control API `executionRecords.ts` |
| 模型連線 | `features/assistant`、Control API `modelConnections.ts`、`integrations.ts`、`services/agents` |

表格內未帶前綴的前端檔案位於 `apps/web/src/features/testing`，後端位於 `services/control-api/src`。名稱是查找入口，不代表該檔獨立擁有整項功能。

## 舊服務資料流與 seam（遷移參照）

瀏覽器經 `/api` 進入 Control API，再由 PostgreSQL 保存來源、版本與工作。模型橋接、Android worker、Docker launcher 透過各自工作通道回報；瀏覽器不直接取得 worker 秘密。`controlApi.ts` 同時包含 HTTP 呼叫、bootstrap 與 serverStorage 快取，不能當作純 HTTP adapter 隨意替換。

共用流程契約由 `services/android/flow-contract.mjs`、`flow-dependencies.mjs`、`flow-guide.json` 等檔案承載；模型逾時設定目前由前端直接引用 Control API 的 JSON。這些是已存在的跨目錄耦合，搬移須同步確認建置、Docker 複製路徑及測試，不能只修 TypeScript import。

MobileEngine 是 Android Agent 的既有 seam；後續平台 adapter 應沿用裝置擁有權與鎖語意。iOS 尚未接入，不為假設中的 adapter 另建通用框架。E2EBatchHost 的掛載位置影響批次輪詢存活，不可在整理導覽時移回短命頁面。

## 已完成的模組整理

`registerRunnerRoutes(app, { pool, transaction })` 集中 `/internal/claim`、`/internal/runs/:id/heartbeat` 與 `/internal/runs/:id/events`。main.ts 先安裝原有 worker 授權及錯誤處理，再註冊；模組不自行建立連線、不啟動服務，也不提供另一套授權。SQL、45 秒租約、批次順序、過期失敗及重複事件語意沿用。

路由回歸使用注入的資料存取替身檢查空佇列、領取、心跳、終態拒收、事件去重、取消優先及進度累計。這不證明 PostgreSQL 鎖與交易隔離正確；真實資料庫整合入口仍是 `services/control-api/test/database.integration.ts`，需要專用 archify_test 資料庫，不包含在一般 npm test glob。

## 後續拆分順序

1. **Control API 組裝與業務分離**：`main.ts` 仍含 SQL、模型上下文與路由。以一個領域為一次變更，把驗證、授權、交易及錯誤語意收進同一 Module，讓呼叫端只需理解小型 Interface；先補該路由行為測試，再搬出。不要增加只轉送參數的多層包裝。
2. **前端按領域收斂**：`features/testing` 混有來源、API、案例、Android、報告。先選一個完整領域，將純模型、client 及畫面一起整理；保留 App 層生命週期。不同領域真正重用時才抽共用 Module，不建立 utils 雜物區。
3. **縮小資料存取 Interface**：盤點 `controlApi.ts` 的快取更新與 bootstrap 順序，再考慮抽出案例儲存 Module。測試應經相同 Interface 驗證衝突、過期回覆及失敗保留，不只測轉送函式。
4. **處理共用契約位置**：等實際消費者、部署複製路徑與版本相容測試齊備，再決定是否移至共用目錄。目前不建立空的 packages 階層，也不一次變更 workspace 與部署方式。

除上節 Runner 通道外，以上領域仍待整理。每項拆分各自同步對應專題文件與計畫，API／DB 有變時另做相容性評估。

## 重跑盤點與完成條件

`npm run architecture:report` 列出各執行目錄正式來源檔案數與大小前五名，不寫入產物。它不解析依賴圖、不檢查循環或動態 import，也不給品質分數；大小僅用來定位閱讀熱點，長行會讓行數失真。

修改文件後執行 `npm run docs:plans:index` 與 `npm run docs:check`。產品改動仍須跑上表對應回歸，靜態盤點不能替代測試、真實裝置或部署驗收。

## 原生 Playwright 接入

playwright-source.mjs 只產生原生單檔測試；playwright-migration.mjs 以 AST 判斷可安全轉換的舊稿並保留 legacy。獨立專案 support/bff.mjs 提供共享設定，playwright.config.ts 使用鎖版執行器，support/archify-reporter.mjs 轉換原生步驟到閱讀器格式。沒有資料庫或平台執行端點。測試執行、套件與 Git 都留在獨立專案。

## 設定與知識模組

setup.mjs 驗證來源／目的並原子更新平台 .env 的兩根路徑；directory-picker.mjs 只在使用者同源授權操作時以置頂透明擁有人搭配 Windows `IFileOpenDialog`（含 `FolderBrowserDialog` 回退）開啟系統資料夾選擇器，不拼接來源命令，並支援連線中斷或重開時中止舊程序。workspace.mjs 序列化寫入、初始化時清空新專案 `test-cases/catalog.json`，並於 `setup()` 對新版專案非覆寫產生單支 API 草稿與重設舊掃描。knowledge.mjs 管理專案文字、索引、AI 閱讀入口與封存；不接模型或向量 DB。完整契約與限制見本機分析文件；決策見 decisions/2026-11-07-agent-knowledge-files.md。

script-sync.mjs 管理來源 scope、受管腳本索引、消失候選、封存與非覆寫還原；workspace.mjs 序列化載入／掃描及封存操作，確認前重新掃描來源並核對腳本 hash。索引在 analysis，封存在 legacy/removed-api，不進入 Playwright tests。決策見 decisions/2026-11-07-removed-api-script-archive.md。

workspace.mjs 的操作鎖合併重疊 analysis 讀取，讀取可等候既有寫入後取得最新快照；寫入保留 fail-fast 互斥，不重送操作；資料夾選擇器以單一可取代的 `activePicker` 管理，避免舊視窗未關閉或重整後阻塞後續操作。Promise 尾鏈只負責序列化與失敗釋放，不是跨程序鎖。

graphql-payload.mjs 將呼叫處 variables 與 query 宣告整合為保留型別的請求模板；playwright-source.mjs 產生多行 query。refresh-graphql.mjs 以 AST／舊分析精確比對支援受控的 operation 更新，不執行來源、不改業務程式。

預設 playwright-source.mjs 只產生請求資料與 skipped 標記；legacy-playwright-source.mjs 僅為明確舊設定遷移保留執行及斷言，新稿不使用。AI 後續撰寫實際流程，reporter 不把草稿當通過。

naming.mjs 同時管理可讀檔名、顯示名與舊檔名回退；通用 GraphQL 名稱從 AST 頂層實際欄位取得，既有有效操作名不改，payload 與 ID 不受影響。workspace 讀取與生成均檢查舊命名以防重複，script-sync 的名稱與實際路徑同步。

## 前端功能總覽

現行已提供全頁面證據包、本機 AI skill 與提案驗證／套用，預設全部功能，再分產品頁面／API 與測試流程；靜態可達不等於完整業務覆蓋，未分配項目明示，不啟動網頁 Agent。詳見 [前端功能總覽](frontend-feature-overview.md)。

## 網站 AI 分析與知識更新

依使用者新要求，網站已啟動本機 Codex 分析，不再只提供複製提示。功能圖與 MD／HTML 知識有 AI 工作進度、取消與驗證套用；知識更新去重、取代舊版先封存並可還原。CLI 使用本機登入但模型推論可能傳到服務，預設不載入使用者 config。詳細契約與限制見 [網站 AI 分析](website-ai-analysis.md)。先前不啟動 CLI 的描述為舊操作限制，已由本次決策取代。
