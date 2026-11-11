# 新案例空白對話

## 範圍
修正直接點案例撰寫時帶入同專案舊對話；一般案例依案例識別碼隔離聊天，不刪除既有專案聊天資料。

## 影響檔案
- apps/web/src/features/testing/ScriptWorkspace.tsx
- scripts/verify-authoring-api-context.mjs
- apps/web/README.md
- ARCHIFY-CURRENT-SPEC.md

## 資料庫影響
無；只調整瀏覽器聊天儲存鍵，既有專案聊天不搬移。

## 風險
舊版混用的專案聊天不自動歸屬某一案例；既有 draft.messages 仍依原行為匯入。

## 設計文件同步
同步目前規格與前端 README 的聊天隔離與相容性限制；無樣式或版面變更。

## 領域
前端

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- `npm.cmd run build --prefix apps/web` 通過；保留既有大型 chunk 提醒。
- `node scripts/verify-authoring-api-context.mjs` 搭配 bundled Playwright 與 Chrome 通過：兩專案 payload、建議／套用／儲存邊界、新案例空白、既有案例歷史恢復，無 page errors。
- 以瀏覽器實際操作訊息、套用、儲存並在記憶體查看空白聊天畫面，未儲存截圖。隔離 fixture 不作完整 App 版面驗收；本次不改 TSX 結構、樣式、token 或控制項，未重跑全套視覺 gates。
- `npm.cmd run docs:plans:index`、`npm.cmd run docs:check` 與 `git diff --check` 通過。
- 沒有部署或真實模型驗證。
