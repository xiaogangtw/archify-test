# 功能地圖層級、導覽與測試清單 UX 優化

## 範圍
針對「功能地圖」與關聯視圖進行可用性與資訊層級優化：
1. 解決單一空殼 L1 系統節點與固定總覽根節點重複的問題，於總覽圖摺疊單一純容器 L1 系統包裝並將其名稱提升為總覽根節點標籤，直接接續 L2 業務域；群組父層（L2／L3）無直接案例時依子功能覆蓋率彙整狀態與數量，避免誤顯示為紅字漏測。
2. 於功能地圖頂列加入「返回」按鈕與可點擊階層麵包屑，點擊群組功能時顯示該分支子功能樹而非空白孤立節點，點擊下層子功能可繼續鑽研並支援隨時返回上一層或全部功能。
3. 側欄功能清單改採依 `parentId` 樹狀排序與縮排呈現，並依彙整覆蓋率與子樹範圍過濾「測試清單」；區分頂層分類（資料夾圖示與分區線）、次分類（粗細／文字階層、不放狀態點）與實際葉功能（未建測試採中性空心圓且不顯示 `0`，僅已覆蓋項目顯示綠／黃點與案例數），地圖畫布中未建立案例的分類節點亦標示為中性「分類／尚無案例」框線以消除滿版紅點噪音。新增左側功能清單區塊獨立捲動（`lg:sticky lg:top-0` 搭配列表區 `max-h-96 lg:max-h-[max(18rem,calc(100dvh-20rem))] overflow-y-auto overscroll-contain` 及 Tailwind hidden scrollbar utilities，保留捲動且無滾條），以及資料夾群組預設展開、點左側旋轉箭頭收合／展開並寫入 `localStorage` 跨重載記憶（不顯示展開／收合文字，搜尋時不隱藏命中子項）。同時將「手動分析工具」移出窄側欄，改置於右側寬版主區域底部並以「1. 產出前端證據 → 2. 交給本機 AI 整理 → 3. 套用到功能地圖」三欄卡片與可收合指令全文呈現；側欄僅於仍有未連結腳本時顯示「尚未分類（N）」與操作說明。
4. 測試清單補齊所屬功能名稱、前端來源變更視覺提示與「需補充」具體摘要（替代單純數字），並於「地圖／測試清單」切換時保留已選案例焦點。
5. 地圖節點維持兩行安全截斷，新增固定高度不跳動的懸停／聚焦完整名稱與覆蓋摘要讀數列；詳情面板加入階層麵包屑、子功能鑽研按鈕，並為「手動分析工具」補上用途提示，同時排除「缺口與覆蓋報表」中的純系統容器誤報。

不包含 AI JSON Schema 變更、不改變 `validateFeatureMap` 既有規則，也不新增遠端或產品腳本執行入口。

## 影響檔案
- `apps/web/src/components/ui/ds/WorkspaceIcons.tsx`
- `apps/web/src/components/ui/ds/WorkspaceShell.tsx`
- `apps/web/src/features/workspace/feature-graph.ts`
- `apps/web/src/features/workspace/FeatureMap.tsx`
- `apps/web/src/features/workspace/CatalogWorkspace.tsx`
- `apps/web/src/features/workspace/MapDetails.tsx`
- `apps/web/src/features/workspace/GapReport.tsx`
- `scripts/verify-feature-graph.mjs`
- `scripts/verify-catalog-ui.mjs`
- `scripts/verify-frontend-overview-ui.mjs`
- `ARCHIFY-CURRENT-SPEC.md`
- `docs/frontend-feature-overview.md`
- `apps/web/README.md`
- `docs/architecture.md`

## 資料庫影響
無；僅調整純前端圖模型、介面互動與驗證腳本，不變更 `catalog.json` schema 或儲存結構。

## 風險
- 既有驗證腳本對 `專案：前端功能總覽` 節點名稱、`labelLines` 兩行限制及可視 `<button>` 最小觸控尺寸（`height >= 32 && width >= 24`）有明確斷言，需以條件判斷與共用 `ActionButton` 維持相容。
- 循環或懸空 `parentId` 資料若未防護可能導致樹狀走訪無窮遞迴，需在所有遞迴／走訪函式加入 `seen` 集合防護。

