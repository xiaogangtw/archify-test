import type {FastifyInstance} from 'fastify';
import {z} from 'zod';
import {caseFingerprint} from './apiWorkflow.ts';

function fail(message:string,statusCode=409):never{throw Object.assign(new Error(message),{statusCode});}
export function registerApiCaseResponses(app:FastifyInstance,ctx:{pool:any;transaction:any;project:(id:string)=>Promise<any>}){
 async function saved(client:any,id:string,projectId:string){const value=(await client.query('SELECT body FROM api_cases WHERE id=$1 AND project_id=$2',[id,projectId])).rows[0]?.body;if(!value||value.deletedAt)fail('找不到此專案的案例。',404);return value;}
 app.patch<{Params:{projectId:string;id:string}}>('/api/api-library/:projectId/cases/:id',async req=>{
  const {projectId,id}=req.params;await ctx.project(projectId);z.uuid().parse(id);const input=z.object({version:z.number().int().positive(),name:z.string().trim().min(1).max(200)}).strict().parse(req.body);
  return ctx.transaction(async(client:any)=>{await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['api-case:'+id]);const previous=await saved(client,id,projectId);if(previous.version!==input.version)fail('案例已修改，請重新讀取。');if(previous.name===input.name)return previous;
   const body={...previous,name:input.name,version:previous.version+1,updatedAt:new Date().toISOString()};
   await client.query('UPDATE api_cases SET version=$3,body=$4 WHERE id=$1 AND project_id=$2',[id,projectId,body.version,JSON.stringify(body)]);
   await client.query('INSERT INTO api_case_versions(case_id,version,body) VALUES($1,$2,$3)',[id,body.version,JSON.stringify(body)]);
   await syncDocument(client,id,body);return body;
  });
 });
 app.delete<{Params:{projectId:string;id:string}}>('/api/api-library/:projectId/cases/:id',async req=>{
  const {projectId,id}=req.params;await ctx.project(projectId);z.uuid().parse(id);const input=z.object({version:z.number().int().positive()}).strict().parse(req.body);
  return ctx.transaction(async(client:any)=>{await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['api-case:'+id]);const previous=await saved(client,id,projectId);if(previous.version!==input.version)fail('案例已修改，請重新讀取。');
   const running=(await client.query("SELECT id FROM api_request_runs WHERE project_id=$1 AND body->>'caseId'=$2 AND status IN ('queued','running') LIMIT 1",[projectId,id])).rows[0];
   const workflow=(await client.query("SELECT id FROM api_workflow_jobs WHERE project_id=$1 AND status IN ('queued','running') AND ((body->'caseRefs') @> $2::jsonb OR (body->'tasks') @> $3::jsonb OR (body->'allowedIds') ? $4) LIMIT 1",[projectId,JSON.stringify([{id}]),JSON.stringify([{caseId:id}]),previous.requestId])).rows[0];
   if(running||workflow)fail('案例正在排隊或執行，請先停止測試。');
   await client.query('UPDATE api_cases SET body=$3 WHERE id=$1 AND project_id=$2',[id,projectId,JSON.stringify({...previous,deletedAt:new Date().toISOString()})]);await syncDocument(client,id);return {deleted:true};
  });
 });
 async function syncDocument(client:any,id:string,body?:any){const key='archify.testing.v1';await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[key]);const doc=(await client.query('SELECT value FROM documents WHERE key=$1 FOR UPDATE',[key])).rows[0]?.value;if(!doc)return;doc.cases=(doc.cases||[]).flatMap((item:any)=>item.id===id?(body?[{...item,name:body.name,version:body.version}]:[]):[item]);await client.query('UPDATE documents SET value=$2,revision=revision+1,updated_at=now() WHERE key=$1',[key,JSON.stringify(doc)]);}
 app.get<{Params:{projectId:string;id:string}}>('/api/api-library/:projectId/cases/:id/responses',async req=>{
  const {projectId,id}=req.params;await ctx.project(projectId);z.uuid().parse(id);await saved(ctx.pool,id,projectId);
  return (await ctx.pool.query("SELECT body FROM api_case_responses WHERE project_id=$1 AND case_id=$2",[projectId,id])).rows.map((row:any)=>row.body);
 });
 app.get<{Params:{projectId:string;id:string}}>('/api/api-library/:projectId/cases/:id/latest-response',async req=>{
  const {projectId,id}=req.params;await ctx.project(projectId);z.uuid().parse(id);await saved(ctx.pool,id,projectId);
  const run=(await ctx.pool.query("SELECT id,status,body,created_at FROM api_request_runs WHERE project_id=$1 AND body->>'caseId'=$2 AND status IN ('passed','failed') AND NOT (body ? 'deletedAt') ORDER BY created_at DESC LIMIT 1",[projectId,id])).rows[0];return {run:run||null};
 });
 app.post<{Params:{projectId:string;id:string}}>('/api/api-library/:projectId/cases/:id/responses',async req=>{
  const {projectId,id}=req.params;await ctx.project(projectId);z.uuid().parse(id);const input=z.object({runId:z.uuid(),caseVersion:z.number().int().positive()}).strict().parse(req.body);
  return ctx.transaction(async(client:any)=>{const value=await saved(client,id,projectId);if(value.version!==input.caseVersion)fail('案例已修改，請重新讀取。');
   const run=(await client.query('SELECT id,status,body,request_key,created_at FROM api_request_runs WHERE id=$1 AND project_id=$2 FOR UPDATE',[input.runId,projectId])).rows[0];
   if(!run||run.body.deletedAt||!['passed','failed'].includes(run.status))fail('找不到已完成的實際回應。');
   if(run.body.caseId&&run.body.caseId!==id)fail('此回應屬於另一個案例，不能移動。');
   if(!run.body.request||run.request_key!==value.requestId||caseFingerprint({...value,request:{...value.request,environmentId:run.body.request.environmentId}})!==caseFingerprint({...value,request:run.body.request}))fail('案例參數或預期結果與這次請求不同，請執行案例取得回應。');
   const metadata={caseId:id,caseVersion:run.body.caseVersion||value.version,savedForCaseVersion:value.version,caseName:value.name,scenario:value.scenario||'positive'};
   const snapshot={id:run.id,status:run.status,created_at:run.created_at,body:{...run.body,...metadata},savedAt:new Date().toISOString()};
   await client.query('INSERT INTO api_case_responses(case_id,project_id,run_id,body) VALUES($1,$2,$3,$4) ON CONFLICT(case_id) DO UPDATE SET run_id=$3,body=$4,updated_at=now()',[id,projectId,run.id,JSON.stringify(snapshot)]);
   return snapshot;
  });
 });
}
