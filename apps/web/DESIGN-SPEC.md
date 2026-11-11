# Archify Test 網頁設計規格 v0.1

> 歷史設計副本：保留供追溯，不再作為現行設計入口。請依 [AGENTS.md](../../AGENTS.md)、[目前規格](../../ARCHIFY-CURRENT-SPEC.md) 與 [文件總索引](../../docs/README.md)。

日期：2026-10-23（Asia/Taipei）｜階段：設計確認｜技術方向：React + TypeScript

## 1. 範圍與依據

沿用使用者指定的 Windows 本機 Linux VM + Docker Compose、內部 GitLab、公開 Staging BFF、Web、Control API、GitLab Code Scanner、Code-Grounded Journey Builder、BFF Test Runner、PostgreSQL、Job Launcher 與隔離措施。

前一段參考對話可讀內容沒有額外功能細節；更早來源無法取得。因此本文除上述架構外，頁面、角色、版本、審核、保留期限與預檢政策均為可修改的設計提案，並非既有系統事實。

本次不部署、不安裝、不連線公司系統。所有數字、檔案、行號、commit、帳號、執行紀錄與結果均為示範。未建立任何真實連線、憑證或健康探測。此平台主要測試公開 Staging BFF API；不把 API Journey 誤稱為真實瀏覽器點擊 E2E。

## 2. 產品目標與操作主線

讓 QA、開發者與維運人員把程式碼證據轉成可審核、可執行、可追溯的測試流程。

1. 選擇專案與唯讀 GitLab 來源。
2. 以固定 commit 掃描，呈現支援範圍與無法解析的盲點。
3. 由路由、DTO 與呼叫關聯組成 Journey 草稿；每一步有來源證據。
4. 補充參數、資料前置條件、斷言與清理規則。
5. 檢視差異並核准固定版本，加入 Suite。
6. 選擇 Staging BFF、身分與資料版本，通過預檢後執行。
7. 從 Run → Journey → Step → assertion → request/response → 程式碼證據追查。
8. 來源改變後標記受影響 Journey，重新審核；歷史結果保留原快照。

## 3. 架構與 UI 責任

| 元件 | UI 呈現與責任 | 邊界 |
|---|---|---|
| Windows / Linux VM / Compose | 系統狀態、容量、最後 heartbeat | 不提供任意 shell 或 Docker 命令 |
| Web | 互動、表單、結果展示、遮罩內容 | 僅透過 Control API 取得業務資料 |
| Control API | 授權、版本、預檢、工作指令、稽核 | 只暴露給本機/核准內部使用範圍 |
| 內部 GitLab / Scanner | 來源、ref、commit、掃描範圍、解析錯誤 | GitLab 唯讀憑證僅 Scanner 使用 |
| Journey Builder | 證據連結、變數、斷言、推論、人工確認 | 無證據內容不得默認為程式碼事實 |
| BFF Runner | request、assertion、耗時、log、artifact | 僅核准的公開 Staging BFF |
| PostgreSQL | 版本、狀態、結果與稽核的查詢視圖 | 不開放瀏覽器/Runner 直連 |
| Job Launcher | 佇列、工作範本、取消、資源與清理 | 有宿主控制能力；需獨立隔離，不與 Runner 共用權限 |

公開 Staging BFF 是外部測試目標，不代表平台 Control API、資料庫或管理介面要公開。Runner 不取得內部 GitLab 連線、Docker socket、宿主掛載或資料庫憑證。結果可由受限結果通道回報 Control API；詳細協定留待實作設計。

## 4. 資訊架構與共通殼層

- 工作台：Dashboard、專案列表、專案概覽。
- 程式碼與證據：GitLab 來源、掃描列表、掃描詳情、程式碼證據。
- Journey 設計：Journey 列表、Builder、審核、Suites。
- 測試與結果：建立執行、Run 列表、Run 詳情、失敗分析、品質報告。
- 執行管理：環境與 BFF、測試資料與身分、排程、工作佇列。
- 平台管理：系統狀態、隔離與政策、稽核、成員權限、平台設定、存取登入。

