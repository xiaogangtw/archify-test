import {z} from 'zod';
import {createHash} from 'node:crypto';
export const connectionSchema=z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(100),provider:z.enum(['codex','claude','gemini','api']),agentId:z.string().min(1).max(100),model:z.string().max(100).regex(/^$|^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/),enabled:z.boolean(),globalDefault:z.boolean().optional()}).strict();
export const connectionsSchema=z.array(connectionSchema).max(50).refine(items=>new Set(items.map(item=>item.id)).size===items.length,'Duplicate connection ID').refine(items=>items.filter(item=>item.globalDefault).length<=1,'Only one global default').refine(items=>items.every(item=>!item.globalDefault||item.enabled),'Global default must be enabled');
export type ModelConnection=z.infer<typeof connectionSchema>;
export function legacyConnections(choice:any):ModelConnection[] {return [{id:'legacy-default',name:'既有模型連線',provider:choice?.provider || 'codex',agentId:choice?.agentId || 'planner',model:'',enabled:true}];}
export function resolveConnection(profiles:ModelConnection[],id?:string,agentId?:string) {
  const matches=profiles.filter(item=>item.enabled && (id?item.id===id:!agentId || item.agentId===agentId));
  if(matches.length!==1)throw Object.assign(new Error(matches.length?'此角色有多個連線，請在連線管理選擇要使用的連線。':'找不到啟用的模型連線，請先新增連線。'),{statusCode:409});
  if(agentId && matches[0].agentId!==agentId)throw Object.assign(new Error('所選連線綁定其他 Agent，請重新選擇。'),{statusCode:409});
  return matches[0];
}
export function resolveAgentConnection(profiles:ModelConnection[],agents:any[],agentId:string,id?:string) {
 const agent=agents.find(item=>item.id===agentId);
 if(!agent)throw Object.assign(new Error('找不到 Agent。'),{statusCode:409});
 const target=agent.modelConnectionId||id;
 let choice:ModelConnection|undefined;
 if(target){choice=profiles.find(item=>item.id===target);if(!choice?.enabled)throw Object.assign(new Error('指定連線不可用，請調整 Agent 模型。'),{statusCode:409});if(agent.modelConnectionId&&id&&id!==agent.modelConnectionId)throw Object.assign(new Error('Agent 模型設定已變更，請重新開始工作。'),{statusCode:409});}
 else if(agent.modelProvider)throw Object.assign(new Error('未設定 '+agent.modelProvider+' 連線。'),{statusCode:409});
 else {choice=profiles.find(item=>item.globalDefault&&item.enabled);if(!choice&&profiles.every(item=>item.globalDefault===undefined)&&profiles.filter(item=>item.enabled).length===1)choice=profiles.find(item=>item.enabled);if(!choice)throw Object.assign(new Error('請設定全域預設模型。'),{statusCode:409});}
 if(agent.modelProvider&&choice.provider!==agent.modelProvider)throw Object.assign(new Error('Agent 工具與連線不符。'),{statusCode:409});
 return choice;
}
export function connectionFingerprint(connection:ModelConnection,agent:any) {const {globalDefault,...transport}=connection;return createHash('sha256').update(JSON.stringify({connection:transport,instructions:agent?.instructions,...(agent?.modelConnectionId||agent?.modelProvider?{routing:{connectionId:agent.modelConnectionId,provider:agent.modelProvider}}:{})})).digest('hex');}
export function connectionHealth(connection:ModelConnection,agent:any,online:boolean,installed:boolean,check:any,now=Date.now()) {
  if(!connection.enabled)return {state:'disabled',message:'已停用',checkedAt:check?.checked_at || null};
  if(!agent)return {state:'failed',message:'綁定的 Agent 已刪除',checkedAt:null};
  if(connection.provider!=='api' && (!online || !installed))return {state:'failed',message:!online?'本機橋接未回報':'橋接未偵測到此工具',checkedAt:check?.checked_at || null};
  if(!check || check.fingerprint!==connectionFingerprint(connection,agent))return {state:'unknown',message:'尚未驗證此設定',checkedAt:null};
  if(check.status==='checking' && now-new Date(check.started_at).getTime()<210000)return {state:'checking',message:'正在驗證模型回覆',checkedAt:null};
  if(check.status==='passed' && now-new Date(check.checked_at).getTime()<15*60*1000)return {state:'passed',message:'最近一次模型驗證成功',checkedAt:check.checked_at};
  if(check.status==='passed')return {state:'unknown',message:'驗證已過期，等待下次實際請求',checkedAt:check.checked_at};
  return {state:'failed',message:check.message || '模型連線驗證失敗',checkedAt:check.checked_at};
}
