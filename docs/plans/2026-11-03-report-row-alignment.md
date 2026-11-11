# 執行紀錄批次報告列對齊

## 範圍
執行紀錄只列單次執行，不顯示批次報告及批次成員；品質報告採左名稱摘要、右狀態與操作的緊湊列，窄螢幕換行，保留查看、下載、改名與刪除。

## 影響檔案
- apps/web/src/features/testing/QualityReports.tsx
- apps/web/src/features/testing/VersionResults.tsx
- scripts/verify-execution-ui.mjs
- ARCHIFY-CURRENT-SPEC.md
- apps/web/README.md

## 資料庫影響
無。

## 風險
長名稱與窄螢幕的換行及操作溢位。

## 設計文件同步
前端 README 與目前規格同步執行紀錄／品質報告分工；無路由、API 或資料流改動。

## 領域
前端

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
- npm run build --prefix apps/web 通過，保留既有大型 chunk 提醒。
- verify-execution-ui.mjs 以 DS_REQUIRE_BROWSER=1、實際 Chrome 與隔離資料通過單次／批次分流、篩選、查看、PDF 下載／原生下載、改名、刪除確認／取消／失敗重試與重新整理保留，320／390／1280px 無水平溢出。未操作正式資料。
- reports-gate.html：states 20 element-states、axe 0 violations、keyboard 6 controls、target size 12 targets、responsive 280/320/414px（含 1.25x）、mobile first 320px、overflow 320/414/1280px、reduced motion 通過。intent 辨識 0，不能推論中文字義已驗證。瀏覽器 gates 使用既有 Playwright shim 與系統 Chrome，沒有 SKIPPED。
- 額外實際量測 1440px 品質報告按鈕位於資訊右側且同列，通過。未保存截圖。
- 受影響兩檔 hardcode、emoji、native select 檢查通過；初次 Python cp950 讀取失敗，設定 PYTHONUTF8=1 後重跑成功。沒有更動 token；既有 history-tokens 投影檢查及亮色必要對比通過，裝飾邊框 advisory 保留，不宣稱此投影為新生成 token。
- npm run docs:plans:index、npm run docs:check、git diff --check 通過。
- Work 設定停用瀏覽器操作，人工實際畫面檢視尚未完成，因此可供審查保留未勾選。上述自動量測不等於視覺品味驗收。無 API／DB／部署改動。
