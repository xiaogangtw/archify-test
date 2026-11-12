# Archify 前端

文件版本：2.35

最後更新：2026-11-12

測試報告分 API 與畫面兩類，畫面標示 web／android，分別固定寫入獨立專案 reportDir/api、reportDir/ui，日期時間命名並輸出 JSON／HTML／TXT。schemaVersion 1 新增 testType、screenshotsEnabled、target、dataMode、screenshots，保留舊根目錄報告。config/report.json 的截圖在新專案預設開啟，既有明確關閉保留，網站可保存下次執行選項；僅新版畫面 fixtures 在開啟時擷取 PNG，API 不留圖。一般畫面使用本機前端 WEB_BASE_URL 與 LIFF mock，並對實際 BFF 資料及 DOM 分別斷言；原生推播另使用 Appium。網站可啟動既有本機 AVD／Appium及選裝置，不提供產品腳本執行，不恢復 VM／舊 Control API。依使用者補充，本輪只準備框架與環境，不開啟 LINE、不擷取實際手機畫面、不發送推播。完整契約見 docs/ui-testing-reports.md。

知識上傳每來源最多 10 MB，每批 20 份、總共 20 MB；支援 MD／HTML／TXT／PNG／JPEG／WebP。原始文件與圖片保存 knowledge/sources，整理文字仍採每份 128 KB、最多 500 份的有效知識；索引 sources 與 README 連結保留原始證據。文字相同可略過 AI，唯一高度相似且不超過 128 KB 的文字採上傳版直接更新；原始來源處理紀錄以現行知識 hash 核對，變動則失效。大型來源首次仍逐段分析，超過模型容量的現有知識先檢索候選再比對全文，未選中資料不刪除。圖片只認可見文字及版面，不推測動作或後端，強制標記用途未指定。知識頁可查看原圖及下載原檔；新增 POST /local-api/knowledge-source（id／sha256），同來源 session、路徑、大小與 hash 驗證。完整限制見網站 AI 文件。

測試流程（?view=flows）為唯讀案例表格，顯示 catalog 的前置、步驟／逐步預期、總體預期／清理及待補問題。僅保留重新讀取與測試專案位置，不提供新增、編輯、確認、任務複製、文字篩選或舊流程檔入口。POST /local-api/case-plans 只讀取並驗證 test-cases/catalog.json，不掃描或執行測試、不讀取舊確認檔；案例格式、版本與既有內容保留。規劃與實作全在本機專案使用 plan-test-cases／implement-tests skill 完成，知識不足在本機對話集中詢問。cases:check 預設只檢查資料完整性，status ready 不代表核准或產品通過；--review 及舊確認端點／檔案僅保留相容，不作實作前置條件。測試報告維持 ?view=reports。

