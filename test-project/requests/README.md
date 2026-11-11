# 共用請求

放置可重用的非秘密 HTTP／GraphQL 呼叫函式。函式從參數或 process.env 取得設定，明確設定 timeout，不在 import 時發送請求。業務斷言保留於案例步驟。
