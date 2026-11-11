# 案例庫列空間修正

## 範圍
修正自動化與腳本案例庫共用列的編號換行及名稱過早截斷；不改資料與操作。

## 影響檔案
- apps/web/src/features/testing/ScriptLibrary.tsx
- apps/web/README.md

## 資料庫影響
無。

## 風險
窄螢幕及放大時需確認操作與文字不溢出。

## 設計文件同步
前端 README 同步共用列響應式行為；無路由、守衛、導向、API、GraphQL payload 或 DB schema 變更。

## 領域
前端

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
`npm.cmd run build --prefix apps/web` 通過（既有大型 chunk 警告）。瀏覽器驗證使用 bundled Playwright 及本機 Chrome；既有 `verify-flow-case-ui.mjs` 在等待「已整理 Appium 流程建議。」時逾時（verify-unified-flow-ui.mjs:33），未通過。`npm.cmd run docs:plans:index`、`npm.cmd run docs:check` 與 `git diff --check` 通過。尚未完成人工視覺檢查與全部適用 UI gates，不宣稱可供審查。
