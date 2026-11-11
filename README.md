# Archify Test

本機前端程式碼分析框架與流程／報告閱讀器。產品測試放在平台之外的獨立專案，用自己的編輯器或 AI 工具撰寫、一般 Git 工具版控；不需要將平台一起提交。

## 安裝與啟動

需要 Node.js 22.18 以上，從平台根目錄執行一次即可安裝全 workspaces（`apps/web` 與 `test-project`）：

```powershell
npm install
```

直接啟動並依初始引導選擇來源與獨立測試專案。來源與環境設定保存測試專案 .env，初始化及重新連接會補齊 .gitignore。平台僅以排除 Git 的 .local/workspace.json 記住測試專案位置；舊平台 .env 的現行工作區設定在連接成功後遷移，其他舊服務設定保留。修改設定後重新啟動：

```powershell
npm run dev
```

開啟終端顯示的本機網址。Vite 同來源的受限檔案服務負責掃描與生成，不使用舊 Control API、VM、資料庫、Git 連線或 Agent。正式建置後可用 npm run preview --prefix apps/web；純靜態託管只有閱讀能力，不會取得本機資料夾。

## 使用流程

1. 開啟「前端程式碼分析」，確認來源、獨立測試專案與 中間層腳本輸出位置。
2. 第一次按「初始化獨立測試專案」，建立專案自身框架、skills 與設定，不覆寫既有衝突檔。
3. 「確認位置並分析」，查看接口數、可確認的服務 origin、來源與待補資訊。
4. 選取並產生單一 .spec.ts 草稿；請求、資料與斷言同檔，既有檔案保留。生成不發送請求，也不代表可直接驗證。
5. 在獨立測試專案先 npm ci，再設定 .env，於 .spec.ts 填入資料與業務斷言後將 ready 設為 true。用自己的 AI 工具／編輯器繼續維護。

在獨立測試專案執行：

```powershell
npm run flow
npm test
```

flow 產生未執行流程，test 才實際執行。尚未設定的草稿會略過且不發送請求，不算通過。報告產生 JSON 與可直接開啟的 HTML；平台「測試報告」固定讀取已綁定專案的報告目錄，進入即載入最新報告；不提供手動匯入或資料夾選擇。資料只在頁面記憶體呈現，平台不修改報告。

完整設定、安全邊界與限制見[本機來源分析文件](docs/local-workspace.md)及[測試專案範本](test-project/README.md)。範本的本機運算例子不是產品驗收，平台初始化不複製該範例。

## 驗證

```powershell
npm test
npm run test:workspace
npm run build --prefix apps/web
node scripts/verify-reader-dev-css.mjs
npm run docs:plans:index
npm run docs:check
```

瀏覽器驗證需設 DS_REQUIRE_BROWSER=1，執行 node scripts/verify-local-workspace-ui.mjs 與 node scripts/verify-reader-ui.mjs；需要 Playwright／Chrome 與既有範例報告。Windows 的 junction 邊界測試需對應權限。舊 Control API 回歸仍為 npm run test:legacy。

舊服務、來源與資料保留供遷移，未自動轉換 DB／localStorage 案例。Web／Android runner 尚未整合。舊 VM 操作僅見[歷史操作手冊](docs/legacy-operations.md)。

共用 Header 設在獨立測試專案 config/http.json，秘密只放該專案 .env。共用 → 接口 → fixture.headers 依序覆寫，null 可移除，詳細範例見測試專案 README。

中間層測試環境使用 BFF_BASE_URL，填入 dev／QA BFF 網址，GraphQL 包含 /graphql；獨立專案 .env 為執行來源。檔案以操作名稱命名，報告採台北日期時間。未來 Playwright 報告技能已附於測試專案 skills/playwright-test-report，手機圖文格式仍獨立，一般 Playwright 執行結果已可讀取。

新格式使用 Playwright Test 1.64.1；測單支可 npm test -- tests/api/AcceptAllRequests.spec.ts，流程可 npm run flow -- tests/api/AcceptAllRequests.spec.ts。舊三檔稿與原設定保存在 legacy/pre-playwright，不需要在 fixtures/api 逐支填設定。平台回歸前另需 npm ci --prefix test-project 安裝鎖版套件。

## 首次設定與 Agent 知識

開啟本機平台後，依四步引導依序設定本機 AI CLI（切換 Codex／Claude Code／Gemini CLI、偵測狀態、挑選／自訂模型、連線測試與直接儲存）、選擇前端來源、選擇獨立測試專案位置、匯入知識。可使用 Windows 資料夾視窗或貼上完整路徑；CLI 偏好先保存於平台 `.local/ai.json` 並於選定專案後同步測試專案 `.env`，路徑設定即時套用，其他進階選項保存在測試專案 .env。既有測試與認證不覆寫，新專案先 npm ci。

