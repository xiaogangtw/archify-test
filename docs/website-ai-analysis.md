# 網站 AI 分析與知識更新

文件版本：1.8

最後更新：2026-11-11

## 修訂紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| 1.8 | 2026-11-11 | 功能分析／知識合併／候選檢索與圖片觀察改以結構化 JSON Schema 直接約束輸出（兼做圍欄容錯解析），支援切換 `codex`／`claude`／`gemini` CLI 與模型下拉／自訂選擇（圖片辨識僅支援 Codex），新增 `ai-inspect`、`ai-test`、`ai-settings` 本機契約並改採頂端置中 3 秒自動退場浮動 Toast 顯示分析中／完成／錯誤（不設關閉按鈕）；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.7 | 2026-11-09 | 文件先在本機略過重複來源，唯一高度相似文字以上傳版直接更新並可還原；AI 工作結果增加 skipped／directUpdated。未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.6 | 2026-11-09 | 功能分析加入增量、無變更略過模型及完整回退。本機 AI 工作結果增加分析模式與頁數；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.5 | 2026-11-08 | 新增每來源 10 MB、圖片附件、分段／候選檢索、原始資產與來源查看契約；新增 knowledge-source，未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.4 | 2026-11-08 | 同步流程頁唯讀及專案內 AI 規劃方式，移除日常網站確認；新增 case-plans 唯讀契約，未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.3 | 2026-11-08 | 同步案例規劃表及兩個本機 skill 工作方式；沿用 view=flows，新增 case-confirm 契約，未改產品 API、GraphQL payload、守衛、導向或 DB schema。 |
| 1.2 | 2026-11-08 | 導覽分開測試流程（view=flows）與測試報告（view=reports），各自篩選檔案並拒絕錯誤種類；補充 LINE OA 知識邊界。未改守衛、產品 API、GraphQL payload 或 DB schema。 |
| 1.1 | 2026-11-08 | 新增知識簡化為選檔即自動 AI 分類、去重與更新，移除手動分類、功能編號、文字輸入及 AI 開關；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.0 | 2026-11-08 | 網站啟動本機 Codex 做功能與知識分析，新增背景工作／取消、HTML 文字抽取及知識去重取代／還原契約；未改產品 API、GraphQL payload、頁面路由、守衛或 DB schema。 |

## 日常操作

功能地圖頁按「AI 分析功能」即可由網站準備來源證據、呼叫本機 Codex、驗證結果並更新地圖。保留原本功能 ID、名稱與案例；無法判斷的規則保留問題，未分配頁面與 API 明示。原手動準備／複製任務／載入結果收在「手動分析工具」，不再是主要操作流程。無額外模型 key 輸入框。

功能圖首次完整分析；之後來源與知識未變更就略過模型，有變更依頁面依賴與功能歸屬分析，再由平台合併完整圖。路由、來源解析設定、知識或不確定影響範圍則完整分析。保留來源讀檔與 hash 檢查。舊專案需先完整建立一次基準；細節見 [增量分析與快取](frontend-feature-overview.md)。

專案知識匯入支援 UTF-8 .md、.html／.htm、.txt 與 PNG／JPEG／WebP 圖片。每份來源最多 10 MB（10 × 1024 × 1024 bytes），每批最多 20 份、合計 20 MB；仍然選檔即處理，不新增分類或用途表單。選檔後先在本機比對完全重複與高度相似內容，不需填寫分類或功能編號；只有剩餘來源交 AI 自動分類及整理。處理時顯示進度，失敗可重試。AI 比對剩餘新文件及未由本批直接更新的有效知識：同主題新版本更新、重複資訊合併、不相關舊資訊保留；無法判斷範圍／時效的衝突保留文字與問題，不自行挑選為業務事實。網站不再提供手動分類、貼文編輯或 AI 開關；原直接匯入契約保留相容。

完全相同文字（逐字相同）直接略過，亦可用已處理原始來源 SHA-256 略過重複上傳；後者須對應的全部有效知識 ID／內容 hash 仍相符。紀錄存於 knowledge/index.json 的 uploadReceipts，最多保留 500 筆；舊專案沒有紀錄時，原始檔與 AI 整理文字不同仍須分析一次才能建立。內容編修、刪除或被新版本取代使相關紀錄失效，不以 sources 中歷史 hash 判定重複。重傳舊版本若不同於現行內容，仍依本次上傳為最新處理。全部略過時不改 index、catalog、備份或知識 revision；同批相同 bytes 僅處理一次。

