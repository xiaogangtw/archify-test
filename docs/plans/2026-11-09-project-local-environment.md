# 測試專案本機環境設定

## 範圍
來源與環境保存測試專案 .env，初始化與重新連接補齊 Git 忽略。平台只保留排除 Git 的專案定位。

## 影響檔案
- services/local-workspace/
- test-project/AGENTS.md、README.md
- README.md、docs/local-workspace.md、ARCHIFY-CURRENT-SPEC.md

## 資料庫影響
無。

## 風險
.gitignore 不會取消已追蹤檔案；外部實際專案遷移需寫入權限。

## 設計文件同步
同步目前規格與本機設定文件，無 UI 變更。

## 領域
本機設定、安全

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
npm run test:workspace：48/48 通過；新增遷移測試後 node --test services/local-workspace/knowledge.test.mjs：3/3 通過。npm test：13/13 通過。npm run docs:check 與 git diff --check 通過。Windows 沙箱阻擋 .env rename／junction，已經授權於沙箱外重跑。既有外部測試專案已遷移並驗證重載來源一致，保留原有環境值且補入 AI 指引。無 UI 修改，未執行視覺驗證。
