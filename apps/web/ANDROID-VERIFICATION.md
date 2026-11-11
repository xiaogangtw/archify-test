# Android 集中執行與分享入口驗證

## E2E 批次與 Appium 執行入口分流（2026-10-29）

- 共用 AndroidFlowExecution 預設送 executionOrigin=appium，E2EBatchExecution 明確指定 e2e-batch。兩者保留操作用 batchId／batchContinue，避免破壞 session 共用；API 保存入口並納入 requestId 冪等比對，e2e-batch 必須指定 batchId，僅此入口建立共用報告版本。
- 品質報告 Android SQL 查詢、改名與整批軟刪除皆限 e2e-batch。前端歷史只將此入口轉為報告群組；Appium／無入口的舊紀錄保留原版本與執行詳情，不列品質報告。舊資料沒有被覆寫或刪除，不以批次名稱猜測入口。
- npm test：169／169 PASS；其後補強入口版本建立／變更拒絕／缺少 batchId 斷言，相關測試 14／14 PASS。API 型別檢查與 apps/web build PASS，保留既有 bundle 提醒。混合同一 batchId 的 e2e-batch、Appium、未知入口及其他帳號測試確認只有符合入口的資料會讀取、改名、刪除。
- verify-flow-toast PASS distinct Appium/E2E-batch origins，以及原通知、編輯、案例刪除與執行紀錄行為。使用真實共用元件及模擬執行器，Appium 多案例均標記 appium，批次入口單案例標記 e2e-batch。此次沒有新增 UI 排版或 CSS，未保存畫面截圖。
- 未更新 VM 或修改真實資料庫；前端與 VM API 必須同步部署，Windows worker 不需因本次分流重啟。

## 報告列表刪除與 13px／15px 字級（2026-10-29）

- QualityReports 獨立頁新增垃圾桶按鈕與共用 Modal 確認；原有嵌入報告的 onDelete 回呼保留。沿用版本軟刪除 API，取消不送出、失敗保留並可重試、進行中停用；成功清理展開資料並過濾舊輪詢結果，將焦點移回列表。沒有刪除使用者實際報告。
- tailwind.config 新增 report-body 13px、report-heading 15px 語意字級，報告內容與 PDF 共用；PDF 使用 px→pt 換算後的 9.75／11.25pt，所有文字大小均由驗證腳本檢查。表格行高與章節預留空間同步調整，仍保留文字層。
- apps/web build PASS（既有主 bundle 與按需 PDF chunk 大小提醒保留）；verify-execution-ui PASS 報告刪除確認／取消／失敗重試／執行中限制／重新載入保存，以及原有紀錄、PDF 字型失敗重試與原生下載流程。採模擬 API，不宣稱真實資料庫刪除已驗收。
- PDF 最新普通／長表格／原生下載樣本各 3／7／3 頁，中英文、完整 SHA、兩個表格結尾、字型嵌入、0 圖片、13px／15px 字級及每頁邊界皆 PASS；Poppler 全頁渲染已檢視。網頁報告標題 computed fontSize 實測 15px；列表及確認視窗已在記憶體檢視與操作，未保存 UI 截圖。
- reports-gate：states 20 element-states、axe 0 violations、keyboard 6 controls、target 12 targets PASS；刪除視窗 states 27、axe 0 PASS；responsive 280／320／414 @1.25、mobile-first 320 PASS；hardcodes 0、元件無 emoji／native select。既有顏色投影 29 tokens 有效且必要 light 對比 PASS（裝飾邊框 1.23:1 advisory）。lint_intent 0 intent-bearing controls，不代表全面意圖覆蓋；slop strict 無 measurable tells，非美感分數。

## 品質報告文字層與中文匯出（2026-10-29）

- reportPdf 改用 pdf-lib 與 fontkit，文字／表格直接寫入 PDF，移除 Canvas、JPEG 與整頁 Image XObject。摘要及案例總覽使用表格，保留原始結果與來源聲明；超長說明與表格列支援跨頁、重複表頭與頁碼。使用 Tailwind 現有色彩，沒有新增 UI CSS。
- 前端隨附 Inter／Noto Sans TC Regular、Medium TrueType 及 OFL 授權，來源 SHA 與重建方式記於 public/fonts/README.md。首次嘗試的 CFF／runtime subset 雖可擷取文字，但 Poppler 實際顯示缺字，已改完整靜態 TrueType 嵌入。代價是字型檔及 PDF 較大；樣本 PDF 約 8.8 MB，匯出模組為按需載入。
- apps/web build PASS；新增 PDF 匯出 chunk 約 1.15 MB（gzip 約 511 KB），仍有大型 chunk 提醒。verify-execution-ui PASS 紀錄刪除取消／失敗重試／保留、分組篩選、報告讀取失敗、字型載入失敗後重試、未完成禁用、原生下載、檔名、長訊息／表格與窄版。只使用隔離範例資料，沒有連接真實測試服務或改動資料庫。
- verify-report-pdf 以 pypdf 檢查字型嵌入與零圖片，以文字擷取檢查中英文、完整 SHA 及長表格結尾，並檢查每頁文字邊界；早期另以 pypdf 全文擷取確認文字映射。PDF 由 Poppler 渲染後檢視，排除缺字、重疊及孤立末行，字型錯誤修正後才採計。未聲稱 PDF/UA 或螢幕閱讀器標記已驗證。
- 舊圖片報告需重新下載；前端部署須包含 public/fonts 資產。本次未更新 VM 或下載使用者真實報告，檢查產物保留於忽略的 .local/execution-ui。
- 最後版本的普通樣本 4 頁、長文字／表格樣本 12 頁、原生下載樣本 4 頁，皆通過中英文與完整 SHA 文字擷取、完整 TrueType 字型嵌入、0 張圖片及頁面邊界檢查。長表格兩個結尾標記完整保留；Poppler 最新渲染確認章節不再孤立於頁尾。

