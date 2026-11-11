import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {publicRun,terminal} from './model.ts';
import {androidReportRecord} from './androidReport.ts';

const fail=(statusCode:number,message:string):never=>{throw Object.assign(new Error(message),{statusCode});};
export function workflowRecord(row:any) {
 const body=row.body,tasks=body.tasks||[];
 const status=row.status==='completed'?(tasks.length&&tasks.every((task:any)=>task.status==='passed')?'passed':'skipped'):row.status;
 return {id:row.id,recordKind:'workflow',projectId:row.project_id,scriptId:body.scriptId,scriptVersion:body.scriptVersion,scriptName:body.question||'API 流程',source:'',sourceHash:'',sourceSnapshotId:body.snapshotId||'',environment:body.environmentId||'未記錄',deploymentVerified:false,steps:tasks.map((task:any)=>task.name),completed:tasks.filter((task:any)=>['passed','draft','failed','skipped'].includes(task.status)).length,status,message:body.message||'',mode:'real',testVersion:'API-'+row.id,createdAt:row.created_at,startedAt:null,finishedAt:terminal.has(status)?row.updated_at:null,repositories:[],events:tasks.map((task:any,index:number)=>({sequence:index+1,event:{type:'step-end',title:task.name,status:task.status==='draft'?'skipped':task.status,message:task.message||''}}))};
}
export function reportSummary(records:any[]) {
 const counts={passed:0,failed:0,skipped:0,cancelled:0,queued:0,running:0};
 for(const record of records)if(record.status in counts)counts[record.status as keyof typeof counts]++;
 return {manualCommits:records[0].manualCommits||{},testVersion:records[0].testVersion,batchId:records[0].batchId,name:records[0].batchName||'',createdAt:records[0].batchCreatedAt||records.map(item=>new Date(item.createdAt).toISOString()).sort()[0],total:records.length,counts,ready:!counts.queued&&!counts.running,names:records.map(item=>item.scriptName||item.scriptId)};
}
export function registerExecutionRecords(app:FastifyInstance,{pool,transaction}:{pool:any;transaction:any}) {
 const ownerOf=(req:any)=>String(req.headers['x-archify-user']||'local');
 async function reportRecords(req:any) {
  const android=await pool.query("SELECT body FROM android_runs WHERE body->>'executionOrigin'='e2e-batch' AND body->>'owner'=$1 AND NOT (body ? 'deletedAt') ORDER BY body->>'createdAt' DESC",[ownerOf(req)]);
  return [...await list(),...android.rows.map((row:any)=>androidReportRecord(row.body))];
 }
 const reportVersion=(record:any)=>record.reportVersion||record.testVersion;
 async function list() {
  const rows=await pool.query('SELECT r.*,b.name AS batch_name,b.created_at AS batch_created_at FROM runs r LEFT JOIN batches b ON b.id=r.batch_id WHERE r.deleted_at IS NULL ORDER BY r.created_at DESC');
  const workflows=await pool.query("SELECT * FROM api_workflow_jobs WHERE deleted_at IS NULL AND body->>'scriptId' IS NOT NULL ORDER BY created_at DESC");
  return [...rows.rows.map((row:any)=>({...publicRun(row),recordKind:'run',batchId:row.batch_id||null,batchName:row.batch_name||'',batchCreatedAt:row.batch_created_at})),...workflows.rows.map(workflowRecord)].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
 }
 async function detail(kind:string,id:string,client=pool,lock=false) {
  const table=kind==='run'?'runs':'api_workflow_jobs';
  const row=(await client.query(`SELECT * FROM ${table} WHERE id=$1 AND deleted_at IS NULL${lock?' FOR UPDATE':''}`,[id])).rows[0];
  if(!row||(kind==='workflow'&&!row.body.scriptId))fail(404,'找不到執行紀錄。');
  if(kind==='workflow')return workflowRecord(row);
  const events=(await client.query('SELECT sequence,event,created_at FROM run_events WHERE run_id=$1 ORDER BY sequence',[id])).rows;
  return {...publicRun(row),recordKind:'run',events};
 }
 const key=z.object({kind:z.enum(['run','workflow']),id:z.uuid()});
 app.get('/api/execution-records',list);
 app.get<{Params:{kind:string;id:string}}>('/api/execution-records/:kind/:id',async req=>{const {kind,id}=key.parse(req.params);return detail(kind,id);});
 app.delete<{Params:{kind:string;id:string}}>('/api/execution-records/:kind/:id',async req=>{
  const {kind,id}=key.parse(req.params);
  return transaction(async(client:any)=>{
   const record=await detail(kind,id,client,true);
   if(!terminal.has(record.status))fail(409,'排隊或執行中不能刪除。');
   const active=await client.query("SELECT id FROM runs WHERE test_version=$1 AND status IN ('queued','running') LIMIT 1",[record.testVersion]);
   if(active.rows.length)fail(409,'此版本仍在執行，請結束後再刪除。');
   await client.query(`UPDATE ${kind==='run'?'runs':'api_workflow_jobs'} SET deleted_at=now() WHERE id=$1`,[id]);
   return {deleted:true};
  });
 });
 app.delete<{Params:{version:string}}>('/api/execution-versions/:version',async req=>{
  const version=z.string().min(1).max(200).parse(req.params.version);
  return transaction(async(client:any)=>{
   if(version.startsWith('ANDROID-BATCH-')) {
    const batchId=z.uuid().parse(version.slice('ANDROID-BATCH-'.length));
    const rows=(await client.query("SELECT body FROM android_runs WHERE body->>'executionOrigin'='e2e-batch' AND body->>'batchId'=$1 AND body->>'owner'=$2 AND NOT (body ? 'deletedAt') FOR UPDATE",[batchId,ownerOf(req)])).rows;
    if(!rows.length)fail(404,'找不到執行版本。');
    if(rows.some((row:any)=>!terminal.has(row.body.status)))fail(409,'排隊或執行中不能刪除。');
    await client.query("UPDATE android_runs SET body=body || jsonb_build_object('deletedAt',now()) WHERE body->>'executionOrigin'='e2e-batch' AND body->>'batchId'=$1 AND body->>'owner'=$2 AND NOT (body ? 'deletedAt')",[batchId,ownerOf(req)]);
    return {deleted:true,count:rows.length};
   }
   const rows=(await client.query('SELECT * FROM runs WHERE test_version=$1 AND deleted_at IS NULL ORDER BY id FOR UPDATE',[version])).rows;
   const workflowId=version.startsWith('API-')?z.uuid().safeParse(version.slice(4)):null;
   const workflows=workflowId?.success?(await client.query("SELECT * FROM api_workflow_jobs WHERE id=$1 AND deleted_at IS NULL AND body->>'scriptId' IS NOT NULL FOR UPDATE",[workflowId.data])).rows:[];
   if(!rows.length&&!workflows.length)fail(404,'找不到執行版本。');
   if([...rows,...workflows].some(row=>['queued','running'].includes(row.status)))fail(409,'排隊或執行中不能刪除。');
   await client.query('UPDATE runs SET deleted_at=now() WHERE test_version=$1 AND deleted_at IS NULL',[version]);
   if(workflows.length&&workflowId?.success)await client.query('UPDATE api_workflow_jobs SET deleted_at=now() WHERE id=$1',[workflowId.data]);
   return {deleted:true,count:rows.length+workflows.length};
  });
 });
 app.get('/api/quality-reports',async req=>{
  const groups=new Map<string,any[]>();for(const record of await reportRecords(req))if(record.batchId)groups.set(reportVersion(record),[...(groups.get(reportVersion(record))||[]),record]);
  return [...groups.entries()].map(([version,records])=>({...reportSummary(records),testVersion:version}));
 });
 app.get<{Params:{version:string}}>('/api/quality-reports/:version',async req=>{
  const version=z.string().min(1).max(200).parse(req.params.version);
  const records=(await reportRecords(req)).filter(item=>item.batchId&&reportVersion(item)===version);
  if(!records.length)fail(404,'找不到品質報告。');
  if(records.some(item=>!terminal.has(item.status)))fail(409,'執行結束後即可下載報告。');
  const details=await Promise.all(records.map(item=>item.recordKind==='android'?item:detail(item.recordKind,item.id)));
  return {...reportSummary(records),testVersion:version,records:details};
 });
 app.patch<{Params:{version:string}}>('/api/quality-reports/:version',async req=>{
  const version=z.string().min(1).max(200).parse(req.params.version);
  const {name}=z.object({name:z.string().trim().min(1).max(100)}).strict().parse(req.body);
  if(version.startsWith('ANDROID-BATCH-')) {
   const batchId=z.uuid().parse(version.slice('ANDROID-BATCH-'.length));
   const result=await pool.query("UPDATE android_runs SET body=body || jsonb_build_object('batchName',$3::text) WHERE body->>'executionOrigin'='e2e-batch' AND body->>'batchId'=$1 AND body->>'owner'=$2 AND NOT (body ? 'deletedAt') RETURNING id",[batchId,ownerOf(req),name]);
   if(!result.rows.length)fail(404,'找不到批次報告。');return {name};
  }
  const result=await pool.query('UPDATE batches SET name=$2 WHERE test_version=$1 AND EXISTS (SELECT 1 FROM runs WHERE runs.batch_id=batches.id AND runs.deleted_at IS NULL) RETURNING id',[version,name]);
  if(!result.rows.length)fail(404,'找不到批次報告。');return {name};
 });
}
