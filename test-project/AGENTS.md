# 測試專案協作規則

Android 環境準備先讀 [setup-android skill](skills/setup-android/SKILL.md)。平台新建測試專案會一併放入這份技能與官方下載指引；SDK、AVD、Appium 及登入資料仍各機安裝，不隨 Git 配送。只測 API／網頁不需要安裝 Android。

一般畫面使用 skills/write-web-tests/SKILL.md 與 tests/ui；只有推播原生畫面使用 skills/write-push-tests/SKILL.md 與 tests/mobile。報告使用 skills/playwright-test-report/SKILL.md，固定 reports/api／reports/ui 並輸出 JSON／HTML／TXT；新專案截圖預設開啟，僅新版畫面 fixtures 依 config/report.json 處理。修改框架／報告不授權開啟 LINE、手機截圖或發推播，這些操作需之後明確要求。

規劃案例使用 skills/plan-test-cases/SKILL.md，實作使用 skills/implement-tests/SKILL.md。catalog 保存規劃步驟、預期、清理、驗證對象及問題，缺資料集中詢問；規劃、問題與實作全在本機專案完成，網站只讀表格，不要求網站確認。cases:check 預設檢查資料完整性；reviews 只保留歷史用途。詳見 test-cases/README.md。

先讀 README.md、knowledge/README.md、test-cases/catalog.json 與 skills/write-tests/SKILL.md。所有日常測試資產留在此專案。案例意圖在 catalog、業務依據在 knowledge、實作在 tests；地圖從關聯產生，不另維護業務事實。

整理全部前端功能時讀 skills/map-frontend-features/SKILL.md 與分析證據包，輸出可驗證提案。保留固定 ID、人工案例、來源證據與未分配項目，產品頁面／API 與測試流程分開；不把靜態可達當成實際執行，不修改 hash 繞過版本核對。

- 可修改：api/、tests/、test-cases/、requests/、fixtures/、skills/、knowledge/、memory/ 與共用 Header 設定 config/http.json。秘密值放 .env，config/http.json 只存非秘密值或占位符。
- framework/、package.json 與執行設定預設不改；需要變更時說明原因並依使用者授權處理。
- 不刪除或放寬業務斷言換取通過；不把草稿或流程描述視為實際驗證。
- 秘密使用本機環境變數，不提交 Git，不寫進報告與記憶。
- 外部 AI 的能力由其工具與 OS 權限決定，本檔不提供安全隔離。

現行 api/*.ts 匯出 operation 與 callApi(request, options)，供 tests/api/*.spec.ts 與 tests/flows/*.spec.ts 重用。不得 import 其他 .spec.ts、保存全域 token 或在模組頂層發請求。舊稿在 legacy 留存，不用 defineCase／executeApi 撰寫新案例。support 與 Playwright 設定維持框架邊界。

新稿 query／預設 variables 在 api 模組，測試以 test.skip 保留識別；AI 補 test.step、情境資料與業務斷言後才啟用，不移除 skip 造成空測試通過。token／cardId 在同一 test 明確傳遞，寫入前確認授權與清理。先 npm run check:types，再檢查流程及有授權的實際執行。

新網頁 UI 流程使用 tests/ui/*.spec.ts；舊 tests/web 仍由相同 web project 執行，不必搬移既有腳本。npm run test:ui 與 test:web 都只執行 Playwright 網頁案例，Android 必須另用 test:android。網頁導航、填表、點擊、資料／DOM 斷言及截圖使用 Playwright 腳本，不使用 computer use 或逐步讓模型看圖操作。HTML 自動產生情境摘要、步驟、預期、結果、清理與可點擊放大證據；沒有截圖仍產生 HTML／TXT。

新增或修改案例必須依 test-cases/README.md「流程分類」填 target：API 單支及串接用 api，網頁用 web，Android 畫面用 mobile，含畫面跨平台用 mixed。kind: flow 不等於畫面流程；未知平台先詢問，不靠名稱猜測。

## 本機來源設定

初始化與重新連接會將 ARCHIFY_SOURCE_DIR 保存此專案 .env。AI 先只讀取此鍵定位產品前端，唯讀核對頁面、按鈕與 LIFF mock；不得輸出整份 .env 或秘密。無權讀取時回報權限問題。環境設定與秘密不提交 Git；.gitignore 保護 .env 與 .env.*，僅 .env.example 可提交且不得填真實路徑或秘密。已追蹤的 .env 仍需人工取消追蹤與評估憑證更換。

## 固定逐操作畫面證據

所有網頁案例使用 support/web-test.js 的 test／expect，fixture browser 建立的 page／自訂 context 會對操作及畫面斷言逐一留圖，含順序、角色與結果；多角色用 setUiRole。特殊操作以 uiStep 包住，禁止八張後略過或只截結束畫面。執行前 npm run check:ui-evidence 及 npm run check:types；globalSetup 同步檢查標準 fixture import。新專案 config/report.json 預設開啟，既有明確關閉仍尊重，不得另存繞過。超過單卷容量自動分卷，保留同 runId／caseId 與所有圖片，份數不等於案例數。詳見 skills/write-web-tests/SKILL.md 與 skills/playwright-test-report/SKILL.md。


## 就緒、預期與等待診斷

重要導航先 setUiReady(page, 可見目標)，完成該頁後 setUiReady(page, null) 還原；導頁返回不能當業務畫面完成。登入／註冊使用 uiWaitForResponse(page, OperationName, trigger)，先監聽再觸發並在逾時留現場圖。uiStep 第四參數提供具體預期；catalog 保存整體及規劃預期，expect 提供中文訊息。不以空白成功圖、通用預期或單句安全錯誤取代診斷。playwright-test-report 使用者範本是現行來源，網站及離線共用 journey-report，不另造外觀。

## 單檔報告與完整歷史

依使用者2026-11-10要求，本節取代舊的JSON／HTML／TXT自動產物、八張／4MB分卷及最近100份限制。每次執行在reports/api或reports/ui只寫一份日期時間命名HTML，同runId在進行中與完成時原子更新同檔，不覆寫其他執行。HTML內嵌schemaVersion 1與全部PNG，圖片延遲載入、點擊放大；不自動另寫JSON／TXT或part分卷，純文字仍可由閱讀器按需下載。單張PNG維持2MB檢查；單檔512MB明確上限，超限失敗不丟圖湊成功。所有測試專案共用此契約。前置說明不在報告正文顯示，必要準備操作、原始結構及證據仍保存。歷史列表不截斷100／1000份，提供搜尋與顯示更多；舊JSON／分卷保留相容且不刪除。
