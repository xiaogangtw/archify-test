import {ApiChatContext} from './ApiChatContext';
import {useEffect,useRef,useState} from 'react';
import type {ComponentProps,ReactNode} from 'react';
import {ApiAssistant} from './ApiAssistant';
import {Button,Input,Textarea,Notice} from '../../components/ui/controls';
import {ToolIcon} from '../../components/ui/ToolIcon';
import {api} from './controlApi';
import {busyThread,chatKey,newChat,readChats} from './apiChatHistory';
import type {ChatMessage,ChatThread,ChatJob} from './apiChatHistory';
import type {ApiUiAction,ApiUiReply,ApiPageTab,ApiRequestTab,ApiEditorContext,ApiUiOutcome} from '../../../../../services/control-api/src/apiUiContracts';
import llmTimeouts from '../../../../../services/control-api/src/llmTimeouts.json';

type AuthorReply=string|{text:string;question?:{prompt:string;options:string[]}};
type Props=ComponentProps<typeof ApiAssistant>&{
 seedThread?:ChatThread;inline?:boolean;authoring?:{placeholder?:string;resolutionKey?:number;correct?:(question:string,threadId:string)=>Promise<void>;send:(question:string,messages:{role:'user'|'assistant';content:string}[],signal:AbortSignal,progress:(text:string)=>void,threadId:string)=>Promise<AuthorReply>;restore?:(threadId:string,signal:AbortSignal,progress:(text:string)=>void)=>Promise<AuthorReply|undefined>;cancel?:(threadId:string)=>Promise<void>};onOpen?:()=>void;workflowOnly?:boolean;disabledReason?:string;settings?:ReactNode;uiToken:string;page:ApiPageTab;tab:ApiRequestTab;editor:ApiEditorContext;
 onOperate:(actions:ApiUiAction[],token:string)=>Promise<ApiUiOutcome>;
};
const labels:Record<string,string>={queued:'等待中',running:'執行中',draft:'草稿',passed:'檢查通過',failed:'失敗',skipped:'未執行',completed:'完成',cancelled:'已停止',unconfirmed:'結果未確認'};

