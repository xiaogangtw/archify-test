# 畫面測試撰寫來源與資料依據

## 範圍
補強規劃、實作與網頁 skills：先追查前端、展開必要中間操作、記錄資料依據及集中提問；定向同步外部獨立測試專案的三份技能，不重寫案例或執行產品測試。

## 影響檔案
- test-project/skills/{plan-test-cases,implement-tests,write-web-tests}/SKILL.md
- test-project/README.md
- 外部獨立測試專案 `skills/` 對應三份 `SKILL.md`

## 資料庫影響
無。

## 風險
技能是撰寫指引，不是可自動證明來源正確或流程完整的 gate；同步只追加本次段落，保留既有客製內容，不讀出秘密。

## 設計文件同步
同步 test-project/README.md 的技能行為；未改 UI、路由、API、GraphQL payload 或 DB schema，不變更整合規格。

## 領域
測試框架、文件治理

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
- npm.cmd run docs:plans:index：通過，43 份計畫。
- npm.cmd run docs:check：通過，文件入口、連結、計畫結構與索引一致。
- git diff --check：通過；僅換行格式提示。
- 已核對範本三份新增段落，並定向追加至外部獨立測試專案對應三份技能，保留原有內容。
- 純技能與文件修改，未改案例、腳本或產品來源；未執行產品請求，技能對重寫結果的影響待使用者下一輪驗證。
