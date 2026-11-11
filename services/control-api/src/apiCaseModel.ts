export interface ApiCaseDraft {
  id:string; name:string; method:string; endpoint:string; operationName:string;
  requestBody:string; variables:string; authReference:string; preconditions:string;
  assertions:string; missing:string; evidence:string;
}
const fields=['name','method','endpoint','operationName','requestBody','variables','authReference','preconditions','assertions','missing','evidence'] as const;
export function missingDetails(value:string):string {
 const text=value.trim();
 return /^(?:無|無缺漏|無缺失|無待補資料|不需補充|不需要補充|不需認證|不需要認證|none|n\/?a|null|無需補充)[。.!！]?$/i.test(text)?'':text;
}
export function apiCaseStatus(value:string):string {
 const text=missingDetails(value);
 if(!text)return '草稿，待驗證';
 if(/【來源解析】|未解析引用|未解析匯出|缺.{0,100}(?:實作|alias|gql|query 字串|client 設定)/i.test(text))return '來源待解析';
 if(/【測試設定】/.test(text))return '待補測試設定';
 if(/【行為確認】/.test(text))return '待確認呼叫行為';
 return '待確認，展開查看原因';
}
export function parseApiCases(reply:string):ApiCaseDraft[] {
  const parsed:unknown=JSON.parse(reply.trim().replace(/^```(?:json)?\s*|\s*```$/g,''));
  if(!Array.isArray(parsed) || parsed.length>100)throw new Error('LLM 未回傳有效的案例清單，請重試。');
  return parsed.map(item=>{
    if(!item || typeof item!=='object' || !fields.every(key=>typeof item[key]==='string' && item[key].length<=16000) || !item.name.trim() || !item.evidence.trim())throw new Error('LLM 案例格式或來源依據不完整，請重試。');
    return Object.fromEntries([['id',crypto.randomUUID()],...fields.map(key=>[key,key==='missing'?missingDetails(item[key]):item[key]])]) as unknown as ApiCaseDraft;
  });
}
export const apiCasePrompt = `分析本段前端程式碼，整理成 Apifox 風格的 API 測試案例草稿。不得執行請求，不得虛構網址、認證、參數或來源。追蹤 REST 與 GraphQL query/mutation、字串常數、requestBody.query、operationName 與 client 包裝；跨段缺失資訊寫入 missing。所有案例都尚未執行驗證。只在外層 JSON 的 reply 字串放入 JSON 陣列；source 不輸出。每項的以下欄位全部為字串：name、method（未知填 UNKNOWN）、endpoint（未知留空）、operationName、requestBody（請求 JSON 文字）、variables（JSON 文字）、authReference（只用非秘密參照，不放憑證）、preconditions、assertions、missing、evidence（來源檔案路徑與行號；不確定行號明說）。GraphQL 斷言需區分 HTTP 與 errors。mutation 標明資料變更與前置條件。非負整數等斷言必須有原始碼依據；建議須標示為建議。沒有足夠請求證據回傳空陣列。`;
