# 專案文件索引

- [API、網頁與 Android 報告](ui-testing-reports.md)：報告分類、截圖設定、本機前端與推播環境。

- [網站 AI 分析](website-ai-analysis.md)：功能圖按鈕、MD／HTML 語意去重更新與還原。

- [前端功能總覽](frontend-feature-overview.md)：路由／頁面取證、本機 AI 整理及安全套用。

- [功能與測試關聯](test-traceability.md)：專案知識、案例規劃表、版本確認、腳本地圖與執行版本。

本頁是 Archify Test 的文件入口。整理時保留既有路徑，避免破壞外部引用；文件存在不代表功能已部署或通過真實環境驗收。

## 先讀這些

| 目的 | 文件 | 定位 |
| --- | --- | --- |
| Agent 工作規則 | [AGENTS.md](../AGENTS.md) | 繁體中文規則與完成條件 |
| 系統功能與限制 | [目前規格](../ARCHIFY-CURRENT-SPEC.md) | 本機分析框架與閱讀器為現行入口；下方保留舊架構沿革 |
| 本機閱讀器啟動與驗證 | [操作手冊](../README.md) | 操作入口，含環境特定設定 |
| 前端開發 | [前端 README](../apps/web/README.md) | 安裝、建置與模組位置 |
| 設計系統 | [Archify Design System](../DESIGN.md) | 視覺、元件規則與總覽採用範圍 |
| 架構與維護 | [架構維護地圖](architecture.md) | 程式入口、責任、共用契約、拆分順序與驗證入口 |
| 任務背景與證據 | [計畫索引](plans/README.md) | 歷史與進度，不作為現況規格 |
| 架構與安全取捨 | [決策紀錄](decisions/README.md) | 需要記錄重要取捨時建立 |

規則以使用者明確指示及 AGENTS.md 為準。功能以目前規格和對應專題文件交叉查證；若文件與程式矛盾，先指出差異再修正。歷史提案和驗證紀錄不可覆蓋現行規則，也不可作為部署完成的證明。

## 操作與專題文件

- [本機來源分析與獨立專案](local-workspace.md)：三步設定、Agent 知識庫、.env、目錄邊界、掃描、生成與本機契約。
- [獨立測試專案](../test-project/README.md)：CLI、流程、報告與 skills。
- [舊架構操作手冊](legacy-operations.md)：歷史 VM 操作，非預設入口。

以下為舊架構專題與遷移參照，並非新閱讀器功能：

- [集中分享與 Android 部署](../ANDROID-DEPLOYMENT.md)
- [本機分步啟動](../LOCAL-SETUP.md)：補充分步設定；日常啟動優先看操作手冊。
- [API 請求庫與版本差異](../API-REQUEST-LIBRARY.md)
- [Web Playwright 工作台](web-playwright.md)：案例撰寫、本機保存、AI 腳本建議、批次估算與未接入的瀏覽器執行邊界。
- [Android 回歸流程](android-flow-regression.md)
- [Appium 能力範圍](appium-capabilities.md)
- [Android Agent 自主案例撰寫契約](android-agent-authoring.md)：草稿自動同步、命名保護、正式案例與持久需求。
- [Mac 與 iOS 前置環境](ios-mac-setup.md)：只有 Mac 的可做範圍、唯讀檢查及尚未接入的 iOS 能力。
- [E2E 交錯 API 流程](e2e-api-flow.md)

## 驗證紀錄

下列紀錄只代表各自記載的環境與範圍，不代表目前機器、VM 或真實系統已驗收。

- [E2E API 驗證](e2e-api-verification.md)
- 前端驗證文件集中於 `apps/web/*-VERIFICATION.md`，依功能選用：
  - [案例撰寫](../apps/web/AUTHORING-VERIFICATION.md)、[雙機撰寫](../apps/web/DUAL-AUTHORING-VERIFICATION.md)
  - [Agent 回饋](../apps/web/AGENT-FEEDBACK-VERIFICATION.md)、[Agent 問題處理](../apps/web/AGENT-RESOLUTION-VERIFICATION.md)
  - [Android](../apps/web/ANDROID-VERIFICATION.md)、[Android 自動驗證](../apps/web/ANDROID-AUTOVERIFY-VERIFICATION.md)
  - [API 工作台](../apps/web/API-WORKBENCH-VERIFICATION.md)、[來源匯入](../apps/web/SOURCE-IMPORT-VERIFICATION.md)
  - [流程預覽](../apps/web/FLOW-PREVIEW-VERIFICATION.md)、[共用流程](../apps/web/SHARED-FLOW-VERIFICATION.md)
  - [E2E](../apps/web/E2E-VERIFICATION.md)、[執行報告](../apps/web/EXECUTION-REPORT-VERIFICATION.md)

## 歷史設計提案

以下保留供追溯，不能直接拿來實作目前畫面；尤其舊的審批、案例卡、收合編輯器等描述，須以 AGENTS.md 與目前規格核對。

- [初期 UI 規格](../Archify-Test-UI-Spec.md)
- [前端初期設計副本](../apps/web/DESIGN-SPEC.md)
- [白話案例撰寫 v0.8](../UI-UPDATE-v0.8.md)

## 上游設計參考

根目錄的 `components/`、`accessibility/`、`taste/`、`frameworks/`、`design-systems/`、`content/`、`workflows/` 與 `tokens/` 為設計套件資料，暫不搬動、不翻譯整套內容，也不當作 Archify 的現況文件（已移除未引用的 `examples/` 與 `design-systems/library/`）。

## 維護與檢查

在根目錄執行：

```powershell
npm run docs:plans:index
npm run docs:check
```

索引依計畫日期與領域自動產生。文件檢查驗證治理入口、計畫必要章節／狀態、索引一致性及這些文件的本機連結；不檢查整套上游資料、遠端 URL、Markdown 錨點，也不驗證產品功能。新增或刪除專題文件時，同步維護本索引。
