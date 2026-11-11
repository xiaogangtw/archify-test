---
name: write-web-tests
description: 在本機前端 npm run dev 環境撰寫 Playwright 網頁流程，同時核對真實測試環境資料與 DOM／樣式；LIFF mock 只控制 SDK 情境，不代替真實 LINE 推播驗收。
---

# 網頁畫面與資料測試

先讀 AGENTS.md、knowledge/README.md、相關來源證據及 test-cases/catalog.json；缺前置、角色或預期時使用 plan-test-cases skill 集中詢問。流程仍在獨立專案編修，網站只閱讀，不要求網站核准。

一般前端功能使用 tests/ui/*.spec.ts，import `{test,expect}` from `../../support/web-test.js`。WEB_BASE_URL 是使用者啟動的本機前端，與 BFF_BASE_URL 分開；目前建議前端 `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`，避免和 Archify 的 5173 衝突。確認讀到前端而非平台，框架不替使用者自動啟動任意專案命令。

先核對前端真實的 LIFF mock 啟用方式、角色及測試身分接口。只使用已存在且獲授權的 mock 能力，不猜測全域變數、SDK 注入方式或替換正式登入。若前端 DEV 環境啟用 LiffMockPlugin，也不代表可直接切換任意帳號；需要多角色時先確認實際支援的接口。SDK mock 身分不等於真實 LINE token，BFF 權限仍須有效測試認證，不偽造為已登入。

畫面與資料在同一案例核對：先以固定測試資料／明確前置斷言 HTTP 狀態、GraphQL errors 及業務欄位，再檢查 DOM 文字、可見狀態與必要的 computed style。可以在操作前設 page.waitForResponse，以實際 operationName／端點辨識目標請求；不能只驗「DOM 與回應相同」就當業務資料正確。

資料正確性案例不攔截 BFF 回應或 route.fulfill 業務資料。若任務本來是 mock UI 測試，獨立列案例並用 archify-data-mode: mocked；LIFF mock 搭真實測試 BFF 可宣告 liff-mock-real-api。這是腳本宣告，不能以該 annotation 代替業務斷言或真實 LINE 驗收。

用 archify-case annotation 對應案例 ID，test.step 對應規劃步驟，預期與清理不因執行失敗而放寬。只有推播的原生 LINE／App 畫面交給 write-push-tests，不用桌面 LIFF mock 代替手機推播。

截圖由 config/report.json 的 screenshots 控制，web-test 預設在結束時透過 captureUi 附加一張原始 PNG。需要逐步證據可用 captureUi，最多 8 張，既有手動證據時不再重複擷取結束畫面。未開啟時不直接 screenshot／toHaveScreenshot 繞過選項；像素比較需要基準圖及明確截圖授權，未具備條件就標示略過或待補，不能省略斷言宣稱通過。

先 npm run check:types；實際執行需沿用本次授權，使用 npm run test:web。報告由 runner 產生在 reports/ui，JSON／HTML／TXT 同名日期時間，不手工填通過結果。細節見 playwright-test-report skill。

新網頁 UI 流程使用 tests/ui/*.spec.ts；舊 tests/web 仍由相同 web project 執行，不必搬移既有腳本。npm run test:ui 與 test:web 都只執行 Playwright 網頁案例，Android 必須另用 test:android。網頁導航、填表、點擊、資料／DOM 斷言及截圖使用 Playwright 腳本，不使用 computer use 或逐步讓模型看圖操作。HTML 自動產生情境摘要、步驟、預期、結果、清理與可點擊放大證據；沒有截圖仍產生 HTML／TXT。

逐步證據範例（在 test.step 內斷言後呼叫；關閉截圖時 helper 不擷取）：

```ts
await expect(page.getByRole('heading', {name: '測試情境的預期標題'})).toBeVisible();
await captureUi(() => page.screenshot({type: 'png', fullPage: false}), test.info(), '登入後：預期畫面已顯示');
```

從 support/web-test.js 匯入 captureUi；每個重要狀態提供清楚 caption，不為留圖而省略斷言，不將手機 viewport 模擬當真實 LINE。

新增或修改 catalog 案例時，依 test-cases/README.md 的「流程分類」明確填 target：單支／串接 API 都用 api；網頁用 web、Android 畫面用 mobile、含畫面的跨平台用 mixed。kind: flow 不等於畫面流程；保留 script 與實際 runner 一致。未知平台先詢問，不建立假測試。

## 固定逐操作證據契約

本節取代舊的結束畫面及八張上限說明：網頁從 support/web-test.js 匯入 test／expect，fixture browser 建立的 page／自訂 context 自動對每次常用操作及畫面斷言留圖。多角色立即 setUiRole(page, 角色名稱)；evaluate 或特殊操作使用 uiStep(page, 中文動作與預期, callback)。不得抽樣、八張後略過或只截結束畫面；globalSetup 及 npm run check:ui-evidence 驗證共用 import。截圖關閉仍不擷取，不自行繞過。圖中密碼與 autocomplete=one-time-code 輸入會遮罩，其他個資不保證遮蔽。所有圖依原順序保存於同runId單檔HTML，不分卷也不丟棄逐操作證據；截圖失敗必須回報失敗，不能捏造證據。純 API、關閉頁面與釋放資源不拍圖。先 check:ui-evidence、check:types，再執行已獲授權的產品案例。

## 圖文範本與就緒診斷契約

本節取代舊的通用清單／安全摘要規則：現行採使用者提供的深藍白紙角色圖文範本，網站及離線共用 journey-report。重要頁面用 setUiReady(page, selector) 明示就緒條件，完成後 setUiReady(page, null) 還原；不能只等 goto 返回或把白圖當成功。登入／註冊等回應使用 uiWaitForResponse(page, OperationName, trigger)，先監聽再觸發，逾時保存操作名、上限、安全診斷及當下圖，不重送。catalog 提供整體／規劃預期；uiStep 第四參數與 expect 中文訊息提供當步預期。不得以「依測試檔中的斷言」或同一句通用錯誤取代診斷。未知／舊資料明示未保存；不回填、捏造或輸出原始例外與秘密。

## 從前端推導操作與填表

先依專案設定定位前端來源，僅取必要路徑、不輸出 .env 或秘密。由入口追查路由守衛、頁面及子元件、欄位標籤與驗證、按鈕事件、彈窗、導航及 API 成功／失敗分支，記錄本案例及 helper 對應的來源檔案位置。不可只讀功能摘要、API 清單或沿用舊 locator 就宣稱完整；來源缺失或條件不明時列出缺口。

從目前元件選擇有依據的 role／label／placeholder／testid，核對各中間畫面的就緒條件、輸入限制、送出條件及成功畫面。情境要求從入口點入時，不能直接 goto 結果頁繞過；須經 UI 建立的前置不能改用 API、cookie／storage 注入或偽造業務回應取代。

填值前核對 catalog 與 knowledge：前端只能證明格式與必填，不能證明手機可任意產生、OTP 固定、不發簡訊、假公司可用或帳號可刪除。已有明確規則則沿用；影響執行的未知資料依 plan-test-cases 集中提問並補回案例，不默默採用 helper 舊常數。秘密只留環境參照，不寫回案例或來源證據。

角色建立、註冊填表、驗證、設定及主流程各保留可辨識的具名 test.step 與具體預期，helper 亦同，讓案例能追到實際操作。核對當頁成功條件與必要業務結果，不以填完、點擊成功或導頁返回當完成。只寫腳本時交付來源依據與未實測範圍，不擅自發產品請求。

## 單檔報告與完整歷史

依使用者2026-11-10要求，本節取代舊的JSON／HTML／TXT自動產物、八張／4MB分卷及最近100份限制。每次執行在reports/api或reports/ui只寫一份日期時間命名HTML，同runId在進行中與完成時原子更新同檔，不覆寫其他執行。HTML內嵌schemaVersion 1與全部PNG，圖片延遲載入、點擊放大；不自動另寫JSON／TXT或part分卷，純文字仍可由閱讀器按需下載。單張PNG維持2MB檢查；單檔512MB明確上限，超限失敗不丟圖湊成功。所有測試專案共用此契約。前置說明不在報告正文顯示，必要準備操作、原始結構及證據仍保存。歷史列表不截斷100／1000份，提供搜尋與顯示更多；舊JSON／分卷保留相容且不刪除。

## 情境與實際結果敘述

報告須完整交代角色、雙方初始關係、設定、操作先後及在哪裡核對；例如「你與小明都關閉自動同意，彼此沒有對方名片。小明向你索取，你暫不點同意，再查看你的待同意與小明的待審核」。不以「兩邊正確」省略角色與驗證位置。catalog的steps保留完整操作，reporter以scenarioSteps保存，正文標示情境與操作，不另設前置段落。

實際結果只描述本輪通過斷言的觀察；可在全部相關斷言完成後，透過test.info().attach("archify-case-result", {body: "具體結果文字", contentType: "text/plain"})保存角色、畫面、狀態與未出現項目。不得把預期文字直接當實際結果；失敗時必須交代已完成、停在哪一步及尚未驗證範圍。未保存的舊結果不能回填成成功。網站採條列結果，開啟報告另頁閱讀或下載HTML，不內嵌預覽框。
