# 本機來源分析與獨立測試專案

文件版本：2.28

最後更新：2026-11-11

測試報告分 API 與畫面兩類，畫面標示 web／android，分別固定寫入獨立專案 reportDir/api、reportDir/ui，日期時間命名並輸出 JSON／HTML／TXT。schemaVersion 1 新增 testType、screenshotsEnabled、target、dataMode、screenshots，保留舊根目錄報告。config/report.json 的截圖預設關閉，網站可保存下次執行選項；僅新版畫面 fixtures 在開啟時擷取 PNG，API 不留圖。一般畫面使用本機前端 WEB_BASE_URL 與 LIFF mock，並對實際 BFF 資料及 DOM 分別斷言；原生推播另使用 Appium。網站可啟動既有本機 AVD／Appium及選裝置，不提供產品腳本執行，不恢復 VM／舊 Control API。依使用者補充，本輪只準備框架與環境，不開啟 LINE、不擷取實際手機畫面、不發送推播。完整契約見 docs/ui-testing-reports.md。

知識上傳每來源最多 10 MB，每批 20 份、總共 20 MB；支援 MD／HTML／TXT／PNG／JPEG／WebP。原始文件與圖片保存 knowledge/sources，整理文字仍採每份 128 KB、最多 500 份的有效知識；索引 sources 與 README 連結保留原始證據。大型來源逐段分析，超過模型容量的現有知識先檢索候選再比對全文，未選中資料不刪除。圖片只認可見文字及版面，不推測動作或後端，強制標記用途未指定。知識頁可查看原圖及下載原檔；新增 POST /local-api/knowledge-source（id／sha256），同來源 session、路徑、大小與 hash 驗證。完整限制見網站 AI 文件。

測試流程（?view=flows）為唯讀案例表格，採四欄橫向步驟矩陣（案例／功能｜測試步驟｜使用資料｜預期結果）分組呈現每個案例的逐步操作、選填步驟資料（`steps[].data`）與逐步預期（前置／輸入步驟允許留空，驗證點或結尾步驟說明結果），前置條件、整體預期與清理方式精簡顯示於案例末尾橫向摘要列，長篇舊內容以原生 `<details>` 折疊按需展開。僅保留重新讀取與測試專案位置，不提供新增、編輯、確認、任務複製、篩選或舊流程檔入口。POST /local-api/case-plans 只讀取並驗證 test-cases/catalog.json，不掃描或執行測試、不讀取舊確認檔；案例格式、版本與既有內容保留。規劃與實作全在本機專案使用 plan-test-cases／implement-tests skill 完成，知識不足在本機對話集中詢問。cases:check 預設只檢查資料完整性，status ready 不代表核准或產品通過；--review 及舊確認端點／檔案僅保留相容，不作實作前置條件。測試報告維持 ?view=reports。

