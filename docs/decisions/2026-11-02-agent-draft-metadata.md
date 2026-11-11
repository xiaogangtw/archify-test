# 決策：Agent 業務 metadata 與可執行 Flow 分開保存

日期：2026-11-02
狀態：已接受

## 背景

既有 Android Flow 是 worker 可解析的嚴格靜態執行契約，任務草稿只有 source、revision 與穩定步驟 ID。若把案例業務欄位直接塞進 Flow，需擴充所有解析與執行邊界，也可能將描述誤當可執行結果。若另建獨立 metadata 更新機制，則容易與步驟版本脫節。

## 決策

在既有 AgentDraft 增加獨立 metadata，沿用同一 revision 與 patch 原子驗證，保存於任務 body JSONB。模型不能配置正式識別碼、分類 ID 或人工命名來源。前端同一 draft 自動同步，正式保存時將 metadata 與名稱、source 一起凍結在 script_versions.body；資料庫另在 scripts 保存唯一 case_number，由服務配置穩定代碼，不讓模型猜下一號。

分類仍沿用既有 documents 分類樹，正式保存採相同交易及文件鎖，避免另建第二套分類來源。使用者後來手動移動的歸屬優先於未改變的模型舊建議。修正訊息另用持久 inbox、requestId 去重及 checkpoint 後 ack，避免改寫執行中任務 revision 而誤觸停止；重啟仍須先觀察，不直接重送動作。

驗證除精確 source 外另綁語意 hash，排除 title、titleOrigin 與 categorySuggestion；其他業務欄位變更採保守失效。失敗後維持原可執行斷言與 metadata 預期，不能藉修稿放寬結果。

## 影響

舊 Flow、worker 與不帶 metadata 的呼叫維持相容；本次接續正式案例整合需新增 scripts.case_number／sequence／唯一約束與 inbox migration，既有歷史版本不重寫。語意描述不會自動轉為執行斷言，hash 也不是部署或裝置版本證明。正式證據由服務核對所屬任務與精確來源；不信任客戶端通過值。新欄位的舊版回寫保留未受保證，回退前應停止任務並保留新增資料。詳細契約見 [Android Agent 自主案例撰寫](../android-agent-authoring.md)。