正式產品側欄只常駐模組入口，詳情頁由列表與麵包屑進入。設計原型為便於檢查而展開全部 26 頁，並加上「示範角色」與「畫面狀態」審查控制；這些不是正式產品導覽。

專案選擇位於全域殼層；頁面標題包含專案脈絡，環境與 commit 顯示於執行/證據頁。保留全域狀態標示與時區。正式路由支援深連結、返回、分享固定資源；無權資源不可透過 URL 洩漏。切換專案時清除局部篩選；未儲存草稿須提示保存或捨棄。

## 5. 視覺與互動規範

方向：安靜、資料密集的工程工作台。以墨綠作主要動作與選取狀態，搭配中性色表格。錯誤使用文字、狀態標籤及語意色，不只依靠顏色。跟隨系統淺/深色偏好；桌面建議 1440 px，原型適配 1024 px 與窄螢幕。

| 項目 | 規格提案 |
|---|---|
| 字型 | Segoe UI / Microsoft JhengHei / sans-serif；code 使用 Consolas |
| 正文 / 輔助 / 大標 | 14 / 12 / 28 px；觸控輸入至少 16 px |
| 間距 | 4 / 8 / 12 / 16 / 24 / 32 px |
| 圓角 | 控制項 7 px；區塊 9 px |
| Sidebar | 寬螢幕約 214 px；正式手機版改選單抽屜 |
| 列表 | 搜尋、狀態/時間/環境篩選、排序、分頁；原型僅實作目前列表文字搜尋 |
| Detail | 固定識別碼、版本、狀態、主要動作、內容分區與稽核脈絡 |
| Builder | 左側步驟，中間編輯，右側來源證據；窄螢幕分段堆疊 |
| 主要動作 | 同一工作區只保留一個主要動作；破壞性動作使用有影響範圍的確認視窗 |

鍵盤可完成主要流程；原生 button/input/select，有 label 與明顯 focus。非同步成功以 polite live region，失敗以 alert；表格有欄位標頭。空狀態說明第一步，錯誤保留輸入並可重試。手機版表格只在必要時水平捲動，不能裁掉主要操作。Dialog/Drawer 未來需要 focus trap、Esc 與焦點返回。

## 6. 核心資料契約

| 實體 | 必要識別與關聯 |
|---|---|
| Project | id、name、owner、membership scope |
| Source | projectId、repositoryId、ref、credentialRef、scan patterns |
| Scan | sourceId、commitSHA、parserVersion、status、coverage、warnings |
| Evidence | scanId、commitSHA、filePath、line range、snippetHash、解析/推論種類 |
| JourneyVersion | journeyId、version、steps、evidenceIds、variables、review status、reviewer |
| SuiteVersion | suiteId、version、固定 journeyVersionIds、順序與並行依賴 |
| Environment | origin、allowed paths/methods、authRef、policyVersion |
| DataVersion | datasetId、version、owner、TTL、fixture/cleanup references |
| Run | suiteSnapshot、commit/evidence refs、environment/policy snapshot、dataVersion、image digest、actor |
| StepResult | runId、journeyVersionId、stepId、attempt、expected/actual、duration、redacted payload refs |
| Job | type、runId/scanId、status、resource policy、heartbeat、termination/cleanup status |
| Audit | actor、time UTC、action、target/version、correlationId、redacted metadata |

時間儲存 UTC、畫面以 Asia/Taipei 顯示。執行與審核採不可變版本；不可只保存可浮動 branch、latest image 或未版本化的資料集。POST 建立執行需具 idempotency key，防止重複點擊造成多次工作。

## 7. Journey Builder 詳細設計

