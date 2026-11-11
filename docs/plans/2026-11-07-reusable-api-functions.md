# 可重用 API 與流程測試框架

## 範圍
新專案內建 api/、tests/api/、tests/flows/，生成 API 模組與略過的單支測試配對；統一 request、選項及 APIResponse 回傳契約，提供流程範例與 skills。明確遷移既有專案的靜態 operation，保留資料、斷言、ID、備份及 .env。不執行產品登入或釘選。

## 影響檔案
- services/local-workspace 的產生器、初始化、設定與遷移模組及回歸
- test-project 的 support/api-client.mts、目錄、範例、技能、型別及規則
- 外部獨立測試專案及相關規格、決策與操作文件

## 資料庫影響
無。

## 風險
匯入 spec 會註冊測試，流程僅匯入 api 模組。既有動態 operation 不猜測轉換；生成不覆寫已有 API／測試任一檔案。來源移除只封存測試，保留可能被流程引用的 API 模組。新函式呼叫不代表已通過產品驗證。

## 設計文件同步
更新整合規格、本機服務文件、範本與登入文件及獨立專案規則；新增決策取代單檔請求慣例。無平台 UI 變更。

## 領域
測試框架、本機服務

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
已讀目前規格及本機服務文件；現行生成為單檔靜態 operation，既有使用者修改保留。

- 新初始化範本含 api、tests/api、tests/flows、api-client 及型別設定與 skills；test 目錄只交付空目錄標記，不複製產品或舊範例。generate 保留 created 計數契約，另回傳 apiModules；既有任一配對檔保留。
- 外部獨立測試專案已遷移靜態腳本，逐一比對 initializer 原文及周邊程式，只有登入傳輸改為 callApi，其他資料、ID 與斷言保留；遷移前先備份於 legacy/，遷移前後 .env 與 config/http.json hash 相同。
- 外部測試專案與範本 npm run check:types 通過；node scripts/verify-login-case.mjs 對 loopback 驗證三種登入結果與秘密遮蔽通過。未呼叫真實登入或業務流程。
- npm run test:workspace 19 項、npm test 11 項、前端 npm run build --prefix apps/web 通過。新增原生 Playwright 測試確認單支與流程共用同模組、token／variables 傳遞、預設物件不污染、無多餘測試註冊、碰撞／過期遷移拒絕及完整備份。
- DS_REQUIRE_BROWSER=1 node scripts/verify-local-workspace-ui.mjs 通過，含實際生成、保留、封存還原、鍵盤、axe、contrast、target、縮放與 390／1024／1280／1440／1920 overflow；無 TSX 或樣式修改、不存截圖、不做產品請求。
- 依 skill-creator 更新兩份技能與共用契約範例；官方 quick_validate.py 兩份通過。Windows Python 別名不可用、PyYAML C 擴充缺編譯器，改用已安裝 uv Python 及 PyYAML 純 Python 模式通過，未修改產品依賴。
- 同步整合規格 1.39、本機服務 2.12、架構 1.11、登入文件 1.2、決策雙向連結、根規則及獨立專案 README。真實 PinCardFlow 尚未撰寫／執行，範例明示欄位示意並保留 skip；本次完成框架與現有登入重用。
