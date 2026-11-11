# 決策：原生 Playwright 單檔案例

日期：2026-11-07
狀態：已接受

## 背景
使用者認為逐接口 requests／fixtures／case 三檔不容易理解，確認先試行請求、資料與斷言同檔。原有本機服務與平台外測試專案邊界仍適用，見[本機服務決策](2026-11-07-local-workspace-service.md)。

## 決策
生成原生 @playwright/test .spec.ts，使用 test、request、expect 與 test.step，保留 BFF_BASE_URL、config/http.json 共用設定。使用者平常只需修改一支測試檔。報告以 Playwright reporter adapter 轉入現有 JSON 閱讀器，沒有另建測試 DSL。

舊三檔稿先 AST 檢查，再將有效資料與斷言轉入新檔，完整原件與文件存 legacy；自訂邏輯與秘密常數不自動轉換。框架鎖版 1.64.1，產物保留與安全摘要有回歸；內部 snapshot 旗標僅用於停用自動頁面快照，不宣稱可停用所有原生錯誤檔案，原始產物另由 preserveOutput:never 清除。

## 影響
獨立專案需 npm ci 安裝 Playwright Test，API 測試不需要下載瀏覽器。標準 skip 保留原生 exit 0，但報告與畫面不將略過計為通過；尚未驗證實際產品。Web／手機瀏覽器、圖文 results.json 與任意自訂 TS 流程預覽仍有獨立限制。

## 部分取代

[請求模組與測試分離](2026-11-07-reusable-api-functions.md) 取代請求與測試必須同檔的部分；原生 runner、報告及非覆寫方向保留。
