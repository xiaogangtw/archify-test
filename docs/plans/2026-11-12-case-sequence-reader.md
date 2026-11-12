# 案例互動順序與失敗定位

## 範圍
接續使用者釐清：序列圖前移至功能詳情，不依賴案例存在。前端 AI 分析產生有來源與條件的功能互動，套用與閱讀器保持相容；空資料提示重新分析，不以案例或靜態可達關係假造圖。
在功能地圖案例詳情加入可展開的序列圖，沿用案例步驟及選填互動證據；最近報告只在版本相符且步驟唯一對應時顯示結果。保持既有入口，不增加圖庫、執行控制或推測後端行為。

## 影響檔案
- apps/web/src/features/workspace/：案例詳情、互動閱讀器與契約。
- services/local-workspace/catalog.mjs：互動資料驗證及最近步驟結果摘要。
- test-project/skills/、test-project/test-cases/README.md：規劃與對應規則。
- test-project/framework/case-narrative.mjs：失敗後業務結果未驗證的明示文案，修正既有測試與文案不一致。
- scripts/verify-case-sequence-ui.mjs：替身瀏覽器回歸。
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
- [ ] 實作完成
- [ ] 文件已同步
- [ ] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
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
- 未呼叫模型分析真實前端、未執行產品 API、未做部署或真實手機驗收。舊案例須依實際來源補 interaction，不自動補造。沿用既有唯讀契約的選填擴充，無新的架構取捨，不另建決策紀錄。