## 修訂紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| 2.28 | 2026-11-11 | 案例規劃 `steps` 擴充選填 `data` 且允許前置／輸入步驟 `expected` 留空，測試流程表格（`?view=flows`）改採四欄橫向步驟矩陣與原生折疊摘要，並同步更新案例規劃編輯與 AI 引導規範；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 2.27 | 2026-11-11 | 新專案 `initialize()` 改寫入空 `test-cases/catalog.json`，且 `setup()` 於 `schemaVersion: 2` 專案自動非覆寫產生單支 API 模組與 `.spec.ts` 草稿；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.26 | 2026-11-11 | 初始設定第一步點選「本機資料夾」直接開啟電腦資料夾選擇器（移除「選擇前端專案」按鈕與開啟中橫幅），第三步知識整理改採單一頂端橫幅 toast 並於完成後消失；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.25 | 2026-11-09 | 新增 view=scripts 測試腳本唯讀清單及 POST /local-api/scripts，顯示實際檔案數與內容判讀、分類及限制。新增入口與本機 API，未改既有守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 2.24 | 2026-11-09 | 來源及現行環境設定遷移至測試專案 .env，初始化／重新連接強制補齊 Git 忽略；平台只保留專案定位。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.23 | 2026-11-08 | 新建測試專案附 setup-android skill，提供官方下載、Google Play AVD 與本機設定指引，不配送 SDK／裝置資料。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.22 | 2026-11-08 | 初始設定改全頁三步守衛、Git／本機選擇與單一 PRD 上傳；新增 clone-source 本機契約及完成條件。改進入守衛，未改路由名稱、產品 API、GraphQL payload 或 DB schema。 |
| 2.21 | 2026-11-08 | 報告頁固定目前專案，進入／分類切換自動讀取最新結果，移除匯入與目錄操作，歷史及畫面設定收合。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.20 | 2026-11-08 | 報告 API／畫面分類、可選截圖及 TXT，加入本機網頁／Appium fixtures 與受控環境端點；未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 2.19 | 2026-11-08 | 加入 10 MB 知識來源、圖片辨識、分段整理與原始資產預覽／下載；新增 knowledge-source 本機契約，未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 2.18 | 2026-11-08 | 測試流程簡化為唯讀表格，新增 case-plans 唯讀契約，本機 skill 不再要求網站確認；沿用 view=flows，未改產品 API、GraphQL payload、守衛、導向或 DB schema。 |
| 2.17 | 2026-11-08 | 測試流程改為案例規劃表，共用 catalog 與版本確認記錄，新增 case-confirm 本機契約及兩個本機 AI skill；未改產品 API、GraphQL payload、守衛、導向或 DB schema，沿用 view=flows。 |
| 2.16 | 2026-11-08 | 改為網站按鈕啟動受控本機 Codex 功能／知識分析，支援 HTML、語意去重取代及可還原封存；新增 AI 工作／狀態／取消／還原本機契約，未改產品 API、GraphQL payload、頁面路由、守衛或 DB schema。 |
| 2.15 | 2026-11-08 | 新增前端功能證據包、本機 AI 提案驗證及版本核對套用，總覽與產品／測試分層；新增 frontend-features-prepare／apply 本機契約，未改產品 API、GraphQL payload、守衛、DB schema 或既有頁面路由。 |
| 2.14 | 2026-11-08 | 依使用者校正改為預設 SVG 節點連線地圖，支援縮放平移、節點拖曳與按需詳情；測試清單獨立，表單收斂且技術編號自動產生。未改產品 API、GraphQL payload、守衛、導向、DB schema 或既有本機 API 契約。 |
| 2.13 | 2026-11-08 | 新增專案知識分類編修、固定案例目錄、腳本關聯地圖與依賴／意圖版本提示；新增 catalog／knowledge-update 本機契約及 view=catalog／knowledge 入口，未改產品 API、GraphQL payload、守衛或 DB schema。 |
| 2.12 | 2026-11-07 | 改用 api 請求模組與單支／流程測試分層，新增配對生成、共用呼叫契約與明確備份遷移；本機 generate 回傳新增 apiModules，未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 2.11 | 2026-11-07 | 加入明確附加的 HTTP／JSON 回應預覽與敏感欄位遮蔽，reports 維持 Git 忽略；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 2.10 | 2026-11-07 | 新專案內建 TypeScript、Node 型別與 BFF 宣告及 check:types，現有專案明確升級不覆寫自訂設定；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.9 | 2026-11-07 | 記錄獨立專案第一支登入驗證實際案例及驗證邊界，其他草稿不變；未改平台路由、守衛、導向、API payload、GraphQL payload 或 DB schema。 |
| 2.8 | 2026-11-07 | 新增全清單補齊缺少腳本及明確建立狀態，詳情獨立固定右欄；分批沿用非覆寫生成契約，未改路由、守衛、導向、API payload、GraphQL payload 或 DB schema。 |
| 2.7 | 2026-11-07 | 通用／匿名 GraphQL 名稱改取頂層實際欄位作檔名與顯示名，支援 alias／fragment 與碰撞；舊檔仍辨識，未改路由、守衛、導向、產品 GraphQL payload 或 DB schema。 |
| 2.6 | 2026-11-07 | 新稿只保留請求資料及最小略過標記，不產生通用 scenario、步驟或斷言，由 AI 後續撰寫；保留 query／variables，未改路由、守衛、導向、API payload、GraphQL payload 或 DB schema。 |
| 2.5 | 2026-11-07 | GraphQL 草稿帶入前端呼叫的 variables 結構及非秘密常數，動態／衝突值保留占位符，query 多行顯示；保留 GraphQL 變數引用，未改路由、守衛、導向、API 契約或 DB schema。 |
| 2.4 | 2026-11-07 | 合併重疊分析讀取並等待既有檔案操作，修正開發模式重複載入誤報忙碌；寫入仍拒絕重複送出，未改路由、守衛、導向、API payload、GraphQL payload 或 DB schema。 |
| 2.3 | 2026-11-07 | 新增來源同步索引、消失腳本候選與確認封存／非覆寫還原；新增本機 archive-removed、restore-removed 契約，未改路由、守衛、導向、GraphQL payload 或 DB schema。 |
| 2.2 | 2026-11-07 | 已初始化或匯入資料時不自動開啟引導，介面改以專案流程、精簡腳本列及知識雙欄預覽為主；本機 config 新增 knowledgeCount，未改路由、守衛、導向、GraphQL payload 或 DB schema。 |
| 2.1 | 2026-11-07 | 加入三步工作區設定與獨立專案 Agent 知識庫，新增本機設定／知識契約與知識庫導覽；未改既有路由、守衛、GraphQL payload 或 DB schema。 |
| 2.0 | 2026-11-07 | 新稿改為單一原生 Playwright .spec.ts，接入略過／實際步驟報告並保留舊稿；初始化格式升為 2，本機 caseFile 指向新格式，未改路由、GraphQL payload 或 DB schema。 |
| 1.2 | 2026-11-07 | 改用 BFF_BASE_URL、台北日期時間報告與操作名稱檔案，加入 Playwright 圖文報告技能；本機分析新增 caseFile，未改路由、GraphQL payload 或 DB schema。 |
| 1.1 | 2026-11-07 | 現行畫面用語改為中間層，獨立專案新增共用 Header 與個案覆寫／移除；未改路由、守衛、導向、HTTP 契約、GraphQL payload 或 DB schema。 |
| 1.0 | 2026-11-07 | 加入本機資料夾設定、唯讀接口掃描與獨立草稿產生；新增 /local-api 契約與分析導覽，未改既有 API、GraphQL payload 或 DB schema。 |

