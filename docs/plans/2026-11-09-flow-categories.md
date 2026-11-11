# 測試流程明確分類與 AI 指引

## 範圍
以 target 區分 API／畫面流程，保留舊案例相容；同步新初始化專案與既有外部測試專案的分類指引，不執行產品測試。

## 影響檔案
- apps/web/src/features/workspace/FlowWorkspace.tsx、catalog.ts
- test-project/AGENTS.md、test-cases/README.md、skills/
- docs/test-traceability.md、ARCHIFY-CURRENT-SPEC.md
- scripts/verify-flow-categories.mjs

## 資料庫影響
無，沿用 schemaVersion 1 與既有 target 欄位。

## 風險
舊案例沒有 target 時只能由腳本路徑或 kind 推定；無法辨識者顯示待分類，不捏造平台。既有專案只補分類與指引，保留人工內容。

## 設計文件同步
目前規格與測試關聯文件同步分類、相容性與初始化指引。

## 領域
前端、測試框架、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- npm run build --prefix apps/web：通過。
- npm test：13 項框架測試通過。
- npm run check:types --prefix test-project：通過。
- npm run test:workspace：48 項回歸測試通過。
- DS_REQUIRE_BROWSER=1 node scripts/verify-flow-categories.mjs：明確 target、API 串接、舊案例路徑、待分類、鍵盤切換、重新讀取、新專案 AI 指引、axe、控制項尺寸、390／1024／1280／1440／1920 溢位與 200% 縮放通過；以記憶體影像實際查看畫面，未儲存截圖。
- DS_REQUIRE_BROWSER=1 node scripts/verify-reader-ui.mjs：閱讀器回歸、axe／對比、焦點及 reduced motion 通過。
- npm run docs:plans:index、npm run docs:check、git diff --check：通過。
- 沙箱第一次瀏覽器 gate 因暫存目錄 rename EPERM 失敗；以同一指令在沙箱外重跑通過。
- 已定向更新外部獨立測試專案的 AGENTS、五份撰寫 skills、案例格式與登入案例的 `target: api`，未改其他案例內容及腳本。其他已初始化專案不自動覆寫自訂指引。
- 未執行產品 API、LINE、手機截圖或推播；未宣稱產品業務驗收。
