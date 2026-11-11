# 獨立 Playwright 測試專案

網頁規劃與實作 skills 先追查前端路由、元件、表單驗證及事件，將必要前置與中間操作補入 catalog，記錄填值規則與來源依據。程式可確定的操作自行查證；缺少資料依據或業務預期則集中提問，不以 helper 舊常數代替答案。這是撰寫指引，不是自動完整性驗證，也不授權產品操作。既有專案需定向同步技能，重新連接不覆寫自訂內容。

Android 環境準備先讀 [setup-android skill](skills/setup-android/SKILL.md)。平台新建測試專案會一併放入這份技能與官方下載指引；SDK、AVD、Appium 及登入資料仍各機安裝，不隨 Git 配送。只測 API／網頁不需要安裝 Android。

一般畫面使用 skills/write-web-tests/SKILL.md 與 tests/ui；只有推播原生畫面使用 skills/write-push-tests/SKILL.md 與 tests/mobile。報告使用 skills/playwright-test-report/SKILL.md，固定 reports/api／reports/ui 並輸出 JSON／HTML／TXT；新專案截圖預設開啟，僅新版畫面 fixtures 依 config/report.json 處理。修改框架／報告不授權開啟 LINE、手機截圖或發推播，這些操作需之後明確要求。

先在本機 AI 使用 skills/plan-test-cases/SKILL.md 規劃 test-cases/catalog.json，補資料與實作都在本機專案進行，使用 skills/implement-tests/SKILL.md 實作；網站「測試流程」只讀表格。npm run cases:check -- TC-CASE-ID 唯讀檢查資料完整性，不要求網站確認。內容、相關知識或來源依據更新後需核對；腳本與型別通過不是產品測試通過。案例結構與限制見 test-cases/README.md。

每個操作配對 api/操作名稱.ts 與 tests/api/操作名稱.spec.ts；前者保存 query、預設資料並匯出 callApi，後者保留步驟與斷言。多支串接放 tests/flows/，匯入 API 函式，不匯入其他 .spec.ts。平台新建專案已準備此結構。

## 第一次使用

Node.js 22.18 以上。在此專案執行 npm ci，一次安裝已鎖版的 Playwright Test、TypeScript 與 Node 型別；中間層測試不需要下載瀏覽器。平台建立專案時已備妥 tsconfig.json 與 support/bff.d.mts，不需自行補編輯器設定。既有專案重新連接不會覆寫自訂框架設定，需明確升級。

1. 在 .env 設 BFF_BASE_URL，填要連線驗證的 dev／QA 中間層網址，GraphQL 包含 /graphql。
2. 共用 Header 在 config/http.json，秘密用 {{SATOKEN}} 等參照，實值放 .env。
3. 在 api/操作名稱.ts 的 operation.body.variables 填入預設資料，保留 query。再讓 AI 依需求與知識撰寫實際 test／expect，取代最小 test.skip。

新稿的 test.skip 只標記尚未撰寫的草稿，不發送請求。不要直接刪掉 skip 讓空測試假通過。

## 執行

```powershell
npm test
npm test -- tests/api/AcceptAllRequests.spec.ts
# 流程撰寫後可執行（範本不預先啟用產品寫入流程）
npm test -- tests/flows/PinCardFlow.spec.ts
npm run check:types
npm run flow
npm run flow -- tests/api/AcceptAllRequests.spec.ts
```

npm test 使用標準 Playwright Test。flow 透過 --list 產生未執行計畫；它會載入測試模組，所以頂層不得發送請求或操作裝置。實際步驟之後由 AI 用 test.step 撰寫，草稿尚無業務流程。

check:types 只做靜態型別檢查，不載入測試、不呼叫中間層、不產生執行報告。範圍含 api、tests、Playwright 設定及 support，不檢查封存的 legacy。Playwright 執行本身不代替型別檢查；通過型別檢查也不代表業務通過。resolveData 的宣告保留輸入結構，解析後的實際值仍由案例驗證。

## 你會改哪些地方

