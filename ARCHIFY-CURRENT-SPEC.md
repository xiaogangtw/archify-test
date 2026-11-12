文件版本：1.7

最後更新：2026-11-12

## 修訂紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| 1.7 | 2026-11-12 | 葉功能改主區完整閱讀器與 API 流程／測試案例分頁，來源和長步驟按需展開；分類地圖原位置保留，取消寬度相關的右側／下方詳情。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.6 | 2026-11-12 | 功能詳情改為預設可見的前端操作與 API 流程表，新增選填 api／transfer 說明及舊分析升級，來源證據按需展開。未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.5 | 2026-11-12 | 序列圖前移至功能詳情，AI 分析依前端證據產生互動與條件，無案例也可閱讀；舊分析下次執行完整升級，來源異動標示舊圖。功能 metadata 新增選填 sequence，未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.4 | 2026-11-12 | 案例詳情加入規劃步驟與按需序列圖，版本相符且唯一同名時呈現逐步結果；steps 新增選填 interaction、catalog latest 新增 steps 摘要。未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.3 | 2026-11-10 | 報告入口改橫幅清單，每筆下載或另開原版HTML；原版面僅移除關鍵畫面分組，保留正常流程及證據。未改路由、產品API或DB。 |
| 1.0 | 2026-11-10 | 補報告規格metadata；單次執行改單檔HTML並解除歷史截斷，local-api/report相容新HTML。未改路由、守衛、導向、產品API、GraphQL payload或DB schema。 |

## 本機分析框架與報告閱讀器

左側或地圖點葉功能直接開啟主區完整 FeatureReader，不再另開右側或底部詳情。標題、簡短功能說明及麵包屑後，以 API 流程／測試案例分頁組織內容；預設 API 表格，案例與結果獨立，無案例不阻擋流程理解。點步驟展開完整資料／條件／來源，其他證據預設收合。返回功能地圖保留原分類、鏡頭與鍵盤焦點；分類節點繼續鑽研。來源資料與 api／transfer 相容規則不變，仍非實際網路執行證據，未新增路由或 API。

功能地圖案例詳情先呈現規劃步驟及預期，再展開序列圖與來源；無互動證據不繪圖，前端靜態 API 關聯不推定呼叫順序。catalog schemaVersion 1 的 steps 選填 interaction（from／to／source.path／source.line），latest 回應僅增加 name／status 步驟摘要。只有版本相符、無來源問題、唯一腳本及規劃／報告唯一同名時呈現逐步狀態，其餘標示未對應；不推定後續未執行或後端根因。原報告入口保留，失敗敘述明示後續業務結果尚未驗證。詳見 docs/test-traceability.md；沿用固定深色與現有 ds，無新增執行入口。

測試報告分 API 與畫面兩類，畫面標示 web／android，分別固定寫入獨立專案 reportDir/api、reportDir/ui，日期時間命名並輸出單檔HTML（內嵌schemaVersion 1及圖片），同runId持續原子更新同檔。schemaVersion 1 新增 testType、screenshotsEnabled、target、dataMode、screenshots，保留舊根目錄報告。config/report.json 的截圖在新專案預設開啟，既有明確關閉保留，網站可保存下次執行選項；僅新版畫面 fixtures 在開啟時擷取 PNG，API 不留圖。一般畫面使用本機前端 WEB_BASE_URL 與 LIFF mock，並對實際 BFF 資料及 DOM 分別斷言；原生推播另使用 Appium。網站可啟動既有本機 AVD／Appium及選裝置，不提供產品腳本執行，不恢復 VM／舊 Control API。依使用者補充，本輪只準備框架與環境，不開啟 LINE、不擷取實際手機畫面、不發送推播。完整契約見 docs/ui-testing-reports.md。

現行入口為 WorkspaceApp，提供首次設定引導、前端唯讀來源分析、專案知識、互動功能地圖／測試清單及流程／報告導覽。Vite local-workspace middleware 依測試專案 .env 指定來源，平台 .local/workspace.json 僅定位平台外的獨立測試專案，不使用舊 Control API、VM、DB 或 Git 版控連線；初始設定僅可受控 clone 前端來源。依使用者最新要求，網站可啟動受控本機 Codex 工作分析功能與知識；模型只回傳結構化結果，平台驗證後更新，不提供腳本執行／編輯或聊天 Agent。

本機服務合併重疊的分析讀取，等待現有操作後回傳最新快照；開發 StrictMode 的重複載入不誤報忙碌。寫入仍互斥並拒絕重複送出，不自動重送掃描、生成或移除。

新測試專案格式為 schemaVersion 2、framework playwright。分析仍依方法／端點及 GraphQL 操作文件去重，提供來源與 caseFile；每個操作配對產生 api/操作名稱.ts 與 tests/api/操作名稱.spec.ts（通用 Query／Mutation／Subscription／匿名名稱改取頂層實際欄位；alias 不當成功能名，fragment 會追查，碰撞加短 ID），請求與預設資料在 API 模組，單支及 tests/flows/ 流程匯入 callApi，之後由 AI 補原生 test／expect，不再逐接口產生 requests／fixtures JSON。舊格式可讀取、須遷移後才生成新稿；遇到既有新稿或舊檔仍不覆寫。

同一來源／輸出範圍的分析建立受管腳本索引，完整根目錄且無解析警告時，列出前端未再出現的腳本供選取確認。僅處理帶單一對應 archify-id 的單檔案例，不動手動腳本或共用資產；同名 GraphQL 或相同來源檔疑似變更仍保留。確認時重查來源及腳本 hash，再移出 tests 並完整封存到 legacy/removed-api/台北日期時間；可還原且不覆寫。首次舊專案只建立基準，換來源絕對路徑需重新建立，不追溯猜測。

新初始化的獨立專案一併提供 tsconfig.json、support/bff.d.mts、鎖版 TypeScript 與 @types/node，以及 npm run check:types；初次 npm ci 即備齊編輯器及型別檢查依賴，無需手動補設定。check:types 不執行測試、不呼叫產品環境；通過不代表業務驗證。既有 initialized 專案重新連接維持非覆寫，不會自動升級自訂設定。

獨立專案使用 @playwright/test 1.64.1，先 npm ci。npm test 執行原生 Playwright Test；npm run flow 使用 --list，只載入明示步驟計畫，不執行測試 body，頂層仍不得有副作用。新 API 模組匯出 operation 與 callApi；單支草稿匯入該模組並保留最小 test.skip，尚未撰寫測試時標記略過；全略過的標準 exit 0 不代表通過。AI 撰寫實際寫入前需另確認授權與清理，預設不重試。

GraphQL 草稿直接帶入前端 query 與呼叫處 variables；非秘密常數／結構保留，動態及多呼叫衝突值留下占位符，無參數維持空物件。query 使用多行字串，body.variables 保留待填值，新稿不產生 scenario；AI 實作測試時再選擇直接填值或以 resolveData 解析占位符。既有腳本不自動覆寫，受控更新對 API 模組內可核對的 operation 進行；舊單檔仍可核對，動態或不同格式保留人工處理，保留人工資料與斷言。

BFF_BASE_URL 與秘密保存在測試專案 .env，共用 Header 在 config/http.json，callApi 的 options.headers 覆寫或 null 移除。support/api-client.mts 統一傳輸，expect 留在測試，support 只處理環境／Header／占位值與報告。API 不需要瀏覽器；網頁 fixture 預設使用本機已安裝 Chrome，原生 fixture 需本機 Appium／已開機裝置，真實產品驗證仍須準備與執行。

獨立測試專案的登入專用案例需由使用者授權撰寫，保留 query／填入值與型別檢查；驗證 HTTP／GraphQL／token／帳號與合法狀態，token 不保存於檔案。

回應預覽使用 support/response.mjs 的 showResponse(response, testInfo)，在收到回應後、斷言前呼叫；登入案例已套用。終端與獨立 HTML／JSON 報告保留 HTTP status 及遮蔽後 body，JSON 案例可選 responses: [{ status, body }]，相容既有 schemaVersion 1；平台閱讀器可展開遮蔽後 response，原 JSON／HTML 也保留此欄位。token、密碼、認證、cookie、API key 及 message／stack 欄位遮蔽，Header／URL 不附加，非 JSON 只保留說明。規則不保證任意自由文字均無秘密；不得自行 console.log 原始回應。reports/ 已列入 .gitignore，已被 Git 追蹤的歷史檔案不會因此自動取消追蹤。只捕捉已收到的回應，傳輸失敗沒有 response。舊報告不會補上新資料。

custom reporter 將 test.step 實際結果或宣告的流程轉成 schemaVersion 1 JSON／HTML，檔名採 Asia/Taipei 日期時間。閱讀器支援 passed、failed、skipped，略過可保留先前完成步驟，不當作通過。原始錯誤與回應不回存，自訂 reporter 只輸出安全摘要；固定版本停用自動頁面快照，原始錯誤產物不保留，生成的請求與斷言錯誤只提供安全摘要；trace／video／screenshot 預設關閉。刻意在測試名稱或自行記錄秘密仍需作者避免。runId 與案例 hash 不代表部署版本或完整可重現快照。

舊三檔草稿遷移時先預檢，資料與斷言轉入 .spec.ts，原始案例／請求／fixture 及舊設定完整保存 legacy/pre-playwright/台北日期時間；自訂邏輯、非靜態引用或秘密常數保留待人工核對。不改產品來源、.env 或共用 Header。完整契約見[本機分析文件](docs/local-workspace.md)。手機圖文技能的 results.json 仍是獨立格式，未自動接入閱讀器。下方日期沿革為舊架構，不代表已遷移舊 DB 或 Android 能力。

僅尚未初始化、未完成設定且無已匯入知識時，自動顯示三步對話框：選擇前端、選擇獨立腳本位置、匯入 Agent 知識。可稍後設定，亦可從側欄重新開啟；完成狀態存於測試專案 knowledge/index.json；即使未按完成，只要專案已初始化或匯入資料，重載也不再自動開啟。第二步建立或連接專案，將來源及現行環境設定保存測試專案 .env，並在初始化／重新連接時補齊 Git 忽略；新專案初始化一律寫入空 `test-cases/catalog.json`，且對 `schemaVersion: 2` 且具備 `support/api-client.mts` 的專案在掃描後自動分批非覆寫產生 `api/*.ts` 與 `tests/api/*.spec.ts` 單支草稿。平台僅保存本機專案定位，立即套用；既有腳本、測試 .env 與 Header 保留。Windows 可開原生資料夾選擇器，亦可貼上絕對路徑。

分析頁以來源、腳本專案、知識數量的流程列與可展開腳本清單為主；提供「補齊缺少腳本」，以整份分析清單分批補齊、不受搜尋影響，保留既有檔案。建立狀態為「已建立腳本／尚未建立」，只代表檔案存在，不代表測試已撰寫或通過；詳情為獨立最右欄。資料夾設定、完整路徑、端點與分析證據按需展開。知識頁可分類、按適用功能編修，左側文件、右側內容預覽與編修，新增表單預設收起，無裝飾圖示。

知識上傳每來源最多 10 MB，每批 20 份、總共 20 MB；支援 MD／HTML／TXT／PNG／JPEG／WebP。原始文件與圖片保存 knowledge/sources，整理文字仍採每份 128 KB、最多 500 份的有效知識；索引 sources 與 README 連結保留原始證據。本機先略過完全相同內容與仍有效的原始來源處理紀錄；唯一高度相似且不超過 128 KB 的文字依本次上傳直接更新，沿用 ID／分類／功能，封存可還原。多候選、不足相似或新圖片仍交 AI；混合批次分析全部成功後一起套用。大型來源逐段分析，超過模型容量的現有知識先檢索候選再比對全文，未選中資料不刪除。圖片只認可見文字及版面，不推測動作或後端，強制標記用途未指定。知識頁可查看原圖及下載原檔；新增 POST /local-api/knowledge-source（id／sha256），同來源 session、路徑、大小與 hash 驗證。完整限制見網站 AI 文件。

專案知識、案例與實作各有權威來源；test-cases/catalog.json 保留固定功能／案例 ID、意圖、預期及具體問題，tests 用 archify-case 或明確路徑連結，關聯地圖由同一資料讀取產生。網站編修知識／案例，不修改或執行腳本、不呼叫模型。報告記錄腳本及相對依賴、案例意圖與知識指紋，舊報告版本未知，新內容不沿用舊通過；前端逐檔 hash 及請求契約差異標記待核對。入口、契約與限制見 [功能與測試關聯](docs/test-traceability.md)。

前端功能總覽現在可從來源路由／頁面／靜態可達 API 準備證據，交給本機 AI 依技能輸出提案，驗證來源／案例版本後備份合併；提案支援 MECE 4 級架構（`level` 1~4、`parentId`、L2 上限 6 個、其餘上限 8 個、禁止同層重複命名與步驟式命名），總覽圖遇單一無直接來源或案例的 L1 系統節點時將其名稱提升為根節點並省略重複外殼，群組父層依子功能彙整綠（充分）／黃（部分）／灰（已廢棄下線）覆蓋標記（尚未建測試的群組以中性「分類／尚無案例」框線呈現、紅標留給未測葉功能），地圖頂列與詳情面板提供返回與階層麵包屑導覽、點擊群組節點可繼續展開子功能分支，畫布底部提供懸停／聚焦完整名稱讀數列，側欄依 `parentId` 縮排並以資料夾／空心圓區分群組與未測葉功能（移除整排紅點與 `0`），功能側欄與主導覽皆可獨立捲動（置頂搜尋且隱藏捲軸）並支援群組資料夾預設展開、收合／展開跨重載記憶（不顯示展開／收合文字、搜尋不遮蔽），僅尚有未連結腳本時顯示「尚未分類（N）」而將「手動分析工具」移至右側主區底部採 1→2→3 步驟卡片與收合任務原文呈現，並將跳轉／關聯連線分層切換；「測試清單」納入子樹案例、顯示所屬功能與來源變更／問題摘要並於切回地圖時保留選中案例，另提供排除純容器誤報的「缺口與覆蓋報表」（含測試金字塔佔比、孤立案例待清理清單與 PRD／知識追蹤）及 `decisionTable` 決策矩陣表編輯檢視。缺測或部分覆蓋功能可直接複製整合黃金 3 步減重原則的 AI 補齊草稿任務。首次完整建立來源位置 hash 與知識 revision 基準；之後無變更略過模型，依異動檔案、頁面遞迴依賴及既有功能歸屬縮小 AI 輸入並保留其他功能。路由／解析設定／知識變更或無法界定影響時完整分析；來源仍讀檔 hash 核對，同來源 hash 重用靜態證據及服務內 API 解析快取。全部功能不依賴先有測試，產品頁面／API 與單支／Flow 測試分層，未分配與業務問題明示；網站已有「AI 分析功能」入口，不再要求外部對話代做。詳見 [前端功能總覽](docs/frontend-feature-overview.md)。

測試流程共用 catalog，但以案例 target 明確分類：api 為 API 流程，web／mobile／mixed 為畫面流程；kind: flow 可搭配 target: api 表達多 API 串接。舊案例缺 target 時，先依 tests/ui、web、mobile 路徑推定畫面，再依 tests/api、flows 或 kind: api 推定 API，其餘列待分類並提示補齊，不自行改寫檔案。新初始化複製的 AGENTS、案例格式及規劃／實作 skills 均要求明確填 target；既有專案不自動覆寫自訂指引，需定向同步分類規則。

測試流程（?view=flows）為唯讀案例表格，採四欄橫向步驟矩陣（案例／功能｜測試步驟｜使用資料｜預期結果）分組呈現每個案例的逐步操作、步驟使用資料與逐步預期；前置條件、整體預期與清理方式精簡置於該案例末尾橫向摘要列，長篇歷史文字以原生 `<details>` 折疊按需展開。僅保留重新讀取與測試專案位置，不提供新增、編輯、確認、任務複製、文字篩選或舊流程檔入口。功能地圖（?view=catalog）的「測試流程」層採用多列網格排列案例（依案例數 1~4 欄折行，高密度案例群組不再單列無限向右拉長），初始載入於密集節點時以可讀倍率開啟並可點「適合視窗」縮放總覽。POST /local-api/case-plans 只讀取並驗證 test-cases/catalog.json，不掃描或執行測試、不讀取舊確認檔；案例格式、版本與既有內容保留。規劃與實作全在本機專案使用 plan-test-cases／implement-tests skill 完成，知識不足在本機對話集中詢問。cases:check 預設只檢查資料完整性（步驟物件支援選填 `data` 與空白 `expected`，須保留整體 `expected`），status ready 不代表核准或產品通過；--review 及舊確認端點／檔案僅保留相容，不作實作前置條件。測試報告維持 ?view=reports。

