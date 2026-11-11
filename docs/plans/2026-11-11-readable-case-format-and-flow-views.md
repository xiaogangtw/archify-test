# 高可讀性案例格式、測試流程矩陣與多案例地圖排版

## 範圍
- 升級測試案例步驟資料格式：於 `steps` 支援選用 `data`（步驟層級「使用資料」）欄位，並允許非驗證／純輸入步驟的 `expected` 留空，同時保留案例整體 `expected` 與既有資料相容性。
- 強化案例設計規範、AI 規劃與實作技能提示（`test-project/test-cases/README.md`、`test-project/skills/plan-test-cases/SKILL.md`、`test-project/skills/implement-tests/SKILL.md`、`apps/web/src/features/workspace/catalog.ts`）：要求產生精簡步驟動作、明確步驟資料與僅於驗證點填寫精簡預期結果，並將冗長技術來源與補充細節保留於知識庫或可折疊明細，避免輸出大段純文字牆。
- 重新設計 `apps/web/src/features/workspace/FlowWorkspace.tsx`（「測試流程」）：改採全寬分組矩陣表格（呈現 `案例／功能`、`測試步驟`、`使用資料`、`預期結果` 與案例底部簡明摘要），過長舊式前置／清理／預期自動收斂並支援原生展開，維持唯讀檢視與無按鈕表格規則。
- 升級 `apps/web/src/features/workspace/CaseEditor.tsx`：於每列測試步驟提供「步驟／使用資料／預期結果」三欄編輯。
- 修正 `apps/web/src/features/workspace/feature-graph.ts` 與 `FeatureMap.tsx`（功能地圖之「測試流程」圖層）：將多案例由單一無限水平長條改為自動換列格線排版，並針對大型多列地圖在初始檢視保留可讀縮放比例，解決數十個案例縮小至 3% 無法閱讀的問題。
- 更新受表格欄位呈現調整影響的既有驗證腳本與單元測試，並同步設計與規格文件。

## 影響檔案
- `apps/web/src/features/workspace/catalog.ts`
- `apps/web/src/features/workspace/CaseEditor.tsx`
- `apps/web/src/features/workspace/FlowWorkspace.tsx`
- `apps/web/src/features/workspace/feature-graph.ts`
- `apps/web/src/features/workspace/FeatureMap.tsx`
- `services/local-workspace/catalog.mjs`
- `test-project/support/case-plan.mjs`
- `test-project/test-cases/README.md`、`test-project/skills/plan-test-cases/SKILL.md`、`test-project/skills/implement-tests/SKILL.md`
- `services/local-workspace/case-plan.test.mjs`、`services/local-workspace/catalog.test.mjs`
- `scripts/verify-case-plans-ui.mjs`、`scripts/verify-feature-graph.mjs`
- `ARCHIFY-CURRENT-SPEC.md`、`docs/local-workspace.md`、`docs/test-traceability.md`、`docs/frontend-feature-overview.md`、`apps/web/README.md`、`DESIGN.md`

## 資料庫影響
無；僅擴充本機 `test-cases/catalog.json` 步驟內選用 `data` 欄位並相容既有資料，不變更資料庫或 `schemaVersion`。

## 風險
- 允許步驟 `expected` 留空後，`planProblems` 仍必須檢查整體案例 `row.expected` 與每個步驟的 `action` 及 `data`/`expected` 型別，避免空白無驗證案例被標為 ready。
- 重新排版 `FlowWorkspace.tsx` 表格時，須保留 `<table aria-label="測試流程案例">` 語意、`<th>` 首位文字為案例標題（供既有分類測試識別）、不新增表格內 `<button>` 及 `<input>`，並確保 390／1024／1280／1440／1920px 與 200% 縮放無水平溢位。
- 多案例功能地圖換列後，仍需確保所有 SVG 節點完全不重疊且邊界檢查通過。