- api/*.ts：可重用請求及預設資料，匯出 operation 與 callApi(request, options)。
- tests/api/*.spec.ts：單支 API 情境、步驟與斷言。
- tests/flows/*.spec.ts：多支 API 串接、資料傳遞與最終業務驗證。
- tests/ui/*.spec.ts：後續網頁測試，可使用原生 page／expect；執行前另需準備對應瀏覽器與有效環境。
- config/http.json：共用 Header，callApi 的 options.headers 可覆寫或以 null 移除。
- .env：BFF_BASE_URL 與秘密，不進 Git。既有程序環境變數優先，舊 ARCHIFY_TARGET_BASE_URL 僅相容回退。

support 與 playwright.config.ts 是執行與報告設定，日常寫案例不用修改。requests／fixtures 只在真正需要跨案例共用時才使用，不再強制每支產生一份 JSON。

## 報告與限制

Playwright 實際結果會產生 reports/ 下的日期時間 JSON／HTML，可直接開啟 HTML 或由平台讀取。JSON 透過 custom reporter 記錄 test.step、通過、失敗、略過；原始例外與回應不寫入此報告。失敗摘要請回本機檢查；Playwright 本身的終端輸出與偵錯產物仍須避免放秘密。預設 trace、video、screenshot 關閉。runId 與案例檔 hash 不代表完整依賴或部署版本。

全部略過時 Playwright 標準 exit code 仍可為 0，但報告不會把略過算成通過。中間層真實業務、網頁／手機與多機流程仍須各自驗證。此專案不依賴平台、VM、資料庫、Git 連線或內建 Agent，使用自己的工具 Git 版控即可。

舊三檔案例遷移後保存在 legacy/pre-playwright/日期資料夾，保留原始內容與舊設定。若舊稿有自訂邏輯或秘密常數，工具保留原檔並要求人工核對。

Playwright 手機圖文報告技能在 skills/playwright-test-report/SKILL.md；它的 results.json 與圖文產物仍是獨立格式，不會自動轉成平台的執行報告。

## Agent 知識與平台引導

平台首次設定依序選擇前端專案、獨立腳本位置、匯入知識。知識存在本專案 `knowledge/`，與腳本一起版控，不上傳模型。
在 AI 工具開啟此專案後，先讀 `AGENTS.md` 與 `knowledge/README.md`，再讀相關業務文件及 skills。
可匯入 UTF-8 `.md`／`.txt` 或直接輸入文字；每份 128 KB、每次 20 份合計 1 MB。平台支援名稱搜尋、文字預覽及封存；封存保留在 `knowledge/archive/`。
`knowledge/index.json` 與 README 標記區段由平台管理，其他筆記保留。手動直接新增的文件需匯入後才會進入平台清單。
秘密、token 與個資不放進知識；外部 AI 仍由工具／OS 控制權限，規則不提供安全隔離。

## 來源移除同步

平台重新分析後，可選取前端未再出現的受管腳本，確認後移出 tests 並保留在 legacy/removed-api，manifest 記錄原路徑與 hash。可使用本次還原按鈕，或確認 tests 無同名檔後依 manifest 手動還原；不覆寫人工內容。analysis/script-sync-*.json 可一起版控，但不同來源絕對路徑會重新建立基準。首次不追溯舊消失項，有解析警告、子目錄或疑似操作修改時不提供移除建議。

GraphQL query／variables 保存在 API 模組 operation.body；常數型別與結構保留。options.variables 直接覆寫 GraphQL variables 的頂層欄位，巢狀 request 需完整傳入；options.values 才是 {{名稱}} 占位值表。無參數操作的 variables 為空是正常的。

GraphQL 操作若只叫 Query／Mutation，草稿檔名改用實際欄位，例如 CheckCard.spec.ts、CheckMobile.spec.ts；請求內的 query／operationName 與識別碼維持原值。

## 查看 API 回應

reports/ 已由 .gitignore 排除。實作案例時從 support/response.mjs 匯入 showResponse，並在取得 response 後、斷言前呼叫 await showResponse(response, testInfo)；test callback 的第二個參數即 testInfo。終端及獨立 HTML／JSON 報告會呈現 HTTP 狀態與遮蔽後 JSON，Header 不保存，token／密碼／認證／cookie／API key／message／stack 欄位遮蔽，非 JSON 不保存原文。此規則無法保證任意自由文字均無秘密，避免自行印出原始回應。平台閱讀器目前仍僅顯示步驟，請開啟 reports/*.html 看回應；舊報告不會自動補資料。

## 組合流程

callApi(request, options) 回傳 APIResponse，只送一次請求，不解析業務結果、不登入、不保存 token、不斷言、不重試。情境以 options.variables、values、headers、body、queryParams 覆寫，不修改 operation。token／cardId 在同一 test 明確傳遞。契約及略過的示意流程見 [API 流程參考](skills/write-tests/references/api-flows.md)，實際產品欄位仍須依來源與知識補齊。來源移除僅封存單支測試，API 模組保留供流程引用；還原使用既有封存機制，不靠重新生成覆寫 API。

## 功能與測試案例

測試意圖保存在 test-cases/catalog.json，可由網站或本機 AI 編修；固定案例 ID 以 archify-case annotation 或明確 script 路徑對應。功能地圖由同資料、AST 引用與報告組合，不另維護。業務知識、測試意圖、腳本實作及執行證據各自分離；缺漏保留具體問題，不猜測規則。

新版 reporter 記錄 scriptEvidence（相對依賴／工具／設定／鎖檔 hash）與 caseEvidence（案例意圖／知識指紋），不讀 .env。執行前後內容改動或動態依賴則不宣稱完整，舊報告版本未知，內容更新後舊通過不等於新版驗證。參考 [案例資料說明](test-cases/README.md)。

## 本機 AI 整理前端功能

網站「全部功能」顯示已套用的前端分組，即使沒有測試也保留。展開「讓本機 AI 整理」先準備分析資料，AI 讀 skills/map-frontend-features/SKILL.md 及 analysis/feature-evidence.json，輸出 feature-map.proposal.json；執行 npm run features:validate，回網站重新讀取並載入 AI 結果。CLI 可用 npm run features:apply -- analysis/feature-map.proposal.json --source-root 前端絕對路徑。

工具會核對來源 hash 與 catalogRevision、明列未分配頁面／API、保留人工案例並備份 legacy/frontend-map。產品頁面／API 與測試流程分開；靜態 import 可達不代表精確呼叫或業務規則。不要改 hash 強制套用，不在此任務執行產品 API。

知識來源可上傳 MD／HTML／TXT／PNG／JPEG／WebP，每份 10 MB、每批合計 20 MB。原始檔在 knowledge/sources，整理後文字在 knowledge/documents，來源關聯見 index.json 的 sources 及知識入口連結。圖片用途未指定時不能當預期樣式或執行通過證據；看不到的動作／後端規則請補資料。檔案可與此專案一起版控，來源去重及知識還原不刪原始證據。

新網頁 UI 流程使用 tests/ui/*.spec.ts；舊 tests/web 仍由相同 web project 執行，不必搬移既有腳本。npm run test:ui 與 test:web 都只執行 Playwright 網頁案例，Android 必須另用 test:android。網頁導航、填表、點擊、資料／DOM 斷言及截圖使用 Playwright 腳本，不使用 computer use 或逐步讓模型看圖操作。HTML 自動產生情境摘要、步驟、預期、結果、清理與可點擊放大證據；沒有截圖仍產生 HTML／TXT。

## 本機來源設定

初始化與重新連接會將 ARCHIFY_SOURCE_DIR 保存此專案 .env。AI 先只讀取此鍵定位產品前端，唯讀核對頁面、按鈕與 LIFF mock；不得輸出整份 .env 或秘密。無權讀取時回報權限問題。環境設定與秘密不提交 Git；.gitignore 保護 .env 與 .env.*，僅 .env.example 可提交且不得填真實路徑或秘密。已追蹤的 .env 仍需人工取消追蹤與評估憑證更換。

## 固定逐操作畫面證據

所有網頁案例使用 support/web-test.js 的 test／expect，fixture browser 建立的 page／自訂 context 會對操作及畫面斷言逐一留圖，含順序、角色與結果；多角色用 setUiRole。特殊操作以 uiStep 包住，禁止八張後略過或只截結束畫面。執行前 npm run check:ui-evidence 及 npm run check:types；globalSetup 同步檢查標準 fixture import。新專案 config/report.json 預設開啟，既有明確關閉仍尊重，不得另存繞過。超過單卷容量自動分卷，保留同 runId／caseId 與所有圖片，份數不等於案例數。詳見 skills/write-web-tests/SKILL.md 與 skills/playwright-test-report/SKILL.md。


## 就緒、預期與等待診斷

重要導航先 setUiReady(page, 可見目標)，完成該頁後 setUiReady(page, null) 還原；導頁返回不能當業務畫面完成。登入／註冊使用 uiWaitForResponse(page, OperationName, trigger)，先監聽再觸發並在逾時留現場圖。uiStep 第四參數提供具體預期；catalog 保存整體及規劃預期，expect 提供中文訊息。不以空白成功圖、通用預期或單句安全錯誤取代診斷。playwright-test-report 使用者範本是現行來源，網站及離線共用 journey-report，不另造外觀。

## 單檔報告與完整歷史

依使用者2026-11-10要求，本節取代舊的JSON／HTML／TXT自動產物、八張／4MB分卷及最近100份限制。每次執行在reports/api或reports/ui只寫一份日期時間命名HTML，同runId在進行中與完成時原子更新同檔，不覆寫其他執行。HTML內嵌schemaVersion 1與全部PNG，圖片延遲載入、點擊放大；不自動另寫JSON／TXT或part分卷，純文字仍可由閱讀器按需下載。單張PNG維持2MB檢查；單檔512MB明確上限，超限失敗不丟圖湊成功。所有測試專案共用此契約。前置說明不在報告正文顯示，必要準備操作、原始結構及證據仍保存。歷史列表不截斷100／1000份，提供搜尋與顯示更多；舊JSON／分卷保留相容且不刪除。
