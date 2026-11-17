# 功能、知識與測試關聯

文件版本：1.15

最後更新：2026-11-13

測試報告分 API 與畫面兩類，畫面標示 web／android，分別固定寫入獨立專案 reportDir/api、reportDir/ui，日期時間命名並輸出 JSON／HTML／TXT。schemaVersion 1 新增 testType、screenshotsEnabled、target、dataMode、screenshots，保留舊根目錄報告。config/report.json 的截圖預設關閉，網站可保存下次執行選項；僅新版畫面 fixtures 在開啟時擷取 PNG，API 不留圖。一般畫面使用本機前端 WEB_BASE_URL 與 LIFF mock，並對實際 BFF 資料及 DOM 分別斷言；原生推播另使用 Appium。網站可啟動既有本機 AVD／Appium及選裝置，不提供產品腳本執行，不恢復 VM／舊 Control API。依使用者補充，本輪只準備框架與環境，不開啟 LINE、不擷取實際手機畫面、不發送推播。完整契約見 docs/ui-testing-reports.md。

測試流程共用 catalog，但以案例 target 明確分類：api 為 API 流程，web／mobile／mixed 為畫面流程；kind: flow 可搭配 target: api 表達多 API 串接。舊案例缺 target 時，先依 tests/ui、web、mobile 路徑推定畫面，再依 tests/api、flows 或 kind: api 推定 API，其餘列待分類並提示補齊，不自行改寫檔案。新初始化複製的 AGENTS、案例格式及規劃／實作 skills 均要求明確填 target；既有專案不自動覆寫自訂指引，需定向同步分類規則。

測試流程（?view=flows）為唯讀案例表格，採四欄橫向步驟矩陣（案例／功能｜測試步驟｜使用資料｜預期結果）呈現每一步驟的操作、選填步驟使用資料及逐步預期；前置條件、整體預期與清理方式精簡附於案例末尾橫向摘要列，長篇舊資料以原生 `<details>` 折疊按需展開。僅保留重新讀取與測試專案位置，不提供新增、編輯、確認、任務複製、文字篩選或舊流程檔入口。POST /local-api/case-plans 只讀取並驗證 test-cases/catalog.json，不掃描或執行測試、不讀取舊確認檔；案例格式、版本與既有內容保留。規劃與實作全在本機專案使用 plan-test-cases／implement-tests skill 完成，知識不足在本機對話集中詢問。cases:check 檢查資料完整性並提供非阻擋的品質提醒，status ready 不代表核准或產品通過；--review 及舊確認端點／檔案僅保留相容，不作實作前置條件。測試報告維持 ?view=reports。