## E2E 批次品質報告遺漏修正（2026-10-29）

- 原品質報告只查詢 runs／API workflow，漏掉 android_runs；前端 Android 歷史轉換也漏傳 batchId／batchName。已將具明確批次 ID 的 Android 紀錄納入相同報告 API，前端保留批次資訊，新執行於建立時使用共用 ANDROID-BATCH 識別碼。
- 歷史逐案例版本以保存的 batchId 建立報告分組識別碼，原始紀錄的 testVersion、腳本版本、來源與手填 SHA 不覆寫。報告查詢不沿用手機歷史清單的 20 筆限制；詳情含步驟事件，舊紀錄無 trace 時由已保存 steps 狀態呈現。既有 PDF 下載取得此份報告資料，不補造執行證據或部署版本。
- Android 報告讀取、改名、整批軟刪除限制 owner；執行中禁止下載及刪除。驗證包含 25 筆批次完整分母、失敗計數、舊版本保留、改名、刪除、其他帳號隔離及無 trace 步驟。
- 報告／歷史相關測試 10／10，後端型別檢查與 apps/web build 通過；此前完整後端測試 167／167 通過，之後新增歷史轉換測試及步驟 fallback 以相關 10 項重驗。build 有既有 bundle 大小提醒。此次沒有 UI 排版或 CSS 變更，未建立畫面截圖，未實際下載／渲染新的 PDF。
- 未部署 VM，未修改實際資料庫。需更新 VM 後端及前端後才可使用。報告分母是已保存的案例執行紀錄；失敗停止後從未送出的案例沒有執行證據，不補列為成功。

## 結果提示右下角與縮小（2026-10-29）

- 提示改右下角，沿用 4 單位邊距；toast max-width token 從 36rem 改 28rem，內距從 p-5 改 p-4，文字段距縮為 space-y-1。字級、關閉目標尺寸與 7 秒計時保留。
- apps/web build 及 verify-flow-toast PASS，位置斷言更新為右側與下側邊距，原流程互動回歸通過。真實元件失敗提示 harness：states 3 element-states PASS；axe 0 violations；responsive 280／320／414 @1.25 無溢出；target size 2 targets PASS；keyboard 1 control PASS。hardcodes 0、元件無 emoji。桌面與 320 窄版已在記憶體檢視並以 Enter 關閉，未保存截圖。僅前端變更。

## 測試結果提示視覺調整（2026-10-29）

- 僅調整完成／失敗／未確認時的浮動提示，鈴鐺通知清單不變。共用 FlowResultToast 以中性 surface、完整細邊框、小型語意圖示、深色標題及 muted 摘要呈現，取消整塊紅綠黃底；沿用位置、寬度 token、關閉按鈕與 7 秒自動消失。無新增 CSS 或色彩 token。
- apps/web build PASS，仍有既有 bundle 大小提醒。verify-flow-toast PASS notifications, editing, case deletion confirmation, running rejection and history preservation，使用模擬執行器；更新外觀斷言為中性底與狀態圖示，原批次、失敗停止、通知回查、編輯及計時驗證保留。
- 三種狀態的真實元件 harness 各 states 3 element-states PASS、axe 0 violations；失敗狀態 keyboard 1 control、target size 2 targets PASS；responsive 280／320／414 @1.25 無溢出、mobile-first 320 PASS。lint_intent 0 intent-bearing controls，沒有意圖覆蓋證據。slop strict 對獨立單一浮層回報單一陰影 MED 建議，屬孤立預覽的啟發式限制，未新增無用途陰影。固定 light，不驗證 dark。
- 新元件 hardcodes 0、無 native select；96 個 UI 檔無 emoji。現有 Tailwind 顏色投影 29 tokens 有效且必要 light 對比皆 PASS，裝飾邊框 1.23:1 advisory。三種提示及窄版已在記憶體檢視並用鍵盤關閉，未保存截圖。這些檢查不代表美感評分。

