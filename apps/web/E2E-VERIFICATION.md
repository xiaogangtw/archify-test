# E2E 區塊驗證

日期：2026-10-27。範圍為流程規劃介面，不代表原生 App 或網站的真實 E2E 已通過。

## 實作

- 測試流程側欄新增 E2E 自動化測試，保留原有入口與執行服務。
- 可建立網頁／Android 流程、命名角色、編輯操作與預期結果、增加／移除／排序步驟。
- 雙帳號名片交換範本含跨角色的邀請與接收流程。
- 按專案保存瀏覽器本機草稿。讀取資料毀損時禁止覆蓋，保存失敗保留編輯內容。
- 尚未接入執行器，開始執行停用，無人工實機測試區塊。

## 實際檢查輸出

- apps/web `npm run build`：TypeScript 與 Vite build 成功，99 modules transformed。
- `scripts/verify-e2e-ui.mjs`：PASS template, validation, role protection, step ordering, persistence, project isolation, responsive overflow and keyboard focus。
- Chrome 記憶體截圖已檢視，未保存圖片。
- 編輯畫面 `verify_states`：Checked 111 element-state(s)，default／hover／focus contrast OK。
- `axe_audit`：0 violations。
- `verify_responsive --scale=1.25`：280/320/414px 無水平溢出。
- `verify_keyboard`：37 controls reachable，Enter/Space and arrow keys answer。此 gate 沒有辨識到 composite widgets，不能據此聲稱完整下拉互動覆蓋。
- `verify_target_size`：74 targets @414/1280px，all >=24x24 or exception-covered。
- `verify_mobile_first --scale=1.25`：320px 移除 width media/container 後通過。
- `lint_intent`：OK，但辨識到 0 intent-bearing controls；破壞性移除按鈕另以程式碼檢視確認使用 danger variant。
- `slop_tells --strict`：no measurable slop tells。這是啟發式檢查，不是設計品質評分。
- 新元件 hardcodes、emoji、native select：各檢查 1 個來源檔，均 OK。
- 既有 `.local/api-workbench-ui/theme.json` 的共用色彩投影：11 tokens 解析成功，required light contrast pairs 均通過。這不涵蓋所有既有 Tailwind token，也不代表暗色主題驗證。

執行瀏覽器 gate 時設定 DS_REQUIRE_BROWSER=1，使用既有本機 gate loader 導向內附 Playwright 與已安裝 Chrome。Python gate 使用內附 Python 並設定 PYTHONUTF8=1。無使用 kit accuracy_report 當成應用分數。

## 尚未實作

Appium／瀏覽器 Runner、模擬器生命週期、APK 安裝、帳號秘密管理、跨裝置等待與協調、畫面串流、白話轉腳本、伺服器流程持久化與真實執行紀錄。範本及其預期結果均為草稿，沒有驗證公司的名片 App。
