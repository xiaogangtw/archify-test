# Android Agent 自主案例撰寫契約

文件版本：1.3

最後更新：2026-11-02

## 修訂紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| 1.3 | 2026-11-02 | TC 使用獨立序列，既有有效 TC 由 1 回填，FC 與歷史快照不變；新增 DB 欄位及序列，未改路由、守衛、導向、API 結構或 GraphQL payload。 |
| 1.2 | 2026-11-02 | Flow Case 改用 FC，Test Case 保留 TC；沿用數字識別與歷史快照，未改路由、守衛、導向、API 結構、GraphQL payload 或 DB schema。 |
| 1.1 | 2026-11-02 | 接入前端草稿同步、正式版本 metadata／編碼／分類、證據關聯、持久修正 inbox 與 CSV 匯出；擴充 REST payload 與 DB schema，未改路由、守衛、導向或 GraphQL payload。 |
| 1.0 | 2026-11-02 | 新增任務草稿 metadata、人工命名保護、語意 hash 與需求紀錄；擴充 Agent REST payload，未改路由、守衛、導向、GraphQL payload 或 DB schema。 |

## 範圍與入口

主要入口為 `ScriptWorkspace` 的 Android 操作 Agent。名稱、右側業務內容／流程預覽、下方展開的 TypeScript 編輯器使用同一份未儲存 draft，輪詢時自動同步，不再逐次按套用。頂部唯一儲存按鈕建立正式版本。提問顯示於原聊天訊息並使用原輸入欄回答，不另設問題面板。純腳本建議模式仍使用原比較／套用機制；本次未改寫一般 Web 撰寫流程。iOS、agent-device、Mac Worker 與跨平台裝置租約尚未實作；Android adapter 與 Mac 前置檢查見 [iOS 文件](ios-mac-setup.md)。

## 草稿與版本

`AgentDraft` 仍有 `source`、`revision`、`nodes`，另可有 `metadata`。舊任務無此欄位仍可讀取。業務欄位不放進 executable Flow，Android worker 的既有嚴格格式不用放寬。

metadata 支援 `title`、`categorySuggestion`、`objective`、`preconditions`、`dataRefs`、`expectedResults`、`cleanup`、`requirementRefs`、`sourceRefs`、`assumptions` 及最多 100 字的 `referenceCaseCode`。標題與分類建議各最多 200 字；目的最多 2000 字；陣列各最多 50 項，每項最多 2000 字。所有文字去除前後空白且不得為空；陣列可用空陣列清空，未提供欄位保留。正式分類名稱另限 100 字，超量儲存拒絕。

模型以既有 `patch` 工具中的 `{op:"metadata",value:{...}}` 修改，可與 insert／replace／remove／configure 放在同一交易式合併。全部操作完成並通過格式及依賴檢查才保存；過期 revision 或任一無效操作不套用整批。模型不能寫 `titleOrigin`、正式 `caseCode`、`caseId` 或 `categoryId`；分類先提出名稱建議，正式儲存才由服務驗證及配置。

服務端將模型給的名稱記為 `titleOrigin:agent`。人工提供名稱記為 `titleOrigin:user`，模型不得改為另一名稱，但可保留同名並修改其他欄位。目前即使文字要求改目標，仍不自動解除人工命名保護；人工改名需經以下 API 欄位提供。

`POST /api/android/agent-tasks` 增加可選的 `metadata` 與 `draftRevision`。metadata 是使用者目前編輯的欄位；接續既有任務且帶 metadata 時，draftRevision 必須等於任務草稿版本，否則回 409。新任務可省略 draftRevision。既有不帶 metadata 的呼叫相容。傳入 title 表示人工命名，不能由請求指定 titleOrigin。任務執行中仍拒絕重新建立；使用既有 corrections 入口追加需求。

