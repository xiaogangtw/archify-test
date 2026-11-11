import {ToolIcon} from '../../components/ui/ToolIcon';
import {useEffect,useId,useRef,useState} from 'react';
import {Button,Input} from '../../components/ui/controls';
import type {RequestDefinition,SavedApiCase} from '../../../../../services/control-api/src/apiContracts';

interface Props {
 projectId:string;catalogId:string;requests:RequestDefinition[];folders:string[];
 cases:SavedApiCase[];selectedCaseId?:string;onSelectCase:(item:RequestDefinition,value:SavedApiCase)=>void;onNewCase:(item:RequestDefinition)=>void;onRenameCase:(value:SavedApiCase)=>void;onDeleteCase:(value:SavedApiCase)=>void;
 selected:string;disabled:boolean;onSelect:(item:RequestDefinition)=>void;
 onDelete:(item:RequestDefinition)=>void;onNew:()=>void;onNewFolder:()=>void;onMove:(id:string,folder:string)=>Promise<void>;
}
const dragType='application/x-archify-api';
export function ApiRequestSidebar({projectId,catalogId,requests,folders,cases,selectedCaseId,onSelectCase,onNewCase,onRenameCase,onDeleteCase,selected,disabled,onSelect,onDelete,onNew,onNewFolder,onMove}:Props){
 const [search,setSearch]=useState('');
 const [context,setContext]=useState<{id?:string;caseId?:string}|null>(null);
 const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
 const [over,setOver]=useState('');
 const [moving,setMoving]=useState(false);const moveTrigger=useRef<HTMLButtonElement>(null);
 const aside=useRef<HTMLElement>(null);const menu=useRef<HTMLDivElement>(null);
 const submenu=useRef<HTMLDivElement>(null);const menuId=useId();const submenuId=useId();
 useEffect(()=>{const el=submenu.current;if(moving&&el&&!el.matches(":popover-open"))el.showPopover();},[moving]);
 const storageKey='archify.api-folders.'+projectId+'.'+catalogId;
 const groups=[...new Set(['未分類',...folders,...requests.map(item=>item.category||'未分類')])];
 const filtered=requests.filter(item=>`${item.name} ${item.method} ${item.endpoint} ${item.category||''} ${cases.filter(value=>value.requestId===item.id).map(value=>value.name).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
 useEffect(()=>{try{setCollapsed(JSON.parse(localStorage.getItem(storageKey)||'{}'));}catch{setCollapsed({});}},[storageKey]);
 useEffect(()=>{setMoving(false);if(!context)return;const element=menu.current;if(element&&!element.matches(':popover-open'))element.showPopover();element?.querySelector<HTMLButtonElement>('button')?.focus();
  const outside=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node))setContext(null);};
  document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
 },[context]);
 function close(){setContext(null);if(context?.caseId){[...(aside.current?.querySelectorAll<HTMLButtonElement>('[data-case-id]')||[])].find(item=>item.dataset.caseId===context.caseId)?.focus();return;}const target=context?.id?[...(aside.current?.querySelectorAll<HTMLButtonElement>('[data-api-id]')||[])].find(item=>item.dataset.apiId===context.id):aside.current;target?.focus();}
 function toggle(folder:string,force?:boolean){const next={...collapsed,[folder]:force??!collapsed[folder]};setCollapsed(next);try{localStorage.setItem(storageKey,JSON.stringify(next));}catch{}}
 function openMenu(id?:string){setMoving(false);if(!disabled)setContext(id?{id}:{});}
 function showMoves(focus=false){setMoving(true);if(focus)requestAnimationFrame(()=>submenu.current?.querySelector<HTMLButtonElement>('button')?.focus());}
 function back(){setMoving(false);requestAnimationFrame(()=>moveTrigger.current?.focus());}
 async function drop(event:React.DragEvent,folder:string){event.preventDefault();setOver('');if(disabled)return;
  try{const item=JSON.parse(event.dataTransfer.getData(dragType));if(item.projectId!==projectId||item.catalogId!==catalogId||!requests.some(request=>request.id===item.id))return;await onMove(item.id,folder);toggle(folder,false);}catch{}
 }
 function renderMenu(){
  return <div ref={menu} id={menuId} popover="manual" role="menu" aria-label={context?.caseId?'案例選項':'接口清單選項'} className={'absolute z-40 m-0 w-40 max-h-64 sm:w-48 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-popover [inset:auto] [position-anchor:--api-context] [position-try-fallbacks:flip-block,flip-inline] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden '+(context?.id||context?.caseId?'[left:anchor(left)] [top:anchor(center)] sm:[left:anchor(center)]':'[left:anchor(left)] [top:anchor(bottom)]')}
   onPointerMove={event=>{const target=event.target as HTMLElement;if(target.closest('[role="menu"]')===menu.current&&!moveTrigger.current?.contains(target))setMoving(false);}}
   onContextMenu={event=>{event.preventDefault();event.stopPropagation();}}
   onKeyDown={event=>{event.stopPropagation();const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')].filter(button=>button.closest('[role=menu]')===event.currentTarget);const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    if(moving&&(event.key==='Escape'||event.key==='ArrowLeft')){event.preventDefault();back();}else if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='Tab'){close();}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length]?.focus();}}}>
   {context?.caseId?<>
    <Button variant="ghost" size="compact" role="menuitem" tabIndex={-1} className="w-full !justify-start text-menu" onClick={()=>{const value=cases.find(item=>item.id===context.caseId);close();if(value)onRenameCase(value);}}>重新命名</Button>
    <Button aria-label="刪除案例" variant="danger" size="compact" role="menuitem" tabIndex={-1} className="w-full !justify-start text-menu" onClick={()=>{const value=cases.find(item=>item.id===context.caseId);close();if(value)onDeleteCase(value);}}><ToolIcon name="trash"/></Button>
   </>:<>   <Button variant="ghost" size="compact" role="menuitem" tabIndex={-1} className="w-full !justify-start text-menu" onClick={()=>{setContext(null);onNewFolder();}}>新增資料夾</Button>
   {context?.id&&<Button variant="ghost" size="compact" role="menuitem" tabIndex={-1} className="w-full !justify-start text-menu" onClick={()=>{const item=requests.find(item=>item.id===context.id);close();if(item)onNewCase(item);}}>新增案例</Button>}
   {context?.id&&groups.some(folder=>folder!==(requests.find(item=>item.id===context.id)?.category||'未分類'))&&<Button ref={moveTrigger} aria-haspopup="menu" aria-expanded={moving} aria-controls={moving?submenuId:undefined} onPointerEnter={()=>showMoves()} variant="ghost" size="compact" role="menuitem" tabIndex={-1} className="w-full !justify-between text-menu [anchor-name:--api-move]" onKeyDown={event=>{if(event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();showMoves(true);}}} onClick={()=>showMoves(true)}>移動到<svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 6 6 6-6 6"/></svg></Button>}
   {context?.id&&<Button aria-label="刪除接口" size="compact" variant="danger" role="menuitem" tabIndex={-1} className="w-full !justify-start text-menu" onClick={()=>{const item=requests.find(item=>item.id===context.id);close();if(item)onDelete(item);}}><ToolIcon name="trash"/></Button>}</>}

   {moving&&context?.id&&<div ref={submenu} id={submenuId} popover="manual" role="menu" aria-label="移動到資料夾" className="fixed z-50 m-0 max-h-64 w-40 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-popover sm:w-48 [inset:auto] [position-anchor:--api-move] [left:anchor(right)] [top:anchor(top)] [position-try-fallbacks:flip-inline,flip-block] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onWheel={event=>event.stopPropagation()} onTouchMove={event=>event.stopPropagation()} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'||event.key==='ArrowLeft'){event.preventDefault();back();}else if(event.key==='Tab'){close();}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];const index=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length]?.focus();}}}>
    {groups.filter(folder=>folder!==(requests.find(item=>item.id===context.id)?.category||'未分類')).map(folder=><Button variant="ghost" size="compact" key={folder} role="menuitem" tabIndex={-1} className="w-full !justify-start whitespace-normal break-words text-left text-menu" onClick={()=>{const id=context.id!;close();void onMove(id,folder);}}>{folder}</Button>)}
   </div>}
  </div>;

 }
 return <aside ref={aside} tabIndex={0} aria-label="API 清單" aria-haspopup="menu" aria-controls={context&&!context.id&&!context.caseId?menuId:undefined} className="relative flex h-full min-h-0 min-w-0 flex-col gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
  onContextMenu={event=>{event.preventDefault();openMenu();}}
  onKeyDown={event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();openMenu();}}}>
  <div className="w-full shrink-0 space-y-1"><div className={'flex min-w-0 items-center gap-2 '+(context&&!context.id&&!context.caseId?'[anchor-name:--api-context]':'')}><Input aria-label="搜尋接口" value={search} onChange={event=>setSearch(event.target.value)} placeholder="搜尋接口"/>
   <Button disabled={disabled} aria-label="新增接口" onClick={onNew}><svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg></Button>
  </div>
  <p className="text-menu text-muted">{filtered.length} 個接口</p></div>
  {context&&!context.id&&!context.caseId&&renderMenu()}
  <div aria-label="接口清單捲動區" className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onWheel={()=>setContext(null)} onTouchMove={()=>setContext(null)}>
   {groups.filter(folder=>!search||filtered.some(item=>(item.category||'未分類')===folder)).map(folder=>{
    const items=filtered.filter(item=>(item.category||'未分類')===folder);
    return <section key={folder} aria-label={'資料夾 '+folder} className={'space-y-1 rounded-lg border p-1 '+(over===folder?'border-brand bg-brand-soft':'border-transparent')}
     onDragOver={event=>{if(!disabled&&event.dataTransfer.types.includes(dragType)){event.preventDefault();event.dataTransfer.dropEffect='move';setOver(folder);}}}
     onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOver('');}}
     onDrop={event=>void drop(event,folder)}>
     <h3><button type="button" aria-expanded={!collapsed[folder]} disabled={disabled} className="flex min-h-8 w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-menu font-medium text-muted hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50" onClick={()=>toggle(folder)}>
      <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>
      <span className="min-w-0 flex-1 break-words">{folder}</span><span>{items.length}</span>
     </button></h3>
     {!collapsed[folder]&&items.map(item=><div key={item.id} className={'relative '+(context?.id===item.id?'[anchor-name:--api-context]':'')}><button type="button" data-api-id={item.id} aria-haspopup="menu" aria-expanded={context?.id===item.id} aria-controls={context?.id===item.id?menuId:undefined} draggable={!disabled} aria-pressed={selected===item.id&&!selectedCaseId} disabled={disabled}
      onDragStart={event=>{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData(dragType,JSON.stringify({projectId,catalogId,id:item.id}));}}
      onDragEnd={()=>setOver('')}
      onContextMenu={event=>{event.preventDefault();event.stopPropagation();openMenu(item.id);}}
      onKeyDown={event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();event.stopPropagation();openMenu(item.id);}}}
      onClick={()=>onSelect(item)} className={'flex min-h-8 w-full items-start gap-2 rounded-lg px-2 py-1 text-left text-menu hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:bg-sidebar disabled:opacity-50 '+(selected===item.id&&!selectedCaseId?'bg-brand-soft text-brand':'text-ink')}>
      <span className="font-medium">{item.kind==='graphql'?'GQL':item.method}</span><span className="min-w-0 flex-1 break-words">{item.name}{cases.some(value=>value.requestId===item.id)?' ('+cases.filter(value=>value.requestId===item.id).length+')':''}</span>
     </button>{cases.filter(value=>value.requestId===item.id).map(value=><div key={value.id} className={'relative '+(context?.caseId===value.id?'[anchor-name:--api-context]':'')}><button data-case-id={value.id} aria-haspopup="menu" aria-expanded={context?.caseId===value.id} aria-controls={context?.caseId===value.id?menuId:undefined} onContextMenu={event=>{event.preventDefault();event.stopPropagation();if(!disabled)setContext({caseId:value.id});}} onKeyDown={event=>{if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();event.stopPropagation();if(!disabled)setContext({caseId:value.id});}}} type="button" disabled={disabled} aria-pressed={selectedCaseId===value.id} title={value.name} onClick={()=>onSelectCase(item,value)} className={'flex min-h-8 w-full items-center gap-2 rounded-lg py-1 pl-6 pr-2 text-left text-menu hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 '+(selectedCaseId===value.id?'bg-brand-soft text-brand':'text-ink')}><span className="shrink-0 text-muted">{value.scenario==='negative'?'反向':'正向'}</span><span className="min-w-0 truncate">{value.name}</span></button>{context?.caseId===value.id&&renderMenu()}</div>)}{context?.id===item.id&&renderMenu()}</div>)}
    </section>;
   })}
   {!filtered.length&&search&&<p className="py-4 text-menu text-muted">沒有符合的接口。</p>}
  </div>
 </aside>;
}