## Android 批次結果查詢中斷處理（2026-10-30）


文件版本：1.69

最後更新：2026-11-12

> 閱讀定位：本文件保留既有日期式功能沿革；部分章節含明示取代關係，請與相關專題文件及程式交叉核對。歷史模擬與驗證紀錄不代表目前 VM 或真實系統已部署驗收。文件分類見 [文件總索引](docs/README.md)。

## 修訂紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| 1.69 | 2026-11-11 | 功能地圖優化階層瀏覽與測試清單上下文：總覽摺疊單一無直接來源或案例的 L1 系統節點並彙整群組子功能覆蓋率，新增群組分支鑽研、頂列與詳情返回／階層麵包屑、節點懸停／聚焦完整名稱讀數列、側欄樹狀縮排／移除紅點與 `0` 噪音／獨立捲動及可收合記憶資料夾，測試清單納入子樹與來源變更／問題摘要並於切回地圖時保留選中案例，缺口報表排除純容器誤報；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.68 | 2026-11-11 | 工作區設定與首次引導前置第 1 步「AI CLI 設定」（四步守衛與 `.local/ai.json` 非秘密暫存），支援切換 Codex／Claude Code／Gemini、模型下拉／自訂選擇與直接儲存，側欄與功能地圖顯示目前 AI／模型，新增 `ai-inspect`、`ai-test`、`ai-settings` 本機契約；功能地圖與工作區錯誤／AI 分析進度改採頂端置中 3 秒自動退場浮動 Toast（不設關閉按鈕），並為各 AI 分析任務改用嚴格 JSON Schema 與容錯解析；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.67 | 2026-11-11 | 案例規劃 `steps` 擴充選填 `data`（使用資料）且前置／輸入步驟允許 `expected` 留空，測試流程表格（`?view=flows`）改為四欄橫向步驟矩陣並以原生折疊收斂長文，功能地圖「測試流程」層改採多列網格排版及可讀初始縮放；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.66 | 2026-11-11 | 新專案初始化（`initialize()`）一律寫入空 `test-cases/catalog.json`（不複製 `test-project/` 參考案例），且 `setup()` 於新版專案掃描後自動非覆寫產生單支 `api/*.ts` 與 `tests/api/*.spec.ts` 草稿；未改路由、守衛、導向、API 端點、GraphQL payload 或 DB schema。 |
| 1.65 | 2026-11-11 | 初始設定第一步點選「本機資料夾」直接開啟置頂前景 Windows 資料夾選擇器（移除「選擇前端專案」按鈕與開啟中提示橫幅，保留路徑欄），重開／連線中斷時中止舊選擇程序；第三步改以單一頂端橫幅 toast 顯示知識整理進度並於完成後消失；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.64 | 2026-11-11 | 補齊灰色已廢棄／孤立分流、雙向缺口與測試金字塔報表、`factor` 測試因子與 `decisionTable` 決策矩陣表，並將黃金 3 步減重、L2 上限 6 與禁步驟命名納入驗證及 AI 引導；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.63 | 2026-11-11 | 清理未引用上游範例／設計庫與壓縮包，根目錄 workspaces 調整為 apps/web 與 test-project（移出 services/control-api 並移除舊服務腳本），功能地圖加入 L1~L4 層級／分支上限與紅黃綠覆蓋率標註；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.62 | 2026-11-10 | 報告共用圖文產生器，網站隔離呈現與圖文下載，補具體預期及安全診斷。報告 JSON 增加可選預期／實際／診斷，未改路由、守衛、導向、API 端點、產品 API、GraphQL payload 或 DB schema。 |
| 1.61 | 2026-11-09 | 新專案統一逐操作網頁截圖、共用 fixture 檢查與容量分卷，報告 JSON 新增 volume／volumes／evidencePart。未改路由、守衛、導向、既有 API 端點、產品 API、GraphQL payload 或 DB schema。 |
| 1.60 | 2026-11-09 | 修正測試 CLI 單檔路徑被解析為 project 的問題，固定使用等號參數。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.59 | 2026-11-09 | 測試框架新增逐步終端進度、逐案報告快照及 web 等待上限，定向同步外部專案清理限制。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.58 | 2026-11-09 | 新增 view=scripts 測試腳本唯讀清單及 POST /local-api/scripts，顯示實際檔案數與內容判讀、分類及限制。新增入口與本機 API，未改既有守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.57 | 2026-11-09 | 現行工作區環境設定保存測試專案 .env，初始化及重新連接補齊 Git 忽略；平台僅保留排除 Git 的測試專案定位。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.56 | 2026-11-09 | 測試流程依 target 明確分類，舊案例保留相容並提示待補，初始化 AI 指引同步。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.55 | 2026-11-09 | 文件完全重複可略過模型，唯一高度相似文字依本次上傳直接更新並封存；AI 工作結果增加略過及直接更新數。未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.54 | 2026-11-09 | 功能圖加入依賴範圍增量分析、無變更略過模型及解析快取，路由／知識或不明影響回退完整分析。本機 AI 工作結果增加分析模式與頁數；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.53 | 2026-11-08 | 新建測試專案附 setup-android skill，提供官方下載、Google Play AVD 與本機設定指引，不配送 SDK／裝置資料。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.52 | 2026-11-08 | 初始設定改全頁三步守衛、Git／本機選擇與單一 PRD 上傳；新增 clone-source 本機契約及完成條件。改進入守衛，未改路由名稱、產品 API、GraphQL payload 或 DB schema。 |
| 1.51 | 2026-11-08 | 報告頁固定目前專案，進入／分類切換自動讀取最新結果，移除匯入與目錄操作，歷史及畫面設定收合。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.49 | 2026-11-08 | 報告 API／畫面分類、可選截圖及 TXT，加入本機網頁／Appium fixtures 與受控環境端點；未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.48 | 2026-11-08 | 加入 10 MB 知識來源、圖片辨識、分段整理與原始資產預覽／下載；新增 knowledge-source 本機契約，未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.47 | 2026-11-08 | 測試流程簡化為唯讀表格，新增 case-plans 唯讀契約，本機 skill 不再要求網站確認；沿用 view=flows，未改產品 API、GraphQL payload、守衛、導向或 DB schema。 |
| 1.46 | 2026-11-08 | 測試流程改為案例規劃表，共用 catalog 與版本確認記錄，新增 case-confirm 本機契約及兩個本機 AI skill；未改產品 API、GraphQL payload、守衛、導向或 DB schema，沿用 view=flows。 |
| 1.45 | 2026-11-08 | 導覽分開測試流程（view=flows）與測試報告（view=reports），各自篩選檔案並拒絕錯誤種類；補充 LINE OA 知識邊界。未改守衛、產品 API、GraphQL payload 或 DB schema。 |
| 1.44 | 2026-11-08 | 新增知識簡化為選檔即自動 AI 分類、去重與更新，移除手動分類、功能編號、文字輸入及 AI 開關；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.43 | 2026-11-08 | 改為網站按鈕啟動受控本機 Codex 功能／知識分析，支援 HTML、語意去重取代及可還原封存；新增 AI 工作／狀態／取消／還原本機契約，未改產品 API、GraphQL payload、頁面路由、守衛或 DB schema。 |
| 1.42 | 2026-11-08 | 新增前端功能證據包、本機 AI 提案驗證及版本核對套用，總覽與產品／測試分層；新增 frontend-features-prepare／apply 本機契約，未改產品 API、GraphQL payload、守衛、DB schema 或既有頁面路由。 |
| 1.41 | 2026-11-08 | 依使用者校正改為預設 SVG 節點連線地圖，支援縮放平移、節點拖曳與按需詳情；測試清單獨立，表單收斂且技術編號自動產生。未改產品 API、GraphQL payload、守衛、導向、DB schema 或既有本機 API 契約。 |
| 1.40 | 2026-11-08 | 新增專案知識分類編修、固定案例目錄、腳本關聯地圖與依賴／意圖版本提示；新增 catalog／knowledge-update 本機契約及 view=catalog／knowledge 入口，未改產品 API、GraphQL payload、守衛或 DB schema。 |
| 1.39 | 2026-11-07 | 改用 api 請求模組與單支／流程測試分層，新增配對生成、共用呼叫契約與明確備份遷移；本機 generate 回傳新增 apiModules，未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.38 | 2026-11-07 | 加入明確附加的 HTTP／JSON 回應預覽與敏感欄位遮蔽，reports 維持 Git 忽略；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.37 | 2026-11-07 | 新專案內建 TypeScript、Node 型別與 BFF 宣告及 check:types，現有專案明確升級不覆寫自訂設定；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.36 | 2026-11-07 | 記錄獨立專案第一支登入驗證實際案例及驗證邊界，其他草稿不變；未改平台路由、守衛、導向、API payload、GraphQL payload 或 DB schema。 |
| 1.35 | 2026-11-07 | 新增全清單補齊缺少腳本及明確建立狀態，詳情獨立固定右欄；分批沿用非覆寫生成契約，未改路由、守衛、導向、API payload、GraphQL payload 或 DB schema。 |
| 1.34 | 2026-11-07 | 通用／匿名 GraphQL 名稱改取頂層實際欄位作檔名與顯示名，支援 alias／fragment 與碰撞；舊檔仍辨識，未改路由、守衛、導向、產品 GraphQL payload 或 DB schema。 |
| 1.33 | 2026-11-07 | 新稿只保留請求資料及最小略過標記，不產生通用 scenario、步驟或斷言，由 AI 後續撰寫；保留 query／variables，未改路由、守衛、導向、API payload、GraphQL payload 或 DB schema。 |
| 1.32 | 2026-11-07 | GraphQL 草稿帶入前端呼叫的 variables 結構及非秘密常數，動態／衝突值保留占位符，query 多行顯示；保留 GraphQL 變數引用，未改路由、守衛、導向、API 契約或 DB schema。 |
| 1.31 | 2026-11-07 | 合併重疊分析讀取並等待既有檔案操作，修正開發模式重複載入誤報忙碌；寫入仍拒絕重複送出，未改路由、守衛、導向、API payload、GraphQL payload 或 DB schema。 |
| 1.30 | 2026-11-07 | 新增來源同步索引、消失腳本候選與確認封存／非覆寫還原；新增本機 archive-removed、restore-removed 契約，未改路由、守衛、導向、GraphQL payload 或 DB schema。 |
| 1.29 | 2026-11-07 | 已初始化或匯入資料時不自動開啟引導，介面改以專案流程、精簡腳本列及知識雙欄預覽為主；本機 config 新增 knowledgeCount，未改路由、守衛、導向、GraphQL payload 或 DB schema。 |
| 1.28 | 2026-11-07 | 加入三步工作區設定與獨立專案 Agent 知識庫，新增本機設定／知識契約與知識庫導覽；未改既有路由、守衛、GraphQL payload 或 DB schema。 |
| 1.27 | 2026-11-07 | 新稿改為單一原生 Playwright .spec.ts，接入略過／實際步驟報告並保留舊稿；初始化格式升為 2，本機 caseFile 指向新格式，未改路由、GraphQL payload 或 DB schema。 |
| 1.26 | 2026-11-07 | 改用 BFF_BASE_URL、台北日期時間報告與操作名稱檔案，加入 Playwright 圖文報告技能；本機分析新增 caseFile，未改路由、GraphQL payload 或 DB schema。 |
| 1.25 | 2026-11-07 | 現行畫面用語改為中間層，獨立專案新增共用 Header 與個案覆寫／移除；未改路由、守衛、導向、HTTP 契約、GraphQL payload 或 DB schema。 |
| 1.24 | 2026-11-07 | 加入 .env 控制的本機來源分析、獨立測試專案初始化、單點 API 草稿與報告目錄讀取；新增 /local-api 契約與分析導覽，未改既有 API、GraphQL payload 或 DB schema。 |
| 1.23 | 2026-11-07 | 預設入口改為無後端的本機流程／報告閱讀器，加入獨立測試專案；替換原入口與後端守衛，不再進入舊導覽，未改既有 API、GraphQL payload 或 DB schema。 |
| 1.22 | 2026-11-03 | 總覽新增右側最近三筆執行時間線與 80px 原創白瓷角色，維持深色 compact 系統；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.21 | 2026-11-03 | 全站改用 GitHub 式深色語意 token，總覽縮為 compact 與 64px 灰階角色，PDF 保留白底深字；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.20 | 2026-11-03 | 總覽參考 GitHub 精修工具列、分層表面及圖例對齊，保留原有結果資訊；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.19 | 2026-11-03 | 總覽改為結果分布圖與狀態結論，統一桌面 14px 內文並建立 Design System；未改路由、守衛、導向目標、API、GraphQL payload 或 DB schema。 |
| 1.18 | 2026-11-03 | Web 編輯頁文字與聊天樣式對齊 Appium 緊湊控制項，保留獨立案例對話及建議流程；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.17 | 2026-11-03 | Web 案例名稱列改用返回圖示並對齊名稱與操作，窄螢幕可換行；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.16 | 2026-11-03 | Web Playwright 改為 Appium 式畫面優先入口，案例／設定預設收起，移除舊版 Web 草稿且保留 Android；未改路由、守衛策略、導向、API、GraphQL payload 或 DB schema。 |
| 1.15 | 2026-11-03 | Web Playwright 入口改為本機案例工作台，提供 AI 腳本建議及批次情境估算，外部瀏覽器尚未接入；未改路由、守衛策略、導向、API、GraphQL payload 或 DB schema。 |
| 1.14 | 2026-11-03 | 移除單點 API 內重複的執行紀錄分頁，集中於側欄執行紀錄；未改路由 ID、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.13 | 2026-11-03 | 一般案例聊天改依專案與案例 ID 隔離，新案例開啟空白聊天室；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.12 | 2026-11-03 | 品質報告及 PDF 保留 Android 失敗子步驟上下文與遮蔽後 Appium 訊息，擴充報告事件 metadata 及 worker trace 訊息上限；未改路由、守衛、導向、GraphQL payload 或 DB schema。 |
| 1.11 | 2026-11-03 | 執行紀錄只列單次執行，批次集中於品質報告並採左資訊右操作列；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.10 | 2026-11-03 | 新增人工固定 API 案例版本轉換端點，保留原腳本歷史，以既有發送器執行；新增 REST payload，未改既有路由、守衛、導向、GraphQL payload 或 DB schema。 |
| 1.9 | 2026-11-03 | 釐清 Playwright Runner 的內建 Smoke 網址與網路隔離，外部 API 撰寫改指向既有 API 流程；未改路由、守衛、導向、API 結構、GraphQL payload 或 DB schema。 |
| 1.8 | 2026-11-03 | Test Case 撰寫要求具名 test.step，讓 API 操作及斷言對齊流程預覽與 Runner；未改路由、守衛、導向、API 結構、GraphQL payload 或 DB schema。 |
| 1.7 | 2026-11-02 | TC 改用獨立序列，既有第一筆有效 TC 由 000001 起算，FC 與歷史快照不變；新增 DB 欄位及序列，未改路由、守衛、導向、API 結構或 GraphQL payload。 |
| 1.6 | 2026-11-02 | Test Case 撰寫接入同專案已保存 API 證據與非秘密認證對應，新增 /api/llm 選用 projectId；未改路由、守衛、導向、GraphQL payload 或 DB schema。 |
| 1.5 | 2026-11-02 | 自動化 Flow Case 使用 FC，腳本 Test Case 保留 TC；沿用數字識別與歷史快照，未改路由、守衛、導向、API 結構、GraphQL payload 或 DB schema。 |
| 1.4 | 2026-11-02 | 案例內容與流程預覽分層，技術證據及流程操作預設收合；保留原始預期與腳本，未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.3 | 2026-11-02 | 腳本案例庫的既有案例編輯提供返回案例庫及未儲存確認；導向沿用 cases 頁面，未改路由 ID、API、GraphQL payload 或 DB schema。 |
| 1.2 | 2026-11-02 | 接入 Agent 前端草稿／名稱自動同步、業務預覽、正式案例編碼／分類／證據與匯出、持久修正 inbox；擴充 REST payload 與 DB schema，未改路由、守衛、導向或 GraphQL payload。 |
| 1.1 | 2026-11-02 | 新增 Android Agent 後端草稿 metadata、人工命名保護、驗證 hash 與持久需求紀錄，前端同步及正式案例欄位尚未接入；擴充 Agent REST payload，未改路由、守衛、導向、GraphQL payload 或 DB schema。 |
| 1.0 | 2026-11-02 | 建立文件治理版本與閱讀定位，保留既有功能沿革；未修改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |

