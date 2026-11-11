# Flow Case 結構預覽驗證

日期：2026-10-30。修正對象為 apps/web 的唯讀流程預覽，沒有改動案例來源或執行手機操作。

## 原因及結果

舊 appiumLabels 以正規表達式讀取所有 name，將 routines 定義、群組及子步驟都列成同層執行順序。新 AppiumFlowPreview 讀取靜態 AST，將 before、steps、after 分開；只在 call 位置展開共用定義，未引用的定義另行收合。標題計算主流程頂層數量，條件與迴圈保留巢狀結構。

重現範例案例的結構：6 個未被呼叫的接收端定義步驟、8 個主流程頂層步驟，包含兩個 repeat 及一個 optional。畫面顯示 8 個主流程步驟，第一個為確認 DemoOfficial 官方聊天室，接收端定義不混入主流程。

## 驗證輸出

- apps/web `npm run build`：成功。Vite 仍提示大型 chunk；沒有將其當作效能驗收。
- `node scripts/verify-flow-preview-ui.mjs`：PASS。測試主流程順序、未呼叫定義隔離、群組子步驟、條件標示、實際 call 的展開位置、before/after、循環保護、非法來源拒絕、Enter/Space 操作及窄版顯示。沒有裝置或 AI 呼叫。
- `lint_hardcodes.py apps/web/src`：99/99 檔案，沒有硬編碼值。
- `check_no_emoji.py apps/web/src`：99 個檔案，沒有 emoji。
- `lint_native_select.py apps/web/src`：60/60 檔案，沒有原生 select。
- `verify_states`：3 個 element-state，預設／hover／focus 對比通過。此 gate 主要量測收合按鈕，不代表所有巢狀內容均由此 gate 量測。
- `axe_audit`：0 violations。
- `verify_responsive`：280/320/414px，1.25 倍根字級，沒有橫向溢出。
- `verify_keyboard`：5 個控制項，0 個 composite widgets，可達及 Enter/Space 檢查通過。
- `verify_target_size`：414/1280px 共 10 個 targets，符合最小尺寸或例外條件。
- `verify_mobile_first`：320px、1.25 倍根字級，移除 media/container 後通過。
- `lint_intent`：0 個 intent-bearing controls，沒有動作色彩違規。
- `slop_tells --strict`：沒有 measurable slop tells；此為啟發式檢查，不是美感證明。
- `verify_overflow`：320/414/1280px，沒有靜默裁切或控制項重疊。
- `verify_reduced_motion`：通過。
- 目視：以記憶體截圖查看主流程預覽，沒有保存截圖檔。

render gates 指向 `.local/flow-preview-ui/index.html`，使用 `DS_REQUIRE_BROWSER=1` 與本機已安裝 Chrome。固定 light theme，沒有新增 token JSON 或 CSS variable 主題層，也沒有進行暗色驗證。

這些檢查不代表使用者腳本已具備完整雙機綁定或業務驗證成功。原案例的 receiverIntegrationReady 仍是 false、沒有將其設為 true 的步驟，且沒有 actors 宣告；最後的必要斷言仍會阻擋通過。
