# Appium 報告失敗證據

## 範圍
報告網頁與 PDF 顯示失敗子步驟路徑、動作、角色、耗時及遮蔽後 Appium 錯誤訊息；不自動重跑、不推測偶發失敗根因。

## 影響檔案
- services/android/appium.mjs
- services/android/flow-engine.mjs
- services/control-api/src/androidReport.ts
- services/control-api/src/androidExecution.ts
- apps/web/src/features/testing/QualityReports.tsx
- apps/web/src/features/testing/reportPdf.ts

## 資料庫影響
無 migration；沿用 android_runs JSON，舊紀錄無法補回已丟棄錯誤。

## 風險
Driver 訊息可能帶資料，必須遮蔽命令字串參數、引號內容、URL 及常見秘密，不保存完整回應或 stacktrace。訊息長度受限，不能保證任意第三方文字的語意遮蔽。

## 設計文件同步
同步目前規格、Appium 能力文件與前端 README，說明部署順序及舊紀錄限制。

## 領域
前端、API、Android

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
- 前端 build 及 Control API check 通過；建置仍有大型 chunk 警告。
- Android 針對性測試 46/46 通過；新增 transport／遮蔽／巢狀失敗測試 3/3 通過；報告轉換 3/3 通過。
- 完整 Android 103/105：Windows process guard 及 temp catalog rename 受環境權限影響；完整 API 236/238：兩項 localhost 連線測試 EACCES。不宣稱全數通過。
- 報告 fixture 實際以 Chrome 檢視 1000px 與 320px，手機無水平溢出並操作收合／展開，未儲存截圖。
- DS_REQUIRE_BROWSER=1，展開失敗證據的 reports-gate：states（20 states）、axe（0 violations）、responsive、keyboard、target size、mobile first、overflow、reduced motion、intent、slop 全部退出 0；intent 識別 0，不擴張結論。token 未變更，沿用 Tailwind；states 量測實際文字對比。
- 修改的三份前端來源 hardcode、emoji 及 QualityReports native select 檢查通過。
- verify-execution-ui 的 HTTP 模式遭 ERR_NETWORK_ACCESS_DENIED；增加 UI_FIXTURE_FILE=1 的離線 fixture 模式（仍使用同一元件及斷言），既有下載斷言遭 Chrome canceled 阻擋，未將其改成通過。
- docs:plans:index、docs:check、git diff --check 通過。尚未驗證真實手機、VM 部署、完整原生 PDF 下載及最終 PDF 視覺，不勾選可供審查。
- 本次保留先前案例列修改，未還原使用者工作。
