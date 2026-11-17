# 新測試專案交付 break-ui 技能

## 範圍
將使用者指定的 emilkowalski/skills break-ui 技能及 CATALOG.md 納入獨立測試專案範本，沿用初始化遞迴複製；補齊入口與專案限制。不執行 UI 壓力測試、不修改產品來源、不自動升級既有專案。

## 影響檔案
- test-project/skills/break-ui/SKILL.md
- test-project/skills/break-ui/CATALOG.md
- test-project/README.md
- test-project/AGENTS.md
- services/local-workspace/workspace.test.mjs
- docs/local-workspace.md
- ARCHIFY-CURRENT-SPEC.md

## 資料庫影響
無。

## 風險
上游要求修改元件與 dev toggle，須明示測試專案只讀產品來源，改以 Playwright fixture／mock 注入資料；既有初始化仍維持非覆寫。技能存在不代表已完成產品驗證。

## 設計文件同步
同步目前規格、本機專案文件與測試專案 README／AGENTS；不改畫面、路由、API 或 DB，無需新架構決策。

## 領域
測試框架、技能、文件

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
- `node --test --test-name-pattern='新專案完整交付 break-ui' services/local-workspace/workspace.test.mjs`：1/1 通過；實際初始化並核對兩份檔案，重新連接後自訂內容保留。
- `node --test services/local-workspace/workspace.test.mjs`：6/7 通過，目錄邊界項因沙箱不允許建立 junction（EPERM）失敗；於沙箱外以 `--test-name-pattern='目錄邊界'` 重跑，1/1 通過。其餘初始化、來源唯讀、型別與 HTTP 邊界均通過。
- 使用 Node 與既有 yaml 套件檢查技能 YAML、metadata、相對連結及無 emoji：通過。上游 `quick_validate.py` 因環境缺少 PyYAML 無法啟動，未宣稱該工具通過。
- `npm.cmd test`：21/22 通過，既有 `framework/case-narrative.test.mjs` 預期「後續業務結果尚未驗證」，實作為「後續結果未驗證」。以 `git show HEAD` 確認原版本已有差異，本次未修改報告框架或其測試；因此不勾選「可供審查」。
- `npm.cmd run docs:plans:index`、`npm.cmd run docs:check`：通過；結束前依最終計畫狀態重新執行。
- `git diff --check`：通過。未修改 UI，不需前端視覺 gate；未執行技能對產品的畫面壓力測試，技能交付不代表產品驗證通過。
