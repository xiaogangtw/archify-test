# 單點 API 紀錄集中入口

## 範圍
移除單點 API 測試內的執行紀錄分頁與其列表載入／刪除操作；沿用側欄執行紀錄的 API 請求列表、詳細回應及刪除。當次回應與案例保存回應保留。

## 影響檔案
- apps/web/src/features/testing/ApiWorkbench.tsx
- apps/web/README.md
- API-REQUEST-LIBRARY.md
- ARCHIFY-CURRENT-SPEC.md

## 資料庫影響
無；不刪除資料或修改服務契約。

## 風險
AI 傳入舊 history 分頁動作時拒絕，避免進入已移除的空白分頁。

## 設計文件同步
同步前端與 API 文件、目前規格的入口與行為。

## 領域
前端

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- `npm.cmd run build --prefix apps/web` 通過，保留既有大型 chunk 提醒。
- `.local/api-history-check/verify.mjs` 使用既有完整 App fixture 與 Chrome 操作接口／版本差異，確認無歷史 tab、不再讀取重複歷史、回應面板仍在，無 page errors。
- 已在記憶體實際檢視完整 App 畫面，未保存截圖。本次刪除重複 tab 與不可達 modal，未新增樣式、token、文案控制項或互動元件；未重跑全套視覺 gates，不宣稱完整無障礙與響應式驗收。
- `node scripts/verify-execution-ui.mjs` 初次本機 HTTP 連線被環境拒絕，允許本機瀏覽器連線後重跑通過：API 請求類型／狀態篩選及回應詳細、紀錄刪除／取消／失敗重試／輪詢持續性，及既有報告與 PDF 回歸。
- `npm.cmd run docs:plans:index`、`npm.cmd run docs:check` 與 `git diff --check` 通過；未部署 VM。
