import {useEffect,useId,useRef} from 'react';
import type {ReactNode} from 'react';
import {Button} from './controls';

export function Modal({open,title,onClose,children,drawer=false,compact=false}:{compact?:boolean;drawer?:boolean;open:boolean;title:string;onClose:()=>void;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);const titleId=useId();
 useEffect(()=>{const element=dialog.current;if(!element)return;if(open&&!element.open)element.showModal();else if(!open&&element.open)element.close();if(!open)return;document.addEventListener('keydown',trap,true);return()=>document.removeEventListener('keydown',trap,true);},[open]);
 function trap(event:KeyboardEvent){if(event.key!=='Tab'||event.defaultPrevented)return;const element=dialog.current;if(!element?.open)return;const controls=[...element.querySelectorAll<HTMLElement>('button,input,textarea,summary,a[href],[tabindex]')].filter(item=>item.tabIndex>=0&&!item.matches(':disabled')&&item.getClientRects().length&&getComputedStyle(item).visibility!=='hidden'&&(!item.closest('details:not([open])')||item.tagName==='SUMMARY'));
  const first=controls[0],last=controls[controls.length-1];if(!first){event.preventDefault();element.focus();return;}if(event.shiftKey&&(document.activeElement===first||!element.contains(document.activeElement))){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||!element.contains(document.activeElement))){event.preventDefault();first.focus();}}
 return <dialog ref={dialog} aria-modal="true" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();onClose();}} onClose={()=>{if(open)onClose();}} className={drawer?'fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-screen w-full max-w-xl flex-col rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-ink/30 '+(open?'flex':'hidden'):'m-auto max-h-screen w-full rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-ink/30 '+(compact?'max-w-xl':'max-w-5xl')}>
  <div className={drawer?'flex shrink-0 items-center justify-between gap-3 border-b border-line p-3':'flex items-center justify-between gap-4 border-b border-line p-5'}><h2 id={titleId} className="text-heading font-bold">{title}</h2><Button onClick={onClose} aria-label={'關閉'+title}>關閉</Button></div>
  <div className={drawer?'min-h-0 min-w-0 flex-1 overflow-hidden p-3':'min-w-0 space-y-5 overflow-auto p-5'}>{open&&children}</div>
 </dialog>;
}
