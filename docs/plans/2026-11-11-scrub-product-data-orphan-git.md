# 清除專案專屬測試資料與重建乾淨本機 Git 歷史

## 範圍
- 清空儲存庫內建的真實產品測試資料與私人路徑／帳號識別字，確保開源／交付時僅保留通用測試框架、`test-project/skills/`、設計規範與文件架構，不外洩任何產品業務規格、端點、帳號或本機路徑。
- 清空 `test-project/test-cases/catalog.json` 為空結構 `{ "schemaVersion": 1, "features": [], "cases": [] }`，刪除 `test-project/tests/ui/helpers/` 產品專用輔助程式、歷史執行失敗筆記 `memory/`、專案實務登入案例專題文件、`scripts/` 單次資料轉換腳本與 `work/` 開發期產品檢查與暫存檔。
- 去識別化 `config/api-environments.example.json`、`test-project/AGENTS.md`、`test-project/README.md`、`test-project/skills/**`、`test-project/tests/ui/README.md`、`test-project/framework/ui-diagnostics.test.mjs`、相關 `docs/`、`docs/plans/`、根文件、`apps/web/*-VERIFICATION.md`、`scripts/` 與測試替身字串中的產品名稱、網址、操作名與個人本機路徑。
- 於所有清理與檢查通過後，將目前本機分支（`main`）重建為單一全新 orphan commit（移除所有舊 commit 歷史），不自動推送至遠端。
- 不包含：修改外部獨立測試專案資料夾、更改 `.local/` 或 `.env` 忽略設定或執行 `git push`。

## 影響檔案
- `test-project/test-cases/catalog.json`、`test-project/tests/ui/helpers/*`（移除）、`test-project/tests/ui/README.md`、`test-project/AGENTS.md`、`test-project/README.md`、`test-project/skills/**`、`test-project/framework/ui-diagnostics.test.mjs`
- `config/api-environments.example.json`、`memory/`（移除）、`work/`（移除）、專案實務登入驗證專題文件（移除）
- `docs/README.md`、`docs/architecture.md`、`docs/local-workspace.md`、`docs/frontend-feature-overview.md`、`docs/legacy-operations.md`、`docs/ui-testing-reports.md`、`ARCHIFY-CURRENT-SPEC.md`、`API-REQUEST-LIBRARY.md`、`LOCAL-SETUP.md`、`ANDROID-DEPLOYMENT.md`、`apps/web/ANDROID-AUTOVERIFY-VERIFICATION.md`、`apps/web/API-WORKBENCH-VERIFICATION.md`、`apps/web/FLOW-PREVIEW-VERIFICATION.md`
- `docs/plans/*.md`（含受影響之歷史計畫去識別化、登入計畫更名為 `docs/plans/2026-11-07-login-api-verification.md` 與本清理計畫）
- `scripts/*`、`services/android/*.test.mjs`、`services/control-api/test/*`、`docs/plans/README.md`

## 資料庫影響
無；僅清理檔案與重建本機 Git 歷史。

## 風險
- 移除舊專題文件與 `work/` 後，若文件或計畫仍留存相對連結將導致 `docs:check` 失敗；已納入同步盤點與驗證。
- 更新測試替身字串時不可破壞既有 AST 解析、診斷與控制項測試斷言；完成後將重跑單元測試確認。
- 重建本機 `main` 分支為單一 orphan commit 會永久清除本機舊有 commit 歷史，須在全部清理與檢查確認無誤後才執行，並於回覆明確提示使用者自行決定是否 `git push --force`。

## 設計文件同步
- 同步更新 `docs/README.md`（移除已刪除之實務登入文件與 `work/` 驗證文件連結）、`ARCHIFY-CURRENT-SPEC.md`、`docs/local-workspace.md`、`docs/frontend-feature-overview.md`、`docs/legacy-operations.md`、`docs/ui-testing-reports.md` 與根目錄相關文件內含真實產品識別字與開發者桌面路徑之敘述，維護既有文件結構、版本資訊與通用架構規則；未改產品路由、守衛、導向、API payload、GraphQL payload 或 DB schema。

## 領域
框架治理、文件治理、測試資料隔離、Git 清理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- 清理與去識別化檢查：
  - `test-project/test-cases/catalog.json` 已重設為 `{ "schemaVersion": 1, "features": [], "cases": [] }`，保留 `test-project/skills/` 全部技能與 `test-project/framework/`、`test-project/support/` 共用測試框架。
  - 已刪除 `test-project/tests/ui/helpers/`、`memory/`、實務登入專題文件、單次資料庫流程轉換腳本與 `work/` 開發暫存產物，並重新整理登入 API 驗證計畫為 `docs/plans/2026-11-07-login-api-verification.md`。
  - 以正規表達式進行全倉（含未追蹤檔，排除 `node_modules`、`apps/web/dist`、`.local`、`.agents/skills/astryx`）關鍵字掃描：0 筆符合項目。
- 建置與自動化測試（皆於最終檔案編輯後執行）：
  - `npm.cmd run build --prefix apps/web`：通過（`tsc -b && vite build`，60 modules）。
  - `node scripts/verify-reader-dev-css.mjs`：通過（`PASS: root-cwd Vite development CSS resolves sidebar token and reader utilities`）。
  - `npm.cmd run check:types --prefix test-project` 與 `npm.cmd run check:ui-evidence --prefix test-project`：皆通過（exit 0）。
  - `node --test --test-concurrency=1 services/local-workspace/*.test.mjs`（因需真實本機 HTTP／Playwright 與 Windows symlink，於沙箱外執行）：55／55 全部通過。
  - `node scripts/verify-login-case.mjs`（於沙箱外執行）：通過（synthetic loopback 驗證型別、Header、成功與錯誤遮蔽，產品請求 0）。
  - `npm.cmd test`（`test-project` `check:framework`）：21／22 通過；既有 `framework/case-narrative.test.mjs:7` 因字串比對 `/後續業務結果尚未驗證/` 與實作 `後續結果未驗證。` 不符失敗（屬清理前既有差異，本次未變動框架敘述邏輯）。
  - `node --test services/android/appium.test.mjs services/android/bridge.test.mjs`：`bridge.test.mjs` 14／14 通過；`appium.test.mjs` 因 `services/control-api` 移出根目錄 workspaces 後缺少 `zod` 相依失敗（屬既有環境相依狀態）。
  - `npm.cmd run docs:plans:index`、`npm.cmd run docs:check` 與 `git diff --check`：皆通過。
- 本機 Git 歷史重建（不自動推送遠端）：將於最終檢查確認後重建單一 orphan `main` commit；未驗證／未執行項目為遠端 GitHub `git push --force`（須由使用者確認後自行執行）與 `services/control-api` 既有舊服務測試套件（未安裝獨立 `control-api` 相依）。