側欄「Agent 知識庫」可匯入 UTF-8 .md／.txt 或輸入文字，查看、搜尋與封存。內容保存測試專案 knowledge/，可與 tests／skills 一起 Git 版控。在自己的 AI 工具開啟測試專案，先讀 AGENTS.md 與 knowledge/README.md；平台不自動傳送內容給模型。詳見 docs/local-workspace.md。

## 前端移除的 API

同一來源根目錄重新完整分析後，可展開「前端未再出現」選取腳本，確認移除並封存；原檔留在測試專案 legacy/removed-api，可還原，不覆寫現有檔案。首次使用先建立同步基準，解析有警告／子資料夾／疑似修改不會當成刪除，詳見 docs/local-workspace.md。這不會移除手動腳本、共用設定或歷史報告。

目前新產生的 .spec.ts 只保留 operation 請求資料（含 query／variables）與最小 test.skip，不自動撰寫通用流程。使用者先填資料，再由自己的 AI 工具補實際測試與斷言；不要只移除 skip 讓空測試通過。

新 API 或尚未建立腳本時，先「分析前端」，再按「補齊缺少腳本」；已有檔案保留，亦可只建立選取項目。已建立腳本只是檔案存在，填資料與撰寫實際測試仍由使用者／AI 完成。

## 專案知識與測試案例

網站提供「專案知識」分類編修與「功能地圖」節點連線視圖，測試清單獨立切換；資料在獨立專案 knowledge/ 與 test-cases/catalog.json，AI 在本機工具修改後重新讀取。舊通過結果與新版驗證分開；完整操作及限制見 [測試關聯](docs/test-traceability.md)。不新增模型呼叫、腳本編輯或產品執行控制。

## 網站 AI 操作

功能地圖可直接按「AI 分析功能」，專案知識可匯入 MD／HTML／圖片，先本機略過相同內容，唯一高度相似文字直接更新為本次上傳版，其餘由 AI 去重更新，不需外部對話代做；分析進度、完成與錯誤以 3 秒自動退場的浮動 Toast 呈現（分析中保留取消按鈕，完成／錯誤不設關閉按鈕）。先在本機安裝並登入 Codex、Claude Code 或 Gemini CLI（圖片知識辨識目前僅 Codex 支援）；可在工作區設定第 1 步（或測試專案 `.env`）設 ARCHIFY_AI_PROVIDER／ARCHIFY_AI_CLI／ARCHIFY_AI_MODEL，側欄與功能地圖會顯示目前生效的 CLI 與模型。分析可能使用模型服務用量；取代知識有備份及還原，原始碼與測試不由 AI 直接改動。詳見 [網站 AI 分析](docs/website-ai-analysis.md)。

## 案例規劃與閱讀

網站「測試流程」只讀獨立專案 test-cases/catalog.json，顯示表格與專案位置，可重新讀取。請在測試專案使用 plan-test-cases skill 規劃與補資料，再使用 implement-tests skill 寫測試，不需回網站確認。cases:check 可選檢查欄位完整性，不代表執行通過。詳見 [案例與關聯](docs/test-traceability.md)。

專案知識現可上傳每份 10 MB 的 MD／HTML／TXT 與 PNG／JPEG／WebP（每批合計 20 MB），自動拆段／辨識並整理；原檔留在獨立專案 knowledge/sources，知識詳情可查看原圖或下載原始檔。模型不推測圖片中的點擊動作，未指定用途不當成樣式基準。完整流程見 [網站 AI 分析](docs/website-ai-analysis.md)。

## API 與畫面報告

測試報告頁分 API／畫面；畫面可設定下次執行是否保留截圖，關閉仍產生 JSON／HTML／TXT。一般頁面在前端專案以 npm run dev -- --host 127.0.0.1 --port 5174 --strictPort 啟動，獨立測試專案設 WEB_BASE_URL=http://127.0.0.1:5174，BFF_BASE_URL 保持中間層網址。網頁使用 write-web-tests，推播使用 write-push-tests，統一報告使用 playwright-test-report skill。報告預設 reports/api／reports/ui，舊報告仍可讀。Android 面板只準備環境；本輪不開 LINE、不擷取手機畫面或發推播。詳見 [畫面測試與報告](docs/ui-testing-reports.md)。

初次開啟必須完成四步：設定／確認本機 AI CLI、選 Git／本機前端來源、獨立測試位置、上傳 PRD／業務流程文件；完成前無法進入其他頁面。Git 只下載，不管理版控或 token；已有完整設定不重複引導。

新專案網頁測試預設逐操作保存證據：使用共用 web-test fixture，每次常用操作及畫面斷言有角色／順序／結果截圖；特殊操作以 uiStep 明示，執行前 check:ui-evidence 檢查。超量分卷保留全圖，既有專案可用 scripts/upgrade-operation-evidence.mjs 備份升級，詳見 [報告契約](docs/ui-testing-reports.md)。