E2E 批次元件改由 App 層的 E2EBatchHost 保留，各已開啟專案保有自己的批次頁。應用程式內切換至手機、報告、總覽或其他專案只隱藏批次頁，不卸載其結果輪詢與接續迴圈；返回時保留選取、順序、進度與通知。已重現舊路由卸載造成第一個完成後不送第二個的路徑，並以模擬執行器驗證修正。這不代表網頁重新整理、關閉瀏覽器或 App 本身卸載後仍能續跑；後端整批排程尚未實作。

已接受的案例只以同一執行 ID 查詢結果。查詢遇到短暫連線錯誤、408、429 或 5xx，保留該案例並重試唯讀查詢，連續失敗最多等待 20 秒；單次查詢逾時 4 秒，成功後重置等待期限。不得重送手機操作。確認第一個案例成功後才接續建立第二個。無法確認結果或下一案例遭拒時，原頁持續顯示已完成數、相關案例與中斷原因，不只依賴自動消失通知。此修正不代表已確認歷史批次的中斷原因，也不將尚未送出的案例計為執行成功；批次仍由前端接續，關閉或重新整理網頁後續跑尚未實作。

## Android 對話自動撰寫與重跑驗證（2026-10-30）

使用入口沿用 Android Appium 的模擬器，選手機與 Flow Case 後按案例編輯，在左側案例對話窗描述測試目標與預期結果。操作設定「讓 AI 操作手機、產生腳本並重跑驗證」在此入口預設勾選；關閉後沿用只建議腳本的模式，不另建對話區。操作 Agent 草稿輪詢後自動同步到頂部名稱、右側業務內容／流程預覽及下方全寬 TypeScript 編輯器，不再逐次按套用；提問在同一聊天回答。正式案例仍由頂部單一儲存按鈕保存，其他純腳本建議模式維持原比較／套用。

任務草稿 metadata 與步驟共用 revision，支援標題、目的、前置條件、資料參照、預期、清理與來源；模型命名記為 agent，人工名稱記為 user 並拒絕模型覆寫。既有未標來源的非空名稱視為人工，新的空名稱可自動命名。前端拒絕過期版本／來源覆蓋手動程式碼。正式版本以同交易保存 metadata、名稱、腳本，服務端依 caseType 配置穩定代碼（Flow Case 為 FC、Test Case 為 TC，TC 使用獨立序列，既有有效 TC 依原號排序回填由 1 起算且之後不因刪除重排；FC 沿用原號，bootstrap 同步套用於目前案例，歷史版本及執行快照不改寫）並依單層分類樹驗證／沿用或建立分類；後續手動移動不被未變更的舊建議拉回。案例庫可匯出 CSV，保留來源案例、GAP 候選與未知證據；不因填完或執行通過升成正式成熟度。

任務驗證另保存執行語意 hash，排除標題及分類建議；純 metadata 改名保留精確 source 與既有驗證，業務預期、資料／來源或流程變更則失效。自動完成同時核對 source、hash 與實際 passed；失敗修復也不能刪改原 metadata 預期。正式版本引用任務證據時服務端核對 owner、案例、revision、精確來源與 hash，不信任客戶端傳入的通過結果；保留 taskId／平台／裝置證據，不偽造 Runner runId。

持久 instructions 保存建立／接續需求，不受近期聊天裁切影響，超過 100 筆或總共 100000 字拒絕追加。修正先保存 inbox 再回接收成功，任務 checkpoint 後才消費，重啟維持 uncertain 並在明確接續時去重合併。另保存階段、有證據 ID 的 facts／unknowns／nextAction、30 分鐘及 300 個工具預算；不是可自動證明任意 App 副作用合法的授權策略，後端批次排程仍未實作。新增 scripts.case_number 及 android_agent_inbox migration 尚未在真實 PostgreSQL 部署驗收。契約、相容性與限制見 [Android Agent 自主案例撰寫](docs/android-agent-authoring.md)。

既有 Android Agent 執行通道經 MobileEngine adapter 包裝，保留原擁有權及裝置鎖，不另建競爭租約；新增 schemaVersion 1 的 Android／iOS target 型別邊界，iOS 尚不接收派送。Mac 可先跑唯讀環境檢查，Simulator 只用自有 App 的模擬器版本；正式 LINE／LIFF 手機流程仍需 iPhone。agent-device、Mac Worker、iOS 串流及跨平台實機驗收仍未完成，見 [Mac 與 iOS 前置環境](docs/ios-mac-setup.md)。

對話探索要求帶 autoVerify:true；後端預設 false 以相容既有任務。自動模式下，草稿必須有變更與結果斷言，且目前來源與實際 passed 驗證來源完全一致，才可完成。修改草稿後先前驗證失效，不能以純說明繞過。AI 根據最新觀察恢復起點再驗證，不從任意結束畫面直接重送有副作用的流程；未知資料、敏感輸入及無法確認的重跑副作用才詢問必要資訊。

驗證失敗事件保留 failed 狀態，將實際步驟證據交回模型局部修復；每輪最多三次重跑，超過後保留草稿與失敗結果並停止，不假裝通過。修復保留第一次失敗草稿的斷言預期與分支位置，可修定位器、名稱及等待；不得移除斷言或改成可選分支。這是結構檢查，不能證明兩個不同定位器具有相同業務語意。

scrollUntilVisible 的 timeoutMs 改為整個搜尋的總預算，預設10秒，每輪最多等待1秒；maxSwipes 仍生效。不再把每輪 timeoutMs 相乘到接近整體流程期限。耗時紀錄增加 stepTimings，含步驟路徑、名稱、動作、狀態與耗時，不記錄輸入內容或定位器。

需要同步部署 VM Control API 並重新啟動 Windows worker，前端重新整理。程式與模擬模型/手機測試不代表 LINE 業務實機驗收，也不代表 VM 已更新；部署驗證狀態另見 apps/web/ANDROID-AUTOVERIFY-VERIFICATION.md。

## E2E 交錯 API 流程（2026-10-30）

Flow Case 撰寫頁可勾選已儲存 API 流程，在 before、steps、after 及群組分支任意位置插入 apiFlow 固定版本引用，並編輯本次 inputs、請求參數、斷言、回應擷取及授權變數；不修改共用流程的方法、路徑與環境。現有引用可編輯或移除，第一版以 JSON 編輯，尚無圖形化變數挑選器。

建立執行時解析及凍結 API 流程/案例版本、覆寫與 schema，worker 在正確步驟透過受配對工作階段保護的內部橋接執行伺服器 API。token 與 API 輸出僅留本次記憶體，不跨案例、不回存環境秘密庫、不下發手機、不寫入執行報告；輸出使用 namespace_名稱供後續 API 引用，手機變數可透過 inputs 傳入。API 不接受 actor，不代替雙機畫面斷言。API 失敗停止後續主流程，after 仍嘗試執行；GET/HEAD 可有限輪詢，寫入不重送。既有單次傳輸逾時仍適用。

前端、Control API、Windows Android worker 需同步更新重啟；apiFlows 能力未確認時拒絕含 API 案例。Agent 探索工具本身不直接呼叫 API。執行時間線呈現 API 結果與耗時，失敗附案例序號與 HTTP 狀態，不保存原始回應。此節取代下方歷史「API資料驗證仍暫緩」描述。細節見 docs/e2e-api-flow.md。本機模擬與回歸不代表 VM 部署或真實手機/後端整合驗收。

## 共用流程覆蓋與指定位置插入（2026-10-30）

「套用共用流程」預設為插入。使用者可選前置、主流程、清理流程每個步驟之前或列表最後，也可插入條件分支、optional、repeat、while 等內部步驟；位置以完整路徑及步驟名稱呈現。只在選定區段插入 callFlow 固定版本引用，保留其他流程、變數與定義，同一版本可依需要在不同位置重用，每個列表最多300步。多機插入單機共用流程必須選手機角色；雙機共用流程使用其內部角色。

覆蓋模式先明示取代前置、主流程、清理、變數及共用定義，App 套件與單機／雙機設定改用所選流程。產生只含固定版本引用的新主流程，保留案例名稱與對話，變更先留在草稿；取消不修改原稿，仍使用頂部儲存按鈕保存。

跨 App 的 callFlow 會在所選角色手機切換至共用流程 appPackage 並確認前景後，執行共用流程；結束後返回呼叫端 appPackage 並確認前景，主流程、清理或切換失敗不能判通過。切換失敗時不執行該共用流程的操作與清理，但仍嘗試返回；巢狀引用逐層返回。切換與檢查記錄在 trace，前置／返回斷言不計為主流程斷言。此能力需更新 control-api 及 Android worker，不代表既有執行器已部署新版本。

## 共用流程的手機角色綁定（2026-10-30）

不綁角色的單機共用流程在單機案例中自動使用唯一手機；套用至雙機案例時必須從目前案例的角色選擇操作對象，未選前不能套用。同一固定版本可分別套用給發送者與接收者，新增引用依套用順序放在前置流程尾端。雙機共用流程保留內部角色，不指定單一手機。

既有 callFlow 引用在雙機案例提供角色設定，涵蓋 before、steps、after、巢狀群組及 routines。從單機改成雙機時不猜測角色、不變更引用版本；無角色的單機共用引用標示待指定。routine 內引用可繼承呼叫步驟角色，不因定義本身沒有角色就誤報。儲存與建立執行前均由服務依固定版本解析依賴，拒絕缺少角色或不相容的多機引用；跨 App 引用按上方切換規則處理；巢狀共用流程繼承角色到前置、主流程、條件及清理。實際裝置綁定沿用既有執行器檢查。

## 雙機案例編輯與 AI 手機切換（2026-10-30）

模擬器內的案例編輯提供 A 發送者、B 接收者配對及查看 A／B；切換同步右側手機與聊天任務的 serial、bindings、activeActor。任務執行途中收到切換時，先完成正在送出的單次操作，丟棄舊畫面上尚未送出的模型決策，再釋放工作階段、清除目前畫面與圖片並要求重新觀察；不重送操作。AI 可用 switchActor 切換已配對角色，操作紀錄保留 actor，觀察證據帶角色及手機標記。

局部修改允許 configure actors，仍須在同一 patch 通過完整格式檢查：所有裝置步驟／條件有角色，兩角色都有主流程斷言。不得以未呼叫 routine 或發送端返回代替接收端驗證。聊天驗證沿用既有雙機 Appium 執行器，核對不同、已就緒且屬於使用者的手機，驗證期間保留兩台裝置；只有實際結果可判通過。此項本機模擬 API 與程式測試不代表 LINE 收件／點開的實機驗收，也不代表 VM 已部署。

## Flow Case 結構預覽（2026-10-30）

案例業務內容先呈現目的、預期結果、前置與資料還原，編碼放於案例內容標題旁，待確認事項保持可見；來源案例、分類建議、資料參照與需求／證據來源預設收於「技術與證據」。原 metadata 文字完整保留，不以呈現邏輯猜測或重寫業務預期。API 與共用流程功能收於測試流程標題下的「流程操作」，原插入／抽取／覆蓋對話框及停用條件維持。流程展開使用箭頭與 aria-expanded 表達，主流程、前置與清理的群組結構不變。

案例撰寫的流程預覽以 TypeScript AST 靜態解析，按 before、steps、after 分開呈現，不再將原始碼中的所有 name 欄位攤平成執行順序。標題計算主流程頂層步驟數，repeat、while、optional、if 以可展開群組保留子步驟及條件語意，不宣稱條件路徑實際執行或通過。call 僅在呼叫位置展開 routines，沒有被流程引用的定義另外收合，明示沒有安排執行；callFlow 顯示固定版本引用，內容仍由執行前依賴解析取得。缺少定義、循環或過深結構顯示原因，無效來源不回退成文字搜尋結果。這是唯讀預覽修正，不改案例來源、儲存、雙機綁定或執行判定。

## 共用前置流程撰寫入口（2026-10-29）

Flow Case 的流程預覽提供「抽成共用流程」及「套用共用流程」。抽取從主流程開頭到指定步驟，至少保留一個案例專屬步驟；輸入名稱後先透過既有 scripts API 儲存獨立 Flow Case，成功才將原步驟替換為 `callFlow` 固定版本引用。保留原流程的 before、after、variables、routines 與角色設定；抽出的流程攜帶 variables、routines 與角色設定，仍須通過伺服器既有格式及主流程斷言檢查。不自動儲存原案例，失敗不修改原草稿。

套用前置流程從其他已儲存 Flow Case 選擇，可展開檢視內容，使用實際 ID 與版本新增至 before 最前方，不複製步驟、不追蹤最新版。套件不符、手機角色不相容、同版本同角色重複套用時拒絕操作；單機流程用於雙機案例須選擇角色。同名 variables 沿用執行器既有覆寫規則。使用者仍以案例頂部儲存按鈕保存修改；主流程必須有自己的有效斷言，前置成功不能當作案例通過。

前端以延遲載入 TypeScript AST 讀取靜態定義，不 eval 或執行來源。執行沿用既有依賴解析、循環及深度檢查、固定來源快照與結果紀錄；沒有新增 VM API 或 worker 協定。瀏覽器驗證使用模擬 API，不代表 LINE 官方聊天室實機驗收或 VM 部署完成。

## 品質報告的執行入口限制（2026-10-29）

只有 E2E 批次執行入口的 Android 案例會產生品質報告；即使只選一個案例，也保留明確批次身份。Appium 模擬器頁不論單筆或連續執行多個案例，都只進入執行紀錄，不轉成報告列。共用元件預設 executionOrigin=appium，E2E 批次頁明確指定 e2e-batch，由 API 在建立紀錄時凍結；同一 requestId 不可更改入口。

操作用 batchId 仍可支援 Appium 共用工作階段，不能僅依該 ID、案例數或名稱判斷是否產生報告。品質報告查詢、改名及整批刪除只處理明確標記 e2e-batch 的 Android 紀錄。未記錄入口的舊 Android 資料留在執行紀錄，不推測為報告，不刪除資料。此次需同步更新前端與 VM API，無需 Windows worker 變更。

## 品質報告文字 PDF（2026-10-29）

Android 品質報告展開失敗案例時列出失敗子步驟及已保存的 Appium 訊息，事件保留 path、action、phase、actor、durationMs，PDF 步驟表同樣呈現。Worker 將 Driver message 遮蔽命令字串參數、引號內容、URL、常見秘密與 Email 後截斷至 1200 字，不保存完整回應與 stacktrace；trace message 上限改為 1500。遮蔽屬規則處理，不能保證辨識任意第三方文字的所有敏感語意。既有未保存詳細訊息的紀錄不可回補，無子步驟時明示未保存。需先更新 Control API，再更新 Android worker 與前端；未驗證真實裝置與部署。此證據不自動診斷偶發失敗，也不改等待、重試或操作行為。

品質報告列表內建刪除入口，不僅限於版本紀錄的嵌入報告。刪除使用共用確認視窗，清楚說明會移除報告及相關執行紀錄，保留案例與腳本版本；取消或失敗保留報告，失敗可重試，進行中的報告不可刪除。沿用既有 execution-versions API，成功後舊輪詢結果不得使報告重新出現。

報告文字使用獨立共用字級 token：內文 13px、標題 15px；PDF 換算為 9.75pt／11.25pt，避免直接把 px 當 pt 放大。網頁報告標題與內容採相同字級，不改動其他工作區的全域字級。

前端品質報告下載使用真正的 PDF 文字與向量表格，取代整頁 Canvas／JPEG 匯出；內容可以選取、複製及搜尋。結果摘要與案例總覽採表格，各案例保留步驟、失敗說明、來源及 Git 資訊，不由 AI 補寫結果。長文字換行、超長表格列可跨頁，續頁重複表頭並保留頁碼；標題須與後續內容同頁開始。

Inter 與 Noto Sans TC 的 400／500 開源 TrueType 字型隨前端部署並嵌入 PDF，不依賴閱讀端已有中文字型，也不把報告傳給第三方。字型載入失敗可重試，不改以圖片冒充文字；未支援的字元會明示錯誤。完整字型嵌入會增加首次下載負載及 PDF 大小，匯出程式仍按需載入。舊的圖片版 PDF 不會自動改變，需重新下載。此次只需更新前端與 public/fonts，不需更新 VM API。

## E2E 批次品質報告（2026-10-29）

品質報告 API 納入有明確 batchId 的 Android／Flow Case 執行紀錄；新批次的案例於建立時共享 ANDROID-BATCH 測試版本。歷史逐案例版本依保存的批次 ID 分組供報告查詢，保留原始 testVersion 及腳本來源。前端版本紀錄保留 batchId／batchName，與品質報告使用一致分組。報告依已保存紀錄計數，不受手機清單最近 20 筆限制；未送出案例不能計為成功。Android 報告依使用者隔離，支援查看、既有 PDF 匯出、改名及整批軟刪除；執行中不可下載或刪除。

