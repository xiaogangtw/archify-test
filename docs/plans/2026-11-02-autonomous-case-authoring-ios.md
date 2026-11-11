# AI 自主案例撰寫與跨平台手機調整計畫

日期：2026年11月2日。狀態：第一、二階段主要程式與第五階段匯出已落地，第三階段完成 Android adapter 與 Mac 前置檢查；完整計畫尚未驗收或部署。

## 範圍

保留 Archify 控制台、PostgreSQL、現有模型連線、Android Appium 與 Scrcpy。將案例撰寫從逐句指導改為目標導向任務，AI 能整理案例分類、編碼、標題、操作與預期結果，自行探索、產生草稿並在授權範圍內重跑驗證。Android 與 iOS 都納入 agent-device adapter 評估，不限定只接 iOS，也不先淘汰既有引擎。

已交付 Agent 草稿 metadata、人工命名保護、執行語意 hash、不受聊天裁切影響的需求紀錄，以及前端同一 draft 的自動同步、正式案例版本／代碼／分類、持久修正 inbox、帶來源記憶與 CSV 匯出。跨平台引擎仍未完成；程式測試不代表真實手機、模型、PostgreSQL 遷移或部署驗收。

接續範圍：主要 `ScriptWorkspace` 保留唯一正式儲存入口；正式案例保存 metadata、服務配置穩定代碼並驗證分類，已補修正訊息持久 inbox、任務階段與版本衝突／恢復回歸。使用者另問只有 Mac 是否足夠：Mac 可先用 Simulator 與自有 App build，正式 LINE／LIFF 手機驗收另需 iPhone。尚未提供 Mac 連線方式，因此 iOS 實跑與延遲仍未驗證。

## 參考清單與現況

已讀使用者提供的「測試案例項目清單.docx」。它以功能群組組織案例，主要欄位為編碼、項目名稱、項目說明與預期結果。文件另強調前置條件、本人與他人、已收藏與未收藏、首次與重複操作不能混用；設定保存和接收端實際呈現應分開驗證。

該文件自述正式案例95項、候選情境135項；這是來源文件的盤點，不是本次重新執行或確認的通過數。既有狀態與部署未知等註記只作歷史證據，不匯入為目前通過結果。附件內容視為測試參考資料，不作為執行指令。

實作核對發現：androidAgentPrompt.ts 已要求觀察、操作、錄製、局部改稿與重跑；androidAgentTasks.ts 已有持久任務、驗證結果及最多三次重跑限制；androidAgentDraft.ts 的 configure 目前僅允許 appPackage、variables、actors，尚不能修改案例標題與業務欄位。authoringMessages.ts 會裁切歷史訊息，不能單靠聊天紀錄充當長期任務記憶。既有 E2EWorkspace.tsx 仍有另一套結構化規劃表單，後續須核對實際入口，避免修改到非主要撰寫路徑。

## 目標體驗

使用者輸入「幫我測試手機號碼隱藏後，另一個帳號收到的名片是否也隱藏」，AI 先讀取目前案例、可用來源與裝置，再自行選擇觀察及操作，不要求使用者提供定位器、XML 或逐步點擊指令。

AI 在草稿中命名為「新分享名片不顯示已隱藏的手機整欄」，歸入「名片編輯與儲存」，整理發送端與接收端條件、操作、結果斷言及資料還原。若接收者、帳號資料或可執行的副作用範圍未知，只針對缺少的內容提問。完成後說明草稿變更、實際驗證結果與受阻原因，名稱同步頂部編輯欄，使用者仍可修改並按單一儲存按鈕。

此例參考來源 TC-EDIT-20 的結構，不代表已建立新案例、已取得帳號授權或實際通過。

## 案例資料結構

案例分成業務定義、平台腳本、執行證據三層。標題是資料欄位，不能只出現在聊天回覆或程式碼註解。

| 層級 | 建議欄位 | 規則 |
| --- | --- | --- |
| 身分 | caseId、caseCode、categoryId、title | ID 穩定；代碼由服務端配置，不能由模型猜下一號 |
| 業務定義 | objective、preconditions、dataRefs、actors、steps、expectedResults、cleanup | 每個結果連到對應步驟或案例層斷言；測試資料使用參照 |
| 來源 | requirementRefs、sourceRefs、referenceCaseCode、assumptions | 分開記錄規格依據、程式推論與待確認假設 |
| 成熟度 | candidate、draft、ready | 與實際執行結果分開；填完欄位不等於可執行或通過 |
| 平台腳本 | platform、engine、scriptVersion、target、locatorBindings、dependencies | 同業務案例可有 Android／iOS 實作；凍結依賴版本 |
| 驗證 | runId、executionHash、platform、device、assertionEvidence、outcome | 綁定精確來源、資料參照版本、引擎及平台，不能跨平台沿用通過 |

