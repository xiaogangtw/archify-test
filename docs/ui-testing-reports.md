# API、網頁與 Android 測試報告

文件版本：2.0

最後更新：2026-11-10

## 修訂紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| 2.1 | 2026-11-10 | 報告入口改為橫幅清單，每筆提供另開原版HTML與下載；原版面只移除「關鍵畫面」分組，保留流程與全部原始證據。未改產品路由、API、GraphQL或DB。 |
| 1.8 | 2026-11-10 | 每次執行改為同runId單檔HTML，解除歷史100／1000份截斷，隱藏前置正文並保留完整證據；新建範本與既有專案同步。local-api/report相容解析新HTML，未改路由、守衛、導向、產品API、GraphQL payload或DB schema。 |
| 1.7 | 2026-11-10 | 網站與離線報告接回使用者圖文範本，新增就緒判斷及回應等待失敗證據。報告 JSON 增加可選預期／實際／診斷，未改路由、守衛、導向、API 端點、產品 API、GraphQL payload 或 DB schema。 |
| 1.6 | 2026-11-09 | 新專案固定共用逐操作網頁證據、預設開啟及執行前檢查；報告 JSON 增加分卷 metadata 並保留所有圖片。未改路由、守衛、導向、既有 API 端點、產品 API、GraphQL payload 或 DB schema。 |
| 1.5 | 2026-11-09 | 修正 CLI project 參數吞入單檔路徑，支援 test:ui 後接檔案篩選。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.4 | 2026-11-09 | 終端逐步進度、逐案原子保存快照與 web 操作等待上限；可透過升級腳本定向更新既有專案。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.3 | 2026-11-08 | 新建測試專案附 setup-android skill，提供官方下載、Google Play AVD 與本機設定指引，不配送 SDK／裝置資料。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.2 | 2026-11-08 | 報告頁固定目前專案，進入／分類切換自動讀取最新結果，移除匯入與目錄操作，歷史及畫面設定收合。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.1 | 2026-11-08 | 新網頁流程採 tests/ui，保留 tests/web；HTML 提供情境摘要與放大證據，test:ui 僅使用 Playwright 網頁。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |
| 1.0 | 2026-11-08 | 統一 API／畫面分類、可選截圖、JSON／HTML／TXT 與本機 Android 啟動契約；新增設定及環境端點，未改產品 API、GraphQL payload、路由、守衛、導向或 DB schema。 |

## 分工與目前驗證範圍

API 單支／串接在 tests/api、tests/flows；一般前端畫面在 tests/ui，推播的原生接收畫面才在 tests/mobile。流程仍在 test-cases/catalog.json 由本機 AI 撰寫，網站只讀；流程頁的 API／畫面切換依 target 或 script 位置分類，畫面列另標示網頁／Android。網站不提供產品腳本執行、LINE 登入或發送推播。

本輪只交付框架與環境：合成 HTTP 頁面已實測資料及 DOM 同時斷言，模擬 W3C server 已測截圖開關與 session 清理。真實本機 Archify_API_35 已啟動並建立 Appium session 讀取系統 UI，沒有開啟 LINE、手機截圖或發推播。依使用者要求，這些產品動作及真實推播驗收留待之後。

## 本機前端與資料正確性

若一般畫面測試須連本機前端 `npm run dev` 以控制 mock 狀態（例如前端於 DEV 啟用 `LiffMockPlugin`），由於 5173 同時是 Archify 預設埠，建議在前端專案執行：

