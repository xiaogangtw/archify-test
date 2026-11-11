# 前端功能總覽與本機 AI 整理流程

## 範圍
從可讀前端建立路由／頁面／相對匯入與 API 證據包，提供可攜 AI 結果格式、驗證及增量套用工具與 skill；由本次 AI 根據實際來源完成第一輪功能分組。網站預設可看全部功能，再點進產品頁面／API 與單支／Flow 測試。保留現有 ID、手動案例與腳本；無證據不猜測業務規則，不在網站執行 Agent 或產品測試。

## 影響檔案
- services/local-workspace/frontend-features、workspace、plugin 與測試
- test-project/support/feature-map、skills/map-frontend-features、package.json 與文件
- apps/web/src/features/workspace 的總覽、功能詳情及互動圖
- 外部測試專案的分析證據、AI 結果與新增功能關聯

## 資料庫影響
無；使用 JSON 與 hash／revision 檢查，備份原檔後套用。

## 風險
靜態路由及可達匯入不等同完整業務語意或執行覆蓋。AI 結果需引用有效來源並標示待確認；完整來源變更後舊結果不得靜默覆寫。未列入功能的頁面及 API 必須明示，不捏造全覆蓋。

## 設計文件同步
更新整合規格、traceability、架構、前端／測試專案 README、DESIGN 及決策；沿用既有深色與原生 SVG 互動，不恢復網頁 Agent。

## 領域
前端、本機服務、測試框架

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
已讀現有規格與模組。現況只有 API 掃描及測試關聯圖，尚無全頁面功能取證或結構化本機 AI 套用；本機偵測到 Codex CLI，但網站不啟動它。

- 新增共用 frontend-snapshot、AST／alias 路由頁面取證、feature-evidence 及增量差異，map-frontend-features skill、features:validate／apply CLI 與兩個同來源端點。提案需完整交代已辨識頁面與 API，驗證來源與 catalog revision 後備份合併，不改人工案例及名稱；消失功能保留 not-found。
- 已由 AI 閱讀前端範例路由與頁面引用關係後測試功能總覽證據整理與套用，保留既有功能／測試腳本與 .env，產品請求 0。
- 外部套用備份 legacy/frontend-map/1794105208799-766d22fb-3766-49c1-95b5-0c4b954a2bbd。獨立專案新增技能、工具與 npm scripts，package-lock 同步，features:validate 與 check:types 通過。沒有啟動巢狀 Agent／本機 CLI 自動分析，第一輪由本次 AI 完成，後續由使用者本機工具依 skill 更新。
- npm run test:workspace 22 項、npm test 12 項、前端 build、node scripts/verify-feature-graph.mjs、範本 check:types 通過。新測試確認 alias／lazy 路由、來源行號／覆蓋驗證、過期來源與案例拒絕、人工名稱／案例保留，以及修改檔案能追到受影響功能。最後 metadata 防護與增量補測後相關回歸再通過。
- DS_REQUIRE_BROWSER=1 的 frontend-overview／catalog／knowledge／local-workspace gates 通過，實際準備與套用、無測試功能顯示、產品／測試分層、頁面來源預覽、地圖縮放拖曳／鍵盤、axe／contrast、target、reduced motion、zoom 及 390／1024／1280／1440／1920 overflow 已驗證。已實際查看使用者 localhost 全部功能總覽，點登入切換產品與現有測試可達；截圖只在記憶體，未存檔。
- 新技能官方 quick_validate 通過。同步整合規格 1.42、traceability 1.2、本機服務 2.15、架構 1.14、前端 README 2.12、DESIGN 1.12、專題文件、決策與獨立專案 README／規則。第三方 Archify renderer 仍未整合；路由為宣告值、API 為靜態可達而非精確控制流程，未聲稱全業務覆蓋。
- docs:plans:index、docs:check 與 git diff --check 通過。