案例、專案知識編修、關聯地圖及版本證據的現行契約見 [功能與測試關聯](test-traceability.md)。知識匯入不再只有純文字預覽，可分類及編修；案例保存已確認的規劃步驟，腳本保留實作；兩者不互相覆寫。

## 邊界與啟動

平台是本機操作框架；產品測試放在平台與來源之外的獨立專案。一般 Git 工具管理該測試專案，平台沒有 Git 憑證、clone、pull 或 commit。模型／Agent 由使用者自己的工具提供，skills 與可分享記憶留在測試專案。舊 Control API、VM、PostgreSQL 與 worker 不參與新流程。

Node.js 22.18 以上，平台先 npm ci，再 npm ci --prefix apps/web。測試專案 .env 由 Node 端載入，不使用 VITE_，也不把整份環境變數送給瀏覽器。npm run dev 啟動 Vite 與 local-workspace middleware；正式建置可使用 npm run preview --prefix apps/web 提供相同本機能力。直接部署 dist 的靜態主機不會提供資料夾功能。

新初始化的獨立專案一併提供 tsconfig.json、support/bff.d.mts、鎖版 TypeScript 與 @types/node，以及 npm run check:types；初次 npm ci 即備齊編輯器及型別檢查依賴，無需手動補設定。check:types 不執行測試、不呼叫產品環境；通過不代表業務驗證。既有 initialized 專案重新連接維持非覆寫，不會自動升級自訂設定。

## 設定與路徑

| 測試專案 .env 欄位 | 用途 |
| --- | --- |
| ARCHIFY_SOURCE_DIR | 唯讀來源根目錄；網頁可選擇其子資料夾 |
| ARCHIFY_TEST_PROJECT_DIR | 僅啟動時的專案定位覆寫；不寫入平台 .env |
| ARCHIFY_ANALYSIS_DIR | 測試專案內的分析輸出與恢復清單位置，預設 analysis |
| ARCHIFY_API_TEST_DIR | 測試專案內 tests/ 下的案例輸出預設值，預設 tests/api |
| ARCHIFY_REPORT_DIR | 測試專案內要顯示的報告資料夾，預設 reports |
| BFF_BASE_URL | 非秘密受測 URL，僅填入新專案 .env.example，不自動執行或保存認證 |

來源／專案可為絕對路徑或相對平台根目錄。其餘資料夾為專案內相對路徑，不可重疊、離開專案或使用保留目錄；分析與報告不得放在 tests/。UI 可調整本次來源子資料夾與案例輸出，先確認位置再掃描；修改位置後必須重掃才能產生。讀取設定不會修改 .env；網頁工作區設定將來源與子目錄保存測試專案 .env，平台 .local/workspace.json 僅保存 projectRoot 並排除 Git；舊工作區環境值成功保存後移出平台 .env，既有測試專案值優先保留並立即套用，手動修改測試專案 .env 後需重啟服務。程序環境變數優先於 .env。

初始化複製 api、framework、support、config、skills、memory、knowledge、fixtures、requests 與必要套件／文件，tests 僅交付 api／flows／ui／web／mobile 的空目錄標記，`test-cases/catalog.json` 一律初始化為空的 `{ schemaVersion: 1, features: [], cases: [] }`（不複製範本自測、參考案例或產品測試），建立 archify.config.json、.env.example 和案例目錄；不複製平台、原始碼、秘密或範例產品測試。`setup()` 初始化後掃描前端，對 `schemaVersion: 2` 且具備 `support/api-client.mts` 的專案自動非覆寫補齊單支 API 模組與 `.spec.ts` 草稿。既有相同範本可接續，衝突先拒絕，不覆寫。版本標記已存在時不自動更新框架；後續框架更新需人工管理。新專案使用鎖版的 @playwright/test，執行前需在獨立專案 npm ci，離開平台後仍可 npm test／npm run flow。報告位置同時寫入專案 archify.config.json；後續變更須與平台設定同步。

## 分析與產生

services/local-workspace/scan.mjs 使用既有純 AST 解析模組 requestCatalog、sourceModuleResolver、apiAnalysis 與 requestUsages，不載入 DB／模型／伺服器。讀取支援的 JS／TS、GraphQL 與設定 JSON，不執行來源、不安裝其套件、不呼叫 API。隱藏檔、.env、node_modules、build／dist／coverage、test／tests／e2e／__tests__／__mocks__／__fixtures__、*.test／*.spec、秘密命名檔及連結略過；最多 20000 目錄項目、3000 檔、20 MB，每檔最多 1 MB，超過整體上限拒絕，略過項目會列出限制。Vue／Svelte、動態工廠、自訂 SDK 與執行期組裝不保證解析。

HTTP 依方法與端點去重；不同 payload 共用同接口時保留第一份並標示差異。GraphQL 依操作名稱與正規化文件去重，共用 /graphql 仍分開計算。已確認服務數只計算可直接辨識的 absolute origin；相對／動態端點另外明示未知，不能當作實際中間層數量。來源檔與呼叫位置保留，沒有部署或完整覆蓋保證。