## 修訂紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| 1.15 | 2026-11-13 | 測試清單升級為品質、腳本、最近結果與版本分欄追蹤表，新增篩選及品質明細；catalog 回應增加選填 qualityWarnings。未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.14 | 2026-11-13 | cases:check 新增唯讀品質提醒及 --all；不以提醒阻擋實作。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.13 | 2026-11-12 | 葉功能改主區完整閱讀器與 API 流程／測試案例分頁，來源和長步驟按需展開；分類地圖原位置保留，取消寬度相關的右側／下方詳情。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.12 | 2026-11-12 | 功能詳情改為預設可見的前端操作與 API 流程表，新增選填 api／transfer 說明及舊分析升級，來源證據按需展開。未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.11 | 2026-11-12 | 序列圖前移至功能詳情，AI 分析依前端證據產生互動與條件，無案例也可閱讀；舊分析下次執行完整升級，來源異動標示舊圖。功能 metadata 新增選填 sequence，未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.10 | 2026-11-12 | 案例詳情新增按需序列圖與版本相符的逐步結果，steps 選填 interaction，catalog 回應 latest 新增 name／status 摘要；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.9 | 2026-11-11 | 案例規劃 `steps` 擴充選填 `data`（使用資料，最多 2000 字）且輸入／前置步驟允許 `expected` 留空，CaseEditor 支援三欄步驟編輯，`?view=flows` 改為四欄步驟矩陣表格與原生折疊摘要，功能地圖「測試流程」層支援多列網格排列；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.8 | 2026-11-11 | 案例擴充選填 `factor`（測試因子）與 `decisionTable`（決策矩陣表）支援高可讀性減重規劃，功能地圖新增「缺口與覆蓋報表」（含測試金字塔佔比、孤立／廢棄清理清單與 PRD／知識提醒）；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.7 | 2026-11-09 | 測試流程依 target 明確分類，舊案例保留相容並提示待補，初始化 AI 指引同步。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.6 | 2026-11-08 | 報告 API／畫面分類、可選截圖及 TXT，加入本機網頁／Appium fixtures 與受控環境端點；未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.5 | 2026-11-08 | 測試流程簡化為唯讀表格，新增 case-plans 唯讀契約，本機 skill 不再要求網站確認；沿用 view=flows，未改產品 API、GraphQL payload、守衛、導向或 DB schema。 |
| 1.4 | 2026-11-08 | 測試流程改為案例規劃表，共用 catalog 與版本確認記錄，新增 case-confirm 本機契約及兩個本機 AI skill；未改產品 API、GraphQL payload、守衛、導向或 DB schema，沿用 view=flows。 |
| 1.3 | 2026-11-08 | 改為網站按鈕啟動受控本機 Codex 功能／知識分析，支援 HTML、語意去重取代及可還原封存；新增 AI 工作／狀態／取消／還原本機契約，未改產品 API、GraphQL payload、頁面路由、守衛或 DB schema。 |
| 1.2 | 2026-11-08 | 新增前端功能證據包、本機 AI 提案驗證及版本核對套用，總覽與產品／測試分層；新增 frontend-features-prepare／apply 本機契約，未改產品 API、GraphQL payload、守衛、DB schema 或既有頁面路由。 |
| 1.1 | 2026-11-08 | 依使用者校正改為預設 SVG 節點連線地圖，支援縮放平移、節點拖曳與按需詳情；測試清單獨立，表單收斂且技術編號自動產生。未改產品 API、GraphQL payload、守衛、導向、DB schema 或既有本機 API 契約。 |
| 1.0 | 2026-11-08 | 建立案例目錄、專案知識分類編修、腳本關聯與版本證據及網站入口；新增本機 catalog／knowledge-update 契約與 view=catalog／knowledge，未改產品 API、GraphQL payload、守衛或 DB schema。 |

## 權威來源與操作

### 案例流程與序列圖

功能閱讀器是測試前入口：左側或圖上選葉功能即開主區，API 流程／測試案例分頁，無案例亦可閱讀流程。API 表格短讀，長資料與條件可逐步展開，證據收合；案例與最近結果在另一分頁，案例詳情仍在同一主區，不混入 API 表。返回保留分類地圖鏡頭與焦點。既有 frontend.sequence、來源 hash、api／transfer 及逐步報告配對規則不變，未知不推測，詳見 [前端功能總覽](frontend-feature-overview.md)。

互動來源須同時納入所屬 feature.sources，沿用既有逐檔 hash 版本檢查；未納入、無基準、遺失或已變動均列來源問題並停用逐步結果標示。這不等於部署版本證明。

功能地圖 → 功能 → 測試流程／測試清單 → 案例詳情為同一閱讀入口。案例先顯示操作與預期，序列圖預設收合，箭頭編號對應步驟；未提供互動的步驟仍完整列出，不從靜態可達 API 推測順序，不增加獨立圖庫。參考 Astryx CLI 0.7.14 的 Collapsible 與垂直步驟版型，沿用專案 ds 及 Tailwind token，未導入 Astryx runtime 或第二套樣式。

schemaVersion 1 的 steps 選填 `interaction: { from, to, source: { path, line } }`，from／to 各最多 80 字，source 是前端安全相對程式檔案及正整數行號。每列一個互動，回應另列步驟；無證據不填，不推測後端內部流程或保存 token。可開啟既有唯讀程式碼預覽；引用只供查證，不證明業務正確。舊案例不自動補造互動，規劃 skill 於選定流程後依前端及知識補充。

catalog 的 latest 新增 steps（僅 name／status），不增加原始回應或錯誤內容。僅 freshness=current、無來源問題、唯一腳本，且規劃 action 與報告 name 都唯一並完全相同時呈現逐步狀態。缺步驟、同名、版本不符或證據不足標示「未對應」，不推定未執行。失敗箭頭搭配步驟狀態文字，證據由「查看報告」閱讀；這是失敗觀測位置，不代表已查明後端根因。失敗敘述明示「後續業務結果尚未驗證」。

