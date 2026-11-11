# 測試流程案例

catalog.json 是唯一案例文本來源，網站「測試流程」表格與功能地圖讀同一份檔案；不另維護逐案例 YAML／Markdown。先由本機 AI 使用 skills/plan-test-cases/SKILL.md 規劃，在本機專案對話補資料，再由 skills/implement-tests/SKILL.md 實作。網站只觀看表格，修改後重新讀取即可。

## 案例格式

schemaVersion 固定為 1；features 保存穩定 id、name、sources（可空，內容為相對前端路徑及 line）。cases 必填 id、featureId、title、kind（api／flow）、purpose、preconditions、data、expected、knowledgeIds、questions（text／answer）。識別碼英文字母開頭、英數／底線／連字號，最多 80 字。knowledgeIds 為知識索引 UUID，不是名稱。script 可指定 tests/ 下唯一 .spec.ts，腳本使用 archify-case annotation 對應案例 ID。

規劃新增 steps（最多 100 項 action／expected 字串，每欄最多 5000 字）、cleanup（最多 20000 字）、target（api／web／mobile／mixed）、選填 factor（positive／negative／boundary／security／error 表達測試因子）與選填 decisionTable（最多 100 列 `{ point, input, expected }`，用於集中表達等價類與邊界值校驗而不拆成重複長案例）。舊案例仍可讀，沒有步驟會顯示尚未填寫。kind 與 target 分別表達測試組合及平台，不將網頁預覽當 LINE App 實際呈現。建議案例標題採「【模組-類型】條件 + 行為 ➔ 結果」，公用前置導航收斂至 preconditions 以維持高可讀性。

格式範例（需依實際需求修改，問題未回答時需先補資料）：

```json
{"id":"TC-MEMBER-MESSAGE","featureId":"F-LINEOA","title":"點會員入口顯示訊息","kind":"flow","purpose":"驗證會員訊息呈現","preconditions":"已加入測試 LINE OA","data":"測試版選單與樣式基準 v1，不含憑證","target":"mobile","steps":[{"action":"點選單左上角會員入口","expected":"收到會員 Flex Message"}],"expected":"文字與已確認的樣式基準一致","cleanup":"不需清理","knowledgeIds":[],"questions":[{"text":"實際樣式基準存在哪？","answer":""}]}
```

無前置寫「無」，無清理寫「不需清理」。知識不足集中列具體問題，解答整合回步驟／預期，不以刪問題掩蓋缺口。

## 本機規劃與實作

網站測試流程只有表格、專案位置與重新讀取；不新增、編輯、確認或複製任務。規劃使用 skills/plan-test-cases/SKILL.md，寫測試使用 skills/implement-tests/SKILL.md。必要的問題集中在本機 AI 對話詢問，答案整合回 catalog 的步驟與預期。沒有網站核准流程。

`npm run cases:check -- TC-MEMBER-MESSAGE` 或 `node support/case-plan-cli.mjs TC-MEMBER-MESSAGE` 是可選的資料完整性檢查；exit 0 與 status ready 表示欄位及問題已補齊，不代表使用者核准或產品通過，也不要求 reviews 檔。實作前後重讀案例與知識，內容指紋若不同就核對新需求，不自動沿用舊假設。

舊 reviews、legacy/case-reviews 與確認端點保留相容，不自動刪除。`--review` 可選擇核對舊確認，但不是日常前置條件。CLI 不讀專案外的前端，來源仍由網站分析；框架約定不是 OS 沙箱。

knowledgeHash 是原有知識複查基準。執行報告仍追蹤實作與案例意圖，腳本存在、欄位完整、型別通過及略過不等於測試通過。新規劃欄位納入 intentHash，舊版無這些欄位的案例維持相容。

## 流程分類

API 與畫面案例共用 test-cases/catalog.json，每個新增或修改的案例必須明確填 target。網站以 target 分類，不用 kind 判斷是否有畫面：

| 測試內容 | kind | target | script |
| --- | --- | --- | --- |
| 單支 API | api | api | tests/api/*.spec.ts |
| 多支 API 串接 | flow | api | tests/flows/*.spec.ts |
| 網頁操作及 DOM 驗證 | flow | web | tests/ui/*.spec.ts |
| Android 原生／推播畫面 | flow | mobile | tests/mobile/*.spec.ts |
| 含畫面的跨平台流程 | flow | mixed | 依實際 runner 指定唯一 spec |

API 流程即使驗證供畫面使用的資料，也仍是 target: api；只有實際操作或斷言畫面才歸畫面流程。kind 表達單支或組合，不代表平台。未知平台先詢問並保留問題，不靠名稱猜測或為了分類建立假測試。舊案例缺 target 時網站僅依路徑或 kind: api 推定，否則列待分類；AI 修改舊案例時依證據補齊 target，保留 ID、人工答案、斷言與其他欄位。報告使用的 android 與 testType 是另一份契約，不寫入 catalog.target。
