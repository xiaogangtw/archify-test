# 專案知識、案例與腳本關聯

## 範圍
建立外部測試專案的功能／案例目錄、知識分類與編修、腳本靜態關聯、依賴版本及具體待處理事項，網站提供案例與關聯地圖及 AI 交接文字。執行報告記錄腳本與相對依賴 fingerprint，舊報告不冒認新版驗證。AI 由使用者本機工具操作，不在網頁呼叫模型；不執行產品測試或自動修改業務規則。

## 影響檔案
- services/local-workspace 的 knowledge、catalog、workspace、plugin 與測試
- test-project/test-cases、support/script-evidence、reporter、README 與 skills
- apps/web/src/features/workspace 的知識、案例及地圖畫面
- 外部獨立測試專案對應框架與規則；現有腳本、.env 與 Header 保留

## 資料庫影響
無；檔案版控，寫入使用版本比對、原檔備份與非覆寫備份。

## 風險
靜態引用不等於執行覆蓋；業務語意衝突由 AI／人員核對，不自動宣稱一致。無完整依賴或舊報告只列版本未知；不讀秘密值。來源檔案及連結只限設定範圍，不執行被分析程式。

## 設計文件同步
同步整合規格、本機 API、架構、前端 README、DESIGN、獨立專案規則及決策；沿用 token、compact 文字導覽與雙欄詳情，不增原生 select 或動畫。

## 領域
前端、本機服務、測試框架

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
已確認現有知識僅匯入／讀取／封存；報告只含 spec sourceHash，不足以證明引用 API 或工具未改。

- 新增 catalog schema／寫入 revision／備份、來源預覽與來源逐檔 hash，案例 ID／路徑對應、未連結與重複／遺失提示，靜態引用與 test.step 宣告不視為執行覆蓋。前端 view=catalog／knowledge 可重新整理，案例可直接開啟指定歷史報告。
- 專案知識支援四分類、適用功能、內容編修、內容與 metadata 競爭檢查、實體內容去重及備份。AI 在本機補 catalog／knowledge／api／tests，網站提供交接文字，不啟動模型或寫入產品。
- 外部測試專案先備份後同步框架與規則，核對 .env、config/http.json 及原有腳本 hash 未變，只讀重掃沒有擅自生成或移除腳本。
- npm run test:workspace 21 項、npm test 12 項、範本與外部專案 check:types、前端 build 通過。另以原生 Playwright／loopback 驗證 reporter 確實保存 case ID、意圖及依賴證據，登入三種結果回歸通過；產品請求 0。最後補上外部知識修改的去重回歸後 catalog 兩項再通過。
- DS_REQUIRE_BROWSER=1 的 verify-catalog-ui、verify-knowledge-ui、verify-local-workspace-ui 全通過，含實際檔案／middleware、案例增改、地圖／來源預覽、報告跳轉、知識編修、版本過期、axe／contrast、鍵盤、target、reduced motion、zoom、390／1024／1280／1440／1920 overflow。實際查看案例、地圖與知識編輯畫面，截圖只在記憶體，未存檔。原知識 gate 期待舊標題，核對現有 API測試腳本 標題後修正測試定位，未覆寫該使用者 UI 文案。
- impeccable context 因引擎快取無寫入權限失敗，依技能 fallback 讀既有 DESIGN 及參考，沿用既有 tokens；未安裝引擎。write-tests 官方 quick_validate 通過。
- 同步整合規格 1.40、本機服務 2.13、架構 1.12、前端 README 2.10、DESIGN 1.10、新主題規格與決策、獨立專案入口與技能。localhost:5173 實際 API 回傳 200、1 案例、70 未連結；舊登入報告顯示版本未知而非冒認新版通過。未串接第三方 Archify renderer 或本機 CLI 自動啟動。

## 使用者校正：真正的互動地圖

使用者指出原本順序列表不是地圖，且案例操作過於技術化。本次調整同一任務：地圖作預設入口、SVG 節點連線與縮放平移／節點拖曳、功能選擇與點擊詳情，管理清單分開；預設隱藏編號、hash 與大型表單。只有受證據支持的關聯使用實線，宣告順序或未確認問題用虛線及文字標示，不捏造產品流程。不得只改名而保留舊列表作地圖。

### 地圖校正完成與驗證

- 預設入口改為功能地圖：左側功能選取、中央原生 SVG 節點／連線、點選後才出現 MapDetails。測試清單獨立，沒有舊列表堆在圖下方；名稱／目的／預期先呈現，ID 自動生成，檔案與技術欄位收起。功能改名、類型、知識及問題編修能力保留在展開區。尚未分類的 70 支腳本不捏造成業務功能，可複製本機 AI 整理任務。
- feature-graph.ts 的多案例分支分開排列，已知歸屬與 API 引用為實線、宣告順序／問題為虛線；未推測 token／cardId 或 API 實際呼叫順序。支援背景平移、滑輪與控制項縮放、節點拖曳、鍵盤平移／縮放／重設、Alt＋方向鍵移節點、Enter／Space 選取及關閉詳情返回焦點。畫面座標不寫回專案。
- node scripts/verify-feature-graph.mjs 通過：穩定 ID、無節點碰撞、長文／空資料、連線證據及多案例模型。最終 build、test:workspace 21 項、npm test 12 項通過。
- 三份 DS_REQUIRE_BROWSER=1 gate（catalog／knowledge／local-workspace）最終全通過。互動圖 gate 實際檢查 SVG 邊、縮放／背景平移／節點拖曳、焦點恢復、程式預覽、獨立清單、資料編修、過期報告、axe／contrast、target、keyboard、zoom、reduced motion 及 390／1024／1280／1440／1920 overflow。初次發現連線 g 的 ARIA label 需語意 role，已修正後通過；焦點驗證等待實際 RAF 恢復、表格補正 accessible name，未停用 gate。
- 已實際查看 localhost 登入圖：6 節點、5 連線，及點擊後詳情；另查看替身多步驟圖與清單，所有截圖僅記憶體輸出未存檔。只讀使用者資料，不改外部測試／API／.env，不發送產品 API。
- 同步規格 1.41、traceability 1.1、本機服務 2.14、架構 1.13、前端 README 2.11、DESIGN 1.11；沿用同一計畫，不新增競爭資料來源。docs:plans:index、docs:check、git diff --check 通過。
