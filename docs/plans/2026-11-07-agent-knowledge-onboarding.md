# Agent 知識庫與首次設定引導

## 範圍
首次開啟依序選擇前端來源、獨立測試專案、匯入知識。知識與 AI 閱讀入口存於測試專案，可獨立版控；平台查看與新增文字知識，不提供聊天模型或向量資料庫。接續依使用者回饋：已初始化或匯入內容後不再自動彈窗，精簡文字，以真實專案流程、緊湊中間層清單及知識文件預覽呈現，細節改為按需展開。

## 影響檔案
- services/local-workspace/：設定持久化、原生資料夾選擇、知識檔案契約
- apps/web/src/features/workspace/：三步引導與 Agent 知識庫
- test-project/AGENTS.md、README.md、knowledge/：AI 知識入口
- ARCHIFY-CURRENT-SPEC.md、docs/local-workspace.md、apps/web/README.md、README.md
- scripts/ 與本機服務回歸測試

## 資料庫影響
無；使用獨立測試專案 knowledge/ 的文字與索引檔。

## 風險
保留既有 .env 非路徑設定、既有專案與知識內容。匯入文件是參考資料，不視為執行指令；不讀取秘密。瀏覽器檔案匯入不提供絕對路徑，使用本機資料夾選擇器並提供路徑輸入備援。路徑驗證不是 OS 沙箱。

## 設計文件同步
同步現況規格、本機服務契約、前端與測試專案操作文件；記錄檔案型知識庫及初始化設定決策。

## 領域
前端、測試框架、架構

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- npm run build --prefix apps/web：TypeScript 與 Vite 建置通過。
- npm run test:workspace：7 項通過，包含設定保存、既有資料／註解／人工 README 保留、重新啟動、知識去重／封存、大小／路徑／同源與原生 Playwright 回歸；npm test：既有框架 10 項通過。
- DS_REQUIRE_BROWSER=1 的 verify-knowledge-ui、verify-local-workspace-ui、verify-reader-ui 均通過。知識 gate 操作三步、錯誤恢復、文件與文字匯入、安全預覽、搜尋、取消／封存、完成狀態、重開引導、焦點循環與返回、axe、32px 目標、390／1024／1280／1440／1920 overflow、200% 縮放與 reduced motion；原生選擇器以注入替身回傳路徑，其他 middleware／檔案操作均使用真實暫存專案。
- node scripts/verify-reader-dev-css.mjs：根目錄 cwd 下 Vite 開發 CSS 通過。Node REPL 直接連 localhost 遭網路限制，提升權限後以 Chrome 實際開啟 localhost:5173，查看三步引導、用既有路徑進入第三步、查看已匯入起始知識；畫面只在記憶體中回傳，未存預覽截圖。
- 已在獨立測試專案建立 knowledge/、追加 AGENTS.md 入口，匯入「測試專案背景.md」一份，內容僅是本對話已確認的架構、測試寫法與限制；沒有認證實值。保留既有腳本、測試 .env 與 config/http.json，首次引導仍待使用者完成。
- 同步目前規格 1.28、本機契約 2.1、前端文件 2.6、設計 1.6、架構 1.5、操作與範本，新增 agent-knowledge-files 決策。
- 限制：Windows 原生資料夾視窗的實際選取未做 OS UI 自動化；可使用完整路徑備援，取消不改設定有測試。未執行產品中間層、模型或 Web／手機業務驗收；尚無 PDF／Word 擷取或向量搜尋。規則不是 OS 權限隔離。

- 最終文件驗證：npm run docs:plans:index、npm run docs:check 通過（20 份計畫）；git diff --check 通過。保留先前未提交工作，未加入秘密、預覽截圖或產品執行產物。

- 接續設計依使用者指定採 UI UX Pro Max，讀取官方 SKILL、quick-reference、pro-rules 與 UX 資料；唯讀下載於 .local/ui-ux-pro-max-skill，來源 commit b7d5353。Python／python3 為不可執行的系統別名且沒有 py，故未宣稱跑過 BM25 搜尋，改用已核對的靜態規則。保留既有 Tailwind 深色 tokens、14px 桌面與 32px 控制項，未另產生設計系統。

- 減字與引導接續完成：已初始化或匯入知識時不再自動開啟引導，保持手動入口；config 新增 knowledgeCount。來源頁以真實專案流程、操作／腳本／狀態列呈現；知識頁改為雙欄，新增表單與路徑預設收起，報告次要說明按需展開。保留非覆寫、來源證據、錯誤與操作能力，不新增裝飾圖示。
- 接續驗證：前端 build、7 項本機服務回歸通過；DS_REQUIRE_BROWSER=1 的分析、知識及閱讀器三組 gate 通過（包含匯入後尚未按完成即重新整理，不應彈窗）。開發 CSS 通過。已以提升權限的 Chrome 實際查看 localhost:5173 的 66 支中間層與知識雙欄、操作文件預覽，未保存畫面。同步目前規格 1.29、服務文件 2.2、前端 2.7、設計 1.7 與相關決策。
