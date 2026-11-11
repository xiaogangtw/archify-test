# E2E 中插入 API 流程

文件版本：1.0

最後更新：2026-11-03

## 修訂紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| 1.0 | 2026-11-03 | 修正儲存檢查拒絕 FC 編碼，接受現行 FC 與歷史 TC；未改路由、守衛、導向、API payload、GraphQL payload 或 DB schema。 |

案例撰寫頁選「帶入／編輯 API 流程」，勾選已儲存流程，再選擇前置、主流程、清理或群組內的插入位置。多選依案例庫清單順序插入；要放在不同位置時分次加入。已插入步驟可重新編輯或移除。

本次修改不更新共用流程。方法、路徑與環境由共用版本決定；本次可調整參數、Body、HTTP 狀態、回應斷言與擷取規則。第一版使用 JSON 編輯，尚無圖形化變數選擇器。

插入流程只更新草稿，仍需按頂部「儲存案例」。儲存契約接受現行 FC 與歷史 TC 編碼，正式編碼由伺服器配置；舊後端若僅接受 TC，重新儲存既有 FC（包括插入 API 後）會回覆 Invalid request，需更新 Control API。本次修正不代表已部署。

## 登入與變數

登入 API 的 responseVariables 例如 `{ "name": "token", "path": "data.accessToken" }`。路徑沿用 API 請求庫點號格式，不加 `$`。擷取支援非空文字、有限數字與布林值，不支援整個物件。

插入登入流程時將 namespace 設為 login，後面 API 步驟便可引用 `{{login_token}}`，authVariable 填 login_token，依環境 tokenHeader/tokenPrefix 帶入授權。同一 API 流程內，後面的請求使用前面擷取的原始變數名稱；輸出名稱符合環境 tokenVariable（預設 authToken）時，後續請求自動依環境設定帶入授權。

每個 API 步驟包含 name、action: apiFlow、scriptId、scriptVersion、namespace；可選 inputs、authVariable、overrides、pollTimeoutMs。overrides 為 `{caseId,request}` 陣列，引用已保存的 API 案例。識別碼與版本必須真實存在。

inputs 可使用固定純量或前面 API 輸出。例如 memberId 填 `{{login_memberId}}`，請求 Query 或斷言便可引用 `{{memberId}}`。手機 readText/set/generate 的變數也可透過 inputs 傳入。API 輸出僅供後續 API 使用，不提供手機輸入。

雙機兩個角色仍各需主流程畫面斷言，API 不接受 actor，也不代替畫面檢查。after 沿用原有清理語意，主流程失敗仍嘗試執行。

## 執行與結果

前端、Control API、Windows Android worker 必須同步更新並重啟。舊 worker 未回報 apiFlows 時，含 API 案例會拒絕執行。Agent 探索操作工具本身不呼叫 API；完整草稿驗證、儲存後案例執行及批次入口均透過同一伺服器 API 橋接。

建立執行時凍結 API 流程版本、案例版本、覆寫設定及 GraphQL schema。環境網址執行中變更會拒絕呼叫；沿用既有 HTTPS 目標範圍、憑證參照與網路限制。GraphQL 需先載入對應環境 schema。

token 與其他 API 輸出只放在本次伺服器執行記憶體，不跨案例共用，不回存環境秘密庫，不傳到手機或報告。憑證使用伺服器認證參照，不能在草稿放原始密碼/token。

API 和手機共用執行時間線，顯示結果、耗時，資料斷言失敗提供 API 案例序號及 HTTP 狀態。連線/授權錯誤提供一般原因；不保存原始回應、輸入、token 或實際資料值。尚無完整回應比對檢視。

第一版循序執行。輪詢只允許整個引用流程皆為 GET/HEAD；寫入及結果不明的呼叫不重送。輪詢設定為重查期限，已送出單次請求仍受既有傳輸逾時限制。斷線/服務重啟無法保證清理完成，須檢查結果再重跑。

## 驗證

前端 build、Control API 型別檢查、Control API/Android 回歸，以及 scripts/verify-e2e-api-ui.mjs 的實際 React 互動檢查。UI 檢查使用模擬 API，不保存截圖。這些不代表 VM 部署或真實後端與雙機整合驗收。