表單：名稱（1–100 字）、目的、標籤、來源快照、角色假設、前置資料、步驟、變數、斷言與清理策略。每個步驟包含 method、allowlist path、參數/body、secret reference、擷取值 JSONPath、assertions、timeout、failure behavior 與 evidence references。

編輯時將內容分類為「程式碼事實」「流程推論」「待人工確認」；新增人工 assertion 須填理由。不能推論成功狀態碼就宣稱有證據。非 API 的 UI 操作描述可作背景，不轉為虛構的 BFF 呼叫。

驗證：空名稱、重複 step ID、未定義變數、循環/前向引用、證據過期、未解析 endpoint、非法 origin、不可接受 methods、無清理的寫入步驟，都以具體欄位錯誤呈現。移動步驟後重新檢查資料依賴；空陣列擷取失敗時將後續步驟標記 blocked，不誤報為 assertion 失敗。

原型可編輯 assertion、移動步驟、送審與核准；其餘欄位、依賴圖檢查與語意驗證是規格，尚未實作。原型移動步驟只顯示重新確認提示，不宣稱已檢查相依性。

版本狀態：Draft → In review → Approved → Archived；審核退回回到 Draft。修改核准版產生新 Draft，證據 stale 是獨立旗標，可阻止新執行。是否允許舊快照帶例外執行，待確認；本提案預設阻止。

## 8. 執行與結果語意

Run 主線：Queued → Preflight → Starting → Running → Passed / Failed / Infrastructure error / Timed out。取消：Cancel requested → Cancelling → Cancelled；僅終止確認後才能顯示 Cancelled。若完成與取消競爭，以服務端終態為準，保留取消請求紀錄。

Cleanup 是獨立狀態：Not required / Pending / Running / Succeeded / Failed。即使 assertions 全通過，也不可隱藏 cleanup failed。工作沒有 heartbeat、VM 停機或重啟時，狀態先呈現 unknown/reconciling，不能推定仍正常執行或直接標為 passed。

預檢至少檢查：角色、核准版本、來源證據、環境 allowlist、DNS/IP/redirect、資料版本/TTL、secret 有效性、寫入風險與清理方法、配額、VM 容量與 Launcher 可用性。錯誤逐項顯示原因與可前往修復的位置。

失敗分析左右對照 expected / actual，保留 attempt、request ID、耗時、程式碼來源與實際環境。先展示規則判定的失敗類別；根因若未證實，顯示「調查線索」而不是確定答案。重試新建 attempt，rerun 新建 Run 並連結 parentRunId。

報告分母明確：案例通過率 = passed/(passed+failed)，skipped/blocked/infrastructure error 另列。endpoint 覆蓋 = 被 Suite 實際使用且有可追溯測試結果的 endpoints / 該快照已辨識 endpoints；來源未解析的盲點另示，不宣稱是總程式碼覆蓋。時間區間、環境、Suite 版本變化需顯示後才可比較。

## 9. 角色與安全提案

Viewer 看遮罩結果；Author 編輯/審核 Journey；Operator 執行/取消/排程；Admin 管理來源、環境、成員與政策。專案 membership 是額外條件。前端隱藏/停用動作只改善體驗；Control API 必須對每次讀寫重新授權。

敏感資料只顯示 reference，不能透過列表、code snippet、request/response、匯出、log 或 audit 洩漏。遮罩需在保存前處理；顯示端遮罩不能作為唯一措施。上傳/解析的程式碼視為資料，不在 Scanner 執行專案腳本；UI 渲染文字時 escape，禁止任意 HTML。

Runner 提案：non-root、唯讀 rootfs、限額 tmpfs、drop capabilities、no-new-privileges、PID/CPU/RAM/time limits、不可掛 Docker socket。GitLab Scanner 與 Runner 的網路/secret 分離。對外 egress 的 DNS 與 redirect 每一跳都需檢查，防止 arbitrary URL/SSRF；Compose 網路設定本身不保證已落實這些限制。

