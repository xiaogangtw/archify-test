import {useState} from 'react';
import {Button,Field,Input,Textarea,Notice} from '../../components/ui/controls';
import {Modal} from '../../components/ui/Modal';
import {Dropdown} from '../../components/ui/Dropdown';
import {api} from './controlApi';
import {loadScripts} from './scriptStorage';
import {readSharedDefinition,sharedSource,insertionOptions,type SharedDefinition,type FlowStep,type InsertionPoint} from './sharedFlow';
import type {ScriptDraft} from './scriptModel';
import type {EditableRequest} from '../../../../../services/control-api/src/apiContracts';

type ApiDescription={scriptId:string;scriptVersion:number;name:string;cases:{id:string;name:string;request:EditableRequest}[]};
type Slot={path:(string|number)[];step:FlowStep};
function slots(flow:SharedDefinition){
 const result:Slot[]=[];
 function walk(value:unknown,path:(string|number)[]){
  if(!value||typeof value!=='object')return;
  if((value as FlowStep).action==='apiFlow')result.push({path,step:value as FlowStep});
  for(const [key,child] of Object.entries(value))walk(child,[...path,Array.isArray(value)?Number(key):key]);
 }
 walk(flow,[]);return result;
}
function replace(flow:SharedDefinition,path:(string|number)[],step?:FlowStep){
 const updated=structuredClone(flow);let owner:any=updated;
 for(const key of path.slice(0,-1))owner=owner[key];
 if(step)owner[path.at(-1)!]=step;else owner.splice(Number(path.at(-1)),1);
 return updated;
}
export function ApiFlowControls({draft,disabled,onChange,onBusy}:{draft:ScriptDraft;disabled:boolean;onChange:(source:string)=>void;onBusy:(value:boolean)=>void}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [flow,setFlow]=useState<SharedDefinition>(),[items,setItems]=useState<Slot[]>([]),[editing,setEditing]=useState<Slot>();
 const [selected,setSelected]=useState<string[]>([]),[position,setPosition]=useState(''),[descriptions,setDescriptions]=useState<ApiDescription[]>([]);
 const [namespace,setNamespace]=useState('api'),[inputs,setInputs]=useState('{}'),[authVariable,setAuthVariable]=useState(''),[poll,setPoll]=useState('0');
 const [requests,setRequests]=useState<Record<string,string>>({});
 const catalog=loadScripts().filter(item=>item.apiFlow&&item.version>0);
 async function start(){
  setError('');
  try{const parsed=await readSharedDefinition(draft.source);setFlow(parsed);setItems(slots(parsed));setEditing(undefined);setSelected([]);setDescriptions([]);setNamespace(`api${slots(parsed).length+1}`);setInputs('{}');setAuthVariable('');setPoll('0');setRequests({});setPosition(JSON.stringify({path:['steps'],index:parsed.steps.length}));setOpen(true);}catch(reason){setError(String((reason as Error).message));}
 }
 async function configure(ids:string[],slot?:Slot){
  setBusy(true);onBusy(true);setError('');
  try{
   const loaded=await Promise.all(ids.map(id=>{const saved=catalog.find(item=>item.id===id);const version=slot?slot.step.scriptVersion:saved?.version;if(!version)throw new Error('找不到已儲存的 API 流程。');return api<ApiDescription>(`/e2e-api/flows/${encodeURIComponent(id)}/${version}`);}));
   const overrides=Array.isArray(slot?.step.overrides)?slot.step.overrides as {caseId:string;request:EditableRequest}[]:[];
   setRequests(Object.fromEntries(loaded.flatMap(item=>item.cases.map(saved=>[saved.id,JSON.stringify(overrides.find(value=>value.caseId===saved.id)?.request||saved.request,null,2)]))));
   setSelected(ids);setDescriptions(loaded);setEditing(slot);
   setNamespace(String(slot?.step.namespace||'api'));setInputs(JSON.stringify(slot?.step.inputs||{},null,2));setAuthVariable(String(slot?.step.authVariable||''));setPoll(String(slot?.step.pollTimeoutMs||0));
  }catch(reason){setError((reason as Error).message);}finally{setBusy(false);onBusy(false);}
 }
 async function commit(){
  if(!flow)return;
  try{
   if(!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(namespace))throw new Error('輸出前綴請使用英文字母開頭，搭配英數字與底線。');
   const params=JSON.parse(inputs);if(!params||Array.isArray(params)||typeof params!=='object'||Object.entries(params).some(([key,value])=>!(/^[A-Za-z][A-Za-z0-9_]{0,63}$/).test(key)||!['string','number','boolean'].includes(typeof value)))throw new Error('輸入參數必須是名稱對應文字、數字或布林值的 JSON 物件。');
   const added=descriptions.map((item,index):FlowStep=>({name:editing?editing.step.name:`API：${item.name}`,action:'apiFlow',scriptId:item.scriptId,scriptVersion:item.scriptVersion,namespace:descriptions.length===1?namespace:`${namespace}_${index+1}`,inputs:params,...(authVariable?{authVariable}:{}),pollTimeoutMs:Number(poll),overrides:item.cases.map(saved=>({caseId:saved.id,request:JSON.parse(requests[saved.id])}))}));
   let updated:SharedDefinition;
   if(editing)updated=replace(flow,editing.path,added[0]);
   else{
    const point=JSON.parse(position) as InsertionPoint;
    if(!insertionOptions(flow).some(option=>option.value===position))throw new Error('請重新選擇插入位置。');
    updated=structuredClone(flow);let owner:any=updated;for(const key of point.path.slice(0,-1))owner=owner[key];
    const key=point.path.at(-1)!,list=owner[key]||[];if(list.length+added.length>300)throw new Error('此區段超過步驟上限。');owner[key]=[...list.slice(0,point.index),...added,...list.slice(point.index)];
   }
   setBusy(true);onBusy(true);
   for(const step of added)await api('/e2e-api/validate',{method:'POST',body:JSON.stringify({step})});
   onChange(sharedSource(updated));setOpen(false);
  }catch(reason){setError((reason as Error).message);}finally{setBusy(false);onBusy(false);}
 }
 return <div className="space-y-2">
  <Button disabled={disabled||busy} onClick={()=>void start()}>帶入 API 流程</Button>
  {error&&!open&&<Notice error>{error}</Notice>}
  <Modal open={open} title={editing?'編輯 API 步驟':'帶入 API 流程'} onClose={()=>{if(!busy)setOpen(false);}}>
   {error&&<Notice error>{error}</Notice>}
   {!!items.length&&<div className="space-y-2"><p className="text-menu font-medium">目前的 API 步驟</p>{items.map(slot=><div key={JSON.stringify(slot.path)} className="flex flex-wrap items-center gap-2"><span className="min-w-0 break-words text-menu">{slot.step.name} · {String(slot.step.namespace)}</span><Button disabled={busy} onClick={()=>void configure([String(slot.step.scriptId)],slot)}>編輯參數</Button><Button variant="danger" disabled={busy} onClick={()=>{if(flow){onChange(sharedSource(replace(flow,slot.path)));setOpen(false);}}}>移除步驟</Button></div>)}</div>}
   {!editing&&<fieldset disabled={busy} className="space-y-2"><legend className="text-menu font-medium">選擇已儲存的 API 流程</legend>{catalog.length?catalog.map(item=><label key={item.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line p-3 text-menu hover:bg-canvas"><input type="checkbox" className="h-6 w-6 accent-brand focus-visible:ring-2 focus-visible:ring-brand" checked={selected.includes(item.id)} onChange={event=>void configure(event.target.checked?[...selected,item.id]:selected.filter(id=>id!==item.id))}/>{item.name} · v{item.version}</label>):<p className="text-menu text-muted">尚無已儲存的 API 流程，請先在 API 請求庫建立流程。</p>}</fieldset>}
   {!!descriptions.length&&<>
    {!editing&&<Dropdown label="插入位置" value={position} disabled={busy} options={flow?insertionOptions(flow):[]} onChange={setPosition}/>}
    <Field label="輸出變數前綴"><Input value={namespace} disabled={busy} onChange={event=>setNamespace(event.target.value)}/></Field>
    <p className="break-words text-menu text-muted">回應輸出會以「前綴_變數名稱」供後面的 API 使用，例如 {'{{login_token}}'}。多選流程依清單順序插入，前綴加上序號。</p>
    <Field label="本次輸入參數（JSON）"><Textarea rows={4} value={inputs} disabled={busy} onChange={event=>setInputs(event.target.value)}/></Field>
    <Field label="授權 token 變數名稱（選填）"><Input value={authVariable} placeholder="login_token" disabled={busy} onChange={event=>setAuthVariable(event.target.value)}/></Field>
    <Dropdown label="等待資料符合預期" value={poll} disabled={busy} options={[{value:'0',label:'只執行一次'},{value:'5000',label:'最多等待 5 秒'},{value:'10000',label:'最多等待 10 秒'},{value:'20000',label:'最多等待 20 秒'}]} onChange={setPoll}/>
    {descriptions.map(item=><section key={item.scriptId} className="space-y-3"><h3 className="text-body font-medium">{item.name} · v{item.scriptVersion}</h3>{item.cases.map(saved=><details key={saved.id} className="rounded-xl border border-line p-3"><summary className="min-h-11 cursor-pointer rounded-lg py-2 text-menu font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{saved.name}</summary><Field label="本次請求參數與斷言（JSON）"><Textarea rows={12} value={requests[saved.id]||''} disabled={busy} onChange={event=>setRequests({...requests,[saved.id]:event.target.value})}/></Field></details>)}</section>)}
    <p className="text-menu text-muted">只調整本次參數與斷言；方法、路徑與環境沿用共用版本。認證資料使用參照。輪詢只允許 GET／HEAD。</p>
   </>}
   <div className="flex flex-wrap gap-2" aria-busy={busy}><Button variant="primary" disabled={busy||!descriptions.length} onClick={()=>void commit()}>{editing?'套用參數':'插入流程'}</Button><Button disabled={busy} onClick={()=>setOpen(false)}>取消</Button></div>
  </Modal>
 </div>;
}
