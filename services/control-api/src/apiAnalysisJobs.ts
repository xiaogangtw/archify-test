import {randomUUID} from 'node:crypto';
import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {pool as databasePool,transaction as databaseTransaction} from './db.ts';
import {apiCasePrompt,parseApiCases,type ApiCaseDraft} from './apiCaseModel.ts';
import {apiAnalysisVersion,selectApiSources,sourceAnalysisParts} from './apiAnalysis.ts';
import {resolveAgentConnection,connectionFingerprint,type ModelConnection} from './modelConnections.ts';
export function mergeApiCases(items:ApiCaseDraft[]) {
 const seen=new Set<string>();return items.filter(item=>{const key=JSON.stringify([item.method,item.endpoint,item.operationName,item.name]);if(seen.has(key))return false;seen.add(key);return true;});
}
export function analysisView(row:any){return {id:row.id,projectId:row.project_id,status:row.status,cancelRequested:row.cancel_requested,createdAt:row.created_at,finishedAt:row.finished_at,...row.body,project:undefined,baseline:undefined,fingerprint:undefined};}
export function registerApiAnalysis(app:FastifyInstance,deps:{connections:()=>Promise<ModelConnection[]>;capture:(project:any)=>Promise<any>;db?:{query:(...args:any[])=>Promise<any>};tx?:<T>(fn:(client:any)=>Promise<T>)=>Promise<T>}) {
 const pool:{query:(...args:any[])=>Promise<any>}=deps.db || {query:(sql:string,values?:any[])=>databasePool.query(sql,values)};const transaction=deps.tx || databaseTransaction;
 let stopping=false;let active=false;let timer:ReturnType<typeof setInterval>|undefined;
 async function cancelled(id:string,lease:string) {
  const row=(await pool.query('SELECT cancel_requested,status,lease_token FROM api_analysis_jobs WHERE id=$1',[id])).rows[0];
  return !row || row.cancel_requested || row.status!=='running' || row.lease_token!==lease;
 }
 async function tick(){
  if(stopping || active)return;active=true;
  let job:any;let heartbeat:ReturnType<typeof setInterval>|undefined;
  try {
   await pool.query("UPDATE api_analysis_jobs SET status=CASE WHEN cancel_requested THEN 'cancelled' ELSE 'failed' END,finished_at=now(),body=jsonb_set(body,'{message}',to_jsonb('背景工作失聯，已保留完成批次；未自動重送。'::text)) WHERE status='running' AND lease_until<now()");
   job=await transaction(async client=>{
    const row=(await client.query("SELECT id FROM api_analysis_jobs WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1")).rows[0];if(!row)return;
    return (await client.query("UPDATE api_analysis_jobs SET status='running',lease_token=$2,lease_until=now()+interval '240 seconds' WHERE id=$1 RETURNING *",[row.id,randomUUID()])).rows[0];
   });if(!job)return;
   // Renewable liveness lease; it must not limit the duration of a model request.
   heartbeat=setInterval(()=>{void pool.query("UPDATE api_analysis_jobs SET lease_until=now()+interval '240 seconds' WHERE id=$1 AND lease_token=$2 AND status='running'",[job.id,job.lease_token]).catch(()=>{});},10000);
   const body=job.body;
   body.prompt ||= apiCasePrompt;
   const diagnosticPrompt='缺漏請分行標記：【來源解析】缺少或未解析的來源與確切引用路徑；【測試設定】需使用者提供的環境網址、認證參照或有效業務資料；【行為確認】例如 remoteReport 條件是否成立。每項說明依據與下一步，不能將原始碼實作當成需要使用者手寫的測試資料。沒有缺漏時 missing 必須是空字串，不要填無或不需認證。只在有遠端請求證據時產生 API 案例；條件式請求須保留觸發條件，不能宣稱一定發送。來源檔已包含所需實作時，不要只因未提供 alias 設定原文就宣稱缺少實作。';
   const update=async()=>{await pool.query("UPDATE api_analysis_jobs SET body=$3 WHERE id=$1 AND lease_token=$2 AND status='running'",[job.id,job.lease_token,JSON.stringify(body)]);};
   if(await cancelled(job.id,job.lease_token))throw new Error('cancelled');
   body.message=body.snapshotId?'正在讀取已暫存進度':'正在固定來源與篩選 API 相關片段';await update();
   const snapshot=body.snapshotId?(await pool.query('SELECT body FROM source_snapshots WHERE id=$1',[body.snapshotId])).rows[0]?.body:await deps.capture(body.project);
   if(!snapshot)throw new Error('原來源快照不存在，無法接續；已完成結果仍保留。');
   if(body.snapshotId && snapshot.apiAnalysisVersion!==apiAnalysisVersion)throw new Error('此工作使用舊版分析分批，請建立新的 LLM 整理工作；原快照與已完成結果仍保留。');
   const selection=selectApiSources(snapshot.files);const parts=snapshot.apiAnalysisVersion===apiAnalysisVersion && snapshot.apiAnalysisParts || sourceAnalysisParts(snapshot.files);
   if(!parts.length)throw new Error('未找到可辨識的 API 來源，未送出任何模型請求。');
   if(body.snapshotId && body.total!==parts.length)throw new Error('來源分批版本已變更，無法安全接續；已完成結果仍保留。');
   if(!body.snapshotId){snapshot.apiAnalysisParts=parts;snapshot.apiAnalysisVersion=apiAnalysisVersion;await pool.query('INSERT INTO source_snapshots(id,body) VALUES($1,$2)',[snapshot.id,JSON.stringify(snapshot)]);}
   body.snapshotId=snapshot.id;body.total=parts.length;body.selection={totalFiles:selection.totalFiles,selectedFiles:selection.selectedFiles,unresolved:selection.unresolved};await update();
   for(let part=body.completed || 0;part<parts.length;part++){
    if(stopping || await cancelled(job.id,job.lease_token))throw new Error('cancelled');
    body.message=`LLM 整理中 ${part+1} / ${parts.length}`;await update();
    const response=await app.inject({method:'POST',url:'/api/llm',headers:{'x-archify-client':'web'},payload:{connectionId:body.connectionId,expectedFingerprint:body.fingerprint,agentId:'api-analyst',includeSource:true,sourceSnapshotId:snapshot.id,sourcePart:part,messages:[{role:'user',content:body.prompt+'\n'+diagnosticPrompt}]}});
    if(await cancelled(job.id,job.lease_token))throw new Error('cancelled');
    const answer=response.json();if(response.statusCode>=400)throw new Error(answer.error || '模型請求失敗');
    body.items=mergeApiCases([...body.items,...parseApiCases(answer.reply)]);body.completed=part+1;await update();
   }
   if(!body.items.length)throw new Error('模型沒有回傳具來源依據的 API 案例，既有案例仍保留。');
   await transaction(async client=>{
    const current=(await client.query('SELECT status,cancel_requested,lease_token FROM api_analysis_jobs WHERE id=$1 FOR UPDATE',[job.id])).rows[0];
    if(current.cancel_requested || current.status!=='running' || current.lease_token!==job.lease_token)throw new Error('cancelled');
    const key='archify.api-drafts.v1';await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[key]);
    const doc=(await client.query('SELECT value FROM documents WHERE key=$1 FOR UPDATE',[key])).rows[0];const value=doc?.value || {};
    const unchanged=JSON.stringify(value[job.project_id] || null)===JSON.stringify(body.baseline);
    body.saved=unchanged;body.message=unchanged?'整理完成，案例草稿已保存':'整理完成，但既有案例已被修改；結果保留在背景工作，未覆蓋編輯。';
    if(unchanged){value[job.project_id]={snapshotId:snapshot.id,items:body.items};await client.query('INSERT INTO documents(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2,revision=documents.revision+1,updated_at=now()',[key,JSON.stringify(value)]);}
    await client.query("UPDATE api_analysis_jobs SET status='succeeded',body=$2,finished_at=now() WHERE id=$1",[job.id,JSON.stringify(body)]);
   });
  }catch(reason){
   if(job){const isCancelled=await cancelled(job.id,job.lease_token).catch(()=>false);job.body.message=isCancelled?'已取消；已送出的模型請求可能已完成，結果未套用。':reason instanceof Error?reason.message:'背景分析失敗';
    await pool.query("UPDATE api_analysis_jobs SET status=$3,body=$4,finished_at=now() WHERE id=$1 AND lease_token=$2 AND status='running'",[job.id,job.lease_token,isCancelled?'cancelled':'failed',JSON.stringify(job.body)]).catch(()=>{});}
   else app.log.error({message:reason instanceof Error?reason.message:'Analysis worker failed'});
  }finally{if(heartbeat)clearInterval(heartbeat);active=false;}
 }
 app.post('/api/api-analyses',async(req,reply)=>{
  const input=z.object({requestId:z.uuid(),projectId:z.string().min(1).max(100),connectionId:z.string().max(100).optional()}).parse(req.body);
  const existing=(await pool.query('SELECT * FROM api_analysis_jobs WHERE request_id=$1',[input.requestId])).rows[0];if(existing)return analysisView(existing);
  const data=(await pool.query('SELECT value FROM documents WHERE key=$1',['archify.testing.v1'])).rows[0]?.value;
  const project=[...(data?.projects || []),data?.project].find(item=>item && (item.id || 'original')===input.projectId);if(!project)throw Object.assign(new Error('找不到專案。'),{statusCode:404});
  const agents=(await pool.query('SELECT value FROM documents WHERE key=$1',['archify.agents.v1'])).rows[0]?.value||[];
  const profile=resolveAgentConnection(await deps.connections(),agents,'api-analyst',input.connectionId);
  const agent=agents.find((item:any)=>item.id==='api-analyst');if(!agent)throw Object.assign(new Error('找不到 API 分析 Agent。'),{statusCode:409});
  const drafts=(await pool.query('SELECT value FROM documents WHERE key=$1',['archify.api-drafts.v1'])).rows[0]?.value || {};
  return transaction(async client=>{
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['analysis:'+input.projectId]);
   const running=(await client.query("SELECT * FROM api_analysis_jobs WHERE project_id=$1 AND status IN ('queued','running')",[input.projectId])).rows[0];if(running)return analysisView(running);
   const body={project,connectionId:profile.id,modelSelection:{provider:profile.provider,requestedModel:profile.model||null,scope:agent.modelConnectionId?'agent':'global'},fingerprint:connectionFingerprint(profile,agent),baseline:drafts[input.projectId] || null,items:[],completed:0,total:0,message:'已排入背景整理'};
   const row=(await client.query("INSERT INTO api_analysis_jobs(id,request_id,project_id,status,body) VALUES($1,$2,$3,'queued',$4) RETURNING *",[randomUUID(),input.requestId,input.projectId,JSON.stringify(body)])).rows[0];reply.code(202);return analysisView(row);
  });
 });
 app.get<{Querystring:{projectId:string}}>('/api/api-analyses/latest',async(req)=>{const id=z.string().min(1).max(100).parse(req.query.projectId);const row=(await pool.query('SELECT * FROM api_analysis_jobs WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1',[id])).rows[0];return row?analysisView(row):null;});
 app.post<{Params:{id:string}}>('/api/api-analyses/:id/resume',async(req)=>{
  const id=z.uuid().parse(req.params.id);
  return transaction(async client=>{
   const found=(await client.query('SELECT * FROM api_analysis_jobs WHERE id=$1',[id])).rows[0];
   if(!found)throw Object.assign(new Error('找不到背景工作。'),{statusCode:404});
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['analysis:'+found.project_id]);
   const row=(await client.query('SELECT * FROM api_analysis_jobs WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(['queued','running'].includes(row.status))return analysisView(row);
   if(!['failed','cancelled'].includes(row.status))throw Object.assign(new Error('此工作已完成。'),{statusCode:409});
   const other=(await client.query("SELECT id FROM api_analysis_jobs WHERE project_id=$1 AND status IN ('queued','running')",[row.project_id])).rows[0];
   if(other)throw Object.assign(new Error('此專案已有整理工作，請先完成或取消。'),{statusCode:409});
   row.body.message=`已暫存 ${row.body.completed || 0} 批，等待接續整理`;
   const result=(await client.query("UPDATE api_analysis_jobs SET status='queued',cancel_requested=false,lease_token=NULL,lease_until=NULL,finished_at=NULL,body=$2 WHERE id=$1 RETURNING *",[id,JSON.stringify(row.body)])).rows[0];
   return analysisView(result);
  });
 });
 app.post<{Params:{id:string}}>('/api/api-analyses/:id/cancel',async(req)=>{const id=z.uuid().parse(req.params.id);const row=(await pool.query("UPDATE api_analysis_jobs SET cancel_requested=true,status=CASE WHEN status='queued' THEN 'cancelled' ELSE status END,finished_at=CASE WHEN status='queued' THEN now() ELSE finished_at END WHERE id=$1 AND status IN ('queued','running') RETURNING *",[id])).rows[0];if(!row)throw Object.assign(new Error('找不到背景工作'),{statusCode:404});return analysisView(row);});
 app.addHook('onReady',async()=>{if(process.env.NODE_ENV!=='test'){timer=setInterval(()=>void tick(),1000);timer.unref();}});
 app.addHook('onClose',async()=>{stopping=true;if(timer)clearInterval(timer);});
 return {tick};
}