## 模擬器效能診斷與調整（2026-10-29）

- 唯讀實測：WHPX installed and usable；Ryzen 7 5800H、8 cores／16 logical processors、CPU load 21%；主機可見記憶體 16154332 KB、剩餘 3566896 KB。單一 qemu 工作集 2940522496 bytes，另有 VirtualBox VM 運行。這是單次資源快照，不是持續負載分析。
- 既有 emulator-5554：1080x2400、density 420；SurfaceFlinger GLES renderer 明確回報 Google SwiftShader。五個基本 ADB 讀取約 57–71 ms，裝置 MemAvailable 1233064 KB。未操作應用程式，未讀取公司或帳號內容，未保存畫面。
- 啟動參數新增 `-gpu host`，以 `ARCHIFY_ANDROID_GPU=auto|software` 提供明確相容備援；非法值拒絕啟動。未增加 RAM 或改變解析度。三個 Appium 入口共用停用動畫能力與 1000 ms 閒置等待；原有元素／結果等待及總期限保留。設定失敗會阻止後續手機動作並清理 session。
- `npm run android:test`：69 tests／69 pass，包含 GPU 模式／非法值、三個入口的設定、設定失敗不點擊且清理，以及原有失敗斷言與流程回歸。這些使用替身，不代表真實 GPU 相容性或業務流程成功率已驗證。本次無 UI 變更。
- 未重啟現有手機或 worker，未完成新設定的實機前後比較。現行手機仍是軟體繪圖；新設定須下次正常重啟 worker 及手機後套用，不能回報已提升幀率或降低逾時失敗比例。

## 燈號旁重試圖示（2026-10-29）

- 重試移至各手機的燈號旁，使用共用 refresh 圖示、無可見文字與外框，保留可存取名稱與滑鼠提示。沒有已啟動裝置時不顯示；僅可操作裝置、串流未暫停且燈號為灰色時啟用，綠色、紅色、唯讀及操作進行中均停用，原後端保護保留。
- apps/web build 通過；verify-android-ui PASS，包含未啟動不顯示、灰燈重試、綠燈停用、圖示無可見文字、鍵盤、重複送出阻擋及原手機回歸。全部使用模擬執行器，未重設使用者 ADB。
- 灰燈真實元件 harness：states 61 element-states PASS；axe 0 violations；keyboard 13 controls；target size 20 targets；responsive 280／320／414 @1.25 及 mobile-first 320 PASS；lint_intent 0 intent-bearing controls（無意圖覆蓋證據）；slop strict 無 measurable tells（非美感證明）；新元件 hardcodes 0、95 個 UI 檔無 emoji。桌面已記憶體檢視，未保存截圖。

## 前端重試手機連線（2026-10-29）

- 新增文字按鈕、等待及失敗提示，重試透過 VM 命令佇列交給 Windows 執行器；ADB 失敗仍回報控制心跳，保留裝置身份並撤銷就緒狀態。重設時暫停串流並重新建立畫面。固定指令無瀏覽器可指定的程式或參數，沒有強制結束手機或清除資料。
- 後端限制單一重試、所有操作佇列／測試／Agent 空閒及裝置歸屬；本機另檢查 Appium 活動。涵蓋 ADB 失敗、恢復、初次狀態失敗、重複重試、逾時預算、錯誤傳遞、跨帳號阻擋、重連暫時無裝置及不同 AVD 重用連接埠。
- Android 單元測試 66／66；Control API 完整測試 165／165，後續歸屬修正再跑 Android API 測試 5／5；API 型別檢查及 apps/web build 通過。完整 API 首次因受限本機連線 EACCES 失敗，在一般執行環境重跑通過。build 仍有既有大型 bundle 提醒。
- verify-android-ui：PASS ADB retry keyboard, duplicate guard, loading, failure retention and busy restrictions；原手機建立、三／四機、操作、唯讀及窄版回歸亦 PASS。使用模擬 HTTP、WebSocket 及解碼器，未聲稱新版跨 VM 真實重設已驗收。舊 harness 缺少 TestingProvider 導致空畫面，已補齊真實 Provider 並重跑；空畫面的零控制 gates 不採計。
- 有效渲染 gates：states 49 element-states；axe 0 violations；keyboard 9 controls；target size 18 targets；responsive 280／320／414 @1.25 無溢出；mobile-first 320 通過；lint_intent 0 intent-bearing controls（無意圖覆蓋證據）；slop strict 無 measurable tells（啟發式，非美感分數）。固定 light，不驗證 dark。桌面及 320 窄版等待／錯誤畫面已在記憶體檢視，未保存截圖。
- Tailwind 既有顏色投影 29 tokens JSON 有效，所有必要 light contrast pairs PASS，裝飾邊框保留 1.23:1 advisory；兩個變更 UI 檔案 hardcodes 皆 0，95 個 UI 檔無 emoji，新元件無 native select。Python 初次 cp950 讀檔失敗，設定 UTF-8 後重跑通過。沿用共用 Button 與現有 tokens，未新增 CSS。
- VM API 及 Windows worker 尚未更新／重啟；現行執行器未回報 adbRecovery 時按鈕停用且說明更新需求。未為驗證而再次重設使用者正在使用的 ADB。

