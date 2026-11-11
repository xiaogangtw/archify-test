export interface Agent { id:string; name:string; description:string; instructions:string; model:string; promptRevision?:number;modelConnectionId?:string;modelProvider?:'codex'|'claude'|'gemini'|'api' }
export interface Connection { provider:'OpenAI'|'Anthropic'|'Google'|'自訂'; method:'account'|'api'; endpoint:string; model:string }
export interface Message { id:string; role:'user'|'assistant'; text:string; agentName:string }
export { defaultAgents } from '../../../../../services/control-api/src/agentDefaults';
export const defaultConnection:Connection={provider:'OpenAI',method:'api',endpoint:'',model:''};
export function demoReply(agent:Agent,text:string):string {
 if(agent.id==='code')return '【示範回覆】\n請提供要分析的檔案或 API。我會整理：\n1. 路由與輸入參數\n2. 成功及錯誤回應\n3. 可建立的測試與來源依據\n\n目前尚未讀取任何程式碼或連線模型。';
 if(agent.id==='debug')return '【示範回覆】\n建議先核對三項資料：\n1. 預期與實際的狀態碼\n2. 測試帳號角色與資料前置條件\n3. 本次執行的來源版本\n\n提供失敗步驟後，可繼續整理排查方向。目前未呼叫真實模型。';
 return `【示範回覆】\n針對「${text.slice(0,100)}」，可先整理成：\n1. 前置條件：準備測試帳號與專用資料\n2. 操作步驟：取得列表 → 查看詳情 → 確認結果\n3. 預期結果：狀態碼與必要欄位符合規格\n\n這是固定範例；${agent.name} 的自訂指示將在接入真實模型後使用。`;
}