## 修訂紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| 2.35 | 2026-11-12 | 葉功能改主區完整閱讀器與 API 流程／測試案例分頁，來源和長步驟按需展開；分類地圖原位置保留，取消寬度相關的右側／下方詳情。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.34 | 2026-11-12 | 功能詳情改為預設可見的前端操作與 API 流程表，新增選填 api／transfer 說明及舊分析升級，來源證據按需展開。未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 2.33 | 2026-11-12 | 序列圖前移至功能詳情，AI 分析依前端證據產生互動與條件，無案例也可閱讀；舊分析下次執行完整升級，來源異動標示舊圖。功能 metadata 新增選填 sequence，未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 2.32 | 2026-11-12 | 案例詳情新增流程步驟、收合序列圖、來源預覽與保守逐步結果配對；本機 catalog latest 新增 steps 摘要，未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 2.31 | 2026-11-11 | 功能地圖總覽摺疊單一純容器 L1 系統節點並彙整群組子功能覆蓋率，新增分支鑽研、頂列與詳情返回／階層麵包屑、節點懸停／聚焦完整名稱讀數列，側欄與 `WorkspaceShell` 左導覽欄皆採隱藏捲軸的獨立捲動（全斷點可捲動）並為功能樹補齊去紅點縮排及跨重載記憶收合資料夾，測試清單納入子樹並保留選中焦點及來源／問題摘要；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.30 | 2026-11-11 | 依 Astryx 規範建立共用意圖設計系統 `src/components/ui/ds/` 與表面階層語意色，並全面重整現行工作區與閱讀器排版與精簡文案；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.29 | 2026-11-11 | 初始設定第一步點選「本機資料夾」直接開啟資料夾選擇器（移除「選擇前端專案」按鈕與開啟中橫幅），第三步知識整理改採單一頂端橫幅 toast 並於完成後消失；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.26 | 2026-11-10 | 報告閱讀器以隔離 srcDoc 使用共用圖文範本，新增圖文下載、卷別及診斷。報告 JSON 增加可選預期／實際／診斷，未改路由、守衛、導向、API 端點、產品 API、GraphQL payload 或 DB schema。 |
| 2.25 | 2026-11-09 | 新增 view=scripts 測試腳本唯讀清單及 POST /local-api/scripts，顯示實際檔案數與內容判讀、分類及限制。新增入口與本機 API，未改既有守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 2.24 | 2026-11-09 | 流程按 target 明確分類，缺值保留舊路徑推定及待分類提示；同步初始化 AI 指引。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.23 | 2026-11-09 | 知識匯入先略過相同來源、直接更新唯一高度相似文字，保留舊版還原；本機 AI 工作結果增加略過及直接更新數。未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 2.22 | 2026-11-08 | 初始設定改全頁三步守衛、Git／本機選擇與單一 PRD 上傳；新增 clone-source 本機契約及完成條件。改進入守衛，未改路由名稱、產品 API、GraphQL payload 或 DB schema。 |
| 2.21 | 2026-11-08 | 報告頁固定目前專案，進入／分類切換自動讀取最新結果，移除匯入與目錄操作，歷史及畫面設定收合。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.20 | 2026-11-08 | 新網頁流程採 tests/ui，保留 tests/web；HTML 提供情境摘要與放大證據，test:ui 僅使用 Playwright 網頁。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.19 | 2026-11-08 | 報告 API／畫面分類、可選截圖及 TXT，加入本機網頁／Appium fixtures 與受控環境端點；未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 2.18 | 2026-11-08 | 加入 10 MB 知識來源、圖片辨識、分段整理與原始資產預覽／下載；新增 knowledge-source 本機契約，未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 2.17 | 2026-11-08 | 測試流程簡化為唯讀表格，新增 case-plans 唯讀契約，本機 skill 不再要求網站確認；沿用 view=flows，未改產品 API、GraphQL payload、守衛、導向或 DB schema。 |
| 2.16 | 2026-11-08 | 測試流程改為案例規劃表，共用 catalog 與版本確認記錄，新增 case-confirm 本機契約及兩個本機 AI skill；未改產品 API、GraphQL payload、守衛、導向或 DB schema，沿用 view=flows。 |
| 2.15 | 2026-11-08 | 導覽分開測試流程（view=flows）與測試報告（view=reports），各自篩選檔案並拒絕錯誤種類；補充 LINE OA 知識邊界。未改守衛、產品 API、GraphQL payload 或 DB schema。 |
| 2.14 | 2026-11-08 | 新增知識簡化為選檔即自動 AI 分類、去重與更新，移除手動分類、功能編號、文字輸入及 AI 開關；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.13 | 2026-11-08 | 改為網站按鈕啟動受控本機 Codex 功能／知識分析，支援 HTML、語意去重取代及可還原封存；新增 AI 工作／狀態／取消／還原本機契約，未改產品 API、GraphQL payload、頁面路由、守衛或 DB schema。 |
| 2.12 | 2026-11-08 | 新增前端功能證據包、本機 AI 提案驗證及版本核對套用，總覽與產品／測試分層；新增 frontend-features-prepare／apply 本機契約，未改產品 API、GraphQL payload、守衛、DB schema 或既有頁面路由。 |
| 2.11 | 2026-11-08 | 依使用者校正改為預設 SVG 節點連線地圖，支援縮放平移、節點拖曳與按需詳情；測試清單獨立，表單收斂且技術編號自動產生。未改產品 API、GraphQL payload、守衛、導向、DB schema 或既有本機 API 契約。 |
| 2.10 | 2026-11-08 | 新增專案知識分類編修、固定案例目錄、腳本關聯地圖與依賴／意圖版本提示；新增 catalog／knowledge-update 本機契約及 view=catalog／knowledge 入口，未改產品 API、GraphQL payload、守衛或 DB schema。 |
| 2.9 | 2026-11-07 | 新增全清單補齊缺少腳本及明確建立狀態，詳情獨立固定右欄；分批沿用非覆寫生成契約，未改路由、守衛、導向、API payload、GraphQL payload 或 DB schema。 |
| 2.8 | 2026-11-07 | 新增來源同步索引、消失腳本候選與確認封存／非覆寫還原；新增本機 archive-removed、restore-removed 契約，未改路由、守衛、導向、GraphQL payload 或 DB schema。 |
| 2.7 | 2026-11-07 | 已初始化或匯入資料時不自動開啟引導，介面改以專案流程、精簡腳本列及知識雙欄預覽為主；本機 config 新增 knowledgeCount，未改路由、守衛、導向、GraphQL payload 或 DB schema。 |
| 2.6 | 2026-11-07 | 加入三步工作區設定與獨立專案 Agent 知識庫，新增本機設定／知識契約與知識庫導覽；未改既有路由、守衛、GraphQL payload 或 DB schema。 |
| 2.5 | 2026-11-07 | 新稿改為單一原生 Playwright .spec.ts，接入略過／實際步驟報告並保留舊稿；初始化格式升為 2，本機 caseFile 指向新格式，未改路由、GraphQL payload 或 DB schema。 |
| 2.4 | 2026-11-07 | 改用 BFF_BASE_URL、台北日期時間報告與操作名稱檔案，加入 Playwright 圖文報告技能；本機分析新增 caseFile，未改路由、GraphQL payload 或 DB schema。 |
| 2.3 | 2026-11-07 | 現行畫面用語改為中間層，獨立專案新增共用 Header 與個案覆寫／移除；未改路由、守衛、導向、HTTP 契約、GraphQL payload 或 DB schema。 |
| 2.2 | 2026-11-07 | 加入 .env 控制的本機來源分析、獨立測試專案初始化、單點 API 草稿與報告目錄讀取；新增 /local-api 契約與分析導覽，未改既有 API、GraphQL payload 或 DB schema。 |
| 2.1 | 2026-11-07 | 修正根目錄啟動的 Tailwind 設定與 content 解析基準，補入開發模式 CSS 驗證；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 2.0 | 2026-11-07 | 預設改為靜態本機報告閱讀器，移除後端守衛與舊導覽入口；未改既有 API、GraphQL payload 或 DB schema。 |

