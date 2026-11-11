type Request=<T>(path:string,options?:RequestInit)=>Promise<T>;
import type {CaseMetadata} from './scriptModel.js';
export type AndroidAgentTask={id:string;threadId:string;scriptVersion?:number;state:'running'|'waiting'|'ready'|'stopped'|'uncertain'|'failed';revision:number;message:string;baseSource:string;baseMetadata?:CaseMetadata;draft:{source:string;revision:number;metadata?:CaseMetadata};question?:{prompt:string;options:string[]};resolution?:{draftRevision:number;action:"applied"|"dismissed"};events:{id:string;kind:string;message:string;status:string}[];verification?:{source:string;executionHash?:string;status:string;message:string}};
export async function waitForAgentTask(request:Request,task:AndroidAgentTask,signal:AbortSignal,progress:(message:string)=>void,snapshot?:(task:AndroidAgentTask)=>void){
 snapshot?.(task);
 while(task.state==='running'){
  if(signal.aborted)throw new Error('已停止等待；任務進度已保存在服務中。');
  progress(task.message);
  await new Promise<void>((resolve,reject)=>{const cancel=()=>{clearTimeout(timer);reject(new Error('已停止等待，任務仍保留。'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},700);signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();});
  task=await request<AndroidAgentTask>(`/android/agent-tasks/${encodeURIComponent(task.id)}`,{signal});
  snapshot?.(task);
 }
 return task;
}
export async function latestAgentTask(request:Request,scriptId:string,threadId:string,signal?:AbortSignal){
 return (await request<{task:AndroidAgentTask|null}>(`/android/agent-tasks/latest?scriptId=${encodeURIComponent(scriptId)}&threadId=${encodeURIComponent(threadId)}`,{signal})).task;
}
