# 分類測試報告與本機畫面測試

## 範圍
報告分 API 與畫面（網頁／Android），固定在獨立專案報告根目錄下分類輸出日期時間命名的 JSON／HTML／TXT。畫面截圖可選且下次執行生效。一般前端走 Playwright，推播在本機 Android 模擬器透過 Appium 查核；網站只設定、啟動環境及閱讀，不執行產品腳本。提供專用 skills、原生 fixture 與唯讀流程分流。依使用者補充，一般網頁以本機 npm run dev 與 LIFF mock 搭實際 BFF 驗證；本輪不開啟 LINE、不擷取實際手機畫面、不發推播，僅保留環境連線與未啟用的框架能力。

## 影響檔案
- test-project 報告產生器、執行設定、畫面 fixtures、原生 Android helper 與 skills。
- services/local-workspace 報告讀取、設定及受控本機環境端點。
- apps/web 測試報告、流程分類與環境面板。
- 對應模組規格、操作文件及獨立專案交付。

## 資料庫影響
無。報告 schemaVersion 1 新增選填類型／截圖資料，相容舊根目錄報告。config/report.json 保存非秘密截圖及裝置選擇，既有報告不回寫。

## 風險
截圖包含實際畫面，只在使用者勾選後產生，不宣稱遮蔽任意個資。Appium 不清除資料、不重置或登入 LINE、不自行發推播；腳本需實際情境及授權。原生環境啟動限定 SDK 已存在的 AVD 與本機 Appium，不提供任意命令。實測須區分合成網頁、Android 系統畫面與真實推播。

## 設計文件同步
目前規格、前端 README、DESIGN、local-workspace、測試專案 README、報告／畫面 skills；新增報告與本機環境專題文件及決策。

## 領域
前端、本機服務、測試框架、Android、Skills

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- npm run test:workspace：36／36 通過。初次沙箱阻擋暫存檔 rename／junction，改以一般本機權限重跑通過。
- npm test：框架 13／13 通過；模板及外部專案 check:types、前端 build 均通過。
- DS_REQUIRE_BROWSER=1：verify-ui-reports-ui、verify-reader-ui、verify-case-plans-ui、verify-local-workspace-ui 通過，涵蓋分類、TXT、截圖設定、舊報告不變、鍵盤、axe、對比與視窗溢位；實際檢視記憶體影像，未保留預覽截圖。
- 網頁／推播／報告 skills 通過官方 quick_validate。合成 HTTP 網頁驗證資料及 DOM；假 W3C 驗證 Android session 與截圖開關，未發產品請求。
- 既有 Archify_API_35（emulator-5554）與本機 Appium 實際連線，建立後關閉自己的 session，只讀系統 UI XML。驗證服務首次 SDK 相對路徑錯誤，僅終止自己的服務，以完整 SDK 路徑重啟後通過。未開 LINE、未擷取手機畫面、未發推播。
- 備份後同步至外部獨立測試專案，保留既有案例及 BFF 設定；環境備份放 Git 忽略的 .local，框架備份放 legacy/framework-upgrades。未執行外部專案的實際業務測試。
- docs:plans:index、docs:check、git diff --check 通過。
- 未驗證：實際前端啟動、LIFF 真實授權、真實 BFF 業務流程與 LINE 推播；手機操作依使用者要求延後。來源要求 Node >=24.22.1，工具環境 24.14.0，未擅自升級或修改前端來源。

## 同任務追加範圍
依使用者提供的測試報告 HTML，新 UI 案例統一放 tests/ui，保留 tests/web 相容。HTML 增加情境摘要、步驟及可放大的證據圖；沒有圖時不留空圖框。網頁流程由 Playwright 執行，禁止以 computer use 代跑。附件僅作版型參考，不載入其中腳本或採用其測試結論。

追加驗證：tests/ui 合成案例透過 Playwright 成功執行，截圖開關、JSON／HTML／TXT 均通過。verify-ui-html 實際操作圖片放大、關閉、Escape、無圖模式、跳脫及 390／1024／1280／1440／1920 溢位，並以記憶體畫面檢視；verify-reader-ui、verify-case-plans-ui 通過。框架 13 項、服務 36 項、模板／外部型別、前端建置及兩項技能 quick_validate 通過。已備份交付外部測試專案，未修改 .env 或既有測試，未執行實際業務。

## 報告頁自動讀取調整
固定使用目前綁定專案與報告根目錄；進入及分類切換自動載入最新報告。移除正式頁檔案匯入與資料夾讀取操作，保留重新整理及緊湊歷史紀錄，不新增路徑選擇。優先改善：主要問題是手動載入才能見結果，其次是檔名／路徑與空狀態重複佔位；維持既有深色 tokens、分類、結果與截圖設定。

報告頁追加驗證：前端 TypeScript／Vite 建置通過；verify-ui-reports-ui 已驗證首次自動最新、點同分類不清空、歷史切換、刷新回最新、重新進入、API／UI 切換、無檔案輸入與設定收合。verify-reader-ui 已改為固定專案傳輸，驗證格式錯誤只顯示一則且保留原報告、流程格式拒絕、搜尋／狀態／鍵盤／axe／對比／尺寸／縮放／reduced motion。以上 DS_REQUIRE_BROWSER=1 通過；記憶體畫面實際檢視未存截圖。lint_hardcodes 掃描兩個變更 TSX 通過，實際 Tailwind token 對比由瀏覽器測量，未以通用 JSON 色票冒充驗證。npm test 13／13、docs:check 與 diff --check 通過。驗證腳本初次仍依舊匯入／隱藏控制項及網址攔截造成失敗，已調整為新入口並重跑，沒有放寬產品行為檢查。未改動外部測試專案或執行產品測試。

## Android 設定技能隨專案交付
新增 skills/setup-android/SKILL.md，包含缺件檢查、官方下載、Google Play AVD、平台與測試專案設定邊界。新初始化遞迴收集 skills，驗證內容完全交付且不覆寫既有檔。可非覆寫補入既有測試專案，不自動安裝、啟動或登入手機。

Android 設定技能追加驗證：setup-android 通過官方 quick_validate；workspace.test.mjs 6／6 通過，包含新建專案技能全文與範本一致、重連後保留人工補充。已備份並補入既有外部測試專案，README／AGENTS／write-push-tests 先備份再增加入口。不安裝 SDK／Appium、不建立 AVD、不登入或操作手機。官方 Android Studio、AVD 與 Appium／UiAutomator2 文件已查閱；技能說明非預設 Appium JS 入口設定與 Google Play 映像要求。docs:plans:index、docs:check、diff --check 通過。
