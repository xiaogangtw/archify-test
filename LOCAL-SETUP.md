> 舊架構參照：預設入口已改為本機報告閱讀器，請先讀 [README](README.md)。以下內容不代表新入口仍需 VM 或提供相關管理功能；舊服務保留供遷移。

# Archify Test 本機啟動

> 閱讀定位：本文件保留分步設定與排錯。日常啟動與更新以 [操作手冊](README.md) 為入口；完整分類見 [文件總索引](docs/README.md)。

假設本機專案位於 `<repo-root>`（例如 `.\archify-test`）。

Windows 執行 React 網頁與官方 LLM CLI；Linux VM 執行 PostgreSQL、Control API、Job Launcher 與隔離 Runner。第一條 Smoke 僅檢查容器內的唯讀服務，不存取公司系統或 dev。

## 1. 接通 Linux VM

在 VM 執行：

```sh
sudo systemctl start ssh
ss -lnt | grep ':22'
```

VirtualBox 使用 NAT 時，設定 TCP 轉送：主機 IP `127.0.0.1`、主機埠 `2222`、客體 IP 留空、客體埠 `22`。

在 Windows PowerShell：

```powershell
ssh -p 2222 <vm-user>@127.0.0.1
```

首次連線請核對 VM 的 SSH host key 指紋。若要求密碼，請在你自己的終端機輸入，不要貼到聊天。

## 2. 將專案複製到 VM

在 Windows 專案目錄執行以下指令。排除 Windows 套件與秘密；不覆寫 VM 的秘密檔：

```powershell
tar --exclude=node_modules --exclude=.git --exclude=.local --exclude=.npm-cache --exclude=apps/web/node_modules --exclude=apps/web/dist --exclude=config/integrations.json -czf work/archify-vm.tar.gz package.json package-lock.json compose.yaml .dockerignore services config scripts
ssh -p 2222 <vm-user>@127.0.0.1 'mkdir -p ~/archify-test'
scp -P 2222 work/archify-vm.tar.gz <vm-user>@127.0.0.1:~/archify-test/archify-vm.tar.gz
ssh -p 2222 <vm-user>@127.0.0.1
```

在 VM：

```sh
cd ~/archify-test
tar -xzf archify-vm.tar.gz
cp -n config/integrations.empty.json config/integrations.json
# 確認 Docker Engine 與 Compose 已可用；若此處失敗，先處理 Docker 安裝/權限。
docker version
docker compose version
sh scripts/start-vm.sh
curl http://127.0.0.1:3001/api/health
```

建置需要下載 Node、PostgreSQL、Docker CLI 映像與 npm 套件。使用者須有 Docker socket 權限。只用於本機開發；具有 Docker socket 的 Launcher 是受信任元件，不能公開給外部使用者。

服務啟動會初始化資料表與「唯讀 API Smoke」案例。DB 沒有公開埠，Control API 僅發布在 VM 的 loopback。`.local` 保留資料庫與 worker 的隨機秘密，勿提交、分享或刪除；刪除秘密不會重設既有 DB 密碼。

## 3. Windows 開啟通道與網頁

另開 PowerShell，保持此視窗開啟：

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:3001:127.0.0.1:3001 -p 2222 <vm-user>@127.0.0.1
```

再開 PowerShell：

```powershell
cd .\apps\web
npm ci
npm run dev
```

打開終端顯示的 Vite 網址，通常是 `http://127.0.0.1:5173`。前端經 Vite proxy 與 SSH 通道存取 API；API 不通時顯示連線錯誤，不會退回模擬成功。

進入「腳本案例庫」，播放「唯讀 API Smoke」。預期：排隊 → 執行健康檢查與首頁檢查 → 成功；「測試結果」保留結果、腳本 v1、內容 hash、時間與階段事件。重新整理後仍可查看。

如有舊瀏覽器資料，頂部「匯入舊資料」可匯入現有案例及設定；保留原始瀏覽器資料，同 ID 伺服器案例不覆蓋。舊版歷史腳本未自動匯入為伺服器版本，匯入的最新內容從伺服器 v1 開始。

## 4. 驗證 PostgreSQL 與端到端流程

在 VM 專案目錄建立專用測試資料庫（僅第一次）：

```sh
docker compose exec postgres psql -U archify -d postgres -c 'CREATE DATABASE archify_test'
docker compose exec control-api node --import tsx services/control-api/test/container-test.ts
```

此測試只建立並移除 `archify_test` 裡的隨機 schema，驗證不可覆寫腳本版本、衝突、工作佇列、冪等事件、取消與 lease 到期。它不會執行 Docker Runner。

