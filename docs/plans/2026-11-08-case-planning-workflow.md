# 測試案例文字表格與確認流程

## 範圍
依使用者接續調整，測試流程改為唯讀文字表格，只保留重新讀取及專案位置。規劃、補問題與實作全回獨立專案，本機 AI 不再要求網站確認。沿用 catalog.json，不建立第二份案例來源。既有確認資料保留相容，不作日常前置條件。

## 影響檔案
- services/local-workspace/catalog、workspace、plugin 與回歸。
- apps/web 測試流程頁、案例編輯與共用型別。
- test-project/support、skills、案例說明及獨立專案交付。
- 目前規格與操作文件。

## 資料庫影響
無；catalog schemaVersion 1 規劃欄位保留，舊確認記錄保留相容，日常不讀取或要求確認。

## 風險
網站不編修流程；本機 AI 仍須依證據補問題，不以欄位完整當成執行通過。舊確認核對只供歷史用途。

## 設計文件同步
目前規格、案例關聯文件、前端 README、DESIGN、獨立專案 README 與 AGENTS。

## 領域
前端、本機服務、測試框架、Skills

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據

### 初版規劃／確認實作
- npm run build --prefix apps/web、npm test（12 項）、npm run check:types --prefix test-project、npm run test:workspace（27 項）通過。
- 新服務回歸驗證未答問題／缺步驟拒絕確認、同源 session、外部 AI 直接修改、過期 revision／knowledge fingerprint 拒絕、來源變動、CLI exit code 及新規劃欄位影響報告意圖 hash。
- DS_REQUIRE_BROWSER=1 下 verify-case-plans-ui、verify-reader-ui、verify-local-workspace-ui、verify-catalog-ui、verify-frontend-overview-ui、verify-website-ai-ui、verify-knowledge-ui 通過；涵蓋新增編修、回答問題、確認對話框、重載、知識／外部編輯失效、任務複製、舊流程閱讀與 axe／鍵盤／縮放／多視窗溢位。實際查看記憶體畫面，未保存截圖。
- 官方 quick_validate.py 以 uv --with pyyaml 檢查兩個新 skill，均為 Skill is valid。原 Python 缺 pyyaml，改隔離相依，不新增產品依賴。
- 已交付外部測試專案共 10 檔，原檔備份 legacy/framework-upgrades；未修改其 catalog、現有腳本或 .env。外部專案 check:types 通過，實際唯讀載入 1 個舊案例，狀態為待補資料，未代替使用者確認。
- node scripts/verify-feature-graph.mjs、docs:plans:index、docs:check、git diff --check 通過。
- 未執行產品 API、真實推播、Appium 或模型產生案例。CLI 不讀外部前端，來源實體核對由網站負責，確認是版本約定而非密碼簽章。

### 接續簡化為唯讀表格

- build 通過；test:workspace 27 項、npm test 12 項、test-project 及外部測試專案型別檢查通過。
- case-plans 僅讀 catalog、保持內容原樣並維持 session 限制；預設 CLI 無 reviews 也可回傳 ready，--review 保留舊核對測試。
- DS_REQUIRE_BROWSER=1 的 verify-case-plans-ui、verify-reader-ui、verify-local-workspace-ui 通過。新 gate 實測只有重新讀取按鈕、無輸入／編修／確認／任務操作、專案位置、外部編修重讀、無效資料保留舊表格、空狀態及 axe／焦點／目標尺寸／縮放與多尺寸溢位。已查看實際記憶體畫面，未保存截圖。
- 兩個 skill 官方 quick_validate.py 通過；docs:plans:index、docs:check、git diff --check 通過。
- 外部測試專案同步 8 檔，舊版備份 legacy/framework-upgrades；catalog、測試腳本及 .env 保留。未執行產品 API 或模型規劃。