案例庫維持單層分類標題與緊湊案例列，呈現「編碼、標題、狀態」及 play／edit，不增加資料夾層級。完整業務內容在右側流程預覽以可讀段落呈現；不建立額外案例卡表單、檢查清單或獨立提問區。

候選情境保留 GAP 等來源代碼與待確認預期，不自動升為正式案例。來源同義項先比對並關聯，避免將候選項重複建成正式案例。

## AI 自動命名與草稿一致性

新增結構化 metadata patch，讓 AI 同時更新 title、category、objective、preconditions、expectedResults 等欄位，與現有步驟 patch 共用 revision 及衝突檢查。模型只提出分類與編碼建議；服務端驗證分類並配置正式代碼。

命名以「對象或條件加可觀察結果」為原則，例如「空白手機不能發送驗證碼」「儲存後重開保留姓名」。避免「測試案例一」「Agent 實際操作紀錄」成為正式標題，避免把多個獨立業務結果硬塞同一案例。

未命名或仍為系統暫名時，AI 可直接更新草稿名稱。使用者手動修改後，記錄 titleOrigin=user；除非使用者要求或本輪明確變更測試目標，AI 保留該名稱。批次生成時每案獨立命名、配置代碼及驗證，不能以一案成功代表整批通過。

名稱變更不影響執行語意，保存名稱與腳本為同一版本快照；純改名可保留原執行來源的驗證關聯。步驟、預期結果、角色、資料或平台綁定變更，必須重新計算 executionHash 並取消目前草稿的有效驗證，不能以舊結果宣告新稿通過。

頂部名稱、聊天產出、流程預覽、編輯器與儲存請求讀取同一份 draft，避免 UI 顯示新名稱但保存舊名稱。衝突時重新讀取版本，不覆蓋使用者輸入。

## 從制式對話改為自主任務

不靠增加歡迎語或假進度改善自動化感。建立任務狀態：理解目標、讀取依據、觀察探索、整理案例、恢復起點、重跑驗證、局部修復、完成或受阻。這些為內部狀態，在同一個聊天中只顯示有用的進展與結果，不新增操作模式下拉或多個對話窗。

每個任務持久保存 goal、acceptedRequirements、sourceEvidence、knownFacts、unknowns、allowedEffects、deviceBindings、draftRevision、nextAction 與操作事件。最近訊息只是補充；裁切舊對話時仍可從來源 ID 取回已確認資料，不把被裁切視為使用者從未提供。

每輪依實際工具結果決定下一步，允許動作預算內持續執行。沒有新畫面先觀察，選取元素後執行並核對效果；同狀態反覆無進展時換策略或停止，不能機械重試。工具成功不等於測試成功。

已知且已授權的測試資料、步驟整理、命名及安全起點恢復自行完成。只在缺少帳號、驗證碼、未知業務規則、無可用裝置或副作用超出授權時提問；提問指出已查到的內容及唯一缺口。使用者追加「改成另一台接收」「只測這個欄位」時更新現有任務，不無故重建案例或丟失既有步驟。

執行授權、資料與時間預算必須明確保存；收到停止後中止後續動作並清理。已送出但結果不明的操作先觀察核對，不因重連或重啟自動重送。新增資料、發訊、刪除及帳號操作尤其適用。保持既有三次重跑上限，不以放寬斷言換取通過。

參考文件、原始碼與 UI 文案不是 Agent 指令；預期結果以使用者及明確需求為準。只在程式中發現的行為標為推論，不能把現有 bug 當成正確規格。

## 撰寫介面調整

沿用頂部可編輯名稱與一個儲存按鈕，左側單一聊天，右側流程預覽，下方展開的全寬 TypeScript 編輯器。AI 草稿自動同步預覽，不為每一個改動增加「套用」「確認」步驟；正式寫入案例庫仍由頂部儲存完成，任務中間稿可自動暫存以供恢復。

