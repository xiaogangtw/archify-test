> 舊架構參照：預設入口已改為本機報告閱讀器，請先讀 [README](README.md)。以下內容不代表新入口仍需 VM 或提供相關管理功能；舊服務保留供遷移。

# Archify 集中運行與 Android 執行器

## 雙機 Flow Case 與 LINE 開啟案例

新版需執行 `npm run android:pair` 部署 API，再重新啟動 `npm run dev` 載入支援雙機的 Windows worker；不能只做 DownloadOnly 更新程式。若建置已完成、僅啟動逾時，可診斷後使用 `-Resume`。此版本不需重裝 Appium、SDK，也不需要重建已登入的固定手機。

使用方式：先在模擬器分別啟動兩台固定手機並完成登入，再至案例撰寫選 Flow Case。雙機定義加 `actors: ["sender", "receiver"]`，每步用 actor 指定角色，兩邊各至少一個斷言。儲存後到 Android Appium 的 Flow Case 頁勾選案例，選擇不同的發送者、接收者手機，按一次執行。手機需自己預先開機；執行不會自動建立、關機或清除資料。混合批次中的單機案例使用發送者手機。

開啟 LINE 的最小案例：

```typescript
export const flow = {
  appPackage: "jp.naver.line.android",
  steps: [
    { name: "確認 LINE 已開啟並位於前景", action: "assertAppForeground" }
  ]
} as const;
```

執行器先用 mobile: activateApp 啟動 appPackage，再輪詢 current_package；此斷言不檢查登入首頁。LINE 須先安裝。套件來源為 LINE 官方 Google Play 頁：https://play.google.com/store/apps/details?id=jp.naver.line.android 。click/type/assertVisible/assertText 仍需實際定位器，交換案例不可拿前景檢查當作收錄成功。

本版提供程式與部署設定，尚未在目前 VM 部署，主機亦尚未安裝 Android SDK。其他人只需瀏覽器；只有管理者的 Windows 執行主機安裝 Android 工具。

## 架構

`npm run dev` 會先讀取 VM 的 SSH 招呼訊息，不能只以 NAT 2222 可連線判定 Ubuntu 已就緒；未回應時最多等90秒，再進入登入與後端健康檢查。若報 banner exchange timeout，故障發生在驗證密碼之前，不需要重新配對或建置。2026-10-28本機唯讀檢查曾見 VirtualBox guest heartbeat 中斷數十至302秒後恢復，SSH後來14毫秒回應；這是VM停頓證據，尚未確定主機排程／睡眠或虛擬化的根因，不能僅靠增加連線等待時間視為修復。

- Ubuntu VM：PostgreSQL、Control API、登入保護的 Archify 網頁、裝置指令佇列。
- Windows：Android SDK、虛擬裝置與 Android worker，透過既有 SSH 通道主動連 VM。
- 使用者：開網頁、以個別帳號登入、啟動與操作自己建立的裝置。Windows 不需要對外開放 ADB 或 Appium 連接埠。
- 這是共用工作區。所有登入者仍可檢視專案、設定與其他裝置畫面；不是多租戶隔離。Android 的輸入與停止以帳號限制，其他既有功能沒有新增細分角色權限。

## 1. 部署 VM 服務

若本機可連既有 `<vm-user>@127.0.0.1:2222` 的 `~/archify-test`，但配對檔不存在，可在 Windows 專案執行 `npm run android:pair`。腳本會排除本機依賴與秘密後打包後端程式、上傳、備份 VM 舊來源、執行新版 start-vm.sh 產生缺少的配對檔並重建後端，成功後才下載配對檔。過程會要求 Ubuntu 密碼，並可能短暫中斷後端；不刪除資料庫 volume。它不部署分享用網頁，仍需依下方步驟處理。

依 LOCAL-SETUP.md 將程式複製到 VM；這次也包含 `deploy/` 與新版 `apps/web/`，排除 node_modules、dist、.local、.git 與秘密檔。沿用既有資料庫 volume，不刪除資料。

在 VM 專案根目錄：

```sh
sh scripts/start-vm.sh
sh scripts/add-web-user.sh alice
sh scripts/add-web-user.sh bob
docker compose --profile share up -d --build web
```

帳號密碼由終端互動輸入，保存 bcrypt 雜湊於 VM `.local/web-users`。不把密碼放進命令列或聊天。預設網頁只綁 VM loopback 8080，API 保持 loopback 3001。

`start-vm.sh` 產生獨立 `.local/android-worker-token`，只授權 Android worker 路由。請從管理者自己的終端透過 scp 複製到 Windows 專案同名檔案；不要貼到聊天、瀏覽器、版本控制或寄給測試使用者：

