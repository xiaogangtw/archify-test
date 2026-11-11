# 案例撰寫接入專案 API 證據

## 範圍
一般 Test Case 撰寫的每次 AI 對話，由伺服器讀取目前專案最新可見 API 版本、相關已儲存案例及遮蔽執行摘要、可用環境認證對應。保留修改預覽與人工儲存，不發送 API 或讀取秘密值。不含 Android Agent 操作、API 流程執行器擴充及部署。

## 影響檔案
- services/control-api/src/authoringApiContext.ts
- services/control-api/src/main.ts
- services/control-api/test/authoring-api-context.test.ts
- apps/web/src/features/testing/ScriptWorkspace.tsx
- scripts/verify-authoring-api-context.mjs
- API-REQUEST-LIBRARY.md
- ARCHIFY-CURRENT-SPEC.md
- apps/web/README.md
- apps/web/AUTHORING-VERIFICATION.md

## 資料庫影響
無 migration；只讀現有專案、API 版本、案例、環境設定與執行紀錄。不得讀取 api_environment_secrets 或秘密檔案。

## 風險
跨專案資料隔離、秘密遮蔽、上下文容量、歷史回應不可當作本次測試成功；既有 API 案例設定不等於 Runner 支援伺服器秘密參照。

## 設計文件同步
同步目前規格、API 文件、前端 README 的資料來源、限制及 /api/llm 請求欄位。沒有可見 UI 重設計。

## 領域
API、前端

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
- npm run check --workspace services/control-api：通過。
- npm test：最終 235/235 通過，無 skipped；本機測試連線需放行。
- npm run build --prefix apps/web：通過，保留既有大型 chunk 提醒。
- node scripts/verify-authoring-api-context.mjs：實際 Chrome 通過，兩專案 ID、修改預覽／套用／儲存分離、無 API 執行與 page errors。NODE_PATH 使用既有 runtime Playwright，CHROME_PATH 使用本機 Chrome，DS_REQUIRE_BROWSER=1。
- node scripts/verify-api-chat-ui.mjs：原有「模型連線」導覽位置斷言 y=396、預期 400 失敗，尚未進入案例撰寫；未移除斷言或宣稱全介面回歸通過，因此保留可供審查未勾選。
- 無可見 UI／樣式變更，未重跑版面 gates；額外以 Chrome 工具開啟本機 fixture 作人工視覺檢視時，file URL 被政策拒絕，未繞過或保存截圖。
- npm run docs:plans:index、npm run docs:check 與 git diff --check 通過。
- 未部署 VM、未呼叫真實模型或執行登入／刪除 API；隔離測試不代表真實業務驗收。

2026-11-03 接續：API 草稿只有 request.post 而無 test.step，既有預覽顯示 0。保留既有顯式步驟解析，不猜測任意 API 呼叫；補充前後端撰寫指示要求具名 await test.step 與回傳 token 維持範圍，並在目前 Chrome 案例保留原請求／斷言，補上兩個步驟並保存，不執行 API。

2026-11-03 驗證：Control API 型別檢查、npm test 235/235（無 skipped）、前端建置通過，Vite 保留既有大型 chunk 提醒。實際 Chrome 將目前 TC-000001 登入／刪除草稿包入兩個具名 test.step，保留原 GraphQL 文件、參數與斷言，token 由登入步驟回傳；儲存 v3 後畫面顯示兩步及已儲存。已實際檢視畫面，未保存截圖、未執行 API。前端提示已在本機程式更新；後端提示尚未部署 VM，真實模型後續產出仍未驗證。原完整介面回歸阻礙仍保留，故整體可供審查未勾選。文件索引、文件檢查及 git diff --check 通過。

2026-11-03 405 修正接續：查證 Runner 固定 ARCHIFY_BASE_URL=http://127.0.0.1:8080，內建站只接受 GET，launcher 使用 network none。外部 GraphQL 必須走既有 API 流程執行器，不能只換端點。補正模型可信指示與現況文件；目前 Chrome 操作被 Work 設定停用，尚未轉換使用者案例或執行 API，保留未完成。

405 修正驗證：Control API 型別檢查、authoring-api-context 7/7、文件索引及文件檢查通過。僅修正指示及文件，未改 Runner 隔離；未部署 VM、未轉換既有案例，待恢復瀏覽器操作。

2026-11-03 轉換接續：正式 assistant 工作 f1db01c4-a4bd-4cf7-aaa8-f8738eb386c6 建立失敗，未產生流程且 allowExecution=false。新增人工固定案例版本轉換端點，保存現有 script 的新版本，案例來源逐筆核對專案／版本及白名單；AI 計畫維持禁止刪除，人工固定 API 流程使用已保存精確 request。部署前不能轉換正式案例。

轉換入口驗證：Control API 型別檢查與 npm test 236/236 通過，無 skipped；新測試確認人工保存刪除固定版本不送請求、版本遞增／編號保留、拒絕其他專案與過期版本、Agent 計畫仍拒絕刪除。新增 services/control-api/src/apiWorkflow.ts、對應 api-workflow.test.ts 與決策文件。SSH BatchMode 仍回 Permission denied (publickey,password)，因此正式案例尚未轉換；需使用者執行更新及轉換流程，整體可供審查維持未勾選。未執行登入／刪除請求。

2026-11-03 Windows PowerShell 相容性修正：使用者回報 UTF-8 無 BOM 中文腳本在 powershell.exe 解析失敗；轉換工具改為 ASCII 訊息，先使用 Windows PowerShell Parser 驗證，再執行只保存轉換。

轉換腳本改用 ASCII 訊息後 Windows PowerShell Parser 通過。實際執行被 Agent 不可改寫來源 GraphQL 操作拒絕，未保存或發送。修正人工固定版本 query／operationName 不必匹配最新版定義；仍由伺服器讀取案例版本並驗證專案、方法、端點，worker 精確 request 核對不變。需再次部署後才能轉換。

2026-11-03 轉換完成：使用者更新後 PowerShell GET bootstrap 連線意外關閉；隨後唯讀探查已恢復且原案例仍 v5，實際執行轉換工具成功保存同 ID 的 TC-000001 v6。再讀 bootstrap 確認目標環境（dev-bff）與 catalog revision，依序固定登入與刪除案例版本。未發送業務 API。工具補上唯讀 GET 最多五次重試，每次間隔兩秒，POST 不自動重送。重複執行顯示 already an API flow 並跳過；未產生重複版本。尚未執行真實登入／刪除驗收。
