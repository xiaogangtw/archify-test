# 測試清單追蹤表

## 範圍
升級既有測試清單，分欄呈現案例品質、腳本關聯、最近結果與版本核對；提供搜尋、待處理篩選及展開品質明細，沿用既有案例詳情與報告入口。無產品測試執行、歷次趨勢、自癒或缺陷管理。

## 影響檔案
- apps/web/src/features/workspace/CaseTrackingTable.tsx
- apps/web/src/features/workspace/CatalogWorkspace.tsx
- apps/web/src/features/workspace/catalog.ts
- services/local-workspace/catalog.mjs
- docs/test-traceability.md
- apps/web/README.md
- ARCHIFY-CURRENT-SPEC.md
- DESIGN.md

## 資料庫影響
無。catalog 回應增加選填品質提醒，既有資料不改寫。

## 風險
品質為啟發式提醒；來源版本與執行結果分開，不以腳本存在代表通過。保留原有未提交的案例品質修改。

## 設計文件同步
同步目前規格、前端 README、測試關聯與 DESIGN；Astryx 僅參考 TableFilterableTable 及漸進揭露，既有 Tailwind 與共用元件優先，不導入 StyleX。

## 領域
前端、本機 API、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
前端 build 通過；npm test 24 項通過；catalog／case-plan 回歸 5 項通過。DS_REQUIRE_BROWSER=1 的 verify-tracking-ui 與 verify-catalog-ui 通過，驗證搜尋／類型／狀態篩選、品質展開、零結果重設、返回焦點、舊報告版本區分、axe、控制項預設／hover／active／focus 對比、32px 目標、390／1024／1280／1440／1920 溢位及 200% 縮放。實際查看記憶體畫面並調整長名稱與框線；沒有保存預覽截圖。只用合成資料，不操作產品或真實手機。Astryx build 與 TableFilterableTable 已讀取；未引入第二套 runtime。docs:plans:index、docs:check 與 git diff --check 通過。
