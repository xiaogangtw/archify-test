# API 工作台驗證

日期：2026-10-27，Asia/Taipei。

## 本次變更

聊天改回覆蓋式，不縮窄或隱藏原工作區；環境選擇移入設定視窗；來源 Query／Variables 不再被舊 defaults 蓋回；掃描先預覽差異，命名儲存後才建版，放棄不寫入快照或版本。

沒有修改使用者資料庫或既有案例／歷史資料。畫面測試使用真實 App 與 React 元件、目前 Tailwind v3 建置輸出及隔離 API／模型回應。未讀取公司 Git 內容或發送真實測試 API。桌面與手機畫面只在記憶體中檢視，未儲存預覽截圖。

## 實際量測輸出

| 檢查 | 結果 |
| --- | --- |
| apps/web 建置 | TypeScript 與 Vite 成功 |
| Control API 型別檢查 | tsc --noEmit 成功 |
| 完整服務測試 | tests 101，pass 101，fail 0，skipped 0 |
| 新來源預設與掃描回歸 | 3 tests，3 pass；含環境認證參照隔離 |
| verify-api-chat-ui.mjs | PASS：覆蓋前後編輯器尺寸一致；環境只在設定；來源預設切換後保留；掃描預覽／放棄／命名儲存／Escape；原聊天與畫面操作互動仍通過 |
| validate_tokens.py | Tailwind 顏色投影 1/1 檔、11 tokens，有效 JSON |
| validate_contrast.py | 必需亮色配對皆通過；裝飾邊框 advisory 1.23:1 |
| lint_hardcodes.py apps/web/src | 72/72 檔，無硬編碼樣式 |
| check_no_emoji.py apps/web/src | 72 檔，無 emoji |
| lint_native_select.py apps/web/src | 45/45 檔，無原生 select |
| verify_states.mjs | 工作區／掃描視窗／環境視窗：159／9／38 element-states 通過 default、hover、focus |
| axe_audit.mjs | 三種檢查輸入各 0 violations |
| verify_responsive.mjs --scale=1.25 | 三種輸入於 280／320／414px 無水平溢出 |
| verify_keyboard.mjs | 工作區 43 controls + 2 composites；掃描 4 + 0；環境 11 + 0，皆通過 |
| verify_target_size.mjs | 工作區／掃描／環境：84／8／22 targets，414／1280px 尺寸或例外條件通過 |
| verify_mobile_first.mjs | 三種輸入移除寬度 media/container 後，320px 基礎布局通過 |
| lint_intent.mjs | 皆退出 0；中文控制辨識為 0 intent-bearing，不宣稱量測了破壞性文字語意 |
| slop_tells.mjs --strict | 皆退出 0；兩種對話框各有單一陰影 MED advisory，保留平坦頁面與浮動視窗的層次，不添加裝飾陰影 |
| verify_overflow.mjs | 修正捲動裁切誤報後，三種輸入於 320／414／1280px 無剪裁或非預期控制重疊 |
| verify_reduced_motion.mjs | 三種輸入皆 policy present、motion stopped、no content lost |

所有 render gates 使用 DS_REQUIRE_BROWSER=1 與實際 Chrome。工作區輸入是完整 App；掃描／環境輸入是實際 Modal 與內容元件的同步 React harness，保留互動。浮動聊天依使用者要求可以蓋住背景，這是刻意的層次；以完整 App 互動及尺寸不變斷言驗證，不把「背景沒有被蓋住」列為目標。

## 來源與掃描測試細節

- 以錯誤 defaults、正確 sourceRequest 模擬意外儲存；初次讀取、帶入前端 Query、切到另一接口再返回，均顯示來源值，沒有載回舊 scope 值。
- 手動接口保留自己的 defaults；讀取不更改原資料。已儲存案例繼續走明確的案例輸入路徑。
- 掃描預覽後沒有 INSERT source_snapshots／request_catalogs；放棄後不能再確認該預覽。
- 空白名稱、跨專案預覽、過期比較被拒絕。儲存同一預覽的重試不重複建版；已有版本不會被放棄入口刪除。
- 無差異但明確命名儲存時建立新版本，舊版本名稱不變。
- 完整 App 測試確認工具列沒有環境選單、設定內有目前環境；未命名時不能儲存，差異先顯示，放棄／Escape 不增版本，命名儲存後才切換新版。

## 溢出檢查修正

原檢查把 Health 列已捲出清單、被祖先 overflow 裁切的矩形部分，誤算成和下方接口設定／儲存按鈕重疊。瀏覽器實際可見邊界與按鈕命中測試證實沒有交疊。

verify_overflow 現在用 IntersectionObserver 的實際交集裁切控制矩形，不跳過重疊斷言；亦正確處理 fixed 元素逃出靜態祖先 overflow 的情況。verify-overflow-regression.mjs 實際輸出四個 PASS：scroll-clipped、real-overlap、fixed-escapes-scroll-clip、real-text-clipping。後三種故意錯誤輸入仍按預期被 gate 拒絕。

## 重現與範圍

先建置 apps/web，再執行 scripts/verify-api-chat-ui.mjs。使用已安裝的 esbuild、Playwright 與 Chrome；需要時以 NODE_PATH、CHROME_PATH 指定位置。檢查輸入在 .local/api-chat-ui，包含 gate.html、scan-gate.html、environment-gate.html。溢出回歸腳本使用相同瀏覽器轉接器，未改動其他 gates 的斷言。