聊天以真實進展呈現，例如「已確認設定保存；接著切到接收者核對新訊息」，不用每次都輸出固定長段落、工具 JSON 或假裝正在執行的文字。需要回答的問題仍留在同一聊天。最終訊息說明命名、已改內容、實際驗證狀態與必要限制。

任務由後端持有，切換會話或頁面後可訂閱同一任務。持久化不代表重啟後盲目續送：恢復時核對工作階段與最後操作，結果不明先重新觀察。固定案例的批次派送也要移到後端，分別處理排程與任務恢復。

## Android 與 iOS 引擎架構

保留共同 Agent 與案例服務，新增平台無關的 MobileEngine 介面：capabilities、acquire、observe、perform、verify、cancel、release。observe 回傳帶裝置身分、actor、observationId、時間與方向的截圖和元件樹；perform 明確區分穩定定位、短效觀察參照與座標。

第一個 adapter 包裝既有 Android Appium。第二個 adapter 評估 agent-device，同時驗證 Android 與 iOS。Mac Worker 提供 iOS Simulator／iPhone 執行環境，Appium XCUITest 作為比較及保留選項。平台、引擎版本、支援動作與可用裝置由 Worker 回報，服務端建立執行前拒絕不支援的流程。

既有 emulator serial 與 appPackage 不直接改義為 iOS 欄位。新增 platform、deviceId、target 型別，Android 映射 serial／package，iOS 映射 UDID／bundleId。先加相容層與明確 schemaVersion，保留舊 API／腳本讀取能力，不能批次重寫歷史版本。

agent-device 探索的畫面 ref 不寫成永久定位器。由錄製轉換層產生 Archify 正規化步驟與平台定位；未知動作保留為未支援並阻擋執行，不能靜默略過。若改由 tester-army Runner 執行，另建立 runner adapter 與隔離環境，不直接在 control-api 執行模型生成的任意 TypeScript。

案例可共用業務預期，平台各有定位與系統操作。雙機角色綁定一般化，支援兩台 Android、兩台 iPhone 及混合配對；建立任務時原子取得所需裝置，失敗全部釋放。Agent、人工控制與回歸 Runner 不能同時持有同一裝置，探索轉驗證時明確交接。

現有 API Flow、固定共用流程版本、before／after、斷言保護與資料不落秘密的規則均須保留。接入新引擎不代表這些能力已相容。

## iOS 畫面與低延遲

AI 觀察與人看影片分開：AI 使用可追溯的新鮮截圖及元件樹，不把延遲影片當唯一操作證據。Android 保留 Scrcpy。

iOS 第一階段可評估 WDA MJPEG 觀看；模擬器另評估 Mac 畫面擷取、硬體 H.264 編碼與 WebRTC。真機 ReplayKit 廣播另作可行性驗證，確認安裝、使用者啟動、跨 App 及無人值守限制後再選用。agent-device 的錄影不能直接當作現成的低延遲網頁串流。

影片與控制獨立通道，採有限緩衝、過期畫面丟棄、避免重複編碼及就近連線。驗收分別量測畫面延遲、操作回應、AI 單輪耗時；先記錄同網路與跨網路基準，再與使用者約定門檻，不宣稱尚未量測的延遲數字。

LINE OA／LIFF 要區分原生 LINE、嵌入 WebView 與外部瀏覽器，能力不互相推定。自有 App 可先用 Simulator；若測試 LINE 正式 App，先確認可安裝的裝置與登入條件，不假定 App Store 的真機版本能裝到 Simulator。

## 實作階段與驗收

| 階段 | 交付 | 完成條件 |
| --- | --- | --- |
| 一 案例結構與命名 | metadata、穩定代碼、AI rename、共用 draft revision | 一句需求生成可讀標題及案例；使用者改名不被覆寫；重連與儲存名稱一致 |
| 二 自主對話閉環 | 持久上下文、來源查找、狀態與事件、問題最小化 | 無需逐步教操作；切頁後任務保留；停止有效；未知副作用不重送；精確稿件實跑才標通過 |
| 三 雙平台 adapter 比較 | Android 舊引擎封裝、agent-device、Mac Worker 與 iOS | 同一組代表案例比較觀察、操作、重跑、取消與清理；不支援功能明確阻擋 |
| 四 iOS 與跨平台驗收 | iPhone 單機、雙機與混合角色、畫面觀看 | 實機登入、LIFF、接收端斷言、資料還原與裝置釋放均有證據；延遲另有量測 |
| 五 文件式案例整理 | 單層分類、案例列表、候選關聯與匯出 | 可產出類似參考清單的編碼／項目／操作／預期結果；候選及歷史結果不混入目前通過數 |