依使用者本次授權，文字大致相同且能唯一對應舊文件時，直接將抽取後完整上傳文字取代舊有效知識，不經 AI 重新改寫或判斷衝突；「最新」指本次上傳，不推測檔名或正文日期。比對採 NFC 與空白正規化後的 5 字元連續片段多重集合 Dice 係數：至少 80 字元、長度比至少 85%、相似度至少 92%，且最佳候選領先次佳至少 5 個百分點；正規化後全文相同也可匹配。短文非全文相同、相似候選無法區分、同批多份競爭同一文件均交 AI，不以同檔名直接覆蓋。

直接更新只適用抽取文字不超過 128 KB 的 MD／TXT／HTML，沿用舊 ID、分類及功能編號，保留最新原始來源、舊來源與封存，可用既有「還原上次 AI 更新」。不直接取代含圖片證據的知識；新圖片與首次大型來源仍走原辨識／分段流程。文字相似度不代表業務語意相同：依授權，少量但關鍵的規則改動也採上傳版，不自行沿用舊規則。直接比對與 AI 剩餘結果全部成功後才一起套用，AI 失敗／取消不提前寫入直接更新。混合批次中直接更新的文件不再交 AI 取代；其他候選仍可能需要人工確認語意關聯。

AI 工作結果新增 skipped（略過來源名稱）與 directUpdated（直接更新份數），updated／replaced 仍計全部實際更新／取代。相似更新與 AI 更新共用版本檢查、來源保存及封存機制；介面現有「已整理」總數包含直接更新。詳見 [決策紀錄](decisions/2026-11-09-knowledge-fast-update.md)。

知識更新會盡量沿用同主題 ID，合併多個舊 ID 時更新 test-cases/catalog.json 的 knowledgeIds；原 knowledgeHash 不自動更新為已核對，新知識仍會提示案例需要複查。原檔不永久刪除：knowledge/archive/ai-時間-UUID 保存舊 index、取代內容、新資料及 AI 結果。最新畫面顯示衝突及「還原上次 AI 更新」；確認後還原舊文件與案例引用，若更新後又有人修改內容、metadata、清單或案例則拒絕覆寫，改由封存檔人工核對。取消或 AI／格式／版本驗證失敗不套用；磁碟中斷涉及多檔時仍須依備份恢復，並非 DB transaction。

測試流程現為唯讀案例表格，規劃、問題與腳本實作都在測試專案由本機 AI 處理，不要求網站確認；詳見 [案例與關聯](test-traceability.md)。

## 補充 LINE OA 知識

現有 AI 是文件整理工作，不是會主動訪談或自動驗證業務的聊天 Agent。可先把補充內容寫成 MD／HTML／TXT，或附 PNG／JPEG／WebP 圖片上傳，由 AI 自動分類、去重及更新。Rich Menu 建議記錄入口名稱、區塊位置（必要時加相對座標）、點擊動作及值、適用帳號／角色、對應 Flex Message、預期文字、字級／色彩／排列、樣式基準版本與待確認事項。不要把真實帳號憑證放進文件。

測試範圍須明示：後端推播／受眾／排程與 Flex Message 畫面呈現是不同責任。若只驗文字樣式，仍需指定如何取得待驗訊息，以及驗證的是網頁預覽還是 LINE App 實際畫面；預覽通過不等於 App 呈現通過。Playwright 網頁腳本與 Appium App 腳本可規劃共用案例與樣式基準，但目前平台未新增兩者的自動協作執行、手機樣式辨識或真實推播操作。缺少入口、訊息或樣式證據時記為待確認，不由前端分析推測後端邏輯。

## CLI 與資料邊界

本機需安裝並登入選用的 AI CLI（支援 `codex`、`claude`、`gemini`，預設 `codex`）。Windows npm 安裝預設找 `APPDATA/npm/node_modules/@openai/codex/bin/codex.js`、`@anthropic-ai/claude-code/cli.js` 或 `@google/gemini-cli/dist/index.js`，以 node 與獨立 args 呼叫；其他系統與原生 binary 依 `PATH` 尋找。可在工作區設定第 1 步（或測試專案 `.env`／平台 `.local/ai.json`）指定 `ARCHIFY_AI_PROVIDER`（`codex`／`claude`／`gemini`）、可選的 `ARCHIFY_AI_CLI`（完整執行檔／entry 路徑）與 `ARCHIFY_AI_MODEL`（模型名稱；第 1 步 `Dropdown` 會讀取 `$CODEX_HOME/models_cache.json` 等本機快取模型清單，亦支援自訂輸入），優先順序為程序環境變數 > 測試專案 `.env` > 平台 `.env` > `.local/ai.json`。空白模型使用工具預設；為限制工具與外部整合，Codex 不載入使用者 `config.toml`，Claude Code 停用工具與嚴格空 MCP 設定，Gemini CLI 以 `deny.toml` 與本機停用工具設定隔離（偵測系統 Gemini `.toml` 政策則拒絕執行）。圖片知識辨識僅支援 Codex CLI；選用 Claude／Gemini 時上傳圖片會明示拒絕。登入仍使用使用者本機憑證，錯誤回報不輸出原始 stderr 或模型回應。