未執行 kit accuracy_report，沒有美觀分數。這些結果不能證明真實模型回答或公司環境 API 的正確性。新增掃描流程需前端與 Control API 一起更新；未儲存預覽不是跨服務重啟的持久化草稿。

## 目前版本比較與參考浮層回歸

- 掃描送出目前 catalogId，回傳基準必須一致，名稱顯示目前命名。測試刻意保留較新版本與已刪除的最新流水號，仍比較選取的較舊版本。
- 已刪除基準、外專案基準、尚有版本卻傳空基準，均拒絕；儲存仍以同一基準計算，刪除基準後不寫入；所有版本已刪除才可首次掃描。
- 完整 App 互動檢查通過：參考資訊浮層不改變標頭尺寸、Escape 只關參考資訊並還原焦點、點外面關閉；桌面 1440px 與手機 320px 已在記憶體檢視。

參考浮層獨立使用實際 ApiChatContext 同步 harness（context-gate.html）：3 element-states；axe 0 violations；鍵盤 1 control + 0 composite；4 targets；280/320/414px 字級放大、320px 基礎布局、320/414/1280px 裁切重疊及 reduced motion 均通過。lint_intent 為 0 個語意辨識控制；slop strict 退出 0，單一浮層陰影有 MED advisory。

## 腳本案例庫分類與聊天整合

前端 TypeScript／Vite 建置成功。完整 App 互動測試新增並通過：未分類無刪除入口；取消刪除保留分類；刪除含案例分類只送分類文件更新，案例轉回未分類，其他分類不變且不發 DELETE scripts；新增空分類可刪；浮動聊天不改搜尋欄位置；不再有抽屜 Modal；建立案例工作使用既有 assistant 服務且 allowExecution=false；切頁重載可讀取對話歷史。原單點 API 互動回歸仍通過。

實際桌面 1440px／手機 320px 已檢視並點擊控制，未保存截圖。使用 library-gate.html 完整 App 與 library-chat-gate.html 實際 ApiChat 同步 harness 執行介面檢查；聊天覆蓋背景為需求本身，不把背景重疊當成錯誤。來源檢查 72/72 無硬編碼、72 檔無 emoji、45/45 無原生 select；11 顏色 token 有效、必需亮色對比皆通過，裝飾邊框保留 1.23:1 advisory。未更動真實資料庫，未發送真實模型／API 請求。

量測輸出：案例庫 95 element-states、axe 0 violations、35 controls + 0 composites、52 targets；聊天 harness 18 element-states、axe 0 violations、7 controls + 0 composites、14 targets。兩者 responsive 280/320/414px @1.25x、mobile-first 320px、overflow 320/414/1280px、reduced motion 均通過。lint_intent 皆辨識 0 個語意控制，不能據此宣稱所有中文破壞性文案已量測；strict slop 案例庫無可測問題，聊天有單一陰影 MED advisory，退出 0。初次發現改名按鈕 accessible name 不含可見文字，已修正重跑 axe 通過；面板統一 rounded-xl、控制 rounded-lg，移除案例列單側狀態色邊框後重跑通過。

## 來源快照比對與舊範本隔離

2026-10-27：Control API 型別檢查成功，apps/web TypeScript/Vite 建置成功；完整服務測試 tests 102、pass 102、fail 0、skipped 0。新增整段 Fastify 掃描／儲存回歸：舊目錄故意移除同名 Query 變體與呼叫追蹤、注入舊 Query/Headers/Variables/defaults，原來源不變且改 CRLF 時預覽零差異，命名儲存也零差異；舊目錄與原來源逐欄不變，手動接口與分類保留。真實 Query 與呼叫端內容修改仍被列出，缺失或外專案快照回傳 409 且不擷取新來源、不寫入版本。

完整 App 使用隔離回應確認成功／失敗案例分別載入 saved-good/saved-bad，回到接口範本則載入 source-scope，不帶舊 defaults、成功或失敗案例值；原聊天與掃描回歸全部通過。實際 App 已在記憶體檢視成功案例／來源範本兩種畫面，未保存截圖。來源檢查：72/72 無硬編碼，72 檔無 emoji，45/45 無原生 select；11 token JSON 有效與必需亮色對比通過，裝飾邊框 1.23:1 advisory。

另外以本機大型前端範例做 CRLF／LF 統一換行前後掃描唯讀驗證，差異為 0。這不是公司 VM 的已部署驗證；沒有改動真實資料庫、舊版本或案例。前端／Control API 更新後需放棄舊的掃描預覽並重新掃描；過往保存的 changes 歷史不會被偷偷改寫。

本輪 App render gates（DS_REQUIRE_BROWSER=1、實際 Chrome）：165 element-states 通過；axe 0 violations；responsive 280/320/414px @1.25x 無水平溢出；鍵盤 45 controls + 2 composites；88 targets @414/1280px 尺寸或例外條件通過；320px mobile-first 通過；strict slop 無可測問題；overflow 320/414/1280px 無非預期剪裁或重疊；reduced motion policy present、motion stopped、no content lost。lint_intent 退出 0 但中文意圖控制辨識數 0，不擴張其結論。git diff --check 退出 0（僅工作樹 LF/CRLF 提示）。
