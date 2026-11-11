# Archify Design System

文件版本：1.24

最後更新：2026-11-11

測試報告分 API 與畫面兩類，畫面標示 web／android，分別固定寫入獨立專案 reportDir/api、reportDir/ui，日期時間命名並輸出 JSON／HTML／TXT。schemaVersion 1 新增 testType、screenshotsEnabled、target、dataMode、screenshots，保留舊根目錄報告。config/report.json 的截圖在新專案預設開啟，既有明確關閉保留，網站可保存下次執行選項；僅新版畫面 fixtures 在開啟時擷取 PNG，API 不留圖。一般畫面使用本機前端 WEB_BASE_URL 與 LIFF mock，並對實際 BFF 資料及 DOM 分別斷言；原生推播另使用 Appium。網站可啟動既有本機 AVD／Appium及選裝置，不提供產品腳本執行，不恢復 VM／舊 Control API。依使用者補充，本輪只準備框架與環境，不開啟 LINE、不擷取實際手機畫面、不發送推播。完整契約見 docs/ui-testing-reports.md。

知識上傳每來源最多 10 MB，每批 20 份、總共 20 MB；支援 MD／HTML／TXT／PNG／JPEG／WebP。原始文件與圖片保存 knowledge/sources，整理文字仍採每份 128 KB、最多 500 份的有效知識；索引 sources 與 README 連結保留原始證據。大型來源逐段分析，超過模型容量的現有知識先檢索候選再比對全文，未選中資料不刪除。圖片只認可見文字及版面，不推測動作或後端，強制標記用途未指定。知識頁可查看原圖及下載原檔；新增 POST /local-api/knowledge-source（id／sha256），同來源 session、路徑、大小與 hash 驗證。完整限制見網站 AI 文件。

## 流程與報告閱讀器

現行入口提供前端來源分析、獨立腳本輸出與測試流程／結果閱讀。沿用 GitHub 式黑灰深色、Inter／Noto Sans TC、14px 內文、20px 頁標題與 32px compact 控制項；唯一 token 來源仍是 apps/web/tailwind.config.ts。

桌面左側為分析／案例／報告／專案知識文字導覽與工作區設定入口。首次三步對話框依序顯示前端來源、腳本位置、知識匯入；使用原生 modal、焦點循環、Escape 與返回焦點，無動畫。知識頁以左側搜尋／文件、右側純文字內容構成雙欄；新增表單及儲存位置預設收起；封存確認使用 destructive 語意並保留原檔。分析頁以實際前端、輸出專案與知識數量構成流程列，下方為中間層名稱／腳本／建立狀態／詳情的四欄緊湊列；端點與來源證據在列內展開。資料夾設定預設收起，「分析前端」置於頁首；有分析結果後為次操作，清單主要操作為「補齊缺少腳本」，選取建立為次操作。建立狀態用明確文字「已建立腳本／尚未建立」，詳情獨立固定右欄。移除候選以「前端未再出現」展開清單呈現，選取後以 destructive 確認封存，成功提供還原；無候選不佔版面。報告頁固定目前測試專案，自動讀取最新檔案；無 JSON 匯入或目錄編修。外框維持深色、14px 控制項，本文使用使用者提供的深藍標頭白紙圖文範本：情境、預期／實際、角色操作圖、診斷及清理。網站以隔離 iframe 呈現同一個離線 HTML 產生器，搜尋與狀態篩選重建文件；保留鍵盤、放大、Escape、卷別及圖文／文字下載。舊報告缺少的資料明示未保存，不補造。沒有動畫或產品執行控制。

窄視窗基本堆疊，長英文步驟、來源 hash 與案例名稱可換行。下方總覽／角色等描述屬舊入口，不代表現行閱讀器仍掛載相關元件。架構與契約見目前規格及前端 README。

功能地圖為預設入口，左側是緊湊功能選擇，中央為原生 SVG 節點與連線；沒有點選前不顯示詳情。點節點後右側顯示相關說明或程式碼，窄桌面詳情移到圖下方。測試清單獨立切換，不堆在圖下面。圖形實體只保留名稱與種類，技術編號、檔案與額外資料按需展開；新增表單先呈現測試名稱、目的及預期。支援平移、縮放、節點拖曳與鍵盤替代，狀態不只靠顏色；實線及虛線分別表達已知關聯與待確認／宣告流程。無背景裝飾、動畫、主題切換或捏造業務分支；幾何座標為圖資料，顏色字體與頁面版面仍用 Tailwind tokens。

