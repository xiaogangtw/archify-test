# 本機測試專案與報告閱讀器

## 範圍
將預設入口改為無後端的本機流程／報告閱讀器，提供可獨立複製執行的測試專案與撰寫 skills。停止預設 VM、Git、Agent 與 API 服務依賴；舊資料與服務來源保留，尚不自動轉換舊 DB 案例。

接續範圍：依使用者確認，加入受限本機檔案服務，從根目錄 .env 設定來源、獨立測試專案與分析／案例／報告目錄。網頁先確認輸出位置，再唯讀掃描前端 AST、顯示去重接口與服務證據，產生不覆寫的單點請求及測試草稿。測試專案在平台外初始化，無平台依賴，可自行 Git 版控。保留手動報告匯入，加入設定目錄的報告清單。沒有 VM、Git 或 Agent 管理。

## 影響檔案
- apps/web/src/main.tsx、features/reader、vite.config.ts
- test-project/、scripts/dev.mjs、package.json
- README.md、ARCHIFY-CURRENT-SPEC.md、docs/architecture.md、apps/web/README.md、DESIGN.md
- services/local-workspace/、.env.example、前端 workspace UI、獨立專案 HTTP runtime 與技能

## 資料庫影響
新入口不使用資料庫，本機服務以獨立測試專案的檔案為權威來源。不執行 migration、不刪除舊資料。

## 風險
舊報告格式不相容，必須明示拒絕；外部 AI 不受平台權限約束。腳本是真實本機程式，不是隔離沙箱。報告僅保存刻意撰寫的錯誤摘要，不自動保存原始 HTTP 資料。

## 設計文件同步
同步目前規格、架構、操作與前端文件；記錄無後端架構決策。

## 領域
前端、測試框架、架構、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- 接續 UI：新增「補齊缺少腳本」，保留已有檔案並只補缺漏；建立狀態改為「已建立腳本／尚未建立」，詳情拆成固定最右欄。補齊目前獨立專案缺漏，保留 query／variables，不執行產品測試。沿用 UI UX Pro Max 靜態規則及現有 Tailwind tokens。
- 接續補稿：使用者指出 PinCard 缺少草稿。查證舊分析為 66 支且沒有此操作，最新兩份分析為 67 支並已包含 PinCard，但 tests/api 尚無對應檔；只補該支 request-only 草稿，不修改既有腳本或執行產品 API。功能仍是分析與選取生成分開，非掃描漏抓。
- 接續命名：GraphQL 操作名稱為 Query／Mutation／Subscription 或匿名時，依頂層實際欄位命名；保留 payload operationName、query、variables 與 ID，舊名稱仍辨識以防重複產生。更名現有 CheckCard／CheckMobile 並同步來源索引。
- 接續範圍：使用者要求全部只保留 query／variables 與請求設定，移除通用執行／驗證骨架，之後自行填值再由 AI 寫流程。登入操作不另加登入案例、不執行產品請求。僅保留最小 skipped 標記供 Playwright／平台識別草稿；既有非預設案例保護與備份。
- 接續範圍：GraphQL query 與前端呼叫 variables 一起帶入草稿，常數與結構保留，動態／衝突欄位留占位符；不執行前端，秘密值不沿用，不覆寫既有人工腳本。
- 接續修正：根目錄啟動 Vite 的 cwd 造成 Tailwind 未讀取前端設定；修正啟動 cwd、PostCSS 絕對設定路徑與 content 相對基準，補驗開發模式 CSS 轉換。
- npm run build --prefix apps/web：通過 TypeScript 與 Vite 正式建置。
- npm test：4 個框架回歸通過，涵蓋失敗中止、清理、必要斷言、秘密例外不回存、獨立複製執行、失敗 exit code 與 HTML escape。
- npm run test:project、npm run flow:project：本機範例分別產生執行與未執行流程 JSON／HTML；不代表產品或外部 API 驗收。
- DS_REQUIRE_BROWSER=1 node scripts/verify-reader-ui.mjs：以實際正式建置的離線頁通過檔案匯入、loading／disabled、搜尋、篩選、鍵盤展開、格式錯誤保留、XSS 文字呈現、axe WCAG A／AA、390／1024／1280／1440／1920px 長文與 overflow、200% 縮放、32px compact target、焦點、hover／active 對比、reduced motion、無 /api 請求、Tailwind 字級／字重／圓角與 hardcode／emoji／native select 檢查。沒有使用無關上游 JSON 作應用程式驗證。
- 已以瀏覽器實際查看空狀態與案例步驟，操作搜尋與展開；只回傳記憶體畫面，未保存預覽截圖。修正超長英文步驟溢位與主按鈕 active 對比。
- npm run dev：確認只啟動 Vite，既有 5173 被占用時使用 5174。本機 HTTP 瀏覽器驗證先遭網路限制，提升權限後仍連線逾時，因此改驗同一正式 JS／CSS 的離線頁；未宣稱 live HTTP gate 通過。
- npm run docs:plans:index、npm run docs:check：文件與索引檢查通過。git diff --check 通過。
- 未驗證／不包含：真實 API、Web／Android runner、舊 DB／localStorage 遷移、來源掃描轉腳本、外部 AI 權限隔離。舊服務來源及資料保留，新框架不表示已接入舊執行能力。

