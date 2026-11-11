import {useRef,useState} from 'react';
import {Button} from '../../components/ui/controls';
import {ToolIcon} from '../../components/ui/ToolIcon';
import {api} from './controlApi';

export function AppiumRetry({disabled=false,onReady}:{disabled?:boolean;onReady:()=>Promise<void>}){
 const [pending,setPending]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false);
 const active=useRef(false);
 async function retry(){
  if(active.current||disabled)return;
  active.current=true;setPending(true);setMessage('');setError(false);
  try{const result=await api<{ready:boolean}>('/android/appium/retry',{method:'POST',body:'{}'});if(!result.ready)throw new Error('Appium 尚未就緒，請稍後重試。');await onReady();setMessage('Appium 已就緒');}
  catch(reason){setError(true);setMessage(reason instanceof Error?reason.message:'Appium 重試失敗');}
  finally{active.current=false;setPending(false);}
 }
 return <span className="inline-flex flex-wrap items-center gap-2"><Button size="compact" disabled={disabled||pending} aria-busy={pending} aria-label={pending?'正在重試 Appium':'重試 Appium 連線'} title="重試 Appium 連線" onClick={()=>void retry()}><ToolIcon name="refresh"/></Button>{pending?<span role="status">正在重試 Appium…</span>:message?<span role={error?'alert':'status'} className={error?'text-danger':'text-muted'}>{message}</span>:null}</span>;
}
