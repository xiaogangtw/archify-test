---
name: write-push-tests
description: 在 Android 模擬器透過 Appium 撰寫 LINE 或 App 推播畫面查核，保留裝置資料與登入，核對訊息文字、入口及有依據的樣式；一般前端頁面交給網頁測試。
---

# Android 推播畫面測試

環境未就緒或換電腦時，先使用 [setup-android](../setup-android/SKILL.md)；既有環境已備齊就直接核對，不重複安裝。

先讀 AGENTS.md、knowledge/README.md、Rich Menu／Flex Message 證據及指定 catalog 案例。缺接收帳號、測試對象、推播來源、預期內容／樣式基準或清理方式，先在專案中集中問清楚；圖片觀察不等於已指定預期。只讀網站表格不提供流程核准。

使用 tests/mobile/*.spec.ts，import `{test,expect}` from `../../support/android-test.js`，案例透過 `{android}` fixture 取得 Appium session。只有推播相關的原生畫面使用此能力；一般前端使用 write-web-tests。

修改報告、安裝框架或檢查環境不等於開啟 LINE、擷取手機畫面或發送推播的授權；只有使用者明確要求執行相關案例時才處理。

本機模擬器、Appium 與測試 App 必須已就緒，選取 config/report.json 的 androidSerial 或設定 ANDROID_UDID；ANDROID_APP_PACKAGE 必須來自實際安裝資訊，不猜名稱。APPIUM_URL 僅接受本機 HTTP。android.activate() 是明確啟動 App 的操作，fixture 本身不清資料、不重裝、不登入 LINE、不自動發推播。noReset／fullReset 由框架固定保護，禁止修改成清資料以排除問題。

使用實際 id、accessibility id 或有證據的 XPath 定位，android.find(...).text()／displayed() 核對接收訊息；需要時可明確 openNotifications() 查看通知。不可只確認 API 發送成功就宣稱接收端通過。重複通知、接收時間窗及帳號應在案例有明確條件，不重送可能有副作用的推播來碰運氣。

訊息文字、操作入口與後端派送分開斷言。原生 XML 不一定提供 Flex Message 所有文字、字級或色彩；沒有可觀察證據與基準就列待補，不能把附件截圖當自動樣式通過。網頁預覽與真正 LINE App 呈現是不同驗收範圍。

截圖受 config/report.json 控制，fixture 在結束時 captureUi 附加 PNG，關閉時不呼叫 screenshot。逐步證據也透過 captureUi，避免任意另存圖檔；不得擷取登入、驗證碼或含未授權個資的畫面。若像素比對是案例必要條件，需已開啟截圖並有版本基準；不具備時標示略過／待補，不宣稱通過。

固定 archify-case ID 與 test.step。先 check:types，再依本次授權執行 npm run test:android；不因載入 skill 取得發送、註冊或清除資料的授權。fixture 結束刪除本次 Appium session，不停止他人服務或清除 App。報告自動放 reports/ui，target 為 android，規則見 playwright-test-report skill。

新增或修改 catalog 案例時，依 test-cases/README.md 的「流程分類」明確填 target：單支／串接 API 都用 api；網頁用 web、Android 畫面用 mobile、含畫面的跨平台用 mixed。kind: flow 不等於畫面流程；保留 script 與實際 runner 一致。未知平台先詢問，不建立假測試。
