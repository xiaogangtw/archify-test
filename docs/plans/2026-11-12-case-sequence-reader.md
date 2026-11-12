# 案例互動順序與失敗定位

## 範圍
最新 UX：左側或地圖點葉功能直接進主區完整閱讀器，API 流程／測試案例分頁，返回原分類地圖；不再讓功能與案例詳情隨寬度出現在右邊或底部。保留分類探索、原結果與來源預覽，來源按需展開。
依最新確認，功能詳情改以預設可見的「前端操作與 API 流程表」取代功能序列圖，呈現操作、API、資料傳遞與等待條件；案例結果維持獨立。舊互動資料立即可讀，缺少 API／資料描述明示待分析，下次分析補齊，不從參與者名稱猜 API。
接續使用者釐清：序列圖前移至功能詳情，不依賴案例存在。前端 AI 分析產生有來源與條件的功能互動，套用與閱讀器保持相容；空資料提示重新分析，不以案例或靜態可達關係假造圖。
在功能地圖案例詳情加入可展開的序列圖，沿用案例步驟及選填互動證據；最近報告只在版本相符且步驟唯一對應時顯示結果。保持既有入口，不增加圖庫、執行控制或推測後端行為。

## 影響檔案
- apps/web/src/features/workspace/：案例詳情、互動閱讀器與契約。
- services/local-workspace/catalog.mjs：互動資料驗證及最近步驟結果摘要。
- services/local-workspace/ai-analysis.mjs、test-project/support/feature-map.mjs、feature-sequence.mjs：功能互動 schema、來源驗證、套用與舊分析升級。
- test-project/skills/、test-project/test-cases/README.md：規劃與對應規則。
- test-project/framework/case-narrative.mjs：失敗後業務結果未驗證的明示文案，修正既有測試與文案不一致。
- scripts/verify-case-sequence-ui.mjs：替身瀏覽器回歸。
- scripts/verify-frontend-overview-ui.mjs：零案例功能圖與來源變更回歸。
- docs/test-traceability.md、docs/frontend-feature-overview.md、apps/web/README.md、ARCHIFY-CURRENT-SPEC.md、DESIGN.md。

## 資料庫影響
無。schemaVersion 1 新增選填步驟 interaction，舊案例保持相容。

## 風險
靜態可達 API 無法證明順序；僅使用明確提供的互動，未提供時顯示步驟及待補提示。舊報告、同名步驟或版本變更不推測結果。

## 設計文件同步
同步案例契約、閱讀順序、證據與版本限制；沿用深色 Tailwind token 和共用 ds 元件。參考 Astryx skill，專案規則優先，不導入第二套樣式系統。