分析只保存來源 hash、接口與來源位置，不保存整份程式碼。常見秘密欄位轉成占位符、Header 只保留 Content-Type／Accept、URL 帳密移除、GraphQL 非秘密預設值轉入 variables、秘密預設值遮蔽，動態值不猜測。這是規則遮蔽，無法保證辨識任意非標準欄位或字串中的秘密；提交 Git 前應審查分析與生成檔。

每次掃描保存獨立 analysis-UUID.json，重載可恢復相容清單。生成只接受本次掃描的 1 至 500 個 ID，現在配對產生 api/操作名稱.ts（operation 與 callApi）及 tests 下的操作名稱.spec.ts（匯入 API 與最小 test.skip），不內建業務斷言；不再逐接口產生 JSON。既有 API 模組、.spec.ts 或舊三檔任一存在都略過，避免覆蓋或雙份測試。舊三檔描述僅供 legacy 格式核對。

新稿 .spec.ts 不產生 scenario、固定三步、request.fetch 或通用 expect。query／variables 與請求設定移到 API 模組，測試保留 import 及讓報告識別草稿的 test.skip。使用者先填資料，再由 AI 撰寫實際步驟與業務斷言；不能只去掉 skip 留下空測試。詳見 [測試專案](../test-project/README.md)。

回應預覽使用 support/response.mjs 的 showResponse(response, testInfo)，在收到回應後、斷言前呼叫；登入案例已套用。終端與獨立 HTML／JSON 報告保留 HTTP status 及遮蔽後 body，JSON 案例可選 responses: [{ status, body }]，相容既有 schemaVersion 1；平台閱讀器暫未呈現此欄位，請開啟 reports 的 HTML。token、密碼、認證、cookie、API key 及 message／stack 欄位遮蔽，Header／URL 不附加，非 JSON 只保留說明。規則不保證任意自由文字均無秘密；不得自行 console.log 原始回應。reports/ 已列入 .gitignore，已被 Git 追蹤的歷史檔案不會因此自動取消追蹤。只捕捉已收到的回應，傳輸失敗沒有 response。舊報告不會補上新資料。

## 本機契約與安全

| 方法／路徑 | 輸入與結果 |
| --- | --- |
| POST /local-api/pick-directory | kind: source／project；以置頂前景開 Windows 現代資料夾選擇器（含回退），重開或中斷自動中止舊視窗，取消不改設定 |
| POST /local-api/validate-source | path；確認來源是既有無連結資料夾 |
| POST /local-api/setup | sourceRoot、projectRoot；驗證、初始化／連接、掃描來源並為新版專案非覆寫產生單支 API 草稿，保存兩根路徑並立即套用 |
| POST /local-api/setup-complete | 空物件；保存此測試專案首次引導完成 |
| POST /local-api/knowledge | 空物件；知識清單與完成狀態 |
| POST /local-api/knowledge-document | id；純文字與 metadata |
| POST /local-api/knowledge-import | documents: name、content；預檢後非覆寫匯入 |
| POST /local-api/knowledge-archive | id；移往 knowledge/archive 並移除清單 |
| GET /local-api/config | 非秘密來源／專案／子目錄設定、初始化狀態、knowledgeCount、當次 session |
| POST /local-api/initialize | 空物件；初始化範本，不覆寫 |
| POST /local-api/folders | subdir；列出來源範圍內最多 300 個可選子資料夾 |
| POST /local-api/scan | sourceSubdir、apiDir；保存並回傳分析清單 |
| POST /local-api/analysis | 空物件；恢復最近一次相容分析或 null |
| POST /local-api/archive-removed | scanId、ids；確認後封存／移出本次候選，回傳 archive、paths 與更新 analysis |
| POST /local-api/restore-removed | archive；依 manifest 非覆寫還原，回傳 restored 與 analysis 或 null |
| POST /local-api/generate | scanId、ids；回傳 created 測試路徑、apiModules 模組路徑與 skipped ID |
| POST /local-api/reports | 空物件；指定報告目錄最多 100 筆新到舊檔案 |
| POST /local-api/report | name；讀取單一 report／flow JSON，不接受任意路徑 |

僅接受本機來源位址、localhost／127.0.0.1／::1 Host 與同源 Origin，拒絕 cross-site。POST 必須 application/json、當次 X-Archify-Session，body 一般上限 64 KB，knowledge-import 上限 2 MB（解碼內容另限 1 MB）；不提供 CORS。一般錯誤為 400，來源／session 錯誤 403，未知操作 404，body 過大 413。成功與失敗都不回傳原始 fs error／秘密；config 只回非秘密欄位。

讀寫前拒絕 symlink／junction，檢查目錄邊界；不是可抵抗同帳號惡意程序替換路徑的 OS 沙箱。不要把此服務公開到網路或讓不可信本機程序接管。平台不執行使用者腳本，外部測試 CLI 仍使用執行帳號權限。報告只列出格式檔名、最多 10 MB，閱讀器另驗 schema 與狀態；檔案內容不代表可信簽章。

## 驗證入口

- npm test：獨立框架與 HTTP runtime 回歸。
- npm run test:workspace：掃描、初始化、不覆寫、路徑／連結、session／Origin 與獨立 CLI；Windows junction 需要對應權限。
- npm run build --prefix apps/web、node scripts/verify-reader-dev-css.mjs。
- 設 DS_REQUIRE_BROWSER=1，執行 node scripts/verify-local-workspace-ui.mjs 與 node scripts/verify-reader-ui.mjs。

