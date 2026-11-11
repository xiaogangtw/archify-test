# 案例列文字對齊

## 範圍
對齊分類與案例列左側文字，固定編碼欄寬，讓名稱起點一致；不改操作。

## 影響檔案
- apps/web/src/features/testing/ScriptLibrary.tsx
- apps/web/README.md

## 資料庫影響
無。

## 風險
窄螢幕名稱空間減少，需驗證溢位。

## 設計文件同步
同步前端 README；不改路由、守衛、導向、API、GraphQL payload 或 DB schema。

## 領域
前端

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
前端 build 通過。文件索引與 docs:check 於結束前執行。瀏覽器獨立頁面開啟 http://localhost:5173 遭 ERR_CONNECTION_REFUSED；既有頁面被另一工作階段占用。未完成視覺、互動及瀏覽器 gates，故不勾可供審查；未保存截圖。
