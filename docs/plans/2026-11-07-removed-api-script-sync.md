# 前端 API 移除同步腳本

## 範圍
同一來源與輸出範圍重新分析，列出不再出現的受管單支腳本；使用者確認後移出 tests 並封存原檔與 manifest，可還原且不覆寫。保護手動腳本、不同範圍、解析不完整與疑似修改的操作。不實作 AI CLI 或修改腳本自動覆寫。

## 影響檔案
- services/local-workspace/script-sync.mjs、workspace.mjs、plugin.mjs 與測試
- apps/web/src/features/workspace/SourceWorkspace.tsx、client.ts
- services/local-workspace/config.mjs：統一 Windows 相對目錄分隔符
- scripts/verify-local-workspace-ui.mjs
- ARCHIFY-CURRENT-SPEC.md、docs/local-workspace.md、README.md、apps/web/README.md

## 資料庫影響
無；analysis 內保存來源範圍與受管腳本索引，legacy/removed-api 內保存封存及還原資訊。

## 風險
靜態分析缺少證據不等於 API 已刪除；有警告、變更範圍、零來源檔或同名 GraphQL 變更不自動推定移除。只能確認後封存；不刪除共用設定、資料、skills、知識與報告。舊專案首次建立追蹤基準，不追溯猜測未追蹤腳本。

## 設計文件同步
同步目前規格、來源同步契約、前端／測試操作文件及決策；沿用現有精簡列表與 destructive 確認。

## 領域
前端、測試框架、架構

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- 接續修正：使用者在頁面讀取時看到檔案操作忙碌錯誤；檢查 StrictMode 重複載入分析與本機鎖的互斥行為，合併重疊讀取並排隊等待寫入，不重送寫入操作。
- npm run build --prefix apps/web：TypeScript 與 Vite 正式建置通過。
- npm run test:workspace：10 項通過，新增 3 項涵蓋原文封存、人工補充保留、取消前不改檔、重啟可還原、拒絕覆寫、快照／腳本過期、同名 GraphQL 變更、子目錄與解析警告、偽造 ID／封存路徑及 Windows 反斜線位置。
- DS_REQUIRE_BROWSER=1 node scripts/verify-local-workspace-ui.mjs：真實暫存來源移除 GraphQL 檔後，確認列出候選、取消不改檔、確認移出與位元組相同還原；destructive 確認通過 axe、文字對比及 390／1024／1280／1440／1920 overflow，原有初始化／掃描／生成／報告、鍵盤、目標、縮放與 reduced motion 回歸通過。以記憶體畫面實際查看確認視窗，未存截圖。
- DS_REQUIRE_BROWSER=1 的知識與報告 gate 通過；開發 CSS 轉換通過。移除同步不執行腳本或產品 API。
- 已同步目前規格 1.30、本機服務 2.3、前端 2.8、設計 1.8、架構 1.6、README 與獨立專案手冊，新增 removed-api-script-archive 決策。文件與差異檢查見下列完成證據。
- 未清理或改動外部測試專案既有腳本；使用者下一次分析才建立同步基準。限制：來源絕對路徑改變重新建基準，首次不猜測未追蹤舊消失項；有解析警告、子資料夾、同源疑似修改及多腳本 ID 均不提出候選。跨檔失敗保留封存且不覆寫，非 OS 沙箱。AI CLI 與變更腳本覆寫不在本次範圍。

- 完成證據：npm run docs:plans:index、npm run docs:check 與 git diff --check 通過；保留原有未提交工作，未新增秘密、截圖或產品測試產物。

- 忙碌錯誤接續完成：先以兩次同時 analysis 重現一成功一拒絕；修正後兩次均成功。新增 middleware 6 併發讀取、等待掃描後取得新快照、重複寫入仍拒絕、讀寫失敗後釋放的回歸；test:workspace 共 11 項通過。實際 Chrome 開發頁重新載入 3 次，StrictMode 共 6 次 analysis 皆 200、無警示，不寫使用者測試／來源且無產品請求。同步規格 1.31、服務 2.4、架構 1.7。此變更無 UI 或樣式修改，不需新增視覺驗證。
