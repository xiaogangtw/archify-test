import {useEffect,useRef,useState} from 'react';
import type {ReactNode,PointerEvent,KeyboardEvent} from 'react';
import theme from '../../../tailwind.config';
const columnClasses=[
 'grid-cols-api-split-15','grid-cols-api-split-16','grid-cols-api-split-17','grid-cols-api-split-18',
 'grid-cols-api-split-19','grid-cols-api-split-20','grid-cols-api-split-21','grid-cols-api-split-22',
 'grid-cols-api-split-23','grid-cols-api-split-24','grid-cols-api-split-25','grid-cols-api-split-26',
 'grid-cols-api-split-27','grid-cols-api-split-28','grid-cols-api-split-29','grid-cols-api-split-30',
 'grid-cols-api-split-31','grid-cols-api-split-32','grid-cols-api-split-33','grid-cols-api-split-34',
 'grid-cols-api-split-35','grid-cols-api-split-36','grid-cols-api-split-37','grid-cols-api-split-38',
 'grid-cols-api-split-39','grid-cols-api-split-40','grid-cols-api-split-41','grid-cols-api-split-42',
 'grid-cols-api-split-43','grid-cols-api-split-44','grid-cols-api-split-45','grid-cols-api-split-46',
 'grid-cols-api-split-47','grid-cols-api-split-48','grid-cols-api-split-49','grid-cols-api-split-50',
 'grid-cols-api-split-51','grid-cols-api-split-52','grid-cols-api-split-53','grid-cols-api-split-54',
 'grid-cols-api-split-55','grid-cols-api-split-56','grid-cols-api-split-57','grid-cols-api-split-58',
 'grid-cols-api-split-59','grid-cols-api-split-60','grid-cols-api-split-61','grid-cols-api-split-62',
 'grid-cols-api-split-63','grid-cols-api-split-64','grid-cols-api-split-65','grid-cols-api-split-66',
 'grid-cols-api-split-67','grid-cols-api-split-68','grid-cols-api-split-69','grid-cols-api-split-70',
 'grid-cols-api-split-71','grid-cols-api-split-72','grid-cols-api-split-73','grid-cols-api-split-74',
 'grid-cols-api-split-75','grid-cols-api-split-76','grid-cols-api-split-77','grid-cols-api-split-78',
 'grid-cols-api-split-79','grid-cols-api-split-80','grid-cols-api-split-81','grid-cols-api-split-82',
 'grid-cols-api-split-83','grid-cols-api-split-84','grid-cols-api-split-85',
];
const rowClasses=[
 'grid-rows-api-split-15','grid-rows-api-split-16','grid-rows-api-split-17','grid-rows-api-split-18',
 'grid-rows-api-split-19','grid-rows-api-split-20','grid-rows-api-split-21','grid-rows-api-split-22',
 'grid-rows-api-split-23','grid-rows-api-split-24','grid-rows-api-split-25','grid-rows-api-split-26',
 'grid-rows-api-split-27','grid-rows-api-split-28','grid-rows-api-split-29','grid-rows-api-split-30',
 'grid-rows-api-split-31','grid-rows-api-split-32','grid-rows-api-split-33','grid-rows-api-split-34',
 'grid-rows-api-split-35','grid-rows-api-split-36','grid-rows-api-split-37','grid-rows-api-split-38',
 'grid-rows-api-split-39','grid-rows-api-split-40','grid-rows-api-split-41','grid-rows-api-split-42',
 'grid-rows-api-split-43','grid-rows-api-split-44','grid-rows-api-split-45','grid-rows-api-split-46',
 'grid-rows-api-split-47','grid-rows-api-split-48','grid-rows-api-split-49','grid-rows-api-split-50',
 'grid-rows-api-split-51','grid-rows-api-split-52','grid-rows-api-split-53','grid-rows-api-split-54',
 'grid-rows-api-split-55','grid-rows-api-split-56','grid-rows-api-split-57','grid-rows-api-split-58',
 'grid-rows-api-split-59','grid-rows-api-split-60','grid-rows-api-split-61','grid-rows-api-split-62',
 'grid-rows-api-split-63','grid-rows-api-split-64','grid-rows-api-split-65','grid-rows-api-split-66',
 'grid-rows-api-split-67','grid-rows-api-split-68','grid-rows-api-split-69','grid-rows-api-split-70',
 'grid-rows-api-split-71','grid-rows-api-split-72','grid-rows-api-split-73','grid-rows-api-split-74',
 'grid-rows-api-split-75','grid-rows-api-split-76','grid-rows-api-split-77','grid-rows-api-split-78',
 'grid-rows-api-split-79','grid-rows-api-split-80','grid-rows-api-split-81','grid-rows-api-split-82',
 'grid-rows-api-split-83','grid-rows-api-split-84','grid-rows-api-split-85',
];
interface Props {id:string;label:string;axis:'x'|'y';initial:number;min?:number;max?:number;responsive?:boolean;first:ReactNode;second:ReactNode}
export function ApiSplitPane({id,label,axis,initial,min=25,max=75,responsive=false,first,second}:Props){
 const [value,setValue]=useState(()=>{try{const saved=localStorage.getItem('archify.api.split.'+id);const number=Math.round(Number(saved));return saved&&Number.isFinite(number)?Math.min(max,Math.max(min,number)):initial;}catch{return initial;}});
 const [wide,setWide]=useState(()=>window.matchMedia('(min-width: '+theme.theme.extend.screens['api-workbench']+')').matches);
 const [dragging,setDragging]=useState(false);const root=useRef<HTMLDivElement>(null);
 const direction=responsive&&!wide?'y':axis;
 useEffect(()=>{if(!responsive)return;const media=window.matchMedia('(min-width: '+theme.theme.extend.screens['api-workbench']+')');const change=()=>setWide(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change);},[responsive]);
 function change(next:number){const bounded=Math.max(min,Math.min(max,Math.round(next)));setValue(bounded);try{localStorage.setItem('archify.api.split.'+id,String(bounded));}catch{}}
 function move(event:PointerEvent){const bounds=root.current?.getBoundingClientRect();if(!bounds)return;change(direction==='x'?(event.clientX-bounds.left)/bounds.width*100:(event.clientY-bounds.top)/bounds.height*100);}
 function key(event:KeyboardEvent){const negative=direction==='x'?'ArrowLeft':'ArrowUp',positive=direction==='x'?'ArrowRight':'ArrowDown';if(event.key===negative||event.key===positive){event.preventDefault();change(value+(event.key===negative?-1:1)*(event.shiftKey?5:1));}else if(event.key==='Home'||event.key==='End'){event.preventDefault();change(event.key==='Home'?min:max);}}
 return <div ref={root} className={'grid h-full min-h-0 min-w-0 overflow-hidden '+(direction==='x'?columnClasses[value-15]:rowClasses[value-15])}>
  <div id={id+'-first'} className="min-h-0 min-w-0 overflow-hidden">{first}</div>
  <div className="relative z-10 bg-canvas"><div role="separator" tabIndex={0} aria-label={label} aria-orientation={direction==='x'?'vertical':'horizontal'} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} aria-valuetext={value+'%'} aria-controls={id+'-first '+id+'-second'}
   onKeyDown={key} onDoubleClick={()=>change(initial)}
   onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);}}
   onPointerMove={event=>{if(dragging)move(event);}}
   onPointerUp={event=>{if(dragging){move(event);setDragging(false);event.currentTarget.releasePointerCapture(event.pointerId);}}}
   onPointerCancel={()=>setDragging(false)} onLostPointerCapture={()=>setDragging(false)}
   className={'absolute flex touch-none select-none items-center justify-center outline-none hover:bg-brand-soft focus-visible:bg-brand-soft focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand '+(direction==='x'?'inset-y-0 -left-2 -right-2 cursor-col-resize':'inset-x-0 -top-2 -bottom-2 cursor-row-resize')+(dragging?' bg-brand-soft':' bg-transparent')}>
   <span aria-hidden="true" className={'rounded-lg bg-line-strong '+(direction==='x'?'h-6 w-1':'h-1 w-6')}/>
  </div></div>
  <div id={id+'-second'} className="min-h-0 min-w-0 overflow-hidden">{second}</div>
 </div>;
}
