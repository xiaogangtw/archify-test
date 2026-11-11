# Mac 與 iOS 前置環境

文件版本：1.0

最後更新：2026-11-02

## 修訂紀錄

| 版本 | 日期 | 說明 |
| --- | --- | --- |
| 1.0 | 2026-11-02 | 新增 Mac 唯讀環境檢查與 Simulator／iPhone 分工；尚未提供可連線的 iOS Worker，未改路由、守衛、導向、API、GraphQL payload 或 DB schema。 |

## 只有 Mac 可以做什麼

可以先用 Mac、Xcode 與 iOS Simulator 開發自有 App 的 iOS 測試。App 需要針對 Simulator 建置的版本，不能把真機 ipa 或 App Store 的 App 視為可直接安裝的 Simulator build。使用多個 Simulator 可先驗證自有 App 的雙角色邏輯，但不代表已驗收正式 LINE 的登入、收件或 LIFF。

正式 LINE／LINE 內 WebView、真實帳號接收端、真機通知及硬體相關驗收，另備 iPhone 與合法測試帳號；不能把 Mac 上的 LINE 桌面程式當成 iPhone 版，也不能用外部 Safari 的結果代表 LINE 內 LIFF。現階段不需要為了撰寫後端與前端基礎先買 iPhone。

Apple 的[模擬與實體裝置執行說明](https://developer.apple.com/documentation/Xcode/running-your-app-on-simulated-or-physical-devices)及[發行版本測試說明](https://developer.apple.com/documentation/Xcode/testing-a-release-build)區分兩類環境；Appium 的[平台支援說明](https://appium.readthedocs.io/en/latest/en/about-appium/platform-support/)也區分 Simulator `.app` 與真機簽署 `.ipa`。

## 唯讀檢查

在 Mac 上的本儲存庫根目錄執行：

```sh
npm run mobile:mac:check
```

檢查呼叫 `xcodebuild -version`、`xcrun simctl list devices available --json`、`appium --version` 與 `appium driver list --installed --json`。只列出可用 iOS Simulator 的 UDID、名稱、runtime 與狀態；不讀帳號、不啟動裝置、不安裝 App、不建立測試 session，也不操作手機。各指令最多等待 20 秒。

`ready:true` 只表示上述工具和至少一個可用 Simulator 已確認，不表示 Archify iOS Worker 已連線、驅動版本已相容、App 已可安裝或案例已通過。Windows 會回 `ready:false` 並以非零結束，這是平台拒絕，不是 iOS 整合通過。未安裝工具、JSON 無法解析或清單沒有 iOS Simulator 都不回報就緒。

需要先在 Mac 完成 Xcode 開發工具設定、下載 iOS runtime、建立 Simulator，並依 Appium 官方設定安裝 XCUITest。此文件不自動安裝工具、不接受秘密或私鑰，也不開放裝置控制連接埠。

## 目前程式邊界

`services/control-api/src/mobileEngine.ts` 封裝既有 Android Appium Agent 觀察、操作、驗證及釋放；裝置取得、擁有權、取消後不再派送、雙機鎖與 Runner 交接仍交給既有 Android 執行器。沒有第二套裝置鎖，沒有改寫歷史 Android Flow。

平台目標契約採 `schemaVersion:1`：Android 使用 `deviceId` 與 `target.appPackage`，iOS 使用 `deviceId` 與 `target.bundleId`，互不改義。這是目前內部契約，尚未新增接受 iOS 的建立任務路由；Android adapter 對 iOS 目標明確拒絕。

尚未完成：agent-device 固定版本與相容性比較、Mac Worker 配對及派送、iOS observe／perform／verify、跨平台租約、iOS 畫面串流與延遲量測。未接入前不顯示 iOS 已可執行，不在 Control API 執行模型生成的任意程式。

2026-11-02 已重新讀取 agent-device 官方原始碼，其 main 分支為開發版本，尚未鎖定發布版，因此沒有直接安裝 latest 或將 README API 當作已驗收整合。後續需依[官方專案](https://github.com/callstack/agent-device)固定版本，再在 Mac 實測。只有 Mac 時先以自有 Simulator App 驗收；LINE 代表案例留待 iPhone。
