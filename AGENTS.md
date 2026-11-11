# Archify Test：Agent 專案規則

本文件適用於本儲存庫。回覆、計畫與專案文件預設使用繁體中文；識別字、指令與路徑保留原文。

## 現行產品入口

依使用者確認，現行產品為本機來源分析框架與流程／報告閱讀器；以 test-project/ 的獨立 CLI 框架與 skills 管理測試，使用者在自己的編輯器或 AI 工具修改並自行 Git 版控。Vite 同來源 /local-api 依測試專案 .env 限定來源，平台僅以排除 Git 的 .local/workspace.json 定位外部測試專案，提供唯讀掃描、非覆寫草稿產生與報告目錄讀取；測試專案必須在平台與來源之外。平台不提供 VM、舊 Control API、Git 版控管理（初始 clone 限縮例外見文末）、模型／Agent、記憶管理、腳本編輯或執行控制；相關舊規則僅適用保留中的舊模組，不應恢復到新入口。舊來源與資料保留供遷移，未自動轉換。新 UI 仍適用下方深色 token、字級、可及性與驗證規則。

根目錄 npm test 驗證新框架；舊 Control API 測試使用 npm run test:legacy。閱讀器驗證先建置前端並產生範例報告，再設 DS_REQUIRE_BROWSER=1 執行 node scripts/verify-reader-ui.mjs；預設在同一正式建置上攔截本機測試傳輸，驗證固定專案自動讀取，不提供離線匯入頁，READER_URL 可切換至實際預覽網址。測試專案的 AGENTS.md 是獨立交付範本，並非本儲存庫入口的重複副本。

## 1. 優先順序與工作入口

- 使用者明確指示優先；本專案規則優先於上游設計指南。
- 直接在本儲存庫工作。前端位於 `apps/web`，使用 React、TypeScript、既有 Tailwind CSS v3。
- 開始前檢查工作目錄與差異，保留使用者尚未提交的修改，不任意還原、覆寫或清理。
- 先讀 [文件總索引](docs/README.md)、[目前規格](ARCHIFY-CURRENT-SPEC.md) 及受影響模組文件，再讀程式。
- 本檔是共同規則入口，不建立重複的 `agent.md`。其他工具入口應連結本檔，避免複製後漂移。

## 2. 文件同步與任務計畫

**實作變更必須在同一變更中同步相關文件。文件應描述實際行為與限制，不能只補日期。**

### 2.1 計畫建立時機

- feature、bugfix、refactor、跨文件整理或規則調整：實作前在 `docs/plans/` 建立計畫。
- 單純問答、唯讀調查、單一文件錯字或連結修正可免建計畫，仍須保持相關描述一致。
- 同一任務接續工作時更新原計畫，不為每次對話或小修另開檔案。
- 檔名為 `YYYY-MM-DD-<kebab-case-title>.md`；日期依使用者時區，預設 Asia/Taipei。

```markdown
# 任務名稱

## 範圍
目的、完成條件與不包含的工作。

## 影響檔案
- 實際路徑或模組，調查後可更新。

## 資料庫影響
無，或 migration、相容性與回復方式。

## 風險
相容性、安全、部署與資料影響。

## 設計文件同步
需更新的目前規格、模組 README、API、資料流等；不適用時說明原因。

## 領域
例如：前端、Android、API、文件治理。

## 任務狀態
- [x] 已開始
- [ ] 實作完成
- [ ] 文件已同步
- [ ] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
實際指令、結果、未驗證範圍與阻礙。
```

- 勾選代表里程碑實際完成；「已開始」是歷程紀錄，完成後保留勾選。
- 純文件任務的「實作完成」指文件或治理工具修改完成。不需設計文件更新時，寫明理由才能勾選。
- 必要工作或檢查受阻時，不勾選「可供審查」並宣稱完成。

### 2.2 索引、歸檔與現況來源

- `docs/plans/README.md` 自動產生月份與領域索引，不手動修改。
- 新增、移動、更名、修改領域或狀態後，執行 `npm run docs:plans:index`。
- 結束前執行 `npm run docs:check`；索引過期視為文件未完成。
- 月份結束後，全部完成的計畫移至 `docs/plans/archive/YYYY-MM/`；未完成的保留原處。
- 歸檔只移動，不刪除或合併歷史計畫；修正相對連結，再產生索引。修改已完成的非當月計畫時，一併歸檔。
- 計畫記錄背景、範圍與完成證據，不是系統現況的權威來源。

## 3. 設計文件與決策紀錄

### 3.1 同步規則