純 metadata 修改保持原始 source 及步驟 ID，可交付未驗證草稿而不操作手機。修改原始碼後重建步驟索引時保留既有 metadata；明確 dismissed 的建議不帶入新稿。前端將既有未標來源的非空案例名稱視為人工名稱，防止舊案例被改名；新建空名稱允許 AI 命名。Agent 名稱再次傳送時不冒充人工命名；人工輸入才帶 title。切頁後可恢復任務，scriptVersion／來源衝突不覆蓋目前草稿；最近一次自動同步後若另有人工程式碼修改，後續任務更新也不覆蓋。

## 正式案例、分類與匯出

`PUT /api/scripts/:id` 接受經 schema 驗證的 metadata 與 `maturity:candidate|draft`，名稱與 metadata.title 同時提供時必須一致。同一交易驗證版本、保存名稱與 metadata／source 快照、配置穩定代碼（自動化 Flow Case 使用 FC-000001，腳本 Test Case 使用 TC-000001）。資料庫 `scripts.case_number` 使用 sequence、NOT NULL 與唯一索引；同一 script id 各版沿用同號，並忽略客戶端猜測的編碼。號碼可能因交易回滾或更新而跳號，不代表缺案例。既有腳本遷移只回填穩定號碼，不重寫歷史版本 body；bootstrap 在目前案例依 caseType 附加權威代碼，既有 Flow Case 不需重新儲存即可呈現 FC。TC 改用 scripts.test_case_number 與 script_test_case_number_seq 獨立序列：遷移將未配置號碼且未刪除的非 Flow 案例依原 case_number 排序，由 1 回填（已有新號時從最大值接續）；第一筆有效 TC 為 TC-000001。後續儲存沿用固定號碼，刪除不重排或重用；FC 繼續沿用原 case_number，不重新編號。歷史版本與執行快照保留原代碼。需更新 Control API 才生效。

分類沿用 `archify.script-folders.v1` 的單層分類與 scriptFolders 關係。同交易取得文件及案例鎖；建議唯一匹配同 scope 分類時沿用，不存在則建立，另一 scope／巢狀／重複名稱拒絕。未分類使用 null。未變更的舊建議不會在重存時拉回使用者後來手動移動的分類；保存時採目前樹中的分類，分類樹仍為案例庫歸屬來源。候選 GAP 來源及既有 candidate 保持候選，不因欄位填完或某次執行而升級；目前沒有自動去重或候選升正式流程。

案例庫顯示編碼及草稿／候選文字，可匯出目前 scope 的案例 CSV，含分類、編碼、名稱、目的、前置、精確腳本、預期、清理、來源與執行證據。使用 UTF-8 BOM、引號跳脫與試算表公式前綴防護。操作欄保留精確腳本，不將程式推論冒充已確認業務步驟；沒有有效證據就寫未提供。候選仍在同一檔案標示候選，不混算通過數。

## 執行證據

`verification.executionHash` 是 Android／Appium 邊界、解析後完整 Flow 與業務 metadata 的 SHA-256；物件鍵順序正規化，陣列順序保留。僅排除 title、titleOrigin、categorySuggestion。純 metadata 改名保留精確 source 與既有驗證；流程、資料參照、預期、前置、清理或來源變更使目前驗證失效。編輯步驟名稱仍視為來源變更，採保守失效處理。

自動驗證任務完成時，同時核對精確 source、hash 與實際 passed 結果。沒有 hash 的舊驗證不作為新完成宣告的依據；重開任務或切換裝置仍沿用既有失效規則。hash 不是部署身分，也不證明 metadata 已轉為可執行斷言；執行仍使用 Flow 中的實際斷言。

正式儲存可攜帶 `agentTask:{id,draftRevision}` 作證據參照，伺服器核對 owner、scriptId、停止／完成狀態及草稿 revision，只有目前精確 source／hash 的 passed 結果才附加版本 verification。客戶端直接提供的 verification 不可信，不予保存；舊版本證據只在 hash 相同時保留。驗證關聯保存 taskId、draftRevision、平台／引擎及裝置角色，不轉造成一般 Runner runId，也不暗示目前部署狀態或新版本已再次執行。

