# 新測試專案清空範本目錄並自動產生單支 API 草稿

## 範圍
- 修正 `services/local-workspace/workspace.mjs` 的 `initialize()`：建立新測試專案時為 `test-cases/catalog.json` 寫入空結構 `{"schemaVersion": 1, "features": [], "cases": []}`，不再將 `test-project/test-cases/catalog.json` 的既有參考資料複製進新專案。
- 擴充 `services/local-workspace/workspace.mjs` 的 `setup()`：在 `initialize()` 與 `scan()` 之後，若專案為 `schemaVersion === 2` 且具備 `support/api-client.mts`，依 500 支分批對掃描結果呼叫非覆寫 `generate()`，讓新專案完成初始設定後即在 `api/` 與 `tests/api/` 產生單支 API 草稿（「測試腳本 → API 單支」立即可見）；既有專案與舊格式仍保留既有檔案且不阻斷連接。
- 補充 `services/local-workspace/knowledge.test.mjs` 驗證新專案初始化後 `test-cases/catalog.json` 為空，且 `setup()` 會自動生成單支 API 草稿並保留人工檔案。
- 不包含：更改外部獨立測試專案目錄內容，或更改 AST API 解析規則。

## 影響檔案
- `services/local-workspace/workspace.mjs`
- `services/local-workspace/knowledge.test.mjs`
- `ARCHIFY-CURRENT-SPEC.md`、`docs/local-workspace.md`、`docs/architecture.md`

## 資料庫影響
無；本機檔案系統初始化與非覆寫草稿生成邏輯調整。

## 風險
- 若連接既有的 `schemaVersion === 1` 或缺少 `support/api-client.mts` 的舊格式專案，`setup()` 需跳過自動 `generate()` 以免阻斷設定；已透過顯式檢查 `marker.schemaVersion === 2` 與 `support/api-client.mts` 存在性保護。
- `initialize()` 改寫入空 `catalog.json` 後，既有測試以新建立專案驗證，且不會影響 `test-project/` 內既有參考檔。

## 設計文件同步
- 同步更新 `ARCHIFY-CURRENT-SPEC.md`、`docs/local-workspace.md` 與 `docs/architecture.md`，註明新專案 `test-cases/catalog.json` 初始化為空且 `setup()` 於新版 Playwright 專案自動非覆寫產生單支 API 草稿；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。

## 領域
本機服務、測試專案初始化、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- `node --test services/local-workspace/knowledge.test.mjs services/local-workspace/required-setup.test.mjs services/local-workspace/script-inventory.test.mjs services/local-workspace/script-sync.test.mjs services/local-workspace/case-plan.test.mjs services/local-workspace/feature-incremental.test.mjs services/local-workspace/frontend-features.test.mjs`：19／19 全部通過；已驗證新專案 `setup()` 後 `test-cases/catalog.json` 為 `{ schemaVersion: 1, features: [], cases: [] }`，且自動非覆寫生成 `api/*.ts` 與 `tests/api/*.spec.ts`（`scripts()` 回傳 3 支 `api` 分類 `draft` 腳本，並保留人工 `Manual.spec.ts`）。
- `npm run docs:plans:index`：通過（`PASS：已更新計畫索引（49 份計畫）`）。
- `npm run docs:check` 與 `git diff --check`：通過。
- 未驗證範圍：未修改外部獨立測試專案目錄；未執行依賴 `.local/gate-deps`（缺少 `axe-core`）的瀏覽器 UI gate。
