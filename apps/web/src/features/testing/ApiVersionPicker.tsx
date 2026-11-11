import {ToolIcon} from '../../components/ui/ToolIcon';
import {useEffect,useRef,useState} from 'react';
import {Button,Input} from '../../components/ui/controls';
interface Version {
 id:string;
 version:number;
 name?:string;
 revision?:number;
}
export function ApiVersionPicker({versions,value,disabled,onSelect,onRename,onDelete,onNew}:{versions:Version[];value:string;disabled:boolean;onSelect:(id:string)=>void;onRename:(item:Version,name:string)=>Promise<boolean>;onDelete:(item:Version)=>void;onNew:()=>void}){
 const [open,setOpen]=useState(false);
 const [editing,setEditing]=useState('');
 const [name,setName]=useState('');
 const box=useRef<HTMLDivElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(open&&!disabled)box.current?.querySelector<HTMLElement>(editing?'input':'[data-version]')?.focus();},[open,editing,disabled]);
 const label=(item:Version)=>item.name||'版本 '+item.version;
 useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(!box.current?.contains(event.target as Node))setOpen(false);};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);setEditing('');trigger.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[open]);
 async function save(item:Version){if(await onRename(item,name))setEditing('');}
 return <div ref={box} className="relative min-w-0" onKeyDown={event=>{if((event.target as HTMLElement).tagName!=='INPUT'&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const buttons=[...(box.current?.querySelectorAll<HTMLButtonElement>('[data-version]')||[])];const index=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length]?.focus();}if(event.key==='Escape'){event.stopPropagation();setOpen(false);setEditing('');trigger.current?.focus();}}}>
  <Button className="w-full justify-start" ref={trigger} aria-label={'版本 '+(versions.find(item=>item.id===value)?.name||versions.find(item=>item.id===value)?.version||'')} aria-expanded={open} aria-haspopup="dialog" disabled={disabled} onKeyDown={event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);}}} onClick={()=>{setOpen(!open);setEditing('');}}>{versions.find(item=>item.id===value)?label(versions.find(item=>item.id===value)!):'版本'}</Button>
  {open&&<div role="dialog" aria-label="版本清單" onKeyDown={event=>{if(event.key!=='Tab')return;const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')];const index=controls.indexOf(document.activeElement as HTMLElement);if(event.shiftKey&&index===0){event.preventDefault();controls.at(-1)?.focus();}else if(!event.shiftKey&&index===controls.length-1){event.preventDefault();controls[0]?.focus();}}} className="absolute left-0 z-40 mt-2 w-full space-y-2 rounded-lg border border-line bg-surface p-2 shadow-popover">
   {versions.map(item=><div key={item.id} className={'flex min-w-0 items-center gap-1 rounded-lg '+(item.id===value?'bg-brand-soft text-brand':'text-ink')}>
    {editing===item.id?<div className="min-w-0 flex-1 space-y-2 p-2"><Input autoFocus aria-label="版本名稱" value={name} maxLength={100} disabled={disabled} onChange={event=>setName(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&name.trim()){event.preventDefault();void save(item);}if(event.key==='Escape'){event.stopPropagation();setEditing('');}}}/>
     <div className="flex flex-wrap gap-2"><Button disabled={disabled||!name.trim()} onClick={()=>void save(item)}>儲存</Button>
      <Button disabled={disabled} onClick={()=>setEditing('')}>取消</Button>
      <Button aria-label="刪除" variant="danger" disabled={disabled} onClick={()=>{setOpen(false);onDelete(item);}}><ToolIcon name="trash"/></Button></div></div>:<><button data-version type="button" aria-pressed={item.id===value} disabled={disabled} className="min-h-11 min-w-0 flex-1 break-words rounded-lg px-3 py-2 text-left hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50" onClick={()=>{setOpen(false);onSelect(item.id);}}>{label(item)}</button>
     <Button variant="ghost" disabled={disabled} aria-label={'重新命名 '+label(item)} onClick={()=>{setEditing(item.id);setName(label(item));}}><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5"/></svg></Button></>}
   </div>)}
   <Button disabled={disabled} onClick={()=>{setOpen(false);onNew();}}>新增版本</Button>
  </div>}
 </div>;
}