本機 workspace UI gate 用正式 JS／CSS、實際 middleware／檔案服務與暫存專案，僅攔截瀏覽器傳輸；不是產品 API 真實執行驗收。來源掃描與產生、流程檔不會被標成產品測試通過。

## 共用 Header 與用語

現行介面使用「中間層」，技術 ID／目錄與 ARCHIFY_API_TEST_DIR 保留相容。獨立專案 config/http.json 提供 headers 物件，可版控的內容只含非秘密值與 {{ENV_NAME}} 占位符，認證實值存測試專案 .env。依共用、請求定義、個案 scenario.headers 順序合併，不分大小寫，null 移除；先合併再解析占位值，因此未登入案例可移除共用認證而不要求 token。缺少檔案相容舊行為，錯誤格式／缺少變數／無效 Header 則送出前失敗。此檔僅由測試 runtime 讀取，不新增秘密網頁欄位或本機 API payload。

框架範本預設 Accept: application/json；特定測試專案依實際 Header 名稱設定 satoken 或 Authorization，不自動推定通用認證，也不自動登入／刷新 token。設定範例見[測試專案](../test-project/README.md)。

## 可讀命名與相容性

BFF_BASE_URL 明示要連線測試的 dev／QA 中間層，GraphQL 包含 /graphql。平台 .env 只提供新專案的非秘密範例值，實際執行讀取測試專案 .env。舊 ARCHIFY_TARGET_BASE_URL 保留回退；若 BFF_BASE_URL 已定義則優先，明確空值不退回另一個環境。

GraphQL 檔名優先採有意義的 operationName，如 AcceptAllRequests.spec.ts；若為 Query／Mutation／Subscription／匿名，改用頂層實際欄位（checkCard → CheckCard），忽略 alias 並解析頂層 fragment，多欄位用 And 串接；HTTP 用方法與路徑，忽略大小寫碰撞時加短 ID。內部 ID 保留，資料與斷言直接寫在同一測試檔。產生器偵測新格式與舊三檔，避免重複生成；caseFile 顯示新格式路徑。舊三檔保守遷移並完整封存。

報告命名為 report／flow-YYYY-MM-DD_HH-mm-ss-SSS-短尾碼.json／html，時間固定 Asia/Taipei，採執行開始時間；短尾碼防碰撞，寫入採 exclusive create。閱讀器仍接受舊 UUID 報告。產生器與平台分離，完整 runId 保存在 JSON。

Playwright 技能放在獨立專案 skills/playwright-test-report，來自使用者附件並依專案調整：技能與腳本可版控，日期時間報告留 reports/playwright，來源內不使用 .local-prd 或隱藏技能規則。原生 Playwright runner 報告已接入閱讀器；技能另有手機圖文 results.json 格式仍未接入，不會自動執行產品測試。

## 原生 Playwright 與相容遷移

現行 schemaVersion 2、framework playwright，使用 @playwright/test 1.64.1。每支 .spec.ts 直接使用原生 test、request、expect、test.step，support/bff.mjs 只管理共用設定與插值，不建立另一套測試 DSL。新稿尚無業務步驟；實作後可用 archify-plan 宣告步驟，reporter 不靜態猜測任意 TS 分支。npm run flow 用 --list；npm test 才執行 body。全部略過的 exit 0 不代表驗收。

support/archify-reporter.mjs 接收原生 Playwright 實際步驟，產生現有閱讀器可讀 JSON／HTML，保留失敗與略過。只使用自訂 reporter 避免原生錯誤輸出 Header；config 固定 PLAYWRIGHT_NO_COPY_PROMPT 停用 1.64.1 的自動頁面快照，preserveOutput:never 清除原始產物，生成的請求與斷言錯誤改為安全摘要；升版要回歸此行為。trace、video、screenshot 預設關閉。原生 request timeout 30 秒、禁止 redirect；此路徑不再套用舊 executeApi 的 2 MB 回應限制。

遷移先判斷 AST 是否仍為單步 executeApi 草稿；自訂步驟、cleanup、非靜態 metadata／import 或可能的秘密常數留待人工處理。可遷移者將資料與原斷言轉為原生 expect，原檔保存 legacy/pre-playwright/日期時間；舊 package／文件也保留。當前 .env 與 config/http.json 不改動。Web spec 入口已可用，但瀏覽器未下載，也未作產品 Web／手機驗收；手機圖文 results.json 仍獨立。

## 首次引導與 Agent 知識庫

