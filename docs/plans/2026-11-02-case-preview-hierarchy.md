# 案例內容與流程預覽整理

## 範圍
重整案例內容層級，編碼置於標題旁，目的／預期／前置／清理維持可讀列表；技術與證據預設收合。流程操作收至流程標題下的展開區。保留所有原文及草稿來源，不依文字猜測或改寫測試預期。

## 影響檔案
- apps/web/src/features/testing/CaseMetadataPreview.tsx
- apps/web/src/features/testing/ScriptWorkspace.tsx
- apps/web/src/features/testing/AppiumFlowPreview.tsx
- apps/web/README.md
- ARCHIFY-CURRENT-SPEC.md

## 資料庫影響
無。

## 風險
收合不能遮蔽待確認事項；長 UUID 需換行，流程操作須保留鍵盤與停用行為。只改呈現，不聲稱重跑驗證。

## 設計文件同步
前端 README 與目前規格同步。未改路由、守衛、導向、API、GraphQL payload 或 DB schema。

## 領域
前端

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
- npm.cmd run build --prefix apps/web：通過，保留既有大型 chunk 提示。
- npm.cmd run docs:plans:index、docs:check：通過。
- DS_REQUIRE_BROWSER=1，bundled NODE_PATH 與 Chrome 執行 scripts/verify-flow-preview-ui.mjs：通過主流程順序、巢狀、未引用定義、前置／清理、循環、解析錯誤、鍵盤與窄版回歸；此 harness 不含新 metadata／操作區。
- bundled Python 執行 lint_hardcodes.py：修改的 3 檔通過；check_no_emoji.py：105 檔通過；lint_native_select.py：63 檔通過。系統 python 別名不可用，已改 bundled Python 完成。
- 實際 Chrome 查看 TC-000007，技術與證據、流程操作預設收合，點擊可展開；Enter／Space 可收合。來源與 API／共用流程入口保留，沒有提交、修改或重跑案例。
- 390px 手機寬度與 1440px 桌面實測 document scrollWidth 等於 innerWidth，實際查看手機換行，檢查後已還原 viewport，未保存截圖。
- verify_responsive.mjs 在 DS_REQUIRE_BROWSER=1 下因 ESM 無法載入 Playwright 失敗；bundled NODE_PATH 僅解決上述使用 createRequire 的回歸腳本，不能將此 gate 記為通過。
- 完整 token／contrast／state／axe／target size／mobile-first／intent／overflow／reduced-motion gates 未完成；新區域尚未做自動化完整量測，因此不勾選可供審查。未更改色彩 token，沒有新增動態、載入或錯誤狀態；只讀內容不適用 selected，原操作沿用既有 disabled／busy 行為。
- 目視複查：標題／編碼同列、來源收合、流程操作分區，保留原始預期與假設；混在既有 metadata 裡的技術文字不自動搬移或重寫。

## 設計判斷
| 優先 | 問題 | 調整 |
| --- | --- | --- |
| 高 | 業務預期與來源識別碼同等權重 | 業務正文與收合證據分層 |
| 高 | 操作按鈕夾在 metadata 與流程間 | 移到流程標題下的流程操作 |
| 中 | 編碼單獨佔兩行、草稿重複標示 | 標題與編碼同列，候選僅必要時保留 |

參考方向：克制的工具型編輯器，沿用 Tailwind config，不新增 token 或動態。固定淺色，暗色不適用。

