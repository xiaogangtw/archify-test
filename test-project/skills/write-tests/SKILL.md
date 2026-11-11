---
name: write-tests
description: 在獨立 Playwright 專案撰寫單支 API 或多 API 流程測試，重用 api 模組、明確傳遞 token 與資料並保留業務斷言；不修改產品來源或自行執行寫入。
---

# 撰寫 Playwright 測試

先查看 test-cases/catalog.json 的測試意圖與固定案例 ID；測試使用 `{ type: 'archify-case', description: 'TC-...' }` annotation 關聯，保留 archify-id。同一案例不分配給多份 spec。catalog 保存規劃步驟與逐步預期；test.step 是其實作，不反向取代規劃。實作先讀 skills/implement-tests/SKILL.md，可用 node support/case-plan-cli.mjs TC-CASE-ID 檢查資料完整性；缺資料在本機對話補齊，不要求網站確認或 reviews。業務規則仍以 knowledge 的證據為準，不讓腳本自動取代需求。

處理網站複製的問題時先核對來源、案例與斷言；補 knowledge、catalog 的問題答案及需要調整的 api／tests，不修改舊報告、不降低斷言換通過。完成後網站重新讀取；新腳本或共用依賴改動後，舊通過不能當新版已驗證。靜態 import／test.step 只代表引用與宣告，不代表執行覆蓋。腳本名稱或位置改動時保留 archify-case。

先讀 README.md、knowledge/README.md 及相關業務知識。api/操作名稱.ts 保存 operation（query、預設 variables、端點）與 callApi(request, options)，tests/api/ 保存單支測試，tests/flows/ 保存跨 API 流程。請求模組不得包含 test、expect、全域 token 或匯入即發請求的副作用；測試不可互相 import .spec.ts。

沿用 support/bff.mjs 的 bffUrl、bffHeaders、resolveData。BFF_BASE_URL 與秘密留 .env，共用 Header 留 config/http.json。實際撰寫時可用 bffHeaders 的個案參數覆寫 Header，null 移除認證。不要硬寫 token，不從接口名稱猜測業務預期。

統一以 import { callApi as login } from '../../api/Login.js' 匯入；NodeNext 在 TS 使用 .js specifier，由 TypeScript 與 Playwright 解析同名 .ts。共用契約與流程範例見 [api-flows.md](references/api-flows.md)。options.variables 是 GraphQL variables 頂層覆寫，巢狀物件完整傳入；options.values 才是 {{名稱}} 占位值。headers 明確傳 token，null 移除共用值；body 完整覆寫 REST 或 GraphQL body。回傳 APIResponse，由測試解析與斷言，不修改 operation 或共用全域狀態。

新稿的預設資料在 API 模組，單支測試只保留 import 與 test.skip 識別。AI 依來源與知識補資料、實際 test.step 與業務斷言後才啟用；不要只刪 skip 讓空測試假通過。流程在同一 test 內依序取得 token／cardId 並傳給下一次呼叫，不能依賴其他 spec 的順序。登入裝置等特殊 Header 依來源及現有登入案例準備，框架不會自動猜測。

回應預覽在取得 response 後、斷言前呼叫 support/response.mjs 的 showResponse(response, testInfo)，不可印原始 token。先 npm run check:types，再以 npm run flow -- tests/flows/名稱.spec.ts 檢查載入與計畫。

沒有有效資料與業務斷言不能啟用。HTTP 200 不是完整業務驗證；保留原本斷言，不以降低預期消除失敗。寫入需明確授權，必要清理用原生 Playwright hooks 或案例程式處理，不重試寫入。

業務步驟用 test.step；流程名稱由實際情境決定，若提供 archify-plan 需與實際步驟一致。保留 archify-id，不複製成重複 ID。reporter 只呈現明示計畫與實際步驟，不證明未執行分支。

先 npm run flow -- tests/api/檔名.spec.ts，確認計畫；它會載入模組，頂層不得有業務副作用。取得對應授權後 npm test -- tests/api/檔名.spec.ts。回報通過、失敗、略過與未驗證範圍，不把全略過的 exit 0 宣稱成功驗收。

日常可改 api、tests、共用資料／請求、skills、knowledge、memory、config/http.json。support、framework 與執行設定沒有明確要求不改。舊格式需明確遷移並備份，不因重掃覆寫人工內容。外部 AI 的檔案權限由其工具／OS 管理，技能不是沙箱。Git 提交由使用者自行決定。

新增或修改 catalog 案例時，依 test-cases/README.md 的「流程分類」明確填 target：單支／串接 API 都用 api；網頁用 web、Android 畫面用 mobile、含畫面的跨平台用 mixed。kind: flow 不等於畫面流程；保留 script 與實際 runner 一致。未知平台先詢問，不建立假測試。

網頁實作必須遵守 skills/write-web-tests/SKILL.md 的固定逐操作證據：從 support/web-test.js 匯入 test／expect，設定角色，特殊操作用 uiStep，不得只有結束圖或限制前八張；新專案預設開啟，超量自動分卷。先 check:ui-evidence 與 check:types。

## 單檔報告與完整歷史

依使用者2026-11-10要求，本節取代舊的JSON／HTML／TXT自動產物、八張／4MB分卷及最近100份限制。每次執行在reports/api或reports/ui只寫一份日期時間命名HTML，同runId在進行中與完成時原子更新同檔，不覆寫其他執行。HTML內嵌schemaVersion 1與全部PNG，圖片延遲載入、點擊放大；不自動另寫JSON／TXT或part分卷，純文字仍可由閱讀器按需下載。單張PNG維持2MB檢查；單檔512MB明確上限，超限失敗不丟圖湊成功。所有測試專案共用此契約。前置說明不在報告正文顯示，必要準備操作、原始結構及證據仍保存。歷史列表不截斷100／1000份，提供搜尋與顯示更多；舊JSON／分卷保留相容且不刪除。
