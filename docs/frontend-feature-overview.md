# 前端功能總覽與本機 AI

文件版本：1.7

最後更新：2026-11-11

## 修訂紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| 1.7 | 2026-11-11 | 功能地圖總覽摺疊單一純容器 L1 系統節點並彙整群組子功能覆蓋率，新增分支子圖鑽研、頂列返回／階層麵包屑、懸停／聚焦完整名稱讀數列，側欄改為去紅點與 `0` 噪音的樹狀縮排、獨立捲動與可收合記憶資料夾；測試清單納入子樹案例並顯示來源變更／問題摘要，地圖／清單切換保留選中案例並排除缺口報表純容器誤報。未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.6 | 2026-11-11 | 功能地圖顯示目前生效 AI（工具與模型），AI 分析進度／完成／失敗改以頂端置中 3 秒自動退場浮動 Toast 呈現（不設關閉按鈕、重載僅接續執行中任務），後端改用嚴格 JSON Schema 約束 `--output-schema`；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.5 | 2026-11-11 | 「測試流程」地圖分層依案例數量採 1~4 欄多列網格排列，並於高密度節點群組開啟時改用可讀初始縮放倍率；AI 補齊草稿任務文字同步採用簡短步驟矩陣（含步驟使用資料 `data`）；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.4 | 2026-11-11 | 功能地圖新增「灰色：已廢棄／下線（`state: 'not-found'`）」狀態分流與孤立案例清理清單，強化 L2 業務域上限 6、同層重複名稱與步驟式命名檢核，新增「缺口與覆蓋報表」與測試金字塔統計；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.3 | 2026-11-11 | 功能地圖驗證加入 MECE 4 級（L1~L4）`level`、`parentId` 階層與單節點最多 8 個子分支約束，總覽介面依測試案例數與正反向涵蓋程度呈現紅／黃／綠覆蓋狀態並將跳轉／關聯連線分層切換；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.2 | 2026-11-09 | 功能分析加入增量範圍、無變更略過模型與解析快取。本機 AI 工作結果增加分析模式與頁數；未改路由、守衛、導向、產品 API、GraphQL payload 或 DB schema。 |
| 1.1 | 2026-11-08 | 改為網站按鈕啟動受控本機 Codex 功能／知識分析，支援 HTML、語意去重取代及可還原封存；新增 AI 工作／狀態／取消／還原本機契約，未改產品 API、GraphQL payload、頁面路由、守衛或 DB schema。 |
| 1.0 | 2026-11-08 | 新增前端路由／頁面證據包、本機 AI 提案驗證套用與全功能／產品／測試圖分層；新增 frontend-features-prepare／apply 本機契約，未改產品 API、GraphQL payload、守衛、DB schema 或 view=catalog 路由。 |

## 使用方式

功能地圖預設為「全部功能」，總覽節點依測試案例與 `factor`／覆蓋情形顯示綠（充分覆蓋）、黃（部分覆蓋）、紅（漏測，僅標記實際葉功能）與灰（已廢棄／下線）框線及文字標記，跨功能跳轉／關聯連線預設收起並可於控制列切換；若只有單一無直接頁面／API／案例的 L1 系統包裝節點且已存在子功能，總覽圖會摺疊該重複外殼並將其名稱提升為專案根節點，且無直接案例的群組父層（L2／L3）依所有子功能結果彙整覆蓋率與總案例數（尚未建立案例時以中性「分類／尚無案例」呈現）。點選任何分支節點可沿子功能樹向下鑽研，地圖頂列與詳情面板均提供返回上一層／總覽及階層麵包屑導覽，畫布底部讀數列於懸停或鍵盤聚焦節點時即時顯示未截斷完整名稱；側欄清單則依 `parentId` 呈現樹狀縮排，頂層分類以資料夾圖示區隔、次分類不掛狀態點、尚未建立測試的葉功能以中性空心圓顯示且省略 `0`，僅有案例或已廢棄項目才顯示語意點與數量；主導覽側欄與功能側欄皆採獨立捲動並隱藏捲軸（功能清單於各寬度視窗均保留捲動且搜尋欄置頂，僅尚有未連結腳本時於側欄顯示「尚未分類（N）」並隱藏其滾軸），避免長清單拖動外層頁面才看得到右側地圖；分類資料夾預設展開並可點擊箭頭圖示收合／展開（不顯示展開／收合文字、記憶於本機瀏覽器且搜尋時仍顯示命中子項）。原手動準備／複製／載入工具改置於右側寬版主區域底部之「手動分析工具」，依步驟 1→2→3 卡片引導並將任務原文收合於「查看任務指令原文」。除「地圖」與「測試清單」（支援子樹範圍過濾、所屬功能標示、來源變更提醒、`需補充` 摘要與切回地圖保留選中案例）外，另提供排除純系統／分類容器誤報的「缺口與覆蓋報表」（含測試金字塔 API／UI 佔比、孤立案例待清理清單與 PRD／知識雙向比對提醒）。點葉節點進入「產品頁面與 API」，可再切換「測試流程」。前者顯示 AI 功能分組、辨識頁面與靜態可達 API，後者依案例數採 1~4 欄多列網格排列案例及腳本 test.step（高密度群組初始開啟維持可讀縮放，亦可點「適合視窗」縮放總覽）；無案例的產品功能照常顯示，漏測或部分覆蓋功能可直接開啟測試編輯器或複製採簡短步驟矩陣格式的 AI 補齊測試草稿任務。點頁面可預覽前端程式碼，點 API 預覽獨立專案模組；不執行程式。Flow 案例沿用固定 ID／script 路徑關聯，不從產品頁面自動假造已驗收測試。