優先完成一、二，直接改善目前「對話制式、標題要手填」；三、四獨立驗證，不能因尚無 Mac 或 iPhone 而阻擋 Android 的體驗改善。每階段獨立可回退；新引擎先限指定專案和案例啟用。

代表驗收案例選來源「空白手機不能發送驗證碼」「儲存後重開保留姓名」「新分享名片訊息不顯示已隱藏的手機整欄」，分別涵蓋單機唯讀、寫入及還原、雙機與跨 App。測試前需準備合法測試帳號及資料，來源文件不構成實際操作授權。

## 影響檔案

本次實際變更：

- `services/control-api/src/androidAgentDraft.ts`：metadata schema／patch、命名保護與執行語意 hash。
- `services/control-api/src/androidAgentMemory.ts`：獨立使用者需求紀錄、冪等與容量限制。
- `services/control-api/src/androidAgentTasks.ts`、`androidAgentPrompt.ts`：任務 API、持久上下文、驗證關聯與失敗預期保護。
- `services/control-api/test/android-agent-metadata.test.ts`：新增七個契約與任務回歸測試。
- `services/control-api/src/scriptCases.ts`、`model.ts`、`main.ts`、`schema.sql`：正式案例 metadata／穩定號碼／分類、證據核對、schema 與保存交易。
- `services/control-api/src/androidAgentInbox.ts`、`androidAgentTasks.ts`：持久修正收件匣、checkpoint 後 ack、任務記憶、階段及預算。
- `services/control-api/src/mobileEngine.ts`、`services/mobile/mac-check.mjs`、根目錄 package.json：Android adapter、版本化平台目標、Mac 唯讀前置檢查。
- `apps/web/src/features/testing/ScriptWorkspace.tsx`、`androidAgentClient.ts`、`agentDraftSync.ts`、`CaseMetadataPreview.tsx`、`scriptModel.ts`、`ApiChat.tsx`：同一草稿自動同步、手動名稱／來源衝突保護、原聊天回答與業務預覽。
- `apps/web/src/features/testing/ScriptLibrary.tsx`、`caseExport.ts`：編碼、候選狀態、來源關聯及 CSV 匯出。
- `services/control-api/test/script-cases.test.ts`、`android-agent-inbox.test.ts`、`mobile-engine.test.ts`、`scripts/verify-autonomous-authoring-ui.mjs`：回歸與瀏覽器驗證。
- `README.md`、`apps/web/README.md`、`docs/ios-mac-setup.md`：部署／開發入口與 Mac／iPhone 能力分界。
- `ARCHIFY-CURRENT-SPEC.md`、`docs/android-agent-authoring.md`、`docs/README.md`、`docs/decisions/2026-11-02-agent-draft-metadata.md`、`docs/decisions/README.md` 與原計畫／索引。

以下保留為後續預計修改範圍，實作前仍需核對路由與資料流：

- services/control-api/src/androidAgentDraft.ts、androidAgentTasks.ts、androidAgentPrompt.ts、androidAgentRecording.ts：metadata patch、任務記憶與錄製轉換。
- services/control-api/src/androidFlowAuthoring.ts、androidExecution.ts、androidRuns.ts、schema.sql：案例欄位、版本與平台映射、驗證證據。
- services/android/flow-contract.mjs、flow-engine.mjs、worker.mjs：相容層、平台邊界及能力宣告。
- apps/web/src/features/testing/：核對實際案例編輯入口、authoringMessages.ts、AndroidWorkspace.tsx、AppiumFlowPreview.tsx 與案例庫；統一 draft 與任務訂閱。
- 新增共用 mobile engine contract、agent-device adapter 與 Mac Worker 模組；實際路徑於實作階段定案。

## 資料庫影響

新增案例業務 metadata、來源與候選關聯、平台腳本對應、命名來源、任務上下文及事件序號。優先檢查既有表與 JSON 欄位，避免重建重複案例庫。migration 採新增可空欄位、回填、再收緊驗證；舊資料標題沿用，缺少的業務規則標未知，不能由模型批次猜補為已確認。

