# 單檔圖文報告與完整歷史

## 範圍
報告入口先顯示可搜尋的橫幅清單，每項提供「下載」與另開 HTML「開啟」；不自動顯示空狀態說明或最新報告正文。HTML 恢復原有版型，保留正常流程、原始證據及錯誤標示，只移除「關鍵畫面」分組，不重排其他區塊。更新已產出的 HTML 時須先驗證內嵌資料一致。不執行產品測試。

## 影響檔案
- apps/web/src/features/workspace/ConfiguredReports.tsx
- test-project/framework/journey-report.mjs
- 外部測試專案對應之 `framework/journey-report.mjs` 與 `reports/ui` HTML 報告
- scripts/verify-reader-ui.mjs
- docs/ui-testing-reports.md、apps/web/README.md、ARCHIFY-CURRENT-SPEC.md
- docs/plans/2026-11-10-single-file-report-history.md

## 資料庫影響
無；沿用 schemaVersion 1 報告。

## 風險
另開與下載均使用可信 renderer 依安全解析後報告產生 HTML。重新產生既有報告前後比較 schema 資料，保留所有截圖內容；備份置於系統暫存區以供復原。

## 設計文件同步
更新報告閱讀方式；不改路由、local-api、產品 API 或資料格式。

## 領域
前端、文件

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
npm run build --prefix apps/web 通過；DS_REQUIRE_BROWSER=1 node scripts/verify-reader-ui.mjs 驗證橫幅下載、另開原版HTML、正常流程文字、移除關鍵畫面分組但保留一般圖片證據、搜尋篩選、錯誤保留、可及性及桌面縮放；既有報告重渲染前後 schema JSON 完全一致（1 案例、159 張截圖）；npm run docs:check 通過。不執行產品測試。
