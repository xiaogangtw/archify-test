# 雙機案例編輯驗證

日期：2026-10-30。範圍為 apps/web 編輯入口、Android Agent 任務、局部改稿及既有雙機 Appium 驗證入口。

## 行為

- 編輯時指定 A 發送者與 B 接收者，查看 A／B 會同步右側 DeviceViewer 與 AI 的目前手機；單機仍可使用。
- 已啟動的 AI 任務收到切換後，等待已送出的單次操作完成，丟棄尚未送出的舊決策，清除目前 XML／圖片並要求重新觀察。快速切換通知依順序送出。
- AI 能切換已配對角色；成功操作的 replayStep 保留 actor。configure 支援 actors，整個 patch 仍須滿足完整流程格式和兩角色斷言。
- 雙機 verify 檢查所有權、不同手機、就緒與忙碌狀態，驗證期間鎖定兩台手機。沒有執行結果不宣稱通過。

## 驗證

- services/control-api `npm run check`：通過。
- apps/web `npm run build`：通過，Vite 仍提示既有大型 chunk。
- Android Agent、執行與撰寫測試：20 tests，20 pass，0 fail。包括單機改雙機、接收者操作紀錄、思考途中使用者切換、不同使用者拒絕、重複手機拒絕、雙機驗證命令及兩台鎖定。
- `scripts/verify-dual-authoring-ui.mjs`：PASS editor A/B pairing, right-phone switching, AI request role/bindings, active task switch notification, mobile overflow. Mock API only.
- Python gates 使用 PYTHONUTF8=1：lint_hardcodes 99/99，無硬編碼；check_no_emoji 99 個檔案，無 emoji；lint_native_select 60/60，無原生 select。
- 從目前 Tailwind 共用色票對應的本機 tokens fixture：validate_tokens 1/1，11 tokens；validate_contrast 所有 required light pairs 通過。固定淺色，不檢查暗色。
- Render gates 指向 `.local/dual-authoring-ui/editor.html`，DS_REQUIRE_BROWSER=1，使用本機 Chrome：verify_states 62 element-states 通過；axe_audit 0 violations；verify_responsive 280/320/414px、1.25 倍字級通過；verify_keyboard 15 controls 通過；verify_target_size 28 targets 通過；verify_mobile_first 通過；lint_intent 通過；slop_tells --strict 通過；verify_overflow 通過；verify_reduced_motion 通過。封閉的下拉選單不計為 composite widget，配對選擇另由互動測試操作。
- 已使用記憶體截圖目視查看配對及查看 B 狀態，沒有保存截圖。

## 限制

所有新增互動測試使用模擬 API，未替使用者操作 LINE、發送訊息或點開名片，不代表雙機業務驗收或 VM 部署完成。功能需同步更新前端與 control-api；沿用現有支援雙機的 Windows worker。

另外嘗試舊 `verify-unified-flow-ui.mjs`，原 fixture 只模擬 /llm，但編輯入口已預設使用 Agent 任務，等待舊回覆會逾時；暫時關閉觀察後又遇到既有批次完成選擇器及舊結果文字斷言不符。未將此舊腳本宣稱為通過，亦未修改它以掩蓋失敗。本次雙機編輯行為以新測試、既有後端測試及上述設計 gates 驗證。
