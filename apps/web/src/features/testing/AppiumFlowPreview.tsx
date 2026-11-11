import {useEffect,useId,useState} from 'react';
import type {ReactNode} from 'react';
import {Notice} from '../../components/ui/controls';
import {readSharedDefinition,type SharedDefinition,type FlowStep} from './sharedFlow';

function steps(value:unknown):FlowStep[]{
 return Array.isArray(value)?value.filter((item):item is FlowStep=>!!item&&typeof item==='object'&&typeof item.name==='string'&&typeof item.action==='string'):[];
}
function routines(flow:SharedDefinition):Record<string,unknown>{
 return flow.routines&&typeof flow.routines==='object'&&!Array.isArray(flow.routines)?flow.routines as Record<string,unknown>:{};
}
export function unusedRoutines(flow:SharedDefinition):string[]{
 const definitions=routines(flow),referenced=new Set<string>();
 function visit(list:FlowStep[],depth=0){
  if(depth>6)return;
  for(const step of list){
   for(const children of [step.steps,step.then,step.else])visit(steps(children),depth+1);
   if(step.action==='call'&&typeof step.routine==='string'&&!referenced.has(step.routine)){
    referenced.add(step.routine);visit(steps(definitions[step.routine]),depth+1);
   }
  }
 }
 visit(steps(flow.before));visit(flow.steps);visit(steps(flow.after));
 return Object.keys(definitions).filter(name=>!referenced.has(name));
}

function StepList({list,flow,path,stack=[],depth=0,actor}:{list:FlowStep[];flow:SharedDefinition;path:string;stack?:string[];depth?:number;actor?:string}){
 if(depth>6)return <p className="text-menu text-danger">巢狀超過預覽上限，請檢查流程結構。</p>;
 return <ol aria-label={path} className="min-w-0 divide-y divide-line">{list.slice(0,300).map((step,index)=>{
  const role=step.action==='apiFlow'?undefined:step.actor||actor;
  const label=`${index+1}. ${step.name}`;
  const routine=typeof step.routine==='string'?step.routine:'';
  const groups=step.action==='if'?[{label:'條件成立',list:steps(step.then)},{label:'條件不成立',list:steps(step.else)}]:['repeat','while','optional'].includes(step.action)?[{label:step.action==='optional'?'條件成立時執行':step.action==='repeat'?`重複 ${step.times} 次`:`條件成立時重複，最多 ${step.maxIterations} 次`,list:steps(step.steps)}]:step.action==='call'?[{label:`呼叫共用定義：${routine}`,list:steps(routines(flow)[routine])}]:[];
  const nested=<div className="min-w-0 space-y-3 pb-2 pl-3">
   {step.action==='call'&&stack.includes(routine)?<p className="text-menu text-danger">循環引用，無法展開。</p>:groups.map(group=><div key={group.label} className="min-w-0 space-y-2"><p className="text-menu text-muted">{group.label}</p>{group.list.length?<StepList list={group.list} flow={flow} path={`${path} / ${step.name} / ${group.label}`} stack={step.action==='call'?[...stack,routine]:stack} depth={depth+1} actor={role}/>:<p className="text-menu text-muted">{step.action==='call'?'找不到共用定義。':'沒有步驟。'}</p>}</div>)}
  </div>;
  return <li key={index} className="min-w-0 py-2 text-menu">
   {groups.length?<details className="min-w-0"><summary className="min-h-11 cursor-pointer break-words rounded-lg py-2 font-medium hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{label}{role&&` · ${role==='sender'?'發送者':'接收者'}`}<span className="ml-2 font-normal text-muted">{step.action==='optional'?'條件步驟':step.action==='if'?'條件分支':step.action==='call'?'共用定義':'迴圈群組'}</span></summary>{nested}</details>:<p className="break-words">{label}{role&&` · ${role==='sender'?'發送者':'接收者'}`}</p>}
   {step.action==='apiFlow'&&<p className="break-words text-menu text-muted">API · 固定版本 v{step.scriptVersion} · 輸出前綴 {String(step.namespace)}{Number(step.pollTimeoutMs)>0?' · 限時輪詢':''}</p>}
   {step.action==='callFlow'&&<p className="break-all text-menu text-muted">固定引用 v{step.scriptVersion} · {step.scriptId}；內容於執行前解析。</p>}
  </li>;
 })}{list.length>300&&<li className="py-2 text-menu text-danger">步驟超過預覽上限，請檢查流程結構。</li>}</ol>;
}

export function AppiumFlowPreview({source,expanded,onToggle,actions}:{source:string;expanded:boolean;onToggle:()=>void;actions?:ReactNode}){
 const previewId=useId();
 const [parsed,setParsed]=useState<{source:string;flow?:SharedDefinition;error?:string}>();
 useEffect(()=>{
  let current=true;
  void readSharedDefinition(source).then(flow=>{if(current)setParsed({source,flow});},reason=>{if(current)setParsed({source,error:reason instanceof Error?reason.message:'流程無法解析。'});});
  return()=>{current=false;};
 },[source]);
 const flow=parsed?.source===source?parsed.flow:undefined;
 const error=parsed?.source===source?parsed.error:undefined;
 const unused=flow?unusedRoutines(flow):[];
 return <div className="min-w-0">
  <button type="button" aria-expanded={expanded} aria-controls={previewId} onClick={onToggle} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg text-left text-body font-medium hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"><span>測試流程{flow?` · ${flow.steps.length} 個主流程步驟`:''}</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-4 w-4 shrink-0 ${expanded?'rotate-180':''}`}><path d="m6 9 6 6 6-6"/></svg></button>
  {actions}
  <div id={previewId} hidden={!expanded} className="mt-3 max-h-80 space-y-3 overflow-y-auto overscroll-contain">
   {error?<Notice error>流程預覽無法解析：{error}</Notice>:!flow?<p className="text-menu text-muted" role="status">正在解析流程結構。</p>:<>
    {!!steps(flow.before).length&&<section aria-label="前置流程"><h3 className="text-menu font-medium">前置流程</h3><StepList list={steps(flow.before)} flow={flow} path="前置流程"/></section>}
    <section aria-label="主流程"><h3 className="text-menu font-medium">主流程</h3><StepList list={flow.steps} flow={flow} path="案例主流程"/></section>
    {!!steps(flow.after).length&&<section aria-label="清理流程"><h3 className="text-menu font-medium">清理流程</h3><StepList list={steps(flow.after)} flow={flow} path="清理流程"/></section>}
    {!!unused.length&&<details className="min-w-0"><summary className="min-h-11 cursor-pointer break-words rounded-lg py-2 text-menu font-medium hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">未被流程引用的共用定義 · {unused.length}</summary><p className="text-menu text-muted">只有定義，沒有安排執行。</p>{unused.map(name=><details key={name} className="min-w-0 pl-3"><summary className="min-h-11 cursor-pointer break-all rounded-lg py-2 text-menu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{name}</summary><StepList list={steps(routines(flow)[name])} flow={flow} path={`共用定義 / ${name}`} stack={[name]}/></details>)}</details>}
   </>}
  </div>
 </div>;
}