- 接續修正驗證：node scripts/verify-reader-dev-css.mjs 通過根目錄 cwd 下的 Vite 開發 CSS 轉換，sidebar token 與閱讀器 utilities 均有產生；重新執行前端建置與 DS_REQUIRE_BROWSER=1 的閱讀器瀏覽器回歸通過。修改 apps/web/postcss.config.js、tailwind.config.ts、scripts/dev.mjs 並同步前端文件。

- 接續實作使用使用者指定的前端與外部測試專案；先檢查來源與目的目錄，不在前端安裝套件或修改檔案。完整本機契約已新增 docs/local-workspace.md，純靜態決策由本機服務決策雙向連結取代。

- 接續驗證：npm test 6 項框架／HTTP 回歸通過；npm run test:workspace 3 項掃描、非覆寫、獨立 CLI、路徑／junction、同源／session 回歸通過（junction 於提升權限後實測，未以 SKIPPED 計通過）。
- 前端建置與開發 CSS 驗證通過；DS_REQUIRE_BROWSER=1 的分析 UI 與閱讀器 gate 通過正式 JS／CSS、真實檔案服務、初始化、子目錄、目的位置、選取生成、保留既有檔、設定過期拒絕、恢復清單、報告目錄、搜尋／篩選、鍵盤、axe、390／1024／1280／1440／1920px overflow、200% zoom、目標尺寸、focus、hover／active contrast、reduced motion 與 hardcode／emoji／native select。瀏覽器 gate 僅攔截傳輸到暫存測試服務，不是產品 API 驗收。
- 提升權限後已實測 live Vite HTTP：設定、分析讀取與開發 CSS 均成功；一般沙箱連線的 EACCES 未視為通過。
- 已依使用者指定的來源與 獨立測試專案 初始化外部專案，初步 69 候選納入單元測試；最後排除 test／spec／mock，正式清單為 545 檔、66 個候選（61 GraphQL、5 HTTP）。以原生成內容逐位元核對後，只清理本次誤產生且未修改的 3 組測試 fixture 草稿；來源與既有產品草稿保留。
- 外部專案具自身 framework、skills、requests、fixtures、tests 與設定，確認框架不引用平台；npm run flow 成功，npm test 的 66 支草稿均明確待設定失敗，產品 API 發送為 0。保留原分析與報告作歷史，新報告為 66 支草稿。
- 已檢視真實分析資料的畫面、操作 GraphQL 篩選、選取與展開來源；未保存預覽截圖。平台 .env 已設定使用者路徑且受 Git ignore。
- 未驗證：真實環境與業務斷言、受測部署版本、完整來源覆蓋率、Web／Android runner 與舊 DB 遷移；本機路徑檢查不是 OS 沙箱。

- 最終文件與設計規格同步完成，已更新版本與決策取代連結；完成計畫狀態並重新產生索引。git diff --check 與 docs:check 通過。自訂 reportDir 初始化會加入對應 .gitignore 規則；測試專案其餘檔案可自行 Git 版控。

- 接續範圍：將現行 UI 與新產生專案的使用者可見 API 用語改為「中間層」，技術 ID／路徑維持相容；獨立專案新增 config/http.json 共用 Header，與接口及 fixture 依序合併，不分大小寫，個案可用 null 移除。秘密僅放 .env，不經平台讀取。同步 獨立測試專案 前先核對內容，保留人工修改。