```powershell
scp -P 2222 <vm-user>@127.0.0.1:~/archify-test/.local/android-worker-token .local/android-worker-token
```

## 2. Windows 準備模擬器

### 執行器連線復原

Windows 關機流程不再依賴 Android 裝置清單或核心服務健康檢查。先送出有五秒上限的一般關機要求，再等待最多十二秒讓程序退出與快照寫入；若失敗，改由 Windows 主機程序控制處理。強制停止前逐一核對 SDK 執行檔完整路徑、PID、程序建立時間、AVD 與連接埠，停止後確認程序消失，無法驗證時回報失敗並保留裝置紀錄。只處理目前使用者有權操作的已管理手機，不會批次關閉其他模擬器或重啟共用 ADB。

執行器重啟後，會從同一 SDK 的程序與固定手機目錄重新辨識裝置，因此 ADB 卡住時仍可提供關機入口。固定手機重新啟動使用 `-no-snapshot-load` 冷開機，保留 userdata 與已安裝 App，不載入舊的執行中快照；啟動時間可能比 Quick Boot 長。強制停止不保證保存尚未寫入的資料，不會刪除磁碟或自動重跑測試。確認已關機後，再從原固定手機啟動即可。

裝置就緒判斷同時檢查開機旗標及 Activity、Window 服務；僅有 `boot_completed=1` 不再代表系統可以操作。程序停止的 Windows 身分防護、故障裝置重新辨識與 Android 查詢失效時關機都有測試；仍需在實際封裝環境進行故障注入驗收。

執行器會分開回報 SDK 安裝狀態與 ADB 裝置連線狀態。已安裝 SDK 但 ADB 指令失敗時，不應提示重新安裝 SDK。

ADB 讀取失敗且沒有 Appium 工作進行時，執行器會在背景最多嘗試三次 `adb start-server`，每次再驗證裝置清單。單一指令上限八秒，失敗後依序等待五秒、十秒才再次嘗試；背景復原不阻塞控制連線的狀態回報。成功讀取健康狀態後會重設重試次數。缺少 SDK、模擬器清單讀取失敗不會觸發 ADB 自動復原。

自動復原不執行 `kill-server`、不清除手機資料，也不重送任何測試或手機操作。三次仍失敗時，頁面保留手動「重試連線」入口；手動重試會重啟共用 ADB，因此仍須通過既有的工作與裝置擁有權檢查。

終端的 `[Android health]` 記錄包含復原嘗試次數、固定錯誤代碼與恢復事件，不記錄配對憑證或完整手機指令。`npm run android:check` 會輸出 SDK 路徑、虛擬裝置清單與故障原因；故障時結束碼非零，供封裝啟動器檢查。

以上為執行器的故障處理機制，尚不代表已完成安裝包驗收。交付前仍須在乾淨 Windows 主機驗證首次安裝、授權、硬體加速、重新開機、連接埠衝突、權限限制、離線與更新流程。

Android Studio 不是必要條件，可選擇其中一種方式：

