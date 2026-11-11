# Web Playwright 工作台

## 範圍
以既有 web-e2e 入口建立案例撰寫及批次設定工作台：AI 腳本建議、網頁／流程預覽、全寬 TypeScript、本機案例保存與矩陣估算。既有 Runner 只支援隔離 Smoke，本次不開放外網、不宣稱已串接 LIFF 或自動操作瀏覽器。完成條件為可保存與恢復草稿、互動驗證及文件同步。

同日接續調整：依使用者要求改為 Appium 式畫面優先入口，移除批次／撰寫分頁及舊 Web 草稿區，案例改為預設收起的浮動選單，點案例編輯才展開工作區；環境資訊與測試設定皆預設收起。清除目前專案舊共用儲存鍵內的 Web 草稿，保留 Android／其他資料，新版 Web 案例不刪除。

名稱列修正：依使用者截圖，返回改為與既有撰寫頁相同的左向 chevron 圖示；移除名稱上方的可見標籤，保留可存取名稱，讓返回、名稱與操作對齊。窄螢幕返回與名稱保持同列，操作可換行。

接續一致性調整：Web 編輯頁字級、間距、聊天標頭／訊息／輸入區依 Android Appium 編輯頁對齊；保持現有對話與案例保存契約。

## 影響檔案
- apps/web/src/features/testing/WebPlaywrightWorkspace.tsx
- apps/web/src/features/testing/webPlaywrightModel.ts
- apps/web/src/features/testing/TestingPages.tsx
- apps/web/tailwind.config.ts
- apps/web/src/data/navigation.ts
- apps/web/README.md
- ARCHIFY-CURRENT-SPEC.md
- docs/web-playwright.md
- docs/README.md
- scripts/verify-web-playwright-ui.mjs

## 資料庫影響
無。新案例以獨立專案 localStorage 鍵保存，不建立正式版本或執行紀錄。接續調整會移除舊 E2E 共用鍵中 platform:web 的草稿，保留其他平台；JSON 毀損時不猜測刪除並明示清理失敗。

## 風險
本機儲存容量、毀損資料與未儲存離頁；AI 建議缺乏真實 DOM 證據，須明示未驗證並防止過期回覆覆蓋人工修改。不可將預覽或矩陣估算當作真實執行。

## 設計文件同步
更新目前規格、前端 README 及新增工作台專題文件，記錄入口、保存邊界、AI 契約與未接入能力。

## 領域
前端、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據

### 編輯頁與 Appium 樣式一致性

- 對照 ScriptWorkspace／ApiChat 的實際 class，將 Web 控制項改用 compact 密度、text-menu 內文／text-body 區塊標題；保留固定淺色與既有 token。聊天 header／輸入區改為 canvas，使用者訊息為 brand-soft，傳送與停止使用圖示；左右採等寬雙欄。原對話保存與 AI 建議套用契約不變。
- npm.cmd run build --prefix apps/web 及 node scripts/verify-web-playwright-ui.mjs 通過；既有大型 bundle 提示保留。未接入真實 Worker 或模型驗收。
- DS_REQUIRE_BROWSER=1：states 41 element-state、axe 0 violations、target-size 24 targets、responsive 280／320／414 於 1.25 倍字級、overflow 320／414／1280 均通過；keyboard 11 controls／1 composite、mobile-first、reduced-motion、intent 通過。lint_hardcodes 與 no-emoji 通過，沒有新增原始色彩或第二套 token。
- 實際查看 1280 桌面及 390 手機，輸入需求並操作圖示傳送，以替身回覆確認使用者訊息與 AI 文字樣式；未儲存截圖。視覺檢視後補上聊天窗 overflow-hidden，讓標頭／底部表面遵循圓角。
- 文件同步至目前規格 1.18、Web 專題 1.3 與前端 README；結束前重新產生計畫索引、執行文件檢查與 diff 檢查。字級對齊既有 Appium token，未變更全站字級定義。

### 名稱列與返回圖示修正

- npm.cmd run build --prefix apps/web 通過，保留既有大型 bundle 提示。專用互動回歸通過，返回與未儲存確認保持原行為。初次回歸在建置尚未結束時找不到 dist/assets，待建置完成後重跑通過。
- DS_REQUIRE_BROWSER=1：編輯頁 verify_states 通過（41 element-state）、verify_target_size 通過（24 targets、414／1280）、verify_responsive 通過（280／320／414、1.25 倍字級）、axe 0 violations。
- 實際查看 1280 桌面與 390 手機畫面並點擊返回／新增：返回為既有左向 chevron，桌面名稱與操作同列對齊，手機返回與名稱同列、操作下一列。未保存截圖。先前視覺工具受用量限制未執行，使用者要求繼續後同一工具執行成功。
- 同步目前規格 1.17、Web 專題 1.2；文件索引與檢查於結束前重跑。此修正未改執行能力、API、資料與導向。

### 接續調整驗證：Appium 式畫面與舊 Web 草稿移除