## 啟動與建置

根目錄執行 npm ci --prefix apps/web，再 npm run dev。獨立啟動也可 npm run dev --prefix apps/web。npm run build --prefix apps/web 產生 dist，npm run preview --prefix apps/web 可預覽。Vite dev／preview 提供同來源 /local-api 本機檔案服務；不代理舊 /api，也不依賴 VM。來源分析另需根目錄 npm ci 提供既有 AST 解析依賴。

根目錄啟動器將工作目錄設為 apps/web；PostCSS 以設定檔自身位置指定 tailwind.config.ts，content 路徑亦以 Tailwind 設定檔為基準。從根目錄執行 node scripts/verify-reader-dev-css.mjs 可驗證 Vite 開發模式的 CSS 轉換，涵蓋 sidebar token 與閱讀器 utilities，不只驗證正式建置。

## 現行入口

src/main.tsx 掛載 features/workspace/WorkspaceApp.tsx，提供三步設定、來源分析、Agent 知識庫與報告閱讀。report.ts 驗證新 JSON 契約；資料透過本機服務從固定專案讀取，僅存 React 記憶體。支援搜尋、狀態按鈕篩選、原生 details 鍵盤展開、錯誤保留舊資料。單份最多 10 MB；由本機服務自動讀取固定報告目錄；不接受任意路徑，也不啟動測試。

固定 GitHub 式深色、compact 14px；tokens 唯一來源仍為 tailwind.config.ts，工作區共用設計系統元件位於 `src/components/ui/ds/`（`WorkspaceShell`、`PageHeader`、`ActionButton`、`SegmentedGroup`、`Badge`、`StatStrip`、`SearchField`、`TextField`、`TextAreaField`、`MetadataGrid`、`Disclosure`、`EmptyState`、`WorkspaceIcon`）。桌面左側精簡導覽、右側內容，窄視窗堆疊。無動畫、原生 select、模型或 Git 整合；知識庫管理專案文字文件，不是模型內部記憶。loading 為檔案讀取狀態，無後端輪詢。

[測試專案](../../test-project/README.md) 負責產生 JSON／HTML；頁面顯示檔案宣告結果，不認證內容。舊 App、testing 與 assistant 模組保留供遷移，未掛載；既有驗證文件只代表舊入口。新驗證入口為 node scripts/verify-reader-ui.mjs，需先建置前端、設 DS_REQUIRE_BROWSER=1；使用 Playwright／Chrome 開啟正式產物的離線頁，READER_URL 可指定已啟動的本機前端網址；未保存預覽截圖。

