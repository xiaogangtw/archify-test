# 案例品質檢查

## 範圍
擴充獨立測試專案 cases:check 的唯讀品質提醒與 --all 批次檢查。此次先完成案例品質；共用頁面操作及歷次報告比較尚未實作，不自動修改案例或執行產品測試。

## 影響檔案
- test-project/support/case-quality.mjs
- test-project/support/case-plan-cli.mjs
- test-project/framework/case-quality.test.mjs
- test-project/test-cases/README.md
- docs/test-traceability.md

## 資料庫影響
無。

## 風險
啟發式提醒可能漏報或誤報，不判定業務根因、矩陣執行覆蓋或需求完整性。提醒不改變退出碼；資料完整性錯誤仍失敗。

## 設計文件同步
同步功能與測試關聯及測試專案案例說明。無 UI、路由、API 或 schema 變更。

## 領域
框架、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
npm test：24 項通過、0 失敗。docs:plans:index 與 docs:check 通過。未執行產品測試，既有外部測試專案不自動升級。

