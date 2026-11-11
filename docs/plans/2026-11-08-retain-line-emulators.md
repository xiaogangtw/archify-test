# 保留指定 Android 模擬器並核對 LINE

## 範圍
保留使用者指定的兩台 Archify_Device_8a5173e83fe142fb8c58390fb6aefeea 與 Archify_Device_870246a9dca249d39583f85c17674a98，唯讀查 LINE 套件；其他 AVD 以封存註冊檔移出清單，保留磁碟資料以便還原。不開 LINE、不截圖、不發推播、不清除裝置。

## 影響檔案
使用者 .android/avd 的指定註冊檔、本機 .local 封存紀錄；不修改產品程式。

## 資料庫影響
無。

## 風險
執行中裝置須先核對，不能任意移動磁碟或刪除鎖定檔；封存只移動已核實的註冊檔，保留還原資訊。

## 設計文件同步
本機環境維護，不改平台設計、路由、API 或 schema；本計畫保存操作證據，毋須改現況規格。

## 領域
Android、本機環境

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [x] 可供審查

## 驗證證據
初查 7 個 AVD；沙箱 adb 權限不足，改以一般本機權限讀取狀態。

- 使用者授權啟動兩台指定 AVD，8a5173 首次 ADB 未授權，由使用者允許後重新唯讀查詢。emulator-5554 對應 Archify_Device_8a5173e83fe142fb8c58390fb6aefeea；emulator-5556 對應 Archify_Device_870246a9dca249d39583f85c17674a98，皆回傳 jp.naver.line.android 與 com.android.vending 套件。只證明已安裝，不代表已登入或業務驗收。未開啟 App、截圖或發推播。
- 其他五台只移動 .android/avd/*.ini 至平台 .local/avd-registry-archive/2026-11-08-retain-line；manifest.json 保存逐一原路徑與封存路徑，完整路徑預先核對。原 AVD 磁碟未移動或刪除。還原時依 manifest 將指定 .ini 移回原位置，拒絕覆寫任何既有註冊檔。
- 最終 emulator -list-avds 只列兩台指定裝置。兩台保持啟動；未驗證其餘封存裝置的 LINE 安裝，也未宣稱只有這兩台安裝。
- 首次啟動等待腳本在裝置尚未就緒時遇 null.Trim，後續以獨立指令取得有效結果，不影響磁碟或設定。
- 本機環境維護不改程式／設計契約；npm 入口缺少 npm-cli.js，未修改環境；直接執行等價 node scripts/docs-plans-index.mjs、node scripts/docs-check.mjs 及 git diff --check 通過。

## 使用者追加：查核其餘五台並刪除無 LINE 的資料
先逐台啟動，唯讀查完整套件清單與 LINE；確認沒有才刪除精確核對的 AVD 磁碟資料，查到 LINE 或驗證失敗者保留。不清除指定保留的兩台，不以查詢失敗冒充未安裝。

- 已逐台以 read-only／no-snapshot-save 啟動並核對 AVD 名稱，開機完成後使用 pm list packages --user all 成功讀取完整套件清單。Archify_API_35：244 個套件；06c186：241；0f7bec：241；f925be：244；Archify_Play_API_35：241，均未列出 jp.naver.line.android。每台查完關閉，未啟動 LINE 或截圖。
- 五台皆 verified=true、lineInstalled=false、stopped=true 後，先獨立預檢所有精確刪除路徑、不得碰保留名單、無 reparse point、無執行中程序及註冊已封存，再依使用者授權刪除兩個 .android/avd/*.avd 及三個 .local/android-devices/精確名稱目錄。沒有跨 shell 操作，未刪共用 SDK／system image。
- 封存的五份 .ini 也已刪除；line-verification.json 與 deleted-data.json 保存安裝查詢及實際刪除結果。這五台資料不再能由先前註冊封存還原；前段還原敘述為刪除前歷史狀態。保留兩台的 .ini hash 未變且磁碟路徑仍存在；最終 emulator -list-avds 只剩指定兩台。
- node scripts/docs-plans-index.mjs、node scripts/docs-check.mjs 與 git diff --check 通過。