- 中間層用語與共用 Header 接續驗證完成：npm test 8 項、獨立 獨立測試專案 框架 8 項、本機服務 3 項回歸均通過；共用設定檔讀取、大小寫覆寫、null 移除、缺少秘密變數不發送、無效 JSON 拒絕皆有證據。用替身 transport 驗證 獨立測試專案 實際共用檔套用，未發送產品請求。
- 核對前端 client.ts 第 84／86 行的 satoken Header，未發現 Bearer 前綴；只確認欄位與結構，沒有讀取或記錄秘密值。獨立測試專案 新增 config/http.json 只存 SATOKEN 占位符，未修改 .env；框架更新前先確認原內容無人工變更，README／技能以附加方式保留既有內容。
- 前端建置、開發 CSS、DS_REQUIRE_BROWSER=1 的來源分析與閱讀器 gate 皆通過；已實際查看中間層標籤與 Header 說明並操作搜尋，未保存截圖。文件規格升版同步，技術識別與歷史報告保留。

- 接續範圍：BFF_BASE_URL 與 dev／QA 測試環境提示、Asia/Taipei 日期時間報告檔名、清理本次已生成報告；匯入使用者提供的 Playwright 報告技能並依獨立專案調整。依追加要求，tests 與請求／fixture 改採操作名稱，內部 ID 保留，遷移保留內容並更新相對 import，不覆寫衝突。

- BFF／日期報告／可讀檔名接續完成：根框架 10 項、本機服務 4 項回歸通過；外部 獨立測試專案 框架 10 項通過。確認 BFF 優先、舊名回退、明確空值拒絕、台北時間格式、防覆寫、命名碰撞及舊檔遷移保留內容。
- 獨立測試專案 已遷移 66 組共 198 個檔案為操作名稱，內部 ID 與 fixtures／requests 內容保留，只調整案例 import；.env 與範例保留原值改為 BFF_BASE_URL，補上 dev／QA 連線提示。安裝經檢查與調整的 Playwright 報告技能。依使用者要求只清理明確列出的 14 個先前生成報告檔，兩個 reports 目錄目前皆無報告，沒有重產產品報告。
- 使用者 7z 僅取出已列名的技能文字與兩支腳本，未把附件指令當作本任務授權。已移除原專案 .local-prd／隱藏技能／跳過文件規則，改為測試專案 skills 版控與日期報告；原壓縮檔未修改。
- DS_REQUIRE_BROWSER=1 node scripts/verify-playwright-report-skill.mjs 通過合成 390×844 圖片、離線內嵌圖、Esc／關閉／縮放、390／1280 溢位、日期檔名、防覆寫及路徑拒絕。合成測試只存暫存目錄且已清理，不是產品測試證據。
- 前端建置、開發 CSS、分析 UI 與閱讀器 gate 通過；閱讀器回歸改用記憶體合成資料，不要求先產生 reports。Playwright runner／results.json 與平台仍未接入，產品中間層請求數為 0。

- 接續範圍：依使用者試行新寫法，分析產生器改為單一 Playwright .spec.ts，請求、資料與斷言同檔，共用 BFF／Header 保留。加入 Playwright Test 執行與日期報告 adapter，遷移舊稿時保存原始檔與修改內容，未確認業務案例只略過而不宣稱通過。

- 單檔 Playwright 試行完成：66 支腳本轉為 .spec.ts，原三檔與文件完整封存 legacy/pre-playwright/2026-11-07_18-18-36-571-d7cf8fde，共用 Header 與 .env 保留。獨立專案 npm test 為 66 略過、0 通過／失敗；npm run flow 成功，產品請求為 0。後續安全摘要修改逐檔核對同步。
- 本次驗證：前端 build、npm test 10 項、本機服務與原生 Playwright 整合 5 項通過。以 loopback 替身驗證資料型別、成功／失敗、略過與秘密不外洩。DS_REQUIRE_BROWSER=1 分析頁與閱讀器 gate 通過，含略過篩選；實際匯入 66 略過報告並操作查看，未保存截圖。
- 同步目前規格 1.27、本機服務文件 2.0、前端與獨立專案文件／技能及原生 Playwright 決策。瀏覽器未下載，真實業務與 Web／手機未驗收。歷史三檔與 runner 未接入描述為當時證據，現況以目前規格為準。