## 測試結果浮動提示（2026-10-29）

完成、失敗及結果未確認的提示採中性白底與完整細邊框，狀態透過小型語意圖示及原有標題文字傳達，不以整塊紅綠黃底呈現。提示固定於右下角，保留視窗邊距，桌面寬度上限為共用 toast token 的 28rem，窄螢幕縮至可用寬度。標題、摘要與關閉按鈕分開對齊；保留 7 秒自動消失、手動關閉與通知回查行為。鈴鐺清單不在此次視覺調整範圍。

## 模擬器效能策略（2026-10-29）

新啟動的模擬器預設使用 host GPU 模式，執行主機可用 ARCHIFY_ANDROID_GPU 指定 auto 或 software 相容備援；設定變更不清除手機資料，但須正常重啟 worker 及手機才能生效。Appium 新工作階段停用視窗動畫，畫面閒置等待上限為 1000 ms，套用於 Flow、Agent 與提示擷取。元素等待、結果斷言、期限及失敗清理不放寬，不能將設定完成當成效能或案例驗收通過。

## 手機連線重試（2026-10-29）

模擬器工作區提供「重試連線」，透過已配對且支援此能力的 Windows 執行器執行固定 ADB kill-server／start-server／devices 指令，重建畫面連線，不重開手機或清除 App 資料。ADB 讀取失敗時仍維持執行器控制心跳，手機標為離線且未就緒；回報成功只代表連線重設，不代表 Android 已開機或測試通過。

重試期間拒絕重複要求及其他手機指令。佇列、測試、Appium 或 Agent 尚在操作時禁止重設；其他使用者或無法確認歸屬的裝置存在時亦拒絕。短暫無裝置回報時保留既有歸屬，重連保留期有限，不能讓不同 AVD 因重用連接埠取得原歸屬。主機執行器未連線、版本不支援或 Windows 權限不足時明示原因，網頁不能代替啟動已停止的主機程序。

## 固定手機快速啟動（2026-10-29）

固定手機以可寫模式正常保存 Quick Boot 快照，於後續啟動交由 Android Emulator 嘗試恢復；首次啟動與無效快照仍可能完整開機。臨時唯讀多開不寫回共享快照。關機需等待裝置離線及程序退出，寫入未完成時不可重新開啟同一固定手機。快照不能保證第三方帳號有效性，也不等於實際啟動時間已驗證；本次未完成有效的耗時比較。

## Android 持續操作與測試草稿（2026-10-29）

Codex 連線的 Android Agent 改用 app-server 持續會話及單一受控 `android_action` 原生工具；每個任務保留自己的 thread，畫面、工具結果與使用者回答在同一會話接續。橋接只提出動作，由既有後端及 Android worker 執行，不能使用主機 shell、專案檔案或任意外部工具。停止、服務重啟或結果未知時不重送手機動作；重新接續先依任務紀錄觀察現況。其他模型連線保留既有 JSON 操作契約，尚未宣稱具備 Codex 相同的持續會話。

探索與 Flow Case 均新增 longPress、doubleClick 及以螢幕比例定位的 tapPoint／longPressPoint；探索工具的 doubleTap 對應 Flow doubleClick。長按預設 800 毫秒，允許 400 至 5000 毫秒。探索座標動作必須對應實際取得的截圖，且重新擷取的畫面結構及圖片指紋一致；無圖片時使用 XML 元素定位。優先使用唯一的實際 id、描述或文字；座標及序號 XPath 屬於較脆弱的備援。activateApp 可以開啟指定已安裝應用程式。執行器回報 agentProtocol:2，舊執行器須重啟後才能使用新增工具。

確認成功的操作自動附加至草稿的「Agent 實際操作紀錄」群組，保留原有流程與穩定步驟識別碼。模型依證據整理名稱、等待、分支及預期結果斷言；不能只有口頭宣告完成。交付 draft 必須有程式碼變更，新增實際動作需有新的結果斷言，未合併的操作紀錄會阻擋完成；概念回答可用 answer，但本輪已有成功手機操作時須交付對應草稿。這些完成檢查不等於業務驗證通過，只有實際 verify 通過才可回報通過。修改仍顯示在原有程式碼差異預覽，套用與儲存由使用者操作。

點擊與長按後先擷取畫面，未見標準 Android Toast 時再以短間隔唯讀擷取，不重送點擊。自訂提示或擷取時間窗以外的 Toast 仍可能無法捕捉，不能宣稱必定取得。XML 證據由後端保存及回查；截圖傳給支援圖片的目前模型，領取模型工作時也必須傳遞圖片。未要求保存預覽截圖，不產生預覽圖片檔。

## 統一版本與執行紀錄（2026-10-28）

版本與執行紀錄以同一列表按時間由新到舊顯示 Test Case、Flow Case、API 流程、目前專案 API 請求的單次執行。明確 batchId 的批次及其成員只在品質報告呈現，不放入此列表、版本選項或執行類型篩選。共用執行類型、測試版本及執行結果篩選，不另設 Flow Case 紀錄區。單筆預設收合，查看結果才展開步驟、回應、裝置及來源快照；品質報告保留完整批次分母、摘要及報告下載；列表採與單次執行相同的左側名稱／摘要、右側狀態與操作排列，以分隔線區分報告，窄螢幕自動換行。沒有記錄的版本或指紋不得補造。各來源讀取失敗須明示，保留其他來源及已讀取資料。

## Flow Case 執行入口與紀錄（2026-10-28）

模擬器畫面上方以「選擇 Flow Case」開啟浮動勾選選單，不推擠裝置畫面。案例列採緊湊高度，提供全選、取消全選與部分選取狀態，依勾選順序執行；雙機案例仍需指定不同的接收者手機。執行區不提供案例編輯、撰寫或舊草稿搬移入口，編輯維持在案例撰寫。完整結果、步驟、執行編號與腳本快照集中於「版本與執行紀錄」的 Flow Case 執行紀錄，模擬畫面僅保留本次進度與狀態。本節取代下方舊版獨立 Flow Case 分頁的入口敘述。

# Archify Test｜目前實作與介面規格

## 雙機角色流程與 Appium 專用撰寫（2026-10-28，更新下方單機限制）

Flow Case 可宣告 `actors: ["sender", "receiver"]`，每一步指定 actor，兩個角色各需至少一個斷言；沒有 actors 的既有單機案例仍可使用。執行頁依所選案例顯示發送者與接收者手機欄位，必須選不同、已就緒且屬於自己的手機。伺服器一次保留兩台裝置，來源版本、角色配對與步驟紀錄凍結在 android_runs JSON 快照。兩個 UiAutomator2 session 使用獨立 systemPort，先啟動相同 appPackage，再依步驟交錯執行。斷言依實際狀態等待，單步最多10秒，整體執行預算5分鐘（另有清理時間）；失敗停止，清理兩邊，不重設 App 資料，不自動重試。

新增 `assertAppForeground`，透過 Appium current_package 驗證前景 App，不需要定位器，不代表已登入或業務操作成功。Flow Case 聊天使用 `android-flow` 專用契約，CLI 與 API 模型均不再強制輸出 Playwright；保持現有模型連線與其他 Agent 用途。新案例提供 LINE 開啟範例與雙機系統設定範例；範例不代表交換流程驗證完成。使用者自行實測 LINE 與名片交換；尚未聲稱 VM 部署或雙機業務驗收完成。

## 統一案例撰寫與 Appium 執行（2026-10-28，取代下方獨立 Flow Case 編輯入口）

Web Playwright 的 web-e2e 入口使用 Appium 式畫面工作台，預設僅顯示連線狀態與網頁畫面，案例浮動選單、環境資訊皆收起；點案例編輯後顯示返回畫面、名稱與單一儲存按鈕、預設收起的設定、左 AI 對話右網頁／流程預覽、下方全寬 TypeScript。AI 沿用 author 契約，僅建議腳本，沒有網頁觀察或操作工具；原稿改變會阻擋過期建議套用。案例／對話按專案存於本機，不產生正式版本或執行紀錄；開啟時移除目前專案舊共用鍵中的 Web 草稿，保留 Android 與新版 Web 案例，毀損資料不猜測刪除。矩陣只計算情境數；登入、資料組與檢查規則尚未接入執行。外部瀏覽器 Worker 尚未串接，開啟網頁／批次執行停用，網頁區明示未連接。此項不改變下述 Smoke Runner 限制；詳見 [Web Playwright 工作台](docs/web-playwright.md)。

人工已保存的 API 案例可透過 POST /api/scripts/:id/api-flow 固定版本轉換為同一腳本 ID 的新 API 流程版本；僅保存，並核對專案、來源、環境及版本。之後人工明確執行使用固定請求，worker 再驗證精確 request；此通道可引用已保存刪除案例，Agent 計畫仍禁止刪除操作。舊版本及執行證據不改寫。契約與部署後單次轉換工具見 API 請求庫。

Playwright Runner 目前固定注入內建 Smoke 網址且禁止外部網路，不能用來直接執行專案 GraphQL。一般案例撰寫遇到外部 API 流程需求時須明示限制，回傳 source:null 並指向既有伺服器 API 流程入口；不能將 Smoke 的 ARCHIFY_BASE_URL 當作外部端點。細節見 API 請求庫文件。

一般 Test Case 的流程預覽只辨識顯式 `await test.step('名稱', ...)`，不從任意 request.post 呼叫猜測業務步驟。撰寫指示要求將每個業務步驟的操作及斷言放入具名 test.step，跨步驟 token 等值由步驟回傳，保留請求內容、順序及失敗中止語意。只改提示不會自動補寫舊稿；舊稿需補上步驟後保存。顯示步驟不代表已執行或驗證通過。

一般 Test Case 的 AI 對話帶入目前專案 ID，後端讀取該專案最新可見 API 版本、相關保存案例的獨立版本、遮蔽執行摘要與可用環境的認證欄位對應；不讀取秘密值、認證檔案或原始碼。API 與 CLI 模型均取得同一組有界證據，完整項目超量時明示省略，不能以一般 Runner runs 為空推定 API 從未執行。保存接口不是部署證據，歷史協定檢查也不是本次業務驗證。對話不會發送 API，套用、儲存及執行維持分開；Playwright Runner 不會自動取得伺服器秘密參照。需同步更新前端與 Control API，範圍、版本選取與容量限制見 [API 請求庫](API-REQUEST-LIBRARY.md)。

「案例撰寫」統一選 Test Case／Flow Case，共用名稱、儲存、TypeScript編輯、流程預覽與右下角聊天室。Test Case維持原資料／API案例功能；Flow Case的AI指令限定Android畫面操作與狀態。切換類型不清空已寫內容；AI建議依來源與案例類型判斷是否過期。

Flow Case以單一 `export const flow = {appPackage,steps} as const` 靜態定義儲存在既有script_versions。儲存及執行均解析TypeScript AST與欄位，不eval、不執行任意主機程式。支援click、type、assertVisible、assertText、back；定位支援id、accessibility id、xpath，至少一個斷言。範例為Android系統設定畫面；定位器與appPackage仍須來自實際App。現階段一個Flow Case操作一台手機，不代表已支援雙手機交錯協調、WebView或任意Appium TypeScript。

Android Appium的Flow Case頁只選取已儲存Flow Case與就緒手機，按勾選順序執行；第一個失敗停止後續案例。離開頁面不送後續案例，已送出的單一執行由worker完成，不自動重跑。結果、步驟狀態、來源與版本快照存在VM PostgreSQL android_runs，顯示最近20筆；後端重啟時未完成紀錄標為結果未確認。與原資料Runner分流，禁止把Flow Case送入Playwright Runner。執行中鎖定手動控制與關機、保留App資料，無截圖自動保存。

Windows `.local/appium`獨立安裝固定Appium 3.9.0／UiAutomator2 8.7.2，worker自動在127.0.0.1:4723啟動；不開放Appium到外網。測試設定noReset=true、fullReset=false、autoLaunch=false；動作前啟動指定已安裝App，結束刪除session。執行中傳送進度，不重送裝置指令；API與worker均驗證手機／來源／步驟，必要斷言未完成不得回報通過。LINE登入有效性由LINE決定。

舊Flow草稿保留，從Android頁「舊Flow Case草稿」移入案例撰寫調整再儲存；沒有靜默刪除或自動當可執行案例。本機已完成真實Appium設定畫面斷言通過與故意找不到元件失敗、session清理驗證；VM新版部署需管理者輸入SSH密碼後完成。

## Android Flow Case 編輯（2026-10-28）

Android Appium 的「測試流程」分頁改名 Flow Case，模擬器分頁不變。Flow Case 提供專案內草稿清單、頂部可編輯名稱與儲存、左側流程預覽、右側TypeScript編輯器及右下角共用ApiChat聊天元件。聊天以flow case和專案隔離，可切換對話；使用既有code agent及LLM連線提出建議，需在編輯區套用才改稿，之後仍需儲存，不會自動執行。

定位是使用者畫面操作與流程狀態，帳號與LINE綁定由使用者預先完成；原案例撰寫維持資料測試用途。舊Android白話流程在首次讀取時轉成TypeScript流程定義草稿，保留角色、target及步驟；原localStorage紀錄與Web流程不刪除。新草稿按專案存在瀏覽器archify.android-flow-cases.v1，尚未同步VM或接Appium執行，沒有測試通過結果。流程預覽只解析明確流程定義或step標籤，不評估／執行任意TypeScript。

## 固定測試手機（2026-10-28）

Android工作區新增固定手機名稱、建立、啟動、查看與關機保留資料。每個UUID對應獨立可寫AVD，手機磁碟在Windows `.local/android-devices`；VM PostgreSQL保存名稱與帳號歸屬。API／worker重啟後，核對UUID、AVD名稱與本機記錄才能恢復管理權。固定手機不能由臨時多開入口啟動，同一台不能同時啟動兩次。舊唯讀手機仍列在裝置區，不自動轉換。快照、重設、刪除及LINE帳號搬移尚未實作；登入由使用者自行完成，不存原始密碼。

## Scrcpy 即時影片與觸控（2026-10-28，取代下方 PNG／放開才送 swipe 的描述）

目前網頁採固定版本 Scrcpy 3.3.3：Windows worker 下載官方伺服器並驗證 SHA-256，透過持續 ADB socket 接收 H.264 及傳送觸控。VM 以 WebSocket 中繼影片與操作，Chrome／Edge 使用 WebCodecs 解碼；點擊、按下／移動／放開及導覽鍵不再經輪詢佇列。啟動／停止裝置仍使用原本受控佇列。舊 PNG 路由保留相容，已不供新版觀看器使用。

裝置擁有者才能操作，同裝置同時只允許一個視窗控制。未授權來源拒絕、執行器配對與工作階段驗證、觸控欄位驗證、速率與緩衝上限、離線放開觸控及無人觀看停止影片均已實作。瀏覽器需 localhost 或 HTTPS；遠端一般 HTTP 不保證支援影片解碼。

Windows 現有 emulator-5554 已完成本機隔離中繼的真實 H.264 解碼、主畫面、連續觸控、暫停／恢復與窄版檢查。本機首張畫面一次量測為 1062ms，不代表操作延遲，也不代表 VM 路徑效能。尚待管理者以 Ubuntu 密碼執行更新腳本部署，未宣稱完成 VM／多人網路／雙開效能驗收。Appium 自動化流程不在此升級中。

## Android 滑動與 Google Play（2026-10-28）

手機影像支援按住拖曳、放開後送 swipe，點擊仍送 tap，方向鍵可替代滑動。前後端驗證座標與時間，黑邊不接受起點，拖曳終點限制在畫面範圍。SDK 準備腳本支援 -PlayStore 建立獨立 Archify_Play_API_35，使用 google_apis_playstore 映像；原本 Archify_API_35 是不含 Play 商店的 google_apis 映像。Google／App 帳號由使用者自行登入；目前唯讀工作階段停止後仍不保留安裝與登入資料。滑動已通過模擬執行器與瀏覽器互動測試，Play 映像下載、商店與 LINE 實機環境尚未驗收。

## Android 連續影格串流（2026-10-28，取代下方按需更新描述）

選到已連上 ADB 的裝置後自動開啟 SSE 畫面連線，可顯示開機過程，不再要求按更新。Windows worker 在沒有待執行裝置操作時擷取影格並推送 VM，VM 再轉送給觀看者；同裝置多人共用擷取，每次都先檢查操作佇列。離開／隱藏頁面或暫停會關閉串流，無觀看者時停止擷取；有斷線重連、工作階段驗證、影格大小與慢速觀看端緩衝限制。圖片只在記憶體傳遞。