第一批後端基礎只擴充任務 JSONB；本次接續新增 `scripts.case_number`、sequence、回填、唯一索引及 NOT NULL，另建 `android_agent_inbox`。正式 metadata 留在既有 script_versions.body，不重寫舊版本。遷移沿用 migrate()，先停止寫入並備份、先更新 API／DB 再更新前端；回退保留新增欄位、表及 sequence、不刪歷史。真實 PostgreSQL 遷移未執行，本機 Docker engine 不可用。舊服務回寫新欄位不受保證，回退前停止任務。

任務暫存與正式案例版本分開保存。代碼唯一性由資料庫約束；正式儲存採交易與 revision 檢查。執行快照保留三個 Git repository 的完整 SHA／QA tag，只有 frontend 依既有政策取得程式碼。擴充 mobile build identity 與可取得的版本證據，未知值保持未知，不把 Git ref 等同實際部署。

## 風險

AI 可能將現況當規格、亂命名、覆蓋人工修改或將舊驗證套到新稿；以來源追溯、revision、命名來源及 executionHash 防護。平台定位與能力不完全相同，以明確能力檢查與真機案例驗收處理。新 adapter 可能遺失 API Flow／cleanup 等語意，以相同回歸案例比對，不以工具呼叫成功代替業務成功。

截圖、元件樹及對話可能包含個資；沿用遮蔽與最少保存策略，秘密只使用參照，不寫腳本、事件或報告。新 Worker 沿用配對、擁有權與工作階段驗證，不公開裝置控制或畫面連接埠。觀看通道與 AI、人工操作共享同一裝置租約規則。

## 設計文件同步

已同步 ARCHIFY-CURRENT-SPEC.md 1.2、Android Agent 契約 1.1、metadata 決策、前端 README、操作入口與 Mac／iOS 說明。既有 Android 自動驗證文件保留原歷史測試結果，不改寫為本次真機證據。後續新引擎與真機落地時，再同步對應驗證及部署文件。

UI 變更遵守既有固定亮色、Tailwind v3 tokens、單一聊天與頂部單一儲存規則；不加審批、Agent 下拉、案例卡表單或額外問題面板。未修改 UI 前不執行設計渲染 gate 來宣稱產品已驗收。

## 領域

AI 案例撰寫與跨平台執行

## 任務狀態

- [x] 已開始
- [ ] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

整份計畫仍未完成，不勾選「實作完成」與「可供審查」。第一階段主要程式／模擬與瀏覽器驗證完成，但 PostgreSQL migration、模型及手機整合未驗收；第二階段主要持久上下文／inbox／階段已落地，尚缺可機械約束任意 App 副作用的 allowedEffects 策略、完整需求來源索引與後端批次排程。第三階段只完成舊 Android adapter、平台邊界及 Mac doctor，agent-device／Mac Worker 尚未接入。第四階段缺 Mac／iPhone 實跑與延遲量測。第五階段已提供單層分類、來源代碼、候選保留及 CSV，尚無來源同義去重與正式候選升級流程。既有 GraphQL 測試仍失敗，未改寫無關斷言以製造綠燈。

## 驗證證據

已唯讀擷取參考 DOCX 文字，核對案例群組、標題、操作、預期與候選區分；已閱讀現有 Agent prompt、task、draft、recording 及部分前端入口。未執行來源案例，也未安裝 agent-device、操作手機或修改模型連線。

2026-11-02 第一批後端基礎實測（保留歷史）：

- `npm.cmd run check --workspace services/control-api`：通過。
- `npm.cmd test`：首次受限制環境為 210 項、207 通過、3 失敗；其中兩項為本機串流連線 EACCES。補上最後兩個 metadata 測試後，允許測試連接自身本機服務重跑，212 項、211 通過、1 失敗；兩個串流測試已通過。
- 剩餘失敗為 `services/control-api/test/api-scan-preview.test.ts:40` 的既有 GraphQL Query／Variables 預設值案例，實際仍為舊 query，與本次修改模組無關；前次 Android 自動驗證紀錄也已記載同一失敗。未將完整套件宣稱為綠燈，也未改寫該斷言。
- 新增七個 metadata／需求紀錄測試全部通過，包含人工命名與過期 revision 保護、原子修改、聊天裁切後需求保留、純改名不操作手機、驗證失效及失敗業務預期不可放寬。測試使用記憶體 store 與模擬模型／裝置，不代表真實 PostgreSQL、手機或模型驗收。
- 未修改前端、Android worker 或部署；前端建置、UI gates／視覺操作、Android worker 測試不適用於本次後端基礎。未安裝新引擎、未操作 LINE、未連接 iPhone 或更新 VM。
- `npm.cmd run docs:plans:index`、`npm.cmd run docs:check`：通過，2 份計畫的索引、必要結構與本機連結一致。`git diff --check` 通過；既有 CRLF 提示不影響檢查結果。

