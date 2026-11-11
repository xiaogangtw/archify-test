# 移除案例庫狀態欄

## 範圍
依使用者要求移除案例列的草稿／候選／執行狀態欄，保留原列執行色彩、操作與輔助技術的執行結果通知。執行紀錄與案例 metadata 不變。

## 影響檔案
- apps/web/src/features/testing/ScriptLibrary.tsx
- apps/web/README.md

## 資料庫影響
無。

## 風險
一般案例原列執行仍須保留可讀結果；以有執行時的非欄位回饋呈現。Android 結果沿用原執行頁。

## 設計文件同步
前端 README 同步列表行為；不變更路由、守衛、導向、API、GraphQL payload 或 DB schema，整合規格不需更新。

## 領域
前端

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
- 前端 TypeScript／Vite 建置通過，仍有既有大型 chunk 提示。
- docs:plans:index、docs:check 通過。
- 實際 Chrome 查看自動化案例庫五筆案例，狀態欄已消失；名稱搜尋及清除恢復列表正常。未保存截圖。
- 案例編碼搜尋既有不支援，不在此次修改範圍。
- 完整 UI gates、手機版與實際原列執行回饋尚未驗證，因此不勾選可供審查。

