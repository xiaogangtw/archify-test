# 測試流程案例

catalog.json 是唯一案例文本來源，網站「測試流程」表格與功能地圖讀同一份檔案；不另維護逐案例 YAML／Markdown。先由本機 AI 使用 skills/plan-test-cases/SKILL.md 規劃，在本機專案對話補資料，再由 skills/implement-tests/SKILL.md 實作。網站只觀看表格，修改後重新讀取即可。

## 案例格式

互動引用的檔案須同時列於所屬 feature.sources，沿用來源版本檢查。缺少基準或來源已變動時不套用逐步結果；外部工具不可捏造來源 hash。

需要序列圖的步驟可加 `interaction: { from: "前端", to: "會員 API", source: { path: "src/member.ts", line: 42 } }`，from／to 各最多 80 字，source 為安全前端相對程式檔案與正整數行號。每列只描述有證據的一個互動，不猜測後端內部流程；回應另列步驟，無證據不填。網站於功能地圖的案例詳情按需展開序列圖；舊案例保持相容。測試以唯一且與 action 完全相同的 test.step 名稱對應，只有版本相符與唯一對應才顯示逐步結果；未對應不代表未執行，不保存 token 值或敏感資料。

schemaVersion 固定為 1；features 保存穩定 id、name、sources（可空，內容為相對前端路徑及 line）。cases 必填 id、featureId、title、kind（api／flow）、purpose、preconditions、data、expected、knowledgeIds、questions（text／answer）。識別碼英文字母開頭、英數／底線／連字號，最多 80 字。knowledgeIds 為知識索引 UUID，不是名稱。script 可指定 tests/ 下唯一 .spec.ts，腳本使用 archify-case annotation 對應案例 ID。

規劃支援 `steps`（最多 100 項 `{ action, data?, expected }`，每欄精簡填寫；純輸入步驟的 `expected` 可留空 `""`，驗證點與總體 `expected` 再寫明確結果）、`cleanup`（建議一句交代如「不需清理」／「刪除本輪帳號」）、`target`（`api`／`web`／`mobile`／`mixed`）、選填 `factor`（`positive`／`negative`／`boundary`／`security`／`error`）與選填 `decisionTable`（最多 100 列 `{ point, input, expected }`）。案例呈現以表格矩陣（「案例／功能｜測試步驟｜使用資料｜預期結果」）為主：各欄位應簡短可掃描，來源檔案位置保留在 `feature.sources` 或 `knowledge/`，不把長篇規格、程式路徑列表或日期說明塞進 `preconditions`、`cleanup` 或每個步驟中。

格式範例（`steps` 各列可直接對應「步驟｜使用資料｜預期結果」表格）：

```json
{"id":"TC-REG-POSITIVE","featureId":"F-AUTH","title":"【註冊-正向】輸入合法資料註冊 ➔ 成功進入首頁","kind":"flow","factor":"positive","target":"web","purpose":"驗證新用戶註冊成功","preconditions":"已開啟註冊頁","data":"其餘填合法預設值","steps":[{"action":"輸入用戶名與信箱","data":"test_0001 / test_0001@example.test","expected":""},{"action":"設定密碼並勾選條款","data":"123456 / 勾選同意","expected":""},{"action":"點擊註冊按鈕","data":"","expected":"註冊成功，跳轉至登入成功頁"}],"expected":"帳號建立完成並進入登入成功頁","cleanup":"刪除本輪測試帳號","knowledgeIds":[],"questions":[]}
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
