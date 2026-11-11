# 文件重複略過與相似內容直接更新

## 範圍
完全相同的有效知識／已處理來源略過模型；唯一高度相似文字以本次上傳為最新版本直接更新，沿用分類、功能及知識 ID 並封存可還原。其他來源保留既有 AI 分析，不變更功能地圖、案例內容或測試腳本。

## 影響檔案
- services/local-workspace/knowledge-fast-update.mjs、knowledge-analysis.mjs、knowledge.mjs、workspace.mjs 與回歸測試
- docs/website-ai-analysis.md、ARCHIFY-CURRENT-SPEC.md、README.md、apps/web/README.md、相關決策與計畫索引
- scripts/verify-website-ai-ui.mjs（既有正式建置的互動回歸）

## 資料庫影響
無；knowledge/index.json 增加可失效的來源處理紀錄，相容舊資料。

## 風險
文字相似不是語意等價，本次依使用者授權將唯一高度相似文件以上傳版取代。多候選、圖片、超過有效知識大小或不夠相似仍交 AI。保留備份、取消、版本檢查與原始來源。

## 設計文件同步
同步去重、相似度條件、最新版本定義、快取失效與限制；無 UI 版面變更。

## 領域
本機服務、AI 整合

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- npm run test:workspace：48 項通過。新增唯一相似直接更新、案例／分類／功能保留、備份還原、原始來源重複、人工改檔失效、重啟／舊版回傳、混合批次及失敗不提前寫入回歸。
- 最後全重複提前返回優化後，node --test services/local-workspace/knowledge-fast-update.test.mjs services/local-workspace/knowledge-upload.test.mjs：10 項通過；補驗大型文字與圖片重傳不再呼叫模型，索引不變。
- npm test：13 項框架測試通過。
- DS_REQUIRE_BROWSER=1 node scripts/verify-website-ai-ui.mjs：使用既有正式建置、真瀏覽器及真 middleware，驗證相似文字更新與重複略過均零模型呼叫，原 AI 整理／衝突／還原及 axe／對比／溢位通過。不改 UI 程式或樣式，不重建相同前端，也未保存截圖。模型語意回歸用注入結果，不是實際業務驗收。
- 新增瀏覽器回歸首次誤以為上傳後面板會收起，等待「新增知識」逾時；依既有展開狀態修正測試後通過，未修改產品行為。
- npm run docs:plans:index、npm run docs:check 與 git diff --check 於結束前通過。
- 相似門檻為本機文字係數，不是模型品質分數；未量測使用者專案加速比例，未上傳使用者真實資料或執行產品請求。直接取代限制 128 KB，舊原始來源無有效處理紀錄時可能需先走一次 AI。