本專案以 `ARCHIFY-CURRENT-SPEC.md` 為整合規格，專題文件補充細節；不另造與它競爭的總 SDD，也不直接套用其他專案的路由與文件路徑。

| 變更 | 同步內容 |
| --- | --- |
| 頁面入口、路由、守衛、導向 | 目前規格、模組入口、進入條件、頁面對應與驗證方式 |
| API、GraphQL payload、授權 | 契約、資料來源、錯誤、權限與相容性 |
| service、Agent、worker | 模組責任、資料流、失敗、重試與清理 |
| DB schema | migration、資料關聯、相容性與保留方式 |
| 第三方整合與秘密參照 | 整合邊界、設定、權限與驗證限制 |
| 啟動、部署、操作 | 根目錄 README 或對應部署文件 |
| UI 與共用元件 | 本檔、前端 README 或目前規格相關段落 |

- 修改路由前先找實際入口與文件。本專案沒有範本所述第 9 節路由 SDD 索引，不可假設存在。
- 詳細行為寫回對應主題章節，不新增獨立的日期更新章節。既有日期章節保留，遇到相關變更再查證整合，不大範圍刪除。
- 更新設計規格時，維護 `文件版本`、`最後更新` 與修訂紀錄。尚無 metadata 時新增，首次版本採 `1.0`；已有版本依原規則遞增。
- 修訂紀錄沿用原標題，含編號的「修訂紀錄」也算；不重複建立。表格為 `版本 | 日期 | 說明`，最新列在最上方。
- 說明用一至兩句摘要；未改路由、守衛、導向、API、GraphQL payload 或 DB schema 時，在同列明示。設計細節寫回正文。
- 現況規格、模組 README 與程式矛盾時，先查證並指出差異，再修正；不能只依文件日期推定實作或部署已完成。

### 3.2 決策紀錄

架構方向、API 取捨、安全設計或偏離既有慣例時，建立 `docs/decisions/YYYY-MM-DD-<short-title>.md`；一般修錯與格式整理不必硬造決策。

```markdown
# 決策：標題

日期：YYYY-MM-DD
狀態：已接受／已取代／已棄用

## 背景
問題、限制與替代方案。

## 決策
選擇與原因。

## 影響
好處、成本、風險與後續工作。
```

取代決策時保留歷史並雙向連結，不靜默改寫原理由。

## 4. 前端設計與樣式

- 依使用者指定採 GitHub 式黑灰底、白字的固定深色主題，不提供主題切換；結果狀態保留克制語意色。所有共用色彩、字型、字級與版面 token 由 `apps/web/tailwind.config.ts` 管理，不新增第二套生成樣式表，不改用上游 `tokens/*.json` 管理本應用程式。PDF 使用同一設定內獨立的 report 紙本語意色，維持白底深字。
- Latin 用 Inter，中文用 Noto Sans TC；字級限 40／32／24／20／16／14，字重限 700／500／400。桌面一般內文、導覽與控制項統一 14px；依使用者要求收斂尺寸，總覽頁標題 20px、區塊標題 14px、結果結論 16px，控制項 compact 高度至少 32px。既有報告輸出保留專用字級。面板用 `rounded-xl`，控制項與項目用 `rounded-lg`。不任意新增尺寸、字重或圓角。
- `apps/web/src/styles.css` 只撰寫最外層 `.app-shell` 版面 CSS；禁止 `@apply`、後代選擇器、元件 CSS class、行內樣式與 CSS-in-JS。其他元素用可閱讀的 TSX 與 Tailwind utilities。
- 使用純文字導覽與克制表面；不放裝飾圖示磚、重複箭頭、等權重卡片堆疊、過多陰影與行銷空話。
- 不新增 emoji，包含 UI、程式、JSON、文件、註解與 commit。必要圖示用既有圖示系統或 `currentColor` SVG。
- 破壞性操作含確認視窗使用 destructive 語意 token；主要按鈕留給主要肯定操作，次要操作用中性色。
- 不使用單側彩色邊框作狀態裝飾；狀態以文字及必要語意圖示表達，不只靠顏色。
- 禁止原生 `<select>`。替代 listbox／combobox 須有方向鍵、Home／End、Escape、文字搜尋、焦點管理及有效展開狀態。
- 產品為桌面專用，優先驗證 1024／1280／1440／1920px 的長文、溢位及縮放；保留窄視窗基本可用性，不另做手機產品設計。
- 互動元件處理預設、hover、focus、active、disabled、loading、error、selected；不適用時說明理由，不製造假狀態。
- 側欄群組預設展開，點群組標題切換並跨重新整理記憶；不顯示展開／收合文字。用 Tailwind utilities 隱藏捲軸但保留捲動。

