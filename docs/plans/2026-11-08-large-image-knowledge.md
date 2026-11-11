# 大型知識文件與圖片分析

## 範圍
每份知識來源可上傳 10 MB，每批 20 份且總共 20 MB。支援 MD／HTML／TXT 與 PNG／JPEG／WebP 圖片；原檔保存在獨立專案，文字拆段及圖片辨識後沿用語意去重、更新與還原。保留原圖、整理文字及來源關聯，不新增分類表單或執行產品測試。

## 影響檔案
- services/local-workspace 上傳驗證、分段工作、CLI 圖片輸入、知識來源儲存與回歸。
- KnowledgeImport、KnowledgeWorkspace 與前端型別／瀏覽器驗證。
- 測試專案知識說明、現況規格與操作文件。

## 資料庫影響
無。知識索引新增選填來源關聯；原始檔以 hash 存放 knowledge/sources，現有知識及確認資料相容。

## 風險
大檔增加處理時間及模型用量，分段進度可取消，不靜默截斷。圖片只能觀察可見內容，不推測點擊動作或後端規則。原檔不執行，不任意讀 URL。模型失敗保留原知識，套用仍核對版本並封存。

## 設計文件同步
目前規格、網站 AI 文件、本機工作區文件、前端 README、DESIGN、測試專案知識入口。

## 領域
前端、本機服務、AI 整合

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
已查本機 codex exec --help 與官方 Developer commands，支援 --image 附件；保持唯讀與結構化輸出。

- build 與 test-project 型別檢查通過；完整 test:workspace 33 項、npm test 13 項通過。最後的進度保留、原始來源指紋、取消及 2 MB 索引相容性修正另有針對性回歸通過。
- 瀏覽器 DS_REQUIRE_BROWSER=1 的 verify-knowledge-assets-ui、verify-website-ai-ui、verify-knowledge-ui、verify-case-plans-ui 通過；涵蓋 PNG／JPEG／WebP、原圖預覽、超過 1 MB 文件、原檔下載、10 MB 拒絕、格式錯誤、錯誤後重試、無分類表單、axe／對比／鍵盤焦點／目標尺寸與 390／1024／1280／1440／1920 溢位。已查看實際記憶體畫面，未保存預覽截圖。
- 真實 Codex CLI 以合成 Rich Menu 圖完成附件辨識及同一平台套用流程，1 份知識、來源保留；未傳使用者實際文件或圖片，未執行產品 API 或推播。其他大檔與瀏覽器模型均為注入替身，不冒稱語意品質驗收。
- 原始 10 MB／20 MB 邊界、完整 UTF-8 拆段、索引候選、半途失敗／取消、原圖指紋變動拒絕、來源 session／路徑及還原不刪原圖均已測。
- 外部測試專案更新來源說明與 2 MB 索引讀取工具共 4 檔，原檔備份 legacy/framework-upgrades；型別檢查通過，未修改其案例、知識索引、腳本或 .env。
- docs:plans:index、docs:check、git diff --check 通過。圖片辨識與候選檢索仍可能有語意誤差；大量來源增加模型呼叫，功能地圖維持獨立輸入上限。