## 固定手機 Quick Boot 與 ADB 恢復（2026-10-29）

- 固定手機移除 `-no-snapshot-save`，允許正常關閉時保存 Quick Boot；臨時唯讀手機保留禁止寫回快照。關機後等待 ADB 離線及程序退出，共用等待預算並清理逾時監聽器，未退出前拒絕重新啟動同一固定手機。
- `npm run android:test`：62 tests／62 pass；首次因受限暫存目錄 rename EPERM 失敗，改用專案 `.local/test-temp` 後完整重跑通過。`apps/web` build 通過，保留既有大型 bundle 提醒。此次無 UI 變更。
- 啟動時間量測因 ADB 異常中止，未取得有效首次／再次開機比較。獨立驗證程序及其手機已停止，未清除 AVD 或使用者資料。驗證腳本新增實際耗時與快照檔檢查，後續可重跑。
- ADB 曾回報 offline／unauthorized，使用 SDK 的 `adb kill-server` 重設後，既有 emulator-5554 回報 device、booted=true，Appium ready=true；實際 screencap 回傳 86782 bytes 且 PNG 簽章正確。沒有保存截圖，尚未據此宣稱網頁串流已驗收。
- 目前執行中的 worker 仍載入舊版程式，Quick Boot 修改需於下次正常重啟服務後生效；未強制重啟整個開發服務，以免其程序樹清理中斷既有手機。

## 雙機角色流程與 LINE 撰寫修正（2026-10-28，最新）

- Control API：`npm test` 126 tests / 126 pass；Android 模擬測試：17 tests / 17 pass。新增雙裝置所有權與鎖定、重複手機拒絕、來源與角色凍結、兩個 session 的交錯路由與獨立 systemPort、等待實際斷言、第二個 session 失敗清理，以及 activateApp 後 current_package 前景檢查。這些不等於實際 LINE／交換驗收。
- API TypeScript check 與 apps/web build 通過。unified-flow-ui 模擬 API 驗證 LINE 範例、android-flow 聊天用途、單機批次與失敗停止、雙機欄位／不同手機選擇／送出 bindings，以及320／390／1280無水平溢出。
- 最終雙機頁：states24、axe0、keyboard11 controls、target size22 targets、mobile base320與responsive280／320／414 @1.25通過。編輯頁states35、axe0。三個UI來源hardcodes通過；testing58來源無emoji，兩個元件無native select。Tailwind顏色投影11 tokens解析及light必要contrast通過，裝飾邊框advisory警告；固定light，未宣稱dark驗證。lint_intent辨識0控制，不代表意圖全面覆蓋；slop屬啟發式。視覺檢視後補上可見角色標籤與接收者未選提示，未保存截圖。
- 初次介面檢查因 LINE 範例帶來 AI 修改預覽後綴，精確文字比對失敗；修正測試比對並重跑通過。另發現雙機驗證頁誤載編輯器，修正入口後重跑以上雙機頁檢查，未沿用誤載結果。
- 使用者要求自行進行實際 App 測試後，停止雙機系統設定實測及其專用驗證裝置；未完成並未宣稱真實雙機協定驗證。實際 LINE、名片交換及 VM 新版部署仍待使用者操作。

## 統一 Test Case／Flow Case 與 Appium（2026-10-28）

- Windows安裝Appium3.9.0／UiAutomator2 8.7.2於被忽略的.local/appium，僅本機4723。`verify-appium-live.mjs`用獨立固定驗證手機開啟系統設定：實際assertVisible通過；刻意找不存在的id失敗；最後正常刪除工作階段與關閉驗證手機。首次實測因畫面尚未可見而失敗，加入斷言等待後重跑通過。沒有存截圖或讀取LINE帳號。
- `npm run android:test`：13tests／13pass，涵蓋AST靜態定義拒絕程式執行、至少一個斷言、Appium失敗不偽裝通過與清理session、noReset／fullReset設定、原裝置和串流行為。新增API執行測試涵蓋帳號、單裝置鎖、來源快照、requestId去重、session進度 fencing、拒絕未完成步驟的假通過。
- `npm test`：Control API124tests／124pass。前端build106modules與Control API TypeScript通過。
- unified-flow-ui：PASS類型選擇、儲存caseType、AI指令分流、只列Flow Case、手機選擇、逐筆批次、失敗停止後續、320／390／1280無水平溢出。模擬API，沒有將此稱為真實Appium驗證；真實Appium結果以上述獨立裝置實測為準。既有Android UI回歸通過。
- 編輯頁states29、axe0violations、keyboard7controls；執行頁axe0violations、target16targets、responsive280／320／414@1.25、base320@1.25通過。驗證頁最初錯把執行頁載成編輯頁，已修正為pathname指定真實執行頁後重跑以上檢查。新執行元件與編輯器hardcodes通過，testing58個來源無emoji、無新增native select。共用11token投影與必要contrast通過，裝飾border為advisory告警；lint_intent辨識0controls、slop無可量測告警。Flow編輯與聊天室已記憶體視覺檢視，未保存截圖。測試不代表全狀態或所有App都已驗證。
- VM新API與資料表仍需管理者以Ubuntu密碼部署。未聲稱實際VM保存／跨SSH執行／LINE App／雙手機名片交換已驗收。