```powershell
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

測試專案 .env 設 WEB_BASE_URL=http://127.0.0.1:5174，BFF_BASE_URL 保留真正 dev／QA 中間層 GraphQL 網址。平台不修改產品來源，不自動啟動任意前端命令。前端自身仍需正確 BFF 環境、CORS／callback 與有效測試認證。

LIFF mock 可控制 SDK 情境，但固定本機 mock profile 不等於任意帳號切換接口，也不等於有效真實 LINE token。不要猜全域物件或注入私有 SDK。資料正確性案例先斷言固定測試資料的 HTTP／GraphQL 結果，再驗證 DOM 文字與必要樣式；不能只比較 DOM 與同一份錯誤回應相同。這類案例不 mock BFF 業務回應。

可用 archify-data-mode annotation 宣告 liff-mock-real-api 或 mocked；報告標示「腳本宣告」，不把宣告當實際驗證證據。真實 LINE 登入、推播與原生 App 呈現仍是另外的驗收範圍。

## 固定產物位置

報告根目錄是測試專案 archify.config.json 的 reportDir，預設 reports，應與平台 ARCHIFY_REPORT_DIR 一致。產物固定在該根目錄的 api/ 或 ui/；每輪用台北日期時間、毫秒及runId尾碼產生一份HTML，進行中與完成原子更新同檔；不另寫JSON／TXT，也不按圖片數分卷。網頁與 Android 同屬 ui，cases.target 分別為 web／android。混合執行依案例分類拆兩份報告；API 串接仍在 api。

舊根目錄 report-*.json、flow-*.json 保留讀取，新分類目錄的檔名允許 api/、ui/ 前綴，不能任意跳出根目錄。平台列出全部歷史，不截斷100／1000份；提供搜尋及每次顯示更多50份，並非總數限制。單檔最多512MB，超限明示且保留原檔；catalog 的執行歷史同時讀舊根目錄及新分類。舊報告沒有 testType 時依來源推定並明示限制。

HTML內嵌JSON維持schemaVersion 1，新選填欄位為 testType、screenshotsEnabled；案例可有 target、dataMode、responses 與 screenshots（caption、PNG base64 data）。HTML 內嵌 PNG 可離線閱讀，不自動輸出TXT，僅在閱讀器按需下載純文字。網站可下載純文字報告，匯入不改寫原始檔。

閱讀版面沿用使用者深藍白紙角色圖文範本，案例預期／實際在上方，完整步驟與回應收合，前置說明不顯示於正文但內嵌資料及準備證據不刪除。平台只抽取新HTML內嵌JSON，不執行匯入檔案腳本；另頁開啟及下載的HTML由受信renderer產生。舊JSON／HTML副本只列JSON一次，舊分卷全部保留可讀。

## 截圖設定與 runner

config/report.json 保存非秘密 screenshots（新專案預設 true；舊專案缺設定仍維持 false）、androidSerial（預設空白）。網站畫面測試頁勾選後保存，下次執行生效；不改寫歷史報告。CLI 可用 ARCHIFY_SCREENSHOTS=0／1 覆寫，ANDROID_UDID 可覆寫所選模擬器。

Playwright config 將選項凍結到執行環境，workers=1、retries=0。web-test 包裝 fixture browser 建立的 page、Locator、自訂 context 及畫面 expect，常用操作與畫面斷言逐次透過 captureUi 留圖，失敗也保留當下。android-test 仍依原生明確 captureUi 與結束畫面，不宣稱自動具備網頁逐操作能力。API 不處理截圖，trace／video／Playwright 自動截圖維持 off。

單張 PNG 最多 2 MB、單邊 12000／4000 萬像素，全部圖片與步驟保存在同一HTML，不依8張、4MB或1000步分卷；內嵌資料只保存每張圖一次，閱讀時延遲載入。單檔512MB上限；單張或單檔超限回報錯誤，不默默丟圖或宣稱通過。逐操作網頁圖遮罩密碼及 autocomplete=one-time-code 輸入，其他個資與手動／原生截圖不保證遮蔽。自寫 screenshot／toHaveScreenshot 或外部工具不受 JS 技能約定隔離；skills 要求遵守選項，不在關閉時繞過。必要像素比對缺基準或未開截圖時，應略過／待補，不移除必要斷言換通過。

```powershell
npm run check:types
npm run test:api
npm run test:web
# 真實推播案例須使用者之後明確要求執行
npm run test:android
npm run test:ui
```

預設網頁 channel 為已安裝 Chrome；npm ci 不會代安裝瀏覽器。API／Android 只有 request 或原生 fixture 時不開瀏覽器。npm run flow 仍只是 --list，不啟動 page、Appium 或產品操作；空案例、略過與啟動錯誤不代表驗收通過。

## Android 環境邊界

畫面報告頁可展開本機環境，列出 SDK 既有 AVD、啟動原生可見模擬器、選擇已開機裝置及啟動本機 Appium。SDK 依 ARCHIFY_ANDROID_SDK、ANDROID_HOME、ANDROID_SDK_ROOT、平台 .local/android-sdk 及常用安裝位置偵測；Appium 預設為平台 .local/appium，或 ARCHIFY_APPIUM_CLI 指定 JS。既有安裝指令 npm run android:appium:setup 保留，網站不自動安裝或下載 AVD。

啟動限 SDK 清單內名稱，單次一台、最多四台，先檢查加速與空閒埠。不用 shell、不接受任意參數、不 wipe、不清資料、不建立舊 VM／Control API worker。僅綁定 127.0.0.1:4723，埠被非 Appium 服務占用時拒絕，不停止他人程序。關閉網頁不發送停止環境的命令；程序仍受作業系統及啟動終端生命週期管理。

Android fixture 只連本機 HTTP Appium，要求選中 emulator serial；noReset=true、fullReset=false、autoLaunch=false、dontStopAppOnReset=true，僅安裝必要驅動 instrumentation，不自動開啟／登入 LINE。結束刪除自己建立的 session，不清 App 資料。ANDROID_APP_PACKAGE 必須由實際安裝確認，預設空白；開啟 App、查通知或發送推播不是本輪預設動作。session 建立逾時可能需等待 newCommandTimeout 回收，不透過強制停止他人 session 掩蓋問題。

## 本機契約

同來源、loopback、session 與 POST JSON 的既有防護不變。

| 端點 | 行為 |
| --- | --- |
| report-settings | 讀取 screenshots／androidSerial |
| report-settings-save | 部分更新，保留其他設定；serial 必須是目前已就緒裝置 |
| android-status | 讀取 SDK／AVD／裝置開機與 Appium 狀態，不擷取畫面 |
| android-start | avd，僅啟動已存在的原生模擬器 |
| appium-start | 啟動本機已安裝 Appium，不開產品 session |
| reports／report | 相容根目錄與 api／ui，相對名稱及連結檢查 |

技能入口：write-web-tests、write-push-tests、playwright-test-report。舊 390×844 圖文工具及 results.json 保留在報告 skill 的 legacy reference，日常新案例不再建立第二種結果。

依據：[Playwright 設定](https://playwright.dev/docs/test-use-options)、[UiAutomator2 capabilities](https://appium.github.io/appium-uiautomator2-driver/latest/reference/capabilities/)、[Appium 原生端點](https://appium.github.io/appium-uiautomator2-driver/latest/reference/endpoints/)。

新網頁 UI 流程使用 tests/ui/*.spec.ts；舊 tests/web 仍由相同 web project 執行，不必搬移既有腳本。npm run test:ui 與 test:web 都只執行 Playwright 網頁案例，Android 必須另用 test:android。網頁導航、填表、點擊、資料／DOM 斷言及截圖使用 Playwright 腳本，不使用 computer use 或逐步讓模型看圖操作。HTML 自動產生情境摘要、步驟、預期、結果、清理與可點擊放大證據；沒有截圖仍產生 HTML／TXT。

附件僅作版型參考，不複製其業務結論、圖片或內嵌腳本。

報告頁固定使用目前已綁定測試專案的 reportDir，進入與分類切換只列出報告，不自動載入最新正文，也不顯示「尚未開啟報告」或執行指令空狀態提示。每筆報告以橫幅列出時間與檔名，提供「下載」及另開「開啟」；兩者由本機 API 讀取報告資料並以同一可信 renderer 產生單檔 HTML。HTML 沿用原版面，正常流程可讀，完整截圖仍在一般證據區，只移除「關鍵畫面」精選分組與標題；錯誤及失敗仍標示。歷史搜尋與顯示更多不限制總筆數，保留舊根目錄報告（缺類型以 API 相容）。畫面測試設定預設收合；不提供測試執行。

新建立的獨立測試專案透過既有 skills 遞迴收集，一併交付 skills/setup-android/SKILL.md；README／AGENTS 與 write-push-tests 有明確入口。技能先檢查現有工具，再提供 Android Studio／SDK／Google Play AVD／Appium 官方安裝指引，區分平台 .env 與測試專案 .env，不會自動安裝或執行。SDK、AVD 磁碟、登入資料不隨 Git；平台需找到 SDK 及既有 AVD 後，檢查環境才列出啟動按鈕。既有專案重新連接仍非覆寫，不自動升級技能。

## 執行進度與等待限制

新版 reporter 印出案例、test.step 開始及完成／失敗，不印原始錯誤。每個案例結束後，同一 runId 的 JSON／HTML／TXT 以暫存檔更名更新；快照僅含已結束案例，purpose 明示整批尚未完成，runStatus 為 running。整批結束更新為 finished，中斷為 interrupted；finished 只代表執行結束，不代表通過。三種格式各自原子更新，並非跨檔交易；第一個案例結束前仍沒有執行報告，網站需重新整理。硬殺程序可能保留最後快照，不可視為完整結果。歷史報告不回填。

web project 預設 actionTimeout 15 秒、navigationTimeout 30 秒；使用 browser.newContext 的自訂情境須自行設定。commands 將正式執行明確設為 execution，避免繼承 flow 環境。既有專案不自動覆寫，可透過 scripts/upgrade-ui-progress.mjs 定向備份更新既有 Playwright 設定：同步預設操作等待上限，多步流程應保留合理安全上限（例如 10 分鐘）與預留帳號清理預算。

該專案清理不應重新註冊未完成帳號；逐帳號記錄進度與預算上限。未註冊、刪除失敗或預算耗盡明列待人工核對，不當成已清理；不保存 token。context 關閉仍依 Playwright teardown 管理。

單檔執行可用 `npm run test:ui -- tests/ui/Example.spec.ts`；框架以 --project=web 傳入固定專案，避免 Playwright 將後續檔案位置視為另一個 project。加上 --list --reporter=list 可只列案例、不執行 body 或產生報告；仍會載入測試模組，頂層不得有副作用。

## 每位使用者共用的逐操作契約

新專案複製相同 support、設定、AGENTS 及 skills，config/report.json 預設開啟；既有明確關閉及 ARCHIFY_SCREENSHOTS=0 仍受尊重。沒有設定檔的舊專案仍維持關閉，不暗自開啟。網頁 test／expect 從 support/web-test.js 匯入，fixture browser 建立的 Page／Locator 常用導航、填寫、點擊、選項、鍵鼠、等待元素及畫面斷言會在完成或失敗後截圖，caption 記錄順序、角色／頁面、操作與結果。內容值、URL、按鍵值、檔案路徑不加入自動標題；作者提供的標籤與中文斷言訊息仍須避免秘密。圖片只能證明畫面狀態，不能代替業務斷言。

多角色建立頁面後立即 setUiRole(page, 'A')；未設定時標記使用者／頁面序號。自訂 context、popup 的 waitForEvent、Locator 鏈及 frameLocator 同樣包裝。evaluate、第三方操作、原始數值驗證需用 uiStep(page, '動作與預期', callback) 明確留圖；純 API、頁面關閉及資源釋放不額外擷取。使用原始 Playwright 物件、事件 callback 回傳物件或自行 launch 不在自動保證範圍，不能宣稱已涵蓋。不要以 Promise.all 平行操作同一畫面，避免動作與證據混淆。

CLI 的 web／ui 與 Playwright globalSetup 執行靜態 check-ui-evidence，所有 tests/ui、tests/web 的 spec 必須直接從本專案 support/web-test.js 匯入 test，禁止直接匯入原生 test／expect 或瀏覽器 launcher；允許純 type imports。這是標準寫法檢查，不是防惡意腳本的沙箱，無法完整辨識任意 dynamic import／第三方轉送。npm run check:ui-evidence 可獨立執行；--list 不執行 globalSetup，CLI web／ui 仍先檢查。AI 指引固定要求以上契約，不另建一套結果格式。

reporter 遞迴保留實際 test.step，操作圖片不再被第九張上限丟棄。每輪檔名含 part-0001 等分卷序號，JSON 新選填 volume、volumes，案例可有 evidencePart；所有卷保留同 runId／caseId，purpose 明示本卷非完整清單。HTML 有同輪分卷連結、caption 及放大圖片；JSON／HTML／TXT 各自原子更新。分卷的結果數不能相加當案例數，閱讀器份數仍是檔案數，每分類只列最近 100 份；更多卷可從本機 HTML 連結與報告目錄閱讀。來源 hash、案例版本及執行結果不因分卷重新產生。

擷取失敗會留安全錯誤附件並使報告及整輪 exit status 為失敗，即使腳本 catch 該錯誤也不當成完整證據；不重送產品操作。被硬殺或頁面已關閉時可能無法取得當步圖，只能明示證據不完整。截圖會增加執行時間，每張擷取最多 10 秒，必要時依案例規模調整總時間，不能移除業務驗證換速度。

既有專案不自動覆寫；明確升級可在平台執行 node scripts/upgrade-operation-evidence.mjs <測試專案絕對路徑>，先逐檔備份到 legacy/framework-upgrades，保留自訂環境及文件原文並附上取代舊截圖規則的契約。自訂 globalSetup 需人工合併。

驗證：node scripts/verify-operation-evidence.mjs 使用暫存純合成頁面，驗證逐操作、多角色、自訂 context、鏈式 Locator、畫面斷言、超過八張、失敗截圖、略過、關閉選項、擷取失敗及離線 HTML 放大／完整證據；不開啟 LINE、不建立產品帳號、不擷取原生手機。預覽僅在記憶體，不保存預覽截圖。

## 圖文範本、就緒與安全診斷

使用者提供的 playwright-test-report 範本是現行視覺來源，不降為 legacy。framework/journey-report.mjs 是唯一圖文產生器，網站讀取並驗證 JSON 後，以 sandbox=allow-scripts allow-modals 的 srcDoc 呈現同一產生器；不加 allow-same-origin，不讀取或執行報告目錄內任意 HTML。文件內 CSP 禁止外部資源、表單與 base URI，文字逐欄逃逸。原 HTML 生成器入口及舊 results.json 工具都轉接此產生器，不另維護不同版型。報告語意色由 apps/web/tailwind.config.ts 產生 framework/report-theme.mjs 快照，修改 token 後執行 node scripts/sync-report-theme.mjs；--check 檢查快照一致性。網站外框仍維持深色，紙本本文依使用者指定為深藍標頭、白底情境與並排角色操作圖。

案例 expected／preconditions 及規劃步驟由 catalog 取得；執行中 uiStep 的第四參數及 expect 中文訊息提供當步預期。JSON 的 case／step／image 可選 expected、actual，step／image 可選 diagnostic：code、message、operation、timeoutMs、pageErrors、requestFailures、httpErrors。只保存允許清單分類與計數，不保存原始 error、console、stack、URL、Header 或填入值；無法分類即明示 UNKNOWN_FAILURE，不推定業務原因。圖片隨分卷保留當步預期及診斷。舊報告缺資料顯示未保存，不能補造。

常用操作成功後，至少等待非空可見內容與兩個繪製 frame 再擷取；重要頁面用 setUiReady(page, selector, timeoutMs) 指定可見目標，預設 15 秒，完成此頁後 setUiReady(page, null) 還原。這是畫面就緒條件，不是業務正確性證明；spinner 可能有文字，作者仍須指定重要頁面條件及斷言。空白畫面逾時記 UI_NOT_READY，留失敗圖而非成功證據。

uiWaitForResponse(page, 'OperationName', trigger, timeoutMs) 先註冊監聽再觸發操作，預設 30 秒；回應逾時記 RESPONSE_TIMEOUT、操作名及上限，保存失敗當下圖，不重送請求，也不捏造回應 body。回應 HTTP 收到與業務斷言仍分開，登入／註冊等關鍵操作可配合 setUiReady 指定就緒條件後等待指定操作回應。

網站的下載圖文報告由同一份已驗證資料重新產生，不改寫歷史檔；歷次列表標示卷別。舊離線 HTML 與舊白圖保持原樣，新範本或缺失的診斷不等於已重新驗證產品。

### 報告條列與完整敘述

報告入口顯示搜尋與歷史橫幅列，每筆直接提供「下載」和另開「開啟」，初始不載入最新報告內容。開啟的 HTML 沿用原版面，正常流程可讀，保留原始畫面證據但不再另外挑出「關鍵畫面」分組；錯誤與失敗標紅。新報告保存scenarioSteps，清楚呈現角色、操作與核對位置；失敗說明已完成與停止步驟，後續未驗證。具體成功結果可由archify-case-result純文字附件提供，僅在成功案例採用；缺少觀察不把預期改成實際。舊報告只依已保存的證據呈現，不覆寫。
