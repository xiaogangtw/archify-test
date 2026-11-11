# 測試腳本數量與清單

## 範圍
新增測試腳本唯讀入口，直接掃描獨立專案 tests，顯示檔案數、含內容／空草稿／待核對及分類清單；不執行、編輯腳本，不推定通過或業務完成。

## 影響檔案
- services/local-workspace/script-inventory.mjs、workspace.mjs、plugin.mjs
- apps/web/src/features/workspace/ScriptWorkspace.tsx、WorkspaceApp.tsx、client.ts
- scripts/verify-script-inventory-ui.mjs
- ARCHIFY-CURRENT-SPEC.md、apps/web/README.md、docs/local-workspace.md

## 資料庫影響
無。

## 風險
靜態測試宣告不等於執行數量；動態產生、非標準宣告及語法錯誤列待核對。讀取須限制大小、數量與連結，不 import 使用者程式。

## 設計文件同步
目前規格、本機 API 契約及前端 README 同步入口與計數限制。沿用既有 Tailwind 深色 tokens，無新增視覺系統。

## 領域
前端、本機 API

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
驗證完成，詳見下方。設計 brief：開發工具、測試作者、精確克制、無動畫；數量摘要後接分類與緊湊表格，參考既有 GitHub 式深色介面。impeccable context 缺少引擎及快取權限，直接讀既有 DESIGN.md 與元件；PRODUCT.md 與 design-doctrine 技能不存在，採本專案規則。

- npm run build --prefix apps/web：通過。
- npm run test:workspace：51/51 通過；含新增靜態判讀／唯讀清單與傳輸權限測試。
- npm test：13/13 通過。
- DS_REQUIRE_BROWSER=1 node scripts/verify-script-inventory-ui.mjs：通過。正式建置配真實暫存檔案服務；驗證導覽／深連結、全空／空分類／首次失敗、分類、重新讀取與 loading disabled、錯誤保留、axe 預設／hover／focus、鍵盤 Enter、32px targets／14px 字級、390／1024／1280／1440／1920px 與 100／125% 縮放、長檔名溢位；reduce 模式按鈕無動畫與 transition。非完整 motion gate。
- 實際在記憶體檢視更新後 1440px 畫面並操作分類與重新讀取；未保存截圖。沒有執行產品測試。
- 改動畫面靜態檢查通過：無 emoji、native select、inline style、原始色碼／px、palette bypass 或任意 utilities；沿用 Tailwind token。此頁僅中性篩選與重新讀取，無破壞／提交操作，intent 檢查不涉及 destructive；無 dialog/listbox，Escape／焦點陷阱不適用。
- 設計 critic 依技能分成獨立 A／B 審查，無阻擋項；採用 A 的建議，將含測試內容數置於總檔案數之前。B 指出全空與首次失敗缺口已補驗，超大檔警告只在單元測試驗證。impeccable detect 已實際嘗試但缺引擎／快取權限，未執行其 detector；不宣稱通過。未將不支援本應用 TSX／Tailwind 入口的上游靜態 HTML／JSON gates 當作通過，改用實際頁面的瀏覽器驗證。
- npm run docs:plans:index、npm run docs:check、git diff --check：通過。保留本任務開始前的本機環境遷移修改。
