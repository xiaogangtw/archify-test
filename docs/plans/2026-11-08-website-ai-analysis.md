# 網站啟動本機 AI 與知識更新

## 範圍
網站按鈕啟動 Codex CLI 功能分析及 MD／HTML 知識整理，提供非同步進度、取消及驗證後套用。新資料語意去重、更新相同知識並封存舊版，衝突留問題；不修改測試或前端。不再要求複製提示到外部聊天。

## 影響檔案
- services/local-workspace/ai-jobs、ai-analysis、knowledge、plugin、workspace、config 及回歸
- apps/web/src/features/workspace 的地圖、知識匯入與 AI 狀態
- 相關規格、操作文件、設計及決策

## 資料庫影響
無；知識原檔、索引備份，版本比對後套用。

## 風險
CLI 使用本機登入，但推論可能送至模型服務；網站只送受限來源與抽取知識，不送 .env。AI 只回傳 JSON，由平台驗證與更新。語意去重可能出錯，保留舊檔與更新證據可還原。失敗、取消或過期不得更新資料。

## 設計文件同步
同步網站 AI 操作、本機契約、HTML 解析與知識取代規則、版本、限制及驗證；以使用者新指示取代先前不啟動網頁 AI 的限制。

## 領域
前端、本機服務、AI 整合

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
已檢查本機 codex-cli 0.164.0 exec --help，支援 read-only、ephemeral、stdin、output-schema 與 output-last-message。已查官方非互動文件；網站操作使用使用者本機帳號，不新增 API key 欄位。

- 真實 CLI 合成資料測試：知識 1 更新／1 取代、功能 1 頁面／1 功能，均經平台驗證套用。未送使用者實際來源或知識作模型驗收。
- npm run test:workspace：26 通過；npm test：12 通過；npm run check:types --prefix test-project 通過。
- npm run build --prefix apps/web 與 node scripts/verify-feature-graph.mjs 通過。
- DS_REQUIRE_BROWSER=1 下 verify-website-ai-ui、verify-knowledge-ui、verify-catalog-ui、verify-frontend-overview-ui、verify-local-workspace-ui 全數通過；實際查看網站 AI 畫面，未保存截圖。涵蓋進度、HTML、合併／衝突、還原、可及性與視窗溢位；網站回歸注入模型，實際 CLI 另測。
- Windows 沙箱暫存 rename 曾受 EPERM 阻礙，改以核准的本機執行完成回歸；舊 overview 測試按鈕名稱同步後重跑通過。
- 本次未執行產品中間層請求。模型品質仍依實際業務輸入而異；跨檔案儲存不是資料庫交易，磁碟中斷可由封存追查及回復。
