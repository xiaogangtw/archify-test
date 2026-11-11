# Agent 規則中文化與文件整理

## 範圍
將 AGENTS.md 改為繁體中文，整合文件治理，建立文件入口與可執行的索引檢查；不修改產品行為。

## 影響檔案
- AGENTS.md、package.json、scripts/docs-*.mjs
- docs/README.md、docs/plans/、docs/decisions/
- README.md、apps/web/README.md、ARCHIFY-CURRENT-SPEC.md
- 舊版設計文件的閱讀定位

## 資料庫影響
無。

## 風險
搬移文件可能破壞連結，因此保留原路徑與歷史內容。不把既有紀錄視為目前部署證據。

## 設計文件同步
只整理規則與文件入口，不改路由、守衛、導向、API、GraphQL payload、DB schema 或產品流程；目前規格僅補閱讀定位。

## 領域
文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
`npm run docs:plans:index`：PASS，已更新 1 份計畫索引。

`npm run docs:check`：PASS，文件入口、本機連結、計畫結構與索引一致。

以暫時變更測試過期索引、缺少必要章節、失效連結與不完整審查狀態，四種情況均正確回傳失敗，測試後已還原。

`git diff --check`：通過，僅提示 Git 的 LF／CRLF 正規化。

未修改 UI 或產品邏輯，未執行前端建置、瀏覽器、真實手機或 VM 部署驗收。文件檢查不涵蓋遠端 URL、Markdown 錨點及整套上游參考資料。