網站主要操作為「AI 分析功能」，背景工作自動準備證據、呼叫受控本機 AI CLI（Codex 以嚴格 JSON Schema 約束輸出結構並容錯解析圍欄）、驗證來源與知識版本並套用地圖。頁首顯示目前生效 AI，分析中（可取消）、完成、失敗與工作區錯誤均改以頂端置中 3 秒自動退場浮動 Toast 呈現（不設關閉按鈕，頁面重載不重現舊失敗）；無需複製任務到外部聊天。原手動準備／複製／載入工具仍保留於「手動分析工具」。CLI 使用本機登入，推論仍會送到模型服務，不表示離線。詳見 [網站 AI 分析](website-ai-analysis.md)。

## 證據來源及限制

frontend-snapshot.mjs 由平台與交付框架共用：唯讀、不接受來源連結，略過隱藏檔、測試、秘密命名檔、套件／建置目錄。最多 20000 項、3000 檔、20 MB、單檔 1 MB，與 API 掃描一致。檔案來源內容不寫入證據包，只存 hash、匯入關係、可解析路由／頁面與非秘密 metadata。不能保證任意字串無敏感資訊，Git 提交前仍須審查。

frontend-features.mjs 重用 TypeScript AST 與 sourceModuleResolver，支援快照內 tsconfig／jsconfig 的 alias、相對匯入、React.lazy／動態 import 的固定字串、路由物件 path／component 與 JSX Route 之固定頁面。常數字串／物件屬性及 imported 常數可追查；不執行設定／來源。路由表的 title、description、requireAuth／onlyGuest 有解析到才保存，不從名稱推測權限。子路由 url 保留宣告值，不宣稱完整部署路徑；動態工廠、執行期組裝、自訂 router、Vue／Svelte 與非標準 alias 不保證解析。共用 Page 包裝或錯誤元件可能出現在頁面候選，AI 可保留未分配。

頁面到 API 以整個靜態匯入可達集合估計，barrel export、共用 hook／service 會擴大範圍，不是精確函式層級呼叫、不代表所有 API 都執行。產品圖的 API 關聯用虛線與「靜態可達 API」說明，不以箭頭推測 token／cardId 或業務順序。總覽專案到功能是分類歸屬，不是導航；產品頁面與測試流程分開。

證據包保留 files、modules、routes、pages、apis、sourceHash、catalogRevision、warnings／unresolved、previousFeatures 與 changes。changes 記錄相對上次套用的 added／modified／removed 與受影響功能。網站 AI 只須完整交代本次範圍的頁面／API，平台保留其他功能並合併後驗證全圖覆蓋。手動工具仍要求完整提案。來源或 catalog 變動後必須重備證據並合併最新資料，不能硬改 hash 繞過。

## 增量分析與快取

網站第一次分析（含尚無增量基準的舊專案）完整建立基準，保存來源位置的 SHA-256 與知識 revision，不寫入來源絕對路徑。後續來源與知識都沒變時，不呼叫模型、不改寫 catalog 或建立地圖備份；仍核對目前來源及案例版本。同來源位置且來源 hash 相同時，重用路由／頁面證據與服務記憶體內 API 解析結果。讀檔、hash、安全路徑及腳本狀態檢查仍執行，不以 mtime 猜測未變更。證據快取有版本，來源異動重新靜態解析；API 解析快取於服務重啟後重建。

修改檔案依頁面靜態 import 的遞迴依賴找受影響頁面，再擴大到既有功能的全部頁面；共用 hook／service 因此可能涵蓋多個功能。新增頁面／API 納入分析，刪除的關聯納入既有功能複查；範圍內 API 可與保留功能共用。範圍外 ID 列為保留，模型不得占用。片段優先提供異動檔、路由、頁面與依賴，仍受原有大小限制。

