import {useState} from 'react';
import {Button,Field,Input,Notice} from '../../components/ui/controls';
import {Dropdown} from '../../components/ui/Dropdown';
import {api} from './controlApi';
import type {RequestEnvironment} from '../../../../../services/control-api/src/apiContracts';

type VariableRow={id:string;name:string;value:string;header:boolean};
export function ApiEnvironmentPanel({root,environments,reload,environmentId}:{root:string;environments:RequestEnvironment[];reload:()=>Promise<void>;environmentId:string}){
 const blank=():RequestEnvironment=>({id:'env-'+crypto.randomUUID(),name:'',baseUrl:'',baseEnvironmentId:'',variables:{},headerVariables:[],secretVariables:[],projectIds:[],authReferences:[]});
 const first=environments.find(item=>item.id===environmentId)||blank();
 const [cloneSource,setCloneSource]=useState('');
 const [editing,setEditing]=useState<RequestEnvironment|null>(first||null);
 const rowsFor=(item:RequestEnvironment)=>Object.entries(item.variables||{}).map(([name,value])=>({id:crypto.randomUUID(),name,value,header:!!item.headerVariables?.includes(name)}));
 const [rows,setRows]=useState<VariableRow[]>(first?rowsFor(first):[]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
 function select(item:RequestEnvironment){setCloneSource('');setEditing({...item});setRows(rowsFor(item));setError('');setNotice('');}
 function rowEdit(id:string,change:Partial<VariableRow>){setRows(current=>current.map(row=>row.id===id?{...row,...change}:row));}
 async function save(){if(!editing||busy)return;setBusy(true);setError('');try{
  const entries=rows.filter(row=>row.name.trim()||row.value);if(entries.some(row=>!row.name.trim()))throw new Error('請填寫變量名稱。');if(new Set(entries.map(row=>row.name.trim())).size!==entries.length)throw new Error('變量名稱不可重複。');
  await api(root+'/environments',{method:'PUT',body:JSON.stringify({id:editing.id,name:editing.name,baseEnvironmentId:editing.baseEnvironmentId||editing.id,baseUrl:editing.baseUrl,variables:Object.fromEntries(entries.map(row=>[row.name.trim(),row.value])),headerVariables:entries.filter(row=>row.header).map(row=>row.name.trim()),tokenVariable:editing.tokenVariable||'authToken',tokenHeader:editing.tokenHeader||'Authorization',tokenPrefix:editing.tokenPrefix??'Bearer '})});await reload();setNotice('環境設定已儲存。');
 }catch(reason){setError(reason instanceof Error?reason.message:'環境儲存失敗');}finally{setBusy(false);}}
 return <div className="min-w-0 space-y-5">
  {error&&<Notice error>{error}</Notice>}{notice&&<Notice>{notice}</Notice>}
  <div className="grid min-w-0 items-start gap-5 md:grid-cols-3">
   <aside aria-label="環境清單" className="min-w-0 space-y-2 md:col-span-1"><Button className="w-full" disabled={busy} onClick={()=>select(blank())}>新增環境</Button>
    {environments.map(item=><div key={item.id} className={'flex min-w-0 items-center rounded-lg '+(editing?.id===item.id?'bg-brand-soft text-brand':'text-ink')}><button type="button" disabled={busy} aria-pressed={editing?.id===item.id} onClick={()=>select(item)} className="min-h-11 min-w-0 flex-1 break-words rounded-lg px-3 py-2 text-left font-medium hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50">{item.name}</button><Button variant="ghost" aria-label={'編輯環境 '+item.name} disabled={busy} onClick={()=>select(item)}><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5"/></svg></Button></div>)}
   </aside>
   <section aria-label="環境表單" className="min-w-0 space-y-5 md:col-span-2">
    <h3 className="text-body font-medium">{environments.some(item=>item.id===editing?.id)?'編輯環境':'新增環境'}</h3>
    <Field label="複製環境參數"><Dropdown label="複製環境參數" value={cloneSource} options={[{value:'',label:'從其他環境複製…'},...environments.filter(item=>item.id!==editing?.id).map(item=>({value:item.id,label:item.name}))]} disabled={busy||!environments.length} onChange={id=>{const source=environments.find(item=>item.id===id);setCloneSource(id);if(!source||!editing)return;setEditing({...editing,name:editing.name||source.name+' 副本',baseUrl:source.baseUrl,baseEnvironmentId:source.baseEnvironmentId||source.id,variables:{...source.variables},headerVariables:[...(source.headerVariables||[])],tokenVariable:source.tokenVariable,tokenHeader:source.tokenHeader,tokenPrefix:source.tokenPrefix});setRows(rowsFor(source));setNotice('已複製一般參數，尚未儲存；登入 Token 不會複製。');setError('');}}/></Field>
  {!environments.length&&<p className="text-menu text-muted">尚無允許的目標環境，請先完成伺服器設定。</p>}
  {editing&&<fieldset disabled={busy} className="min-w-0 space-y-5">
   <div className="grid min-w-0 gap-4 md:grid-cols-2"><Field label="環境名稱"><Input value={editing.name} maxLength={100} onChange={event=>setEditing({...editing,name:event.target.value})}/></Field><Field label="前置 URL"><Input value={editing.baseUrl} onChange={event=>setEditing({...editing,baseUrl:event.target.value})}/></Field></div>
   <Field label="允許的目標設定"><Dropdown label="允許的目標設定" value={editing.baseEnvironmentId||''} options={[{value:'',label:'請選擇允許的目標'},...[...new Map(environments.map(item=>[item.baseEnvironmentId||item.id,{value:item.baseEnvironmentId||item.id,label:item.name}])).values()]]} onChange={id=>{const source=environments.find(item=>(item.baseEnvironmentId||item.id)===id);setEditing({...editing,baseEnvironmentId:id,baseUrl:editing.baseUrl||source?.baseUrl||''});}}/></Field>
   <div className="space-y-3"><h3 className="text-body font-medium">環境變量</h3><p className="text-menu text-muted">請求可使用 {'{{變量名}}'}；同名 GraphQL 變數會自動帶入。勾選 Header 可自動帶入同名請求標頭。</p>
    {rows.map(row=><div key={row.id} className="grid min-w-0 gap-3 rounded-lg border border-line p-3 md:grid-cols-3"><Field label="變量名稱"><Input value={row.name} onChange={event=>rowEdit(row.id,{name:event.target.value})}/></Field><Field label="變量值"><Input value={row.value} onChange={event=>rowEdit(row.id,{value:event.target.value})}/></Field><div className="flex flex-wrap items-center gap-3"><label className="flex min-h-11 items-center gap-2 text-menu"><input type="checkbox" checked={row.header} onChange={event=>rowEdit(row.id,{header:event.target.checked})} className="h-5 w-5 accent-brand"/>自動帶入 Header</label><Button variant="danger" aria-label={'移除變量 '+(row.name||'未命名')} onClick={()=>setRows(current=>current.filter(item=>item.id!==row.id))}>移除</Button></div></div>)}
    <Button onClick={()=>setRows(current=>[...current,{id:crypto.randomUUID(),name:'',value:'',header:false}])}>新增變量</Button>
    {!!environments.find(item=>item.id===editing.id)?.secretVariables?.length&&<p className="text-menu text-muted">已取得秘密變量：{environments.find(item=>item.id===editing.id)?.secretVariables?.join('、')}。由登入流程管理，值不顯示於網頁。</p>}
   </div>
   <details className="space-y-4 rounded-lg border border-line p-4"><summary className="min-h-11 cursor-pointer rounded-lg py-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">認證與目標設定</summary>

    <div className="grid min-w-0 gap-4 md:grid-cols-3"><Field label="Token 變量名稱"><Input value={editing.tokenVariable||'authToken'} onChange={event=>setEditing({...editing,tokenVariable:event.target.value})}/></Field><Field label="自動帶入的 Header"><Input value={editing.tokenHeader||'Authorization'} onChange={event=>setEditing({...editing,tokenHeader:event.target.value})}/></Field><Field label="Header 值前綴"><Input value={editing.tokenPrefix??'Bearer '} onChange={event=>setEditing({...editing,tokenPrefix:event.target.value})}/></Field></div>
    <p className="text-menu text-muted">satoken 的前綴留空；Bearer 認證填入 Bearer 加一個空白。秘密值由伺服器認證參照或登入回應取得，12 小時到期。</p>
    <Button variant="danger" disabled={busy||!environments.find(item=>item.id===editing.id)?.secretVariables?.length} onClick={()=>{setBusy(true);setError('');void api(root+'/environments/'+encodeURIComponent(editing.id)+'/tokens',{method:'DELETE'}).then(reload).then(()=>setNotice('環境 Token 已清除。')).catch(reason=>setError(reason.message)).finally(()=>setBusy(false));}}>清除環境 Token</Button>
   </details>
   <Button variant="primary" disabled={busy||!editing.name.trim()||!editing.baseUrl.trim()||!editing.baseEnvironmentId} onClick={()=>void save()}>{busy?'儲存中…':'儲存環境'}</Button>
  </fieldset>}
   </section>
  </div>
 </div>;
}