驗證：`DS_REQUIRE_BROWSER=1 node scripts/verify-case-sequence-ui.mjs`，使用暫存案例／報告與正式建置驗證配對、重複拒配、版本變更、來源預覽、編輯保留、鍵盤、axe 與桌面溢位，不呼叫產品 API。

knowledge 保存業務依據；test-cases/catalog.json 保存測試意圖；api／tests 保存請求及實作；reports 保存該次執行。地圖於讀取時從同一資料產生，不另存一份人工流程，也不讓腳本自動改寫需求。網站可啟動本機 Codex 分析來源與知識，模型回傳資料由平台驗證套用；不修改／執行測試腳本。

左側「專案知識」可按業務規則、API 文件、測試規範、補充說明篩選；上傳 MD／HTML／TXT 後自動 AI 分類、去重及更新，不需指定分類或功能編號；後續可編修 metadata。既有 schemaVersion 1 知識索引仍可讀取，缺 metadata 視為補充說明。文件可編輯名稱、內容、分類與功能關聯，內容 hash 與可選 metadata revision 防止舊畫面覆寫外部修改；舊內容備份 knowledge/archive/revisions。實體 .md／.txt 由本機 AI 修改後，清單依實際內容 hash 判定知識是否變動，不以舊 index hash 冒認不變。

「功能地圖」預設顯示真正的 SVG 節點與連線，左側按功能選取；不再以按鈕或順序列表冒充地圖。點擊功能、測試、步驟、API 或待確認節點才顯示詳情。原生 SVG 支援背景拖曳平移、滾輪／按鈕縮放、節點拖曳及適合視窗；方向鍵平移、＋／－縮放、Home 重設、Alt＋方向鍵移動節點、Enter／Space 選取、Escape 關閉詳情，關閉返回節點焦點。圖位置只存在目前畫面，不改寫業務關係。實線表示明確功能／案例歸屬及 API 引用，虛線表示未核對的腳本宣告順序或問題；不推定 token／cardId 傳遞或未分析出的控制分支。多案例各有獨立分支，長名稱換行並有完整可存取名稱。

「測試清單」與「缺口與覆蓋報表」為獨立切換視圖，不與地圖堆疊。「缺口與覆蓋報表」彙整各功能測試因子缺口、API／UI 金字塔佔比、已廢棄／孤立案例待清理清單與知識關聯追蹤。編輯時顯示名稱、目的、預期、前置、驗證對象、測試因子、規劃步驟（步驟／使用資料／逐步預期三欄）、決策矩陣表與清理；新功能另填名稱。ID 自動產生，檔案、測試資料、知識關聯及問題按需展開。圖節點詳情只先顯示相關內容，編號與額外資料收起；API 節點可查看 API／前端來源程式碼。沒有啟動本機編輯器。尚未分類的腳本預設折疊，也提供本機 AI 的功能整理任務文字，不要求逐支人工輸入編號。頁面使用 view=catalog，知識使用 view=knowledge；重新整理可保留入口，未設定仍走既有工作區引導。

## 版控格式與穩定對應

test-cases/catalog.json 的 schemaVersion 為 1，最多 500 個 features、2000 個 cases、整檔 1 MB。features: id、name、sources（path／line，可含平台建立的 hash）；cases: id、featureId、title、kind（api／flow）、purpose、preconditions、data、expected、knowledgeIds、questions（text／answer），script 可指定相對路徑，knowledgeHash 為平台保留的核對基準；選填 steps（`action`／`data`／`expected`，最多 100 項；`action`／`expected` 每欄 5000 字，`data` 最多 2000 字；前置／輸入步驟可將 `expected` 留空，但整體案例須有 `expected`）、cleanup（20000 字）、target（api／web／mobile／mixed）、factor（positive／negative／boundary／security／error）、decisionTable（最多 100 列 `{ point, input, expected }`，集中表達欄位等價類與邊界校驗）為規劃欄位，舊案例缺少時仍可讀，表格顯示尚未填寫。檔案可由本機 AI 編修，格式與範例見 [測試專案說明](../test-project/test-cases/README.md)。