## 設計文件同步
- 同步 `ARCHIFY-CURRENT-SPEC.md`、`docs/local-workspace.md`、`docs/test-traceability.md`、`docs/frontend-feature-overview.md`、`apps/web/README.md` 與 `DESIGN.md` 描述步驟 `data` 欄位、精簡矩陣案例規格、`FlowWorkspace` 表格排版與多案例功能地圖換列排版；未改後端路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。

## 領域
前端、本機服務、測試框架、AI 指引、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- `npm.cmd run build --prefix apps/web`：通過（`tsc -b && vite build` 60 modules，產出 `dist/assets/index-DPLA8fW3.css` 46.16 kB、`dist/assets/index-CY_PWThb.js` 374.02 kB，1.84s）。
- `node scripts/verify-feature-graph.mjs`：通過（`PASS feature graph`，含 23 個測試案例多列網格排版寬度與零重疊檢查）。
- `node --test services/local-workspace/case-plan.test.mjs services/local-workspace/catalog.test.mjs services/local-workspace/frontend-features.test.mjs`：通過（6/6 pass，驗證步驟 `data`、輸入步驟空白 `expected`、`intentHash` 敏感度及非字串拒絕）。
- `npm.cmd run check:types --prefix test-project` 與 `npm.cmd run check:ui-evidence --prefix test-project`：通過（`tsc --noEmit` 與 `PASS：畫面腳本共用逐操作 fixture 檢查`）。
- `npm.cmd test`：21/22 通過；1 筆既有失敗 `test-project/framework/case-narrative.test.mjs:4:1`（`expected: /後續業務結果尚未驗證/` vs `actual: '...後續結果未驗證。'`，未改動該檔案）。
- 靜態 UI 檢查（修正之 5 個前端檔案）：無 inline `style=`、無 `<select>`、無硬編碼 `#hex` 色碼、無 emoji；`git diff --check` 通過（exit code 0）。
- 無頭 Chrome 瀏覽器實機驗證（以根目錄 `@playwright/test` 掛載 `apps/web/dist` 與 `createHandler` 驗證）：
  - `FlowWorkspace`（`?view=flows`）：四欄標題 `案例／功能 | 測試步驟 | 使用資料 | 預期結果`、步驟 `member-01` 與逐步預期 `收到會員 Flex Message` 顯示正確；`<th scope="row">` 首位文字為案例名稱；`main` 僅 3 顆按鈕、0 個輸入欄、表格內 0 顆按鈕；長文自動折疊並點擊原生 `<details>` 展開全文；測量色彩對比 `thead th` 6.64、`tbody th span` 15.08、`tbody td` 14.64、`tbody td .text-muted` 7.09、`details summary` 14.18、`details p` 6.64（全數 >= 4.5）；390／1024／1280／1440／1920px 及 200% zoom 零水平溢位；`Tab` 焦點環可見且按鈕高度 >= 32px；損壞 JSON 回退保留原表（觸發 2 次預期的 400 `case-plans` 錯誤檢查）、空清單與重新載入皆正常。
  - `FeatureMap`（`?view=catalog` 23 個案例之「測試流程」層）：23 個案例節點全數渲染且 0 重疊，初始縮放為 `55%`（非 3%），點擊「適合視窗」後為 `41%`；於 `CaseEditor` 編輯「使用資料 1」並儲存成功寫入 `steps[0].data === 'member-02'`。
  - 環境限制說明：本儲存庫 `.local/gate-deps/node_modules/axe-core` 與 `playwright` 不存在於磁碟，故未執行 `axe-core` 掃描腳本（`verify-case-plans-ui.mjs` 原路徑未執行），另觀察到 `CaseEditor.tsx` 既有 `<input pattern="[A-Za-z][A-Za-z0-9_-]{0,79}">`（與另 3 個未改動檔案共用）在 Chrome `/v` 正則模式產生預存 console 警告；未啟動遠端部署或產品實際執行。