- npm.cmd run build --prefix apps/web：通過，仍有既有大型 bundle 提示。
- node scripts/verify-web-playwright-ui.mjs：通過；新增驗證主畫面預設只顯示預覽、案例／環境／設定收起、浮動選單 Escape 與焦點返回、案例編輯／返回及放棄未儲存內容。保留原本 AI 建議、過期回覆、本機保存與矩陣回歸。
- 清理驗證：舊 Web 草稿移除、同鍵 Android 項目保留、未開啟專案保持原狀；開啟另一專案時只含舊 Web 的鍵刪除；新版 Web 案例重載後仍可編輯；毀損舊資料顯示錯誤並保留原文。沒有刪除新版案例或其他平台資料。
- DS_REQUIRE_BROWSER=1，沿用 bundled Playwright 臨時 loader 與 Chrome：主畫面 verify_states 通過（10 element-state），展開設定 verify_states 通過（44 element-state）；案例選單 axe 0 violations、verify_keyboard 通過（5 controls）、verify_target_size 通過（10 targets，414／1280）、verify_responsive 通過（280／320／414、1.25 倍）、verify_overflow 通過。編輯頁 axe 0 violations、responsive／overflow 通過；主畫面 mobile-first／reduced-motion 通過，編輯頁 intent 通過。
- 初次選單 keyboard gate 發現焦點移出即關閉導致 Tab 掃描無法到達新增案例；調整為與 Appium 相同，只以 Escape、觸發鈕或點外側關閉後重跑通過，未關閉瀏覽器要求。
- lint_hardcodes.py 與 check_no_emoji.py 通過；未新增色彩、字型或尺寸 token，使用現有 Android 畫面高度、手機比例、圓角及語意色彩。
- 實際查看 1280 桌面主畫面／案例選單／編輯、390 手機主畫面／案例選單，操作編輯與返回，未儲存截圖。自我檢視確認主要畫面不再由案例清單占用，設定不常駐；沒有新增動畫。
- 目前規格 1.16、Web 專題 1.1、前端 README 已同步；npm.cmd run docs:plans:index、npm.cmd run docs:check 與 git diff --check 通過。
- 外部 Worker、實際模型與 LIFF／LINE 真機、完整 App／真實後端整合及部署仍未驗收；本次只調整介面與已授權的本機舊草稿清理。

### 初版驗證紀錄

- npm.cmd run build --prefix apps/web：通過；保留既有大型 bundle 提示，未調整全站分包。
- node scripts/verify-web-playwright-ui.mjs（NODE_PATH 指向本機 bundled Playwright）：通過。真實 React 元件搭配模型回覆替身，驗證必填、API 請求契約、明確套用、人工修改與過期建議、儲存恢復／對話隔離、矩陣 4 情境、停用未接入執行、離頁保護、鍵盤 Home／End、320／390／768／1440 水平溢出及毀損資料不覆寫；無 pageerror。不是實際模型或 LIFF 驗收。
- DS_REQUIRE_BROWSER=1，以本機臨時 ESM loader 載入 bundled Playwright、Chrome，針對同一元件與建置 CSS 產生的 author.html／settings.html 執行：verify_states.mjs 通過（41／44 element-state）；verify_responsive.mjs 通過（280／320／414、1.25 倍根字級）；verify_keyboard.mjs 通過（11 controls、2 composites）；verify_target_size.mjs 通過（60 targets、414／1280）；verify_overflow.mjs 通過（320／414／1280）；verify_mobile_first.mjs、verify_reduced_motion.mjs、lint_intent.mjs 通過；axe_audit.mjs 0 violations。未將缺少套件時的失敗或 SKIPPED 當成通過；改用實際可用套件後重跑。
- bundled Python 搭配 PYTHONUTF8=1，lint_hardcodes.py 掃描兩個新增前端檔案通過，check_no_emoji.py 通過；原生 select、行內 style、@apply、原始色碼／Tailwind 原始色盤掃描無匹配。新網格 token 定義於既有 tailwind.config.ts，其餘沿用共用語意色彩／字型／控制項。
- slop_tells.mjs --strict 通過。taste_audit.mjs --strict 未通過：1 HIGH 為最大標題 20／內文 16 的 1.3 倍層級，另有 3 段文字行長 MED。此檢查要求行銷式約 2.5 倍標題，與沿用本專案工作台字級及克制版面的決策不一致，因此記為風格提示，未宣稱全數 gate 通過，也未為通過工具改大標題。
- 實際檢視桌面 1440 與手機 390 的瀏覽器記憶體畫面，操作設定展開／收合；未保存預覽截圖。自我檢視後將設定預設收合，手機名稱／網址各自全寬，避免表單擠壓對話與預覽。沒有新增動態效果，不需要額外動畫狀態。
- npm.cmd run docs:plans:index、npm.cmd run docs:check：通過；git diff --check 通過。
- 未包含外部 LIFF／LINE 真機、實際模型連線、WebKit 實跑、完整 App／真實後端整合或部署驗收。外部瀏覽器工作階段、腳本格式檢查、基準圖與結果報告均不在本輪介面實作範圍；本機草稿不是正式案例版本。