## 設計文件同步
實作後同步更新 `ARCHIFY-CURRENT-SPEC.md`、`docs/frontend-feature-overview.md`、`apps/web/README.md` 與 `docs/architecture.md`。

## 領域
前端、設計系統、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
- `npm run build --prefix apps/web`、`node scripts/verify-reader-dev-css.mjs`：通過（`tsc -b && vite build`，64 modules；Vite dev CSS 正確編譯任意高度 `max(18rem,calc(100dvh-20rem))`、`scrollbar-width: none` 與 `::-webkit-scrollbar`）。
- `node scripts/verify-feature-graph.mjs`：通過（驗證既有幾何不重疊與單一純容器 L1 系統節點摺疊、`featureTreeCoverage` 彙整、`MapNode.isGroup`、L2/L3 分支子功能樹展開、`orderedFeatureTree`、`featureAncestors`、`subtreeFeatureIds`）。
- `node --test services/local-workspace/catalog.test.mjs services/local-workspace/frontend-features.test.mjs services/local-workspace/feature-incremental.test.mjs services/local-workspace/ai-analysis.test.mjs`：13/13 通過。
- 無頭 Chrome 互動與排版驗證（`scratch/verify-catalog-ux-browser.mjs`，以正式建置產物 `apps/web/dist` 攔截本機 middleware 與暫存專案資料）：通過（驗證 L1 摺疊為根節點、側欄樹狀 `paddingLeft` 遞增、側欄零 `.bg-danger` 紅點且未測試葉節點省略尾端 `0`、真實滑鼠滾輪 `mouse.wheel` 捲動側欄、`WorkspaceShell` `<aside>` 與功能選擇清單／800px 窄視窗皆維持 `overflowY: auto`／`scrollbarWidth: none`／`barPx: 0`（0px 捲軸寬度）、捲動到底點選項目不捲動外層 `<main>` 且右側地圖保持於視窗內、資料夾收合隱藏子項／搜尋命中不遮蔽／跨 `reload()` 寫入 `localStorage` 記憶並再展開、「手動分析工具」已移至右側主區並以 1–2–3 步驟卡片展開、`尚未分類` 為 0 時隱藏、`部分 (2)` 彙整狀態、節點懸停底部完整名稱讀數列、L2 分支鑽研與 `返回總覽`／`返回上一層`／階層麵包屑、`MapDetails` 顯示子功能清單、L2 測試清單含子樹案例與 `來源已變更`／`需補充` 摘要及切換地圖保留選中案例、缺口報表排除純容器誤報、可視按鈕 `height >= 32 && width >= 24`、靜態樣式規則零 `style=`／`<select>`／emoji／hex 顏色、390/800/1024/1280x720/1440/1920 與 1.25x 縮放零水平溢位、0 `pageerror`）。
- `$env:DS_REQUIRE_BROWSER='1'; node scripts/verify-frontend-overview-ui.mjs` 與 `node scripts/verify-catalog-ui.mjs` 與 `node scripts/verify-website-ai-ui.mjs`：所有前置介面操作皆通過，皆因本機未安裝 `.local/gate-deps/node_modules/axe-core/axe.min.js` 而於呼叫 `axe()` 處中止，故 WCAG `axe-core` 自動稽核與未截圖之桌面人工視覺檢視為未驗證／受阻範圍（待補齊 `axe-core` 依賴後複驗再勾選可供審查）。
- 未執行或非本次範疇之既有環境阻礙：`npm run test:workspace` 於沙盒執行時 `playwright.test.mjs`、`reusable-api.test.mjs`、`ui-report.test.mjs` 與 `workspace.test.mjs`（Windows `symlink` EPERM）共 5 項因沙盒網路／符號連結權限失敗；`npm test` 中既有的 `test-project/framework/case-narrative.test.mjs` 1 項斷言不符（非本任務修改範圍）。
- `npm run docs:plans:index` 與 `npm run docs:check`：通過。