這是連續 PNG 影格串流，不是高幀率影片編碼或 WebRTC。Windows 真實模擬器已完成單台開機與畫面驗證，並於本機隔離中繼測得三個真實影格連續傳送；這不等於新版串流已在使用者 VM 部署，亦未宣稱雙開效能。Appium 自動執行白話流程仍未接入。

## 集中運行與 Android 模擬器（2026-10-27，取代下方舊 E2E 狀態）

導覽拆成 Web Playwright 與 Android Appium。Android 預設是模擬器工作區，流程草稿獨立於另一個分頁。原混合草稿以平台篩選保留，不搬移或清除。

新增 Windows Android worker，主動經管理者現有 SSH API 通道向 VM 回報狀態並領取固定指令。使用獨立 Android 配對檔，VM 的既有 worker token 不授權 Android 路由。可從 SDK 取得 AVD、檢查硬體加速、以不同連接埠啟動多個唯讀模擬器、取得記憶體 PNG 畫面，以及點擊／返回／主畫面／最近使用／停止。無物理裝置操作、任意 shell 或瀏覽器提交主機路徑功能。

VM 裝置指令佇列暫存記憶體，串行派送與期限控制；斷線或逾時不自動重送，結果未知。HTTPS 分享部署透過 Caddy 與 Nginx 登入入口，覆寫使用者標頭、封鎖 internal 路由，裝置輸入與停止限制於啟動者帳號。其他設定／專案仍屬共用工作區，不代表多租戶或完整角色授權。

部署與管理者安裝步驟見 ANDROID-DEPLOYMENT.md。尚未在使用者 VM 部署；目前 Windows 缺 SDK、AVD 與 Appium，無真實 Android 工作階段驗收。畫面按需更新不是即時串流，亦尚未提供 APK 安裝。Appium 僅讀固定本機服務狀態，不等於自動測試可用。Web 瀏覽器 Runner、白話轉腳本與流程自動執行仍待接入，草稿不產生通過結果。

## E2E 自動化測試區塊（2026-10-27）

測試流程側欄新增 E2E 自動化測試。提供網頁／Android 平台選擇、測試對象、獨立角色、操作與預期結果、步驟排序，以及雙帳號名片交換範本。不列出實機人工測試。流程草稿按專案保存於此瀏覽器 localStorage，尚未同步伺服器；不包含密碼或登入憑證。

此區塊目前是流程規劃介面，沒有把白話步驟轉換為可執行腳本。Playwright 瀏覽器 Runner、Appium、Android 模擬器、多裝置協調與畫面串流仍待接入。開始執行停用，不建立測試版本、不產生通過結果，也不把設定角色視為已啟動的裝置。既有 API 執行功能保持原狀。

更新：2026-10-23（Asia/Taipei）。依本輪授權，從純 UI 原型進入本機後端實作。啟動方式見 LOCAL-SETUP.md；此文件以實作為準，不代表尚未執行的驗收已通過。

## 工作位置與 UI

總覽採 [Archify Design System](DESIGN.md)：左側為六狀態環形分布與結論，右側 18rem 區塊顯示按 createdAt 倒序的最近三筆案例名稱、時間與結果，唯一查看紀錄入口位於右欄底部。不再重複最後執行時間、錯誤明細或版本。全站 token 為 GitHub 式黑灰白深色，內文 14px；總覽頁標題 20px、圖表 144px、原創白瓷小鳥 80px，控制項 compact 最少 32px。來源仍為 runHistory，非完整歷史或專案隔離證據。同步失敗顯示提醒；PDF 讀取同一設定內 report 紙本色以保留原白底深字。其他工作區尚未全部完成深色版面回歸。

從本機專案根目錄執行。React + .tsx/.ts；Tailwind config 統一管理固定深色、Inter/Noto Sans TC、40/32/24/20/16/14、700/500/400、rounded-xl 面板與 rounded-lg 控制。CSS 僅最外層容器。滿版、側欄分類預設展開，點標題切換並於重新整理後保留狀態，不顯示收合/展開文字、保留捲動但隱藏滾動條，不自動保存圖片。

工作台只有總覽與測試專案；案例撰寫、案例庫、單點 API、批次執行獨立。保留 Agent 管理與 LLM 設定；執行管理僅排程與佇列，不含平台管理。排程與其他未接線設計頁仍屬規劃，不能當成即時資料。

## 本機架構

Windows 執行網頁與官方 CLI；Linux VM + Docker Compose 執行 PostgreSQL 17、Control API、Job Launcher。Windows 透過 SSH tunnel 連 VM loopback API，不直接公開 PostgreSQL。

Control API 使用 TypeScript/Fastify/pg/zod。持久資料包含專案/案例文件、分類、Agent、腳本不可覆寫版本、SHA256、來源快照、執行紀錄與階段事件。文件與腳本使用 revision/version 防止多視窗靜默覆蓋。支援新增、切換、編輯與刪除多筆專案來源設定（三個來源）；案例庫與歷史目前共用，尚無多人登入權限。

網頁先讀伺服器；連線失敗顯示重試，絕不悄悄改用 demo 資料。舊瀏覽器資料需明確匯入；保留原資料、不覆蓋同 ID 伺服器案例，最新腳本內容從伺服器 v1 開始。舊 localStorage 歷史版本不直接當成可信伺服器版本。

## 第一條可執行 Smoke

初始化「唯讀 API Smoke」：TypeScript Playwright API request 檢查隔離容器內 /health 與首頁。案例庫按播放不跳頁；狀態 queued → running → passed/failed/skipped/cancelled，使用文字與顏色。總覽及佇列讀實際紀錄。

每次執行產生唯一測試版本，固定已儲存腳本版本、內容 hash、來源快照與環境。重跑保留新 run，不覆蓋歷史。Runner 回報具名 test.step，UI 輪詢同步。連線失敗顯示同步錯誤，不推測成功。

Launcher 以 Docker 建立單次容器：無網路、唯讀 root、非 root、cap-drop、no-new-privileges、pids/memory/CPU/timeout/output 限制、僅 tmpfs。腳本不取得 Git/LLM/DB 憑證，不掛載公司程式碼或 Docker socket。只有受信任 Launcher 持有 Docker socket。工作使用 lease；失聯到期記失敗/結果未知，不自動重跑。

目前是 isolated-fixture 環境，未連 Windows 本機前端/dev，不代表公司 release 已通過。瀏覽器 UI/視覺 Runner、附件/trace、外部環境網路代理、部署證據與排程器尚未接入。

## 專案與 Git

專案清單精簡；空狀態可新增，已設定後仍可新增；「匯入本機資料夾」直接開啟桌面的唯讀資料夾選擇器，選擇後建立檔案來源專案；不要求 Git 地址。Git 設定另走「新增 Git 專案」。每列提供刷新、編輯、刪除，本機來源可重新選擇資料夾。刪除移除專案設定，保留不可覆寫快照與執行歷史。設定名稱與三個 HTTPS GitLab URL，release 為固定分支；不手動填測試版本。

GitLab 主機、倉庫允許清單、角色、QA tag、停用/到期與秘密檔參照由 VM config/integrations.json 管理。瀏覽器僅顯示非秘密連線資訊；不接收 Token/私鑰，不宣稱 Vault/KMS 已接入。Secret 檔放 VM .local/integration-secrets，OS 權限限制並唯讀掛載到 API。

一旦設定任一 Git URL，正式快照需完整三倉庫。三者都讀 release SHA 與 QA tag SHA，要求完全相同；只有前端依固定 SHA 取得 TS/JS 來源。截取後再次確認 refs 未移動。來源與執行不可覆寫保存。Git 一致不等於 dev 部署一致，部署未驗證狀態保留。

掃描器目前僅識別字面值 fetch/axios 呼叫，附路徑/行號/hash/evidence。fetch 方法未知、SDK/動態路徑未解析，不宣稱掃描完整。來源檔上限 10,000 個、總內容上限 100 MB；目錄遍歷上限 100,000 筆，超過即拒絕，不回傳截斷的成功快照。

本機匯入支援 UTF-8 原始碼與設定文字檔，最多 10,000 檔、總內容 100 MB，沒有單檔 1 MB 限制。較大檔案分段上傳，服務端檢查完整性、路徑、重複檔名、順序與總額，完成後原子保存唯讀快照及 SHA256；不修改或執行桌面原檔。預設僅收 src/app/pages/components 等前端來源與必要的根目錄或 apps/packages 子專案設定；前後端共用 sourceImportPolicy 規則。排除 .git、套件、建置產物、文件、測試、圖片、lockfile、.env 與金鑰檔。讀取資料夾時直接跳過排除目錄；顯示上傳檔案數與略過檔案／資料夾數。檔案來源沒有 Git SHA/QA tag，執行來源固定為所選快照，不因缺 Git 退回空快照；Runner 仍使用隔離 fixture。

## 案例撰寫與案例庫

頂部可改名稱，唯一儲存按鈕。左側對話、右側具名步驟、下方完整 TypeScript；案例撰寫不放 Agent 下拉。LLM 新程式碼先等待明確套用，不自動覆蓋人工內容。儲存後從案例庫執行；右側顯示對應已保存版本的真實進度。

案例庫只一層分類標題與細列案例，整列可拖曳換分類，Enter/Space 是鍵盤替代；播放與編輯在右側，進度留在原列。分類與腳本分開保存。批次執行提供左側多選與分類全選、右側拖曳排序及上移/下移、底部固定操作列，沒有二次確認勾選；後端原子建立整批工作、共用來源快照與測試版本，依排序逐支執行，單支失敗後仍繼續其他案例。每支結果與整批狀態在原頁同步，整批可停止。案例可刪除（從案例庫移除），保留腳本版本與歷史結果；排隊或執行中的案例禁止刪除。分支/迴圈/相依不是由前端流程圖完整解析；實際行為由 TypeScript 決定。

預期中的錯誤需用斷言驗證；非預期錯誤要保留失敗。需要繼續其他步驟時可使用 Playwright soft assertions，或在獨立 tests 中隔離；不要單純 catch 後吞掉錯誤而把結果標成功。尚未新增另一套無程式流程 DSL。

## LLM

2026-10-24 API 分析修正：來源快照內以 TypeScript 模組解析追蹤 tsconfig/jsconfig 與相對設定繼承、paths/baseUrl、JS→TS 引用及 GraphQL 文件；匯入政策保留非排除目錄中的 tsconfig/jsconfig 設定。每批保留完整靜態依賴，僅在同批或整組已分析過時去重，不跨批省略 client。較大依賴群組整組送出，超限明確失敗，分析證據不做字串截斷。舊版分批工作不可混用新版接續，可重新建立整理工作，歷史不刪除。畫面顯示未解析路徑，區分來源解析、測試設定及行為確認；無缺漏仍是待驗證草稿。未新增 Kev 或其他模型部署；Vue/Svelte 專用解析、動態呼叫完整推導及任意建置工具 alias 仍未實作。

供應工具為 Claude Code、Codex、Gemini CLI。Windows 本機橋接使用官方 CLI 登入；網頁儲存工具與工作角色選擇，不保存登入秘密。固定命令與 stdin、輸出 JSON schema、工具限制、短時工作目錄與 deadline。缺少 CLI/登入/相容旗標即失敗，不降級為全權執行。CLI 權限不是 VM 強隔離，Agent 管理支援新增、儲存與刪除（至少保留一個）；對話依所選 Agent 呼叫 /api/llm，無示範回覆降級。實際三家登入呼叫仍需驗證。

Git 來源碼分享預設關閉，需伺服器 allowSourceCode 明確啟用。LLM 可依來源證據解釋呼叫與建議案例，接著產生草稿；歷史分析以 run IDs 引用持久結果。模型輸出不自動執行。自訂 OpenAI 相容 API 為選配，原生 Anthropic/Gemini REST 未實作。

## 驗證狀態

已通過：前端 TypeScript/Vite build、後端 TypeScript check、6 項無外部服務的自動測試（Git 快照/QA mismatch/allowlist、掃描證據、CLI 固定命令與結果解析、LLM 分享限制、版本輸出）、既有樣式與字體檢查。

待實測：VM PostgreSQL 整合測試與真正 Docker Runner 完整流程、三家 CLI 登入與回答、公司 GitLab。已提供測試程式及啟動文件，不能把「程式已寫」視為「端到端已驗收」。



## 單點 API 案例整理

頁面只保留右上「LLM 整理」，自動讀取來源快照並分段傳送完整文字與檔案／行號定位。專用 api-analyst Agent 產生 REST／GraphQL 結構化案例草稿；下方可展開編輯請求、變數、前置條件、斷言及缺項，離開欄位時保存至依專案區分的 archify.api-drafts.v1。模型格式錯誤或連線失敗不清除既有案例。來源分享仍受 allowSourceCode 控制。本份未同步 Documents 版 GraphQL 靜態解析器；此流程依賴模型分析，尚未驗證公司來源的真實模型結果，不直接執行 API。

## Agent 指示與連線檢查（2026-10-24）

四個內建角色的完整工作指示統一位於 services/control-api/src/agentDefaults.ts，包含職責、證據、未知資訊、輸出與禁止自動執行的界線。promptRevision 2 僅升級一次，保留名稱、模型、自訂角色及升級後的人工編輯。專案列名稱為靠左不可點擊文字；專案切換由側欄選單進行。下拉選單與專案列長名稱以省略號呈現並提供完整 title。

本機已實測 Codex ChatGPT 登入與官方 CLI JSON 回覆成功；Control API 可連線，但檢查時沒有 Windows Agent 橋接回報，且本機缺少 .local/worker-token。須由使用者從 VM 複製 worker-token 後啟動 npm run agents，才能完成網頁到模型的端到端驗證。

## 導覽與本機 Git 方向（2026-10-24）

工作台包含總覽、測試專案與 Git 管理；移除重複的程式碼來源側欄分類。前端匯入統一在測試專案，API 來源依據保留於案例詳情。舊 gitlab 入口相容導向專案清單，不再提供另一套匯入設定。

Git 管理介面不收 Token，不讀取本機憑證庫，也不觸發 VM Git 驗證。使用者先在本機 Git／IDE 登入與拉取，再匯入篩選後的來源快照；憑證由本機 Git Credential Manager／Windows 認證管理員管理。本機一鍵登入與拉取橋接尚未實作，不能宣稱已接通。既有 VM Git 整合仍保留原設定，未遷移或刪除秘密。

## Codex 完整連線驗證（2026-10-24）

依使用者選擇將已儲存工具由 Claude 改成 Codex，保留 api-analyst 角色，重新啟動 Windows 橋接。已透過 Control API /llm 取得 HTTP 200 與「Archify Codex 連線成功」真實模型回覆；橋接回報 codex installed=true、claude/gemini=false。Windows npm launcher 依工具對應不同 JS entry，修正 Codex 錯用 Claude entry 的問題。模型連線頁分別呈現橋接回報與工具偵測；安裝不等於登入，仍以實際請求為準。尚未儲存工具／角色變更時禁止測試舊設定，讀取狀態失敗時清除舊連線顯示。

## 多模型連線管理（2026-10-24）

LLM 分為 Agent 管理、模型連線、連線狀態。移除測試已儲存連線及更新狀態按鈕；連線設定具名保存於 archify.llm-connections.v1，含 provider、agentId、model、enabled，拒絕秘密及額外欄位。可新增、編輯、啟用／停用與刪除；每個瀏覽器依 Agent 保存自己選用的 connectionId，請求顯式路由，角色不符、停用或歧義均拒絕。舊單一設定僅相容讀取，首次儲存轉為清單。

儲存啟用設定後自動發送不含專案資料的模型驗證；狀態頁每五秒讀取結果，不定期重複呼叫模型。綠燈要求相同連線／prompt 指紋最近十五分鐘的真實成功結果（CLI 亦需新鮮橋接及工具偵測）；紅燈表示失敗或橋接不可用，未驗證／過期為灰色。改設定或 Agent prompt 使舊驗證失效，最近驗證時間可見。

Windows 橋接心跳獨立於執行工作，預設三個並行 worker，上限四個；不是多人帳號隔離，也不是每人自己的 CLI 帳號橋接。工作區連線設定共用，同一橋接使用該 Windows 帳號的登入。已通過來源碼單元與 UI 測試替身驗證；真實多連線／並行 VM 整合需部署新版後驗收。

## 模型連線合併狀態（2026-10-24）

依最新需求移除獨立連線狀態側欄，狀態燈、結果及最後驗證時間直接顯示於模型連線列。每筆提供測試連線，執行中禁止重複點擊，最近驗證成功時顯示 disabled「已確認連線」；設定變更／驗證失效後可重新測試。舊 llm-status 路由相容顯示同一管理頁。

## API 相關性篩選（2026-10-24）

