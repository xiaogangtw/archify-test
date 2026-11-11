# 獨立測試專案 TypeScript 開發設定

## 範圍
新建專案內建 TypeScript、Node 型別、共用 BFF 宣告與 check:types；同步補齊既有外部測試專案，不修改登入資料或執行真實登入。既有專案不靜默覆寫自訂設定。

## 影響檔案
- test-project/package.json、package-lock.json、tsconfig.json、support/bff.d.mts
- services/local-workspace/workspace.mjs 與初始化回歸測試
- docs/local-workspace.md、ARCHIFY-CURRENT-SPEC.md、測試專案 README
- 外部測試專案對應開發設定

## 資料庫影響
無。

## 風險
型別檢查可能揭露既有腳本錯誤；不得用停用 strict 或排除登入案例掩蓋。依賴安裝只準備工具，不發送產品請求。

## 設計文件同步
同步初始化行為與型別檢查操作；無 UI、路由或產品 API 變更。

## 領域
測試框架、本機服務

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
修正前以 TypeScript strict 檢查登入案例，確認缺 node:crypto／process 的 Node 型別及 bff.mjs 宣告；不是 Playwright API 版本錯誤。

- test-project 的 npm ci --ignore-scripts 與 npm run check:types 通過，鎖版 TypeScript 5.9.3、@types/node 22.20.5。
- 外部測試專案 npm install 及 npm run check:types 通過，所有現存腳本納入 strict 檢查。補設定前後比對 tests 全部檔案及 .env hash 相同；舊 package.json 保存於 legacy 備份。未執行產品登入。
- 初始化回歸加入生成稿、Node API 與共用 Header／資料解析型別驗證；刻意加入 boolean 指派錯誤會收到 TS2322。單檔 6 項通過。初次沙箱因暫存 rename／junction EPERM 失敗，提升權限原樣重跑通過，未放寬測試。
- 無 UI 或樣式變更，不需視覺 gate；同步目前規格 1.37、本機服務 2.10、範本與現有專案 README。
- npm run test:workspace 全部 17 項通過；docs:plans:index、docs:check 及 git diff --check 通過。
