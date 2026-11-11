# 畫面測試等待與進度

## 範圍
補上終端逐步進度、逐案報告快照及操作等待上限；可同步外部測試專案的流程與清理限制。不執行產品帳號操作。

## 影響檔案
- test-project/support/archify-reporter.mjs、commands.mjs、playwright.config.ts
- test-project/framework/progress.test.mjs
- docs/ui-testing-reports.md、ARCHIFY-CURRENT-SPEC.md
- 外部測試專案對應框架及輔助設定

## 資料庫影響
無。

## 風險
中止或清理逾時可能留下帳號，必須記錄待處理；執行中快照只包含已結束案例，不能當整批完成。

## 設計文件同步
同步報告專題與目前規格；無頁面、路由或 API 變更。

## 領域
測試框架

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
npm test：14/14 框架合成測試通過，驗證逐案失敗快照、完成後同檔更新、暫存檔及待清理摘要。沙箱阻擋暫存檔更名，改於核准的沙箱外重跑通過。外部測試專案 npm run check:types 通過。npm run docs:plans:index、npm run docs:check 及 git diff --check 通過。未執行真實產品／帳號操作，無 UI 元件變更，不適用視覺驗證。外部原檔已備份 legacy/framework-upgrades。

接續修正：commands.mjs 以 --project=web 等形式傳參，防止單檔路徑被 variadic project 選項吞入，實測單檔 `--list --reporter=list` 只列目標測試檔且不執行 body。
