import type {Pool} from 'pg';
import {appendAgentInstruction,type AgentInstructions} from './androidAgentMemory.ts';
export type Correction={requestId:string;question:string};
export interface TaskInbox{enqueue(id:string,input:Correction):Promise<void>;pending(id:string):Promise<Correction[]>;acknowledge(id:string,ids:string[]):Promise<void>}
type Task={goal:string;instructions?:AgentInstructions;requestIds:string[]};
function admit(task:Task,pending:Correction[],input:Correction){
 if(task.requestIds.includes(input.requestId)||pending.some(item=>item.requestId===input.requestId))return false;
 if(pending.length>=10)throw Object.assign(new Error('修正訊息仍在處理，請稍後再傳送。'),{statusCode:429});
 let instructions=task.instructions??[{requestId:'legacy-goal',content:task.goal}];
 for(const item of [...pending,input])instructions=appendAgentInstruction(instructions,item.requestId,item.question);
 return true;
}
export function memoryTaskInbox(get:(id:string)=>Task|undefined):TaskInbox{
 const rows=new Map<string,Correction[]>();
 return {pending:async id=>structuredClone(rows.get(id)||[]),enqueue:async(id,input)=>{const task=get(id);if(!task)throw new Error('找不到此任務。');const pending=rows.get(id)||[];if(admit(task,pending,input))rows.set(id,[...pending,structuredClone(input)]);},acknowledge:async(id,ids)=>{rows.set(id,(rows.get(id)||[]).filter(item=>!ids.includes(item.requestId)));}};
}
export function databaseTaskInbox(pool:Pool):TaskInbox{
 const pending=async(client:any,id:string)=>(await client.query('SELECT request_id AS "requestId",question FROM android_agent_inbox WHERE task_id=$1 AND consumed_at IS NULL ORDER BY sequence',[id])).rows as Correction[];
 return {pending:id=>pending(pool,id),acknowledge:async(id,ids)=>{if(ids.length)await pool.query('UPDATE android_agent_inbox SET consumed_at=now() WHERE task_id=$1 AND request_id=ANY($2::uuid[])',[id,ids]);},enqueue:async(id,input)=>{
  const client=await pool.connect();
  try{await client.query('BEGIN');const task=(await client.query('SELECT body FROM android_agent_tasks WHERE id=$1 FOR UPDATE',[id])).rows[0]?.body;
   if(!task)throw new Error('找不到此任務。');
   if(admit(task,await pending(client,id),input))await client.query('INSERT INTO android_agent_inbox(task_id,request_id,question) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[id,input.requestId,input.question]);
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }};
}
