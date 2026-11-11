---
name: implement-tests
description: 依測試專案中的案例與知識實作 API、流程或畫面測試；資料不足時集中提問並補案例，不要求回網站確認。
---

# 依專案案例實作測試

讀 AGENTS.md、test-cases/README.md、指定 catalog 案例與相關 knowledge。流程規劃、補問題與實作全部在此專案及本機 AI 對話完成，網站僅觀看表格，不需要回網站確認。可用 `node support/case-plan-cli.mjs TC-CASE-ID` 檢查資料完整性；這是唯讀檢查，不發產品請求、不要求 reviews 記錄。

缺預期、步驟、樣式基準或關鍵資料時，先依 skills/plan-test-cases/SKILL.md 整理具體問題，一次向使用者詢問並更新 catalog，不猜測或刪問題湊完整。撰寫前後重讀案例與知識，若途中改動先核對新版本；不以舊確認檔代表本次需求。--review 僅供歷史核對，不是實作前置條件。

API 與串接流程實作讀 skills/write-tests/SKILL.md；重用 api/*.ts 的 callApi，不匯入其他 spec，不放全域 token。每個規劃步驟映射為 test.step，保留明確業務斷言與 cleanup；使用 archify-case annotation 關聯固定案例 ID。API 單支放 tests/api，跨 API 流程放 tests/flows；在 catalog.script 明確記錄唯一實作路徑，不改規劃內容以迎合實作。

網頁可放 tests/web、App 可放 tests/mobile，但先核對專案是否已提供對應 runner 與依賴；缺少 Appium 或畫面樣式基準就回報缺口，不擅改執行設定、不捏造可執行狀態。網頁預覽通過不能當作 LINE App 呈現通過；只驗文字樣式時不要擴大成後端推播驗收。

保留人工測試，不能放寬預期換通過。預設僅寫腳本及執行 npm run check:types；產品請求、寫入與清理需依本次授權處理。結束前重讀案例與相關知識，必要時跑資料完整性檢查；變更則核對實作與需求，不要求網站核准。

交付列出案例 ID、腳本路徑、案例內容指紋、檢查結果及未驗證範圍。不覆寫舊報告；腳本存在、型別通過及產品執行通過分別描述。

## 網頁與畫面報告

一般畫面以本機前端 npm run dev（建議 5174 避免平台 5173 衝突）搭配 LIFF mock 與真實 BFF。WEB_BASE_URL 控制網頁位置。npm run test:api、npm run test:web、npm run test:android 分別執行；報告固定在 reports/api 與 reports/ui，輸出日期時間命名的 JSON、HTML、TXT。config/report.json 的 screenshots 預設 false，僅影響下次執行。tests/web 使用 support/web-test.ts，tests/mobile 使用 support/android-test.ts。技能見 skills/write-web-tests、skills/write-push-tests、skills/playwright-test-report。先斷言預期業務資料，再檢查畫面，不以 LIFF mock 宣稱真實 LINE 授權已通過。本輪不開啟 LINE、不擷取實際手機畫面、不發送推播；Android 僅保留環境及未啟用的框架。

## UI 流程與圖文報告
新網頁流程放 tests/ui/*.spec.ts，使用 support/web-test.ts 的 Playwright test／expect／captureUi。舊 tests/web 仍相容。npm run test:ui 只執行網頁，Android 需另用 test:android；不使用 computer use 代跑網頁流程。config/report.json 的 screenshots 控制下次是否留圖，逐步圖用 captureUi 並附 caption；關閉仍輸出 HTML／TXT。HTML 含情境總覽、預期及結果、清理與可點擊放大的畫面證據，產物位於 reports/ui。

新增或修改 catalog 案例時，依 test-cases/README.md 的「流程分類」明確填 target：單支／串接 API 都用 api；網頁用 web、Android 畫面用 mobile、含畫面的跨平台用 mixed。kind: flow 不等於畫面流程；保留 script 與實際 runner 一致。未知平台先詢問，不建立假測試。

## 固定逐操作證據契約

本節取代舊的結束畫面及八張上限說明：網頁從 support/web-test.js 匯入 test／expect，fixture browser 建立的 page／自訂 context 自動對每次常用操作及畫面斷言留圖。多角色立即 setUiRole(page, 角色名稱)；evaluate 或特殊操作使用 uiStep(page, 中文動作與預期, callback)。不得抽樣、八張後略過或只截結束畫面；globalSetup 及 npm run check:ui-evidence 驗證共用 import。截圖關閉仍不擷取，不自行繞過。圖中密碼與 autocomplete=one-time-code 輸入會遮罩，其他個資不保證遮蔽。所有圖依原順序保存於同runId單檔HTML，不分卷也不丟棄逐操作證據；截圖失敗必須回報失敗，不能捏造證據。純 API、關閉頁面與釋放資源不拍圖。先 check:ui-evidence、check:types，再執行已獲授權的產品案例。

## 圖文範本與就緒診斷契約

本節取代舊的通用清單／安全摘要規則：現行採使用者提供的深藍白紙角色圖文範本，網站及離線共用 journey-report。重要頁面用 setUiReady(page, selector) 明示就緒條件，完成後 setUiReady(page, null) 還原；不能只等 goto 返回或把白圖當成功。登入／註冊等回應使用 uiWaitForResponse(page, OperationName, trigger)，先監聽再觸發，逾時保存操作名、上限、安全診斷及當下圖，不重送。catalog 提供整體／規劃預期；uiStep 第四參數與 expect 中文訊息提供當步預期。不得以「依測試檔中的斷言」或同一句通用錯誤取代診斷。未知／舊資料明示未保存；不回填、捏造或輸出原始例外與秘密。

## 畫面實作前核對完整流程

網頁實作前必讀 skills/write-web-tests/SKILL.md。重寫亦須核對目前前端來源與所有會使用的 helper，不把已有腳本當作正確操作或資料授權的依據；完成來源追查及資料核對後再寫相依操作。

catalog 若只有主要動作，本輪卻還需註冊、填表或設定，先依 plan-test-cases 補回必要中間流程、逐步預期及資料依據，保留原意圖、固定 ID 與人工答案。helper 的關鍵操作須對應案例規劃與具名 test.step，不能讓「建立 A／B」隱藏未交代的填值或設定。關鍵缺口集中提問並保留未回答問題，可繼續獨立調查，不猜測完成相依操作，不改成 API 建資料、注入登入或略過畫面來消除缺口。

交付列出前端檔案位置、案例前置／主流程與 spec／helper 的對應、資料依據及剩餘缺口。靜態查碼不代表定位器已實測；只授權寫腳本時，不自行登入、註冊或清理產品資料。

## 單檔報告與完整歷史

依使用者2026-11-10要求，本節取代舊的JSON／HTML／TXT自動產物、八張／4MB分卷及最近100份限制。每次執行在reports/api或reports/ui只寫一份日期時間命名HTML，同runId在進行中與完成時原子更新同檔，不覆寫其他執行。HTML內嵌schemaVersion 1與全部PNG，圖片延遲載入、點擊放大；不自動另寫JSON／TXT或part分卷，純文字仍可由閱讀器按需下載。單張PNG維持2MB檢查；單檔512MB明確上限，超限失敗不丟圖湊成功。所有測試專案共用此契約。前置說明不在報告正文顯示，必要準備操作、原始結構及證據仍保存。歷史列表不截斷100／1000份，提供搜尋與顯示更多；舊JSON／分卷保留相容且不刪除。

## 情境與實際結果敘述

報告須完整交代角色、雙方初始關係、設定、操作先後及在哪裡核對；例如「你與小明都關閉自動同意，彼此沒有對方名片。小明向你索取，你暫不點同意，再查看你的待同意與小明的待審核」。不以「兩邊正確」省略角色與驗證位置。catalog的steps保留完整操作，reporter以scenarioSteps保存，正文標示情境與操作，不另設前置段落。

實際結果只描述本輪通過斷言的觀察；可在全部相關斷言完成後，透過test.info().attach("archify-case-result", {body: "具體結果文字", contentType: "text/plain"})保存角色、畫面、狀態與未出現項目。不得把預期文字直接當實際結果；失敗時必須交代已完成、停在哪一步及尚未驗證範圍。未保存的舊結果不能回填成成功。網站採條列結果，開啟報告另頁閱讀或下載HTML，不內嵌預覽框。
