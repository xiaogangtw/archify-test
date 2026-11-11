# 專案架構盤點與維護入口整理

## 範圍
查證現有程式入口、執行責任與跨目錄依賴，建立維護地圖與可重跑盤點指令。接續整理 Control API Runner 工作通道：抽離 claim、heartbeat、events，注入既有資料庫與交易，維持路由、授權與執行語意。接續修正 API 掃描測試的過期預期，依目前儲存契約區分無 defaults 的來源初始化與已保存接口修改。其他大型領域拆分不在本輪範圍。

## 影響檔案
- `docs/architecture.md`
- `docs/README.md`、`README.md`、`apps/web/README.md`
- `scripts/architecture-report.mjs`、`scripts/docs-check.mjs`、`package.json`

- `services/control-api/src/main.ts`、`runnerRoutes.ts`
- `services/control-api/test/runner-routes.test.ts`

- `services/control-api/test/api-scan-preview.test.ts`、`API-REQUEST-LIBRARY.md`

## 資料庫影響
無。

## 風險
盤點以靜態檔案為準，不能證明動態依賴或部署狀態；不以檔案大小推定品質。

## 設計文件同步
新增架構維護導覽，補充現況規格而不另建競爭的功能規格。未改 UI、路由、守衛、導向、API、GraphQL payload 或 DB schema，整合規格不需修訂。

## 領域
文件治理、架構

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
- `npm.cmd run architecture:report`：成功盤點七個執行目錄；前端 104、Control API 51 個正式來源檔案。未生成產物。
- `npm.cmd run docs:plans:index`、`npm.cmd run docs:check`：通過三份計畫結構、索引與文件本機連結檢查。
- 首輪只變更文件、唯讀盤點工具及文件檢查涵蓋範圍；下列接續工作已實作 Runner 通道拆分，其他大型模組尚未搬移。

接續實作證據：
- Runner 三條工作路由抽離到 runnerRoutes.ts，沿用 main.ts 的授權與錯誤處理；原 SQL、租約與事件語意保留。
- `npm.cmd run check --workspace services/control-api` 通過。
- `npm.cmd exec --workspace services/control-api -- tsx --test test/runner-routes.test.ts`：五組路由回歸通過。
- `npm.cmd test`：第一次有本機連線 EACCES；允許本機測試連線後重跑，227 組中 226 通過、1 失敗、0 略過。失敗為 api-scan-preview.test.ts:40，預期來源 Query 覆蓋舊預設值，實際仍為 old；單獨重跑同樣失敗，該測試及相關產品程式未由本次變更修改。不為此次重構變更該領域行為。
- 環境沒有 DATABASE_URL，未執行需要專用 archify_test 資料庫的 database.integration.ts；替身測試不證明真實 PostgreSQL 併發鎖與交易回復。
- 後續已修正完整回歸失敗（見下）；真實資料庫驗證缺口仍保留，因此整體重構計畫仍不勾選可供審查。未做部署或真實 Runner 驗收。

修復失敗的結果：
- 查證 initialRequest、apiManagement 的儲存流程、api-request-defaults.test.ts 與 API 文件後，確認舊測試「來源覆蓋 defaults」與現行保存修改的契約衝突，產品實作不需修改。
- 修正 api-scan-preview.test.ts：無 defaults 時以來源初始化；來源與手動接口有 defaults 時均保存修改，並確認回傳值的後續編輯不污染保存內容。未刪除測試或略過失敗。
- API-REQUEST-LIBRARY.md 同步來源與保存設定優先序，新增文件版本及修訂紀錄；未改產品路由、守衛、導向、API、GraphQL payload 或 DB schema，整合規格不需變更。
- 相關五組測試通過；型別檢查通過；完整 npm.cmd test 在允許本機測試連線後 227 通過、0 失敗、0 略過。
- 文件索引、docs:check 與 git diff --check 通過。本輪無 UI 實作修改，未執行 UI gates。
