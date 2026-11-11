export type AgentInstructions={requestId:string;content:string}[];
const MAX_REQUESTS=100,MAX_CHARACTERS=100000;

// This is a durable record of user requests, not model-generated permissions.
// Refuse overflow instead of silently forgetting earlier constraints.
export function appendAgentInstruction(current:AgentInstructions,requestId:string,content:string):AgentInstructions{
 if(current.some(item=>item.requestId===requestId))return current;
 if(current.length>=MAX_REQUESTS||current.reduce((size,item)=>size+item.content.length,0)+content.length>MAX_CHARACTERS){
  throw Object.assign(new Error('任務需求紀錄已達上限，請另開對話；既有需求與草稿仍保留。'),{statusCode:413});
 }
 return [...current,{requestId,content}];
}