## Flow Case 編輯與右下角聊天（2026-10-28）

- 前端TypeScript／Vite成功，105 modules；Control API TypeScript成功。
- verify-flow-case-ui：PASS名稱／儲存、4步預覽、AI建議不自動儲存、套用後儲存／reload、聊天歷史、專案隔離與320／390／1280無溢出。使用模擬LLM，沒有執行Appium或驗證真實模型輸出。
- android-flow-model：1 test／1 pass，舊Android流程轉入且原紀錄和Web流程不刪除；壞紀錄拒絕；預覽不執行任意程式碼。
- verify-android-ui既有模擬器／固定手機／全螢幕／觸控與Web入口回歸通過，Android分頁名稱改成Flow Case。
- Flow Case編輯頁gates：states23，axe0violations，keyboard5controls，target10targets，responsive280／320／414@1.25和mobilebase320@1.25通過。lint_intent辨識0intentcontrols，slop無可量測告警，非美觀評分。新元件hardcodes及native-select通過，testing57個來源無emoji；既有11顏色token投影與必要contrast通過，裝飾border有advisory告警，無暗色檢查。聊天開啟、套用與Escape另由互動smoke覆蓋。
- 案例編輯與右下角聊天室已記憶體視覺檢視，未保存截圖；依現有案例撰寫佈局，浮動聊天室開啟時會遮住部分右側編輯器，可收起。

## Chrome分頁／應用程式切換（2026-10-28）

`blur`只放開觸控，不拆影片；`visibilitychange`改為1500ms延後背景暫停，短暫切回沿用socket。較久背景後關閉影片／解碼器，返回自動訂閱。舊worker傳回error但保持WebSocket時，前端最多自動重新訂閱3次，不重送觸控。worker新增每裝置session管理，啟動中切走不重疊啟動、過期結果不通知新觀看者、800ms無人觀看寬限及意外退出有限恢復。Scrcpy伺服器路徑依SCID獨立，減少舊清理程序影響新檔案。

隔離loopback relay＋真實emulator-5554影片驗證PASS：實際H.264解碼、失焦不重連、3次短暫hidden事件不重連、2次較長hidden事件後自動恢復、暫停恢復、窄版。由測試明確設定document.hidden並派送事件，並非人工Alt-Tab或真實Chrome分頁可見性切換；沒有對Android送Home／滑動，未保存截圖。此次首畫面2134ms、55個解碼影格是單次本機測試，非效能保證。Android啟停單元測試包含切換啟動、回收與重試。

前端由Vite更新；worker的session修正需要重新啟動Windows Android worker（通常重新啟動npm run dev），不需要VM重建。未聲稱已替使用者重啟現有worker。

## 手機畫面放大排版（2026-10-28）

桌面裝置清單使用共用14rem欄寬token，右側畫面高度改為共用max(32rem,68dvh)，保留contain比例與原座標換算。固定／臨時手機管理收合並移到操作區下方。新增原生全螢幕按鈕，進出時放開觸控，處理瀏覽器拒絕訊息與fullscreenchange同步；同一個canvas與連線保留，不建立第二個控制視窗。

前端build成功（103 modules）。Android UI smoke實際點擊進出全螢幕、檢查fullscreenElement、確認一般canvas高度大於原384，並通過既有新增／啟動／觸控／暫停／權限／窄版回歸。1400×1050驗證頁量測canvas高度714、起點y432；不是所有裝置或視窗的尺寸保證。記憶體截圖已檢視，未保存。最終版states49、axe0 violations、keyboard12 controls、target24 targets、responsive280／320／414@1.25與mobilebase320@1.25通過。hardcodes／emoji／native-select掃描通過。意圖gate辨識0controls、slop無可量測告警；不作美觀評分。全螢幕與互動使用模擬影像來源，不代表新增LINE實際測試。

## 固定手機資料保存（2026-10-28）