功能地圖預設為全部功能；專案到功能的線代表分組，不代表業務導航。點功能後可切換產品頁面與 API、測試流程；無測試功能仍可查看來源，避免空清單被誤認成沒有該功能。頁首主要操作改為 AI 分析功能，顯示安全階段與取消；原手動工具收起。知識匯入只保留選檔；選檔即自動 AI 分類、去重及更新，不需分類／功能編號／文字表單或 AI 開關，HTML 不執行。AI 更新提供衝突與可還原入口，不增聊天 Agent 或腳本執行控制。

測試流程（?view=flows）為唯讀案例表格，顯示 catalog 的前置、步驟／逐步預期、總體預期／清理及待補問題。僅保留重新讀取與測試專案位置，不提供新增、編輯、確認、任務複製、篩選或舊流程檔入口。POST /local-api/case-plans 只讀取並驗證 test-cases/catalog.json，不掃描或執行測試、不讀取舊確認檔；案例格式、版本與既有內容保留。規劃與實作全在本機專案使用 plan-test-cases／implement-tests skill 完成，知識不足在本機對話集中詢問。cases:check 預設只檢查資料完整性，status ready 不代表核准或產品通過；--review 及舊確認端點／檔案僅保留相容，不作實作前置條件。測試報告維持 ?view=reports。

## 概觀

Archify 是桌面測試工作台。依使用者最新方向，採 GitHub 式黑灰底、白字與緊湊尺度，原創白瓷小鳥只作小尺寸裝飾。功能、路由與整合狀態仍以 [目前規格](ARCHIFY-CURRENT-SPEC.md) 為準。

唯一 token 來源為 [Tailwind config](apps/web/tailwind.config.ts)，不另產生主題 JSON 或元件 CSS。全站工作區（`WorkspaceApp`、`SetupWizard`、`SourceWorkspace`、`CatalogWorkspace`、`FlowWorkspace`、`ScriptWorkspace`、`KnowledgeWorkspace`、`ConfiguredReports`、`ReportReader`）均已統一套用共用意圖設計系統元件庫（`apps/web/src/components/ui/ds/`），依 Astryx 規範採單一區域對齊線、表面明度階梯與緊湊工具列取代重複外殼與冗餘文字說明。

## 色彩

| Token | 用途 |
| --- | --- |
| 1.19 | 2026-11-08 | 報告 API／畫面分類、可選截圖及 TXT，加入本機網頁／Appium fixtures 與受控環境端點；未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.18 | 2026-11-08 | 加入 10 MB 知識來源、圖片辨識、分段整理與原始資產預覽／下載；新增 knowledge-source 本機契約，未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |
| 1.17 | 2026-11-08 | 測試流程簡化為唯讀表格，新增 case-plans 唯讀契約，本機 skill 不再要求網站確認；沿用 view=flows，未改產品 API、GraphQL payload、守衛、導向或 DB schema。 |
| 1.16 | 2026-11-08 | 測試流程改為案例規劃表，共用 catalog 與版本確認記錄，新增 case-confirm 本機契約及兩個本機 AI skill；未改產品 API、GraphQL payload、守衛、導向或 DB schema，沿用 view=flows。 |
| 1.15 | 2026-11-08 | 導覽分開測試流程（view=flows）與測試報告（view=reports），各自篩選檔案並拒絕錯誤種類；補充 LINE OA 知識邊界。未改守衛、產品 API、GraphQL payload 或 DB schema。 |
| 1.14 | 2026-11-08 | 新增知識簡化為選檔即自動 AI 分類、去重與更新，移除手動分類、功能編號、文字輸入及 AI 開關；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| canvas | GitHub 式黑灰頁面背景 |
| surface | 稍亮的面板、表單與浮動表面 |
| surface-subtle / surface-active | 淺一階次要列表底與選取／hover 表面階梯 |
| sidebar | 最深的導覽背景 |
| ink／muted | 白色主文字／灰色輔助文字，須通過 AA 對比 |
| line／line-strong | 細分隔線／控制項 hover 邊界 |
| brand／brand-soft／brand-strong | 白色主操作、深灰選取表面與白色 hover；不是彩色品牌面積 |
| danger／warning／success | 克制的失敗、警告與成功語意色，搭配狀態文字 |
| report.* | 同一 Tailwind 設定內的紙本輸出色彩；PDF 維持白底深字，不沿用螢幕深色 |

