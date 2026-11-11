# 腳本案例庫編輯返回入口

## 範圍
從腳本案例庫開啟既有案例時，在編輯器名稱前提供返回案例庫按鈕。未儲存內容或 AI 建議先確認放棄；直接開啟案例撰寫不新增返回入口。

## 影響檔案
- apps/web/src/features/testing/TestingPages.tsx
- apps/web/src/features/testing/ScriptWorkspace.tsx
- apps/web/README.md、ARCHIFY-CURRENT-SPEC.md

## 資料庫影響
無。

## 風險
返回不得隱性保存或直接丟棄草稿；其他 Android 返回標籤維持原值。

## 設計文件同步
同步撰寫入口、返回 cases 頁面及離頁確認，未改 API、GraphQL payload 或 DB schema。

## 領域
前端

## 任務狀態
- [x] 已開始
- [x] 實作完成
- [x] 文件已同步
- [x] 設計文件已同步或註明不適用
- [ ] 可供審查

## 驗證證據
- npm.cmd run build --prefix apps/web 通過（既有大型 chunk 提示保留）。
- 真實 Chrome 腳本案例庫：編輯既有案例看見返回案例庫箭頭；未修改直接返回；修改名稱後返回出現確認；繼續編輯保留名稱且焦點回到返回；放棄本次測試修改後返回案例庫，原名稱及版本未變，未儲存測試資料。
- Python -X utf8 check_no_emoji.py apps/web/src（105 檔）與 lint_native_select.py apps/web/src（63 檔）通過。
- docs:plans:index、docs:check、git diff --check 通過；未儲存預覽截圖。
- 未完成全套 token、contrast、hardcode、state、axe、responsive、keyboard、target-size、mobile-first、intent、overflow、reduced-motion gates；AI 建議、儲存後返回與其他編輯入口未逐一回歸，不勾選可供審查。
