# 舊架構操作手冊（歷史參照）

以下不是預設啟動流程。僅供既有資料遷移與舊服務維護參照；請先讀[目前操作手冊](../README.md)。

# Archify Test 操作手冊

> 文件入口：[文件總索引](../docs/README.md)；Agent 規則：[AGENTS.md](../AGENTS.md)。

以 **Windows 開發電腦 + Ubuntu VM** 配置為主，依實際環境自行替換主機路徑與帳號。功能細節以 [目前規格](../ARCHIFY-CURRENT-SPEC.md) 為準。

## 快速索引

- [架構與維護地圖](../docs/architecture.md)：修改入口、模組責任、耦合與後續拆分順序；`npm run architecture:report` 可重跑來源盤點。

- [Mac 與 iOS 前置環境](../docs/ios-mac-setup.md)：Mac 可先用自有 App 的 Simulator build；正式 LINE 手機流程另需 iPhone，目前未接入 iOS Worker。

- [集中分享網頁與 Android 模擬器部署](../ANDROID-DEPLOYMENT.md)：VM 提供平台，Windows 主機提供 Android 執行器；測試使用者只需要瀏覽器。首次安裝與實際 VM 部署仍需管理者依文件完成。

- [每天啟動服務](#每天啟動服務)
- [安裝環境與 Docker](#安裝環境與-docker)
- [固定網址與連線埠](#固定網址與連線埠)
- [第一次建立 VM 服務](#第一次建立-vm-服務)
- [更新程式到 VM](#更新程式到-vm)
- [匯入與背景整理](#匯入與背景整理)
- [常見錯誤排查](#常見錯誤排查)
- [停止服務與備份](#停止服務與備份)

## 每天啟動服務

### 單一終端啟動（建議）

完成首次安裝、VM 部署及 worker token 配對後，先在 VirtualBox 開啟 Ubuntu VM，再在 Windows 專案根目錄執行：

```powershell
npm run dev
```

此指令使用目前環境的 `<vm-user>@127.0.0.1:2222`，在同一個終端啟動 VM 後端、SSH API 通道、Windows 網頁與 Agent 橋接。SSH 若要求密碼，直接在該終端輸入 Ubuntu 密碼。API 就緒後才啟動網頁與橋接；官方 CLI 仍需事先完成登入。

啟動時先在 VM 容器內確認 API 健康，再確認本機轉送；不把容器 Started 或 SSH 埠可連線當成後端就緒。失敗會自動列出容器狀態與最近 80 行 API 紀錄，停止啟動本機橋接。Android 已配對時同時啟動 Android worker，不必另開一份；Appium 服務目前仍獨立啟動，不在本指令內。

容器健康後還會檢查 VM 主機 `127.0.0.1:3001`，確認 Docker 發布的埠也可用；此步驟失敗會列出埠映射與主機 API 回應。啟動腳本以編碼傳送給遠端 shell，避免 Windows SSH 對多行引號再次處理。Ubuntu 需有 curl。

開啟 http://127.0.0.1:5173，保持這一個終端開啟即可。按 `Ctrl+C` 停止本次網頁、橋接與 SSH 通道，VM 容器繼續執行。啟動失敗會停止本次建立的本機程序，不會停止既有 VM 容器。不會自動建立或覆寫秘密，也不會重新建置後端。

若提示 3001 或 5173 被占用，先在原本的終端停止舊通道／網頁再重試。VM 未開機、首次部署或配對未完成時，請依下方步驟設定。以下分開啟動步驟保留供排錯使用。

完成首次設定後，照下面順序操作。標示「保持開啟」的終端不要關閉。

### 1. 啟動 VM 與後端

先在 VirtualBox 啟動 Ubuntu VM，再到 **Windows PowerShell**：

```powershell
ssh -t -p 2222 <vm-user>@127.0.0.1 'cd ~/archify-test && docker compose up -d postgres control-api launcher && docker compose ps'
```

`-d` 代表容器在背景執行，指令完成後可關閉這個終端；VM 必須保持開機。

### 2. 建立 API 通道（保持開啟）

另開一個 **Windows PowerShell**：

```powershell
ssh -N -p 2222 -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -L 127.0.0.1:3001:127.0.0.1:3001 <vm-user>@127.0.0.1
```

登入後沒有文字、游標停著是正常的。這條通道讓 Windows 的 `127.0.0.1:3001` 連到 VM 的 API。已有正常通道時不要重複開。

### 3. 啟動網頁（保持開啟）

另開一個 **Windows PowerShell**：

```powershell
cd '<repo-root>'
npm.cmd run dev --prefix apps/web -- --host 127.0.0.1 --port 5173 --strictPort
```

開啟 [Archify Test](http://127.0.0.1:5173)。`--strictPort` 避免埠號被占用時自動跳到 5174，造成來源驗證失敗。

### 4. 啟動 Windows Agent 橋接（保持開啟）

另開一個 **Windows PowerShell**：

```powershell
cd '<repo-root>'
$env:CONTROL_API_URL='http://127.0.0.1:3001'
$env:WORKER_TOKEN_FILE='.local/worker-token'
npm.cmd run agents
```

橋接使用此 Windows 帳號安裝及登入的官方 CLI。到網頁「LLM → 模型連線」選擇綁定 Agent 的連線，按「測試連線」。橋接有心跳不等於模型已登入或可以成功回覆。

### 5. 確認服務有通

在 **Windows PowerShell**：

```powershell
Test-NetConnection 127.0.0.1 -Port 2222
curl.exe --max-time 10 http://127.0.0.1:3001/api/health
curl.exe --max-time 10 http://127.0.0.1:5173/api/health
```

第一項應顯示 `TcpTestSucceeded : True`。後兩項應回傳含 `"status":"ready"` 的 JSON。3001 成功、5173 失敗時，先查網頁服務和代理，不必重新匯入檔案。

## 安裝環境與 Docker

### Windows

安裝 [Node.js 24](https://nodejs.org/en/download)，與目前 API 容器的 Node 主版本一致。準備 VirtualBox、Ubuntu VM，並確認 PowerShell 可使用 `ssh`、`scp`、`tar`。

首次取得專案或 lockfile 更新後，在 **Windows PowerShell**：

```powershell
cd '<repo-root>'
node --version
npm.cmd --version
ssh -V
tar --version
npm.cmd ci
npm.cmd ci --prefix apps/web
```

根目錄與前端是兩個 npm 專案，都要安裝；日常啟動不用每次重裝。

目前 Docker 跑在 VM，Windows 跑網頁與橋接。若改成全部在本機跑，再依 [Docker Desktop 官方 Windows 安裝說明](https://docs.docker.com/desktop/setup/install/windows-install/) 下載、啟動 Docker Desktop，使用 Linux containers。兩種配置不要同時占用本機 3001。

### Ubuntu VM 的 Docker

先照 [Docker 官方 Ubuntu 安裝步驟](https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository) 完成官方套件來源設定，再安裝：

```bash
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
sudo usermod -aG docker "$USER"
```

登出再登入，讓群組設定生效，然後檢查：

```bash
docker version
docker compose version
```

找不到 `docker-ce` 時，先完成官方文件的 repository 步驟。docker 群組能管理主機容器，只加入維護服務所需的帳號。

本專案使用 `docker compose`，不是舊版 `docker-compose`。同步 Compose、Dockerfile 與 lockfile，才能保持服務設定及相依一致；`node:24` 等可變映像標籤不代表永久固定同一個修訂版本。

### Codex CLI 登入

在執行橋接的同一個 **Windows 帳號**：

```powershell
npm.cmd install -g @openai/codex
codex --version
codex login
codex login status
```

安裝後找不到命令時重開終端。更新 CLI 後重啟橋接。`login status` 只檢查登入，網頁「測試連線」才確認實際模型回覆。參考 [官方 CLI 安裝](https://learn.chatgpt.com/docs/cli) 與 [登入指令](https://learn.chatgpt.com/docs/cli/reference)。

## 固定網址與連線埠

「接口一致」分兩件事：容器使用同一份 Compose；每台 Windows 使用相同的本機網址與 SSH 通道。

| 用途 | Windows 入口 | VM／容器端 | 設定位置 |
|---|---|---|---|
| 網頁 | `http://127.0.0.1:5173` | 前端在 Windows 跑 | 啟動指定 `--port 5173 --strictPort` |
| SSH／上傳 | `127.0.0.1:2222` | Ubuntu SSH `22` | VirtualBox NAT 轉送 |
| Control API | `http://127.0.0.1:3001` | VM `127.0.0.1:3001` → 容器 `3001` | SSH `-L`、`compose.yaml` |
| 網頁 API 代理 | `http://127.0.0.1:5173/api` | Windows `127.0.0.1:3001/api` | `apps/web/vite.config.ts` |
| PostgreSQL | 不開放 Windows 連入 | 內部 `postgres:5432` | Compose 內部網路 |

VirtualBox → VM 設定 → 網路 → NAT → 連接埠轉送，新增：

| 名稱 | 協定 | 主機 IP | 主機埠 | 客體 IP | 客體埠 |
|---|---|---|---|---|---|
| SSH | TCP | `127.0.0.1` | `2222` | 留空 | `22` |

API 只發布在 VM loopback，Windows 用 SSH 通道連 API，不另加 NAT 3001 轉送，也不必改為公開 API。

換電腦時沿用上述埠號與 `127.0.0.1`。這個地址代表目前這台電腦，不會自動指向同事的 VM；遠端 VM 應改 SSH 目的地，再保留相同的本機 `-L` 通道。刻意改前端埠號時，還需同步 API 的 `WEB_ORIGINS` 白名單。

## 第一次建立 VM 服務

只適用尚未部署的 Ubuntu VM。既有 VM 直接用日常啟動或更新，不要重新產生密碼。

在 **Ubuntu VM** 安裝 SSH：

```bash
sudo apt update
sudo apt install openssh-server
sudo systemctl enable --now ssh
```

將完整專案放到 `~/archify-test`。首次部署需要 `compose.yaml`、各服務原始碼及 Dockerfile、`services/runner`、`services/launcher`、`scripts`、`config`、根目錄 npm manifests。小型更新包不能代替首次部署。不要帶入 Windows 的 `node_modules`、CLI 登入資料或整個 `.local`。

首次傳送可在 **Windows PowerShell** 執行，逐步確認上一個指令成功後再繼續：

```powershell
cd '<repo-root>'
New-Item -ItemType Directory -Force work | Out-Null
tar --exclude=node_modules -czf work/archify-initial.tar.gz package.json package-lock.json compose.yaml README.md services scripts/start-vm.sh config/integrations.empty.json config/integrations.example.json config/api-environments.example.json
ssh -p 2222 <vm-user>@127.0.0.1 'mkdir -p ~/archify-test'
scp -P 2222 work/archify-initial.tar.gz <vm-user>@127.0.0.1:~/archify-test/
ssh -p 2222 <vm-user>@127.0.0.1 'cd ~/archify-test && tar -xzf archify-initial.tar.gz'
```

這份首次 VM 包只帶後端服務、腳本與無秘密的設定範例，前端繼續留在 Windows 執行。

在 **Ubuntu VM**：

```bash
cd ~/archify-test
if [ ! -f config/integrations.json ]; then
  cp config/integrations.empty.json config/integrations.json
fi
sh scripts/start-vm.sh
curl --fail http://127.0.0.1:3001/api/health
```

腳本會在缺少時建立 `.local/db-password`、`.local/worker-token`，將 Compose 使用者與 Docker socket 群組設定保存到 `.env`，並建置、啟動服務。既有密碼檔會保留。

首次配對 Windows 橋接時，在 **Windows PowerShell** 取回該 VM 的 worker token：

```powershell
cd '<repo-root>'
New-Item -ItemType Directory -Force .local | Out-Null
scp -P 2222 <vm-user>@127.0.0.1:~/archify-test/.local/worker-token .local/worker-token
```

僅在首次配對或確定要切換 VM 時執行，會取代本機既有 worker token。兩端 token 必須相同；這不是模型登入 token。不要貼到聊天或提交 Git，CLI 登入資料仍由 Windows 官方 CLI 管理。

需要將來源交給模型時，在 **VM** 編輯 `config/integrations.json` 的最外層 `allowSourceCode` 為 `true`，保留其他設定。這代表允許相關來源經橋接交給所選模型供應商分析，不是只留在本機；不使用時可維持 `false`。

## 更新程式到 VM

### 1. 更新前與建立更新包

先等正在整理／測試的工作完成，或取消後保留進度。API 重啟會中斷當前請求；失聯工作可能需等 lease 到期才顯示失敗，再按「接續整理」。

以下是目前服務與前端的更新包，不含秘密或資料庫。若已拿到這次重新打包的檔案，可跳過打包，別使用舊包。

在 **Windows PowerShell**，編譯成功後才打包：

```powershell
cd '<repo-root>'
npm.cmd run build --prefix apps/web
```

```powershell
New-Item -ItemType Directory -Force work | Out-Null
tar --exclude=node_modules -czf work/local-file-import-update.tar.gz package.json package-lock.json compose.yaml README.md services/control-api services/agents services/launcher services/runner scripts/start-vm.sh apps/web/src apps/web/dist ARCHIFY-CURRENT-SPEC.md
tar -tzf work/local-file-import-update.tar.gz | Select-String 'node_modules|\.local/|integrations\.json$'
```

最後一行應沒有符合項目。更新包不帶入 `config/integrations.json`、`.env` 或 `.local`，以免覆寫 VM 設定。若設定結構有變，需另行檢視合併範例設定。

### 2. 上傳並更新後端

在 **Windows PowerShell**，先確認 `2222` 能連，再執行上傳：

```powershell
Test-NetConnection 127.0.0.1 -Port 2222
scp -P 2222 work/local-file-import-update.tar.gz <vm-user>@127.0.0.1:~/archify-test/
```

確認 `scp` 成功後才執行，避免解壓到 VM 上的舊包：

```powershell
ssh -t -p 2222 <vm-user>@127.0.0.1 'cd ~/archify-test && tar -xzf local-file-import-update.tar.gz && docker compose build control-api && docker compose up -d --no-deps control-api && docker compose ps'
```

`scp` 用大寫 `-P`，`ssh` 用小寫 `-p`。API 剛啟動可能尚未 ready，稍候再用日常啟動的健康檢查確認。只更新 API 不必重啟 PostgreSQL。

如果這次也改了 launcher 或 runner，在 **VM** 另外執行：

```bash
cd ~/archify-test
docker compose --profile build build launcher runner-image
docker compose up -d --no-deps launcher
```

若更動 Compose 的其他服務設定，要針對該服務重新套用，不能假設只更新 API 就會套用所有變更。

### 3. Windows 更新後

- 重新整理網頁。前端在 Windows 跑 Vite，重建 VM API 不會代替更新 Windows 的前端原始碼。
- 改動 `services/agents` 或更新官方 CLI 後，在原橋接終端按 `Ctrl+C`，重做日常啟動第 4 步。
- 根目錄 lockfile 改變時執行 `npm.cmd ci`；前端 lockfile 改變時執行 `npm.cmd ci --prefix apps/web`。
- 檢查兩個 `/api/health` 與模型連線。失敗工作使用「接續整理」，不用重新匯入來源。

重建容器不會清空 PostgreSQL volume。不要為更新執行 `docker compose down -v`。

## 匯入與背景整理

### 模型分析時間上限

批次案例分析的外層 `reply` 上限已由 20,000 調整為 200,000 字元，CLI 與 API 回覆使用共用驗證，伺服器接收端採相同限制。格式錯誤會分別回報 `MODEL_REPLY_FORMAT`、`MODEL_REPLY_JSON`、`MODEL_REPLY_LIMIT` 等原因，只顯示欄位型別與長度，不附帶原始回覆。`Invalid answer schema` 的舊訊息不能單獨證明是超長；也可能是缺欄位或型別錯誤。更新後重啟 Windows 橋接並重建 VM API，再使用「接續整理」，不會改變原分析切片或重跑完成批次。

單次 CLI 模型分析上限為 10 分鐘。共用設定在 `services/control-api/src/llmTimeouts.json`：CLI／API 模式模型請求 600 秒、CLI lease 630 秒、伺服器等待 690 秒（包含排隊）、瀏覽器及 Vite proxy 等待 720 秒。背景 API 整理工作另外持續回報心跳，240 秒 lease 是失聯偵測，不是單批分析時間上限。若供應商或外部代理有更短限制，仍可能提前失敗。

更新此設定需要同步重建 VM 的 `control-api`，並重啟 Windows 的 Agent 橋接與 Vite；使用單一終端啟動時，按 `Ctrl+C` 後再執行 `npm run dev`。已失敗的背景整理保留完成批次，更新後可選「接續整理」。只修改時間上限不改變切片規則與分析版本。

### API 來源解析更新（2026-10-24）

本次需更新 VM 的 `control-api`，僅重新整理 Windows 網頁不會更新分析器。依「更新程式到 VM」上傳並重建 API 後，在「單點 API 測試」重新執行「LLM 整理」；失敗／取消狀態可選「重新整理」建立新工作。舊版工作不能以新版分批規則接續，以免混用不完整結果，原快照與已完成結果保留。只要引用檔案和必要設定已在匯入內容中，無需重新匯入；缺檔才需要補匯入。

解析器在唯讀來源快照內使用 TypeScript 模組解析，支援根目錄與巢狀 tsconfig/jsconfig、相對路徑設定繼承、paths/baseUrl、JS 引用對應 TS 原始碼及 GraphQL 文件引用。設定繼承的目標必須已匯入；尚未包含任意建置工具執行結果、外部套件實作或 Vue/Svelte 專用語法解析。

每個分析批次帶入其靜態依賴，共用 client 不因前批已送過而省略。一般批次以 48,000 字元為目標，較大的依賴群組允許整組送出（群組上限 160,000 字元），CLI/API 路徑不再截斷這類分析證據；超出上限則明確失敗。模型服務仍可能有更小的上下文限制，模型錯誤不視為分析成功。超長單一片段仍會分段並標記 continued，不宣稱完整理解跨段邏輯。

畫面列出來源解析問題的路徑。模型缺漏分為來源解析、測試設定與呼叫行為確認；舊案例仍保留原始說明。這些分類不是可執行性驗證，沒有缺漏的案例仍標示「草稿，待驗證」。

1. 在測試專案選擇本機檔案／資料夾匯入，不要求先設定 Git；匯入不會修改原始檔。
2. 會過濾依賴、建置產物、秘密檔及非來源資料；最多 10,000 檔、總量 100 MB。除 `src` 外，追蹤引用可能需要 tsconfig、client 與非秘密設定。
3. 在「單點 API 測試」按「LLM 整理」。程式先找請求、GraphQL 與引用，只將相關片段交給模型。
4. VM 每批保存案例與進度。可切頁或關閉分頁；VM、SSH 通道和 Windows 橋接需持續執行，Windows 不能進入睡眠。
5. 失敗／取消後按「接續整理」，沿用原快照並跳過完成批次。例如已完成 5／10，接續從第 6 批開始；不要刪工作或清空資料庫。

整理只產生可編輯草稿，不會自動執行 API。網址、認證參照、資料與前置條件仍需確認，模型成功回覆不等於案例已驗證。

## 常見錯誤排查

### Connection refused，連不上 2222

確認 VM 開機、VirtualBox `2222 → 22` 轉送還在。到 **VM 主控台**：

```bash
sudo systemctl status ssh
sudo systemctl restart ssh
ss -ltn | grep ':22'
```

回 Windows 用 `Test-NetConnection 127.0.0.1 -Port 2222` 檢查，成功前先不要反覆上傳。

### SSH 通道 Address already in use

在 **Windows PowerShell** 看誰正在監聽：

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3001 | Select-Object LocalAddress,LocalPort,OwningProcess
```

已有正常通道就沿用。若是另一套本機 API／Docker 占用，先確認並停止那套服務，不要隨意終止不明程序。

### Control API 回應格式錯誤／HTTP 502、503、504

表示收到非預期回應，不能直接判定上傳內容錯誤。依序檢查 `2222`、Windows 的 `3001/api/health`、`5173/api/health`，再到 **VM**：

```bash
cd ~/archify-test
docker compose ps
docker compose logs --tail 100 control-api
```

新版提示包含 HTTP 狀態與請求路徑。404 可能是 VM 未更新新路徑或代理位置錯誤；413 是伺服器／代理拒絕請求大小。先記下操作、狀態碼、路徑，不要先重匯入整包。分享紀錄前移除憑證及私人資料。

### Source sharing is disabled in server configuration

到 VM 檢查 `config/integrations.json` 最外層 `allowSourceCode`。只有同意將來源交給所選模型時才設為 `true`；反覆匯入不會解決此設定問題。

### E2E 寫腳本停在「正在判斷下一步」

Android E2E authoring 每次等待模型判斷最多 30 秒，包含模型工作排隊時間。逾時在原聊天詢問使用者目前畫面與下一步，保留草稿、操作紀錄及最近失敗原因；未回覆前不會接續操作，遲到的模型答案不會套用。此限制針對模型判斷，不會將已送出的手機操作或實際驗證誤報為取消。

Windows 專案目錄執行 `powershell -ExecutionPolicy Bypass -File scripts/update-android-decision.ps1` 可更新現有 VM。更新會重新啟動後端，進行中的任務會暫停；更新後回原聊天發送訊息接續處理。其他模型工作的原有等待上限維持原設定。

### CLI did not complete／模型紅燈

確認橋接和 SSH 通道還開著，在橋接所用的 **Windows 帳號** 檢查：

```powershell
codex --version
codex login status
curl.exe --max-time 10 http://127.0.0.1:3001/api/health
```

未登入時執行 `codex login`。查看橋接終端的驗證、網路、時限或額度訊息；更新 CLI／橋接後重啟橋接。模型連線測試成功，再回原工作按「接續整理」。舊版通用錯誤不能單獨判斷根因。

### 橋接回報 Control API 401

確認 Windows 的 `WORKER_TOKEN_FILE` 指向該 VM 配對的 `.local/worker-token`。不要隨機產生另一份替代；兩端必須相同，它也不是模型 API key。

## 停止服務與備份

Windows 前端、橋接與 SSH 通道各在原終端按 `Ctrl+C`。VM 容器可繼續背景執行；需要停止時在 **VM**：

```bash
cd ~/archify-test
docker compose stop
```

下次用 `docker compose up -d postgres control-api launcher` 啟動。停止前先等整理／測試完成，或取消工作。

專案、來源快照、案例及進度主要存在 PostgreSQL volume，不在更新包內。VM 的 `.local`、`.env`、`config/integrations.json` 要另行保管；CLI 登入資料留在 Windows。

更新前可在 **VM** 備份資料庫，每行成功後才繼續：

```bash
cd ~/archify-test
umask 077
mkdir -p backups
docker compose exec -T postgres pg_dump -U archify -d archify -Fc -f /tmp/archify-backup.dump
docker compose cp postgres:/tmp/archify-backup.dump "backups/archify-$(date +%Y%m%d-%H%M%S).dump"
```

備份含匯入來源與業務資料，另存受保護的位置。VM 設定與 Windows CLI 登入不在此資料庫備份內。還原會影響現有資料，先確認目標環境；一般連線錯誤不需要刪除 VM 或 volume。

## 開發檢查與主要位置

在 **Windows 專案根目錄**：

```powershell
npm.cmd test
npm.cmd run check --workspace services/control-api
npm.cmd run build --prefix apps/web
```

| 路徑 | 用途 |
|---|---|
| `apps/web` | React + TypeScript 前端 |
| `apps/web/vite.config.ts` | Windows API 代理 |
| `services/control-api` | API、migration、背景整理 |
| `services/agents` | Windows 官方 CLI 橋接 |
| `services/launcher`、`services/runner` | 隔離測試執行器，不代表已連實際測試站 |
| `compose.yaml` | 容器、網路、volume 與連線埠 |
| `scripts/start-vm.sh` | VM 初始化及完整服務建置 |
| `config/integrations.empty.json` | 無秘密的初始設定範例 |
| `ARCHIFY-CURRENT-SPEC.md` | 功能規格與限制 |

本手冊依原始碼及設定核對，未在全新 VM 重做安裝或執行還原。容器啟動、CLI 登入、API 健康與實際模型回覆需分別確認。


## API 請求庫與版本差異

從前端解析可編輯請求、驗證 GraphQL schema、發送單點請求與追蹤腳本／流程影響，操作及 VM 更新方式見 [API-REQUEST-LIBRARY.md](../API-REQUEST-LIBRARY.md)。