新增或重新設計畫面前，先在回覆簡述：領域、使用者與語氣、視覺氣質、動態程度、版面順序與參考系統。純文件、後端或小型修錯不用套設計簡報。

## 5. 產品行為限制

### 5.1 導覽與撰寫

- 移除原型工具控制項。Dashboard 只放結果與待注意事項，執行入口在測試集合與執行頁。
- 撰寫頁頂部是可編輯名稱與唯一儲存按鈕；左側單一聊天、右側流程預覽，下方為展開且全寬的 TypeScript 編輯器。
- 不放案例卡表單、檢查清單、獨立問題面板、聊天 Agent 下拉選單或重複標題。
- 保留 Agent 管理、模型連線預覽、對話切換、案例庫編輯、引導式流程儲存與執行。
- 不增加強制審批：使用者建立可重用案例、選取、排序後儲存。不顯示舊版案例素材或合併流程區塊。

### 5.2 案例庫與專案

- 腳本庫僅單層分類標題與緊湊案例列，提供播放／編輯；不做巢狀資料夾或拖曳按鈕。
- 拖曳案例列本身移入分類，提供 Enter／Space 鍵盤替代操作。
- 播放在原列開始，不導頁；以文字與列色呈現進度與結果。明示模擬，草稿不得假通過，填完內容不等於已驗證可執行。
- 省略例行操作說明與移動成功訊息。移除庫中案例時保留腳本版本與執行歷史；排隊或執行中拒絕刪除。
- 專案清單無可見頁面標題或介紹；僅未設定時顯示新增專案空狀態。
- 設定提供可編輯專案名稱與 Git URLs，隱含 ref 為 release；每列提供重新整理圖示。

### 5.3 版本與整合安全

- 建立執行時才產生測試版本識別碼，凍結不可變來源，不捏造 commit 或 tag。
- 測試版本追蹤 frontend、BFF、backend 三個 GitLab 儲存庫；僅抓 frontend release 原始碼，BFF／backend 保留 Git metadata。
- 快照凍結完整 commit SHA 與 QA tag；沒有部署／版本證據，不把 Git ref 等同 dev 已部署版本。
- Git UI 僅收秘密參照與非秘密 metadata，不新增原始 token 或 private key 欄位。
- 檢查 host、repo、role、transport、expiry；UI 驗證不代替伺服器授權或真實秘密儲存。秘密不得寫入文件、計畫與日誌。
- Browser／visual runner 是規劃能力，不暗示已串接。Android、API、CLI 能力依實作與證據分別描述。
- 明確區分草稿、格式檢查、模擬、真實執行、本機驗證與部署驗收；無證據就寫未驗證。

## 6. 驗證與完成條件

從根目錄執行；Windows 可用 `npm.cmd`。

```powershell
npm run docs:plans:index
npm run docs:check
# 前端變更
npm run build --prefix apps/web
# Control API 變更
npm run check --workspace services/control-api
npm test
# Android worker 變更
npm run android:test
```

- 純文件至少跑文件檢查，不為此啟動部署或完整產品驗收。
- 功能變更須跑對應回歸測試；先查 scripts 與模組驗證文件，不猜不存在的指令。
- UI 修改針對 `apps/web` 跑適用的 token、contrast、hardcode、emoji、native select、狀態、axe、responsive、keyboard、target size、mobile first、intent、overflow 與 reduced motion gates。
- 上游腳本先讀使用方式；Tailwind config 才是本專案 token 來源，不能用無關 JSON 的通過結果代替應用程式驗證。
- `scripts/accuracy_report.mjs` 是套件自測，不是本應用程式品質分數，不用它評分 Archify。
- 瀏覽器 gate 設 `DS_REQUIRE_BROWSER=1`；`SKIPPED` 或沒有量測內容不算通過，不可移除要求製造綠燈。
- UI 變更須實際查看畫面並操作受影響控制項；未經使用者要求不儲存預覽截圖。無法查看就明示未完成視覺驗證。
- 失敗須修正再跑；環境受阻時記錄阻礙與未驗證範圍，不宣稱通過。
- 只報實測結果，不捏造對比值、通過率、品質分數或部署狀態。客觀 gate 不證明設計品味。

結束前確認計畫狀態與證據、文件與必要決策同步、索引更新及適用檢查結果。檢查最終差異，避免無關修改、秘密、截圖與產物。回覆簡述變更、驗證與剩餘限制，不聲稱未執行的檢查已通過。

## 7. 上游資料定位

