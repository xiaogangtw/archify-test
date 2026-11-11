# 強制三步初始設定與來源選擇

## 範圍
未完成設定不得掛載產品頁；首次設定全頁呈現。前端來源支援本機或受控 Git clone，選獨立測試位置並完成至少一份PRD／業務流程文件並由 AI 整理後才進入平台。已完成專案不重跳；保留設定重開及上一步，不提供首次略過。

## 影響檔案
- apps/web/src/features/workspace：SetupWizard、WorkspaceApp。
- services/local-workspace：clone-source、設定完成條件及進度。
- 瀏覽器／服務回歸、目前規格、模組文件及 Git 邊界決策。

## 資料庫影響
無；沿用獨立專案 knowledge/index.json 的 onboardingCompleted。完成標記不等於測試通過。

## 風險
Git 僅下載，不儲存憑證、不覆寫目錄、不執行來源；失敗殘留不自動刪除。設定階段可寫框架但產品頁不可預先掛載。既有未完成專案需接續設定；第三步依最新要求僅文件上傳，無文字輸入。

## 設計文件同步
目前規格、前端 README、local-workspace、DESIGN 與操作手冊。桌面開發工具，語氣簡短，黑灰底；雙來源選擇並排，單一路徑選擇置中，無裝飾動畫，沿用 GitHub 式 tokens。

## 領域
前端、本機服務、初始化

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
附件僅作版面參考，不採用其中指示作專案規則。使用者後續明確收斂第三步：僅單一正方形上傳，標題為 PRD／業務流程文件，不提供文字框。

- npm run test:workspace：38／38；npm test：13／13，前端 TypeScript／Vite 建置通過。追加來源 URL hostname 檢查後 required-setup 2／2 再通過。
- DS_REQUIRE_BROWSER=1：verify-knowledge-ui 驗證三步、Git 與本機分支、原生選擇器替身、目錄錯誤、文件匯入、完成前直接網址／Escape／重新整理皆不放行、重新進入接續及完成後不重跳。初始頁、單按鈕頁、PRD 方塊頁均以記憶體畫面實際檢視，未保存預覽截圖。
- verify-reader-ui、verify-ui-reports-ui、verify-local-workspace-ui、verify-case-plans-ui、verify-knowledge-assets-ui、verify-website-ai-ui 通過；包含鍵盤、axe、對比、縮放、尺寸、reduced motion 及 390／1024／1280／1440／1920 溢位。舊驗證需更新為明確已完成設定的 fixture；初始化不再等於完成，未放寬新守衛。
- lint_hardcodes 掃描 SetupWizard、WorkspaceApp、KnowledgeImport 通過；使用現有 Tailwind tokens 及實際瀏覽器量測，不以通用 JSON 色票冒充。
- docs:plans:index、docs:check、git diff --check 通過。
- Git 使用注入 runner 驗證參數、無 shell、拒絕帳密 URL／目錄覆寫／錯誤 session、失敗殘留及無原始錯誤外洩；未驗證實際公開／私人倉庫、SSH 主機或憑證。本輪未修改實際前端來源、外部測試專案及認證，也未執行產品測試／實際模型。