來源分析先用 TypeScript 5.9 語法樹找 fetch/axios/request、候選 client 方法及 GraphQL 字串／模板／文件；以頂層宣告為片段，追蹤 local 常數、型別、import、tsconfig paths、@/src 別名及 named re-export，保留 client defaults/interceptor 設定。僅傳候選及靜態依賴，原路徑／行號保留，盡量按引用群組打包並去重。無候選時不退回全專案。未知 alias／語法警告回報，namespace 保守包含整模組；Vue/Svelte 尚非專用解析器。函式級片段可能包含同函式 UI；動態請求、自訂 SDK、跨批引用仍有限制，不宣稱完整覆蓋。

曾以大型本機前端來源實測只讀依賴過濾（僅傳候選檔與靜態依賴分段），縮小模型輸入片段並避免送出整個專案。新版需部署 VM；已啟動的舊整理作業不會自動切換。

## CLI 分析失敗診斷（2026-10-24）

簡短無來源測試可正常回覆 HTTP 200 OK，大型分析原錯誤無法還原，舊橋接丟棄 stderr。新版僅在記憶體保留有界 stderr 並分類為 timeout/auth/rate-limit/argument/model/network/exit，不將原始 stderr／來源送回 UI 或寫入診斷紀錄。CLI 執行上限改 180 秒，LLM lease 190 秒、Control API 等待 200 秒、網頁 210 秒；連線驗證 pending 視窗同步 210 秒。新時限需 VM 與橋接同步更新。

## 單點 API 背景整理（2026-10-24）

整理改由 Control API 背景工作執行，資料與批次進度保存 PostgreSQL；前端只建立、查詢與取消。每個專案限一個進行中工作，來源快照與連線／Agent 設定固定；設定改變停止後續批次。離開頁面或關閉瀏覽器不影響工作，但 VM 與 Windows 橋接需保持執行。取消後不再送後續批次，目前已送出批次可能完成但不套用。完成時以開始前案例內容比對，若其他視窗已編輯則保留結果而不覆寫；失敗／取消的部分結果亦保留。VM 中斷造成 lease 到期時標示失敗，不自動重送；排隊工作可由重啟後服務接手。只產生未驗證草稿，不執行 API。

## 背景整理斷點接續（2026-10-24）

失敗或取消後主按鈕改成「接續整理」。沿用同一工作、來源快照、連線 fingerprint、已完成批數與案例；從 completed 索引開始，只重試未完成批次。來源快照新增固定的 apiAnalysisParts，後續模型請求讀取相同分批；相容既有工作（重新解析原快照，批數不一致時拒絕並保留結果）。原模型提示亦保存，避免接續時改變提示。接續以專案 advisory lock 與 row lock 保護，禁止與同專案另一執行中工作併行，完成工作不能再接續。每批解析成功後一起保存 items 與 completed；資料庫未確認完成的批次可能重試，不宣稱模型端 exactly-once。模型登入／網路等失敗原因仍需排除，接續功能不保證 CLI 成功。

## API 請求庫與版本影響（2026-10-24）

單點 API 新增不依賴 LLM 的來源請求庫：靜態解析 fetch、Axios 設定及 GraphQL 文件／片段，保留來源行號、引用雜湊與未解析問題，排除 Map／URLSearchParams 等非網路 get/delete。匯入完成建立不可覆寫的 API 版本；既有上傳快照首次讀取時補建。比較新增、移除、方法、端點、參數、Headers、內容及依賴檔案前後變更。

獨立的受限 HTTP 發送器使用伺服器環境與秘密參照，GraphQL 先載入／匯入 schema，再驗證文件與變數；HTTP 200 的 GraphQL errors 判為失敗，並支援 JSON 路徑斷言。請求按使用者明確發送才執行，不自動重送；唯一請求識別避免相同提交重送。執行保存來源快照／定義版本、環境、實際網址／內容雜湊、schema 雜湊及遮蔽後回應，不宣稱對應實際部署版本。Docker fixture runner 與瀏覽器能力不因新增單點發送器而變成正式整合。

API 案例保存不可覆寫的案例版本，並同步到流程可選案例。明確案例綁定、手動腳本步驟與同專案流程用於影響追蹤；腳本字面值匹配只標示潛在影響。歷史定義不自動覆蓋已儲存案例。既有 LLM 草稿保留於收合區塊。動態工廠、二進位檔／multipart、Signed URL 跨主機上傳與 WebSocket 尚有限制，詳見 API-REQUEST-LIBRARY.md。VM 須部署新後端與新增資料表後才生效。

## API 工作台管理更新（2026-10-24，取代上節舊草稿保留規則）

版本可命名、建立空白版本與刪除；刪除從清單移除並保留執行證據。接口新增、編輯、刪除與分類透過版本修訂鎖及修訂紀錄管理，不改寫已保存的執行請求。同掃描指紋直接沿用版本，不額外建立來源快照；手動接口、分類與說明可延續至下一來源版本。

新增前置 URL／一般環境變量管理，仍受伺服器主機、路徑、專案白名單約束。登入回應可按 JSON 路徑擷取秘密變量，加密儲存並綁定專案／環境；設定檢查失敗不沿用原指定值，後續請求與 schema 載入可自動帶入 Token Header。秘密值不傳回網頁，12 小時到期，可手動清除。密碼使用伺服器 variablesFile 與請求占位符，不提供原始秘密輸入欄位。

移除舊 LLM API 草稿元件並停用建立／接續入口。部署後進入各專案 API 頁面時，按專案取消舊工作並清除草稿 items／baseline 及草稿文件，保留狀態、來源與實際測試歷史；不採用啟動時刪除工作表。AI 改為接口內的可選說明，透過既有模型連線解釋有界來源／呼叫片段，引用行號，不建立案例或執行請求。模型來源分享仍需伺服器允許。

## 單點 API 工作台重排（2026-10-24）

版本名稱只顯示自訂名稱，沒有名稱時顯示「版本 N」；版本選項僅管理目前版本，建立空白版本用獨立入口。全頁共用一個目前環境，接口內不再重選；環境設定放入支援焦點限制、Escape 與焦點返回的視窗。一般變量逐列編輯，可選擇自動帶入同名 Header；GraphQL 同名宣告變量自動帶入，接口顯式變量優先。

頁面分成接口、版本差異、執行紀錄；接口內分請求內容、參數、Headers、認證、檢查與擷取、前端使用方式、案例與腳本。GraphQL 預設以 Query／Variables 編輯，Query 保留前端選取欄位。自動載入目前環境 schema，失敗可重試／匯入；schema 快取綁定端點，不能假裝從部分 Query 得到完整 schema。

同一 GraphQL 根操作或 HTTP 方法／路徑的用法可列出來源呼叫位置、參數與巢狀欄位。支援靜態 named／star re-export、namespace import 與有限深度 wrapper 追蹤；可辨識的 wrapper input 保留 GraphQL 變量結構載入，動態或不完整映射明示限制。呼叫檔案也列入依賴，參數／位置變動可出現在版本影響；不宣稱所有前端執行期行為已解析。歷史快照可補充用法顯示而不改寫原請求定義。


### 單點 API 工作台操作補充（2026-10-24）

- 版本選擇與管理共用選單：點項目切換，右側鉛筆原地改名；儲存不切換未選版本。編輯列保留版本刪除入口。自訂名稱同步解析於案例、差異及歷史，來源快照及版本識別保持原值。
- 接口分類獨立以樂觀修訂儲存，不驗證或改寫請求內容；編輯器可直接移動分類或新增分類。
- 載入來源的補值通知改為 Variables／對應欄位提醒。
- 執行紀錄按專案逐筆刪除回應內容，排除 queued／running；保留 requestId 防重送標記，已刪紀錄不再列出。刪除紀錄不會撤回 API 操作。


### API 左側資料夾與環境表單（2026-10-24，取代分類選單入口）

- 搜尋接口旁的「＋」新增接口。移除右側分類新增選單與接口設定內的分類輸入，改由左側右鍵新增單層資料夾、拖曳接口或 Shift+F10 選單移動。
- 空資料夾保存於 request catalog 的 folders，新增時使用既有專案隔離與 revision 檢查；相同名稱拒絕，新增來源版本沿用資料夾。移動沿用分類 PATCH，不覆寫未儲存的請求欄位。資料夾收合狀態按專案與 API 版本記住。
- 上方「環境設定」每次開啟空白新增表單；左側列出環境並各有編輯鉛筆。編輯只影響該環境，工具列目前環境不隨編輯切換。
- 表單可從另一環境複製一般參數、URL、Header 勾選、允許目標及 Token 欄位對應；新環境保留獨立 id，登入秘密不複製，仍受伺服器目標範圍驗證。


### 接口右鍵操作補充（2026-10-25）

接口右鍵選單提供刪除，確認目標以右鍵接口為準，不依賴目前編輯接口。刪除其他接口不重置當前未存欄位。選單緊鄰項目中段，採緊湊尺寸與共用 menu 字級；小螢幕靠左避免水平溢出。支援 Shift+F10、方向鍵、Home／End、Escape 及 Tab 關閉。


### 可視工作區（2026-10-25）

桌面 API 工作台配合主頁剩餘高度，頂部保留，接口清單與請求編輯區獨立捲動且隱藏捲軸。展開資料夾後可在清單內捲至完整最後一筆，不需再捲動外層主頁。右鍵移動目的地排除接口目前所在資料夾，包含未分類。


### 工作區高度修訂（2026-10-25）

依最新操作需求，API 外層主頁恢復捲動，不鎖定在頂部。桌面中間工作區使用共用高度 token max(48rem,80dvh)，避免被剩餘視窗空間壓扁；接口清單與右側內容仍可獨立捲動，捲軸隱藏。此高度策略取代上一節固定主頁可視高度的設定。


### 一屏分割工作台（2026-10-25，最新介面方向）

依最新參考圖，API 頁改為一屏的獨立捲動區域，取代前述整頁主要捲動方案。左側接口、上方請求、下方回應／錯誤分離；GraphQL Query 與 Variables 各自捲動。可拖曳左右／上下／Query-Variables 分隔線，支援方向鍵、Home／End、雙擊重設及本機比例保存。使用 Tailwind 主題中的 grid 比例與較小字級，不寫 inline style。文字、工具列、控制高度縮小，固定深色主題；整體主題字級以 tailwind.config.ts 為準。

新請求開始時清除上一筆顯示結果；輸入驗證錯誤顯示於下方回應，不把上一筆成功當成當次結果。切換接口與環境會清除畫面上的舊錯誤／提示，既有執行紀錄保留。


## 2026-10-25 API 案例與流程助手

- 單點 API 的接口下可選多個正向／反向案例；來源請求與已存案例明確分開，執行紀錄保存案例修訂與實際請求。
- GraphQL 指定錯誤測試須以錯誤訊息或代碼斷言驗證，非任意 errors 即通過。
- 共用可收合助手：接口頁帶當前接口，腳本案例庫及批次執行帶目前專案最新 API 版本；明示環境與範圍，預設僅建立。
- Agent 只新增，不覆蓋／刪除資產。計畫結構及來源範圍由伺服器驗證，不執行任意生成程式碼；可辨識刪除操作禁止。
- API 多步流程存腳本案例庫，引用 API 案例不可變修訂，使用 API 執行器；原有單一腳本撰寫與隔離網頁 Runner 保留。
- 背景工作持久保存、可停止後續步驟；失敗不自動重送。業務斷言不足不建立已驗證案例，重複內容沿用既有案例。


## 案例回應的明確儲存規則（取代自動附存設計）

- 接口右鍵新增案例，名稱／類型小視窗直接建立，不設案例設定頁；案例右鍵重新命名或刪除。
- 單一 API 案例只保留一份使用者按上方唯一「儲存案例」一併選定的實際遮蔽回應，後續明確儲存覆蓋該份；要多份就建立更多案例。
- 未儲存的新結果離開時須提供儲存、放棄或取消離開；涵蓋頁內切換及主選單／專案，分頁關閉／重整使用 beforeunload 原生提醒。
- 案例回應獨立於一般執行紀錄，儲存不能捏造 body 或將失敗轉為通過，保留當時案例修訂及環境。
- AI 查閱目前 schema input、來源快照關聯檔與呼叫端，未知內容列限制。待補契約可存為不可執行草稿，不把來源解析缺口全部推給使用者填寫。


### 單點 API 空白進入與統一聊天（2026-10-26）

- 初次進入及切換專案不自動選第一個接口；未選取時右側留白，不呈現請求、回應或選取提示。掃描錯誤仍可在工作台顯示。
- 移除工具列 AI 助手與前端使用方式內的問答。右下角以單一浮動聊天入口整合來源問答及既有案例／流程工作；顯示目前專案、版本、接口、分頁與環境。收起保留本頁對話，Escape 關閉並返回入口；有開啟的對話框時優先處理對話框。
- 來源問答目前仍須選接口；未選時可切換案例／流程工作，操作目前版本的接口。案例／流程沿用既有伺服器驗證；發送請求預設關閉，每次工作送出及上下文變更後清除本次授權。通用 AI 選取接口、填寫畫面欄位等工具尚未實作。
- 前端使用方式依用途摘要、可搜尋呼叫位置、逐筆展開參數、技術細節排序。摘要沿用已有用途說明，不從檔名推測業務功能；值與來源保留實際程式表達式。型別、原始請求、來源依據預設收合；解析限制保留於對應用法。帶入操作明示「帶入請求編輯器」，仍沿用未儲存回應提醒。


### 全站緊湊密度與可操作 API 聊天（2026-10-27，取代前節的聊天限制）

- 全站使用 compact UI density；共用側欄固定為 API 工作台的寬度，字級、選單列高、頂部工具列、頁面外距、表單、頁籤、面板與表格保持同一密度，切頁不再改變側欄幾何。
- 移除 API 工作台底部的聊天預留高度，讓請求／回應使用剩餘高度。儲存、發送、接口設定改為具可存取名稱與提示的功能圖示；帶入前端 Query／請求／用法使用右上指向左下的單向箭頭。
- 聊天僅保留右下角圖示作開啟／關閉入口；沒有收起按鈕。頂部固定目前對話、紀錄與新增入口，目前接口單獨顯示，其餘專案／API 版本／環境／分頁收合於上下文。桌面較寬時保留右側聊天欄位，窄畫面開啟聊天時暫隱 API 工作區，避免控制項在聊天後方重疊。
- 中間只捲動訊息，頂部與輸入框固定；閱讀舊訊息時不強制捲到底部，收到新回覆可選查看最新訊息。Enter 送出、Shift+Enter 換行；輸入法組字時不送出。可停止等待模型回覆。
- 對話依專案存於此瀏覽器，支援新增、切換、改名、刪除與復原，以及重新整理後恢復。每專案最多 30 段、每段最多 200 則；達上限時明示，不默默刪舊訊息。儲存失敗或資料損壞會明示，不覆寫無法讀取的原資料。既有案例、腳本與執行紀錄不因刪除聊天而刪除；已知排隊／執行中的工作所屬對話不允許刪除。
- 新增專用 api-ui 模型用途與 /api/api-library/:projectId/ui-chat 路由，避免與來源解釋指令互相衝突。模型回傳白名單工具：select_request、set_tab、fill_request、load_usage、start_workflow。前四種實際改變目前工作區；案例建立與執行委派既有持久化工作執行器。不是瀏覽器自動化或任意程式執行入口。
- 操作受專案／API 版本／接口 ID、欄位型別與前端用法索引驗證；模型回覆後畫面若已改變則不套用。未儲存回應、未儲存新接口或其他操作進行中時不覆寫畫面。可一次處理同一接口的選取／填寫／切頁，不允許多接口未存編輯互相取代。
- 案例工作可接收目前編輯器的非秘密變量、參數、內容與檢查上下文；仍不得越過來源方法／端點／GraphQL Query 與伺服器環境限制。畫面上下文不加入 Headers、認證參照或伺服器保存的秘密值；其他請求資料仍沿用來源分享設定。
- 發送 API 預設不允許；只有使用者本次允許且明確要求執行時才能委派執行。送出、新對話、切換對話、版本／接口／環境變更後清除本次授權。工作識別碼在提交階段留於對話；回覆不明時可讀取狀態，不自動重送。新增依專案隔離的單筆工作查詢，回覆不包含內部模型上下文或計畫。
- 來源分享仍沿用既有伺服器 opt-in、模型連線與 Agent 綁定；這些工具驗證不取代伺服器授權。前後端需一同更新才會有新聊天路由。


### 覆蓋式聊天、環境入口與掃描確認（2026-10-27，取代前節並排聊天與自動掃描建版）

