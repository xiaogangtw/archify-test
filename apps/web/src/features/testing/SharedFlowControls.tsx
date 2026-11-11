import {useEffect,useState} from 'react';
import {Button,Field,Input,Notice} from '../../components/ui/controls';
import {Dropdown} from '../../components/ui/Dropdown';
import {Modal} from '../../components/ui/Modal';
import {loadScripts,scriptHistoryKey} from './scriptStorage';
import {saveScript} from './controlApi';
import type {ScriptDraft} from './scriptModel';
import {actorLabel,applyShared,insertionOptions,bindSharedRole,sharedReferences,extractShared,readSharedDefinition,referenceStep,sharedSource,type SharedDefinition,type InsertionPoint} from './sharedFlow';

export function SharedFlowControls({draft,disabled,onChange,onBusy}:{draft:ScriptDraft;disabled:boolean;onChange:(source:string)=>void;onBusy:(busy:boolean)=>void}){
 const [mode,setMode]=useState<'apply'|'extract'|null>(null);
 const [definition,setDefinition]=useState<SharedDefinition|null>(null);
 const [catalog,setCatalog]=useState<ScriptDraft[]>([]);
 const [selected,setSelected]=useState('');
 const [count,setCount]=useState('1');
 const [name,setName]=useState('');
 const [actor,setActor]=useState('');
 const [applyMode,setApplyMode]=useState('insert');
 const [position,setPosition]=useState('');
 const [error,setError]=useState('');
 const [pending,setPending]=useState(false);
 const [current,setCurrent]=useState<{source:string;flow:SharedDefinition;dual:string[];single:string[]}|null>(null);
 const [parsedChild,setParsedChild]=useState<{id:string;flow:SharedDefinition}|null>(null);
 useEffect(()=>{
  let live=true;
  void (async()=>{
   const flow=await readSharedDefinition(draft.source),dual:string[]=[],single:string[]=[];
   const saved=[...loadScripts(),...loadScripts(scriptHistoryKey)];
   await Promise.all(sharedReferences(flow).map(async({path,step})=>{
    const script=saved.find(item=>item.id===step.scriptId&&item.version===step.scriptVersion);
    if(!script)return;
    try{const child=await readSharedDefinition(script.source);(child.actors?dual:single).push(JSON.stringify(path));}catch{/* Server validates unavailable or invalid referenced versions. */}
   }));
   if(live)setCurrent({source:draft.source,flow,dual,single});
  })().catch(()=>{if(live)setCurrent(null);});
  return()=>{live=false;};
 },[draft.source]);
 useEffect(()=>{let live=true;setParsedChild(null);const script=catalog.find(item=>item.id===selected);if(script)void readSharedDefinition(script.source).then(flow=>{if(live)setParsedChild({id:selected,flow});},reason=>{if(live)setError(reason instanceof Error?reason.message:'無法讀取共用流程。');});return()=>{live=false;};},[selected,catalog]);
 const child=parsedChild?.id===selected?parsedChild.flow:undefined;
 const currentFlow=current?.source===draft.source?current.flow:undefined;
 const roles=definition?.actors||[];
 const requiresRole=applyMode==='insert'&&!!child&&!child.actors&&roles.length>1;
 const positions=definition?insertionOptions(definition):[];
 function changeRole(path:(string|number)[],value:string){
  if(!currentFlow)return;
  try{onChange(sharedSource(bindSharedRole(currentFlow,path,value)));setError('');}catch(reason){setError(reason instanceof Error?reason.message:'無法設定角色。');}
 }
 async function open(next:'apply'|'extract'){
  setError('');setPending(true);onBusy(true);
  try{
   const flow=await readSharedDefinition(draft.source);
   setDefinition(flow);setCatalog(loadScripts().filter(item=>item.caseType==='flow'&&item.id!==draft.id&&item.version>0));
   setApplyMode('insert');setPosition(JSON.stringify({path:['before'],index:flow.before?.length||0}));
   setSelected('');setActor(flow.actors?.length===1?flow.actors[0]:'');setCount('1');setName('');setMode(next);
  }catch(reason){setError(reason instanceof Error?reason.message:'無法讀取流程。');}
  finally{setPending(false);onBusy(false);}
 }
 async function commit(){
  if(!definition)return;
  setPending(true);onBusy(true);setError('');
  try{
   if(mode==='apply'){
    const script=catalog.find(item=>item.id===selected);
    if(!script)throw new Error('請選擇已儲存的共用流程。');
    const child=await readSharedDefinition(script.source);
    const point=applyMode==='replace'?'replace':JSON.parse(position) as InsertionPoint;
    onChange(sharedSource(applyShared(definition,script,child,point,child.actors?undefined:actor||undefined)));
   }else{
    if(!name.trim())throw new Error('請填寫共用流程名稱。');
    const child=extractShared(definition,Number(count));
    // Server validation must succeed before replacing any original steps.
    const saved=await saveScript({id:crypto.randomUUID(),name:name.trim(),caseType:'flow',version:0,messages:[],source:sharedSource(child)});
    onChange(sharedSource({...definition,steps:[{...referenceStep(saved),name:`共用流程：${saved.name} · v${saved.version}`},...definition.steps.slice(Number(count))]}));
   }
   setMode(null);
  }catch(reason){setError(reason instanceof Error?reason.message:'共用流程操作失敗，原草稿未變更。');}
  finally{setPending(false);onBusy(false);}
 }
 return <div className="space-y-2">
  <div className="flex flex-wrap gap-2"><Button disabled={disabled||pending} onClick={()=>void open('apply')}>套用共用流程</Button></div>
  {currentFlow?.actors&&sharedReferences(currentFlow).map(({path,step,inherited},index)=><div key={JSON.stringify(path)} className="space-y-2 rounded-lg border border-line p-3">
   <p className="break-words text-menu font-medium">{step.name}</p>
   {current?.dual.includes(JSON.stringify(path))&&!step.actor?<p className="text-menu text-muted">依共用流程內的角色操作多支手機。</p>:<Dropdown label={`共用流程 ${index+1} 的操作角色`} value={step.actor||''} disabled={disabled||pending} options={[{value:'',label:inherited?`沿用上層角色：${actorLabel(inherited)}`:path[0]==='routines'?'沿用呼叫步驟的角色':current?.single.includes(JSON.stringify(path))?'待指定角色':'未指定，儲存時檢查共用流程角色'},...(currentFlow.actors||[]).map(value=>({value,label:actorLabel(value)}))]} onChange={value=>changeRole(path,value)}/>}
   {current?.single.includes(JSON.stringify(path))&&!step.actor&&!inherited&&path[0]!=='routines'&&<p role="status" className="text-menu text-danger">待指定角色，請選擇要操作的手機。</p>}
   {step.actor&&!currentFlow.actors?.includes(step.actor)&&<p role="status" className="text-menu text-danger">原角色已不存在，請重新選擇。</p>}
  </div>)}
  {error&&!mode&&<Notice error>{error}</Notice>}
  <Modal compact open={!!mode} title={mode==='extract'?'抽成共用流程':'套用共用流程'} onClose={()=>{if(!pending){setMode(null);setError('');}}}>
   {error&&<Notice error>{error}</Notice>}
   {mode==='apply'?<>
    <Dropdown label="共用流程" value={selected} disabled={pending} options={[{value:'',label:'選擇已儲存的 Flow Case'},...catalog.map(item=>({value:item.id,label:`${item.name} · v${item.version}`}))]} onChange={setSelected}/>
    {!catalog.length&&<p className="text-menu text-muted">尚無其他已儲存的 Flow Case。</p>}
    <Dropdown label="套用方式" value={applyMode} disabled={pending} options={[{value:'insert',label:'插入共用流程'},{value:'replace',label:'覆蓋目前流程'}]} onChange={value=>{setApplyMode(value);setError('');}}/>
    {applyMode==='insert'?<Dropdown label="插入位置" value={position} disabled={pending} options={positions} onChange={value=>{setPosition(value);setError('');}}/>:<Notice error>將取代目前的前置、主流程、清理、變數及共用定義，App 套件與單機／雙機角色設定改用所選流程。案例名稱保留，按頂部儲存後才會保存。</Notice>}
    {selected&&<details className="space-y-2"><summary className="min-h-11 cursor-pointer rounded-lg py-2 text-menu font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">查看共用流程內容</summary><pre tabIndex={0} aria-label="所選共用流程程式碼" className="max-h-64 overflow-auto rounded-lg border border-line bg-canvas p-3 font-mono text-menu">{catalog.find(item=>item.id===selected)?.source}</pre></details>}
    {selected&&child&&(child.actors?<p className="text-menu text-muted">此共用流程依流程內的角色操作多支手機。</p>:applyMode==='replace'?<p className="text-menu text-muted">改用所選流程的單機設定。</p>:roles.length>1?<Dropdown label="操作手機的角色" value={actor} disabled={pending} options={[{value:'',label:'選擇角色'},...roles.map(value=>({value,label:actorLabel(value)}))]} onChange={setActor}/>:<p className="text-menu text-muted">自動使用目前案例的唯一手機{roles[0]?`：${actorLabel(roles[0])}`:'。'}</p>)}
    {selected&&child&&applyMode==='insert'&&child.appPackage!==definition?.appPackage&&<p className="break-words text-menu text-muted">執行此共用流程時切換至 {child.appPackage}，結束後返回 {definition?.appPackage}；切換失敗會使測試失敗。</p>}
    <p role="status" className="text-menu text-muted">{applyMode==='insert'?`插入位置：${positions.find(item=>item.value===position)?.label||'請選擇位置'}。`:'以所選版本取代目前流程。'}固定引用所選版本；套用後請儲存案例，仍需實際執行驗證。</p>
   </>:<>
    <Field label="共用流程名稱"><Input value={name} disabled={pending} onChange={event=>setName(event.target.value)} placeholder="例如：進入官方聊天室"/></Field>
    <Dropdown label="抽取步驟範圍" value={count} disabled={pending||(definition?.steps.length||0)<2} options={(definition?.steps.slice(0,-1)||[]).map((step,index)=>({value:String(index+1),label:`前 ${index+1} 步，至「${step.name}」`}))} onChange={setCount}/>
    {(definition?.steps.length||0)<2&&<Notice error>至少需要兩個步驟，才能保留案例專屬流程。</Notice>}
    <ol className="space-y-2 text-menu">{definition?.steps.slice(0,Number(count)).map((step,index)=><li key={index}>{index+1}. {step.name}</li>)}</ol>
    <p className="text-menu text-muted">建立獨立 Flow Case，並將原步驟替換為固定版本引用。原案例尚需儲存。抽取內容必須包含結果斷言，儲存格式檢查不代表測試通過。</p>
   </>}
   <div className="flex flex-wrap gap-2" aria-busy={pending}><Button variant={mode==='apply'&&applyMode==='replace'?'danger':'primary'} disabled={pending||(mode==='apply'?(!selected||!child||(requiresRole&&!actor)||(applyMode==='insert'&&!position)):!name.trim()||(definition?.steps.length||0)<2)} onClick={()=>void commit()}>{pending?'處理中':mode==='extract'?'建立並替換步驟':applyMode==='replace'?'覆蓋目前流程':'插入共用流程'}</Button><Button disabled={pending} onClick={()=>{setMode(null);setError('');}}>取消</Button></div>
  </Modal>
 </div>;
}
