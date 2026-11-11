import {useEffect,useId,useRef,useState} from 'react';
import {Button} from '../../components/ui/controls';
import {ToolIcon} from '../../components/ui/ToolIcon';

export function ApiChatContext({projectName,version,currentName,environmentName,pageName,authoring=false}:{authoring?:boolean;projectName?:string;version:string;currentName?:string;environmentName?:string;pageName?:string}){
 const [open,setOpen]=useState(false);
 const id=useId();
 const root=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const panel=useRef<HTMLElement>(null);
 function close(){setOpen(false);trigger.current?.focus();}
 useEffect(()=>{
  if(!open)return;
  panel.current?.focus({preventScroll:true});
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
  document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[open]);
 const fallback=authoring?'未命名案例':'未選接口';
 const rows=[['專案',projectName||'未選專案'],[authoring?'腳本版本':'API 版本',version],[authoring?'案例':'接口',currentName||fallback],...(!authoring?[['環境',environmentName||'未選環境']]:[]),['所在分頁',pageName||(authoring?'案例撰寫':'接口')]];
 return <div ref={root} className="relative min-w-0" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}} onKeyDown={event=>{if(open&&event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
  <div className="flex min-w-0 items-center gap-2">
   {!authoring&&<p className="min-w-0 flex-1 truncate text-menu text-muted" title={currentName||fallback}>{currentName||fallback}</p>}
   <Button ref={trigger} variant={authoring?"chat":"ghost"} aria-label="查看目前參考資料" title="查看目前參考資料" aria-expanded={open} aria-haspopup="dialog" aria-controls={open?id:undefined} onClick={()=>open?close():setOpen(true)}><ToolIcon name="info"/></Button>
  </div>
  {open&&<section ref={panel} id={id} role="dialog" aria-label="目前參考資料" tabIndex={-1} className="absolute inset-x-0 top-full z-40 mt-2 space-y-3 rounded-xl border border-line-strong bg-surface p-3 text-ink shadow-popover focus:outline-none">
   <div className="flex items-center justify-between gap-2"><h3 className="text-menu font-medium">目前參考資料</h3><Button variant="ghost" aria-label="關閉參考資料" title="關閉參考資料" onClick={close}><ToolIcon name="close"/></Button></div>
   <dl className="space-y-2 text-menu">{rows.map(([label,value])=><div key={label} className="flex min-w-0 gap-3"><dt className="w-16 shrink-0 text-muted">{label}</dt><dd className="min-w-0 flex-1 break-words text-ink">{value}</dd></div>)}</dl>
  </section>}
 </div>;
}
