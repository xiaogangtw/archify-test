# API 回應預覽

## 範圍
確認 reports 已由 .gitignore 排除，新增可重用的回應預覽，將 HTTP 狀態與遮蔽後 JSON 顯示於終端及獨立 HTML／JSON 報告；套用現有登入案例。不重新呼叫產品登入，不改平台網頁。

## 影響檔案
- test-project/support/response.mjs、response.d.mts、archify-reporter.mjs
- test-project/framework/html.mjs、response.test.mjs
- 外部測試專案對應檔案與登入案例
- 目前規格、本機服務文件、登入文件及測試專案 README

## 資料庫影響
無。

## 風險
規則遮蔽不能保證辨識任意自由文字中的秘密；預設不保存 Header，非 JSON 不保存原文。報告不進 Git 不等於無法被本機讀取。

## 設計文件同步
同步可選 responses 欄位與本機 HTML 預覽；無平台 UI／路由變更。

## 領域
測試框架、報告

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
範本及外部測試專案的 .gitignore 皆已包含 reports/，無需新增非標準 .ignore。

- 範本與外部測試專案型別檢查通過；npm test 共 11 項通過。loopback 登入驗證成功／缺 token／GraphQL 錯誤三種情況，確認 responses HTTP 狀態、業務欄位及秘密遮蔽；產品請求 0。初次發現 GraphQL message 洩漏替身標記，加入 message／stack 遮蔽後重跑通過。
- 已用 Chrome 1280px 實際查看合成獨立 HTML，HTTP 與 JSON 可見，展開／收合正常；截圖只在記憶體未存檔。無平台 TSX／樣式變更，平台 token gates 不適用。
- 現有專案備份於 legacy/response-preview/2026-11-07，原登入參數、query 與斷言未改，未重新登入產品。平台閱讀器暫不呈現 responses，獨立 HTML 與終端可查看。
- npm run test:workspace 共 17 項通過；docs:plans:index、docs:check 與 git diff --check 通過。