不使用彩色幾何大面積、紙張點陣、漸層或發光。固定深色，不新增主題切換。app-shell 的 color-scheme 為 dark，讓原生瀏覽器控制項與主題一致。

## 文字

Inter／Noto Sans TC，字重 400／500／700。一般內文、側欄、表單與控制項統一 14px；總覽標題使用 text-heading 20px，面板標題 text-body 14px，結論 text-section 16px。既有 24／32px token 保留供原頁面使用，不同時重做全站標題。PDF 保留既有 13／15px 專用字級。

## 版面

以 4／8px 間距為基礎，桌面為唯一產品優先。總覽外距 20–24px，內容最大 76rem；頁首最小 32px，區段間 20px，面板工具列與底列採 12px 垂直留白，內容採 20px 水平／24px 垂直留白。桌面驗證 1024／1280／1440／1920px，保留窄視窗基本堆疊。

總覽左側為結果分布與結論，右側採 18rem 最近執行側欄，最多列時間倒序三筆案例名稱、時間與結果。長名稱最多兩行，完整名稱由 title 提供；不列錯誤明細與版本。原有最後執行時間不再重複顯示。唯一「查看執行紀錄」入口位於右欄底部。

## 深度與形狀

面板 rounded-xl，控制項 rounded-lg。使用完整細邊框區分表面，不用單側狀態色邊或層疊陰影。表面以黑灰明度差建立層次。

## 元件

| 元件／模式 | 規則 |
| --- | --- |
| Button | 沿用共用元件；總覽使用 compact 密度，至少 32px 高。肯定主操作 primary，查看 secondary／ghost，刪除 danger。保留 hover／active／focus／disabled |
| ResultDistribution | 144px 環形圖，依實際六狀態筆數繪製比例；圖例為 14px，結論 16px。色彩搭配文字，SVG 有文字替代，空資料只畫中性環 |
| WorkspaceIdentity | 頁首只保留 20px 總覽名稱，不放大型插圖 |
| RecentActivity | 右側近期活動區塊，頂部 80px 白瓷小鳥，搭配中性幾何。時間線最多三筆，依 createdAt 排序，唯一底部查看入口。空資料顯示尚無執行紀錄 |
| Notice | 同步失敗保留資料並說明結果可能不完整；不把錯誤當空資料 |

沒有新增裝飾動畫、loading 或 selected 假狀態；總覽查看操作為同步導覽。原創角色使用內建 image_gen 產生透明 PNG，實體資產與生成提示位於 [brand](apps/web/public/brand/README.md)。目前使用白瓷小鳥、石墨灰與少量冷灰藍，取代大眼機器人；裝飾空 alt 並以 aria-hidden 隱藏，不充當結果證據。

## 採用與限制

- 依既有 runHistory 計算，非完整歷史與批次品質報告，不捏造通過率或趨勢。
- 只有一個查看紀錄入口，不預先篩選或定位單筆。
- 深色 token 為全站共用；總覽的新密度不代表其他工作區已全部回歸。
- report 語意色依使用者圖文範本更新；唯一來源仍是 Tailwind 設定，獨立測試專案使用由此生成的 token 快照，不建立第二套應用程式樣式表。

