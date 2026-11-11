# 分開測試流程與測試報告

## 範圍
導覽分成測試流程與測試報告，各自限定檔案種類及操作提示。補充 LINE OA 知識撰寫邊界說明，不新增手機執行器或聊天 Agent。

## 影響檔案
- WorkspaceApp、ReportReader、ConfiguredReports、相關驗證及操作文件。

## 資料庫影響
無。

## 風險
既有 view=reports 仍可用；錯誤種類須保留原內容，不能呈現於錯誤頁面。

## 設計文件同步
目前規格、前端 README、DESIGN 與網站 AI 文件。

## 領域
前端、文件

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
npm run build --prefix apps/web 通過。DS_REQUIRE_BROWSER=1 的 verify-reader-ui 與 verify-local-workspace-ui 通過，涵蓋兩頁切換、雙向拒絕錯誤種類並保留原報告、流程目錄篩選、檔案匯入、鍵盤、axe、對比、縮放與多尺寸溢位。已實際查看記憶體畫面，未保存截圖。docs:plans:index、docs:check 與 git diff --check 通過。未執行產品 API、LINE 推播、Appium 或真實手機驗證；知識整理不是聊天規劃 Agent。