呼叫均採非 shell（`shell:false`）、Windows 隱藏視窗、工作目錄為自建暫存目錄且結束清除；Codex 另以 `read-only` sandbox、停用 `shell_tool`／`unified_exec`／`apps`／`browser_use`／`computer_use`／`multi_agent`／`skill_search`／`web_search` 與 `--output-schema` 執行。這是減少工具權限的呼叫設定，不宣稱替代完整 OS 資料隔離或能控制模型服務的資料保留政策。CLI 版本需支援這些選項；Claude Code 與 Gemini CLI 通道目前僅以子程序模擬測試驗證，尚未執行真實本機 CLI 端對端驗收。

本機 CLI 不代表本機離線模型：來源與知識會交給 Codex 使用的模型服務，可能有帳號用量／費用。網站在分析入口明示此行為；此次使用者已要求串接，因此不加重複審批。

功能分析送出可解析路由、頁面、靜態可達 API、先前功能、來源 hash／revision、知識及受限原始碼片段，不送 .env、產品 token 或測試資料。每個來源片段最多 8000 字元、總片段 220000 字元；截斷明示，總 payload 最多 850000 bytes，超限拒絕而非假裝完整。來源片段與文件可能含使用者自行放入的秘密，規則不能保證辨識任意非標準字串；文件內容僅作參考，不執行其中指令。

來源大小與有效知識大小分開：每份原始來源 10 MB、每批 20 MB；整理後的 Markdown／TXT 每份仍為 128 KB，最多 500 份，索引 2 MB。一般小文字仍一次比對，單次知識 JSON payload 最多 750000 bytes；大型文件依換行及 UTF-8 邊界拆為最多 96 KB 的段落，逐段處理並顯示進度。現有知識超出單次大小時，先用含標題、分類及前 200 字節錄的索引檢索最多 8 份相關候選，再將選中全文以最多 400000 bytes 的批次比對；未選中內容不刪除。候選超量、單次結果過大或合併後超過知識容量會明示失敗，不靜默漏段。候選檢索與模型語意整理仍可能漏掉重複或細節，原檔是完整證據，不能宣稱模型已完整理解。HTML 用 parse5 純 parser，不渲染、不讀 URL、不執行 script；忽略 script、style、template、noscript、iframe、object、embed、svg、canvas，保留一般文字、標題、表格換行與 HTML entities，保存為 Markdown／文字。不能還原只靠 JavaScript 執行後才出現的內容。

## 工作狀態與儲存

ai-jobs.mjs 每個本機 workspace 同時一份 AI 工作，保留最近 20 份狀態，瀏覽器每 1.5 秒讀取。狀態為 running／completed／failed／cancelled；只顯示安全階段與摘要，不展示模型原始文字或 stderr。工作區介面改採頂端置中浮動 Toast 顯示分析中（可取消），完成與失敗／錯誤 Toast 均不設關閉按鈕並於 3 秒後自動退場（重載頁面僅接續仍在執行中的任務而不重現舊失敗）。服務重啟則需重做，不做持久排程。AI 執行中拒絕切換專案或修改 CLI 設定；其他資料若在分析期間改動，套用會核對 revision/hash 並拒絕過期結果。

允許分析階段取消，超過 10 分鐘或 stdout 超過 4 MB 會終止；Windows 使用本次子程序 PID 的 taskkill /T，其他系統 kill 本次子程序。儲存開始後拒絕取消，避免顯示已取消卻其實完成套用。AI 原始結果只在自建暫存檔讀取並解析，功能合法提案與知識更新結果按既有備份契約保留於獨立專案，不寫入平台 Git。

圖片先以模型辨識可見文字、相對位置、排列及顏色；不推測點擊 URL、postback、後端規則或精確 CSS。辨識結果保留待確認問題；平台強制標記圖片用途未指定，不直接當作預期或通過證據。上傳檢查實際圖片格式與副檔名一致，單邊最多 12000 像素、總共 4000 萬像素；不接受 SVG／GIF／PDF，也不分析動畫或圖外內容。

功能分析、知識合併、候選檢索與圖片觀察皆傳遞嚴格 JSON Schema 給 `--output-schema`（向下相容未帶 schema 的 `{ resultJson }` 包裝），並支援剝除意外 Markdown 程式碼圍欄及空輸出安全診斷，最後仍由 feature-map validator 或 knowledge applyAi 嚴格檢查。知識每份輸出必須交代 inputIndices、有效 replaces、可選 keepId、分類與功能編號；所有新文件都要被交代，舊 ID 不可被多份結果重複取代。平台自己備份、改寫文件與索引，模型沒有直接刪改框架的授權。