Job Launcher 接受固定工作規格與允許 image digest，禁止任意 shell、image、mount 或 network 參數。介面只展示政策版本與執行證據；本階段全部為設計、未驗證隔離效果。

## 10. 共通狀態、表單與例外

每個資料頁定義：載入 skeleton、首次空白、篩選無結果、部分資料、可重試錯誤、403、404、證據過期與已刪除資源。錯誤不顯示 stack trace 或 secrets。重試只重讀；重新掃描/重新執行會新建資源，按鈕名稱必須區分。

來源表單驗證 repository/ref/credentialRef；環境表單限制 HTTPS 核准 origin；Suite 表單固定版本與依賴；排程表單顯示時區與下一次觸發；保存按鈕防重複提交。離開未儲存表單提示、失敗保留非敏感輸入、409 衝突提示重新載入版本。

通知中心提案採站內通知：掃描完成/失敗、審核待辦、Run 終態、cleanup failed、secret 即將過期、容量不足。Email/Slack 不在本次範圍。

## 11. React / TypeScript 架構

本次原始碼採 `App.tsx` + 共用 `.tsx` 元件 + `types.ts` + `data/pages.ts` + `state/prototype.ts`。以 reducer 讓純示範互動可獨立檢查。CSS 以 `.at-app` 為作用範圍，支援淺/深色、鍵盤焦點與窄螢幕。

設計確認後，按 feature 拆分 Dashboard、Sources、Scans、Evidence、Journeys、Suites、Runs、Environments、Jobs、Admin。每個 feature 將 page、components、hooks、types 放在同一目錄；共用 UI 放 components/ui，API 與 mapping 放 services，路由與 providers 放 app。

後續建議：React Router 處理深連結；server-state cache 工具統一輪詢/失效；schema 驗證表單與 API 邊界。這些尚未加入相依套件，不預設一定採用某個 library。瀏覽器只連 Control API；不把公司 host、secret 或內網 endpoint 寫入前端 build。

原型不是完整產品：導覽為 state 切換，資料不持久化；多數設定頁是資訊與欄位規格，不提供 CRUD。沒有 auth、API、background jobs、檔案匯出或服務探測。聊天中的預覽檢視器不代表 React build 已成功。

## 12. 設計驗收與後續順序

設計驗收：能從 Dashboard 找到失敗 Run、看到 assertion 差異、回到來源證據；能理解哪些內容是事實/推論/人工確認；能辨認 stale、權限不足、取消中與清理失敗；能知道執行使用的版本、環境與資料。

開發順序：殼層與資料契約 → 唯讀來源/掃描/證據 → Builder/版本審核 → 預檢/Run/結果 → Launcher/政策 → 排程/報告/管理。真正連線前另做 backend contract、隔離落實與整合驗證。

待確認產品決策：

1. 整體視覺方向及繁中為主、保留英文技術名稱。
2. 是否禁止 Journey 作者自審；目前提案允許 Author 審核。
3. 第一版是否只允許 read-only，或同時支援受控寫入與清理。
4. 首批 Scanner 的語言、框架、monorepo 範圍與動態路由限制。
5. 登入方式與專案成員來源；不可假設可連公司 SSO。
6. 結果 90 天、artifacts 30 天、audit 180 天的保留期限提案。
7. 來源 commit 與實際 Staging 部署版本如何比對；若無法驗證，Run 必須明示「部署版本未驗證」。

## 13. 逐頁規格

以下 26 頁與 React 的 `pages.ts` 使用同一份示範內容。表格及數字供畫面審查；實際開發時須由 Control API 提供可追溯資料。

<!-- GENERATED PAGES -->

### 01. 測試總覽

路由：`/dashboard`｜模組：工作台

目的：今天的品質訊號，與下一個需要處理的問題。

主要動作：建立測試執行 → 建立測試執行。

列表欄位：執行 / Suite、結果、版本、時間。

摘要：最近一次完成執行、等待審核 Journey、進行中工作。

