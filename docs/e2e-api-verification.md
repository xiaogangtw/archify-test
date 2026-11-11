# E2E API 流程本機驗證（2026-10-30）

驗證對象是 apps/web 的 ApiFlowControls、AppiumFlowPreview、ScriptWorkspace，以及 Control API 和 Android 流程執行器。UI 使用實際 React 元件與目前建置的 Tailwind CSS，API/手機以測試替身提供，不代表真實環境驗收。

| 檢查 | 實際結果 |
|---|---|
| apps/web build | 成功；仍有既有較大分塊警告 |
| Control API 型別檢查 | tsc --noEmit 成功 |
| Control API 回歸 | tests 178、pass 178、fail 0、skipped 0 |
| Android 回歸 | tests 79、pass 79、fail 0、skipped 0 |
| 新增 API 串接測試 | 6 項，包含實際請求組裝、token 隔離、數字變數、斷言、清理、版本快照、輪詢及工作階段橋接 |
| React 互動檢查 | PASS：勾選、插入中間、參數修改、驗證失敗保留原稿、移除、Escape、320/390/1280 寬度 |
| validate_tokens | Parsed 1/1 token files, 29 tokens defined；all token files valid JSON |
| validate_contrast | all required contrast pairs pass；固定淺色，無深色檢查；裝飾邊框有 advisory |
| lint_hardcodes | 三個修改的 TSX 分別輸出 no hardcoded values found |
| check_no_emoji | 三個修改的 TSX 分別輸出 no emoji |
| lint_native_select | 三個修改的 TSX 分別輸出 no native select |
| verify_states | 32 element-state(s)，default/hover/focus 均通過 |
| axe_audit | 0 violations |
| verify_responsive | 280/320/414px、1.25 倍字體，無水平溢出 |
| verify_keyboard | 10 control(s)，可達且 Enter/Space 回應 |
| verify_target_size | 24 targets，皆符合檢查門檻或適用例外 |
| verify_mobile_first | 320px 移除寬度媒體條件，base layer 通過 |
| lint_intent | OK；此新增選取狀態未量測到 intent-bearing controls，不能視為已驗證所有移除按鈕語意 |
| slop_tells --strict | exit 0；一項 MED：只有一種陰影。沿用專案克制表面與共用 Modal，未為此新增陰影 |
| verify_overflow | 320/414/1280px 無靜默截字或控制項重疊 |
| verify_reduced_motion | policy present，reduce 下停止動態且內容保留 |
| git diff --check | 無空白錯誤 |

瀏覽器檢查設定 DS_REQUIRE_BROWSER=1，透過本機 Chrome 實際執行；未保存截圖。已在記憶體檢視編輯畫面。客觀檢查不代表美感評分，也不代表每個可能案例分支皆驗證。未使用 kit 的 accuracy_report 作為本應用分數。

尚未完成：VM/worker 部署、真實 API 憑證及目標連線、雙機與後端的端到端驗收。第一版參數為 JSON 編輯，未提供變數選擇器及完整回應內容比對。
