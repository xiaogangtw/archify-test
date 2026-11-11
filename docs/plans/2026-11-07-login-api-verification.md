# 第一步：登入 API 驗證範本與邊界

## 範圍
驗證獨立測試專案登入 API 專用測試流程，保留使用者輸入與 query，檢查請求欄位型別與 HTTP／GraphQL／token／帳號狀態。token 只留在測試記憶體，不寫報告或 Git。其他 API 與串聯流程不在本步實作。

## 影響檔案
- 獨立測試專案之登入 API 測試與 `README.md`
- 外部測試環境 `.env`：只由使用者填實際 BFF 網址，必要範例與說明不含秘密
- `scripts/verify-login-case.mjs`：以 loopback 替身驗證登入契約與遮蔽
- `docs/local-workspace.md`、`ARCHIFY-CURRENT-SPEC.md`：實作與驗證邊界

## 資料庫影響
平台無；真實登入可能建立 session，只有設定測試環境並經使用者授權時執行一次，不自動重試。

## 風險
初始 `BFF_BASE_URL` 空白，須由使用者設定後才執行真實測試。前端若另傳裝置 Header 及認證 Header，需依前端契約處理。回應可能含 token 與個資，斷言／傳輸失敗只產生安全摘要。不得因略過或替身通過宣稱產品登入成功。

## 設計文件同步
同步登入案例操作、來源證據與真實／替身驗證結果；無 UI 變更不需設計樣式更新。

## 領域
測試框架、測試案例

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- 已依登入服務與帳號狀態契約補齊裝置 Header 與參數型別檢查，初次登入移除舊認證 Header，token 僅留測試記憶體。
- `node scripts/verify-login-case.mjs` 通過：真正 Playwright 對 loopback 驗證成功、缺 token 失敗、GraphQL 錯誤失敗；參數型別、裝置 Header、無舊 token 必要與秘密不進報告檢查通過。
- 已記錄獨立測試專案實測一次通過（workers 1、retries 0），token 僅保留在記憶體，未進 Git 或報告。
- 同步目前規格、本機服務與 `README`；未改平台 UI／樣式，設計 gate 不適用，固定帳號與帶 token 後續查詢留待後續流程。
- `docs:plans:index`、`docs:check` 與 `git diff --check` 通過，未把秘密、截圖、真實報告或外部測試資料加入平台版本控制。