**需要關注**

- RUN-1042：收藏流程回傳 403，檢查測試帳號權限。
- JRN-008：依據的 endpoint 已變更，需重新確認。

**來源與執行環境**

- 來源快照：c84f9a2 · release/staging
- Staging BFF：僅允許指定主機與路徑
- 系統最後回報：10:35（示範時間）

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。

### 02. 專案

路由：`/projects`｜模組：工作台

目的：以專案隔離程式碼來源、Journey、環境與結果。

主要動作：檢視示範專案 → 專案概覽。

列表欄位：專案、來源、Journey、最近結果。

**新增專案表單**

- 名稱、代碼（唯一）、說明、負責人
- 選擇已設定的 GitLab 來源與預設 Staging 環境
- 建立後先掃描，再從證據建立 Journey

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。

### 03. 專案概覽

路由：`/projects/:projectId`｜模組：工作台

目的：Archify Web · 所有結果均綁定可追溯版本。

主要動作：查看程式碼掃描 → 程式碼掃描。

摘要：已辨識 BFF endpoints、已核准 Journey、待補證據。

**專案設定摘要**

- 來源：web-bff / release/staging
- 掃描 commit：c84f9a2
- 預設環境：Staging · 僅 BFF
- 負責人：QA Team（示範）

**建議下一步**

- 檢查 4 筆無法靜態解析的來源
- 審核 3 筆 Journey 草稿
- 以 Smoke Suite 執行 read-only 檢查

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。

### 04. GitLab 來源

路由：`/sources`｜模組：程式碼與證據

目的：來源設定只提供給 Scanner；Runner 不取得 GitLab 憑證。

主要動作：前往掃描 → 程式碼掃描。

列表欄位：來源、分支、權限、最後掃描。

**連線設定**

- GitLab instance alias、repository ID、ref、include/exclude patterns
- Credential reference（只顯示別名與有效狀態）
- 測試連線是未來功能；本原型無外部連線

**例外狀態**

- 憑證失效 → 管理員更新憑證參照
- ref 不存在 → 選擇新 ref；舊快照保持可讀
- 不支援語言 → 顯示掃描範圍與限制，不宣稱已完整分析

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。平台管理內容僅 Admin；實際操作需後端授權。

### 05. 程式碼掃描

路由：`/scans`｜模組：程式碼與證據

目的：將指定 commit 轉為可檢索的路由與程式碼證據。

主要動作：查看掃描詳情 → 掃描 SCN-028。

列表欄位：掃描、Commit、狀態、發現。

**新增掃描**

- 選擇來源、ref，解析後顯示 immutable commit SHA
- 確認掃描範圍與檔案上限
- 送入 Job Launcher；顯示排隊、進度、取消與部分失敗

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。

### 06. 掃描 SCN-028

路由：`/scans/:scanId`｜模組：程式碼與證據

目的：web-bff · c84f9a2 · 部分解析完成

主要動作：檢查程式碼證據 → 程式碼證據。

摘要：解析檔案、BFF endpoints、受影響 Journey。

**變更摘要**

- 新增 POST /bff/favorites
- 變更 GET /bff/projects：新增 cursor 參數
- 動態 route factory 無法展開，標記「未解析」

**掃描紀錄**

- 取得 immutable commit → 讀取檔案 → 靜態解析 → 建立索引
- 部分完成不代表所有 endpoints 已涵蓋
- 重新掃描建立新紀錄；不覆寫舊證據

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。

### 07. 程式碼證據

路由：`/evidence`｜模組：程式碼與證據

目的：先看程式碼事實，再決定可執行的測試行為。

主要動作：以此建立 Journey → Journey Builder。

列表欄位：Method / endpoint、程式碼位置、解析結果、風險。

**證據詳情**：GET /bff/projects · commit c84f9a2