優先依腳本 annotation `{ type: 'archify-case', description: 'TC-...' }` 配對，也接受案例的 script 相對路徑連結舊腳本。相同 ID 多份腳本、路徑與 annotation 衝突都列具體問題，不猜測。改名或搬移仍有固定 ID 時能重新找到；沒有 ID 的路徑連結搬移後需人工補上。新目錄不存在時視為空清單，首次儲存建立；既有目錄不覆寫，更新使用 revision 比對與 legacy/test-cases 備份，跨檔案不是資料庫交易。

## 靜態關聯、來源與待處理事項

讀取 tests/*.spec.ts 的 AST，擷取固定案例／API ID、字串 test.step 或可解析的固定 steps 陣列；遞迴追蹤相對 import／export 及 api 模組。只解析不 import 使用者程式；靜態引用不是執行覆蓋，未解析的動態載入會標示依賴不完整。tests 最多 5000 項，依賴最多 300 檔、24 層、每檔 1 MB；相對路徑不能離開專案，不接受連結，不讀 .env。

API 模組對應最近分析的來源證據。新分析額外保存 sourceFiles 的逐檔 hash，讀取案例時比對相關實體來源，前端改動後先提示重新分析；舊分析沒有逐檔證據則提示重掃。重掃後 API 模組的 query／operationName／方法／端點與分析不同仍列待核對，測試用 variables 不因前端差異自動覆寫。功能手動 sources 也記錄基準及檢查變更／遺失。

待處理項目包括未回答問題、缺少預期、沒有腳本、重複 ID、知識變更／遺失、來源變更、無法完整追蹤的依賴、案例／業務依據在執行後更新。字面或結構比較不證明業務語意一致，不自動宣布「腳本完整覆蓋需求」。修改案例意圖時記錄當前關聯知識 hash，其他案例編修不消除本案例提醒；知識複查基準不等於流程確認，也不能用無意義修改代替核對。

「複製給本機 AI」提供案例、問題、關聯與編修邊界，剪貼簿失敗可展開文字自行複製。AI 在外部工具補充 knowledge、catalog、api 或 tests，再回網站重新讀取。第三方 Archify skill 可依這些資料另外畫圖；此版是內建原生 SVG 互動圖，未安裝該第三方 skill；網站已可啟動受控 Codex 分析功能與知識，但案例規劃及腳本實作交給使用者本機 AI，不自動推定完整業務流程。

## 執行證據與版本

reporter 在開始執行時加入 scriptEvidence：spec、相對 API／共用工具、reporter、設定與套件鎖檔的路徑及 hash；不保存檔案內容、.env 或秘密值。caseEvidence 保存固定案例 ID、測試意圖及關聯知識內容指紋。結束時檢查期間是否改動，改動則證據不完整。

案例頁分開顯示最近結果與版本狀態：尚未執行、報告版本未知、執行版本相符、內容或依賴已更新。舊報告不補造證據；缺少案例／依賴證據、動態依賴或重複配對都不能冒認相符。略過仍是略過；上次通過但內容已更新，不能視為新版通過。保留 schemaVersion 1 的報告及既有閱讀器相容性。

「查看上次報告」導向 view=reports&report=檔名，由既有本機報告端點讀取並經閱讀器格式驗證；錯誤顯示於閱讀器，不用檔名推測通過。單純切換導航保留 view 參數，不新增遠端讀取。

證據不是不可變執行快照、部署版本證明或秘密環境一致性證明；不追蹤外部套件的任意未鎖定實體變更，不保證全部動態依賴、條件分支或環境副作用。catalog 最多檢查 1000 個日期時間報告候選，不完整 JSON 不當作執行證據。產品執行仍由使用者終端執行，本次不自動登入或寫入。

## 本機契約

沿用同來源、loopback、session 及 POST JSON 限制，資料路徑均限定設定目錄。

| 端點 | 輸入與行為 |
| --- | --- |
| POST /local-api/catalog | 回傳 catalog、revision、案例關聯、待處理、宣告步驟、API／來源、最新結果及未連結腳本；不執行程式 |
| POST /local-api/catalog-save | revision、catalog；格式及版本預檢，備份後原子替換目錄檔 |
| POST /local-api/catalog-source | scope: source／project、相對 path；最多 128 KB，只預覽允許副檔名，project 僅 api／tests，不讀環境與憑證檔 |
| POST /local-api/knowledge-update | id、title、content、category、featureIds、expectedHash、可選 expectedRevision；備份後更新，不接受路徑 |

knowledge-import 額外接受每份 category／featureIds；knowledge／knowledge-document 額外回傳 metadata 與實際內容 hash，document 另回傳 revision。新增寫入 body 上限 2 MB，仍受內容本身限制。test-cases 為保留目錄，不能設為 analysis／reports 輸出。

## 驗證

執行 npm run test:workspace、npm test、npm run check:types --prefix test-project、npm run build --prefix apps/web。新增瀏覽器 gate：DS_REQUIRE_BROWSER=1 node scripts/verify-catalog-ui.mjs；既有知識及分析 gate 繼續適用。驗證使用暫存專案與替身報告，不代表產品業務已驗收。

## 前端功能總覽

現行已提供全頁面證據包、本機 AI skill 與提案驗證／套用，預設全部功能，再分產品頁面／API 與測試流程；靜態可達不等於完整業務覆蓋，未分配項目明示，不啟動網頁 Agent。詳見 [前端功能總覽](frontend-feature-overview.md)。

## 網站 AI 分析與知識更新

依使用者新要求，網站已啟動本機 Codex 分析，不再只提供複製提示。功能圖與 MD／HTML 知識有 AI 工作進度、取消與驗證套用；知識更新去重、取代舊版先封存並可還原。CLI 使用本機登入但模型推論可能傳到服務，預設不載入使用者 config。詳細契約與限制見 [網站 AI 分析](website-ai-analysis.md)。先前不啟動 CLI 的描述為舊操作限制，已由本次決策取代。

## 案例品質提醒

npm run cases:check -- --all 批次讀取全部案例，回傳完整性 problems 與品質 warnings；單一案例維持 ID 用法。品質檢查提醒模糊預期、資料占位、重複步驟、缺少來源依據、清理及矩陣缺項，提供欄位位置，不修改案例。只缺品質提醒不改退出碼，完整性錯誤仍為 1。ready 不代表需求完整、矩陣已實作或產品通過；不推斷沒有輸入資料的案例有缺陷。外部既有專案需另行受控升級。


## 測試清單追蹤表

既有功能地圖的測試清單依目前功能子樹讀取案例，分欄顯示功能／案例、案例品質、腳本關聯、最近結果及版本核對。搜尋支援名稱、功能與 ID，類型依 target／既有相容規則區分 API、畫面及未分類；狀態計數基於搜尋與類型範圍，彼此可重疊。預設全部案例，失敗優先，其次為版本、品質與腳本疑點，不隱藏無異常案例。零結果提供清除篩選。

案例品質由本機 catalog 讀取時共用 caseQuality 產生選填 qualityWarnings（code／location／message），不保存到 catalog、不改意圖指紋，不讀取或執行測試模組；完整性 problems 與品質提醒在欄內按需展開。無提醒不是業務完整證明，舊服務未提供該欄位時顯示尚未檢查。唯一腳本才標已連結；路徑存在不等於已實作。最近結果保留上次時間（Asia/Taipei），舊通過在版本未知、來源待核對或腳本歧義時不標綠；未執行顯示尚無報告基準。版本明細保留來源、知識、案例與依賴問題，不推定根因或部署版本。

點案例沿用原詳情及報告連結；返回保留搜尋、篩選與焦點。介面固定深色，沿用 ds 與 Tailwind token、14px 字級、32px 控制項；參考 Astryx CLI 0.7.14 的 table-filter／TableFilterableTable，未安裝 StyleX 或第二套設計 runtime。新版本機讀取直接使用平台共用品質檢查，外部測試專案 CLI 仍需另行升級。

驗證：DS_REQUIRE_BROWSER=1 node scripts/verify-tracking-ui.mjs，以合成專案驗證搜尋、篩選、品質展開、版本區分、焦點返回、axe、桌面尺寸與縮放；不操作產品。
