# 案例撰寫與分類刪除驗證

日期：2026-10-27，Asia/Taipei。

## 變更

案例撰寫改成頂部名稱／版本／儲存、左側流程與右側主要程式碼區，手機上下排列；移除內嵌聊天，沿用右下角覆蓋式 ApiChat、專案對話切換、改名／刪除／復原與固定輸入框。authoring 模式走原 /llm 路由，顯示案例與腳本版本，不提供 API 執行授權。

AI 程式碼先顯示原／建議修改範圍，明確套用後才更新草稿；儲存仍單獨進行。原始碼在等待期間變動會讓建議過期並禁止套用。固定 API 流程保持唯讀與原執行入口，AI 只能解釋。舊 draft.messages 保留並以固定 thread id 匯入本機歷史，不重複建立（受既有對話數上限）。

分類垃圾桶使用 danger token、title 與 aria-label，沒有可見中文字。未分類不提供刪除。確認刪除只更新分類文件，案例移到未分類，不刪除腳本、版本或執行紀錄。

## 實際檢查

本次 API 證據接入（2026-11-02）：`ScriptWorkspace` 的一般 author 請求新增目前 projectId，由後端讀取 API 證據，不改畫面結構或樣式。`node scripts/verify-authoring-api-context.mjs` 以真實 Chrome 與實際 ScriptWorkspace／TestingProvider 操作兩個專案，確認 `/api/llm` 分別帶入正確 projectId、purpose=author；產生預覽不改原稿、不發送 API 或儲存腳本，套用只改草稿，儲存後才出現 v1，無 page errors。fixture 及模型回應均為隔離資料，不代表真實模型已產生有效登入／刪除腳本。

Control API 型別檢查、全套服務測試 235/235（無 skipped）及前端建置通過；Vite 仍有既有大型 chunk 提醒。新服務測試涵蓋專案隔離、最新未刪版本、案例與歷史版本分離、defaults 優先、token／秘密路徑不外洩、GraphQL 認證常數遮蔽、容量與空資料限制。完整 `verify-api-chat-ui.mjs` 在原有「模型連線」導覽幾何斷言失敗（y=396，預期 400），尚未到達案例撰寫段落，未移除該斷言。可見 UI 與樣式未變更，未重跑版面 gates；本機 fixture 的額外人工視覺檢視遭 Chrome 工具 file URL 政策拒絕，未保存截圖或繞過限制。未部署 VM、未執行真實模型或業務 API。

| 檢查 | 輸出 |
| --- | --- |
| apps/web 建置 | TypeScript／Vite 成功 |
| Control API 型別檢查 | tsc --noEmit 成功 |
| api-ui-chat.test.ts | tests 6、pass 6、fail 0、skipped 0 |
| verify-api-chat-ui.mjs | PASS：案例與腳本編輯、分類垃圾桶、原有 API／聊天／掃描互動回歸 |
| validate_tokens.py | 1/1 JSON、11 tokens 有效 |
| validate_contrast.py | 必需亮色配對通過；裝飾邊框 1.23:1 advisory |
| lint_hardcodes.py | apps/web/src 72/72，無硬編碼樣式 |
| check_no_emoji.py | 72 檔，無 emoji |
| lint_native_select.py | 45/45，無原生 select |
| verify_states.mjs | 完整 App 案例撰寫 63 element-states；案例庫 104，通過 default／hover／focus |
| axe_audit.mjs | 兩種輸入均 0 violations |
| verify_responsive.mjs | 案例撰寫 280/320/414px @1.25x root font 無水平溢出 |
| verify_keyboard.mjs | 案例撰寫 23 controls + 0 composites；案例庫 39 + 0，通過 |
| verify_target_size.mjs | 案例撰寫 28 targets；案例庫 60，414/1280px 尺寸或例外條件通過 |
| verify_mobile_first.mjs | 案例撰寫移除寬度 media/container 後，320px 基礎布局通過 |
| lint_intent.mjs | 案例撰寫退出 0，辨識 0 intent-bearing controls，不擴張中文語意判定結論 |
| slop_tells.mjs --strict | 兩種輸入無可測問題；不是美觀分數 |
| verify_overflow.mjs | 兩種輸入於 320/414/1280px 無非預期剪裁或控制重疊 |
| verify_reduced_motion.mjs | 案例撰寫 policy present、motion stopped、no content lost |
| git diff --check | 退出 0；僅 LF/CRLF 提示 |

