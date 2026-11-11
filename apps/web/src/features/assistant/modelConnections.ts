import {useEffect,useState} from 'react';
import {api,serverStorage} from '../testing/controlApi';
export interface ModelConnection {id:string;name:string;provider:string;agentId:string;model:string;enabled:boolean;globalDefault?:boolean}
export interface ConnectionView extends ModelConnection {verificationKey?:string;reportedModel?:string|null;agentName:string;health:{state:'passed'|'failed'|'checking'|'unknown'|'disabled';message:string;checkedAt:string|null}}
const attemptedChecks=new Set<string>();
export function automaticCheckKey(connection:ConnectionView):string|null {
  if(!connection.enabled || connection.health.state!=='unknown' || connection.health.checkedAt)return null;
  return connection.verificationKey || JSON.stringify([connection.id,connection.provider,connection.agentId,connection.model]);
}
export const connectionKey='archify.llm-connections.v1';
export const providerNames:Record<string,string>={codex:'Codex',claude:'Claude Code',gemini:'Gemini CLI',api:'自訂 API'};
export function selectedConnectionForAgent(agentId:string):string|undefined {
  try{return JSON.parse(localStorage.getItem('archify.connection-selection.v1') || '{}')[agentId];}catch{return undefined;}
}
export function chooseConnection(connection:ModelConnection) {
  const current=JSON.parse(localStorage.getItem('archify.connection-selection.v1') || '{}');
  localStorage.setItem('archify.connection-selection.v1',JSON.stringify({...current,[connection.agentId]:connection.id}));
  window.dispatchEvent(new Event('archify-connection-change'));
}
export function useModelConnections() {
  const [connections,setConnections]=useState<ConnectionView[]>([]);
  const [error,setError]=useState('');const [loaded,setLoaded]=useState(false);
  const [generation,setGeneration]=useState(0);
  useEffect(()=>{
    let active=true;let timer:ReturnType<typeof setTimeout>;
    async function poll(){
      try{const value=await api<{connections:ConnectionView[]}>('/llm/connections');if(active){setConnections(value.connections);setError('');setLoaded(true);
        for(const connection of value.connections){
          const key=automaticCheckKey(connection);
          if(!key || attemptedChecks.has(key))continue;
          attemptedChecks.add(key);
          void api(`/llm/connections/${encodeURIComponent(connection.id)}/check`,{method:'POST',body:'{}'}).catch(reason=>{if(active)setError(`自動驗證未能啟動：${reason instanceof Error?reason.message:'請稍後重試'}`);});
        }}}
      catch(reason){if(active){setError(reason instanceof Error?/^(?:HTTP 404|Not Found)$/i.test(reason.message)?'此 Control API 尚未支援連線管理，請先更新 VM。':reason.message:'無法取得連線狀態');setLoaded(true);}}
      finally{if(active)timer=setTimeout(poll,5000);}
    }
    void poll();return()=>{active=false;clearTimeout(timer);};
  },[generation]);
  return {connections,error,loaded,reload:()=>setGeneration(value=>value+1),save:async(next:ModelConnection[])=>{
    await serverStorage.setItem(connectionKey,JSON.stringify(next));setGeneration(value=>value+1);
  }};
}
