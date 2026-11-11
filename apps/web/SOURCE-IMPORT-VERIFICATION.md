# 增量匯入驗證

2026-10-27，Asia/Taipei。

既有專案重新選擇完整資料夾後，以前次匯入快照比對。相同檔案只送路徑、SHA-256 與長度；只上傳新增／修改的檔案。省略的舊路徑從新快照移除，舊快照保留。新快照從完整組裝來源重新建立依賴切片，不沿用舊模型回答，不自動呼叫模型。首次匯入仍完整上傳。

## 實際檢查輸出

| 檢查 | 結果 |
| --- | --- |
| Control API 型別檢查 | tsc --noEmit 成功 |
| apps/web 建置 | TypeScript / Vite 成功 |
| 完整服務測試 | tests 106、pass 106、fail 0、skipped 0 |
| verify-source-import-ui.mjs | PASS：實際選擇資料夾按鈕開啟 chooser，完整選取 3 檔，送出固定基準與完整指紋清單，只傳修改／新增 2 檔，完成後保存新快照指標 |
| verify-api-chat-ui.mjs | PASS：既有 API、來源範本／案例分離、聊天、掃描與分類刪除互動回歸 |
| validate_tokens.py | 1/1 JSON 有效、11 tokens |
| validate_contrast.py | 必需亮色配對通過；裝飾邊框 1.23:1 advisory |
| lint_hardcodes.py | apps/web/src 72/72，無硬編碼樣式 |
| check_no_emoji.py | apps/web/src 72 檔，無 emoji |
| lint_native_select.py | apps/web/src 45/45，無原生 select |
| verify_states.mjs | 實際匯入元件 harness：19 element-states 通過 |
| axe_audit.mjs | 0 violations |
| verify_responsive.mjs | 280/320/414px @1.25x root font 無水平溢出 |
| verify_keyboard.mjs | 5 controls + 0 composites 通過 |
| verify_target_size.mjs | 10 targets @414/1280px 尺寸或例外條件通過 |
| verify_mobile_first.mjs | 移除寬度 media/container 後，320px 基礎布局通過 |
| lint_intent.mjs | 退出 0，辨識 0 intent-bearing controls，不擴張中文語意檢查結論 |
| slop_tells.mjs --strict | 無可測問題，退出 0；不代表美觀分數 |
| verify_overflow.mjs | 320/414/1280px 無剪裁或非預期重疊 |
| verify_reduced_motion.mjs | policy present、motion stopped、no content lost |

所有 render gates 設定 DS_REQUIRE_BROWSER=1 並使用實際 Chrome；檢查輸入 .local/source-import-ui/gate.html 使用真實 ProjectFileImport、TestingProvider 與 Tailwind 建置輸出。1280px／320px 已在記憶體中檢視，不保存截圖。檔案選擇器由可見按鈕操作；隱藏 input 使用 hidden，不再讓無法點擊的 1px 控制參與目標尺寸檢查。

## 回歸重點

- 同一包再次匯入：added/modified/deleted 為 0，沿用全部 3 檔，沒有 /files 或 /chunks 內容傳輸，完整新快照的 contentHash 不變。
- 增刪修改：只傳 2 檔，重用 1 檔、刪除 1 個舊路徑；新快照 3 檔齊全，舊快照逐欄不變。
- 共用 client 改動，未修改的呼叫頁面仍存在完整來源與重建的切片中；結果逐欄等於 sourceAnalysisParts(完整來源)，並含新端點內容與呼叫頁面。
- 跨專案來源基準、未完成 manifest、未計畫便提交、內容 digest／長度不符、清單外片段、未完成傳輸都拒絕；不產生新快照。取消暫存工作不改動舊快照。
- 大型中文檔案的增量分段傳輸保留完整內容，最終須符合預先比對的 digest。
- 舊後端沒有 protocol 2 時，前端拒絕並刪除暫存工作，不上傳內容。
- 純 JS SHA-256 與 Node 標準實作在 UTF-8、padding 邊界及百萬 bytes 輸入逐一相同；支援沒有 SubtleCrypto 的 HTTP 安裝。

## 重現與限制

先建置 apps/web，再執行 scripts/verify-source-import-ui.mjs。可用 NODE_PATH 指定 Playwright、CHROME_PATH 指定 Chrome。服務回歸用 npm test --workspace services/control-api。

新增來源匯入路由以獨立 Fastify 註冊，保留原有完整上傳與大檔片段入口，新增 manifest／plan。不需要資料庫 schema 遷移。前後端須一起更新。這次是增量傳輸、完整解析與完整重建切片；尚未做只重跑部分模型批次的結果快取。

未操作真實專案資料庫或公司 Git、未傳送真實原始碼到模型、未部署 VM。介面測試使用隔離回應，路由測試使用隔離交易與快照資料。