完整 Runner 驗證在 Windows 執行（需已開 SSH 通道）：

```powershell
node scripts/verify-live.mjs
```

這會執行成功、斷言失敗、略過與取消案例，驗證真正的佇列/Runner/結果保存，不要求任何公司網址。只在尚未設定 Git 倉庫的初始 fixture 專案執行。

## 5. Git 接入（等倉庫與 tag 規則）

VM 的 `config/integrations.json` 由管理者設定，格式見 `config/integrations.example.json`。三個角色固定為 frontend/bff/backend，各有允許 URL、GitLab projectId、QA tag 與 Token 檔案路徑。設定中可用 `enabled:false` 或 `expiresAt:YYYY-MM-DD` 停用/限制到期。

把各自唯讀憑證放入 VM `.local/integration-secrets`，檔案權限 `600`。容器內對應 `/run/integration-secrets`；網頁不能讀取憑證內容、路徑或自訂存取範圍。此版本使用 OS 權限與唯讀秘密掛載，不宣稱已接 Vault/KMS 或完成金鑰輪替。

前端程式碼只讀 `release` 固定 SHA 的 TS/JS 檔；BFF 與後端僅讀 branch/tag。每個 QA tag 必須**剛好指向同一個 release commit**，祖先關係不算相同。截取前後重新檢查 refs；若移動則要求重試。比對成功也不代表 dev 已部署同一版，結果會保留「部署未驗證」。

目前掃描器識別字面值 fetch/axios，fetch 方法保留 UNKNOWN；SDK、動態 URL、變數組合仍需確認。來源上限 10,000 檔、100 MB、100,000 tree entries，超出會停止而非靜默截斷。

首條 Runner 仍使用 `isolated-fixture`、無外網。尚未實作存取 Windows localhost 前端/dev 的網路代理、目標允許清單與部署版本證據，不要把 fixture 成功當成公司環境通過。

## 6. Claude Code / Codex / Gemini CLI

在 Windows 安裝並登入官方 CLI。可選擇工具預設模型，未強制指定模型版本。登入只在官方終端機執行：

- Claude Code：`claude auth login`
- Codex：`codex login`
- Gemini CLI：`gemini`，依畫面登入

將 VM worker token 安全複製到 Windows 專案 `.local/worker-token`（僅第一次，勿顯示內容）：

```powershell
New-Item -ItemType Directory -Force .local | Out-Null
scp -P 2222 <vm-user>@127.0.0.1:~/archify-test/.local/worker-token .local/worker-token
$account = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls .local /inheritance:r /grant:r "${account}:(OI)(CI)F"
npm run agents
```

保持 SSH 通道與橋接視窗開啟。網頁「LLM → 模型連線」選工具與工作角色，儲存，再測試連線。安裝狀態不等於已登入；缺少工具或登入會明確失敗。

橋接用固定 executable/參數與 stdin，不拼接 shell。Claude 使用空工具集與空 MCP；Codex 使用 read-only、忽略使用者設定並關閉 shell/multi-agent/web；Gemini 使用 deny policy。CLI 版本必須支援所用旗標，否則拒絕執行，不降級成全權模式。這些為 CLI 權限限制，並非 VM 等級的強隔離；未自動安裝 CLI 或代你登入。

來源碼傳送給模型預設關閉。要使用掃描後的 LLM 解釋，需由管理者在 VM `config/integrations.json` 設定 `allowSourceCode:true`（參考 example），允許該供應商接收內部來源證據。模型輸出為草稿，不會直接排隊執行。第三方 CLI 可能依自身設定保留資料；請使用適合公司政策的帳號。

API 模式為選配的 OpenAI 相容 `chat/completions`，URL/model 與 API key 檔由 VM 管理者設定。未實作原生 Anthropic/Gemini REST API adapter；Claude Code/Gemini 請用 CLI 模式。

## 維護

- VM：`docker compose logs --tail=100 control-api launcher`
- VM 停止：`docker compose stop`，資料保留在具名 volume。
- 不要執行 `docker compose down -v`，那會刪除資料庫 volume。
- 更新程式後重新同步與 `sh scripts/start-vm.sh`；不覆蓋既有 `.local` 與 integrations.json。
- PostgreSQL 備份可在 VM 使用 `docker compose exec -T postgres pg_dump -U archify archify > archify-backup.sql`，備份包含來源碼與測試紀錄，請保護存放位置。

這是單一使用者本機版本。尚無多人登入/權限、正式稽核、憑證輪替、排程器、瀏覽器/視覺 Runner；既有設計頁不等於已接入的功能。
