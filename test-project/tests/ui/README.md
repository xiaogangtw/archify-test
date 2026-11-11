# 網頁 UI 流程測試

案例、步驟、預期與範圍來源為 `test-cases/catalog.json`。固定案例 ID 對應 `archify-case` annotation；各 `.spec.ts` 保持獨立，不互相匯入。

所有畫面測試統一從 `../../support/web-test.js` 匯入 `test`、`expect` 與共用證據控制，多角色操作使用 `setUiRole`，關鍵等待使用 `uiWaitForResponse`；撰寫規範見 `skills/write-web-tests/SKILL.md` 與 `AGENTS.md`。

## 靜態檢查與執行

```powershell
npm run check:types
npm run check:ui-evidence
npm run flow -- --project=web tests/ui
```

實跑請先於 `.env` 設定本測試專案的 `WEB_BASE_URL`、`BFF_BASE_URL` 與相關測試參數，再執行：

```powershell
npm run test:ui
```

報告輸出於 `reports/ui`（已列入 `.gitignore`）。