- 建置：TypeScript／Vite成功，103 modules transformed；Control API TypeScript成功。
- Android單元測試8 tests／8 pass：包含固定手機獨立catalog、原子寫入、UUID路徑驗證、可寫入啟動、排除wipe／read-only、同手機重複啟動拒絕、worker重啟辨識、worker結束保留固定手機與正常關機。
- API固定手機2 tests／2 pass，包含建立與prepare結果核對、固定身份、阻止臨時入口啟動、帳號隔離、API／worker重啟恢復歸屬。使用持久store替身，未以此宣稱VM PostgreSQL已遷移。
- Android UI smoke通過：固定手機命名、新增、啟動／查看，以及臨時多開、觸控、關機、離線、工作區切換與窄版。使用替身worker，未將草稿稱為可執行測試。
- 瀏覽器gates：49個element-states；axe 0 violations；keyboard11controls；target22targets；responsive280／320／414@1.25與base320@1.25通過。lint_intent辨識0個intent controls，人工來源確認關機為secondary、臨時停止為danger；slop無可量測告警，非美觀分數。新元件hardcodes／native-select與55個testing來源emoji掃描通過；共用11token投影及必要contrast通過，裝飾border有advisory告警。頁面已在記憶體視覺檢視，未保存截圖。
- 實測建立獨立驗證手機，首次建立遇到官方Java工具需要toolsdir參數已修正。第一次完整開關測試遇ADB錯誤，未記為成功；後續重跑結果另記。原本5556與其帳號資料沒有被搬移或覆寫。
- 重跑 `scripts/verify-android-persistence.mjs` 成功：First boot ready、Marker written、Shutdown completed、Second boot ready，最後輸出 `PASS real writable phone retains data after shutdown and restart. LINE login was not tested.` 驗證手機正常關閉，ADB只留下原5556。本機驗證AVD與catalog保留供重現，未刪除私人資料，未聲稱LINE登入或VM資料庫實測通過。
- VM新版API與Windows worker仍需部署／重新啟動。原有臨時手機不自動轉成固定手機，LINE登入保存與第三方帳號有效性未實測。

## Scrcpy 升級驗證（2026-10-28，以下舊紀錄保留供追溯）

同日追查 localhost:5173 的通道錯誤：實際 VM API與 Vite 代理均收到影片，真實網站在 localhost／127.0.0.1 都成功播放。修正觀看器以免解碼錯誤被通用斷線提示覆蓋，並在解碼錯誤時改用軟體解碼重連。`scripts/verify-scrcpy-recovery.mjs` 對真實網站注入一次瀏覽器 EncodingError，確認具體錯誤顯示、prefer-software 設定、真實影片恢復後清除錯誤，結果PASS。此結果驗證備援，不代表已確認使用者當時的斷線原因。

後續確認實際 Vite 服務只有127.0.0.1:5173，localhost提供相同新版來源，IPv6無其他服務。45秒觀察收到523個影片封包，心跳持續新鮮。新開分頁可播放5554；使用者新啟動的5556先離線、再連線但booted=false，影片過早啟動失敗。觀看器改為等待booted=true才連線，等待期間清除舊影片錯誤；瀏覽器替身驗證等待期間零影片封包、狀態轉就緒後自動播放，互動 smoke通過。實際新分頁已顯示「等待裝置啟動」，不以此宣稱5556完成開機。

後續5556實際完成開機，使用者回報已可點擊；測試分頁回報同裝置另一視窗正在操作，驗證單一操作視窗限制。臨時開發代理診斷已移除、測試分頁已關閉以免占用操作權。舊5554實際進程確認為本專案SDK的Archify_Play_API_35唯讀模擬器，以新增的主機回收工具停止，ADB確認裝置消失；5556保留運行。主機回收不變更瀏覽器歸屬規則。尚未因此宣稱執行器重啟後能自動恢復舊裝置擁有者。

- `npm run build --prefix apps/web`：TypeScript／Vite 成功，102 modules transformed。
- `npm run check --workspace services/control-api`：TypeScript 成功。
- `npm run android:test`：6 tests，6 pass。包含 Scrcpy 二進位觸控／按鍵格式、錯誤輸入、分段影片解析、裝置封包路由。
- Android API、Scrcpy relay、舊 SSE 回歸：5 tests，5 pass。涵蓋 worker 認證、來源限制、擁有者、同帳號不同視窗、非擁有者拒絕、關閉放開與舊裝置流程。
- `scripts/verify-android-ui.mjs`：PASS；使用模擬 WebSocket／解碼器驗證分頁、多開要求、連續觸控、導覽、暫停／恢復、僅檢視、停止、離線與320／390／1280版面。
- `node --import tsx scripts/verify-scrcpy-live.mjs`：現有 emulator-5554 的真實 H.264 解碼、非空像素、主畫面、按下／移動／放開、暫停／恢復、320／390／1280無溢出均 PASS。兩次首張畫面為1062ms及1535ms；第二次顯示13個實際解碼影格。這是本機隔離中繼，不是 VM 的操作延遲量測。未啟動第二台或宣稱雙開效能。
- 真實手機影片及整頁工作區已在記憶體檢視，未保存截圖。
- 裝置頁 gates：states檢查47個狀態；axe 0 violations；keyboard 12 controls；target size 24 targets；responsive 280／320／414 @1.25x、mobile base320 @1.25x均通過。意圖檢查識別0個意圖控制，停止按鈕danger variant另外檢查來源；slop gate無可量測告警，非美觀評分。最初兩個 gate 因未載入瀏覽器套件而失敗，使用既有 Chrome loader 後重跑通過。
- 新觀看器 hardcodes／native select掃描通過；testing目錄54個來源無emoji。11個共用顏色投影token有效且必要contrast配對通過；裝飾邊線contrast有advisory警告，沒有暗色驗證。
- 配對 PowerShell 語法通過。VM不提供免密SSH，本次未部署新版映像，也未宣稱Docker建置、登入閘道或遠端HTTPS驗收完成。更新操作見 ANDROID-DEPLOYMENT.md。

