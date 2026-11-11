---
name: playwright-test-report
description: 依實際 Playwright API／網頁及 Appium Android 執行結果產出統一分類報告，固定單檔 HTML，純文字按需下載，畫面截圖遵循專案設定；不把 mock 或未執行案例當成產品通過。
---

# 統一測試報告

報告由 support/archify-reporter.mjs 自動生成，不讓模型手工填通過。報告根目錄讀 archify.config.json 的 reportDir（預設 reports），與平台 ARCHIFY_REPORT_DIR 一致；API 放 api/，網頁與 Android 放 ui/，日期時間使用 Asia/Taipei、毫秒及 runId 尾碼。每輪只產生一份 HTML，執行中及完成時更新同檔，不覆寫前次，不提交報告或認證資料。

API 單支及串接流程使用 tests/api、tests/flows；網頁使用 tests/ui 與 support/web-test，Android 推播使用 tests/mobile 與 support/android-test。每個案例保留 archify-case 與明確 test.step。一般頁面採本機 npm run dev，LIFF mock 與實際 BFF 的驗證範圍分清；原生推播使用實際 Android Appium，不以瀏覽器 mock 冒充。

執行指令為 npm run test:api、npm run test:web、npm run test:android；npm test 可跑所有已存在案例，npm run flow 僅列宣告步驟、不執行 body。空案例、略過、環境錯誤與真實失敗不可寫成通過，產品操作需已有授權與清理。

config/report.json 的 screenshots 預設 false，可從網站「畫面測試」勾選，下次執行生效；ARCHIFY_SCREENSHOTS=0／1 可在 CLI 明確覆寫。web-test／android-test 在開啟時透過 captureUi 附加原始 PNG，關閉時不擷取，仍有純文字報告。API 不保存畫面。不限制每案例圖片張數；單圖 2 MB，單檔 HTML 上限 512 MB，超量明確失敗，不分卷或默默丟證據。

截圖是未經自動遮蔽的原始畫面；不可自行擷取登入、憑證或未授權個資。不要繞過設定另存截圖、trace、video。回應只用既有 showResponse 的遮蔽預覽，不 console.log token。文字樣式正確仍需實際斷言或指定的基準，照片附件不是通過證據。

報告 schemaVersion 1 保留舊欄位，新增 testType（api／ui）、screenshotsEnabled；cases 可有 target（api／web／android）、dataMode（liff-mock-real-api／mocked／unspecified）及 screenshots（caption／PNG base64 data）。dataMode 是腳本宣告，不代替實際驗證。舊根目錄 report-*.json 可讀，沒有 metadata 時只能按來源路徑推定類型並說明限制。

完成後回報實際產物路徑、通過／失敗／略過、使用的資料模式、環境及未驗證範圍。不宣稱部署版本、真實 LINE 登入或推播已驗收，除非本輪有實際證據。

## 範本來源與相容轉接

使用者提供的 playwright-test-report 圖文範本為現行視覺來源；網站、離線 HTML 及舊 results.json 轉接均使用 framework/journey-report.mjs，不降為 legacy。新案例仍使用統一 JSON，不另造結果格式。

新網頁 UI 流程使用 tests/ui/*.spec.ts；舊 tests/web 仍由相同 web project 執行，不必搬移既有腳本。npm run test:ui 與 test:web 都只執行 Playwright 網頁案例，Android 必須另用 test:android。網頁導航、填表、點擊、資料／DOM 斷言及截圖使用 Playwright 腳本，不使用 computer use 或逐步讓模型看圖操作。HTML 自動產生情境摘要、步驟、預期、結果、清理與可點擊放大證據；沒有截圖仍產生 HTML／TXT。

## 固定逐操作證據契約

本節取代舊的結束畫面及八張上限說明：網頁從 support/web-test.js 匯入 test／expect，fixture browser 建立的 page／自訂 context 自動對每次常用操作及畫面斷言留圖。多角色立即 setUiRole(page, 角色名稱)；evaluate 或特殊操作使用 uiStep(page, 中文動作與預期, callback)。不得抽樣、八張後略過或只截結束畫面；globalSetup 及 npm run check:ui-evidence 驗證共用 import。截圖關閉仍不擷取，不自行繞過。圖中密碼與 autocomplete=one-time-code 輸入會遮罩，其他個資不保證遮蔽。所有圖依原順序保存於同runId單檔HTML，不分卷也不丟棄逐操作證據；截圖失敗必須回報失敗，不能捏造證據。純 API、關閉頁面與釋放資源不拍圖。先 check:ui-evidence、check:types，再執行已獲授權的產品案例。

## 圖文範本與就緒診斷契約

本節取代舊的通用清單／安全摘要規則：現行採使用者提供的深藍白紙角色圖文範本，網站及離線共用 journey-report。重要頁面用 setUiReady(page, selector) 明示就緒條件，完成後 setUiReady(page, null) 還原；不能只等 goto 返回或把白圖當成功。登入／註冊等回應使用 uiWaitForResponse(page, OperationName, trigger)，先監聽再觸發，逾時保存操作名、上限、安全診斷及當下圖，不重送。catalog 提供整體／規劃預期；uiStep 第四參數與 expect 中文訊息提供當步預期。不得以「依測試檔中的斷言」或同一句通用錯誤取代診斷。未知／舊資料明示未保存；不回填、捏造或輸出原始例外與秘密。

## 單檔報告與完整歷史

依使用者2026-11-10要求，本節取代舊的JSON／HTML／TXT自動產物、八張／4MB分卷及最近100份限制。每次執行在reports/api或reports/ui只寫一份日期時間命名HTML，同runId在進行中與完成時原子更新同檔，不覆寫其他執行。HTML內嵌schemaVersion 1與全部PNG，圖片延遲載入、點擊放大；不自動另寫JSON／TXT或part分卷，純文字仍可由閱讀器按需下載。單張PNG維持2MB檢查；單檔512MB明確上限，超限失敗不丟圖湊成功。所有測試專案共用此契約。前置說明不在報告正文顯示，必要準備操作、原始結構及證據仍保存。歷史列表不截斷100／1000份，提供搜尋與顯示更多；舊JSON／分卷保留相容且不刪除。

## 情境與實際結果敘述

報告須完整交代角色、雙方初始關係、設定、操作先後及在哪裡核對；例如「你與小明都關閉自動同意，彼此沒有對方名片。小明向你索取，你暫不點同意，再查看你的待同意與小明的待審核」。不以「兩邊正確」省略角色與驗證位置。catalog的steps保留完整操作，reporter以scenarioSteps保存，正文標示情境與操作，不另設前置段落。

實際結果只描述本輪通過斷言的觀察；可在全部相關斷言完成後，透過test.info().attach("archify-case-result", {body: "具體結果文字", contentType: "text/plain"})保存角色、畫面、狀態與未出現項目。不得把預期文字直接當實際結果；失敗時必須交代已完成、停在哪一步及尚未驗證範圍。未保存的舊結果不能回填成成功。網站採條列結果，開啟報告另頁閱讀或下載HTML，不內嵌預覽框。

帳號清理失敗（包含清理服務回傳錯誤）列為清理提醒，保留安全可用的帳號識別碼供追蹤；不得因此把已通過主流程斷言的案例改判失敗。若主流程本身失敗，仍照常標為失敗，清理提醒獨立顯示。
