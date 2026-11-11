# 案例編碼依類型區分前綴

## 範圍
自動化 Flow Case 使用 FC，腳本 Test Case 使用 TC；沿用既有數字識別及歷史版本，FC 不重新編號；接續需求將目前有效 TC 案例依原號排序從 1 回填獨立號碼，之後穩定遞增。包含將既有案例的目前顯示套用新前綴；不含案例 AI API 資料串接。

## 影響檔案
- services/control-api/schema.sql
- services/control-api/src/seed.ts
- scripts/verify-tc-number-migration.mjs
- services/control-api/src/scriptCases.ts
- services/control-api/src/main.ts
- services/control-api/test/script-cases.test.ts
- docs/android-agent-authoring.md
- ARCHIFY-CURRENT-SPEC.md

## 資料庫影響
新增 scripts.test_case_number 與專用 sequence／唯一索引；目前有效 TC 案例依原 case_number 排序回填，FC 沿用原號，歷史版本 body 不改寫。回退保留新增欄位及序列，舊版仍可讀原 case_number。

## 風險
目前案例的 Flow 編碼前綴改為 FC；歷史快照仍可能為 TC。需更新 Control API 才生效。

## 設計文件同步
同步目前規格及 Agent 契約中的代碼格式與相容性說明。

## 領域
API、文件

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
npm run check --workspace services/control-api 通過。npm test 初次 226/228，兩項本機連線遭 EACCES；允許本機測試連線後重跑 228/228 通過，無 skipped。npm run docs:plans:index、npm run docs:check 與 git diff --check 通過。無前端元件變更，未部署 VM、未驗證實際畫面。

使用者要求套用既有案例後，嘗試透過 SSH BatchMode 連線 VM 127.0.0.1:2222；本機連線權限放行後，SSH 回覆 Permission denied (publickey,password)。目前缺少可用 SSH 登入授權，未上傳、未部署或變更 VM 資料。既有案例顯示驗證仍受阻。

使用者回報已執行更新後，實際透過 Chrome 重新整理並查看測試畫面：既有五筆自動化案例顯示 FC-000006、FC-000012、FC-000010、FC-000011、FC-000007；腳本案例「刪除帳號」仍為 TC-000008。已確認目前案例庫前綴更新生效，未執行案例、未修改歷史快照或保存截圖。

接續需求：第一筆 TC 改為 TC-000001。新增獨立 TC 序列並以 migration 回填有效案例，FC 與歷史快照不變。隔離 PGlite 執行完整 schema 已通過舊 TC-000008 對應新號 1、FC 與歷史保留、重複 migrate／刪除穩定及 sequence 不倒退；不代表 VM PostgreSQL 部署完成。

TC 獨立編號最終驗證：npm run check --workspace services/control-api 通過；npm test 初次兩項本機連線遭 EACCES，放行後 235/235 通過，無 skipped。node scripts/verify-tc-number-migration.mjs 以 NODE_PATH=.local/tc-number-migration/node_modules 的 PGlite 通過完整 schema 遷移及重複執行測試。npm run docs:plans:index、npm run docs:check、git diff --check 通過。本輪無前端 UI 變更；尚未部署 VM，未宣稱正式案例畫面已變更。