## 來源分析

由平台 .env 指定來源與獨立測試專案；先確認位置、初始化，再掃描與選取產生草稿。路徑輸入是受限根目錄下的子路徑，不是任意檔案管理器；沒有原生 select。詳見[本機分析文件](../../docs/local-workspace.md)。UI gate：DS_REQUIRE_BROWSER=1 node scripts/verify-local-workspace-ui.mjs，使用正式產物與真實檔案服務，瀏覽器傳輸攔截到暫存專案。

中間層用語僅改現行顯示名稱，不更換技術 ID、操作名稱或目錄；來源與輸出區會提示共用 Header 在獨立專案 config/http.json、秘密放 .env，不在網頁輸入或顯示秘密。

目前產生的是單一 .spec.ts，畫面提示在同檔修改請求、資料與斷言，網址／Header 繼續共用。閱讀器新增 skipped 案例與略過篩選，不將全略過當成功。

## 工作區設定與知識庫

SetupWizard 依序選擇來源、腳本位置與匯入知識；WorkspaceDialog 使用原生 modal dialog，提供 Escape、焦點循環與返回焦點。完成狀態由專案檔案保存，亦可稍後設定。KnowledgeWorkspace 提供文件／文字匯入、名稱搜尋、純文字預覽及封存確認；資料留在獨立專案 knowledge/。不將文件送模型或執行其內容。新增 gate：DS_REQUIRE_BROWSER=1 node scripts/verify-knowledge-ui.mjs；原生選擇器使用替身，其餘設定與檔案服務實際操作暫存專案。

已有初始化／匯入資料的專案不再自動開啟引導（不依賴額外完成按鈕）。SourceWorkspace 首屏是專案流程與緊湊腳本列，資料夾設定與來源細節用 details；KnowledgeWorkspace 使用 token knowledge-reader 雙欄、預設收起新增區。採用使用者指定的 UI UX Pro Max 資訊層級與可存取性規則，未取代現有 Tailwind token 來源。

## 已移除來源的腳本

重新完整分析後，SourceWorkspace 顯示「前端未再出現」可展開清單。選取後以 destructive 對話框確認，成功可按「還原上次移除」；取消不改檔。來源或腳本 hash 過期時保留錯誤與清單，重新分析再確認。解析不完整或不同範圍不提供候選，原因在資料夾設定；不將疑似修改當成刪除。不動共用資料與手動腳本。詳細索引、封存路徑、還原與跨電腦限制見本機分析文件。

SourceWorkspace 的「補齊缺少腳本」分批處理全部分析項目，既有檔案保留，完成後刷新檔案狀態；不受搜尋篩選影響。標籤為已建立腳本／尚未建立，與執行結果分開。api-catalog token 改四欄，表頭與列採一致 checkbox gutter、詳情固定右欄。UI gate 驗證混合狀態對齊與全清單補齊不覆寫。

## 功能與測試案例入口

CatalogWorkspace 新增 readingFeatureId 閱讀狀態，保留分類 featureId 及地圖掛載，左側／圖上點葉功能直接進 FeatureReader。API 流程與測試案例使用可及性分頁；來源按需展開，點步驟看完整資料，主區不再依斷點分成右欄／下方詳情。案例、程式碼詳情同樣在主區閱讀，返回恢復原分類鏡頭及焦點；FeatureMap 忽略隱藏時的零尺寸觀察以保留鏡頭。編修與新增案例沿用原入口，新增綁定目前閱讀功能，儲存返回案例分頁。沿用 view=catalog、既有型別與後端資料；gate 更新於 verify-frontend-overview-ui.mjs 和 verify-catalog-ui.mjs。

案例詳情由 `CaseSequence` 先呈現步驟與預期，再按需展開有 interaction 來源的序列圖；未提供互動不猜測。序列圖編號對應步驟，來源連到既有程式碼預覽。最新報告只在版本相符、無來源問題、唯一腳本與唯一同名步驟時顯示狀態；未對應不代表未執行，不將整案通過套到每一步。沿用 Astryx 的漸進揭露指引與專案 ds／Tailwind，無新增套件或樣式表。契約與限制見 [測試關聯](../../docs/test-traceability.md)，瀏覽器 gate 為 `DS_REQUIRE_BROWSER=1 node scripts/verify-case-sequence-ui.mjs`。