以下情況完整分析：來源位置或知識 revision 改變、tsconfig／jsconfig／package.json 異動、路由對應或 metadata 改變、新增解析警告、異動檔案涉及警告／未解析路由、未解析清單改變，或異動無法歸入已知頁面／功能／路由／API。既有未受變更影響的警告保留。登入守衛或全域 provider 若無法界定歸屬亦完整分析；能解析的共用依賴則擴大到所有受影響頁面，不以修改行數判斷。

合併保留未受影響功能、案例與人工名稱。既有跨範圍關聯僅在兩端仍存在且證據檔未變時保留，範圍內關聯由本次結果更新；證據有變的跨範圍關聯移除，等待更完整分析補充。靜態依賴不能證明執行期行為，增量不等於業務正確或產品驗收。背景工作結果附 mode（full／incremental／unchanged）、reason；執行分析時附 analyzedPages／totalPages。決策見 [功能圖增量分析](decisions/2026-11-09-incremental-feature-analysis.md)。

## 提案與套用

schemaVersion:1，sourceHash 與 catalogRevision 必須來自證據包。features 包含固定 id、name、選填 `level`（1=系統、2=業務域、3=模組、4=原子功能）、選填 `parentId`（須指向高層級父節點且禁止循環）、description、evidence（code／inferred）、有效 sources（path／line）、pageIds、apiIds、questions。L1 系統下最多 6 個 L2 業務域，其餘父節點子功能數與 `relations` 中 `kind: 'navigation'` 單節點出邊數均限制最多 8 個；禁止同層重複功能名稱及將「第一步／步驟 1」等流程描述寫成功能節點。relations 包含 from／to 功能 ID、kind（navigation／related）、evidence 與有效來源；本次沒有證明的跨功能順序不硬加 relation。關係 metadata 保存供後續使用，總覽可按需切換呈現導航／相關邊並區分證據，仍不宣稱完整使用者旅程。

每個已辨識頁面必須只分配一次，API 可跨功能；未分配的必須列在 unassignedPageIds／unassignedApiIds。驗證器核對有效 ID、來源、行號及大小；這是結構和來源存在性驗證，不證明 AI 業務判斷正確。最多 500 功能、2000 關係、提案 2 MB；證據包讀取上限 8 MB，套用後 catalog 上限 1 MB。

套用先重新讀取實際來源快照及 catalog revision，保留既有案例、人工名稱與 sources，只更新／增加功能的 frontend metadata；原有但未再出現的 AI 功能標記 not-found，不刪測試。備份 legacy/frontend-map/時間與 UUID 的 catalog／proposal，再暫存 rename 替換；不是 DB 跨檔交易，也不是自動重試機制。未核對的業務規則保存 questions，不變成正式斷言。

archify.config.json 新專案會保存 analysisDir，獨立 CLI 不依賴平台。既有專案若用自訂 analysisDir，需在明確升級時同步該非秘密設定；不把本機前端絕對路徑寫死進可攜資料。

## 本機契約與驗證

沿用 loopback、同來源、session、POST JSON 與檔案範圍限制。

| 端點 | 行為 |
| --- | --- |
| POST /local-api/frontend-features-prepare | 重新分析、準備受控證據包；回傳相對檔名、pages／routes／apis 筆數、hash 與限制 |
| POST /local-api/frontend-features-apply | 讀設定分析目錄的固定提案檔，驗證目前來源／案例版本，備份後合併 |
| POST /local-api/catalog | 額外回傳 frontendPreparation；catalog 內可含 frontendAnalysis 及功能 frontend metadata |

驗證使用 npm run test:workspace、npm test、node scripts/verify-feature-graph.mjs、npm run build --prefix apps/web，以及 DS_REQUIRE_BROWSER=1 node scripts/verify-frontend-overview-ui.mjs 和既有 verify-catalog-ui.mjs。全部使用暫存來源／假資料，不代表受測產品測試通過。

## 整理邊界

功能總覽建議維持精簡且彼此互斥（MECE 4 級樹狀結構），未分類頁面與未對應 API 會明列於未分配清單，解析警告與略過大檔保留；靜態數量僅反映可讀快照，不代表全產品業務覆蓋保證，且不自動新增虛構案例或執行產品腳本。

## 網站 AI 分析與知識更新

依使用者新要求，網站已啟動本機 Codex 分析，不再只提供複製提示。功能圖與 MD／HTML 知識有 AI 工作進度、取消與驗證套用；知識更新去重、取代舊版先封存並可還原。CLI 使用本機登入但模型推論可能傳到服務，預設不載入使用者 config。詳細契約與限制見 [網站 AI 分析](website-ai-analysis.md)。先前不啟動 CLI 的描述為舊操作限制，已由本次決策取代。