## 修訂紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| 1.24 | 2026-11-11 | 依 Meta Astryx（`@astryxdesign/cli@0.7.13`）設計方法建立共用意圖設計系統 `apps/web/src/components/ui/ds/`，新增 `surface-subtle`／`surface-active` 表面階梯色、`lg:grid-cols-map-browser` 調整為 `14rem`，並全面精簡工作區與閱讀器排版與文案；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.23 | 2026-11-11 | 初始設定第一步點選「本機資料夾」直接開啟電腦資料夾選擇器（移除「選擇前端專案」按鈕與開啟中橫幅），第三步知識整理改採單一頂端橫幅 toast 並於完成後消失；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.22 | 2026-11-10 | 報告本文採使用者深藍白紙圖文範本，外框維持深色，report token 快照由 Tailwind 設定產生。報告 JSON 增加可選預期／實際／診斷，未改路由、守衛、導向、API 端點、產品 API、GraphQL payload 或 DB schema。 |
| 1.21 | 2026-11-08 | 初始設定改全頁三步守衛、Git／本機選擇與單一 PRD 上傳；新增 clone-source 本機契約及完成條件。改進入守衛，未改路由名稱、產品 API、GraphQL payload 或 DB schema。 |
| 1.20 | 2026-11-08 | 報告頁固定目前專案，進入／分類切換自動讀取最新結果，移除匯入與目錄操作，歷史及畫面設定收合。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.13 | 2026-11-08 | 改為網站按鈕啟動受控本機 Codex 功能／知識分析，支援 HTML、語意去重取代及可還原封存；新增 AI 工作／狀態／取消／還原本機契約，未改產品 API、GraphQL payload、頁面路由、守衛或 DB schema。 |
| 1.12 | 2026-11-08 | 新增前端功能證據包、本機 AI 提案驗證及版本核對套用，總覽與產品／測試分層；新增 frontend-features-prepare／apply 本機契約，未改產品 API、GraphQL payload、守衛、DB schema 或既有頁面路由。 |
| 1.11 | 2026-11-08 | 依使用者校正改為預設 SVG 節點連線地圖，支援縮放平移、節點拖曳與按需詳情；測試清單獨立，表單收斂且技術編號自動產生。未改產品 API、GraphQL payload、守衛、導向、DB schema 或既有本機 API 契約。 |
| 1.10 | 2026-11-08 | 新增專案知識分類編修、固定案例目錄、腳本關聯地圖與依賴／意圖版本提示；新增 catalog／knowledge-update 本機契約及 view=catalog／knowledge 入口，未改產品 API、GraphQL payload、守衛或 DB schema。 |
| 1.9 | 2026-11-07 | 新增全清單補齊缺少腳本及明確建立狀態，詳情獨立固定右欄；分批沿用非覆寫生成契約，未改路由、守衛、導向、API payload、GraphQL payload 或 DB schema。 |
| 1.8 | 2026-11-07 | 新增來源同步索引、消失腳本候選與確認封存／非覆寫還原；新增本機 archive-removed、restore-removed 契約，未改路由、守衛、導向、GraphQL payload 或 DB schema。 |
| 1.7 | 2026-11-07 | 已初始化或匯入資料時不自動開啟引導，介面改以專案流程、精簡腳本列及知識雙欄預覽為主；本機 config 新增 knowledgeCount，未改路由、守衛、導向、GraphQL payload 或 DB schema。 |
| 1.6 | 2026-11-07 | 加入三步工作區設定與獨立專案 Agent 知識庫，新增本機設定／知識契約與知識庫導覽；未改既有路由、守衛、GraphQL payload 或 DB schema。 |
| 1.5 | 2026-11-07 | 加入 .env 控制的本機來源分析、獨立測試專案初始化、單點 API 草稿與報告目錄讀取；新增 /local-api 契約與分析導覽，未改既有 API、GraphQL payload 或 DB schema。 |
| 1.4 | 2026-11-07 | 預設入口改為無後端的本機流程／報告閱讀器，加入獨立測試專案；替換原入口與後端守衛，不再進入舊導覽，未改既有 API、GraphQL payload 或 DB schema。 |
| 1.3 | 2026-11-03 | 新增右側最近三筆執行時間線，換用小型白瓷小鳥；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.2 | 2026-11-03 | 依使用者最新方向改為黑灰白深色系、compact 總覽與 64px 灰階角色，PDF 維持紙本色；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.1 | 2026-11-03 | 依使用者 GitHub 參考精修工具列、表面分層、圖例與中性邊界；未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.0 | 2026-11-03 | 建立總覽採用的設計系統、環形結果分布、14px 桌面字級與遷移限制；未改路由、守衛、導向目標、API、GraphQL payload 或 DB schema。 |