## 原始來源與可攜性

原始文件及圖片按 SHA-256 保存為 knowledge/sources/指紋.副檔名，同內容重用，不覆寫指紋不符的既有檔案。有效知識索引 sources 保存 name、path、sha256、bytes、mediaType、kind 及圖片尺寸，平台維護的 knowledge/README 提供原始來源連結。本次封存 sources.json 保存原始名稱與來源紀錄；知識去重、封存及還原都不刪除原檔。來源只在有效知識引用且 hash 相符時由網站讀取；不接受任意檔案路徑。

知識詳情可查看原圖或下載原始文字／HTML；HTML 以附件下載，不在頁面渲染，不讀外部 URL。圖片預覽採本次 Blob URL，切換或離開釋放。取消／模型失敗不套用知識；若儲存階段磁碟中斷，可能留下尚未被索引引用的原始資產，需依封存核對，並非交易保證。這些檔案留在獨立測試專案，可與 knowledge、案例及 skills 一起版控。

多段來源會造成多次模型呼叫，時間及用量依內容而變；每次 CLI 仍限 10 分鐘，可在分析中取消。功能地圖的來源／知識輸入上限仍是其獨立限制，不因原檔可上傳 10 MB 而取消。

## 本機契約

沿用 loopback、同來源、session、POST JSON；start 不接受任意命令、prompt、可執行路徑或自由輸出路徑。

| 端點 | 行為 |
| --- | --- |
| POST /local-api/ai-inspect | 可選 aiCli；檢查 Codex CLI 安裝路徑、版本與 `codex login status` |
| POST /local-api/ai-test | 可選 aiCli、aiModel；以最小結構化 JSON 測試 CLI 連線與模型可用性 |
| POST /local-api/ai-settings | aiCli、aiModel；驗證後保存至 `.local/ai.json` 並同步至已綁定測試專案 `.env` |
| POST /local-api/ai-features-start | 無輸入，回傳工作 ID；背景準備證據、AI 整理並驗證套用 |
| POST /local-api/ai-knowledge-start | documents（name、base64），原有 UTF-8 content 仍相容；預檢後回傳工作 ID |
| POST /local-api/knowledge-source | id、sha256；限有效知識引用的原始資產，回傳名稱、MIME、base64，檢查路徑／大小／實際 hash |
| POST /local-api/ai-status | 可選 id，回傳指定／最近工作，找不到表示服務重啟或已過期 |
| POST /local-api/ai-cancel | id，取消分析中工作；儲存期間拒絕 |
| POST /local-api/knowledge-ai-restore | 無輸入，檢查最近更新後未再改動才恢復原知識及案例引用 |

knowledge-import 新增 HTML 純文字輸入，knowledge／knowledge-document 仍相容 .md／.txt 儲存；knowledge 回傳可選 lastAiUpdate 的時間、封存、衝突及摘要。AI 知識啟動 body 上限 48 MB（容納 20 MB 原始資料的 base64／JSON），以 byte 計量並正確拼接跨 chunk UTF-8；其他既有寫入仍維持原上限。直接 knowledge-import 的舊文字契約仍限小型有效知識，不接受圖片或大型原檔，其餘既有來源與檔案安全邊界保留。

## 驗證證據

本機 codex-cli 0.164.0 已實測：合成 JSON smoke、合成 HTML 新舊知識更新（1 更新、1 取代、1 有效文件）、合成前端功能分析（1 功能、1 頁面，其餘 API 明列未分配），都經實際 CLI 及同一平台工作流程完成。不使用使用者真實知識／來源作這些模型測試。

回歸用注入模型驗證去重、衝突、備份、案例引用／還原、外部變更拒絕、失敗與取消。真瀏覽器 verify-website-ai-ui.mjs 使用真 middleware／檔案與注入模型，測按鈕／進度／地圖更新／HTML／還原及可及性；實際 CLI 另測，不把注入模型結果冒稱真模型業務驗收。

大型與圖片回歸覆蓋 10 MB／20 MB 邊界、UTF-8 完整拆段、圖片格式與像素、來源留存、還原、半途失敗及來源 session／hash 核對。合成 Rich Menu 圖已經真實 Codex CLI 完成附件辨識與套用（1 份有效知識、原圖保留），未傳使用者真實資料。verify-knowledge-assets-ui 使用真 middleware／檔案與注入模型，驗證圖片預覽、超過 1 MB 文件拆段、下載及大小／格式錯誤；不當作模型品質驗收。CLI 圖片旗標依 [官方 Developer commands](https://learn.chatgpt.com/docs/developer-commands) 與本機 exec --help 核對。
