# 執行紀錄與品質報告驗證（2026-10-27）

## 行為

- Control API 完整測試：114 tests、114 pass、0 fail、0 skipped。新增 5 組涵蓋單筆／版本刪除、活動執行阻擋、版本 row lock、刪除不修改案例與來源、報告分組與詳情、未完成報告拒絕，以及 API draft 不當成通過。
- Control API TypeScript 檢查與 apps/web TypeScript/Vite 建置成功。
- verify-execution-ui.mjs：確認取消、失敗保留與重試、單筆刪除後重載仍消失、整版刪除、執行中禁止刪除、每批次一份報告、摘要、未完成禁止下載、報告失敗重試、產生 PDF bytes／檔名及 320/390/1280px 無水平溢出。回歸使用隔離假資料，沒有刪除使用者紀錄或執行真實 API。
- verify-api-chat-ui.mjs 完整 App 回歸通過，包含移除側欄預覽文字；原 API 聊天、前端掃描、案例撰寫、分類、批次、Agent 與模型連線功能仍通過。

## PDF

下載按鈕建立的真實 Blob 以隔離瀏覽器環境下的攔截方式取得 bytes。原生 Chrome 下載曾回報 canceled，本機 HTTP 導覽受 ERR_NETWORK_ACCESS_DENIED 限制；未降低瀏覽器安全設定。驗證涵蓋產生的檔案及下載檔名，不把它當成原生下載成功。產品仍使用標準 Blob URL 與 download 連結。

正常報告 3 頁、長內容測試 5 頁均經 pypdf strict parser 重開與 PDFium 逐頁渲染成功。先前更長壓力內容亦產生可解析／渲染的 19 頁報告。正常報告與長報告 contact sheet 已在記憶體檢視，包含中文字、結果環形圖、失敗明細、來源 hash 換行、邊界與頁碼；未保存預覽截圖。PDF 目前是高解析點陣頁面，內文不可搜尋／選取。

## 介面 gates

runs-gate / reports-gate 為真實 React 元件與目前建置的 Tailwind。DS_REQUIRE_BROWSER=1、實際 Chrome、未修改 kit 斷言；兩份各 10 項 gates 全部退出 0：states、axe、responsive、keyboard、target size、mobile first、intent、strict slop、overflow、reduced motion。states 分別量測 41／18 element-states，axe 均 0 violations，target size 分別 26／12 targets。最終版本刪除重複版本標籤後另量測 overflow 320/414/1280px 通過。

75/75 來源檔無硬編碼，75 檔無 emoji，46/46 無原生 select；11 個實際 Tailwind 色彩 token JSON 有效，必需亮色對比通過，裝飾邊框 1.23:1 為 advisory。lint_intent 退出 0 但辨識 0 個中文意圖，不擴張其結論。桌面報告與手機報告／執行紀錄已在記憶體檢視。

未部署或操作真實資料。部署需前端與 Control API 同步更新，正常遷移 runs / api_workflow_jobs 的 deleted_at 欄位。刪除為隱藏紀錄，保留來源、案例版本、事件與冪等 request id。

## 批次限定與報告命名更新（2026-10-27）

服務完整測試 115 tests、115 pass、0 fail、0 skipped；新增單筆不產報告、明確 batch_id 即使一個案例仍有報告、單筆 API workflow 報告 404、報告改名保留 testVersion / created_at。前端建置及服務 TypeScript 檢查成功。

更新 verify-execution-ui：批次預設不攤開個別案例；單筆不在報告列表；批次名稱進入畫面與 PDF 下載檔名；預設批次測試名稱、未完成下載禁用、報告改名、刪除與重試、手機無溢出均通過。完整 App 回歸通過。正常與長報告分別 3／5 頁，pypdf strict 與 PDFium 逐頁渲染成功；PDF 封面名稱與固定版本已在記憶體檢視。原生下載限制仍同上，不宣稱真實 Chrome 下載已通過。

最終 gates 使用特別含 batchId 的 fixture，避免誤測成空報告頁。桌面1280與手機390的批次單列／單筆紀錄已在記憶體檢視；不保存預覽截圖。來源 75/75 無硬編碼、75 檔無 emoji、46/46 無原生 select；11 tokens JSON與必需亮色對比通過，裝飾線 1.23:1 advisory。部署需新增 batches.name 欄位並同步前端／Control API，未部署或修改真實資料。

最終批次 fixture 各 10 項 gates 全部退出 0。states 為 runs 35、reports 15 element-states，axe 各 0 violations；responsive、keyboard、targets、mobile-first、intent、strict slop、overflow、reduced-motion 通過。git diff --check 退出 0。

單筆刪除入口去重：同版本只有一筆紀錄時隱藏整版刪除，保留該筆垃圾桶。單筆確認改為『刪除這筆執行紀錄？測試案例仍會保留。』；報告與多筆版本使用各自確認文字。前端建置與隔離互動回歸通過，確認單筆只有一個入口、執行中禁止刪除、刪除失敗保留、重試與取消皆正常。axe 0 violations。
