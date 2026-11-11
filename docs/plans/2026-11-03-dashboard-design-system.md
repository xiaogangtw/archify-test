# 總覽重新設計與 Design System 基礎

## 範圍
依使用者最新要求，頁面採 GitHub 式黑灰白固定深色與 compact 桌面密度，內文 14px。左側保留 144px 結果分布，右側新增最近三筆執行時間線；圖像換為 80px 原創白瓷小鳥，去除大型機器人與彩色點陣。只保留一個查看執行紀錄入口，沒有新的執行操作。不重做其他工作區的版面。
## 影響檔案
- apps/web/src/features/dashboard/Dashboard.tsx、WorkspaceIdentity.tsx、RecentActivity.tsx
- apps/web/src/components/ui/ResultDistribution.tsx
- scripts/verify-dashboard-ui.mjs
- apps/web/src/App.tsx、styles.css、features/testing/reportPdf.ts
- apps/web/tailwind.config.ts、public/brand/
- DESIGN.md、AGENTS.md、ARCHIFY-CURRENT-SPEC.md、apps/web/README.md、docs/README.md

## 資料庫影響
無。

## 風險
共用深色 token 影響所有工作區；PDF 使用同一設定內紙本色以保留白底深字；全站 menu／body 統一 14px，其他工作區保留原版面與既有標題，未聲稱全站遷移完成。總覽資料為既有 runHistory，不代表全部執行或批次。

## 設計文件同步
建立 DESIGN.md 設計系統；目前規格及前端 README 同步總覽行為與採用邊界。

## 領域
前端、設計系統

## 任務狀態
- [x] 已開始
- [ ] 實作完成
- [ ] 文件已同步
- [ ] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
- `npm.cmd run build --prefix apps/web`：通過；保留既有大區塊 bundle 警告，未做無關拆包。
- `DS_REQUIRE_BROWSER=1 node scripts/verify-dashboard-ui.mjs`：通過。驗證應用程式 Tailwind 字級、9 組 AA 色彩對比、新元件 hardcode／emoji／native select、六狀態圖表、最後執行時間、唯一結果入口鍵盤操作、空資料／同步錯誤與桌面 1024／1280／1440／1920px。
- 驗證依賴安裝於忽略的 `.local/gate-deps`（Playwright、axe-core），沒有變更產品依賴。產生 `.local/dashboard-ui/index.html` 使用實際 Dashboard 與建置 CSS，僅 TestingProvider 為明示模擬資料。
- 透過 `.local/dashboard-loader.mjs` 解析驗證依賴，設定 `DS_REQUIRE_BROWSER=1` 執行 `verify_states.mjs`、`axe_audit.mjs`、`verify_keyboard.mjs`、`verify_responsive.mjs`、`verify_target_size.mjs`、`verify_overflow.mjs`、`verify_reduced_motion.mjs`：全部通過。axe 0 違規；狀態 3 次量測。桌面 responsive／overflow 覆蓋 1024／1280／1440／1920px，responsive 另放大 root 字級 1.25 倍；控制項至少 44px。圖表及文字為非互動資訊，不製造 selected/loading 狀態；總覽無破壞性操作，intent 不適用。mobile-first 不再作為本輪產品驗收，依使用者明示桌面專用。
- 實際查看 1440px 本機總覽並操作「查看執行紀錄」，確認進入既有執行紀錄頁後返回總覽。未儲存預覽截圖。
- `npm.cmd run docs:plans:index`、`npm.cmd run docs:check` 及 `git diff --check`：通過（結束前再次執行）。
- Impeccable context 因引擎未安裝及快取權限失敗，改讀專案現有文件；不宣稱通過 Impeccable 引擎掃描。
- 驗證限總覽、色彩 token 及新元件；尚未完成所有工作區字級、密度及視覺回歸，未驗證部署。
- GitHub 參考精修後再次通過前端建置、專用回歸及上述七項 browser gates；實際查看預設桌面與 1440px 畫面、操作唯一查看紀錄按鈕。Design System 更新至 1.1，目前規格 1.20。未新增資訊、路由或深色主題。