失敗後保留原有腳本斷言與分支保護，另保留失敗時的 metadata.expectedResults，拒絕移除或改寫原結果。每輪最多三次重跑，不放寬斷言換取通過。這些檢查不能證明兩段文字或定位器在業務上等價。

## 持久需求與恢復限制

任務 JSON 增加 `instructions:[{requestId,content}]`，保存建立／接續任務的使用者需求；每次規劃提供完整紀錄，與最多 40 則近期 messages 分開。較新的補充可調整目標，但不能因聊天裁切就遺忘原限制。同 requestId 不重複追加。最多 100 筆且總共 100000 字，超量回 413，保留原稿與舊需求，不靜默刪除。初次傳入的歷史聊天仍只走既有 history 機制，不回填為已確認的需求紀錄。

舊任務缺少 instructions 時，以原 goal 作為相容起點，不推測被裁切的舊對話。已消失的歷史無法復原。corrections 先交易寫入 `android_agent_inbox` 再回 202，最多 10 筆待處理，taskId／requestId 唯一。下一輪或收尾先併入 instructions／messages 並保存任務 checkpoint，之後才標 consumed；保存後、ack 前崩潰可依 requestId 去重。恢復不自動重送操作，先維持 uncertain，使用者接續時合併 inbox。停止時尚未合併的修正保留於 inbox，後續接續可讀；裝置切換仍沿用原記憶體訊號，尚無跨服務持久切換 inbox。

任務另保存 phase（理解、觀察、整理、驗證、修復、等待或完成），工具呼叫與事件仍是進度依據；不把內部階段偽裝成已完成結果。`remember` 工具保存 facts／unknowns／nextAction，facts 必須引用目前 instructions.requestId 或 observations.id；未知 ID 拒絕，較早證據須先 recall。每欄最多 50 筆，statement／unknown／nextAction 最多 2000 字。這是引用存在性檢查，不能證明文字推論正確。

每輪保存 30 分鐘 deadline、300 個裝置／驗證工具預算與最多三次驗證計數；模型決策另有既有 300 turn 上限。下一輪開始前核對預算，超限等待接續，不增加重跑上限；已送出的動作仍依執行器逾時與結果確認處理，不保證 deadline 當下立即中斷。這尚未構成能機械判定任意 App 業務副作用的 allowedEffects 策略；未知新增／發訊／刪除仍需模型依使用者指示詢問，不能宣稱已完成全自動安全授權。

instructions 是需求文字，不能視為已核准副作用、秘密儲存或新的執行權限。只提供非秘密測試參照，不在需求或 metadata 填入 token、密碼、驗證碼。既有重啟後 uncertain、不自動重送未知操作、裝置擁有權與釋放規則維持。

## 儲存、相容性與驗證

任務主體沿用 JSONB 及既有 revision CAS；新增 `android_agent_inbox` 表與 `scripts.case_number` sequence／欄位／唯一索引，透過既有 `migrate()` 執行。先備份並停止服務寫入，再正常部署 API 以遷移，最後更新前端。未在本機操作正式資料庫，PostgreSQL migration 尚未整合實跑。回退程式前停止任務並保留新增欄位、表與 sequence，不刪歷史版本或 inbox；TC 獨立序列遷移亦須保留 test_case_number 及其唯一索引／序列，回退只恢復舊版顯示，不刪除這些資料。舊版可能不處理新欄位，回退期間不得宣稱需求修正仍有新 inbox 保證。新前端不保證可對舊 API 使用。

回歸入口為根目錄 `npm run check --workspace services/control-api`、`npm test`、`npm run build --prefix apps/web`，瀏覽器腳本為 `node scripts/verify-autonomous-authoring-ui.mjs`（需可解析的 Playwright 與 Chrome）。新增測試使用記憶體任務庫／SQL mock／模擬模型及裝置，瀏覽器測試實際操作 React UI；不代表 PostgreSQL migration、真實模型、手機或部署。各輪實測結果見[原實作計畫](plans/2026-11-02-autonomous-case-authoring-ios.md)。
