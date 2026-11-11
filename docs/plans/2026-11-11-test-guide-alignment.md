# 對齊自動化測試與案例設計指南（全量補強）

## 範圍
依據《自動化測試架構與高可讀性測試案例設計指南》盤點結果，在本機分析框架與閱讀器產品邊界內，一次補齊 7 項設計與機能缺口：
1. L1～L4 功能樹細部驗證與 Prompt 約束（L2 最多 6 個、禁止重複功能名與步驟式命名、L4 動詞＋受詞、禁 L5 邊界／步驟）
2. 測試因子（`factor`）與決策矩陣表（`decisionTable`）資料模型、編輯器與表格檢視
3. 案例規劃 Skill 加入「黃金 3 步減重、公用前置收斂、決策矩陣與標題格式」規範
4. FeatureMap 加入「灰色：孤立／廢棄（`state: 'not-found'`）」分流與清理提示
5. CatalogWorkspace 新增「缺口與覆蓋報表」（含因子矩陣、測試金字塔 API/UI 佔比、孤立案例與 PRD／知識比對缺口）
6. AI 補測草稿 Prompt 納入減重、測試因子與矩陣規範

不包含遠端 CI 執行、缺陷看板流轉、混沌／壓力測試等超出本機分析／閱讀器邊界的功能。

## 影響檔案
- 驗證與契約：`test-project/support/feature-map.mjs`、`test-project/support/script-evidence.mjs`、`test-project/support/case-plan.mjs`、`services/local-workspace/catalog.mjs`、`services/local-workspace/ai-analysis.mjs`
- Skills 與測試規則：`test-project/skills/map-frontend-features/SKILL.md`、`test-project/skills/plan-test-cases/SKILL.md`、`test-project/test-cases/README.md`
- 前端介面：`apps/web/src/features/workspace/catalog.ts`、`feature-graph.ts`、`FeatureMap.tsx`、`MapDetails.tsx`、`CaseEditor.tsx`、`CatalogWorkspace.tsx`、`FlowWorkspace.tsx`
- 測試與文件：`services/local-workspace/frontend-features.test.mjs`、`catalog.test.mjs`、`scripts/verify-feature-graph.mjs`、`ARCHIFY-CURRENT-SPEC.md`、`docs/frontend-feature-overview.md`、`docs/test-traceability.md`、`docs/architecture.md`

## 資料庫影響
無（純 JSON schema 向下相容可選欄位擴充）。

## 風險
- `validateFeatureMap` 新增 L2 上限 6 與重複/步驟命名檢查後，不合規的新提案會立即退回要求收斂。
- 舊 `catalog.json` 不含 `factor` 與 `decisionTable` 欄位，須確保所有檢查、雜湊與 UI 皆保持向下相容。

## 設計文件同步
將同步更新 `ARCHIFY-CURRENT-SPEC.md`、`docs/frontend-feature-overview.md`、`docs/test-traceability.md` 與 `docs/architecture.md`。

## 領域
前端、框架、AI 分析、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
- `npm run build --prefix apps/web`：exit 0，`tsc -b && vite build` 成功（`dist/assets/index-D38soq08.css` 確認編譯出 `stroke-muted`、`fill-muted`、`line-through`、`stroke-success`、`stroke-warning`、`stroke-danger`）。
- `node scripts/verify-feature-graph.mjs`：exit 0，PASS（驗證含 `factor` 欄位、L1～L4 不重疊佈局及 `retired` 已廢棄狀態）。
- 靜態 UI code gate（8 個 `apps/web/src/features/workspace/*.tsx` 元件）：8/8 PASS（無 `style=`、`<select>`、emoji 或硬編碼 hex）。
- Headless Chrome 實測（透過 `node_modules/@playwright/test` 載入 `apps/web/dist` 與含合成 `not-found` 功能及決策矩陣案例的 `catalog.json`）：exit 0，PASS（驗證 `FeatureMap` 灰色虛線廢棄節點 `廢棄 (1)`、`缺口與覆蓋報表` 測試金字塔與雙向缺口決策表、`孤立與廢棄案例待清理清單`、`PRD 與知識覆蓋提醒`、`CaseEditor` 測試因子與決策矩陣表編輯、`FlowWorkspace` 矩陣顯示、0 console/pageerror、390～1920px 無溢位）。
- Workspace 單元測試：
  - `frontend-features.test.mjs`：2/2 PASS（涵蓋 L2 上限 6、同層重複名稱與步驟式命名拒絕）
  - `ai-analysis.test.mjs`：3/3 PASS
  - `catalog.test.mjs`（含新增 `factor` 與 `decisionTable` 驗證）、`case-plan.test.mjs`、`feature-incremental.test.mjs`、`knowledge.test.mjs`、`knowledge-fast-update.test.mjs`：皆通過（前次併發執行曾遇 2 次 Windows 暫時性 `EPERM rename`，單獨執行已驗證通過）。
- `npm test`（`check:framework`）：21/22 PASS，僅既有的 `framework/case-narrative.test.mjs` 字串不符（本次未更動）。
- 剩餘限制（尚未勾選「可供審查」）：本機缺 `.local/gate-deps/node_modules/axe-core`，尚未跑完整 [verify-catalog-ui.mjs](../../scripts/verify-catalog-ui.mjs)／[verify-frontend-overview-ui.mjs](../../scripts/verify-frontend-overview-ui.mjs) 的 WCAG axe 自動稽核。
- `npm run docs:plans:index` & `npm run docs:check`：exit 0，PASS（46 份計畫索引與本機連結一致）。