export function ApiChat(props:Props){
 const [open,setOpen]=useState(!!props.inline);
 const [history,setHistory]=useState(()=>{try{return localStorage.getItem(chatKey(props.projectId)+'.view')==='history';}catch{return false;}});
 const [initial]=useState(()=>{try{const threads=readChats(localStorage,props.projectId);if(props.seedThread&&!threads.some(item=>item.id===props.seedThread!.id)&&threads.length<30)threads.unshift(props.seedThread);return {threads,error:''};}catch(reason){return {threads:[] as ChatThread[],error:reason instanceof Error?reason.message:'無法讀取對話'};}});
 const [threads,setThreads]=useState<ChatThread[]>(()=>initial.threads.length?initial.threads:[newChat()]);
 const [activeId,setActiveId]=useState(()=>{try{const remembered=localStorage.getItem(chatKey(props.projectId)+'.active');return initial.threads.some(item=>item.id===remembered)?remembered||'':initial.threads[0]?.id||'';}catch{return initial.threads[0]?.id||'';}});
 const [question,setQuestion]=useState('');
 const [error,setError]=useState(initial.error);
 const [storageError,setStorageError]=useState('');
 const [sending,setSending]=useState(false);
 const [dispatching,setDispatching]=useState(false);
 const [allowExecution,setAllowExecution]=useState(false);
 const [renameId,setRenameId]=useState('');
 const [renameValue,setRenameValue]=useState('');
 const [deleted,setDeleted]=useState<ChatThread|null>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const panel=useRef<HTMLElement>(null);
 const log=useRef<HTMLDivElement>(null);
 const follow=useRef(true);
 const [unread,setUnread]=useState(false);
 const abort=useRef<AbortController|null>(null);
 const sendingRef=useRef(false);
 const latest=useRef(props);latest.current=props;
 const resolvedKey=useRef(props.authoring?.resolutionKey);
 const active=threads.find(item=>item.id===activeId)||threads[0];
 const waitingQuestion=active?.messages.at(-1)?.question;
 const root='/api-library/'+encodeURIComponent(props.projectId);
 useEffect(()=>{
  if(resolvedKey.current===props.authoring?.resolutionKey)return;
  resolvedKey.current=props.authoring?.resolutionKey;
  if(active)updateThread(active.id,thread=>({...thread,messages:thread.messages.map(message=>({...message,question:undefined}))}));
 },[props.authoring?.resolutionKey]);

 useEffect(()=>{try{localStorage.setItem(chatKey(props.projectId)+'.view',history?'history':'chat');}catch{}},[history,props.projectId]);
 function close(){setOpen(false);trigger.current?.focus();}
 useEffect(()=>{
  if(!open||props.inline)return;
  panel.current?.focus();
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!document.querySelector('dialog[open], [aria-modal=true]:not(dialog):not([hidden])'))close();};
  document.addEventListener('keydown',escape);
  return()=>document.removeEventListener('keydown',escape);
 },[open]);
 useEffect(()=>{setAllowExecution(false);},[props.catalogId,props.environmentId,props.currentId]);
 useEffect(()=>{
  if(initial.error)return;
  try{localStorage.setItem(chatKey(props.projectId),JSON.stringify(threads));localStorage.setItem(chatKey(props.projectId)+'.active',active?.id||'');setStorageError('');}
  catch{setStorageError('無法儲存聊天紀錄，目前對話仍保留在本頁。');}
 },[threads,active?.id,props.projectId,initial.error]);
 useEffect(()=>{
  if(!open||history)return;
  if(follow.current){log.current?.scrollTo({top:log.current.scrollHeight});setUnread(false);}else setUnread(true);
 },[active?.messages,open,history]);
 useEffect(()=>{follow.current=true;setUnread(false);log.current?.scrollTo({top:log.current.scrollHeight});},[active?.id,history]);
 useEffect(()=>()=>abort.current?.abort(),[]);
 useEffect(()=>{
  const restore=latest.current.authoring?.restore;if(!restore||!active?.id)return;
  const controller=new AbortController(),threadId=active.id;const replyId=active.messages.at(-1)?.role==='assistant'?active.messages.at(-1)!.id:crypto.randomUUID();
  abort.current=controller;sendingRef.current=true;setSending(true);
  const render=(text:string,pending:boolean,question?:{prompt:string;options:string[]})=>updateThread(threadId,thread=>{const item:ChatMessage={id:replyId,role:'assistant',text,pending,question};return {...thread,messages:thread.messages.some(message=>message.id===replyId)?thread.messages.map(message=>message.id===replyId?item:message):[...thread.messages,item]};});
  void restore(threadId,controller.signal,text=>{if(!controller.signal.aborted)render(text,true);}).then(reply=>{if(reply!==undefined&&!controller.signal.aborted)render(typeof reply==='string'?reply:reply.text,false,typeof reply==='string'?undefined:reply.question);}).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'無法恢復任務。');}).finally(()=>{if(abort.current===controller){abort.current=null;sendingRef.current=false;setSending(false);}});
  return()=>{controller.abort();};
 },[active?.id,props.authoring?.resolutionKey]);

 const pending=threads.flatMap(thread=>thread.messages.flatMap(message=>message.job&&['queued','running'].includes(message.job.status)?[message.job.id]:[]));
 const pendingKey=[...new Set(pending)].sort().join(',');
 useEffect(()=>{
  if(!pendingKey)return;
  let cancelled=false;let running=false;
  async function refresh(){
   if(running)return;running=true;
   try{
    const jobs=await Promise.all(pendingKey.split(',').map(id=>api<ChatJob>(root+'/assistant/'+encodeURIComponent(id))));
    if(cancelled)return;
    setThreads(items=>items.map(thread=>({...thread,messages:thread.messages.map(message=>{const job=jobs.find(item=>item.id===message.job?.id);return job?{...message,job}:message;})})));
    if(jobs.some(job=>!['queued','running'].includes(job.status)))latest.current.onChanged();
   }catch(reason){if(!cancelled)setError(reason instanceof Error?reason.message:'無法更新工作進度');}
   finally{running=false;}
  }
  void refresh();const timer=setInterval(()=>void refresh(),2000);
  return()=>{cancelled=true;clearInterval(timer);};
 },[root,pendingKey]);

 function updateThread(id:string,update:(thread:ChatThread)=>ChatThread){setThreads(items=>items.map(thread=>thread.id===id?update(thread):thread));}
 function create(){
  if(threads.length>=30){setError('對話數量已達上限，請先刪除不需要的對話。');return;}
  const thread=newChat();setThreads(items=>[thread,...items]);setActiveId(thread.id);setHistory(false);setQuestion('');setAllowExecution(false);setError('');
 }
 function remove(thread:ChatThread){
  if(sending||busyThread(thread))return;
  setDeleted(thread);setThreads(items=>{const remaining=items.filter(item=>item.id!==thread.id);return remaining.length?remaining:[newChat()];});
  if(active?.id===thread.id){setActiveId('');setQuestion('');setAllowExecution(false);}
 }
 function rename(thread:ChatThread){
  if(!renameValue.trim())return;
  updateThread(thread.id,item=>({...item,title:renameValue.trim()}));setRenameId('');
 }
 async function send(answerOverride?:string){
  if((sendingRef.current||sending)&&props.authoring?.correct){
   const text=(answerOverride??question).trim();if(!text||!active||dispatching||initial.error||props.disabledReason)return;
   setDispatching(true);setError('');
   try{await props.authoring.correct(text,active.id);updateThread(active.id,thread=>({...thread,messages:[...thread.messages,{id:crypto.randomUUID(),role:'user',text}]}));setQuestion('');}
   catch(reason){setError(reason instanceof Error?reason.message:'修正未送出');}
   finally{setDispatching(false);}return;
  }
  if(sendingRef.current||sending||!(answerOverride??question).trim()||!active||initial.error||props.disabledReason)return;
  if(active.messages.length>197){setError('這段對話已達訊息上限，請建立新對話。');return;}
  sendingRef.current=true;
  const context=latest.current,threadId=active.id,prompt=(answerOverride??question).trim();
  const replyId=crypto.randomUUID();
  const user:ChatMessage={id:crypto.randomUUID(),role:'user',text:prompt};
  const response:ChatMessage={id:replyId,role:'assistant',text:'回覆中…',pending:true};
  updateThread(threadId,thread=>({...thread,title:thread.messages.length?thread.title:prompt.slice(0,60),updatedAt:new Date().toISOString(),messages:[...thread.messages,user,response]}));
  setQuestion('');setError('');setSending(true);follow.current=true;
  const controller=new AbortController();abort.current=controller;
  const timer=setTimeout(()=>controller.abort(),llmTimeouts.browserMs);
  const results:string[]=[];
  try{
   if(context.authoring){
    const reply=await context.authoring.send(prompt,active.messages.filter(item=>!item.pending).map(item=>({role:item.role,content:item.text.slice(0,20000)})),controller.signal,text=>{if(text.startsWith('已'))results.push(text);updateThread(threadId,thread=>({...thread,messages:thread.messages.map(message=>message.id===replyId?{...message,text:[...results,...(text.startsWith('已')?[]:[text])].join('\n')}:message)}));},threadId);
    if(controller.signal.aborted)throw new Error('已停止等待回覆。');
    updateThread(threadId,thread=>({...thread,messages:thread.messages.map(message=>message.id===replyId?{...message,pending:false,text:typeof reply==='string'?reply:reply.text,...(typeof reply==='string'||!reply.question?{}:{question:reply.question}),context:[context.projectName,context.currentName,context.version].filter(Boolean).join(' · ')}:message)}));return;
   }
   if(context.workflowOnly&&context.requestIds.length>50)throw new Error('單次工作最多 50 個接口，請到單點 API 測試指定接口建立流程。');
   const value:ApiUiReply=context.workflowOnly?{reply:'',actions:[{tool:'start_workflow',requestIds:context.requestIds,execute:allowExecution}]}:await api<ApiUiReply>(root+'/ui-chat',{method:'POST',signal:controller.signal,body:JSON.stringify({catalogId:context.catalogId,currentId:context.currentId,environmentId:context.environmentId,page:context.page,tab:context.tab,question:prompt,editor:context.editor,messages:active.messages.filter(item=>!item.pending).slice(-12).map(item=>({role:item.role,content:item.text.slice(0,20000)})),allowExecution,})});
   if(controller.signal.aborted)throw new Error('已停止等待回覆。');
   if(!Array.isArray(value.actions)||typeof value.reply!=='string')throw new Error('AI 回傳格式無效，未操作畫面。');
   if(value.actions.length&&latest.current.uiToken!==context.uiToken)throw new Error('畫面已變更，這次操作未套用，請依目前畫面重新提出要求。');
   let editorContext=context.currentId?{requestId:context.currentId,values:context.editor}:undefined;
   if(value.actions.some(action=>action.tool!=='start_workflow')){const outcome=await latest.current.onOperate(value.actions,context.uiToken);results.push(...outcome.results);editorContext=outcome.editor;}
   const workflow=value.actions.find(action=>action.tool==='start_workflow');
   let job:ChatJob|undefined;
   if(workflow?.tool==='start_workflow'){
    if(!context.environmentId)throw new Error('請先選擇測試環境，再建立案例或流程。');
    if(workflow.execute&&!allowExecution)throw new Error('這次訊息未允許發送 API 請求。');
    setDispatching(true);const requestId=crypto.randomUUID();
    updateThread(threadId,thread=>({...thread,messages:thread.messages.map(message=>message.id===replyId?{...message,pending:false,text:[value.reply,...results].join('\n'),job:{id:requestId,status:'unconfirmed',message:'正在提交工作，請勿重複送出。',tasks:[]}}:message)}));
    job=await api<ChatJob>(root+'/assistant',{method:'POST',body:JSON.stringify({requestId,catalogId:context.catalogId,environmentId:context.environmentId,requestIds:workflow.requestIds,question:prompt,editorContext:editorContext&&workflow.requestIds.includes(editorContext.requestId)?editorContext:undefined,allowExecution:workflow.execute&&allowExecution,})});
    results.push('已建立案例／流程工作');
   }
   updateThread(threadId,thread=>({...thread,messages:thread.messages.map(message=>message.id===replyId?{...message,pending:false,text:[value.reply,...results].filter(Boolean).join('\n'),context:[context.version,context.currentName,context.environmentName].filter(Boolean).join(' · '),job}:message)}));
  }catch(reason){
   const text=controller.signal.aborted?(context.authoring?.cancel?'已停止等待，任務進度仍保留；已送出的操作需確認結果。':'已停止等待回覆，未套用後續畫面操作。'):reason instanceof Error?reason.message:'對話失敗，請重試。';
   updateThread(threadId,thread=>({...thread,messages:thread.messages.map(message=>message.id===replyId?{...message,pending:false,text:[...results,text].join('\n'),job:message.job?{...message.job,status:typeof (reason as {status?:number})?.status==='number'&&(reason as {status:number}).status>=400&&(reason as {status:number}).status<500?'failed':'unconfirmed',message:text}:undefined}:message)}));
  }finally{clearTimeout(timer);sendingRef.current=false;setSending(false);setDispatching(false);setAllowExecution(false);abort.current=null;}
 }
 async function stopAuthoring(){
  try{if(active&&latest.current.authoring?.cancel)await latest.current.authoring.cancel(active.id);abort.current?.abort();}
  catch(reason){setError(reason instanceof Error?reason.message:'停止結果未確認，請重新讀取任務。');}
 }

 return <div className={props.inline?'min-w-0 space-y-3':''}>

  {!props.inline&&<div className="fixed bottom-3 right-3 z-30"><Button ref={trigger} variant="primary" className="min-h-8 min-w-8" aria-label={open?'關閉 AI 聊天':'開啟 AI 聊天'} title={open?'關閉 AI 聊天':'開啟 AI 聊天'} aria-expanded={open} aria-controls="api-chat" onClick={()=>{if(open)close();else{setOpen(true);props.onOpen?.();}}}><ToolIcon name="chat"/></Button></div>}
  <aside ref={panel} id="api-chat" aria-label={props.authoring?"案例聊天助手":"API 聊天助手"} tabIndex={-1} hidden={!open} className={props.inline?('flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface '+(props.authoring?'h-authoring-chat-mobile sm:h-authoring-chat':'h-96')):(open?'flex ':'hidden ')+"fixed inset-x-2 bottom-14 top-3 z-30 min-h-0 flex-col overflow-hidden rounded-xl border border-line-strong bg-surface shadow-popover focus:outline-none sm:left-auto sm:w-chat"}>
   <header className={props.authoring?"shrink-0 space-y-1 border-b border-line bg-canvas text-ink px-3 py-2":"shrink-0 space-y-2 border-b border-line p-3"}>
    <div className="flex min-w-0 items-center gap-2"><h2 className="min-w-0 flex-1 truncate text-body font-medium" title={active?.title}>{active?.title||'新對話'}</h2>{props.authoring&&<ApiChatContext authoring={!!props.authoring} projectName={props.projectName} version={props.version} currentName={props.currentName} environmentName={props.environmentName} pageName={props.pageName}/>}<Button variant={props.authoring?"chat":"secondary"} disabled={sending} aria-label="聊天紀錄" title="聊天紀錄" aria-pressed={history} onClick={()=>setHistory(value=>!value)}><ToolIcon name="history"/></Button><Button variant={props.authoring?"chat":"secondary"} disabled={sending||!!initial.error||!!props.disabledReason} aria-label="新增對話" title="新增對話" onClick={create}><ToolIcon name="plus"/></Button></div>
    {!props.authoring&&<ApiChatContext authoring={!!props.authoring} projectName={props.projectName} version={props.version} currentName={props.currentName} environmentName={props.environmentName} pageName={props.pageName}/>}
    {props.settings&&<details className="relative text-menu"><summary className={"min-h-6 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand "+(props.authoring?"text-ink":"text-muted hover:text-ink")}>操作設定</summary><div className="absolute left-0 top-full z-20 mt-1 w-max max-w-full rounded-xl border border-line bg-surface p-3 text-ink shadow-popover">{props.settings}</div></details>}
   </header>
   {storageError&&<Notice error>{storageError}</Notice>}
   {initial.error&&<Notice error>{initial.error}</Notice>}
   {history?<div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="對話清單">
    <p className="text-menu text-muted">紀錄儲存在此瀏覽器，依專案分開。</p>
    {deleted&&<div className="flex flex-wrap items-center gap-2 text-menu"><span>已刪除對話</span><Button onClick={()=>{if(threads.length>=30){setError('請先刪除另一段對話再復原。');return;}setThreads(items=>[deleted,...items]);setActiveId(deleted.id);setQuestion('');setAllowExecution(false);setDeleted(null);}}>復原</Button></div>}
    {threads.map(thread=><div key={thread.id} className={'min-w-0 space-y-2 rounded-lg border p-2 '+(active?.id===thread.id?'border-brand bg-brand-soft':'border-line')}>
     {renameId===thread.id?<form className="flex min-w-0 gap-2" onSubmit={event=>{event.preventDefault();rename(thread);}}><Input autoFocus aria-label="對話名稱" maxLength={100} value={renameValue} onChange={event=>setRenameValue(event.target.value)}/><Button type="submit" disabled={!renameValue.trim()} aria-label="儲存對話名稱" title="儲存對話名稱"><ToolIcon name="save"/></Button></form>:<div className="flex min-w-0 gap-1"><button className="min-h-8 min-w-0 flex-1 truncate rounded-lg px-2 text-left text-menu hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-current={active?.id===thread.id?'true':undefined} title={thread.title} onClick={()=>{setActiveId(thread.id);setQuestion('');setAllowExecution(false);setHistory(false);}}>{thread.title}</button><Button aria-label={'重新命名 '+thread.title} title="重新命名" onClick={()=>{setRenameId(thread.id);setRenameValue(thread.title);}}><ToolIcon name="rename"/></Button><Button variant="danger" disabled={sending||busyThread(thread)} aria-label={'刪除對話 '+thread.title} title={busyThread(thread)?'工作進行中，無法刪除對話':'刪除對話'} onClick={()=>remove(thread)}><ToolIcon name="trash"/></Button></div>}
    </div>)}
   </div>:<>
    <div ref={log} role="log" aria-label="聊天訊息" aria-live="polite" onScroll={()=>{const element=log.current;if(element){follow.current=element.scrollHeight-element.scrollTop-element.clientHeight<32;if(follow.current)setUnread(false);}}} className={"min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"+(props.authoring?" bg-surface":"")}>
     {props.disabledReason&&<p role="status" className="text-menu text-muted">{props.disabledReason}</p>}
     {!active?.messages.length&&!props.disabledReason&&<p className="text-menu text-muted">{props.authoring?'描述此案例的需求，或請 AI 協助修改目前草稿。':props.workflowOnly?'描述要建立的案例、預期結果或執行順序。':'有什麼可以幫你？'}</p>}
     {active?.messages.map(message=><article key={message.id} aria-label={message.role==='user'?'你的訊息':'AI 回覆'} className={message.role==='user'?(props.authoring?'ml-6 rounded-lg bg-brand-soft p-3':'ml-6 rounded-lg bg-canvas p-3'):'space-y-2'}>
      <p role={message.question&&message.id===active.messages.at(-1)?.id?"region":undefined} aria-label={message.question&&message.id===active.messages.at(-1)?.id?"等待你的回答":undefined} className="whitespace-pre-wrap break-words text-menu">{message.text}{message.question&&!message.text.includes(message.question.prompt)?'\n'+message.question.prompt:''}</p>{message.question&&message.id===active.messages.at(-1)?.id&&!!message.question.options.length&&<div className="flex flex-wrap gap-2">{message.question.options.map(option=><Button key={option} disabled={sending||!!props.disabledReason} onClick={()=>void send(option)}>{option}</Button>)}</div>}
      {message.context&&<details className="text-menu text-muted"><summary className="min-h-8 cursor-pointer rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">本次參考資料</summary><p className="break-words">{message.context}</p></details>}
      {message.job&&<section aria-label="案例流程工作" className="space-y-2 text-menu"><p>{labels[message.job.status]||message.job.status} · {message.job.message}</p>{message.job.status==='unconfirmed'&&<Button onClick={()=>void api<ChatJob>(root+'/assistant/'+message.job!.id).then(job=>updateThread(active.id,thread=>({...thread,messages:thread.messages.map(item=>item.id===message.id?{...item,job}:item)}))).catch(reason=>setError(String(reason)))}>確認工作狀態</Button>}{['queued','running'].includes(message.job.status)&&<Button onClick={()=>void api(root+'/assistant/'+message.job!.id+'/stop',{method:'POST',body:'{}'}).then(()=>setError('')).catch(reason=>setError(String(reason)))}>停止後續步驟</Button>}<details><summary className="min-h-8 cursor-pointer rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">工作細節</summary>{message.job.tasks.map((task,index)=><div key={index} className="space-y-1 py-2"><p>{task.name} · {labels[task.status]||task.status}</p>{task.message&&<p className="break-words text-muted">{task.message}</p>}{task.caseId&&props.onOpenCase&&<Button onClick={()=>props.onOpenCase!(task.caseId!)}>開啟案例</Button>}</div>)}</details>{message.job.scriptId&&props.onOpenScript&&<Button onClick={()=>props.onOpenScript!(message.job!.scriptId!)}>開啟腳本</Button>}</section>}
     </article>)}
    </div>
    {unread&&<div className="flex shrink-0 justify-center pb-2"><Button onClick={()=>{follow.current=true;setUnread(false);log.current?.scrollTo({top:log.current.scrollHeight});}}>查看最新訊息</Button></div>}
    <form className={"shrink-0 space-y-2 border-t border-line p-3"+(props.authoring?" bg-canvas text-ink":"")} onSubmit={event=>{event.preventDefault();void send();}}>
     <div className="relative"><Textarea className={props.authoring?"pb-12":undefined} aria-label="傳送訊息" rows={2} resizable={false} value={question} maxLength={8000} disabled={(sending&&!props.authoring?.correct)||dispatching||!!initial.error||!!props.disabledReason} onChange={event=>setQuestion(event.target.value)} placeholder={props.authoring?(props.authoring.placeholder||"描述此案例的需求或修改方式"):props.workflowOnly?"描述要建立或執行的案例與流程":"詢問問題，或請 AI 操作目前畫面"} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send();}}}/>
     {props.authoring&&<button type={sending&&!question.trim()?'button':'submit'} aria-label={sending&&question.trim()&&props.authoring.correct?'傳送修正':sending?(props.authoring.cancel?'停止任務':'停止等待回覆'):waitingQuestion?'回答並繼續':'傳送訊息'} title={sending&&question.trim()&&props.authoring.correct?'傳送修正':sending?(props.authoring.cancel?'停止任務':'停止等待回覆'):waitingQuestion?'回答並繼續':'傳送訊息'} disabled={sending?dispatching:!question.trim()||!!initial.error||!!props.disabledReason} onClick={sending&&!question.trim()?()=>void stopAuthoring():undefined} className="absolute bottom-4 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-on-brand hover:bg-brand-strong active:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={sending&&!question.trim()?'M6 6h12v12H6Z':'M12 19V5m-6 6 6-6 6 6'}/></svg></button>}
     </div>
     {!props.authoring&&<><div className={'flex items-center gap-2 '+(props.authoring?'justify-end':'justify-between')}>{!props.authoring&&<details className="min-w-0 text-menu"><summary className="min-h-8 cursor-pointer rounded-lg px-2 text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">執行設定</summary><label className="flex min-h-8 items-center gap-2 py-2"><input type="checkbox" disabled={sending} checked={allowExecution} onChange={event=>setAllowExecution(event.target.checked)} className="h-4 w-4 accent-brand"/>允許這次訊息發送 API 請求</label></details>}{sending?<Button disabled={dispatching} aria-label={'停止等待回覆'} title={dispatching?'正在提交工作':'停止等待回覆'} onClick={()=>void stopAuthoring()}><ToolIcon name="stop"/></Button>:<Button type="submit" variant="primary" aria-label="傳送訊息" title="傳送訊息" disabled={!question.trim()||!!initial.error||!!props.disabledReason}><ToolIcon name="send"/></Button>}</div></>}
    </form>
   </>}
   {error&&<div className="shrink-0 p-2"><Notice error>{error}</Notice></div>}
  </aside>
 </div>;
}