- 聊天開啟時只覆蓋在工作台上方；不保留右側欄位、不縮窄或隱藏原本 API 工作區，桌面及窄螢幕皆如此。
- 工具列移除目前環境選單；「環境設定」視窗頂部提供有明確標籤的目前測試環境選擇，仍按專案記住選擇。環境表單與執行環境維持獨立，開啟設定仍以空白新增表單開始。
- 有可解析 sourceRequest 的來源接口，重新進入時以實際前端 Query、Variables 與 operationName 作為預設，不讓先前接口設定留下的 defaults 蓋回舊值。其餘設定保留；手動接口及已儲存案例使用自己的輸入。切換環境不帶入另一環境的認證參照，不改寫案例版本或執行歷史。
- 掃描分成預覽與儲存：POST /api/api-library/:projectId/refresh 僅回傳比較基準、接口數、差異、解析問題與預覽識別碼，不寫入來源快照或 API 版本。
- 掃完自動開啟差異與版本命名視窗，顯示新增／移除／變更數量及欄位前後內容。名稱不可空白，使用者明確儲存後，POST /refresh/:id 才在交易內寫入已檢視的來源及新命名版本。即使來源未變也可明確另存新版本，不改名或覆寫舊版。
- 放棄按鈕、關閉與 Escape 都刪除暫存預覽；未命名儲存不建立版本。離開工作台對已取得預覽作最佳努力清理。預覽只在服務記憶體暫存十五分鐘，服務重啟或到期後需重掃；不宣稱是持久化草稿。
- 儲存比對掃描時的基準，在目錄鎖內拒絕過期比較；重試同一預覽不重複建版。預覽依專案隔離；已儲存版本不能經放棄預覽刪除。儲存回執不保留來源全文。

### 目前版本比對與聊天參考資料（2026-10-27，取代舊上下文展開方式）

- 掃描必須明確送出目前選取的 catalogId，差異與分類繼承均以這個未刪除版本為準，預覽顯示使用者命名。資料庫最新流水號只供新版本編號，不決定比較基準。
- 已刪除、不存在或其他專案的基準拒絕掃描；掃描中與儲存時再次檢查同一基準，變更或刪除後必須重新選取並掃描，不回退其他版本。只有沒有任何未刪除版本時允許首次掃描。
- 聊天標頭只顯示目前接口與資訊圖示，參考資料以浮層呈現專案、命名版本、接口、環境與分頁，不推動聊天內容。Escape、關閉圖示、點外面或移出焦點可關閉，Escape 保留聊天並返回資訊按鈕。
- 版本差異說明為建立時的掃描變動，不再宣稱一定與前一個流水號比較。

### 腳本案例庫分類與浮動助手（2026-10-27）

- 未分類是固定的根分類，不提供改名或刪除；所有新增分類均可刪除，確認後只刪分類並把其案例移回未分類，保留腳本、版本與執行歷史。取消或儲存失敗不移除分類。
- 腳本案例庫與共用 AI 測試助手入口改用 ApiChat 右下角覆蓋式聊天，沿用固定標頭／輸入框、對話歷史、改名／刪除／復原與工作進度。共用同專案對話紀錄，頁面切換後不清空。
- 此入口保留原有案例／流程工作服務，直接提交明確的使用者需求，不宣稱可在案例庫操作單點接口編輯器；環境可在聊天中選取，每次開啟重新讀取目前版本與環境。發送 API 維持本次明確允許且伺服器驗證。單次最多 50 個接口，超過時引導到單點頁指定接口。

### 掃描比對只使用來源快照（2026-10-27，取代對已編輯目錄的直接比對）

- 掃描與命名儲存均讀取所選版本的 source_snapshots，以目前同一版掃描器重新解析舊來源，再對比新來源。舊目錄的請求編輯值、defaults、歷史 dependencies/implementationHash/usages，不作為程式變更依據。
- 舊掃描漏抓的同名 Query 或呼叫端追蹤會由重新解析補齊，來源未改不算新增／變更；真正的 Query、呼叫參數與引用檔案變動仍列出。CRLF/LF 在解析時統一，不改動保存的來源或 Git SHA。
- 舊版本原始碼快照缺失或不屬同專案時拒絕掃描比對，不用已編輯請求猜測、也不宣稱無差異。舊版本、成功／失敗案例與執行紀錄不覆寫；手動接口與資料夾保留，手動接口不列入來源掃描差異。
- 未選案例時，來源接口範本使用重新解析的 method/endpoint/body/variables/headers/queryParams，預期狀態 200、空認證與空斷言，不沿用舊 defaults 的測試值。GraphQL 保留 application/json 預設 Header。手動接口保留自訂定義；選取已保存案例則使用案例自己的 request，仍須符合環境認證限制。

### 完整資料夾的增量匯入與切片（2026-10-27）

- 初次仍完整上傳；重新匯入會攜帶前次 sourceSnapshotId，瀏覽器讀取整個選取資料夾並計算 UTF-8 內容的 SHA-256，分批送出路徑／指紋／位元組數清單。HTTP 環境不提供 SubtleCrypto 時使用經標準 digest 測試的純 JS SHA-256。
- 伺服器以同專案 upload 快照作固定基準，重算來源指紋後沿用相同檔案，只要求新增／修改檔案內容；清單未包含的舊路徑只從新快照移除。舊快照、版本、案例與歷史保留。這是完整資料夾取代，不是任意幾個檔案的補丁合併。
- 匯入工作須完整提交 manifest 並完成 plan；拒絕重複／不安全路徑、超量、清單外檔案、hash／長度不符及未完成片段。新增內容沿用既有批次／大檔分段協定。基準跨專案或不存在時拒絕。失敗清理暫存工作，不切換專案來源指標。
- complete 在交易內保存一份完整新快照、建立／沿用 API 目錄，並從組裝後的完整原始碼重新建立 apiAnalysisParts 與 apiAnalysisVersion。沿用檔案仍參與依賴分組；不只切修改檔、不沿用舊模型回答，也不會自動呼叫模型。LLM 工作仍由使用者啟動並遵守來源分享設定。
- 前端新增 protocol 檢查，舊服務未支援時停止增量匯入並提示同步更新，不靜默把部分檔案當成完整專案。現行 project 及 source_imports schema 不需遷移。

### 案例撰寫工作區與分類圖示（2026-10-27，取代左側內嵌聊天／下方全寬編輯器）

從腳本案例庫開啟既有案例，頂部名稱前提供「返回案例庫」箭頭，返回 cases 頁面；有未儲存修改或待套用 AI 建議時，先選擇繼續編輯或放棄修改並返回。直接開啟新案例撰寫不顯示該返回入口。Android 原有返回測試行為保留。

- 案例撰寫頂部為名稱、版本／未儲存狀態與單一儲存入口；桌面流程窄欄在左、主要 TypeScript 編輯器在右，手機改為上下排列並限制初始程式碼區高度。
- 移除內嵌聊天，只用共用右下角 ApiChat 覆蓋式入口。案例撰寫的參考資料標示案例與腳本版本；不顯示 API 請求授權或環境欄位。聊天紀錄依專案與案例 ID 隔離，新案例使用空白對話，已保存案例重開時載入自己的紀錄；舊版專案共用聊天保留於原儲存鍵，不自動搬入新案例；舊案例 draft.messages 保留，初次開啟時以穩定 thread id 加入紀錄（仍受既有 30 段對話上限）。
- authoring 對話沿用原 /llm 與未驗證草稿語意，攜帶目前案例與程式內容。AI 回傳程式碼先顯示修改範圍及原／建議內容，套用只改草稿，須手動儲存；等待期間若手動編輯原始碼則拒絕套用過期建議。停止等待／離頁會取消請求，不套用後續建議。
- 固定 API 流程仍可解釋、保持唯讀並保留原執行入口，忽略 AI 對它回傳的程式碼。未經驗證的腳本不宣稱可執行。
- 腳本案例庫自訂分類的刪除入口改為 danger token 的垃圾桶 SVG，無可見中文字，保留 title／aria-label 與原確認；只移除分類，案例移回未分類，腳本版本與執行歷史保留。未分類仍不可刪除。

### 案例庫分類名稱直接編輯（2026-10-27）

- 移除分類旁的改名按鈕。點自訂分類名稱原地切換輸入框，失焦自動儲存，Enter 儲存，Escape 取消並返回名稱焦點。未修改名稱不寫入，Enter／失焦不重複提交。未分類保留固定名稱。
- 空白、保留名稱與重複名稱拒絕儲存；失敗保留輸入值、原分類名稱與案例歸屬，可重試。儲存只更新同一 folder id 的名稱，不更動 scriptFolders、案例或歷史。儲存中阻擋分類刪除／移動等衝突操作。

### 批次執行版面對齊（2026-10-27）

- 批次操作列移除使用舊 sidebar 寬度的 viewport fixed 定位，改為內容內的 sticky 列，與選擇／順序面板同寬，底部保留右下角聊天入口空間。
- 桌面 lg 起兩欄等高，手機上下排列；移除空案例清單產生的多餘垂直間距，空清單保留新增案例入口。案例選擇、排序、批次提交與取消邏輯不變。

### Agent 設定填滿可用高度（2026-10-27）

- Agent 管理頁桌面 main 使用垂直 flex，設定工作區伸展至可用畫面底部。右側設定面板與 form/fieldset/工作指示以連續 flex 高度鏈分配空間，按鈕列不壓縮，文字區隨視窗高度增減。
- 桌面左清單可獨立捲動；短視窗或手機保持頁面捲動，工作指示有最小高度，儲存／刪除仍可操作。僅調整版面，不改 Agent 內容、儲存、權限或切換行為。

### 全域模型與 Agent 個別設定（2026-10-27）

- 模型連線保存可選的 globalDefault，最多一個且須啟用；第一個啟用連線預設勾選全域。舊設定只有一個啟用連線且完全沒有 globalDefault 欄位時沿用該連線，多個連線時須明確設定。
- Agent 預設不保存模型覆寫，使用全域；可保存 modelProvider / modelConnectionId 個別指定。實際請求由服務端解析，保留目前用途的 Agent 工作指示，不再使用瀏覽器舊的每角色連線偏好。指定連線失效、停用或供應商不符時停止，不靜默換模型。
- Agent 選到未配置供應商時顯示短提示及新增連線入口；新增預帶供應商，完成後回原 Agent 並保留名稱、工作指示及未儲存模型選擇。個別設定須儲存 Agent 才生效。移除模型頁底部的全域繼承與清單來源長說明。
- 指定模型可使用工具預設、同工具已存模型識別字或自訂識別字。清單不是即時供應商模型目錄；可用性仍由實際連線驗證確定。
- 模型連線分開顯示指定模型與工具/API 外層回報的模型。未提供 metadata 時顯示未回報，不從生成的 reply 推測；Codex output-last-message 通常不提供該 metadata。schema 增加 llm_connection_checks.reported_model，更新前端、Control API、橋接並正常執行服務遷移後才可使用新協定。
- 背景整理建立時凍結連線、指定模型、角色與 fingerprint。只切換全域標記不改既有工作；實際連線模型、角色指示或個別路由異動則阻擋過期工作，避免混用設定。

### 執行紀錄刪除與每次執行品質報告（2026-10-27）

- 版本與執行紀錄依 testVersion 分組，提供單筆與整個執行版本的紅色垃圾桶入口。確認後由服務端交易與 row lock 檢查：排隊／執行中，或同版本仍有活動執行時拒絕刪除。失敗保留列表並可重試；刪除成功後阻擋過期輪詢回覆復活紀錄。
- runs 與 api_workflow_jobs 增加 deleted_at。刪除只隱藏執行紀錄與對應報告，不刪除案例、script_versions、來源快照與底層事件。舊 runs / batch 與 API workflow 列表／詳情也排除已刪除紀錄；保留 request id 的冪等保護，不重送真實測試。
- 新 execution-records 將 Runner 與腳本案例綁定的 API workflow 統一呈現。API draft 步驟視為略過，不能當作成功。單點 API 請求統一於側欄執行紀錄查看，不混入腳本批次報告；單點 API 工作台移除歷史分頁，保留當次回應與案例保存回應。
- 品質報告替換原有示範指標／未實作說明頁。一次執行或共用 testVersion 的批次一份，列表呈現版本、時間、案例結果數、摘要與下載入口。活動執行暫不開放 PDF；完成後用保存的紀錄與事件產生，不重新測試或呼叫 AI。
- PDF 在使用者瀏覽器產生，含實際結果環形圖、案例總覽、環境／時間、失敗與步驟明細、來源快照與 Git 證據、頁碼。沒有截圖或部署證據時明示未提供／未核對，不虛構覆蓋率。採 A4 高解析點陣頁面以沿用瀏覽器中文字型；目前不提供可搜尋／選取的 PDF 內文。下載時產生檔案，未另保存 PDF 二進位檔；刪除單筆後報告反映剩餘紀錄，整版刪除則移除報告入口。
- 移除側欄「本機工作區 · 設計預覽」文字及其分隔線。部署需同步更新前端與 Control API，並正常執行新增 deleted_at 欄位的遷移；未在開發工作中改動使用者真實資料。

### 僅批次產生報告與報告命名（2026-10-27，取代每次執行一份）

- 只有 runs.batch_id 指向批次的執行才有品質報告；以明確 batch_id 判斷，不依案例數量、testVersion 名稱或是否成功推測。單筆 Runner、腳本 API workflow 與單點 API 只保留原執行紀錄。批次只選一個案例仍是批次報告。既有批次自動適用，不把舊單筆誤轉成報告。
- 批次執行新增選填名稱，與批次建立一起保存 batches.name。報告顯示「名稱 · 本機日期時間 報告」；未填名稱使用「批次測試」。報告清單提供改名，改名只更新 batches.name，不改固定 testVersion、來源、執行時間或案例。PDF 封面與下載檔名採用報告名稱，檔名另帶版本識別避免同分鐘混淆。
- 版本與執行紀錄中的批次預設收成一筆摘要，查看報告才展開案例結果；提供下載 PDF 與整版刪除。狀態篩選命中其中案例時仍顯示完整批次結果數，不將部分案例偽裝成整份報告。單筆保留原查看結果／刪除入口。品質報告頁只列批次。
- 活動批次顯示執行中，結束後開放查看／下載報告。PDF 仍按保存的結果即時產生，不在每次小測試保存 PDF。部署需同步前端與 Control API，正常遷移 batches.name；舊批次留白使用預設名稱。

## Android 自動滑動

Flow Case 支援 `swipe` 與 `scrollUntilVisible`，由 UiAutomator2 的 `mobile: swipeGesture` 執行。`direction` 是手指方向 up/down/left/right；`percent` 為 (0,1]，預設 0.7。可選 `area: {left,top,width,height}` 以畫面比例指定區域，整體不得越界；預設使用中央區域避開邊緣。`scrollUntilVisible` 必須提供唯一目標的 using/value，先檢查是否可見，每次滑動後重新定位，找到即停止，不自動點擊。`maxSwipes` 預設 5，上限 10；耗盡或定位器不唯一時失敗。雙機沿用 actor 選擇 session。滑動不作為 assertion，流程仍需明確畫面檢查。前端撰寫提示、Control API 與 Windows Android worker 須同步更新；協定模擬測試不代表真機整合驗收。

## Android 元素輔助撰寫
Flow Case 每次送出需求前，向 Android worker 讀取當下 UIAutomator XML（不保存截圖）。僅允許讀取所屬且已開機裝置；單台自動選擇，多台需在需求指定 emulator 序號。XML 與擷取時間作為不可信元素證據提供模型，優先唯一 resource-id／accessibility id，否則以文字與結構建立 XPath；不使用固定座標。讀取失敗需說明實際原因，不得虛構元素或宣稱已操作。草稿仍需儲存並由使用者執行驗證。Appium 執行以 findElements 確認唯一匹配，重複時失敗並保留歷史，不點第一個項目。新版需更新 Control API 及重新啟動 Windows Android worker；尚未完成真實 LINE 整合驗收。

執行紀錄清單支援刪除已完成的 Android Flow Case，沿用危險操作確認視窗。後端核對紀錄歸屬、拒絕排隊中／執行中的紀錄；刪除後不再列出或開啟詳情，保留執行要求編號以防舊要求重送，測試案例及腳本版本不受影響。

Android Appium 選單每筆 Flow Case 可同頁編輯，最近執行結果可直接修改案例；儲存新版本後返回測試並保留手機與勾選順序，重測使用新版本。沿用原案例撰寫樣式，頂部只保留名稱、儲存與返回，不顯示案例類型或裝置／版本摘要。返回時若有草稿或 AI 建議，先選擇繼續編輯或放棄修改；AI 撰寫綁定當前手機並附上最近執行證據。

