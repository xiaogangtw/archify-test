---
name: setup-android
description: 為獨立測試專案檢查與準備本機 Android SDK、含 Google Play 的模擬器及 Appium，處理平台偵測與裝置連線；只測 API／網頁時不需要使用。
---

# 準備本機 Android 環境

用於新電腦需要 Android 推播測試、缺少模擬器或平台找不到裝置時。先讀專案 AGENTS.md、README.md；日常網頁走 Playwright，不要求安裝 Android。本技能隨平台建立測試專案交付，存在技能不代表工具已安裝，不會在初始化時自動執行。

## 先檢查，沿用現有環境

確認 OS、CPU 架構、硬體虛擬化及可用磁碟。檢查 Node、Java、SDK 路徑、adb、emulator、Appium 與 UiAutomator2 的版本。只報實測結果，缺件列出官方安裝方式；使用者已要求設定環境時才安裝所需項目，不因閱讀技能下載大型工具或改動系統。

- 以 SDK 內實際完整路徑執行 adb version、emulator -list-avds、adb devices -l；若不在 PATH，不能因此判斷未安裝。
- SDK 可由 Android Studio SDK Manager 準備 platform-tools、Android Emulator 與 system image。Java 版本依所選驅動要求確認，不任意取代現有 JDK。
- 既有 AVD 先檢查，不重建、不 wipe data、不刪除快照或登入狀態。若需要 Google Play 而原映像沒有，另建新 AVD，保留原裝置。
- 使用與電腦 CPU 相容的 system image。建立裝置時選有 Google Play 標示的裝置與映像；Google APIs 不代表包含 Play 商店。AVD 名稱建議簡單英數與底線，例如 Archify_Play_35，實際 API level 依需求選，不固定只能 35。

## 官方安裝來源

- [Android Studio 下載](https://developer.android.com/studio) 與 [安裝教學](https://developer.android.com/studio/install)。
- [建立 AVD／Google Play 映像](https://developer.android.com/studio/run/managing-avds)。
- [Appium 安裝](https://appium.io/docs/en/latest/quickstart/install/) 與 [UiAutomator2、SDK／Java／裝置要求](https://appium.io/docs/en/latest/quickstart/uiauto2-driver/)。

以實際安裝的 Appium 執行 driver list --installed、driver doctor uiautomator2；驅動不存在才依官方方式安裝。框架目前已驗證的組合為 Appium 3.9.0／UiAutomator2 8.7.2，其他版本須核對 Node／Java／Android 相容性並驗證，不因 latest 名稱直接升級既有環境。不要將 npm ci 說成會安裝 SDK、Appium 或建立 AVD。

## 平台與測試專案分開設定

SDK、system image、AVD 磁碟、Appium 及帳號資料留在使用者電腦，不放進測試 Git。不得複製別人的 .android、憑證或 LINE 登入狀態。測試專案的 reports、.env 與 .local 應維持忽略版控。

| 設定位置 | 變數／內容 |
| --- | --- |
| Archify 平台的本機 .env | 必要時填 ARCHIFY_ANDROID_SDK；Appium 不在平台既定安裝位置時填 ARCHIFY_APPIUM_CLI，必須是實際 Appium JS 入口檔，不是 appium.cmd 或任意命令。變更後重啟平台。 |
| 獨立測試專案 .env | APPIUM_URL=http://127.0.0.1:4723；ANDROID_UDID 使用實際 emulator serial；ANDROID_APP_PACKAGE 由實際安裝確認，未準備先留空。 |
| 獨立測試專案 config/report.json | 平台選取的 androidSerial 與 screenshots；ANDROID_UDID 可覆寫選擇。截圖維持使用者選項，不為環境設定而開啟。 |

不要硬編碼原作者電腦路徑；修改 .env 保留其他值且不列印秘密。平台可偵測 SDK 環境變數與常用安裝位置，但非預設 Appium 必須明確設定。若只有獨立測試專案而沒有 Archify，仍可準備 Appium 與裝置，由 CLI 測試，不依賴平台。

## 驗收與交接

1. 安裝 SDK 後還要建立 AVD；平台重新「檢查環境」才會列出可啟動的名稱。
2. 使用者要求啟動環境時，在平台「測試報告 → 畫面測試 → 畫面測試設定 → Android 推播測試環境」啟動指定 AVD，或使用官方 emulator 指令。手機出現在電腦獨立視窗，不是網站內串流。
3. adb devices -l 確認指定裝置連線，使用 getprop sys.boot_completed 核對已開機；多台時一定指定 -s，不猜 emulator-5554。
4. 使用者要求檢查 Play 商店且裝置已啟動時，可唯讀查 com.android.vending 套件是否存在；不能僅靠 AVD 名稱宣稱已具備商店或已登入。Google 帳號、商店與 LINE 登入交由使用者自行完成，不索取密碼、驗證碼或代操作登入。
5. Appium 僅綁 127.0.0.1:4723，讀取 /status；不要停止占用埠的未知程序或重置別人的 session。環境檢查不需開啟 LINE、擷取手機畫面、建立產品 session 或發送推播。
6. 回報實際 SDK／AVD／serial、Appium／driver 狀態、哪些已驗證及待完成事項，不記錄帳號秘密。準備好後才轉到 skills/write-push-tests/SKILL.md；執行產品案例仍沿用使用者的實際授權。

新電腦預期流程：拉專案 → npm ci → 請 AI 使用本技能準備缺少環境 → 使用者完成帳號登入 → 平台檢查並啟動／選擇裝置 → 後續另行執行推播案例。設定技能不代表推播已驗收。
