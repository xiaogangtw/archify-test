# 功能圖增量分析

## 範圍
首次完整分析，後續依來源 hash、頁面依賴與既有功能歸屬縮小 AI 輸入，無變更略過模型。來源設定、路由、知識或不可靠證據變更時完整分析。保留來源與案例版本核對及未受影響功能。

## 影響檔案
- services/local-workspace/frontend-features.mjs、ai-analysis.mjs、workspace.mjs 與增量分析模組／測試
- test-project/support/feature-map.mjs
- docs/frontend-feature-overview.md、docs/website-ai-analysis.md、ARCHIFY-CURRENT-SPEC.md

## 資料庫影響
無；既有 catalog 增加分析基準 metadata，舊資料第一次完整建立基準。

## 風險
靜態依賴非實際呼叫；不確定時擴大分析。仍需讀檔 hash 與靜態掃描，主要減少模型輸入與重複分析，不保證固定加速比例。

## 設計文件同步
更新功能圖分析範圍、完整回退、基準與限制。無 UI 版面變更。

## 領域
本機服務、AI 整合

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- npm run test:workspace：最終版本 43 項通過，含完整建立基準、無變更略過模型且不寫 catalog、單頁增量、保留人工名稱、路由／知識變更完整回退、共用依賴、新增／刪除頁面、同功能擴大、跨範圍關聯與 API 快取失效。
- npm test：13 項框架測試通過。
- npm run build --prefix apps/web：TypeScript 與 Vite 正式建置通過。
- DS_REQUIRE_BROWSER=1 node scripts/verify-website-ai-ui.mjs：真瀏覽器操作 AI 按鈕、地圖更新、知識更新／還原與 axe／對比／溢位通過；模型注入合成結果，不是實際產品或模型品質驗收。未修改 UI 版面或保存截圖。
- 測試曾因沙箱暫存 rename 遇 EPERM，改以核准的本機執行後通過，未修改測試的安全檢查。
- 文件索引與 docs:check、git diff --check 於完成前執行並確認。
- 未送使用者真實來源至模型，未執行產品測試，未量測真實專案加速比例。仍需讀檔與 hash，舊專案下次先完整分析建立增量基準。