WorkspaceApp 新增 view=catalog 與 view=knowledge，重新整理保留入口。CatalogWorkspace／CaseEditor／FeatureMap 分別顯示案例、編修意圖與同資料的關聯圖；SourceWorkspace 不變。知識頁改為「專案知識」，新增分類及適用功能、內容編修。案例與知識支援 loading／錯誤／選取／空狀態及版本競爭錯誤，純文字導航與原生 details，無 native select、裝飾動畫或執行控制。完整資料契約見 [測試關聯](../../docs/test-traceability.md)。UI gate：DS_REQUIRE_BROWSER=1 node scripts/verify-catalog-ui.mjs。

## 圖形入口與操作

view=catalog 現行預設為「功能地圖」，不是舊四欄關聯列表。feature-graph.ts 建立真實節點與依證據區分的連線，並於總覽摺疊單一無直接來源或案例的 L1 系統包裝節點、依子功能樹彙整群組覆蓋率與支援群組分支鑽研；「測試流程」層依案例數量採 1~4 欄多列網格排列避免高密度案例單列過寬；FeatureMap 支援原生 SVG 平移、縮放（高密度群組以可讀倍率初始化並保留適合視窗）、頂列返回與階層麵包屑、節點懸停／聚焦完整名稱讀數列、節點拖曳與鍵盤操作，MapDetails 只在點選後顯示並附階層麵包屑與子功能鑽研入口。側欄依 `parentId` 樹狀縮排並以資料夾圖示／空心圓區分群組與尚未測試的葉功能（不顯示滿版紅點與 `0`），`WorkspaceShell` 主導覽與功能清單採各斷點無滾條獨立捲動及跨重載記憶收合狀態的分類資料夾，側欄僅於仍有未連結腳本時顯示「尚未分類（N）」並將「手動分析工具」移至右側寬版主區底部以 1→2→3 步驟呈現，地圖對無案例群組節點改用中性「分類／尚無案例」樣式；測試清單納入子樹案例、顯示所屬功能與來源變更／`需補充` 摘要且切回地圖保留選中案例，缺口與覆蓋報表排除純容器誤報，CaseEditor 的技術欄位預設收合、步驟改為三欄（步驟／使用資料／逐步預期）、ID 自動產生。網站可啟動受控 AI 整理功能與知識；案例規劃與腳本實作則複製採簡短步驟矩陣格式的任務到本機 AI 工具。幾何互動用 SVG 屬性，不寫 inline style；map-canvas、map-browser、map-detail 及 map-wide token 均在 Tailwind config。驗證：node scripts/verify-feature-graph.mjs 及 DS_REQUIRE_BROWSER=1 node scripts/verify-catalog-ui.mjs。

## 前端功能總覽

現行已提供全頁面證據包、本機 AI skill 與提案驗證／套用，預設全部功能，再分產品頁面／API 與測試流程；靜態可達不等於完整業務覆蓋，未分配項目明示，不啟動網頁 Agent。詳見 [前端功能總覽](../../docs/frontend-feature-overview.md)。

## 網站 AI 分析與知識更新

依使用者新要求，網站已啟動本機 Codex 分析，不再只提供複製提示。功能圖與 MD／HTML 知識有 AI 工作進度、取消與驗證套用；知識更新去重、取代舊版先封存並可還原。CLI 使用本機登入但模型推論可能傳到服務，預設不載入使用者 config。詳細契約與限制見 [網站 AI 分析](../../docs/website-ai-analysis.md)。先前不啟動 CLI 的描述為舊操作限制，已由本次決策取代。

新增知識僅需選擇 MD／HTML／TXT 檔案，先本機略過完全重複內容，唯一高度相似文字以上傳版直接更新並封存；其他來源再交 AI 分類、去重及更新；不再顯示手動分類、功能編號、文字表單或 AI 開關。失敗保留檔案供重試，舊知識沿用封存與還原。

新網頁 UI 流程統一放 tests/ui，既有 tests/web 保留相容；tests/mobile 留給未來原生推播。test:ui 只跑 Playwright web project，不連 Android。離線 HTML 提供摘要、步驟及點擊放大證據，未留圖時仍輸出完整文字；以使用者附件為版型參考，不複製其業務結論、圖片或內嵌腳本。

報告頁固定使用目前已綁定測試專案的 reportDir，進入與分類切換列出報告，不自動載入最新內容，也不呈現「尚未開啟報告」或指令提示。每筆橫幅顯示時間與檔名，提供「下載」及另開「開啟」HTML；兩者使用同一可信 renderer。HTML 保持原有版型及全部畫面證據，只移除「關鍵畫面」分組，保留正常流程並標示錯誤。報告清單支援搜尋與顯示更多，不限制歷史總筆數。保留舊根目錄報告（缺類型以 API 相容）、深連結安全檔名檢查與畫面測試設定收合。