`components/`、`accessibility/`、`taste/`、`content/`、`frameworks/`、`design-systems/`、`workflows/` 是設計參考，不取代本專案規則。`tokens/*.json` 與 examples 屬上游套件，不是應用程式現況。規則文字不代表已安裝自動 hooks；只有實際執行並留下結果的檢查才是驗證證據。

依使用者最新確認，現行生成改為 api/*.ts 請求模組與 tests/api/*.spec.ts 單支測試配對；tests/flows/*.spec.ts 組合 API 函式，不 import 其他 spec。網址／Header 共用，token 在同一流程明確傳遞。舊稿保存 legacy，不恢復逐接口 JSON，略過不代表通過。細節見 docs/decisions/2026-11-07-reusable-api-functions.md。

## 網站 AI 最新授權

依使用者 2026-11-08 與 2026-11-11 明確要求，網站可發起受控本機 AI CLI（支援 `codex`／`claude`／`gemini`，圖片知識辨識僅限 `codex`）功能／知識分析；此項取代前述不提供模型／Agent 的限制，但只限分析 JSON 結果，不恢復聊天 Agent、VM、Git 或產品腳本執行控制。MD／HTML 知識經 AI 語意去重與更新，取代原檔保留封存、版本檢查及還原，衝突不自行定為業務事實。詳見 docs/website-ai-analysis.md。

## 本機畫面環境最新授權

依使用者 2026-11-08 明確要求，網站可受控啟動既有本機 Android AVD／Appium、選擇裝置與保存截圖選項；這只取代原入口不提供本機環境啟動的限制，不恢復 VM、舊 Control API、聊天 Agent 或產品腳本執行。一般畫面走前端 npm run dev 與 Playwright，只有推播原生畫面走 Appium；報告固定 reportDir/api／ui，支援單檔HTML（內嵌結構與圖片），純文字按需下載，舊JSON保留相容。使用者要求本輪不開啟 LINE、不擷取實際手機畫面、不發推播，產品驗收之後再做。詳見 docs/ui-testing-reports.md。

## 初始設定 Git 授權補充
依使用者最新要求，初始設定允許受控 clone 前端來源，此為前述不提供 Git 連線的限縮例外；僅下載到新本機資料夾，不提供 push／pull／憑證保存。現行首次引導為四步（1. AI CLI → 2. 前端來源 → 3. 測試專案 → 4. 專案知識），四步設定未完成不掛載產品頁；第四步僅 PRD／業務流程文件上傳，不放文字輸入或略過。詳見 docs/decisions/2026-11-08-onboarding-clone.md 與 docs/decisions/2026-11-11-cli-setup-and-ai-toast.md。

## 本機設定保存補充
依使用者 2026-11-09 與 2026-11-11 要求，來源路徑與現行環境設定保存測試專案 .env；初始化及重新連接都須補齊 .gitignore，排除 .env 與 .env.*，僅保留無秘密的 .env.example。平台 .local/workspace.json 僅保存排除 Git 的 projectRoot 定位，另以排除 Git 的 .local/ai.json 保存選用非秘密 AI CLI 種類（`aiProvider`）、路徑（`aiCli`）與模型偏好（`aiModel`）（選定或更新測試專案時同步寫入 .env，不存任何產品認證或 API key）。舊平台設定成功保存後遷移，既有專案值優先保留；不自動取消 Git 已追蹤檔案。

## 固定逐操作畫面證據

依使用者 2026-11-09 要求，新專案預設開啟畫面截圖，網頁使用 support/web-test.js 的 test／expect／fixture browser，自動保存常用操作及畫面斷言當步證據；多角色 setUiRole，特殊操作以 uiStep 明示。禁止只截結束畫面或超過八張後略過；全部圖片與步驟在同一次執行的單檔HTML保存，不分卷、不丟圖；歷史列表不截斷100／1000份，前置說明不顯示但操作與證據保留。共用 CLI／globalSetup 檢查標準 fixture import；不能以 skills 文字代替實際攔截測試。既有專案受控備份升級，明確關閉截圖仍不擷取，不恢復產品執行入口或授權真實手機操作。契約與限制見 docs/ui-testing-reports.md。


## 圖文報告範本補充

依使用者 2026-11-10 要求，playwright-test-report 圖文範本為現行來源，不降為 legacy；網站及離線使用同一圖文產生器，網站外框深色、本文深藍白紙。重要頁面須明示就緒條件，登入／註冊等回應等待須保留安全診斷與失敗圖；不能把導頁返回或白圖當完成。詳見 docs/ui-testing-reports.md。