瀏覽器 gates 使用 DS_REQUIRE_BROWSER=1 與實際 Chrome，輸入為 .local/api-chat-ui/authoring-gate.html 與 library-gate.html 的完整真實 App。聊天刻意覆蓋背景，另以互動測試斷言開啟前後程式碼區位置尺寸相同；不是以禁止聊天覆蓋作為目標。

1440px 桌面編輯、AI 修改預覽、案例庫垃圾桶，以及 320px 手機編輯／聊天已在記憶體檢視，沒有保存預覽截圖。初次手機編輯器高度造成浮動入口覆蓋的檢查失敗後，調整手機初始編輯高度、保留內容捲動，重跑通過。

## 互動回歸細節

- 垃圾桶按鈕沒有文字、有 SVG／可存取名稱；取消刪除保留分類，確認後只有其案例移至未分類，其他分類不變，沒有 DELETE scripts。
- 流程欄比程式碼欄窄；不存在舊「案例對話」區；開啟聊天不改程式碼區幾何位置。
- AI 回覆先出現原／建議內容，原流程不變，也不發出腳本儲存請求；套用後流程更新，但仍不儲存；按儲存才產生版本。
- 等待 AI 時手動修改，回覆到達後套用 disabled；放棄後保留手動內容。
- API 流程 textarea 保持 readonly、執行入口保留；模型回傳 source 也不產生覆寫預覽。參考資料標示腳本版本，既有流程對話仍可從歷史讀取。
- 既有 API 選取／填寫、來源範本與正反案例、工作進度、聊天歷史、命名掃描、覆蓋式聊天及分類拖移相關回歸仍通過。

未修改真實使用者資料、未發送實際模型／測試 API，沒有部署。互動使用隔離回應與真實 React 元件；不宣稱驗證了真實模型回答或腳本可執行性。

## 分類名稱原地編輯回歸（2026-10-27）

新增完整 App 互動斷言已通過：沒有可見「改名」按鈕；點名稱輸入、失焦儲存、Enter 僅寫入一次、Escape 不寫入、空白與重複名稱拒絕、模擬 503 時保留輸入值與原分類、重試成功。folder id 與 scriptFolders 原樣保留，未分類沒有編輯入口。原分類垃圾桶、案例撰寫與單點 API／聊天互動回歸仍通過。前端 TypeScript／Vite 建置成功，git diff --check 退出 0。1440px 與 320px 已在記憶體檢視，沒有保存截圖。

## 批次執行操作列跑版修正（2026-10-27）

問題為 viewport fixed 操作列沿用舊 lg:left-sidebar，而主內容已改成 12rem 導覽列，導致水平錯位；右側按鈕又與固定聊天入口重疊。改為內容區 sticky 列、保留 bottom-14 空間並移除舊固定左右偏移。桌面面板同高、lg 起並排、間距統一；手機上下排列；空案例移除多餘清單留白，保留新增入口。

前端 TypeScript／Vite 建置成功。完整 App 互動回歸 PASS，新增 1920／1280／1024／414／320px 的幾何斷言：操作列左右與面板外緣一致，桌面兩面板同高，操作列與聊天入口無交集；選擇兩案例、Alt+ArrowUp 排序、清空與未選時禁止執行仍正確。真正的空資料 fixture 確認 checkbox 數量 0，且有新增案例按鈕。1440px／320px 的有資料及空資料狀態均已在記憶體檢視，未保存截圖。