初始設定為全頁三步守衛：設定讀取中或失敗時不掛載產品頁，configured／initialized／onboardingCompleted 任一未完成均停留引導，直接輸入頁面網址或 Escape 不會略過。第一步兩個並排來源選擇，支援受控 Git 下載與本機（點選「本機資料夾」直接開啟電腦資料夾選擇器並保留路徑欄供取消或貼上路徑，不另設「選擇前端專案」按鈕或開啟中橫幅）；第二步單一資料夾選擇置中，測試專案須獨立於平台及前端，保留既有內容。第三步標題「上傳 PRD、業務流程文件」，只用一個置中正方形上傳按鈕與線條圖示，不提供文字輸入框或稍後略過；上傳與整理期間改以單一置頂橫幅 toast 顯示進度並於完成後消失，不重複顯示整理橫幅。沿用 10 MB 檔案上傳與 AI 整理，至少一份有效知識後才能完成。建立框架或上傳文件不自動視為完成；重新整理後接續第三步，已有完成標記不重跳。側欄設定可重開並返回工作區。完成標記存於獨立專案，不是 localStorage。

knowledge.mjs 管理 knowledge/documents 的 UTF-8 .md／.txt、index.json、README 自有標記及 AGENTS 閱讀入口。每份 128 KB、每批最多 20 份及 1 MB、最多 500 份；SHA-256 相同內容略過。內容只以文字預覽，不渲染 HTML、不執行命令、不上傳模型。名稱搜尋不等於語意搜尋，尚無 PDF／Word 擷取。封存保留原檔至 archive，不再列入閱讀清單；跨檔更新非 DB 交易，失敗時需核對檔案與索引。

README 標記區段以外的人工內容保留；index.json 由平台管理，直接新增文件需經匯入才列入清單。外部 AI 須自行閱讀 AGENTS.md、knowledge/README.md 與相關 skills；一般腳本任務避免修改 framework、support、套件與執行設定，只有明確框架變更任務才調整。這是協作約定，不阻擋同帳號工具寫檔。

知識與設定回歸：node --test services/local-workspace/knowledge.test.mjs；瀏覽器 gate：DS_REQUIRE_BROWSER=1 node scripts/verify-knowledge-ui.mjs，使用真實暫存專案／middleware，原生選擇視窗以注入的選擇器替身回傳路徑，未代替實際使用者操作 OS 視窗。

## 精簡介面與引導抑制

有完整設定及明確 onboardingCompleted 標記時才進入首頁；只有初始化或知識不視為完成，側欄仍可手動重開。讀取設定提供 knowledgeCount 供首頁顯示，未包含知識內容。來源／腳本／知識以真實專案資料呈現，技術路徑、來源證據、端點與進階位置預設收起。知識頁預設顯示文件清單與內容預覽，新增表單由按鈕展開；功能與非覆寫限制保留。

## 前端移除與腳本同步

每次掃描／產生以 script-sync.mjs 建立 analysis/script-sync-scopeSHA256.json：追蹤來源絕對位置、來源子範圍與輸出資料夾相同，且檔名／分析 ID／單一 archify-id 一致的 .spec.ts。索引為測試資產可版控；不同電腦路徑重新建立基準，不因讀到其他來源的分析就清理。首次沒有索引時只認領本次仍能對應的腳本，不追溯推測舊消失項。

analysis／scan 回應新增 removed（id、name、path）與 removalNotice。只有來源根目錄、有來源檔且無解析警告才提出候選；同 ID 仍存在、同名 GraphQL 變更、相同來源檔可能是修改、同 ID 多腳本或標記不符時保留。子資料夾及不完整掃描不提供移除建議；限制顯示於資料夾設定。候選不證明 API 或業務已停用。

使用者選取確認後，archive-removed 核對 current scanId，重新掃描來源確認 hash／警告，預檢所選腳本 hash，再複製原檔到 legacy/removed-api/removed-台北日期時間-尾碼/files/原相對路徑並保存 manifest，最後移出 tests。只處理選取的單支腳本，不動設定／共用資料／skills／知識／報告。來源或腳本又變更時拒絕，應重新分析。最多 500 支；跨檔不是交易，異常時嘗試非覆寫回復並回報封存位置。

還原以 manifest 識別、hash 與目錄邊界預檢，只寫 tests 下 .spec.ts，任何既有目標均拒絕，不覆寫且保留封存。UI 可還原上次操作，重新整理後可依 manifest 人工複製或透過 restore-removed 指定封存。封存可跟 Git 一起保留，平台沒有 Git 動作。功能不執行腳本；AI CLI 及變更腳本自動更新尚未接入。

驗證：node --test services/local-workspace/script-sync.test.mjs；分析 UI gate 以真實暫存來源移除 GraphQL 檔，檢查取消、確認、原文封存與還原、axe、對比與 overflow。

## 同時操作與重複讀取

analysis 讀取重疊時共用同一次結果；若已有掃描或寫入，等待其結束後讀取最新快照。React 開發模式的 StrictMode 重複載入不會因此回報忙碌。掃描、產生、封存與其他寫入仍互斥，重複寫入不排隊或重送，避免過期／破壞性動作自動執行。成功或失敗均釋放鎖，讀取失敗後可重試；互斥限本機服務實例，不是跨程序 OS 鎖。

## GraphQL query 與 variables

graphql-payload.mjs 合併解析器提供的呼叫變數，優先使用 transport 請求處結構，沒有時才參照 caller。保留可解析的非秘密常數、布林、數字、null、陣列與巢狀物件；多份模板只有衝突／缺少欄位保留 {{欄位路徑}}，不任選一份。無法確定物件結構時只依 query 宣告留下頂層變數，不猜測型別欄位。