- 來源檔、行號、片段雜湊、呼叫關聯
- query：cursor?、limit?；response：items[]、nextCursor?
- 行號與片段均為示範；實作時必須由 Scanner 真實輸出

**事實與推論分開**

- 程式碼事實：路由與 DTO 的可解析欄位
- 推論：使用者應先瀏覽再加入收藏
- 待確認：登入角色、測試資料所有權與清理能力

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。

### 08. Journeys

路由：`/journeys`｜模組：Journey 設計

目的：將程式碼證據轉成經過審核的使用流程。

主要動作：建立 Journey → Journey Builder。

列表欄位：Journey、版本 / commit、狀態、步驟。

**生命週期**

- 草稿 → 待審核 → 已核准 → 已封存
- 程式碼變更導致 evidence stale；需重建或重新審核
- 修改已核准版本會產生新草稿，不改動歷史執行

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。

### 09. Journey Builder

路由：`/journeys/:journeyId/edit`｜模組：Journey 設計

目的：瀏覽專案並收藏 · 草稿 v4 · c84f9a2

主要動作：送出審核 → Journey 審核。

**程式碼依據**

- 來源：SCN-028 · c84f9a2
- 每個 request 與 assertion 顯示來源證據
- 無法由程式碼支持的假設，必須標記人工確認

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。編輯與核准僅 Author/Admin；不可變更歷史核准版本。

### 10. Journey 審核

路由：`/journeys/:journeyId/review`｜模組：Journey 設計

目的：核對步驟、程式碼依據與環境限制。

主要動作：前往建立執行 → 建立測試執行。

**版本差異**

- v3 → v4：加入收藏 request body 新增 projectId
- 程式碼快照固定為 c84f9a2；舊版本仍可查閱

**核准前檢查**

- 所有 endpoints 與 assertions 有證據或明確人工註記
- 寫入流程使用專用資料，且具備清理方法
- 來源快照、參數與秘密參照已確認
- 核准不等於可執行；仍需通過環境預檢

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。編輯與核准僅 Author/Admin；不可變更歷史核准版本。

### 11. Test Suites

路由：`/suites`｜模組：Journey 設計

目的：以核准版本組合 Smoke、回歸與風險測試。

主要動作：執行核心 Suite → 建立測試執行。

列表欄位：Suite、版本、測試數、策略。

**Suite 編輯規則**

- 名稱、說明、固定 Journey version、順序、標籤
- 有資料相依的 Journey 禁止任意並行
- 排除封存、未核准或證據過期版本
- 保留原始失敗；重試使用新 attempt，不洗掉結果

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。

### 12. 建立測試執行

路由：`/runs/new`｜模組：測試與結果

目的：固定測試版本、環境與資料，再進行預檢。

**執行快照**

- Suite：核心使用流程 v3
- Journey snapshot：v3（示範核准版本）
- 來源 commit：c84f9a2
- Runner image digest：固定版本參照
- 超時：10 分鐘 · 並行：1 · 自動重試：0

**預檢**

- ✓ 來源與核准版本已固定
- ✓ 只允許指定 Staging BFF
- ✓ 執行者具備 Operator 權限
- ! 包含寫入步驟，需確認專用測試資料與清理規則

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。執行與取消需 Operator/Admin；不將取消請求誤呈現為已終止。

### 13. 測試執行

路由：`/runs`｜模組：測試與結果

目的：每次執行保留相同的版本、資料與環境脈絡。

主要動作：查看 RUN-1042 → RUN-1042。

列表欄位：Run、Suite、狀態、耗時。

**查詢條件**

- 環境、Suite、執行者、時間範圍、commit、狀態
- 取消、逾時、基礎設施錯誤與 assertion 失敗分開統計

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。

### 14. RUN-1042

路由：`/runs/:runId`｜模組：測試與結果

目的：核心使用流程 v3 · Staging · c84f9a2

主要動作：追查失敗步驟 → 失敗分析。

列表欄位：Journey / 步驟、結果、耗時、證據。

