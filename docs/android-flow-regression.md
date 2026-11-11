# Android Flow Case 回歸測試

直接在案例撰寫對話描述預期狀態、不同畫面的處理方式與檢查結果。助手會產生靜態流程定義，儲存後才可選取執行。草稿與格式驗證不表示手機已通過測試。

可以這樣描述需求：

> 出現公告就關閉，沒有公告就繼續。等會員頁可操作後，產生唯一測試訊息並傳送。接收手機最多等待15秒，確認收到相同內容。任何檢查失敗要停止這個案例，最後嘗試返回首頁。

需要實際元件 ID 或當下 XML 才能產生可靠定位器。預期中的畫面差異使用分支；金額錯誤、訊息沒收到等結果差異仍應失敗。

## 支援能力

| 能力 | 流程欄位或動作 |
| --- | --- |
| 狀態等待 | `waitFor`，條件為可見、消失、可操作、選取、文字、數量、前景或變數比較 |
| 分支與可選操作 | `if` 的 `then/else`、`optional` 的 `condition/steps` |
| 變數 | `variables`、`set`、`generate`、`readText`；字串使用 `{{名稱}}` |
| 檢查 | `assert`、`assertVisible`、`assertAbsent`、`assertText`、`assertCount`、`assertEnabled`、`assertSelected`、`assertChecked`、`assertAppForeground` |
| 滑動與尋找 | `swipe`、`scrollUntilVisible` |
| 有限迴圈 | `repeat`、`while`；最多10次，while超限仍成立會失敗 |
| 本案例共用步驟 | `routines` 搭配 `call` |
| 跨案例共用 | `callFlow`，必須指定真實已儲存的 `scriptId/scriptVersion` |
| 前置與清理 | 頂層 `before/after`；after在測試失敗後也會嘗試執行 |
| 輸入與鍵盤 | `type` 可選 `clear:true`、`hideKeyboard` |

一般等待預設10秒；`timeoutMs` 可設定0至30000。if/optional/while預設立即判斷；加timeoutMs可等條件成立。可選步驟只允許條件不成立時略過，不會忽略操作失敗。click/type會等待可見且可操作，送出一次，不會因回應不明就重複操作。

流程最多6層巢狀；主測試最多300次步驟執行，清理另有30步額度；整體仍受工作階段期限限制。清理是有限度的嘗試，斷線、逾時或清理失敗都不能宣稱已復原。

## 分支範例

下面僅示範資料格式與分支，不代表已驗證登入或業務資料。畫面操作的定位器需要依實際App填入。

```ts
export const flow = {
  appPackage: "com.android.settings",
  variables: { needBack: false },
  routines: {
    checkForeground: [
      { name: "確認 App 位於前景", action: "assertAppForeground" }
    ]
  },
  steps: [
    {
      name: "依前置狀態返回",
      action: "if",
      condition: { kind: "variable", variable: "needBack", equals: true },
      then: [{ name: "返回", action: "back" }]
    },
    { name: "共用檢查", action: "call", routine: "checkForeground" }
  ]
} as const;
```

## 共用案例與資料

`callFlow`引用已儲存版本，執行建立時凍結所有引用來源；之後修改原案例不會改變這筆執行。引用的App套件必須一致。單機共用案例用於雙機時，呼叫步驟須指定或繼承actor；雙機共用案例需由雙機案例呼叫。

共用案例的before/after也會執行。父案例同名變數覆蓋子案例預設值，執行中變數共用，便於把回讀資料傳回父流程。變數只存在本次案例執行，沒有跨批次共用，也不能把另一個批次案例留下的資料視為可靠前置條件。內建 `{{runId}}`、`{{timestamp}}` 唯讀；`generate`提供唯一值。

每個實際主路徑必須完成斷言，雙機兩個角色都需要斷言。before/after斷言不計入主測試。共用案例自身的實際主路徑同樣需要斷言。純操作或跳過所有斷言不會通過。

## 批次與結果

案例可依執行順序上下調整。預設遇失敗就停止；勾選「失敗後繼續其他案例」可繼續獨立案例，批次摘要仍會保留失敗。沒有自動推斷案例依賴關係，不相依的案例才適合繼續執行。

執行紀錄會顯示前置、實際分支、迴圈次數、略過原因、清理結果與步驟耗時。輸入內容、擷取文字及變數值不寫入追蹤紀錄，也不自動保存手機截圖。來源快照仍包含使用者寫進草稿的字面值，不要在草稿填入密碼或token。

API資料驗證維持暫緩。上述檢查依手機UI與明確條件判斷，不代表後端資料已被API核對。

## 更新與驗收

前端、Control API與Windows Android worker需同步更新。建置、協定與模擬測試不等於實際LINE/手機驗收；原有案例不會被自動重寫，需在對話要求補上需要的分支與驗證。