- 圖形介面：從 [Android 官方網站](https://developer.android.com/studio) 安裝 Android Studio。SDK Tools 勾選 Android SDK Command-line Tools (latest)、Android Emulator、Platform-Tools。
- 只裝 SDK：從同一官方下載頁的 Command line tools only 取得 Windows 工具，將 bin、lib 等內容放在 SDK 根目錄的 `cmdline-tools/latest/`，另外準備相容的 Java JDK 並設定 JAVA_HOME。SDK 根目錄可用專案 `.local/android-sdk`，或透過 ANDROID_HOME 指向其他位置。

兩種方式都需要 Android Emulator、Platform-Tools、系統映像與建立好的 AVD，不能只下載命令列工具壓縮檔就直接啟動手機。下方準備腳本會安裝所需元件並可建立 AVD。

啟用 Windows Hypervisor Platform 後依系統要求重開機。本專案不更改 Windows 功能，也不代替管理者接受 SDK 授權。

```powershell
npm run android:setup -- -CreateDevice
npm run android:check
```

需要從 Play 商店下載 LINE 等 App 時，請另外建立 Google Play 系統映像：

```powershell
npm run android:setup -- -CreateDevice -PlayStore
```

這會下載 `system-images;android-35;google_apis_playstore;x86_64` 並建立 `Archify_Play_API_35`，保留原本不含 Play 商店的 `Archify_API_35`。接受授權、登入 Google 與 App 帳號都由使用者自行操作。下載完成後在 Archify 重新整理，選擇新的 Play 裝置。現行唯讀工作階段停止後，不保留當次安裝與登入資料。

手機畫面支援滑鼠或觸控拖曳：按住、拖曳後放開，送出一個 Android swipe；點擊仍是 tap。畫面取得焦點後可用方向鍵替代滑動，Enter／Space 點擊中央。畫面黑邊不接受操作，拖出畫面時終點限制在畫面邊界，取消手勢不送出。

準備腳本會互動顯示 SDK 授權、下載 API 35 系統映像，建立不存在的 `Archify_API_35`，並執行硬體加速檢查；不覆蓋現有 AVD。自訂 SDK 路徑可設 ANDROID_HOME。也支援自行在專案 `.local/android-sdk` 安裝 SDK。

保持 LOCAL-SETUP.md 的 SSH 通道，再啟動：

```powershell
npm run android:worker
```

既有 `npm run dev` 在 Android 配對檔存在時也會啟動 worker，兩者擇一，避免同時啟動兩個。Appium 可另行安裝在 Windows；目前頁面僅檢查固定 loopback 4723 的服務狀態，沒有建立 Appium 測試工作階段。

## 3. 提供其他人使用

先以 SSH 通道檢查部署（只供管理者）：

```powershell
ssh -N -p 2222 -L 127.0.0.1:8080:127.0.0.1:8080 <vm-user>@127.0.0.1
```

開 `http://127.0.0.1:8080`，登入後進入 Android Appium。開放其他人只用網址時，需設定 VM 可達網路、DNS 與 HTTPS。在 VM 的 `.env` 加上自己的實際網域：

```dotenv
ARCHIFY_PUBLIC_HOST=archify.example.com
ARCHIFY_WEB_ORIGINS=https://archify.example.com,http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:4173
```

上面的網域只是範例，不能直接使用。DNS 指向部署主機，將 80/443 轉送到 VM 後：

```sh
docker compose -f compose.yaml -f deploy/https.compose.yaml --profile share up -d --build control-api web https
```

Caddy 申請與續期 TLS 憑證；是否成功仍取決於實際 DNS、網路與憑證服務，尚未部署驗證。也可以使用公司既有 HTTPS 反向代理。不要直接公開 Control API 3001、ADB、Appium 或 worker token。分享入口會封鎖 `/internal/`，覆寫瀏覽器送來的帳號標頭，僅轉送已認證的帳號身份。

## Scrcpy 版本更新（2026-10-28）

### Appium 與統一案例撰寫

此Windows執行主機已安裝Appium 3.9.0與UiAutomator2 8.7.2到`.local/appium`，並以獨立驗證手機完成實測；換電腦首次執行 `npm run android:appium:setup` 安裝。Java與Android SDK沿用原安裝。下次 `npm run dev` 的Android worker會自動啟動只綁127.0.0.1:4723的Appium，不需要另外開終端。服務未安裝／啟動失敗會回報未就緒，不會假裝執行成功。

部署新版API：在Windows專案目錄執行 `npm run android:pair`，完成後重啟 `npm run dev`。這次增加android_runs資料表與Flow Case解析，必須更新VM，不能只靠前端重新整理。沒有免密SSH時需要管理者在終端輸入Ubuntu密碼，不要將密碼貼到聊天。

使用方式：案例撰寫選「Flow Case · 畫面流程」→填名稱及有效的 `export const flow = {appPackage,steps} as const` →儲存→Android Appium的Flow Case頁勾選版本與手機→執行所選案例／批次執行。系統設定範例已實測；其他App須改成實際package與定位器。資料Test Case仍走原執行方式。Appium執行期間不要同時操作該手機；結果與來源快照保存於VM資料庫。批次目前由開著的頁面按序送出，關閉頁面不會繼續送剩餘案例，但不取消已送出的案例。

第一版支援單手機的click、type、assertVisible、assertText、back，元件id／accessibility id／xpath；不執行任意TypeScript，不會重設、卸載或清空App。多手機交錯流程、WebView、取消正在跑的案例與大規模佇列尚未接入。舊白話Flow草稿保留，可手動移入統一編輯器調整。不要將原始密碼或Token寫入腳本。

### 固定測試手機

新版預設提供「固定測試手機」：填名稱建立，再從同一筆記錄啟動。每台建立獨立 Google Play AVD 與可寫入資料分割區；「關機並保留資料」不刪除 App、登入或手機紀錄。另保留收合的臨時模擬器入口，臨時裝置的資料仍不保存。固定手機不使用 `-read-only` 或 `-wipe-data`；保留 `-no-snapshot-save` 只是不保存 RAM 快照，與磁碟使用者資料分開。

VM PostgreSQL 的 android_profiles 保存手機 UUID、名稱、擁有者與準備狀態；Windows `.local/android-devices` 保存手機目錄與本機識別紀錄，Android AVD索引由SDK工具維護。這些檔案包含App及帳號工作階段，不能加入Git或分享給下載專案的人。worker重啟會核對本機紀錄及ADB實際AVD名稱，再由VM已保存的歸屬恢復操作權；任意外部模擬器不會自動取得歸屬。每台固定手機只允許一個執行個體；多帳號請建立不同手機。

固定手機在worker結束時保留運行，正常關機請使用網頁的「關機並保留資料」。不需要另外儲存LINE密碼；LINE仍可要求重新驗證。這版不提供登入帳號複製、快照、重設或刪除功能。現有臨時手機不會自動轉換，也不保證可搬移其登入資料。

部署需更新VM API與Windows worker：`npm run android:pair` 完成後，重新啟動 `npm run dev`。不需重裝SDK；但建立手機需要既有Java、Command-line Tools及Android35 Google Play映像。舊VM尚未更新時介面會顯示未啟用，新增按鈕停用，避免假裝可保存。

新的觀看器已改用 H.264 影片與持續觸控連線，取代下面舊版 PNG 串流說明。Windows worker 首次啟動自動下載官方 Scrcpy 3.3.3 server，依 `services/android/scrcpy-manifest.json` 驗證 SHA-256，存入被 Git 忽略的 `.local/scrcpy`；不需要另裝桌面版 scrcpy，也不需要 root、minitouch 或開放 ADB 給瀏覽器。來源與授權為 [Genymobile scrcpy / Apache-2.0](https://github.com/Genymobile/scrcpy/tree/v3.3.3)。

既有專案更新：先在 Windows 專案目錄執行 `npm install`，再執行 `npm run android:pair`，輸入 Ubuntu 密碼。成功後重新啟動 `npm run dev`，以 Chrome／Edge 開網頁；不需重裝 SDK 或重建 AVD。配對腳本會備份 VM 來源、同步前端與後端，重建 API；若分享網站原先在執行，也會更新網站及 WebSocket 代理設定。資料庫、SDK、`.env` 與秘密檔不會上傳覆寫。單純啟動 dev 不會更新 VM 映像。

若更新已完成，但最後顯示 `Pairing file download failed`，執行 `npm run android:pair -- -DownloadOnly`，只透過 SSH 重取配對檔，不重新上傳、備份或建置。下載失敗或內容不符時會保留原有配對檔，內容不會印到終端。

配對部署會依序建置 API、Launcher、Runner，降低小型 VM 同時建置的資源壓力，並輸出各建置步驟。若三個映像都已建置完成、只有啟動等待失敗，先執行 `npm run vm:diagnose`；尚未就緒時可執行 `npm run android:pair -- -Resume`，只接續啟動與配對下載，不重新上傳或建置。若診斷已顯示 healthy / ready，直接用 `-DownloadOnly`。SSH 連線加入存活檢查，但這不保證 VM 停頓時能完成；不可把健康檢查逾時當作部署成功。

部署與 Resume 現在透過執行更新的同一條 SSH 連線接收配對檔，不再於服務健康後建立第二條下載連線。以每次隨機標記區分私密回應，PowerShell 消費內容而不寫到終端；只有 SSH 成功且內容格式有效才覆寫本機配對檔。DownloadOnly 仍可獨立取回，不重新建置。`scripts/test-pair-android.ps1` 以模擬 SSH 驗證單連線、內容不顯示、下載成功，以及連線失敗／內容無效／收到內容後失敗時保留原檔；不代表實際 VM SSH 已驗收。

執行器重啟後，舊裝置可能失去目前工作階段歸屬而僅供檢視。主機管理者可先執行 `npm run android:stop -- emulator-5554 --check` 確認指定裝置，再執行 `npm run android:stop -- emulator-5554` 回收它；把序號換成實際要停止的裝置。此工具只在執行主機使用，僅接受模擬器與 Archify_ AVD，會結束該唯讀裝置工作階段的 App 資料，不會替瀏覽器使用者取得別人的操作權。一般新工作階段仍從網頁啟動與停止。

本機用 localhost，對外分享必須使用 HTTPS 並設定 `ARCHIFY_WEB_ORIGINS`；登入閘道及原本的 SSH 通道保留。若看到「影片通道未就緒」，先確認 VM 及 Windows worker 版本都已更新。可執行 `npm run android:probe -- emulator-5554`，只讀取影片封包驗證本機 Scrcpy，沒有保存畫面；它不能替代 VM 中繼驗收。

畫面上限1024像素、編碼上限30fps及3Mbps是設定值，不是量測保證。實際延遲還包含模擬器、SSH、VM 排程、網路與瀏覽器解碼。此升級不宣稱10ms操作延遲，也不會把人工操作當作 Appium 測試通過。

## 模擬器效能設定

Windows worker 啟動模擬器時預設傳入 `-gpu host`，避免 headless 自動選擇落入 CPU 軟體繪圖。實際是否使用主機 GPU 仍需以 `adb shell dumpsys SurfaceFlinger` 的 GLES renderer 確認；未驗證的顯示驅動可能不相容。如果新啟動的手機出現黑畫面或 GPU 啟動錯誤，可在啟動服務的 PowerShell 設定 `$env:ARCHIFY_ANDROID_GPU='auto'`，再正常啟動服務與手機。也支援 `software` 作為明確的相容備援；非支援值會拒絕啟動，不拼接額外參數。

此設定需要重啟 worker 並正常關閉、重新啟動手機才會套用；不重建 AVD、不清除帳號資料，不對正在執行的手機強制切換 GPU。改變繪圖設定可能無法沿用原 Quick Boot 快照，需要完整開機。記憶體與解析度不自動增加或修改。

新 Appium 工作階段停用視窗動畫，設定 `waitForIdleTimeout=1000`，避免持續動畫讓每次定位都耗盡原本的預設閒置等待。元素出現、可操作與結果斷言仍使用原有等待及期限，不將閒置等待降為零、不放寬斷言，也不自動重送動作。API 26 以上的視窗動畫還原依 UiAutomator2 driver 的工作階段清理處理。Flow、Agent 探索與提示擷取共用此策略，仍須以實際案例驗證效益。

## 目前操作與限制

若 API 已出現 Server listening 或回應過 200，但 Compose 仍判定不健康，先執行 `npm run vm:diagnose`，不必重新 pair／build。這是唯讀 SSH 診斷，會列出 VM 資源、實際 healthcheck 指令、Docker health 歷史退出碼與輸出、主機 API 回應及最近 API 紀錄。不要只憑 Starting／Healthy 文字或單次 API 啟動紀錄推定服務當下健康；也不要靠停用健康檢查掩蓋問題。

若 API 紀錄顯示 `Cannot read package config /app/package.json: permission denied`，是映像內程式檔權限不足，不是 JSON 格式錯誤。新版 API／Runner 映像會在切換到非 root 帳號前設定程式檔讀取權限，並在建置時以非 root 帳號測試；Launcher 也設定供 Compose 的數字 UID 讀取。設定僅作用於映像內程式檔，不更改 VM 的秘密檔權限。既有映像需以 `npm run android:pair` 同步並重建；單純 `npm run dev` 不會重新建置映像。

權限修正僅處理來源與根套件檔，API 來源遍歷會跳過 node_modules；不再對整個 /app 或 /opt/runner 遞迴 chmod，以免 Docker overlay 為大量依賴檔產生昂貴的新圖層。調整後的建置時間尚未在實際 VM 量測。

- Web Playwright、Android Appium 分開導覽；舊 E2E 入口相容到 Android。
- Android 預設為模擬器工作區，流程草稿在另一個分頁。舊的混合平台草稿不搬移、不刪除，各頁只顯示對應平台。
- 可選已有 AVD，啟動 1–4 個獨立唯讀工作階段；會先檢查硬體加速、裝置數與連接埠。上限不是主機效能保證，目前機器應從單台開始驗證。
- 畫面由 Windows worker 持續擷取 PNG，透過 VM 的 SSE 連線傳送到瀏覽器；不需按更新，提供暫停／恢復。離開或隱藏頁面會中止觀看，無人觀看時不擷取影格；只保留記憶體資料，不保存圖片。這是連續圖片影格串流，不是高幀率編碼影片／WebRTC。可點擊與使用 Android 導覽；尚未提供文字輸入與 APK 上傳安裝。
- 不操作實體手機。外部啟動或工作階段重配對前的模擬器只供檢視。停止 Android worker 會結束其啟動的模擬器。
- 裝置指令採記憶體佇列、串行派送與 30 秒期限。斷線或逾時標示結果未知，絕不自動重送；控制服務重啟後不恢復這些操作。不是持久測試執行佇列。
- 白話測試流程仍是瀏覽器本機草稿，沒有自動生成／執行 Appium 或 Playwright 腳本，不會產生測試通過結果。