摘要：通過、失敗、執行時間。

**執行軌跡**

- 已排隊 → 預檢通過 → 建立隔離 Job → 執行 → 清理完成
- 展示 request/response、assertion、時間與 request correlation ID
- 重新執行會建立新的 Run ID，並保留 parentRunId

**結果完整性**

- 原始結果不可編輯
- 清理狀態與測試結果獨立顯示
- logs 與 artifacts 已套用遮罩政策

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。

### 15. 失敗分析

路由：`/runs/:runId/steps/:stepId`｜模組：測試與結果

目的：加入收藏 · 預期 201，實際 403 · attempt 1

主要動作：查看來源證據 → 程式碼證據。

**Request / Response**：POST /bff/favorites

- Authorization: [REDACTED]
- Request: { projectId: "demo-project-17" }
- Response: { code: "FORBIDDEN", message: "Role required" }
- 耗時 74ms · correlationId: demo-corr-1042-s3

**Assertion 比較**

- status：expected 201 / actual 403
- projectId：未執行（前置 assertion 失敗）
- 失敗類別：應用層授權；根因尚未確認

**調查線索**

- 證據：favorites.controller.ts:28–51 @ c84f9a2
- 測試帳號 alias：qa-member；無秘密值
- 下一步：核對 Staging 帳號角色；未自動修改權限

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。

### 16. 品質報告

路由：`/reports`｜模組：測試與結果

目的：以相同分母比較測試結果，保留未執行與不穩定案例。

主要動作：查看原始執行 → 測試執行。

列表欄位：指標、本期（示範）、定義。

**匯出與比較**

- 依環境、Suite 版本與時間範圍篩選
- 對比執行需顯示 commit、資料與設定差異
- 未來支援遮罩後 HTML / JSON / JUnit；本原型不產生真實報告

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。

### 17. 環境與 BFF

路由：`/environments`｜模組：執行管理

目的：Runner 只能到核准的公開 Staging BFF。

列表欄位：環境、BFF alias、驗證、策略。

**環境設定**

- 名稱、HTTPS origin、path allowlist、auth profile reference
- 允許 methods、速率與並行上限、timeout、redirect 規則
- DNS 解析與目的 IP 檢查；阻擋私網、loopback、metadata 與非核准 redirect

**防止誤連**

- 環境無 Production 選項；任意 URL 輸入不接受
- 核准後修改 origin 或 allowlist，必須重新預檢
- 公開 BFF 是測試目標；Control API 與 PostgreSQL 不對外公開

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。

### 18. 測試資料與身分

路由：`/data`｜模組：執行管理

目的：使用資料集與秘密參照，不在 Journey 儲存密碼。

列表欄位：資料集 / 身分、用途、狀態、清理。

**資料管理**

- schema、版本、租戶/資料所有者、TTL、變數映射
- 秘密僅顯示 alias、到期日、最後更新者
- 清理失敗列為獨立警示；禁止對共享資料泛用刪除
- 原型所有帳號、資料、主機均為虛構

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。

### 19. 排程

路由：`/schedules`｜模組：執行管理

目的：排程綁定已核准版本與環境；本階段只展示設計。

列表欄位：排程、時間、Suite、狀態。

**設定欄位**

- Suite 固定版本、環境、資料集、時區、下一次觸發時間
- 重疊策略：skip / queue；missed-run 策略明示
- 證據過期、秘密過期或預檢失敗時暫停並顯示原因
- 停用只阻止新觸發；已開始工作另行取消

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。執行與取消需 Operator/Admin；不將取消請求誤呈現為已終止。

### 20. 工作佇列

路由：`/jobs`｜模組：執行管理

目的：Scanner 與 Runner 使用不同工作類型及權限。

列表欄位：工作、類型、狀態、資源。

**工作詳情**