2026-11-02 接續實作實測：

- Control API 型別檢查通過。針對 Agent／正式案例／inbox／平台契約的 42 項測試通過；涵蓋舊流程與雙機保留、停止、未知結果不重送、版本衝突、人工名稱、精確證據、候選／CSV 與 Mac 拒絕 Windows。DB 使用 SQL mock，手機／模型為模擬。
- 完整 `npm.cmd test`：222 項，221 通過、1 失敗。仍是上述既有 `api-scan-preview.test.ts:40` GraphQL 預設值問題；本輪兩個串流測試通過。
- `npm.cmd run build --prefix apps/web` 通過，保留 Vite 大型 chunk 提示。
- `scripts/verify-autonomous-authoring-ui.mjs` 使用實際 Chrome 操作 React：即時草稿／名稱／業務欄位同步、唯一儲存、精確保存快照、重開、人工改名保護、revision 帶入、原聊天回答接續、案例庫編碼／候選、CSV 實際下載內容、Enter 鍵移動分類與 390px overflow 均通過；後端／模型為 mock。依本機 bundled Playwright 使用 `.local/verification-loader.mjs`，未修改依賴 manifest。
- Gate 強制 `DS_REQUIRE_BROWSER=1`；案例庫 harness states 18 個狀態、axe 0 違規、responsive、keyboard 7 個控制項、target size 14 個目標、mobile first、intent、overflow、reduced motion 通過。已確認恢復任務與提問實際出現的撰寫 harness：states 39 個狀態、axe 0 違規、responsive、keyboard 11 個控制項、target size 22 個目標、mobile first、intent、overflow、reduced motion 通過。兩份 harness 另以 1.25x 字級在 280／320／414px 通過 responsive。
- 從實際 `apps/web/tailwind.config.ts` 產生臨時 token 快照（11 tokens），token 結構及淺色必要 contrast pairs 通過。裝飾 line 有對比 advisory，未改共用色彩。CSS variable refs 檢查不適用：本專案由 Tailwind config 管理 tokens，styles.css 沒有 CSS variables；未以該次檢查的失敗冒充通過，也未拿上游 JSON 代替。
- source hardcode 105 個檔案、native select 63 個檔案通過；新增／修改主要 TSX 的 taste／emoji 掃描 0 finding。固定淺色不跑 dark；accuracy_report 為上游套件自測，不執行或用來評分本應用程式。
- 已直接查看桌面與 390px 實際畫面，未保存預覽截圖。taste heuristic 指出既有標題與本文字級差距小，保持工作區既有 typography，不把客觀 gates 當設計品味證明。
- `npm.cmd run mobile:mac:check` 在 Windows 正確回 ready:false、exit 1；Mac ready 行為僅以 mock 模擬測試，未假稱本機 iOS 可用。未安裝 agent-device、未操作 LINE／iPhone、未更新 VM、未執行 PostgreSQL migration 或 Android worker 真機測試。
- `npm.cmd run docs:plans:index`、`npm.cmd run docs:check` 及 `git diff --check` 通過；未保存預覽截圖，harness／下載／token 快照只留在被忽略的 `.local` 驗證目錄。

## 技術參考

- [tester-army 引擎邊界](https://github.com/tester-army/e2e/blob/main/packages/e2e/src/engine/index.ts)
- [tester-army 統一執行事件](https://github.com/tester-army/e2e/blob/main/packages/e2e/src/run/events.ts)
- [agent-device API 與觀察機制](https://github.com/callstack/agent-device)
- [agent-device 平台安裝需求](https://github.com/callstack/agent-device/blob/main/website/docs/docs/installation.md)
- [WDA MJPEG 串流](https://github.com/appium/appium-xcuitest-driver/blob/master/docs/guides/mjpeg.md)

以上是先前調查的參考來源；採用時需固定版本並重新核對能力，不以 main 分支內容作相容性保證。
