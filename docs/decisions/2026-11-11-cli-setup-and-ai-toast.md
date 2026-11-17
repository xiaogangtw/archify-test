# 決策：四步工作區設定前置 AI CLI、非秘密 .local 暫存與全面 Toast 通知

日期：2026-11-11
狀態：已接受

## 背景
1. 原三步工作區引導（前端來源 → 測試專案 → 專案知識）在第 3 步上傳文件時即會呼叫本機 AI CLI，且網站無法事先檢視或調整目前生效的 CLI 路徑、登入狀態與模型名稱，使用者在分析前無從確認目前使用哪一個 AI。
2. 舊有 `runCodexJson` 一律將結果包在 `{ resultJson: string }` 單一字串欄位內，當功能地圖輸出較大或包含 Markdown 圍欄／轉義問題時容易觸發 `AI 未回傳合法 JSON，原資料保留。`。
3. 功能地圖與工作區多處將 AI 分析中與錯誤橫幅固定嵌入頁面頂端（`inline`），且重載後會重新顯示過期失敗狀態，遮擋內容並造成誤判。

## 決策
1. **四步工作區引導與多 CLI／模型選擇**：將首次設定與「工作區設定」調整為「1. AI CLI → 2. 前端來源 → 3. 測試專案 → 4. 專案知識」四步；第 1 步支援切換 `Codex`、`Claude Code`、`Gemini CLI`，自動偵測各工具本機安裝與登入狀態，並透過無障礙 `Dropdown` 挑選本機快取／預設模型或輸入自訂模型，提供「測試 CLI 連線」與獨立「儲存 CLI 設定」按鈕，並在側欄與功能地圖顯示目前使用中的 AI 工具與模型摘要（不含秘密）。各工具皆以 `shell: false`、唯讀／停用工具或 MCP 的獨立隔離參數呼叫；知識圖片辨識維持僅 Codex CLI 支援，選用 Claude／Gemini 上傳圖片時明示拒絕。更新並延伸 [初始設定受控 Git 下載與守衛](2026-11-08-onboarding-clone.md)。
2. **`.local/ai.json` 非秘密暫存**：因第 1 步發生在選定獨立測試專案之前，新增排除 Git 的平台 `.local/ai.json` 保存非秘密的 `aiProvider`、`aiCli` 與 `aiModel` 偏好；待選定或重連測試專案時同步寫入該專案 `.env`，並維持 `process.env` > 測試專案 `.env` > 平台 `.env` > `.local/ai.json` 優先序。平台 `.local/workspace.json` 仍僅保存 `projectRoot`，維持與 [測試專案保存本機環境設定](2026-11-09-project-local-environment.md) 一致；此處不得保存任何 API key、token 或認證。
3. **嚴格 JSON Schema 與 3 秒浮動 Toast**：AI 分析工作改以結構化 JSON Schema 直接約束 Codex `--output-schema`（同時容錯解析 `resultJson` 與 Markdown 圍欄），並將工作區錯誤與 AI 辨識／分析狀態統一改採頂端置中浮動 Toast 呈現（分析中保留取消按鈕，完成／錯誤／通知於 3 秒後自動退場且不設關閉按鈕，頁面掛載時只接續仍在執行中的背景工作）。

## 影響
- 使用者在設定與日常操作中可明確得知與調整目前使用的 Codex CLI 與模型，並可在第 1 步預先測試可用性。
- 平台 `.local/` 新增 `ai.json`，但僅限非秘密工具路徑與模型名稱，已由根目錄 `.gitignore` 排除。
- 功能地圖與知識整理不再因舊失敗狀態卡住上方版面，亦大幅降低大份量功能樹輸出 JSON 失敗的機率。
