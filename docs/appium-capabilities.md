# Archify Appium 指令與 AI 知識

文件版本：1.0

最後更新：2026-11-03

## 修訂紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| 1.0 | 2026-11-03 | 補充錯誤證據及遮蔽限制，擴充 worker trace 訊息上限與報告事件 metadata；未改路由、守衛、導向、GraphQL payload 或 DB schema。 |

Android worker 協定 3 新增以下動作。Control API、Android worker 需要一起更新並重新啟動；既有已執行的歷史不會改寫。這是 Appium 指令傳送與知識查詢能力，不代表每個命令都已在手機驗證。現有驅動為 UiAutomator2，不能宣稱 iOS、其他驅動或外掛已安裝。

| 用途 | android_action | Flow Case |
| --- | --- | --- |
| 鍵盤搜尋、完成、送出 | `kind: "editorAction"` | `action: "editorAction"` |
| Appium mobile 擴充 | `kind: "mobileCommand"` | `action: "mobileCommand"` |
| 工作階段內 WebDriver endpoint | `kind: "webdriverCommand"` | `action: "webdriverCommand"` |
| 查安裝版命令與參數 | `kind: "appiumHelp", query: "performEditorAction"` | 由 AI 查詢，不產生裝置操作步驟 |

## 鍵盤搜尋

先用既有 `type` 填入使用者指定的 ID、保留輸入框焦點，再執行：

```ts
{ name: "搜尋 ID", action: "editorAction", editorAction: "search" }
```

這對應 `mobile: performEditorAction` 的 `{ action: "search" }`，不需要鍵盤按鈕的 XML 節點或座標，不是輸入換行。其他動作為 `go`、`send`、`next`、`done`、`previous`、`none`、`unspecified`。執行後仍須用實際搜尋結果的定位器寫結果斷言。只有命令送出成功，不能回報搜尋成功。

## 可擴充指令

```ts
{ name: "實體 Enter", action: "mobileCommand", command: "pressKey", params: { keycode: 66 } }
{ name: "讀取方向", action: "webdriverCommand", method: "GET", path: "/orientation", variable: "orientation" }
{ name: "切換橫向", action: "webdriverCommand", method: "POST", path: "/orientation", params: { orientation: "LANDSCAPE" } }
{ name: "釋放輸入", action: "webdriverCommand", method: "DELETE", path: "/actions" }
```

mobile 的 `command` 不加 `mobile:` 前綴，`params` 為 JSON 物件。它不使用固定命令白名單，安裝版驅動新增 mobile 命令後可沿用同一通道。WebDriver path 為目前 actor 的 session 內路徑，不能指定其他 session、URL、session 生命週期或 execute 程式碼。GET/DELETE 不帶 params，POST 可帶 JSON。

Flow Case 可設 `variable` 保存回傳的純量或 JSON 字串，上限 4000 字；`resultPath` 為最多十層欄位名稱的陣列，指定從回傳物件取值。缺少欄位或值過大會失敗，不能默默截斷成成功。巢狀 params 字串與 path 可引用 `{{變數}}`。例如用 POST `/element`、params `{using:"id",value:"實際定位器"}`、resultPath `["element-6066-11e4-a52e-4f735466cecf"]` 保存當次 element ID，再用 `/element/{{element}}/click`。不可保存探索工作階段的 element ID 供下一次執行使用。

AI 操作工具預設不回傳命令原始資料；必要時明確設 `returnValue:true`，可搭配 resultPath。資料只進本輪模型回饋，不存入工具事件。不要藉此讀取密碼、驗證碼或憑證；一般操作仍優先使用有定位器驗證與遮蔽處理的既有工具。

## AI 知識與實際支援

操作 Agent 與 Flow 撰寫助手共用 `services/android/appium-knowledge.mjs` 的知識，包括 IME 與 Enter 的差異、常見命令、參數、回傳值及結果驗證規則。`appiumHelp` 在 worker 讀取安裝版 UiAutomator2 的 inherited execute-method-map 與 method-map，不操作手機、不變更草稿。空 query 回傳 mobile 名稱索引，關鍵字查詢最多回傳二十項及命中總數，含 required/optional 參數。命令表不是實測結果，也不保證裝置或伺服器設定允許執行。

指令與參數仍受安裝版 Appium、驅動、Android 版本及伺服器安全設定限制；不自動開啟 relaxed security、安裝外掛或啟用 shell。工作階段、擁有者、雙機 actor、裝置互斥與送出前畫面核對仍由 Archify 管理。操作只送一次；結果不明時先觀察，不自動重送。一般 Flow 與 Agent 驗證都拒絕讓舊版 worker 執行新命令，包含共用案例依賴。

官方資料：

- [UiAutomator2 execute methods](https://appium.github.io/appium-uiautomator2-driver/latest/reference/execute-methods/)
- [Appium WebDriver protocol](https://appium.io/docs/en/latest/reference/api/webdriver/)

## 報告錯誤證據

執行 trace 保存失敗子步驟路徑、動作、階段、角色與耗時；Driver message 經命令參數、引號內容、URL、常見秘密與 Email 規則遮蔽後最多 1200 字，trace message 最多 1500 字，不保存完整回應或 stacktrace。規則遮蔽不能辨識任意文字的全部敏感語意。品質報告網頁及 PDF 使用此證據，舊資料無法回補。先更新 Control API，再更新 Android worker 及前端。未改查找、等待或重試語意，不把曾成功當作當次必須成功的證明。
