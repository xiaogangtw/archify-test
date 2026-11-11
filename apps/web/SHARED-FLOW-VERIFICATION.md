# 指定位置插入與覆蓋驗證（2026-10-30）

本次更新「套用共用流程」：預設插入，可選前置、主流程、清理的步驟間隙與條件／迴圈內部位置；覆蓋採固定版本引用，改用共用流程的 App 與單機／雙機設定，取消不改原稿。

## 執行結果

- apps/web build：TypeScript 與 Vite 成功，仍有大型 chunk 提示。
- control-api check：成功。
- control-api 全部回歸：172 tests、172 pass、0 fail。
- flow-dependencies 與 flow-engine：27 tests、27 pass、0 fail。包含跨 App 正常返回、切換丟錯、切換沒有生效、主流程斷言失敗、清理失敗、返回失敗、只操作指定角色、巢狀 App 逐層返回；命令為模擬，沒有操作真實手機。
- verify-shared-flow-ui：PASS。驗證中間位置插入、分支內插入、保留原區段與變數、跨 App 提示、覆蓋固定版本引用、取消保留原稿、覆蓋採用子流程角色模式，以及既有抽取、失敗保存、單機改雙機補選角色與鍵盤操作。
- lint_hardcodes：Scanned 99 of 99 candidate file(s). OK: no hardcoded values found.
- check_no_emoji：Scanned 99 file(s). OK: no emoji in UI output or taste files.
- lint_native_select：Scanned 60 of 60 file(s). OK: no native <select> in generated UI.
- verify_states：Checked 21 element-state(s)，default/hover/focus 對比 OK。
- axe_audit：0 violations。
- verify_responsive：280/320/414px、1.25 倍根字級，無橫向溢出。
- verify_keyboard：5 controls、0 composite widgets，OK。下拉展開後的選項與鍵盤選擇另由 UI 測試操作。
- verify_target_size：14 targets @414/1280px，OK。
- verify_mobile_first、verify_reduced_motion：OK。
- verify_overflow：320/414/1280px 無裁切文字與重疊控制項。
- lint_intent：0 intent-bearing controls。未選流程時插入按鈕停用，此量測不代表覆蓋狀態的意圖測試；覆蓋按鈕依程式使用 danger，操作由 UI 測試驗證。
- slop_tells --strict：退出成功，但印出 MED 單一 shadow 層級建議；依專案克制表面規則保留既有 Modal，不新增裝飾陰影。不是美感評分。
- 以記憶體截圖查看位置選單、390px 下的插入摘要與跨 App 提示；沒有保存預覽截圖。

## 重現與限制

先執行 verify-shared-flow-ui.mjs 生成實際 React harness，再以 --import ./.local/shared-flow-ui/gate-loader.mjs 執行渲染 gates，目標為 .local/shared-flow-ui/apply.html；設定 DS_REQUIRE_BROWSER=1。產生的 loader 只等待非同步對話框與欄位就緒，未排除控制項或改寫 gate 的量測規則。未等待就緒的通用 keyboard gate 曾量到背景兩個按鈕，再被後來開啟的 dialog 阻擋而失敗；就緒後重跑通過。

專案 Tailwind v3 config 是唯一主題來源，未修改主題或 CSS，JSON token 與 CSS-variable-reference gates 不適用；固定 light theme 不測 dark；未執行 upstream kit 的 accuracy_report。前述結果不代表真實裝置業務測試通過。跨 App 執行需要更新 control-api 與 Android worker，本次未部署。

---

# 共用流程角色綁定驗證（2026-10-30）

本次範圍為 apps/web 的套用與既有引用角色設定，以及 control-api 的儲存驗證。尚未部署，也沒有操作真實手機。

- apps/web build：TypeScript 與 Vite 成功；仍有既有大型 chunk 提示。
- control-api check：TypeScript 成功。
- control-api 完整回歸：172 tests、172 pass、0 fail。首次在受限環境遭 localhost EACCES；允許本機測試連線後重跑成功。
- flow-dependencies 與 flow-engine：19 tests、19 pass、0 fail，包含單機改雙機未綁角色拒絕、補選後版本保留、同一版本分別綁定兩台手機、巢狀共用流程 before/main/after 實際命令路由。
- verify-shared-flow-ui：PASS。模擬 API，包含單機自動套用、雙機角色必填、既有引用補選、鍵盤選擇、固定版本、套用順序、錯誤保留草稿、非法 actors 格式與靜態解析防護。
- lint_hardcodes：Scanned 99 of 99 candidate file(s). OK: no hardcoded values found.
- check_no_emoji：Scanned 99 file(s). OK: no emoji in UI output or taste files.
- lint_native_select：Scanned 60 of 60 file(s). OK: no native <select> in generated UI.
- 使用 roles.html 的實際 React 元件 harness：verify_states 印出 Checked 11 element-state(s)，default/hover/focus 對比 OK；axe 印出 0 violations。
- verify_responsive：280/320/414px、1.25 倍根字級，無橫向溢出。
- verify_keyboard：2 controls、0 composite widgets 通過；動態角色下拉的選擇另外由 UI 測試實際操作驗證，不能將通用 gate 的計數視為所有元件覆蓋。
- verify_target_size：4 targets @414/1280px 通過。
- verify_mobile_first、verify_reduced_motion：OK。
- verify_overflow：320/414/1280px 無裁切文字與重疊控制項。
- lint_intent：0 intent-bearing controls，本次角色欄位沒有主動或破壞性操作意圖可量測。
- slop_tells --strict：no measurable slop tells；啟發式結果不代表美感評分。
- 以記憶體截圖檢視待指定角色列與雙機套用視窗，未保存預覽截圖。

