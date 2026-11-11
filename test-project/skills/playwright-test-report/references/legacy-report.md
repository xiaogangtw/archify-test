---
name: playwright-test-report
description: 使用 Playwright 執行獲授權的手機網頁情境，擷取原始手機畫面，從實際結果產出繁體中文、可離線閱讀的圖文報告。適用於流程驗證、問題重現與回歸；供手機圖文報告使用，與一般 Playwright 執行結果格式分開。
---

# Playwright 手機測試與圖文報告

> 本文件僅說明既有 results.json 及工具契約。視覺範本仍為現行來源，build-report.mjs 已轉接共用 journey-report；新測試使用統一 JSON，不另造結果格式。

## 專案位置與範圍

本技能由使用者提供的 playwright-test-report.7z 調整而來。技能存於測試專案 skills/playwright-test-report/，與測試腳本一起 Git 版控。遵循所在專案 AGENTS.md；不沿用原技能隱藏技能、跳過計畫或改動 .git/info/exclude 的規則。

測試腳本放 tests/web/，共享能力放 fixtures 或 requests，避免改產品來源與框架。實際報告、results.json 與 screenshots 放 reports/playwright/<情境>/<YYYY-MM-DD_HH-mm-ss>/；使用 Asia/Taipei。不要覆寫前次證據，也不自動 stage／commit／push。報告目錄保持 Git ignore。若專案自訂報告目錄，改用其設定。

先依使用者情境整理前置條件、角色、操作順序、預期與清理。發現產品問題先記錄，不自行擴成產品修復。只安裝或更新本技能時，驗證工具即可，不必啟動產品測試。平台已能讀取一般 Playwright 執行結果，但尚不解析本技能的手機圖文 results.json；此 HTML 可獨立開啟。

## 工具與證據

使用直接 Playwright API。先找測試專案已安裝套件，或使用可用的環境依賴工具取得套件位置；scripts/playwright-harness.mjs 支援 PLAYWRIGHT_MODULE_PATH。沒有套件就說明缺少依賴，不自行改 package.json 或安裝瀏覽器。

此版圖文模板專供 390 × 844 CSS px、deviceScaleFactor=1 的手機直式 PNG，locale=zh-TW、isMobile=true、hasTouch=true；不同角色使用獨立 context。這是 Chromium 模擬，不代表真機 LINE／Safari。桌面或其他尺寸先調整模板與驗證，不偽造或縮放證據。

使用 locator、URL、回應或可觀察狀態等待。確認 loading 消失及必要圖片載入後，透過 harness 的 captureMobile 保存 fullPage:false 原始 PNG；長頁分段截圖並註明順序。hideDiagnostics 預設 false；只有確認為開發工具且經授權時可隱藏，須記錄 metadata，不隱藏產品警告或錯誤。

## 環境、資料與授權

先確認網頁測試網址、dev／QA 環境、帳號與必要資料。BFF_BASE_URL 是中間層網址，不一定是 Playwright page.goto 使用的前端網址。秘密只從本機環境讀取，不寫進圖文、results、storageState、HAR 或未遮蔽 trace。

UI 測試以 Playwright 操作實際頁面；API 可用於已授權的前置、結果核對與清理。若主要操作來自中間層，報告明示「中間層流程驗證與 UI 查核」，不能稱全流程 UI E2E。Mock、元件畫面與真實後端結果分開描述，不攔截業務結果來製造通過。

原技能包含特定 LIFF 專案的多帳號 mock；此處不預設存在該能力。需要時先核對目前 LIFF mock 實作與使用者授權，只替換測試身分，不修改產品檔或偽造業務回應。

沿用已有操作授權；發送驗證碼、註冊、申請或刪除帳號不因載入技能而獲得額外授權。清理只限本輪建立且獲授權的資料，逐筆記錄，未知或非預期既有資料停止該分支。執行失敗不重送可能有副作用的操作。

## 結果與報告

逐條保存 PASS／FAIL／BLOCKED／NOT_RUN，記錄 expected、actual、steps、角色與截圖。Assertion 失敗不能被 catch 成通過；獨立情境與清理可在明確隔離下接續，保留 UI 與中間層矛盾證據。

results.json 格式：

```json
{
  "title": "情境名稱",
  "startedAt": "2026-11-07T03:04:05.006Z",
  "date": "2026-11-07",
  "environment": "已授權的測試環境",
  "method": "真實 UI／中間層查核／mock，依實際填寫",
  "summary": "依證據填寫",
  "limitations": [],
  "cleanup": [],
  "cases": [{
    "id": "scenario-name", "title": "案例名稱", "status": "NOT_RUN",
    "expected": "預期", "actual": "尚未執行", "steps": [],
    "screenshots": []
  }]
}
```

截圖項目為 `{"file":"screenshots/01.png","caption":"操作與結果","role":"角色"}`，僅接受報告目錄內 390 × 844 PNG，不接受符號連結或跳出目錄。沒有實際截圖時保留空陣列，不捏造證據。

```powershell
node skills/playwright-test-report/scripts/build-report.mjs reports/playwright/<情境>/<日期時間>
```

輸出日期時間命名的 Markdown、內嵌圖片單檔 HTML 與截圖索引，工具回傳實際檔名。檔名採 startedAt 的台北時間，未提供則用產生時間；保留毫秒與短隨機尾碼避免覆寫。HTML 無外部字體／CDN，可離線閱讀。

使用 Playwright 檢查報告的桌面／窄視窗閱讀、水平溢出、圖片載入、點圖放大與 Escape／關閉。核對原始證據尺寸，不把生成報告的合成測試資料當產品驗收。結束後關閉本輪建立的 context／browser／服務，回覆結果、實際產物位置、限制與清理狀態。