Render gates 使用 DS_REQUIRE_BROWSER=1／實際 Chrome。batch-gate.html：65 element-states；axe 0 violations；25 controls + 0 composites；32 targets @414/1280px；responsive 280/320/414px @1.25x、320px mobile-first、strict slop、overflow 320/414/1280px 與 reduced motion 均通過。lint_intent 退出 0、辨識數 0，不擴張中文語意結論。batch-empty-gate.html 另行量測 axe 0 violations、responsive 與 overflow 通過。來源檢查 72/72 無硬編碼、72 檔無 emoji、45/45 無原生 select；11 tokens JSON 有效及必需亮色對比通過，裝飾邊框 1.23:1 advisory。git diff --check 退出 0。

沒有改動批次執行服務、真實模型、Runner 或使用者資料；不把隔離 UI 回歸當成真實測試執行成功。

## Agent 設定高度調整（2026-10-27）

App 與 AgentEditor 建立桌面 flex 高度鏈，右側設定面板延伸至近底部，工作指示佔剩餘空間，保留底部按鈕與手機捲動。前端 TypeScript/Vite 建置成功；完整 App 互動回歸通過。新增幾何斷言：1440x1000 面板底部落在 980 至 1000px、工作指示高於 400px；1440x760 面板底部落在 740 至 760px，文字區隨高度縮小且儲存按鈕仍可見。測試實際編輯／儲存再切換 Agent，內容保留；320px 手機可捲到儲存按鈕且無水平溢出。1440px／320px 已在記憶體檢視，沒有保存截圖。

本輪 agents-gate.html 使用 DS_REQUIRE_BROWSER=1 與實際 Chrome：73 element-states、axe 0 violations、29 controls + 0 composites、40 targets；responsive 280/320/414px @1.25x、320px mobile-first、strict slop、overflow 320/414/1280px 與 reduced motion 通過。lint_intent 退出 0 但辨識 0 個中文意圖控制，不擴張其結論。11 tokens JSON 有效，必需亮色對比通過（裝飾邊框 1.23:1 advisory）；來源 72/72 無硬編碼、72 檔無 emoji、45/45 無原生 select。git diff --check 退出 0，僅 LF/CRLF 提示。介面使用隔離回應，沒有修改真實 Agent 資料或呼叫模型。

## 全域模型與 Agent 個別模型（2026-10-27）

前端 TypeScript/Vite 建置及 Control API TypeScript 檢查成功。Control API 完整測試 109 tests、109 pass、0 fail、0 skipped，涵蓋全域繼承、個別覆寫、不靜默退回、背景連線凍結、fingerprint、全域唯一與啟用限制，以及外層模型 metadata 解析。模型識別字測試僅驗證傳遞與儲存，不代表帳號可使用該模型。

完整 App 隔離互動回歸通過：首個連線預設全域、自訂 gpt-6.1-sol 識別字、Agent 繼承與個別 Gemini、缺連線短提示及禁止無效儲存、新增時預帶工具、返回保留未儲存名稱／工作指示、個別連線不改全域、移除冗長頁尾。既有聊天、案例撰寫、分類、批次與 Agent 高度回歸仍通過。模型連線桌面／390px 手機及 Agent 桌面已在記憶體檢視，沒有保存截圖。

真實 App 生成三個 HTML fixtures：models-gate、agents-routing-gate、model-edit-gate。使用 DS_REQUIRE_BROWSER=1、實際 Chrome 與未修改斷言的 kit gates。來源檢查 72/72 無硬編碼、72 檔無 emoji、45/45 無原生 select；11 token JSON 有效及必需亮色對比通過，裝飾邊框 1.23:1 advisory。lint_intent 辨識中文控制數為 0，不擴張其語意結論。

模型回應／連線健康使用隔離回應，未呼叫真實供應商、修改使用者資料或執行服務遷移。新增 reported_model 欄位需要正常服務遷移；前端、Control API 及橋接需同步更新。本輪沒有部署。

最終三份 fixture 各 10 項 gates 均退出 0：states、axe、responsive、keyboard、target size、mobile first、intent、strict slop、overflow、reduced motion。states 分別量測 67／79／85 element-states，axe 均為 0 violations；git diff --check 退出 0。
