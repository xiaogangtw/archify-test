# 修正 Flow Case 再次儲存遭拒

## 範圍
修正儲存契約僅接受 TC 而拒絕既有 FC 編碼；涵蓋插入 API 後再次儲存。不改 API 執行功能。

## 影響檔案
- services/control-api/src/model.ts
- services/control-api/test/script-cases.test.ts
- docs/e2e-api-flow.md

## 資料庫影響
無。編碼仍由伺服器配置。

## 風險
擴充接受既有 FC 格式；不信任客戶端編碼、不更動歷史。

## 設計文件同步
同步 E2E API 文件的儲存相容性限制；不改路由、守衛、導向、API payload、GraphQL 或 DB schema。

## 領域
API

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- 新增回歸在修正前重現 caseCode 的 Zod 拒絕，修正後 `node --import tsx --test services/control-api/test/script-cases.test.ts` 8/8 通過。
- `npm.cmd run check --workspace services/control-api` 通過。
- `npm.cmd test` 235/237 通過；兩項串流測試因本機連線 EACCES 失敗，允許本機連線後定向重跑 android-scrcpy.test.ts 與 android-stream.test.ts，2/2 通過。
- 文件索引與 docs:check 於結束前執行，結果見本次工作紀錄。
- 僅改後端儲存契約，未改 UI，不適用 UI gates；未進行部署、真實手機或資料庫整合驗收。