## 2026-10-28 拖曳滑動與 Play 商店映像選項

新增 Pointer Events 拖曳手勢：螢幕等比換算、黑邊排除、放開後傳送 swipe、終點邊界限制、取消手勢清除；短距離送 tap，不重複送 click。方向鍵作為滑動的鍵盤替代。API 驗證兩端座標與 duration，worker 再依真實裝置尺寸驗證並執行固定 adb input swipe，不接收任意 shell。

SDK setup 增加 -PlayStore，使用 google_apis_playstore 建立新的 Archify_Play_API_35，不覆蓋舊裝置。唯讀檢查現有 Archify_API_35 config.ini 實際為 PlayStore.enabled=no、google_apis 映像；檢查時 ADB 無連線裝置，所以本輪沒有真實滑動驗收，也未下載／啟動 Play 商店映像或安裝 LINE。

前端 build、後端 TypeScript check、4 項 bridge 測試與 3 項控制 API 測試通過（包含 swipe 參數與越界／非法 duration 拒絕）。UI smoke 實際執行滑鼠拖曳與 ArrowUp，確認左滑座標方向、拖曳不多送 tap、上滑鍵盤替代；使用 mock 執行器。SDK setup PowerShell 語法通過。

門檻輸出：47 element-state(s) contrast OK、axe 0 violations、280/320/414px @1.25x 無溢出、15 keyboard controls、21 target-size checks OK、mobile-first OK、intent 與 strict slop heuristic OK。元件 hardcodes／emoji／native-select 各掃描 1 檔皆 OK。這些不是流暢度或美觀評分，亦不代表 Google Play／LINE 相容性已驗收。

## 2026-10-28 連續影格串流

Viewer 改成自動訂閱 SSE 影格，不再提供手動更新按鈕；支援暫停／恢復、隱藏頁面關閉、斷線重連、開機期間顯示畫面。VM 只轉送給當前觀看者，Windows worker 在每個影格前先領取操作，無觀看者時不擷取。串流錯誤與操作錯誤分開顯示，後續畫面不會清掉操作失敗訊息。

實際執行：前端 build、後端 TypeScript check 通過。Android 控制與串流服務共 4 項測試通過，包含兩個真實 HTTP SSE 觀看端連續接收兩個影格、單裝置擷取目標去重、指令優先、無觀看者釋放、失效 session 與非法 PNG 拒絕；測試影格是 fixture，無使用者 VM。既有 4 項 bridge 測試亦通過。

`scripts/verify-android-stream-live.mjs` 另使用目前連線的真實模擬器，經本機隔離 API 中繼連續收到 3 個 PNG，每個 1,378,786 bytes，傳送階段合計 4029 ms。這是單次量測，不是持續效能保證，不代表 VM 串流已部署。未保存畫面、未啟動／關閉／輸入裝置。

UI smoke 使用 mock EventSource 驗證自動出圖、至少兩次影格、暫停／恢復、控制操作、唯讀裝置與離線清除，並保留原有分頁與窄螢幕檢查。Chrome 在記憶體檢視 fixture 畫面，未保存預覽截圖。最新完成的門檻：44 element-state(s) contrast OK、axe 0 violations、280/320/414px @1.25x 無溢出、15 keyboard controls、30 targets 尺寸 OK。hardcodes／emoji／native-select 各掃描 1 檔皆 OK。

此版本是低幀率連續 PNG 傳輸，沒有 H.264/WebRTC 編碼，不宣稱影片等級流暢度。需要更新 VM API 與重啟 Windows worker 後，才能在目前網頁使用。

## 2026-10-28 狀態列精簡

移除 Android 頁重複副標、模擬器工作區標題、大面積四欄狀態與重複離線提示。主要狀態只保留連線、裝置數／SDK 未就緒與非空操作佇列；SDK、Appium、時間與安裝指引收在原生 details。安裝文件與腳本改為明確支援 SDK-only＋相容 Java，不強制安裝 Android Studio。

