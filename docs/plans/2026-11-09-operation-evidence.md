# 固定逐操作畫面證據

## 範圍
共用 web fixture 自動記錄操作與畫面斷言成功／失敗後截圖、角色及順序；新專案預設開啟。報告移除八張靜默略過，按容量拆分報告；同步既有外部測試專案與交付 skills。使用合成頁面驗證，不操作產品帳號或原生手機。

## 影響檔案
- test-project/support、framework、config/report.json、skills、README.md、AGENTS.md
- services/local-workspace/ui-report.test.mjs（驗證初始化交付與讀取）
- docs/ui-testing-reports.md、ARCHIFY-CURRENT-SPEC.md
- scripts/verify-operation-evidence.mjs、scripts/upgrade-operation-evidence.mjs、外部測試專案對應檔案
- AGENTS.md、README.md、docs/decisions/2026-11-09-operation-evidence.md

## 資料庫影響
無。

## 風險
截圖增加時間及容量；操作圖不代表斷言通過。截圖失敗必須使案例失敗，不可默默丟棄。舊稿需使用共用 fixture，任意自行建立瀏覽器不受攔截。

## 設計文件同步
同步報告契約、共用 fixture 與 AI 撰寫規則。第一階段保留原版型；2026-11-10 接續依使用者要求接回深藍白紙圖文範本，網站與離線共用，DESIGN／目前規格／前端 README 同步。

## 領域
測試框架、前端

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- npm test：16/16 通過，包含逐案報告、所有圖片保留、容量分卷、2100 筆步驟分卷與裸 fixture import 攔截。
- npm run test:workspace：51/51 通過；最後針對新增預設開啟斷言再執行 node --test services/local-workspace/ui-report.test.mjs，3/3 通過，使用合成 HTTP／模擬 Appium，未連真實裝置。
- node scripts/verify-operation-evidence.mjs：通過。真實無頭 Chrome 測純合成頁面，包含逐操作／畫面斷言、多角色、自訂 context、鏈式 Locator、frameLocator、popup、鍵鼠、uiStep、超過八張保留、PNG 遮罩像素、失敗當下、skip、關閉選項、截圖失敗被 catch 後整輪仍非零、每卷由現行 parseReport 成功解析。合成案例刻意有失敗，驗證器整體 exit 0 才代表通過。
- 離線 HTML 實際驗證圖片解碼、放大及 Escape 關閉、分卷導覽，並以記憶體圖片查看 1280px 畫面，未保存預覽截圖。保持既有報告 CSS 與圖片版型，只補相同 nav 類型的卷連結與 caption；未修改 apps/web UI，不宣稱完整前端視覺／axe／responsive gates 通過。
- test-project 及外部測試專案的 check:types／check:ui-evidence 通過；外部單檔指令附 --list --reporter=list，正確只列 1 個案例，不執行 body。外部框架與指引原文備份在 legacy/framework-upgrades。
- npm run docs:plans:index、npm run docs:check、git diff --check 通過。保留原有尚未提交修改；臨時合成頁面／報告已移除。
- 未執行真實產品案例、建立／清理產品帳號、開啟 LINE 或原生手機截圖。舊報告不補圖；既有未明確升級的其他專案不自動覆寫。特殊／任意原始物件不保證自動攔截，需 uiStep，靜態 gate 不是惡意腳本沙箱。

## 接續修正範圍

接回使用者圖文範本，網站及離線 HTML 使用同一產生器；補上 catalog 預期、可公開的結構化診斷、頁面就緒及網路等待失敗證據。影響 ReportReader、report 契約、共用 support／HTML、外部 collection helper、驗證器與操作文件。保留既有歷史，舊報告不捏造診斷。設計 brief：Read 模式、測試作者與審查者、精確直接、深藍標頭白紙圖文、無動畫，情境／預期實際／操作圖／診斷清理；使用者範本優先，網站外框深色。


## 接續修正驗證證據（2026-11-10）

- npm test：19/19 通過；新增安全診斷、技能原工具轉接共用產生器與 HTML escaping。
- npm run test:workspace：51/51 通過，含真實合成 Playwright、報告讀取及模擬 Appium；不是真實產品驗收。
- npm run build --prefix apps/web：通過。DS_REQUIRE_BROWSER=1 node scripts/verify-reader-ui.mjs：通過，正式建置攔截本機傳輸，實際驗證網站與隔離 srcDoc 兩層 axe、搜尋／篩選、Tab／Space、放大／Escape、圖文下載、HTML 逃逸與父頁隔離、390／1024／1280／1440／1920 溢位、200% 縮放、32px targets、hover／active／focus 對比及 reduced motion。切換篩選明確重建文件，修正舊內容競爭。
- node scripts/verify-operation-evidence.mjs：最終獨立執行 exit 0，包含 8 個合成情境與刻意失敗。驗證 UI_NOT_READY、延遲呈現、指定回應成功／逾時、失敗當步圖、前置父步驟繼承診斷、catalog 具體預期與前置、分卷及現行 parseReport 相容；測試中故意失敗不能當產品失敗。
- node scripts/sync-report-theme.mjs --check 通過；色彩唯一來源 Tailwind，獨立快照一致。test-project 與外部測試專案 check:types 通過、外部 check:ui-evidence 通過；外部原檔分批備份於 legacy/framework-upgrades。
- 實際以記憶體圖查看 1440px 正式建置：深色外框與深藍白紙圖文並存；操作內外層控制項，未保存預覽截圖。impeccable context 缺引擎及快取權限，依技能明確 fallback 讀 DESIGN／harden／craft-floor，未宣稱引擎 detector 通過。
- npm run docs:plans:index、npm run docs:check、git diff --check 通過。沒有新增路由或本機端點；記錄及文件保留原有未提交修改。
- 未重跑真實產品、登入／註冊、發送驗證碼、LINE 或手機截圖。修正的是報告與取證契約；原產品啟動畫面／登入的實際根因尚未由新一輪證據驗證。舊 HTML／白圖不改寫、不補造缺失資料。