初始設定為全頁三步守衛：設定讀取中或失敗時不掛載產品頁，configured／initialized／onboardingCompleted 任一未完成均停留引導，直接輸入頁面網址或 Escape 不會略過。第一步兩個並排來源選擇，支援受控 Git 下載與本機（點選「本機資料夾」直接開啟電腦資料夾選擇器並保留路徑欄供取消或貼上路徑，不另設「選擇前端專案」按鈕或開啟中橫幅）；第二步單一資料夾選擇置中，測試專案須獨立於平台及前端，保留既有內容。第三步標題「上傳 PRD、業務流程文件」，只用一個置中正方形上傳按鈕與線條圖示，不提供文字輸入框或稍後略過；上傳與整理期間改以單一置頂橫幅 toast 顯示進度並於完成後消失，不重複顯示整理橫幅。沿用 10 MB 檔案上傳與 AI 整理，至少一份有效知識後才能完成。建立框架或上傳文件不自動視為完成；重新整理後接續第三步，已有完成標記不重跳。側欄設定可重開並返回工作區。完成標記存於獨立專案，不是 localStorage。

測試流程（?view=flows）以四欄橫向步驟矩陣表格（案例／功能｜測試步驟｜使用資料｜預期結果）顯示每個案例的步驟、使用資料與逐步預期，並於案例末尾摘要列顯示精簡前置、整體預期與清理（長文以原生 `<details>` 折疊）。分類以 catalog.target 為準：api 顯示 API，web／mobile／mixed 顯示畫面；kind: flow 也可為 API 串接。舊案例僅依腳本路徑或 kind: api 推定，無法判定列待分類並提示 AI 補值。AI 規劃分類規則與矩陣寫法見 test-project/test-cases/README.md；初始化會複製相關指引，既有專案保留人工內容，不自動覆寫。

## 測試腳本清單

側欄「測試腳本」（?view=scripts）位於測試流程與測試報告之間，沿用完成初始設定的守衛。進入與重新讀取以 POST /local-api/scripts（空物件、同來源 session）唯讀掃描獨立測試專案 tests/，回傳 summary、scripts、warnings；不讀前端、不 import 或執行腳本、不啟動模型。每個 .spec／.test 的 JS／TS 檔算一支，包含手寫與生成稿；api/ 請求模組、隱藏資料夾、node_modules、legacy、dist、build、coverage 不計入，符號連結略過並明示警告。上限 5000 目錄項目、30 層、20 MB；單檔超過 1 MB 列待核對。總上限超過回傳錯誤，不把部分清單當完整數量。

summary 顯示檔案總數及含測試內容／空白草稿／待核對。以 AST 辨識 test（含具名 import alias）、test.skip／fixme／only 的 callback；callback 有敘述即含測試內容，全部空 callback 為空白草稿；無可辨識宣告、語法錯誤或過大為待核對。測試宣告與標記略過數僅靜態數量，迴圈、條件、動態產生及執行期 skip 不能當實際執行數；含內容不表示完整斷言、可執行或通過。API 單支／API 串接／網頁／Android／其他按 tests/api、flows、ui 或 web、mobile 及其他路徑分類。支援分類按鈕、空狀態、loading disabled 與失敗保留原清單並標記可能過期，不提供腳本編輯／執行。

驗證：先 npm run build --prefix apps/web，再 DS_REQUIRE_BROWSER=1 node scripts/verify-script-inventory-ui.mjs；正式建置與暫存專案驗證檔案統計、分類、重新讀取、失敗保留、axe、鍵盤、target size、桌面縮放及長檔名溢位。


## 圖文報告與失敗診斷

網站及離線 HTML 共用 framework/journey-report.mjs，使用使用者提供的深藍白紙角色圖文範本。網站外框深色，本文以不含 allow-same-origin 的 sandbox srcDoc 隔離，資料逃逸並限制 CSP；新增圖文下載及卷別，篩選時重建文件，無新 API 端點。report token 快照源自 Tailwind 設定。catalog 預期、執行實際及安全 diagnostic 為可選欄位；空白頁不得視為就緒，API 等待逾時留操作與現場圖。舊報告不補造，完整契約與驗證見 docs/ui-testing-reports.md。