重新執行前端 build 與既有 Android UI smoke 均成功；在 Chrome 檢視未連線畫面並實際展開說明，沒有保存截圖。最新 gate 輸出：44 element-states contrast OK、axe 0 violations、280/320/414px @1.25x 無水平溢出、15 controls keyboard OK、30 targets size OK、mobile-first OK。hardcodes／emoji／native-select 各掃描新元件 1 檔皆 OK；共用 11-token 顏色投影 required contrast pairs 通過。以下舊次數保留為前一階段驗證紀錄。

## 已實作

- Web Playwright、Android Appium 分開的導覽入口；Android 預設為模擬器，流程草稿另頁保存。舊混合平台草稿以原儲存格式保留。
- VM 控制 API 與 Windows worker 的主動配對、狀態心跳、期限與串行裝置操作。Android 使用獨立秘密檔，不向瀏覽器提供 worker token。
- 多 AVD 工作階段的不同連接埠、唯讀／隱藏視窗啟動、硬體加速檢查、裝置畫面記憶體回傳、點擊與基本 Android 導覽。
- Nginx 登入入口、個別帳號與 Android 裝置操作歸屬、可選 Caddy HTTPS 部署。其他專案與設定仍是共用工作區，不是多租戶。

## 實際執行輸出

- `npm run build --prefix apps/web`：TypeScript／Vite build 成功，100 modules transformed。Android 工作區已分開載入。
- `npm run check --workspace services/control-api`：成功，無 TypeScript 錯誤。
- `npm run android:test`：4 tests，4 pass，0 fail。驗證僅列模擬器、SDK 缺失、不同埠多開、參數與座標驗證、外部裝置停止限制、硬體加速不足時拒絕啟動。使用替身命令執行器。
- `node --import tsx --test services/control-api/test/android.test.ts`：3 tests，3 pass，0 fail。驗證離線拒絕、單一新鮮 worker、工作階段失效、串行派送、裝置歸屬、結果錯誤與重複回報、心跳過期時移除就緒顯示。
- `scripts/verify-android-ui.mjs`：PASS split pages, keyboard count selection, two-device launch payload, screen, home/tap, stop, ownership, offline restrictions, flow separation and responsive overflow。這是隔離瀏覽器＋模擬 HTTP 回應，不是真實 Android 驗收。
- `scripts/verify-e2e-ui.mjs`：原名片流程範本、必填、角色保護、排序、瀏覽器保存、專案隔離、窄螢幕與鍵盤 smoke 通過。
- Chrome 工作區截圖已在記憶體檢視，未保存圖片檔。
- Android 裝置頁 `verify_states`：Checked 42 element-state(s)，default／hover／focus 均 OK。
- `axe_audit`：0 violations。
- `verify_responsive --scale=1.25`：280/320/414px 無水平溢出。
- `verify_keyboard`：14 controls reachable，Enter/Space and arrow keys answer。Gate 沒有辨識到 composite widgets；數量下拉的方向鍵與 Enter 另由互動 smoke 實際操作。
- `verify_target_size`：28 targets @414/1280px，all >=24x24 or exception-covered。
- `verify_mobile_first --scale=1.25`：320px 移除寬度 media/container 後通過。
- `lint_intent`：OK，但辨識到 0 intent-bearing controls。停止按鈕的 danger variant 另外檢視來源確認。
- `slop_tells --strict`：no measurable slop tells，僅為啟發式檢查。
- AndroidWorkspace／E2EWorkspace 的 hardcodes、emoji、native select：各掃描 2 個來源檔，均 OK。
- 共用顏色投影 `.local/api-workbench-ui/theme.json`：11 tokens 解析成功，required light contrast pairs 通過。不涵蓋全部 Tailwind token，也不代表暗色驗證。
- Compose share 設定與加入 HTTPS override 的設定解析均成功；未以此宣稱映像建置或 TLS 已成功。
- PowerShell setup 語法、worker 與 dev 啟動腳本的 Node 語法、git diff whitespace 檢查通過。

## 真實環境結果與未完成驗收

`npm run android:check` 實際回報 sdk.ready=false、avds=[]、devices=[]、appium.reachable=false。沒有安裝 SDK、沒有啟動真實 Android 模擬器，也沒有執行使用者 APK。

尚未部署到使用者 VM；未實測 Docker 網頁映像、登入閘道與不同使用者的實際網路連線、HTTPS 憑證申請、Windows 硬體加速與雙開效能。安裝與部署步驟見 ANDROID-DEPLOYMENT.md。SDK 授權必須由管理者自行閱讀並在安裝工具中接受；腳本不會自動同意。

畫面目前按需更新，不是即時串流。尚未提供 APK 安裝、滑動／輸入文字、Appium 工作階段、自動執行白話流程或測試通過紀錄。