query 仍保留完整選取與 fragment，格式化後以 TypeScript 多行字串寫入 operation.body.query。非秘密 GraphQL 預設值轉入 body.variables，query 不再內嵌預設資料；秘密常數仍遮蔽，$password 等原有變數引用保留，不錯改成字串。沒有參數的操作保留 variables:{}。

API 模組的 operation.body.variables 是預設結構；options.variables 直接覆寫 GraphQL variables，options.values 才解析 {{名稱}}，也可使用 .env 參照。舊單檔 scenario 只作相容核對，不要求新稿建立。填入資料，不會執行前端或推測業務預期。尚未設定的草稿仍略過。重新分析的新結果用於新稿，generate 仍不覆寫既有檔。

refresh-graphql.mjs 提供本次受控更新：只有原 operation 靜態物件完全符合舊分析且 ID／其他請求設定未變，才取代 operation 區；scenario、斷言與周邊人工程式不動，不相符則略過。更新前原文備份於 legacy/graphql-payload。不是一般自動覆寫端點，CLI 更新流程仍待整合。

## 請求資料草稿

新產生器只匯入 test、export operation 與 test.skip（archify-id 保留），不包含 scenario、預期狀態、固定 steps、archify-plan、網路呼叫或通用斷言。body.query／variables、Header／端點／HTTP 資料完整保留，之後可自行填值，再讓 AI 依知識與需求實作。沒有參數的 GraphQL 仍是空 variables。填完資料不會自動執行；須真正撰寫測試並替換 skip。

legacy-playwright-source.mjs 只供舊案例與斷言遷移，明確傳入舊設定時才使用；新稿不使用。移除既有通用骨架時先比對完整預設程式，保留 operation 原文；人工測試流程不自動刪除，備份至 legacy/request-only。登入與其他操作皆比照同一規則，不自動建立或執行實務案例。

前述 scenario／固定 steps 描述只適用於保留的舊格式案例，當前新稿以本節為準。

通用名稱回退只改檔名、平台顯示名與新稿測試標題，不改 query 內的 operationName、variables 或 archify-id。解析失敗／無法選出操作時維持原命名。真正名稱碰撞仍加短 ID，舊 Query-短 ID.spec.ts 與舊三檔都辨識，避免重複生成；既有檔不自動覆寫或改名。本次明確授權的兩支更名保留備份並更新同步索引，歷史報告仍維持原路徑。

## 補齊缺少腳本與建立狀態

分析只更新清單，不自動建檔。UI 提供「補齊缺少腳本（數量）」，以整份分析清單呼叫既有 generate，每批最多 500 個 ID，搜尋與類型篩選不影響補齊範圍；服務重新檢查檔案，既有檔保留。每批成功即更新建立狀態，結束重讀清單。中途失敗保留已完成檔案，不自動重試；重新分析或讀取後可再補齊。亦可用「建立所選腳本」。

列狀態「已建立腳本／尚未建立」只是檔案建立狀態，不代表可執行或通過。原有草稿與待產生標籤移除。列頭與列內容使用同一四欄 token，中間層、檔名、建立狀態、詳情各自一欄，詳情靠右對齊，不受狀態文字長度影響。

## 第一支實際登入案例

獨立測試專案可依需求將登入腳本撰寫為專用請求與契約驗證，其餘未實作腳本維持 skipped 草稿。首次登入需明確清除舊認證 Header、依前端契約建立測試裝置資訊；token 僅保留於該次測試記憶體中，不寫入報告或 Git，後續流程再明確傳遞 token。

## 可重用 API 與流程契約

api/ 為保留目錄，不能用作 analysis／report／案例輸出。新專案 schemaVersion 2 保留，另標記 apiLayout: reusable-v1；既有已初始化專案不自動覆寫框架。generate 的 created 仍只計單支測試，新增 apiModules 列出模組，避免 UI 腳本數加倍。任一配對檔存在則整筆略過，來源移除只封存測試，保留可能被流程引用的 API 模組；需要復原使用既有封存還原，不能靠重新生成覆寫 API。

每個 API 模組匯出 operation 及 callApi(request, options)，回傳 Playwright APIResponse。options.variables 頂層覆寫 GraphQL variables，巢狀物件完整傳入；options.values 解析占位值；headers 個案覆寫或 null 移除，body 完整覆寫，queryParams 值限字串／數字／布林。傳輸一次、30 秒 timeout、不跟隨 redirect、不自動重試、不存 token、不做業務斷言。模組 import 不發請求也不註冊測試；tests/api 與 tests/flows 可共同匯入，token／cardId 在同一流程明確傳遞，不 import spec。範例在 skills/write-tests/references/api-flows.md，示意欄位不能當產品契約，未建立或執行真實 PinCard 流程。

既有靜態單檔可用 reusable-api-migration.mjs 的 plan／apply 明確遷移：保留 initializer 原文、其餘資料／斷言／ID，檢查來源 hash、模組碰撞及目錄邊界，完整備份 tests 到 legacy/reusable-api 的台北日期目錄。動態或無單一 operation 不猜測，保留人工核對。中斷可能留下可核對的部分結果，需參考備份處理，不宣稱跨檔交易。前端掃描、GraphQL payload 與執行授權不變；refreshGraphqlSource 對 API 模組的靜態 operation 使用原有保守比對。