## 領域
前端、API、測試框架、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- 主區閱讀版：新增 FeatureReader，左樹／葉節點一次進入主區，API 流程／測試案例具 tablist、panel 關聯、左右鍵／Home／End，返回保留分類鏡頭及入口焦點。長資料兩行短讀，逐步展開完整資料；來源／問題收合且去除重複來源，閱讀時隱藏探索統計、未分類工具與重複新增入口。
- 主區閱讀版 `npm run build --prefix apps/web` 與 `npm test`（22／22）通過。三個 `DS_REQUIRE_BROWSER=1` gates（verify-frontend-overview-ui、verify-catalog-ui、verify-case-sequence-ui）通過，包括左側直達、返回鏡頭、分頁鍵盤、零案例、新增案例綁定功能與儲存回案例分頁、案例返回、來源預覽、來源／版本拒配、axe／contrast、390／1024／1280／1440／1920 溢位、縮放、focus 與 target size。未改後端，本輪不重跑完整工作區替身服務。
- Astryx CLI 0.7.14 已實際讀取本次 build 與 TabList 指引，採主區分頁／麵包屑，沿用專案 ds 與 Tailwind，不安裝第二套 runtime。impeccable context 因本機引擎與 cache 權限未啟動，已明示後改讀現有 DESIGN.md、Operate／craft-floor 指引；不宣稱該引擎檢查通過。
- 已實際檢視全畫面與操作新控制項，以記憶體影像確認完整主區閱讀及資訊層次，未保存截圖。異動 TSX 以 Node 驗證無 inline style、native select、emoji、raw color／px、@apply；文件、計畫索引與最終差異檢查同步。
- 最新調整：功能詳情預設可見四欄流程表，來源收合；map-flow-detail 及 feature-flow token 提供桌面寬度與窄窗局部捲動。sequence 選填 api／transfer，舊資料不猜值，網站 AI schema 與本機 skill 同步，baseline 版本提升為2。
- 表格版最終 `npm run build --prefix apps/web`、`npm test`（22／22）、沙箱外 `npm run test:workspace`（58／58）均通過；API 欄位型別／長度、套用保留與版本1升級為2亦在回歸範圍。
- 表格版 `DS_REQUIRE_BROWSER=1 node scripts/verify-frontend-overview-ui.mjs` 通過零案例表格預設可讀、API／傳遞／條件內容、無呼叫狀態、舊欄位未知、鍵盤展開來源、來源預覽、過期提示、axe／contrast 與390至1920寬度；案例與既有地圖兩個 gate 亦通過。已實際查看記憶體畫面，未保存預覽截圖。來源預覽後先用適合視窗再選圖節點，避免窄圖視窗中點擊畫布外節點。
- 接續釐清後已將序列圖前移功能詳情，最末層功能第一次點擊即開啟；功能與案例共用 SequenceDiagram，閱讀順序為圖、業務步驟／條件、來源，不依賴案例。
- 最終 `npm run build --prefix apps/web`、`npm test`（22／22）、沙箱外 `npm run test:workspace`（58／58）通過；包含功能序列圖來源與行號拒絕、零案例保留、hash 變更、舊分析無變更仍升級一次、既有增量／保留人工資料。
- 最終 `DS_REQUIRE_BROWSER=1 node scripts/verify-frontend-overview-ui.mjs` 通過：零案例功能開圖、條件、鍵盤展開、來源預覽、過期提示、axe／contrast、390／1024／1280／1440／1920 溢位；已實際檢視記憶體畫面，未保存截圖。案例與既有地圖 browser gates 同步回歸。
- Astryx CLI 0.7.14：已讀官方 skill，實際執行 search、build、component Collapsible、template StepperOnTrackVertical；採既有頁面漸進揭露與專案 ds，未安裝 runtime 或變更主題。
- `npm run build --prefix apps/web`：通過（最終建置）。
- `npm test`：22／22 通過。初次發現既有失敗敘述與測試文字不一致，恢復明確的「後續業務結果尚未驗證」後通過。
- `npm run test:workspace`：沙箱內 53／58，暫存服務連線及 symlink 權限造成失敗；依權限流程在沙箱外重跑，58／58 通過，全部為替身服務，未操作真實產品或手機。
- 最後補上來源基準保護後，`node --test services/local-workspace/catalog.test.mjs`：4／4 通過。
- `DS_REQUIRE_BROWSER=1 node scripts/verify-case-sequence-ui.mjs`：最終建置通過。實測唯一配對、同名拒配、缺步驟不推測、腳本與前端來源變更、來源預覽、編輯保存互動、展開／收合鍵盤、axe（含 contrast）、32px 按鈕、390／1024／1280／1440／1920 溢位、200% 縮放及 reduce 模式。
- `DS_REQUIRE_BROWSER=1 node scripts/verify-catalog-ui.mjs`：通過既有互動地圖、焦點還原、編輯、報告導覽、axe 與桌面驗證。
- 已以瀏覽器實際操作及記憶體畫面檢視序列圖，修正兩方互動不必要的寬度；沒有將預覽截圖寫入磁碟。
- Python hardcode／native select 腳本因 Windows python 別名不可執行，改以 Node 對異動 TSX 檢查 inline style、native select、emoji、raw colors／px、@apply，全數通過；樣式來源仍為 Tailwind config，未以無關 tokens JSON 驗證代替。
- `npm run docs:plans:index`、`npm run docs:check` 及 `git diff --check`：通過，狀態更新後再次產生索引及檢查。
- 未呼叫模型分析真實前端、未執行產品 API、未做部署或真實手機驗收。舊案例不自動補造；功能圖下次按「AI 分析功能」才更新。功能來源與案例意圖分離的取捨見 [決策](../decisions/2026-11-12-feature-first-sequences.md)。
