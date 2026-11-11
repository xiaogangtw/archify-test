import {ToolIcon} from '../../components/ui/ToolIcon';
import {useEffect,useRef,useState} from 'react';
import type {AssistantState} from './useAssistant';
import {Button,Field,Input,Notice} from '../../components/ui/controls';
import {Dropdown} from '../../components/ui/Dropdown';
import {api} from '../testing/controlApi';
import {ConnectionLight} from './ConnectionLight';
import {providerNames,useModelConnections,type ModelConnection,type ConnectionView} from './modelConnections';
export function ConnectionSettings({assistant,canConfigure,initialProvider,onCreated,onCancel}:{assistant:AssistantState;canConfigure:boolean;initialProvider?:string;onCreated?:(connection:ModelConnection)=>void;onCancel?:()=>void}) {
 const {connections,error,loaded,reload,save}=useModelConnections();
 const [draft,setDraft]=useState<ModelConnection|null>(()=>initialProvider?{id:crypto.randomUUID(),name:'',provider:initialProvider,agentId:assistant.draft.id,model:'',enabled:true,globalDefault:false}:null);
 const [modelChoice,setModelChoice]=useState('');
 const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const [failure,setFailure]=useState('');
 const [,setSelection]=useState(0);
 const checking=useRef(new Set<string>());
 const initializedProvider=useRef(false);
 useEffect(()=>{if(initialProvider&&loaded&&!initializedProvider.current){initializedProvider.current=true;setDraft(current=>current?{...current,globalDefault:!connections.some(item=>item.enabled)}:current);}},[initialProvider,loaded,connections]);
 const [pending,setPending]=useState<string[]>([]);
 useEffect(()=>{const changed=()=>setSelection(value=>value+1);window.addEventListener('archify-connection-change',changed);window.addEventListener('storage',changed);return()=>{window.removeEventListener('archify-connection-change',changed);window.removeEventListener('storage',changed);};},[]);
 const profiles=connections.map(({id,name,provider,agentId,model,enabled,globalDefault})=>({id,name,provider,agentId,model,enabled,...(globalDefault!==undefined?{globalDefault}: {})}));
 const configuredModels=[...new Set(profiles.filter(item=>item.provider===draft?.provider&&item.model).map(item=>item.model))];
 async function mutate(next:ModelConnection[]) {
  setBusy(true);setFailure('');setNotice('');
  try{const enabled=profiles.filter(item=>item.enabled);if(!next.some(item=>item.globalDefault)&&enabled.length===1&&enabled[0].globalDefault===undefined&&next.filter(item=>item.enabled).length>1)next=next.map(item=>item.id===enabled[0].id?{...item,globalDefault:true}:item);await save(next);return true;}catch(reason){setFailure(reason instanceof Error?reason.message:'儲存失敗');return false;}finally{setBusy(false);}
 }
 async function submit() {
  if(!draft)return;
  if(!draft.name.trim()){setFailure('請填寫連線名稱。');return;}
  if(!assistant.agents.some(agent=>agent.id===draft.agentId)){setFailure('請選擇有效 Agent。');return;}
  if(draft.model && !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(draft.model)){setFailure('模型名稱請使用工具支援的識別字。');return;}
  const item={...draft,name:draft.name.trim(),model:draft.model.trim()};
  const next=profiles.some(profile=>profile.id===item.id)?profiles.map(profile=>profile.id===item.id?item:profile):[...profiles,item];
  if(!await mutate(item.globalDefault?next.map(profile=>({...profile,globalDefault:profile.id===item.id})):next))return;
  setDraft(null);setNotice('連線已儲存。');
  if(item.enabled){
   try{await api(`/llm/connections/${encodeURIComponent(item.id)}/check`,{method:'POST',body:'{}'});setNotice('連線已儲存，正在自動驗證模型。');reload();}
   catch(reason){setFailure(`設定已儲存，但驗證未啟動：${reason instanceof Error?reason.message:'請稍後重試'}`);}
  }
  onCreated?.(item);
 }
 async function testConnection(connection:ConnectionView) {
  if(checking.current.has(connection.id) || !connection.enabled || connection.health.state==='passed' || connection.health.state==='checking')return;
  checking.current.add(connection.id);setPending([...checking.current]);setFailure('');
  try {
   await api(`/llm/connections/${encodeURIComponent(connection.id)}/check`,{method:'POST',body:'{}'});reload();
   const deadline=Date.now()+210000;
   while(Date.now()<deadline){
    await new Promise(resolve=>setTimeout(resolve,2000));
    const state=await api<{connections:ConnectionView[]}>('/llm/connections');
    const current=state.connections.find(item=>item.id===connection.id);
    if(!current || !['checking','unknown'].includes(current.health.state))break;
   }
   reload();
  }catch(reason){setFailure(reason instanceof Error?reason.message:'測試連線失敗');}
  finally{checking.current.delete(connection.id);setPending([...checking.current]);}
 }
 async function select(item:ModelConnection){if(await mutate(profiles.map(profile=>({...profile,globalDefault:profile.id===item.id})))){setNotice('已設為全域預設。');if(initialProvider==='')onCreated?.(item);}}
 return <div className="space-y-6">
  {(error || failure) && <Notice error>{failure || error}</Notice>}{notice && <Notice>{notice}</Notice>}
  <section className="space-y-4 rounded-xl border border-line bg-surface p-5 md:p-6">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-heading font-bold">已設定的連線</h2><Button variant="primary" disabled={!canConfigure || busy || !loaded || !!error || profiles.length>=50} onClick={()=>{setDraft({id:crypto.randomUUID(),name:'',provider:'codex',agentId:assistant.agents[0].id,model:'',enabled:true,globalDefault:!profiles.some(item=>item.enabled)});setModelChoice('');setFailure('');}}>新增連線</Button></div>
   {!loaded && <p role="status">正在讀取連線…</p>}
   {loaded && !error && !connections.length && <p className="text-muted">尚未新增連線。</p>}
   {connections.map(connection=><div key={connection.id} className="space-y-3 rounded-lg border border-line p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="truncate font-medium" title={connection.name}>{connection.name}</h3><p className="break-words text-body text-muted">{providerNames[connection.provider]} · {connection.model || '工具預設模型'}</p></div>{!error && <ConnectionLight connection={connection}/>}</div>
    <p className="break-words text-menu text-muted">指定：{connection.model||'工具預設'} · 實際回報：{connection.reportedModel||'未回報'}</p>
    {connection.health.checkedAt && <p className="text-body text-muted">最後模型驗證：{new Date(connection.health.checkedAt).toLocaleString('zh-TW')}</p>}
    <div className="flex flex-wrap items-center gap-3">
     <Button disabled={!canConfigure || busy || !!error || !connection.enabled || pending.includes(connection.id) || connection.health.state==='checking' || connection.health.state==='passed'} onClick={()=>void testConnection(connection)}>{connection.health.state==='passed'?'已確認連線':pending.includes(connection.id) || connection.health.state==='checking'?'測試中…':'測試連線'}</Button>
     {connection.enabled&&(connection.globalDefault||connections.every(item=>item.globalDefault===undefined)&&connections.filter(item=>item.enabled).length===1?<span className="text-menu text-success">全域預設</span>:<Button disabled={busy||!canConfigure} onClick={()=>void select(connection)}>設為全域預設</Button>)}
     <Button disabled={!canConfigure || busy || !!error} onClick={()=>{setDraft({...profiles.find(profile=>profile.id===connection.id)!,globalDefault:connection.globalDefault??(connections.every(item=>item.globalDefault===undefined)&&connections.filter(item=>item.enabled).length===1)});setModelChoice(connection.model?'__custom__':'');}}>編輯</Button>
     <Button disabled={!canConfigure || busy || !!error} onClick={()=>void mutate(profiles.map(profile=>profile.id===connection.id?{...profile,enabled:!profile.enabled,...(profile.enabled?{globalDefault:false}:{})}:profile))}>{connection.enabled?'停用':'啟用'}</Button>
     <Button aria-label="刪除" variant="danger" disabled={!canConfigure || busy || !!error} onClick={()=>void mutate(profiles.filter(profile=>profile.id!==connection.id))}><ToolIcon name="trash"/></Button>
    </div>
   </div>)}
  </section>
  {draft && <form className="space-y-5 rounded-xl border border-line bg-surface p-5 md:p-6" onSubmit={event=>{event.preventDefault();void submit();}}>
   <h2 className="text-heading font-bold">連線設定</h2>
   <fieldset disabled={busy || !canConfigure||!loaded} className="space-y-5">
    <Field label="連線名稱"><Input required maxLength={100} value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})} placeholder="例如：Codex API 分析"/></Field>
    <div className="grid gap-3 md:grid-cols-2"><Dropdown label="使用工具" value={draft.provider} options={Object.entries(providerNames).map(([value,label])=>({value,label}))} onChange={provider=>{setDraft({...draft,provider,model:''});setModelChoice('');}}/><Dropdown label="指定模型" value={modelChoice==='__custom__'?'__custom__':draft.model} options={[{value:'',label:'工具預設'},...configuredModels.map(model=>({value:model,label:model})),{value:'__custom__',label:'自訂模型'}]} onChange={value=>{setModelChoice(value);if(value!=='__custom__')setDraft({...draft,model:value});}}/></div>
    {modelChoice==='__custom__'&&<Field label="模型識別字"><Input required maxLength={100} value={draft.model} placeholder="例如 gpt-6.1-sol" onChange={event=>setDraft({...draft,model:event.target.value})}/></Field>}
    <label className="flex min-h-8 items-center gap-2 text-menu"><input type="checkbox" className="h-4 w-4 accent-brand" checked={!!draft.globalDefault} disabled={!draft.enabled} onChange={event=>setDraft({...draft,globalDefault:event.target.checked})}/>全域預設</label>
   </fieldset>
   <div className="flex flex-wrap gap-3"><Button type="submit" variant="primary" disabled={busy || !canConfigure}>{busy?'儲存中…':'儲存連線'}</Button><Button disabled={busy} onClick={()=>{setDraft(null);onCancel?.();}}>取消</Button></div>
  </form>}

 </div>;
}
