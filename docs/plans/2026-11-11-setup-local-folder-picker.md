# 初始設定點選本機資料夾直接開啟資料夾選擇器

## 範圍
- 調整首次設定第一步（`SetupWizard.tsx`）：使用者點選「本機資料夾」卡片時，切換為本機模式、展開「前端專案路徑」輸入欄並立即呼叫本機資料夾選擇器（`pick-directory` / `source`）；依使用者回饋移除「選擇前端專案」按鈕與選擇期間的「正在開啟資料夾選擇視窗…」橫幅提示，僅保留路徑欄（支援手貼路徑與點擊「本機資料夾」重開）並以 `pickingRef` 防止雙擊重送。
- 調整首次設定第三步（`SetupWizard.tsx`、`KnowledgeImport.tsx`、`AiJobStatus.tsx`、`Primitives.tsx`）：取消外層重複的「正在整理知識…」橫幅，改以單一頂端浮動橫幅 toast（`fixed inset-x-4 top-4 z-50 mx-auto max-w-xl`，使用較高明度階層 `bg-brand-soft` `#30363d` 與 `border-line-strong` `#6e7681` 搭配 `shadow-popover`，區隔深色背景而不相融）顯示上傳／AI 整理進度並於完成後自動消失；知識庫與功能地圖沿用原本的 `inline` 顯示。
- 修正 Windows 原生選擇器（`directory-picker.mjs`）與併發控制（`workspace.mjs`、`plugin.mjs`）：改用置頂前景透明擁有人搭配現代 `IFileOpenDialog`（`FOS_PICKFOLDERS`，含 `FolderBrowserDialog` 回退），使視窗確實彈出於瀏覽器前方；改以可中止的 `activePicker` 與 HTTP `close` 事件清理舊選擇程序，解決視窗未顯示或頁面重整後長期卡住「另一項檔案操作進行中，請稍後再試。」的問題。
- 更新 `scripts/verify-knowledge-ui.mjs` 與 `services/local-workspace/knowledge.test.mjs`，驗證直接點擊「本機資料夾」觸發選擇器、重開／連線中斷自動釋放舊程序、取消／手貼路徑能力、無「選擇前端專案」按鈕與開啟中橫幅，以及第三步橫幅 toast 單一顯示與完成消失。
- 不包含：變更「Git 下載」流程、第二步操作、知識庫／功能地圖 `inline` 完成提示，或改動檔案寫入互斥鎖政策。

## 影響檔案
- `apps/web/src/features/workspace/SetupWizard.tsx`、`apps/web/src/features/workspace/KnowledgeImport.tsx`、`apps/web/src/features/workspace/AiJobStatus.tsx`、`apps/web/src/components/ui/ds/Primitives.tsx`
- `services/local-workspace/directory-picker.mjs`、`services/local-workspace/workspace.mjs`、`services/local-workspace/plugin.mjs`
- `scripts/verify-knowledge-ui.mjs`、`services/local-workspace/knowledge.test.mjs`
- `ARCHIFY-CURRENT-SPEC.md`、`DESIGN.md`、`apps/web/README.md`、`docs/local-workspace.md`、`docs/architecture.md`

## 資料庫影響
無；純前端設定引導互動調整與瀏覽器驗證／文件同步。

## 風險
- 既有瀏覽器 gate `scripts/verify-knowledge-ui.mjs` 會先選取「本機資料夾」卡片再點擊「選擇前端專案」按鈕；需確認兩次呼叫皆正常寫入 `前端專案路徑`，並補充直接點擊即觸發選擇器與取消不覆寫的驗證。
- 非 Windows 環境或系統視窗取消時，需確保「前端專案路徑」輸入框與「選擇前端專案」重開按鈕仍已展開且可用，不阻斷手動貼上絕對路徑。

## 設計文件同步
- 同步更新 `ARCHIFY-CURRENT-SPEC.md`、`DESIGN.md`、`apps/web/README.md`、`docs/local-workspace.md` 與 `docs/architecture.md`，註明第一步點選本機資料夾直接開啟前景 Windows 資料夾選擇器及重開／中斷中止舊程序機制，未改路由、守衛、導向、API、GraphQL payload 或 DB schema。

## 領域
前端、本機設定引導、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- `npm run build --prefix apps/web`：通過（`tsc -b && vite build`，產生 `dist/assets/index-VkAHG6Am.css` 與 `dist/assets/index-BOh3fI92.js`）。
- `node scripts/verify-reader-dev-css.mjs`：通過（`PASS: root-cwd Vite development CSS resolves sidebar token and reader utilities`）。
- 真實 `pickDirectory`（`services/local-workspace/directory-picker.mjs`）啟動與 `AbortController` 結束測試：通過（`PASS real IFileOpenDialog spawn and abort roundtrip`，確認 `IFileOpenDialog` PowerShell Script 編譯並等待使用者操作，於中止後正常關閉並回傳 `{ path: '', cancelled: true }`）。
- 自訂 Headless Chrome 瀏覽器驗證（`verify-setup.mjs` 針對 `apps/web/dist` 與注入 `pickDirectory`／`aiRunner` 替身）：通過，實測 Step 1 點選「本機資料夾」立即開啟選擇器且無「選擇前端專案」按鈕與開啟中橫幅，並實測 Step 3 上傳知識時僅顯示單一頂端 `fixed` 橫幅 toast（計算背景 `rgb(48, 54, 61)`、邊框 `rgb(110, 118, 129)`、對比度 `>= 4.5`，無「正在整理知識…」第二條橫幅），於 AI 完成後 toast 消失並顯示「已匯入 1 份知識」與啟用「完成設定」，同時通過 390／1024／1280／1440／1920 溢位、200% 縮放、按鈕目標尺寸（>= 32x24）、鍵盤 Tab 焦點外框、無 `<select>`、`prefers-reduced-motion: reduce` 與 `SetupWizard.tsx`／`KnowledgeImport.tsx`／`AiJobStatus.tsx`／`Primitives.tsx` 靜態原始碼檢查。
- `DS_REQUIRE_BROWSER=1 node scripts/verify-knowledge-ui.mjs`：於套用 `elevated` toast 樣式前最近一次執行時 Step 1 至 Step 3 流程操作通過，於第 65 行因本機缺少 `../.local/gate-deps/node_modules/axe-core/axe.min.js` 中止。
- `node --test services/local-workspace/knowledge.test.mjs services/local-workspace/required-setup.test.mjs`：5／6 通過（於 `SetupWizard.tsx`／`AiJobStatus.tsx` UI 調整前最近一次執行）；新增測試 `重開資料夾選擇器或瀏覽器中斷連線時中止舊視窗，不殘留操作鎖定` 通過；第 1 支測試 `三步設定保存路徑、保留環境與舊腳本，知識入口可獨立讀取` 於 Windows 暫存目錄 `rename ... -> README.md` 發生 `EPERM`。
- `npm run docs:plans:index`：通過（`PASS：已更新計畫索引（48 份計畫）`）；`npm run docs:check`：通過（`PASS：文件入口、本機連結、48 份計畫結構與索引一致性`）；`git diff --check`：通過。
- 未驗證範圍：未於本機實際桌面視窗人工點擊選取「選擇資料夾」按鈕完成路徑回填；未儲存預覽截圖進行人工視覺圖片檢視與 `axe-core` WCAG 掃描；瀏覽器端需重啟 `npm run dev` 以載入更新後的 `services/local-workspace/` Node middleware。