- Run/Scan 關聯、建立者、排隊時間、啟動時間、heartbeat
- CPU/記憶體/程序數限制、timeout、取消與清理狀態
- 取消先顯示「取消中」，收到 Launcher 終止確認後才顯示「已取消」
- Job Launcher 擁有受限工作範本；不接受任意 shell 或 image

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。執行與取消需 Operator/Admin；不將取消請求誤呈現為已終止。

### 21. 系統狀態

路由：`/system`｜模組：平台管理

目的：Windows 本機 → Linux VM → Docker Compose

列表欄位：元件、狀態（示範）、責任。

**架構邊界**

- 內部 GitLab → Scanner（唯讀）→ 證據索引 / PostgreSQL
- Web → Control API → Job Launcher → 臨時 Runner → 公開 Staging BFF
- Runner 不接觸 GitLab、資料庫、Docker socket 或宿主檔案
- Job Launcher 的宿主控制權限獨立隔離；不得透過 Web 直接暴露

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。平台管理內容僅 Admin；實際操作需後端授權。

### 22. 隔離與政策

路由：`/security`｜模組：平台管理

目的：以可檢查的政策呈現允許的測試範圍。

列表欄位：政策、提案設定、檢查位置。

**驗證狀態**

- 全部為設計提案，尚未套用或實測
- Docker Compose 本身不是強安全邊界；須搭配 VM 與 egress 實作
- 政策變更需管理員、版本紀錄與重新預檢

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。平台管理內容僅 Admin；實際操作需後端授權。

### 23. 稽核紀錄

路由：`/audit`｜模組：平台管理

目的：記錄誰在何時，對哪個版本做了什麼。

列表欄位：時間（Asia/Taipei）、操作者、動作、目標。

**稽核詳情**

- event ID、actor、action、target、before/after metadata、correlation ID
- 不記錄 token、密碼與完整敏感 response
- 稽核不可由一般 UI 修改或刪除；保留期限由政策管理

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。平台管理內容僅 Admin；實際操作需後端授權。

### 24. 成員與權限

路由：`/members`｜模組：平台管理

目的：角色權限是本版提案；實際驗證仍由 Control API 強制。

列表欄位：角色、讀取、編輯 / 審核、執行 / 管理。

**授權規則**

- 專案範圍與角色分開；Admin 不自動取得外部系統權限
- 預設允許 Author 審核；是否禁止自審列為待確認決策
- 讀取 source snippets 可進一步限制為專案成員
- 原型的角色切換只用於展示 UI，不是登入系統

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。平台管理內容僅 Admin；實際操作需後端授權。

### 25. 平台設定

路由：`/settings`｜模組：平台管理

目的：保存產品偏好與資料生命週期政策。

**一般設定**

- 顯示語言：繁體中文 / English（規劃）
- 顯示時區：Asia/Taipei；後端時間儲存 UTC
- 預設頁面大小：20；可選 50 / 100

**保留與容量**

- 提案：執行結果 90 天、遮罩 artifacts 30 天、稽核 180 天
- 刪除前顯示影響數量與保留例外；本原型不執行刪除
- 磁碟低於門檻時阻止新 Job，保留查詢與清理能力

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。平台管理內容僅 Admin；實際操作需後端授權。

### 26. 存取與登入

路由：`/login`｜模組：平台管理

目的：未來整合方式待確認；本原型直接使用示範工作階段。

**登入流程**

- 登入入口 → 驗證 → 選擇有權限專案 → Dashboard
- SSO / 本機帳號尚未決定；不預設可使用公司 SSO
- session 到期 → 保存非敏感草稿提示 → 重新登入

**錯誤頁**

- 401：登入逾時；403：無此專案或操作權限
- 404：頁面或資料不存在；不洩漏無權限資源
- 服務不可用：顯示最後更新時間與重試入口

共通驗收：可辨認專案、來源/環境脈絡與主要動作；具載入、空白、錯誤、權限及過期狀態。一般讀取仍需專案 membership。