## 設計方法

現行 UI 系統遵循工作區安裝之 Meta Astryx 設計規範（`.agents/skills/astryx/`，取材 `@astryxdesign/cli@0.7.13`），將元件架構與版面節奏落地為 `apps/web/src/components/ui/ds/`（`WorkspaceShell`、`PageHeader`、`ActionButton`、`ActionLink`、`SegmentedGroup`、`Badge`、`StatusDot`、`StatStrip`、`Banner`、`SearchField`、`TextField`、`TextAreaField`、`MetadataGrid`、`Disclosure`、`EmptyState`、`WorkspaceIcon`），完全以既有 `apps/web/tailwind.config.ts` 與 Tailwind CSS v3 utilities 實作，不使用外掛 CSS、CSS-in-JS、行內 `style`、原生 `<select>`、硬編碼 hex 或 emoji；互動狀態維持無動畫（`0s` transition）並保留可略過引導、清楚焦點與 AA 對比。

先前減字參考上游 `ui-ux-pro-max-skill` 之歷史說明保留供追溯；本專案仍以 `apps/web/tailwind.config.ts` 與本文件規範為唯一準據。

## 網站 AI 分析與知識更新

依使用者新要求，網站已啟動本機 Codex 分析，不再只提供複製提示。功能圖與 MD／HTML 知識有 AI 工作進度、取消與驗證套用；知識更新去重、取代舊版先封存並可還原。CLI 使用本機登入但模型推論可能傳到服務，預設不載入使用者 config。詳細契約與限制見 [網站 AI 分析](docs/website-ai-analysis.md)。先前不啟動 CLI 的描述為舊操作限制，已由本次決策取代。

報告頁固定使用目前已綁定測試專案的 reportDir，進入與分類切換會自動列檔並開啟最新報告；重新整理重讀最新結果。頁面不提供 JSON 匯入、資料夾選擇或完整路徑編修。專案名與報告數簡要顯示，歷次報告以日期列表收合，保留檔名 title／可及名稱與舊根目錄報告（缺類型以 API 相容）。畫面測試設定預設收合。深連結 report 仍限定原本安全相對檔名；讀取失敗保留已開啟內容，快速切分類以請求序號避免過期回覆覆蓋。未提供測試執行。

初始設定為全頁三步守衛：設定讀取中或失敗時不掛載產品頁，configured／initialized／onboardingCompleted 任一未完成均停留引導，直接輸入頁面網址或 Escape 不會略過。第一步兩個並排來源選擇，支援受控 Git 下載與本機（點選「本機資料夾」直接開啟電腦資料夾選擇器並保留路徑欄供取消或貼上路徑，不另設「選擇前端專案」按鈕或開啟中橫幅）；第二步單一資料夾選擇置中，測試專案須獨立於平台及前端，保留既有內容。第三步標題「上傳 PRD、業務流程文件」，只用一個置中正方形上傳按鈕與線條圖示，不提供文字輸入框或稍後略過；上傳與整理期間改以單一置頂橫幅 toast 顯示進度並於完成後消失，不重複顯示整理橫幅。沿用 10 MB 檔案上傳與 AI 整理，至少一份有效知識後才能完成。建立框架或上傳文件不自動視為完成；重新整理後接續第三步，已有完成標記不重跳。側欄設定可重開並返回工作區。完成標記存於獨立專案，不是 localStorage。


## 共用圖文報告

報告本文的深藍標頭、白紙情境、角色／動作／預期／實際及三欄旅程圖依使用者範本，不套用產品外框深色。16px 報告本文與14px圖說沿用允許字級，32px標題、24px情境、12px面板圓角及8px控制項。無裝飾圖示或動態。圖文與網站使用相同產生器，文字安全逃逸、隔離框架標題及 CSP，鍵盤 Tab 進入內容、Space 展開、Escape 關閉圖片；不以原始錯誤內容作診斷。未知、略過及證據缺失以文字表達。
