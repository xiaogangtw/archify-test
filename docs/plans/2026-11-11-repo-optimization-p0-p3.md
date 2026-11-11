# 倉庫瘦身、功能地圖強化與工程化優化（P0–P3）

## 範圍
四階段優化：P0 倉庫瘦身、P1 功能地圖層級限制、P2 覆蓋率顏色標註、P3 Workspace 與舊服務封存。不含新功能開發或部署流程變更。

## 影響檔案
- P0：`work/*.tar.gz`（刪除 8 檔）、`design-systems/library/`（刪除 138 檔）、`examples/`（刪除 97 檔）、`.gitignore`
- P1：`test-project/support/feature-map.mjs`、`services/local-workspace/feature-incremental.mjs`、`services/local-workspace/ai-analysis.mjs`、`services/local-workspace/frontend-features.test.mjs`、`test-project/skills/map-frontend-features/SKILL.md`、`apps/web/src/features/workspace/catalog.ts`
- P2：`apps/web/src/features/workspace/feature-graph.ts`、`FeatureMap.tsx`、`MapDetails.tsx`、`CatalogWorkspace.tsx`、`catalog.ts`、`scripts/verify-feature-graph.mjs`
- P3：`package.json`、`package-lock.json`、`scripts/dev.mjs`、`scripts/verify-reader-dev-css.mjs`、`services/local-workspace/test-support.mjs` 及 5 個 `createRequire` 引用；文件同步：`ARCHIFY-CURRENT-SPEC.md`、`README.md`、`docs/README.md`、`docs/architecture.md`、`docs/frontend-feature-overview.md`

## 資料庫影響
無。

## 風險
- P0：刪除後不可復原（均為未引用上游／暫存資產，Git 歷史仍保留）。
- P1：既有無 `level`／`parentId` 提案保持向下相容，但超過 8 個分支的提案將被拒絕。
- P2：新增覆蓋率標記與分層切換；維持既有 `aria-label` 與 Tailwind token 規範。
- P3：`services/control-api/` 因 `services/local-workspace/scan.mjs` 與 `frontend-features.mjs` 仍直接引用其 AST 模組（`requestCatalog.ts`、`sourceModuleResolver.ts`），暫保留目錄本身並僅自 root workspaces 移出；`services/android/*.test.mjs` 依賴 `zod`（從 `control-api/package.json` 解析），須確認或另行補強。

## 設計文件同步
已同步 `docs/frontend-feature-overview.md`（1.3）、`docs/architecture.md`（1.20）、`ARCHIFY-CURRENT-SPEC.md`（1.63）、`README.md` 與 `docs/README.md`。

## 領域
前端、框架、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
- P0 清理實測：刪除 `work/*.tar.gz`（8 檔 0.83 MB）、`design-systems/library/`（138 檔 1.46 MB）、`examples/`（97 檔 3.59 MB），共減少 243 檔 / 5.87 MB；專案排除 `.git` 與 `node_modules` 後由 1102 檔（30.11 MB）降至 859 檔（24.24 MB，內含 `apps/web/public/fonts` 13.53 MB 與 `work/` 其餘 5.01 MB 開發測試檔）。
- `npm install`（於 root 執行）：exit 0（added 152 packages, audited 156 packages），成功一鍵安裝 `apps/web` 與 `test-project` workspaces。
- `npm run build --prefix apps/web`：exit 0（`tsc -b && vite build` 通過；檢查 `dist/assets/index-BQEnY6Oh.css` 包含 `stroke-success`、`stroke-warning`、`stroke-danger`、`fill-success`、`fill-warning`、`fill-danger`、`text-success`、`text-warning`、`text-danger`）。
- `node scripts/verify-feature-graph.mjs`：exit 0，PASS（含 L1~L4 層級不重疊與 full/partial/none 覆蓋率分類驗證）。
- `node scripts/verify-reader-dev-css.mjs`：exit 0，PASS（根目錄 cwd Vite 開發 CSS 正常解析）。
- `npm run dev`（實測啟動 `scripts/dev.mjs`）：exit 0，Vite v7.3.8 成功啟動於 `http://127.0.0.1:5173/` 並回應 HTTP 200（`vite/package.json` 定位 `bin/vite.js`）。
- 靜態 UI 規則檢查（`CatalogWorkspace.tsx`、`CaseEditor.tsx`、`FeatureMap.tsx`、`MapDetails.tsx`、`KnowledgeWorkspace.tsx`、`KnowledgeImport.tsx`）：6/6 PASS（無 `style=`、`<select>`、emoji 或硬編碼 hex）。
- Headless Chrome 實測（透過 `node_modules/@playwright/test` 載入 `apps/web/dist` 與 `test-project/test-cases/catalog.json`）：PASS（驗證綠／黃／紅框線與覆蓋文字、預設隱藏與切換 `跳轉／關聯連線`、點擊漏測節點顯示 `複製 AI 補齊測試草稿任務` 與 `新增測試案例`、0 console/pageerror、390/1024/1280/1440/1920 寬度無水平溢位）。
- 核心工作區測試（`node --test --test-concurrency=1` 執行 `frontend-features.test.mjs`、`feature-incremental.test.mjs`、`ai-analysis.test.mjs`、`catalog.test.mjs`、`knowledge.test.mjs`、`knowledge-fast-update.test.mjs`）：20/20 PASS；`reusable-api.test.mjs`（實測於非沙盒執行）：2/2 PASS。
- `npm test`（`test-project` `check:framework`）：21/22 PASS；唯一失敗為既有的 `framework/case-narrative.test.mjs`（期待 `/後續業務結果尚未驗證/` 與實作字串不符，本次未更動）。
- 未完成／受阻範圍：
  1. 本機無 `.local/gate-deps/node_modules/axe-core`，故未執行完整 `verify-frontend-overview-ui.mjs` 與 `verify-catalog-ui.mjs` 的 WCAG axe-core 自動稽核（已由上述 Chrome 實測替代畫面與互動驗證）。
  2. `workspace.test.mjs:125` 需 Windows 建立符號連結權限（本機 `EPERM`）；`ui-report.test.mjs` 啟動預設 Chrome 未加 `--no-sandbox` 逾時未結束。
  3. `npm run android:test` 33/39 PASS，6 支失敗因 `services/android/appium-commands.mjs` 透過 `services/control-api/package.json` 引用 `zod`，該服務已移出 root workspaces 且未另裝依賴。
- `npm run docs:plans:index` & `npm run docs:check`：exit 0，PASS（45 份計畫索引與本機連結一致）。