## 前端功能總覽

現行已提供全頁面證據包、本機 AI skill 與提案驗證／套用，預設全部功能，再分產品頁面／API 與測試流程；靜態可達不等於完整業務覆蓋，未分配項目明示，不啟動網頁 Agent。詳見 [前端功能總覽](frontend-feature-overview.md)。

## 網站 AI 分析與知識更新

依使用者新要求，網站已啟動本機 Codex 分析，不再只提供複製提示。功能圖與 MD／HTML 知識有 AI 工作進度、取消與驗證套用；知識更新去重、取代舊版先封存並可還原。CLI 使用本機登入但模型推論可能傳到服務，預設不載入使用者 config。詳細契約與限制見 [網站 AI 分析](website-ai-analysis.md)。先前不啟動 CLI 的描述為舊操作限制，已由本次決策取代。

報告頁固定使用目前已綁定測試專案的 reportDir，進入與分類切換會自動列檔並開啟最新報告；重新整理重讀最新結果。頁面不提供 JSON 匯入、資料夾選擇或完整路徑編修。專案名與報告數簡要顯示，歷次報告以日期列表收合，保留檔名 title／可及名稱與舊根目錄報告（缺類型以 API 相容）。畫面測試設定預設收合。深連結 report 仍限定原本安全相對檔名；讀取失敗保留已開啟內容，快速切分類以請求序號避免過期回覆覆蓋。未提供測試執行。

### 初始 Git 下載契約
POST /local-api/clone-source 接受 url／path，沿用 loopback、同來源及 session。URL 只接受公開 HTTPS（無帳密／query／fragment）及 git SSH；SSH 需本機已存在金鑰與 known_hosts，不開啟互動認證。目的必須是前端與平台／測試專案之外的新目錄，上層須存在；禁止連結及覆寫。Git 使用參數陣列、非 shell、depth 1、禁止 file／ext、停用模板／hooks／全域系統 Git 設定及自動 submodule，不做套件安裝或來源執行。這也代表 HTTPS 不繼承全域 credential helper／代理／URL rewrite，私人倉庫建議先用本機既有 SSH。120 秒逾時與輸出限制，原始錯誤不回傳；失敗殘留由使用者處理或改新目錄，不自動刪除。不是 push／pull／Git 連線管理，不保存憑證。未實測外部公開／私人倉庫。

setup-complete 另驗證來源與有效知識，拒絕空知識；首次 gate 只控制頁面掛載，不宣稱同帳號本機 API 變成授權隔離。

新建立的獨立測試專案透過既有 skills 遞迴收集，一併交付 skills/setup-android/SKILL.md；README／AGENTS 與 write-push-tests 有明確入口。技能先檢查現有工具，再提供 Android Studio／SDK／Google Play AVD／Appium 官方安裝指引，區分平台 .env 與測試專案 .env，不會自動安裝或執行。SDK、AVD 磁碟、登入資料不隨 Git；平台需找到 SDK 及既有 AVD 後，檢查環境才列出啟動按鈕。既有專案重新連接仍非覆寫，不自動升級技能。

初始化與重新連接均在測試專案 .gitignore 最後補上 .env、.env.*、!.env.example，保留其他內容及秘密。Git 已追蹤檔案不會自動取消追蹤；需另行人工處理。AI 依 AGENTS.md 只讀 ARCHIFY_SOURCE_DIR 找產品原始碼，不輸出整份環境檔。

## 測試腳本清單

側欄「測試腳本」（?view=scripts）位於測試流程與測試報告之間，沿用完成初始設定的守衛。進入與重新讀取以 POST /local-api/scripts（空物件、同來源 session）唯讀掃描獨立測試專案 tests/，回傳 summary、scripts、warnings；不讀前端、不 import 或執行腳本、不啟動模型。每個 .spec／.test 的 JS／TS 檔算一支，包含手寫與生成稿；api/ 請求模組、隱藏資料夾、node_modules、legacy、dist、build、coverage 不計入，符號連結略過並明示警告。上限 5000 目錄項目、30 層、20 MB；單檔超過 1 MB 列待核對。總上限超過回傳錯誤，不把部分清單當完整數量。

summary 顯示檔案總數及含測試內容／空白草稿／待核對。以 AST 辨識 test（含具名 import alias）、test.skip／fixme／only 的 callback；callback 有敘述即含測試內容，全部空 callback 為空白草稿；無可辨識宣告、語法錯誤或過大為待核對。測試宣告與標記略過數僅靜態數量，迴圈、條件、動態產生及執行期 skip 不能當實際執行數；含內容不表示完整斷言、可執行或通過。API 單支／API 串接／網頁／Android／其他按 tests/api、flows、ui 或 web、mobile 及其他路徑分類。支援分類按鈕、空狀態、loading disabled 與失敗保留原清單並標記可能過期，不提供腳本編輯／執行。

驗證：先 npm run build --prefix apps/web，再 DS_REQUIRE_BROWSER=1 node scripts/verify-script-inventory-ui.mjs；正式建置與暫存專案驗證檔案統計、分類、重新讀取、失敗保留、axe、鍵盤、target size、桌面縮放及長檔名溢位。