專案以 Tailwind v3 config 作為唯一主題來源，未修改配色、字型或 CSS；JSON token gates 與 CSS-variable-reference gate 不適用。固定 light theme 不另測 dark。未執行 upstream accuracy_report，依專案規則它是 kit 自測，不是應用程式評分。以上不代表真實手機業務測試通過。

---

# 共用前置流程驗證

日期：2026-10-29。範圍：apps/web 的 Android Flow Case 撰寫入口，沒有部署 VM，也沒有操作 LINE 官方聊天室。

## 已執行

- `npm run build`（apps/web）：成功。Vite 提示大型 chunk；TypeScript AST 解析器在首次使用共用操作時延遲載入，未納入初始載入包。
- `node scripts/verify-shared-flow-ui.mjs`：PASS。模擬 API；驗證抽取指定前綴、儲存失敗不改原稿、真實後端 parseFlow 接受產生來源、固定版本前置引用、重複引用拒絕、手機角色與套件不相容拒絕、拒絕執行式來源、下拉鍵盤操作、視窗焦點圈選、Escape 關閉及窄版無橫向溢出。
- `node --test services/android/flow-dependencies.test.mjs services/android/flow-engine.test.mjs`：17 tests，17 pass，0 fail。包含固定版本快照、循環引用拒絕、缺少版本拒絕、實際斷言要求與前置斷言不能當主測試通過。
- hardcodes：98/98 個候選檔案掃描，沒有硬編碼值。
- emoji：98 個檔案掃描，沒有 emoji。
- native select：59/59 個檔案掃描，沒有原生 select。
- render state gate：抽取視窗 18 個 element-state、套用視窗 15 個 element-state，預設／hover／focus 對比檢查通過。
- axe：抽取及套用視窗各 0 violations。
- responsive：1.25 倍根字級，280/320/414 寬度檢查通過。
- mobile-first 及 reduced-motion：檢查通過。
- 目視檢查：以記憶體截圖查看抽取視窗，沒有保存預覽截圖。

## 檢查限制及未通過項目

- 舊 `verify-unified-flow-ui.mjs` 在等待 AI 模擬回覆時逾時。其手機編輯頁預設會呼叫 Android Agent，但 fixture 仍只模擬 /llm 回覆；暫時停用實際手機探索後，測試繼續到批次執行等待再次逾時。未將這份舊測試算為通過，也沒有修改其原始檔。
- 通用 keyboard/target-size gate 在動態視窗 harness 曾印出 0 個控制項／target，不能當作完整量測；以新增瀏覽器測試實際驗證下拉選擇、焦點圈選及 Escape。
- overflow gate 在開啟原生 modal 時將背景按鈕與前景欄位的投影重疊列為 FAIL；背景由原生 dialog 的 top layer 阻擋操作。實際窄版操作及對話框內版面已檢查，但這個 gate 沒有全綠。
- slop gate 對視窗單一陰影層級提出 MED 建議；依專案克制表面規則，沿用既有 Modal，沒有新增裝飾陰影。
- token JSON 及 CSS-variable-reference gate 不適用這次變更：專案指定 Tailwind v3 config 為唯一 token 來源，不新增 JSON 主題或 CSS variable 樣式層。對比由真實渲染 gate 量測；固定 light theme 不測暗色。

以上不代表整套通用 gate 全綠，也不代表實機業務測試通過。

## 使用

1. 在既有 Flow Case 的「測試流程」選「抽成共用流程」，命名並選擇開頭步驟範圍。需包含結果斷言，且保留至少一個原案例專屬步驟。
2. 選「建立並替換步驟」，再使用原案例頂部「儲存案例」。
3. 在其他 Flow Case 選「套用共用前置流程」，選擇已儲存流程與必要角色，再儲存案例。
4. 共用流程更新不會自動改變既有引用版本；可於 TypeScript 編輯區調整引用。執行時沿用固定版本依賴與來源快照。
