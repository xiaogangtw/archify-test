# 決策：請求模組與測試分離

日期：2026-11-07
狀態：已接受

## 背景
單檔稿適合填資料，但流程若匯入 .spec.ts 會註冊其他測試，無法安全重用請求。使用者要求平台建立一致框架，讓每支 API 可單測、也可組流程。

## 決策
api/ 每個操作提供 operation 與 callApi(request, options)，回傳 Playwright APIResponse；共用傳輸在 support，沒有業務斷言或全域 token。tests/api/ 與 tests/flows/ 僅匯入 API 模組，以 test.step 與 expect 管理驗證。生成任一配對已存在時不覆寫，舊專案明確遷移。

取代 [原生 Playwright 決策](2026-11-07-native-playwright-tests.md) 中「請求與測試必須同檔」部分，其原生 runner／報告／非覆寫決策仍適用。

## 影響
每支操作增加一個模組，換取可組合性與統一契約。token 由同一次流程明確傳遞；草稿維持略過，不能移除 skip 造成假通過。移除單支測試時保留 API 模組，避免破壞流程引用；動態或自訂格式保留人工核對。