Android E2E 案例與分類在 Android Appium 的「案例管理」維護，沿用單層分類、搜尋、拖曳與鍵盤移動、編輯與刪除。新增分類記錄 test／flow 範圍，舊案例保留原分類關係。一般腳本案例庫與網頁批次執行排除 Android Flow Case。側欄依序為工作台、測試流程、E2E 自動化測試、執行管理（批次執行／排程／工作佇列）、測試結果、LLM。

E2E 自動化測試側欄四個獨立入口，順序為 Web Playwright、Android Appium、自動化案例庫、批次執行。案例管理移出 Android 畫面；E2E 批次頁提供批次名稱與前端／中間層／後端 Git commit 欄位、選機與案例執行；各次 Android 執行快照保存批次識別、名稱與手動 commit，未核對部署。Android Appium 保留裝置觀看與快速選案例執行。一般測試流程的批次執行保留。


## Android 回歸流程能力

Flow Case新增智慧等待、if/else、可選步驟、有上限repeat/while、變數產生/回讀/插值、更多斷言、輸入清空及收鍵盤、案例內routines/call、固定版本callFlow共用案例、before/after前置清理。共用引用在執行建立時解析並凍結來源，禁止循環與不相容套件/角色。每條實際主測試路徑必須完成斷言，雙機兩個角色各需斷言；前置與清理不計入，條件略過不能產生假通過。操作不自動重送，等待與讀取可輪詢。展開結構最多3,000步；主流程最多3,000次步驟與30分鐘，清理額外300步與3分鐘，工作階段建立另保留2分鐘，巢狀6層，引用最多20個固定版本。

執行紀錄保存分支路徑、略過原因、迴圈、前置/清理結果及耗時，不保存輸入、擷取文字、變數值或截圖。批次預設失敗即停，可選繼續其他獨立案例；任何案例失敗，整批通知不得顯示通過。不自動推斷案例依賴。API資料驗證仍暫緩。撰寫契約共用services/android/flow-guide.json，詳細用法見docs/android-flow-regression.md。需同步更新前端、Control API與Windows Android worker；模擬測試不代表手機整合驗收。

條件可用 `any` 等待多個畫面任一出現，再依實際畫面分支；所有畫面未出現時必須逾時失敗。Android worker 心跳回報 `conditionalFlows` 能力，Control API 僅在連線新鮮且有此回報時允許執行擴充流程，未回報時明確提示更新與重啟，不影響舊格式流程。Agent 撰寫規則依回報區分可產生的草稿與已確認的執行能力，不得沿用舊對話錯誤宣稱不支援條件。部署映像必須包含 flow-guide.json 與 flow-dependencies.mjs。


## Android 本頁結果通知

Flow Case頁面提供鈴鐺通知，依完成順序保留本頁最近50筆結果，含成功/失敗文字與顏色；開啟清單標為已讀，點選結果直接編輯該案例並攜帶該次執行證據。切換案例時若有未儲存草稿，沿用放棄修改確認；同案例保留草稿。測試執行中暫停通知編輯。通知為本頁狀態，重新整理或離頁後不保留，完整歷史仍在執行紀錄。Toast改為視窗水平置中、上方約15dvh，最大寬度36rem、窄螢幕保留兩側空間；成功/失敗使用全邊框與底色配文字，7秒自動消失。批次摘要引導使用本頁通知查看各案例結果。

Flow Case 選單的案例列提供刪除圖示與確認視窗。刪除沿用案例庫伺服器操作與版本檢查，排隊或執行中的案例由服務拒絕；成功後移除勾選與本頁排序，保留腳本版本及執行紀錄。本頁既有通知保留結果，但已刪除的案例不再提供編輯。

Android 批次在上一案例完成後，輪詢 Appium 與所需手機狀態，待連線、開機且可操作時再送出下一案例；最多等待20秒。僅在服務明確回覆尚未就緒或已有執行中的拒絕時，以同一requestId等候後重新送出；網路錯誤、逾時或不明伺服器錯誤不得自動重送。明確未開始時顯示案例未開始，結果不明時保留結果未確認提示。

Android 批次在新 API 與 worker 均回報支援時，同一使用者、批次及相同裝置角色可在前一案例成功後暫留 Appium 工作階段，下一案例重新初始化自身變數與前置/清理，並各自保存結果；不同手機配對需先清理再建立工作階段。最後案例、失敗或閒置30秒會清理；清理未確認時封鎖裝置，不能回報已可操作。手機被暫留時保護手動輸入，僅擁有者同批次可繼續。舊 worker 或 API 不宣稱支援共用，仍沿用逐案例建立。
# Android 案例探索

案例編輯器可讓 AI 根據目前手機畫面的 XML 分步探索，支援點擊可唯一辨識的元素、滑動與返回。每次操作前由執行器重新核對畫面；結果不明時停止而不自動重送。AI 無法確定下一步時提問，使用者回覆後可在同一段對話繼續。產生的案例是待套用、儲存及執行驗證的草稿；探索操作不代表測試通過。文字輸入仍需使用者操作；短暫提示不保證出現在 XML，未捕捉到時不能憑空建立斷言。畫面 XML 會提供給所設定的模型服務。

# 持續 Android Agent 任務（2026-10-29）

Flow Case 的「讓 AI 操作手機並觀察」改用後端持續任務，網頁負責顯示與接收回答。任務以帳號、案例及對話隔離，保存目標、近期對話、工具事件、待回答問題、草稿基準版本及修改結果。重新整理或返回後會讀取原任務；控制服務重新啟動時，執行中的任務標示結果未確認，不自動重送操作。停止指令阻止後續操作，正在送出的動作仍可能完成。

探索期間共用單台手機的 Appium 工作階段，支援觀察、唯一元素點擊、一般欄位中文輸入、清空欄位、滑動、返回、隱藏鍵盤、等待及擷取點擊後畫面。手機由任務保留，其他任務與手動控制不能搶用；提問、完成、停止後釋放，才能手動接管。密碼與驗證碼仍由使用者處理。來源定位器必須通過最新畫面核對；僅在執行器明確確認未送出動作時有限度重新觀察，結果未知不能自動重點。

程式碼修改使用帶草稿版本與穩定步驟ID的insert、replace、remove及有限設定操作，由服務端合併、驗證格式與共用案例依賴，不接受整份source覆寫。原有步驟的ID會在新增與修改後保留。使用者仍檢視預覽、套用並儲存；任務不直接建立已儲存案例版本。Agent可從確認的起始狀態執行草稿驗證；只有完整執行結果通過才顯示通過，驗證結果保存於任務，不混入一般已儲存版本的執行紀錄。此版Agent任務為單機；既有雙機Flow Case執行功能保留。

XML輸入欄位與明顯驗證碼數值會遮蔽後保存。每個任務最多保存200份XML證據，保存7天，Agent可依文字查回較早畫面；實際清理於新增觀察時進行，過期資料不再供查詢。手機截圖目前只作本次模型輸入，不保存為案例預覽檔；Codex CLI及相容圖片API可接收，Claude/Gemini橋接維持XML模式。敏感畫面略過截圖。CLI圖片放入本次臨時目錄並於呼叫結束清除，佇列圖片在完成或逾時後移除。實際模型圖片能力與真實App流程仍需部署後驗證。

# Appium 指令通道與 AI 知識（2026-10-30）

Android worker 協定3新增 editorAction、mobileCommand、webdriverCommand，供持續 Agent 操作、自動紀錄與 Flow Case 重播共用。editorAction 的 search 直接觸發焦點欄位的 IME 搜尋，不依賴鍵盤 XML 或座標。mobileCommand 轉送安裝版驅動的 mobile 擴充；webdriverCommand 使用目前 actor 的 session 內路徑，不能指定其他 session、URL、session生命週期或任意execute程式。參數維持有界靜態JSON，Flow支援變數插值、resultPath取值及回傳變數；仍須主流程結果斷言，命令成功不等於測試通過。

Agent 新增 appiumHelp，從執行器安裝版 UiAutomator2 命令表查名稱與必要/可選參數；查詢不操作手機或改稿。操作與撰寫助手均注入共用 Appium 知識，不沿用歷史中的舊版「不支援」描述。命令表只代表驅動宣告，不代表手機實測；不自動安裝其他驅動/外掛或啟用 insecure features。舊版 worker 必須更新重啟才能執行新動作；此檢查涵蓋共用案例依賴與 Agent 驗證。完整契約與範例見 docs/appium-capabilities.md。



## 網站 AI 分析與知識更新

依使用者新要求，網站已啟動本機 Codex 分析，不再只提供複製提示。功能圖與 MD／HTML 知識有 AI 工作進度、取消與驗證套用；知識更新去重、取代舊版先封存並可還原。CLI 使用本機登入但模型推論可能傳到服務，預設不載入使用者 config。詳細契約與限制見 [網站 AI 分析](docs/website-ai-analysis.md)。先前不啟動 CLI 的描述為舊操作限制，已由本次決策取代。

新增知識僅需選擇 MD／HTML／TXT 檔案，先本機略過完全重複內容，唯一高度相似文字以上傳版直接更新並封存；其他來源再交 AI 分類、去重及更新；不再顯示手動分類、功能編號、文字表單或 AI 開關。失敗保留檔案供重試，舊知識沿用封存與還原。

新網頁 UI 流程統一放 tests/ui，既有 tests/web 保留相容；tests/mobile 留給未來原生推播。test:ui 只跑 Playwright web project，不連 Android。離線 HTML 提供摘要、步驟及點擊放大證據，未留圖時仍輸出完整文字；以使用者附件為版型參考，不複製其業務結論、圖片或內嵌腳本。

報告頁固定使用目前已綁定測試專案的 reportDir，進入及分類切換只列出報告，不自動呈現最新正文或額外指令提示。每筆報告以橫幅顯示時間、檔名，並提供「下載」及另開「開啟」HTML，兩者由同一可信 renderer 產生。HTML 保留原版面與正常流程、完整圖片證據，只移除「關鍵畫面」分組標題；錯誤狀態標紅。清單可搜尋並逐批顯示更早報告，無總筆數上限；保留舊根目錄報告（缺類型以 API 相容）。畫面測試設定預設收合。不提供測試執行。

初始設定為全頁四步守衛：設定讀取中或失敗時不掛載產品頁，configured／initialized／onboardingCompleted 任一未完成均停留引導，直接輸入頁面網址或 Escape 不會略過。第一步「AI CLI 設定」支援切換 `Codex`／`Claude Code`／`Gemini CLI` 並檢查本機安裝與登入狀態、提供模型下拉清單與自訂輸入、進階路徑設定、「測試 CLI 連線」與獨立「儲存 CLI 設定」按鈕，非秘密設定暫存於平台 `.local/ai.json` 並於選定或重連測試專案後同步寫入 `.env`（側欄與功能地圖亦顯示目前生效 AI，圖片知識辨識維持僅 Codex 支援）。第二步兩個並排來源選擇，支援受控 Git 下載與本機（點選「本機資料夾」直接開啟電腦資料夾選擇器並保留路徑欄供取消或貼上路徑，不另設「選擇前端專案」按鈕或開啟中橫幅）；第三步單一資料夾選擇置中，測試專案須獨立於平台及前端，保留既有內容。第四步標題「上傳 PRD、業務流程文件」，只用一個置中正方形上傳按鈕與線條圖示，不提供文字輸入框或稍後略過；上傳與整理期間及工作區頁面錯誤／AI 分析進度均改採頂端置中浮動 toast 顯示（分析中保留取消按鈕，完成／錯誤／通知均於 3 秒後自動退場且不設關閉按鈕，頁面重載不重現舊失敗狀態）。沿用 10 MB 檔案上傳與 AI 整理，至少一份有效知識後才能完成。建立框架或上傳文件不自動視為完成；重新整理後接續第四步，已有完成標記不重跳。側欄設定可重開並返回工作區。完成標記存於獨立專案，不是 localStorage。

新建立的獨立測試專案透過既有 skills 遞迴收集，一併交付 skills/setup-android/SKILL.md；README／AGENTS 與 write-push-tests 有明確入口。技能先檢查現有工具，再提供 Android Studio／SDK／Google Play AVD／Appium 官方安裝指引，區分平台 .env 與測試專案 .env，不會自動安裝或執行。SDK、AVD 磁碟、登入資料不隨 Git；平台需找到 SDK 及既有 AVD 後，檢查環境才列出啟動按鈕。既有專案重新連接仍非覆寫，不自動升級技能。

## 測試腳本清單

側欄「測試腳本」（?view=scripts）位於測試流程與測試報告之間，沿用完成初始設定的守衛。進入與重新讀取以 POST /local-api/scripts（空物件、同來源 session）唯讀掃描獨立測試專案 tests/，回傳 summary、scripts、warnings；不讀前端、不 import 或執行腳本、不啟動模型。每個 .spec／.test 的 JS／TS 檔算一支，包含手寫與生成稿；api/ 請求模組、隱藏資料夾、node_modules、legacy、dist、build、coverage 不計入，符號連結略過並明示警告。上限 5000 目錄項目、30 層、20 MB；單檔超過 1 MB 列待核對。總上限超過回傳錯誤，不把部分清單當完整數量。

summary 顯示檔案總數及含測試內容／空白草稿／待核對。以 AST 辨識 test（含具名 import alias）、test.skip／fixme／only 的 callback；callback 有敘述即含測試內容，全部空 callback 為空白草稿；無可辨識宣告、語法錯誤或過大為待核對。測試宣告與標記略過數僅靜態數量，迴圈、條件、動態產生及執行期 skip 不能當實際執行數；含內容不表示完整斷言、可執行或通過。API 單支／API 串接／網頁／Android／其他按 tests/api、flows、ui 或 web、mobile 及其他路徑分類。支援分類按鈕、空狀態、loading disabled 與失敗保留原清單並標記可能過期，不提供腳本編輯／執行。

驗證：先 npm run build --prefix apps/web，再 DS_REQUIRE_BROWSER=1 node scripts/verify-script-inventory-ui.mjs；正式建置與暫存專案驗證檔案統計、分類、重新讀取、失敗保留、axe、鍵盤、target size、桌面縮放及長檔名溢位。

## 測試執行進度

reporter 每個案例結束即原子更新同 runId 報告，快照只含已結束案例且 purpose 標明尚未整批完成；runStatus running／finished／interrupted 區分生命週期，finished 不代表通過。終端輸出案例與 test.step 進度；web 操作 15 秒、導航 30 秒。自訂 context 需另設，既有專案須定向升級，詳見 docs/ui-testing-reports.md。網站不自動輪詢或執行測試。

CLI 的 api／web／android／ui 命令以 --project=名稱 固定 project，支援其後單檔位置篩選；--list --reporter=list 僅驗證載入清單。

## 固定逐操作網頁證據

新專案統一使用 support/web-test.js 的 test／expect／fixture browser：常用操作與畫面斷言逐次保存完成或失敗當下圖，caption 含順序、角色／頁面及動作，特殊操作以 uiStep 明示。CLI web／ui 及 globalSetup 檢查標準 import，並非任意腳本的安全沙箱。全部圖片與步驟保存在單檔HTML，不按八張或容量分卷，不靜默略過證據；圖片只在內嵌資料保存一次並延遲載入、可放大。閱讀器列出全部歷史，搜尋與顯示更多不限制總筆數；單檔512MB，超限明示錯誤，舊JSON及分卷相容保留。原生 Android 不宣稱具備網頁自動包裝能力。既有專案保留明確設定與指引，透過受控備份升級；完整 API 邊界、遮罩限制與驗證見 docs/ui-testing-reports.md。


## 圖文報告與失敗診斷

網站及離線 HTML 共用 framework/journey-report.mjs，使用使用者提供的深藍白紙角色圖文範本。網站外框深色，本文以不含 allow-same-origin 的 sandbox srcDoc 隔離，資料逃逸並限制 CSP；新增單檔圖文下載，前置正文隱藏、詳細操作及回應收合，篩選時重建文件，無新 API 端點。report token 快照源自 Tailwind 設定。catalog 預期、執行實際及安全 diagnostic 為可選欄位；空白頁不得視為就緒，API 等待逾時留操作與現場圖。舊報告不補造，完整契約與驗證見 docs/ui-testing-reports.md。

### 報告條列與完整敘述

報告入口以橫幅清單列報告，每項提供「下載」及另開原版「開啟」HTML，不自動顯示報告正文。HTML 沿用原版版面，案例呈現正常流程及原始畫面證據，僅移除「關鍵畫面」分組，錯誤與失敗標紅。新報告保存scenarioSteps，清楚呈現角色、操作與核對位置；失敗說明已完成與停止步驟，後續未驗證。具體成功結果可由archify-case-result純文字附件提供，僅在成功案例採用；缺少觀察不把預期改成實際。舊報告只依已保存的證據呈現，不覆寫。
