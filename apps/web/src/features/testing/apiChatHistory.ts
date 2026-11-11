export interface ChatJob {
 id:string;status:string;message:string;scriptId?:string;
 tasks:{name:string;status:string;message?:string;caseId?:string}[];
}
export interface ChatMessage {
 id:string;role:'user'|'assistant';text:string;context?:string;job?:ChatJob;pending?:boolean;question?:{prompt:string;options:string[]};
}
export interface ChatThread {id:string;title:string;messages:ChatMessage[];updatedAt:string}
export const chatKey=(projectId:string)=>'archify.api-chat.v2.'+projectId;
export function newChat():ChatThread {
 return {id:crypto.randomUUID(),title:'新對話',messages:[],updatedAt:new Date().toISOString()};
}
export function readChats(storage:Pick<Storage,'getItem'>,projectId:string):ChatThread[]{
 const raw=storage.getItem(chatKey(projectId));
 if(!raw)return [];
 const value:unknown=JSON.parse(raw);
 if(!Array.isArray(value)||value.length>30||new Set(value.map(item=>item?.id)).size!==value.length)throw new Error('無法讀取聊天紀錄，原資料未被覆寫。');
 for(const thread of value){
  if(!thread||typeof thread.id!=='string'||typeof thread.title!=='string'||typeof thread.updatedAt!=='string'||!Array.isArray(thread.messages)||thread.messages.length>200||new Set(thread.messages.map((item:ChatMessage)=>item?.id)).size!==thread.messages.length)throw new Error('聊天紀錄格式無效，原資料未被覆寫。');
  for(const item of thread.messages)if(!item||typeof item.id!=='string'||!['user','assistant'].includes(item.role)||typeof item.text!=='string'||item.text.length>40000||item.context!==undefined&&typeof item.context!=='string'||item.job&&(!item.job.id||typeof item.job.status!=='string'||!Array.isArray(item.job.tasks)))throw new Error('聊天訊息格式無效，原資料未被覆寫。');
 }
 for(const thread of value)for(const item of thread.messages){
  if(item.question&&(item.role!=='assistant'||typeof item.question.prompt!=='string'||!item.question.prompt.trim()||item.question.prompt.length>2000||!Array.isArray(item.question.options)||item.question.options.length>4||!item.question.options.every((option:unknown)=>typeof option==='string'&&!!option.trim()&&option.length<=120)))throw new Error('聊天問題格式無效，原資料未被覆寫。');
  const job=item.job;
  if(job&&(typeof job.id!=='string'||typeof job.message!=='string'||job.scriptId!==undefined&&typeof job.scriptId!=='string'||!job.tasks.every((task:ChatJob['tasks'][number])=>task&&typeof task.name==='string'&&typeof task.status==='string'&&(task.message===undefined||typeof task.message==='string')&&(task.caseId===undefined||typeof task.caseId==='string'))))throw new Error('工作紀錄格式無效，原資料未被覆寫。');
 }
 return (value as ChatThread[]).map(thread=>({...thread,messages:thread.messages.map(message=>message.pending?{...message,pending:false,text:'這次回覆因離開頁面而中斷，可重新提問。'}:message)}));
}
export function busyThread(thread:ChatThread){return thread.messages.some(item=>item.job&&['queued','running'].includes(item.job.status));}