- GraphQL query／variables 接續完成：從 transport 使用處帶入結構與常數，無 transport 才回退 caller；巢狀物件、陣列、null、布林、數字保留，動態／衝突欄位使用占位符。非秘密預設值轉入 variables，秘密預設遮蔽且保留 $password 等變數引用；query 以可安全轉義的多行字串產生。
- test:workspace 14 項及分析瀏覽器 gate 通過，涵蓋來源不執行、結構／型別／多呼叫衝突、GraphQL 驗證、單檔語法、秘密遮蔽與人工請求保護。無 UI 變更，不需重新設計／視覺驗證。
- 已受控更新 獨立測試專案 的 61 支 GraphQL operation，0 略過；只取代與舊分析相符的請求區，原文備份 legacy/graphql-payload/2026-11-07_22-06-34-867-440819b7。逐檔 TypeScript 解析與 operation 外原文完全一致已核對，scenario、斷言、.env／Header 保留。更新獨立 README 並重掃分析，沒有執行產品 API。
- 同步規格 1.32、本機服務 2.5、架構 1.8 與範本說明；docs:plans:index、docs:check 及 git diff --check 通過。限制：動態整個物件／不支援的 SDK 無法推測欄位，無參數仍為空 variables；既有檔後續 generate 仍不自動覆寫，本次更新為有備份的受控操作。

- 請求資料草稿接續完成：預設產生器只保留 export operation 與 test.skip／archify-id，不產生通用 scenario、固定步驟、網路發送及斷言。舊 settings 遷移明確走 legacy-playwright-source 保留既有可執行案例，不影響其回歸。
- 獨立測試專案 已轉換 66 支預設草稿、0 略過，包含 登入操作；query／variables 與完整 operation 原文逐檔完全一致（AST 區段核對），沒有另建或執行登入案例。原文保存 legacy/request-only/2026-11-07_22-17-21-328-8af2c2ff，README／AGENTS／skills 與起始知識同步，文件與技能原文保留備份。
- test:workspace 14 項與分析 UI gate 通過，確認預設草稿無通用執行、型別／占位保留、舊遷移仍可測試、同步封存／還原與報告功能正常。無 UI 改動，不需新增畫面驗證；沒有產品請求。
- 使用 skill-creator 原則整理既有 write-tests，要求 AI 依業務撰寫真實測試，不能只移除 skip 使空測試通過。同步目前規格 1.33、本機服務 2.6、架構 1.9 及操作文件；docs:plans:index、docs:check、git diff --check 通過。

- 通用 GraphQL 命名接續完成：Query／Mutation／Subscription／匿名改用頂層實際欄位，alias 使用原欄位名、追查 fragment，多欄位以 And 串接；有意義操作名不改，真正碰撞仍加短 ID。顯示名與新稿標題同步，舊命名仍辨識並拒絕重複生成。
- 獨立測試專案 的兩支已更名為 CheckCard.spec.ts、CheckMobile.spec.ts，備份 legacy/operation-names/2026-11-07_22-23-52-678-d463c588，1 份同步索引更新。只改檔名與 test.skip 顯示名稱，query、variables、operationName 與 archify-id 保留，來源與歷史報告未修改。實際服務讀取確認兩支都被識別為已有草稿，TypeScript 解析通過，沒有產品請求。
- test:workspace 16 項與分析 UI gate 通過；新增命名與舊檔防重複回歸。同步規格 1.34、本機服務 2.7、架構 1.10 及測試專案文件，docs:plans:index、docs:check、git diff --check 通過。無 UI 結構／樣式修改，不需額外視覺 gate。

- 補齊及對齊接續完成：新增全清單補齊按鈕，以既有 generate 每批 500 筆、逐批更新狀態與完成後重讀；不受搜尋影響、不覆寫既有檔案。狀態改為已建立腳本／尚未建立，詳情獨立右欄，表頭與列共用四欄 token 及 gutter。
- 前端 build 與 DS_REQUIRE_BROWSER=1 分析 UI gate 通過；新增混合長短狀態下 1024／1280／1440／1920 詳情左右座標一致、搜尋中補齊其他缺少項、舊檔逐位元保留及補齊後按鈕停用檢查，axe、對比、鍵盤、縮放、overflow 與非覆寫回歸通過。實際查看 localhost 1440／1024 畫面，僅回傳記憶體，未存截圖。
- 初查目前 67 筆分析有 5 個缺少檔案；補齊檢查完成後缺少為 0，包含 PinCard、GetInviteUrl、GetOtherRecommends、目前版本 GetCardPreview 與動態 DELETE 候選。最後冪等核對未再新增檔，71 個現存腳本 hash 完全不變（包含保留的歷史來源檔）。沒有自動刪舊檔、沒有產品請求；已建立只代表檔案存在，不代表測試通過。
- 同步目前規格 1.35、本機服務 2.8、前端 2.9、設計 1.9 與 README。docs:plans:index、docs:check、git diff --check 通過，保留原有未提交內容。
