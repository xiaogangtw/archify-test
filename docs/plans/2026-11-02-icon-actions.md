# 刪除圖示與無框圖示按鈕

## 範圍
刪除入口統一垃圾桶圖示，共用 Button 的單圖示按鈕移除常態外框與底色；確認操作保留明確文字。保留 destructive、焦點、停用、載入與確認行為。查證草稿標籤，不改執行狀態。接續統一分類標題與案例列的右側留白，對齊垃圾桶中心線。

## 影響檔案
- apps/web/src/components/ui/controls.tsx
- apps/web/src 下刪除入口
- apps/web/README.md

## 資料庫影響
無。

## 風險
共用圖示樣式影響多畫面，須保留點擊範圍與可存取名稱；不移除鍵盤焦點提示。

## 設計文件同步
前端 README 同步圖示規則；無路由、API 或資料契約變更，整合規格不適用。

## 領域
前端

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
- 前端建置通過；輸出仍有既有大型 chunk 提示。最終尺寸修正後重跑建置亦通過。
- check_no_emoji.py apps/web/src：105 檔通過。lint_native_select.py 初次 cp950 讀取失敗，改以 Python -X utf8 執行後 63 檔通過。
- 實際 Chrome 查看自動化案例庫，垃圾桶無常態底色／外框；開啟刪除確認、取消，焦點回原按鈕，未刪資料。DOM 量測 border 0px、44×44 點擊範圍。
- DS_REQUIRE_BROWSER=1 既有 verify-unified-flow-ui.mjs：先缺 playwright／瀏覽器，改用 bundled NODE_PATH 與已安裝 Chrome 後，仍於等待 AI 建議回覆逾時，不能算通過。
- 全套 token、contrast、hardcode、state、axe、responsive、keyboard、mobile-first、intent、overflow、reduced-motion gates 尚未完成；不標記可供審查。共用樣式變更的其他頁面尚未逐一視覺驗證。
- 草稿標籤來自 ScriptLibrary 的 inlineRuns 缺席判定；保持狀態行為，已在前端 README 說明限制。


接續對齊修正：分類標題改為 pl-4 pr-3，案例列改 border-y px-3。真實 Chrome 自動化案例庫七個分類／案例刪除按鈕中心線皆量測為 x=1397，已實際查看畫面；沒有執行刪除。全套 gates 的既有未完成範圍仍保留。
