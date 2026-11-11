import {registerApiUiChat} from './apiUiChat.ts';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {environmentEditSchema,managedEnvironment,openVariables,sealVariables} from './apiEnvironment.ts';
import {editableRequestSchema,assertSavableRequest,allowedEnvironment} from './requestTransport.ts';
import {digest,diffRequests} from './requestCatalog.ts';
import type {FastifyInstance} from 'fastify';
const fail=(message:string,statusCode=400):never=>{throw Object.assign(new Error(message),{statusCode});};
export function registerApiManagement(app:FastifyInstance,ctx:{pool:any;transaction:any;project:(id:string)=>Promise<any>;catalog:(id:string,project:string)=>Promise<any>;environments:()=>Promise<any[]>;chat?:(question:string,context:any,connectionId?:string)=>Promise<any>;explain?:(question:string,context:any,connectionId?:string)=>Promise<any>}){
 const {pool,transaction,project,catalog}=ctx;
 registerApiUiChat(app,ctx);
 async function environmentSettings(projectId:string){return (await pool.query('SELECT body FROM api_environment_settings WHERE project_id=$1',[projectId])).rows.map((row:any)=>row.body);}
 async function envFor(id:string,projectId:string){const base=await ctx.environments();const item=(await environmentSettings(projectId)).find((item:any)=>item.id===id);return item?managedEnvironment(base,item,projectId):allowedEnvironment(base,id,projectId);}
 async function secretValues(projectId:string,environmentId:string):Promise<Record<string,string>>{const row=(await pool.query("SELECT body FROM api_environment_secrets WHERE project_id=$1 AND environment_id=$2 AND updated_at>now()-interval '12 hours'",[projectId,environmentId])).rows[0];return row?openVariables(row.body,projectId+':'+environmentId):{};}
 async function saveSecrets(projectId:string,environmentId:string,value:Record<string,string>){await pool.query('INSERT INTO api_environment_secrets(project_id,environment_id,body) VALUES($1,$2,$3) ON CONFLICT(project_id,environment_id) DO UPDATE SET body=$3,updated_at=now()',[projectId,environmentId,await sealVariables(value,projectId+':'+environmentId)]);}
 async function listEnvironments(projectId:string){
  const base=(await ctx.environments()).filter(item=>item.enabled&&(!item.projectIds.length||item.projectIds.includes(projectId)));const settings=await environmentSettings(projectId);
  const all=[...base.filter(item=>!settings.some((setting:any)=>setting.id===item.id)),...settings.map((setting:any)=>({...managedEnvironment(base,setting,projectId),...setting}))];
  return Promise.all(all.map(async({id,name,baseUrl,projectIds,authReferences,variables,...item}:any)=>({id,name,baseUrl,projectIds,authReferences:authReferences.map(({id,name}:any)=>({id,name})),variables,headerVariables:item.headerVariables||[],baseEnvironmentId:item.baseEnvironmentId||id,tokenVariable:item.tokenVariable||'authToken',tokenHeader:item.tokenHeader||'Authorization',tokenPrefix:item.tokenPrefix??'Bearer ',secretVariables:Object.keys(await secretValues(projectId,id))})));
 }
 app.put<{Params:{projectId:string}}>('/api/api-library/:projectId/environments',async req=>{const projectId=req.params.projectId;await project(projectId);const input=environmentEditSchema.parse(req.body);managedEnvironment(await ctx.environments(),input,projectId);await pool.query('INSERT INTO api_environment_settings(project_id,id,body) VALUES($1,$2,$3) ON CONFLICT(project_id,id) DO UPDATE SET body=$3',[projectId,input.id,JSON.stringify(input)]);return {saved:true};});
 app.delete<{Params:{projectId:string;id:string}}>('/api/api-library/:projectId/environments/:id/tokens',async req=>{await project(req.params.projectId);await envFor(req.params.id,req.params.projectId);await pool.query('DELETE FROM api_environment_secrets WHERE project_id=$1 AND environment_id=$2',[req.params.projectId,req.params.id]);return {cleared:true};});
 async function revise(projectId:string,id:string,revision:number,change:(body:any)=>void){
  await project(projectId);return transaction(async(client:any)=>{
   await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['catalog:'+projectId]);
   const row=(await client.query('SELECT body FROM request_catalogs WHERE id=$1 AND project_id=$2 FOR UPDATE',[id,projectId])).rows[0];if(!row||row.body.deletedAt)fail('找不到 API 版本。',404);const body=row.body;
   if((body.revision||1)!==revision)fail('版本已被其他視窗修改，請重新載入。',409);
   await client.query('INSERT INTO api_catalog_revisions(catalog_id,revision,body) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[id,body.revision||1,JSON.stringify(body)]);
   const before=digest(body.requests);change(body);body.revision=(body.revision||1)+1;
   if(before!==digest(body.requests)){const prior=(await client.query('SELECT body FROM request_catalogs WHERE project_id=$1 AND version<$2 ORDER BY version DESC LIMIT 1',[projectId,body.version])).rows[0]?.body;body.changes=diffRequests(prior?.requests||[],body.requests);}
   await client.query('UPDATE request_catalogs SET body=$2 WHERE id=$1',[id,JSON.stringify(body)]);return body;
  });
 }
 app.patch<{Params:{projectId:string;id:string}}>('/api/api-library/:projectId/versions/:id',async req=>{const input=z.object({revision:z.number().int().min(1),name:z.string().trim().min(1).max(100)}).strict().parse(req.body);return revise(req.params.projectId,req.params.id,input.revision,body=>{body.name=input.name;});});
 app.delete<{Params:{projectId:string;id:string}}>('/api/api-library/:projectId/versions/:id',async req=>{const input=z.object({revision:z.number().int().min(1)}).strict().parse(req.body);return revise(req.params.projectId,req.params.id,input.revision,body=>{body.deletedAt=new Date().toISOString();});});
 app.patch<{Params:{projectId:string;id:string;requestId:string}}>('/api/api-library/:projectId/versions/:id/requests/:requestId/category',async req=>{const input=z.object({revision:z.number().int().min(1),category:z.string().trim().min(1).max(100)}).strict().parse(req.body);return revise(req.params.projectId,req.params.id,input.revision,body=>{const item=body.requests.find((value:any)=>value.id===req.params.requestId);if(!item)fail('找不到接口。',404);item.category=input.category;});});
 app.post<{Params:{projectId:string;id:string}}>('/api/api-library/:projectId/versions/:id/folders',async req=>{const input=z.object({revision:z.number().int().min(1),name:z.string().trim().min(1).max(100)}).strict().parse(req.body);return revise(req.params.projectId,req.params.id,input.revision,body=>{const existing=new Set(['未分類',...(body.folders||[]),...body.requests.map((item:any)=>item.category||'未分類')]);if(existing.has(input.name))fail('資料夾名稱已存在。',409);if(existing.size>=201)fail('資料夾數量已達上限。');body.folders=[...(body.folders||[]),input.name];});});
 const definitionSchema=z.object({revision:z.number().int().min(1),id:z.string().max(1000).optional(),name:z.string().trim().min(1).max(200),category:z.string().trim().max(100).default('未分類'),description:z.string().max(4000).default(''),kind:z.enum(['http','graphql']),request:editableRequestSchema}).strict();
 app.put<{Params:{projectId:string;id:string}}>('/api/api-library/:projectId/versions/:id/requests',async req=>{const input=definitionSchema.parse(req.body);assertSavableRequest(input.request);return revise(req.params.projectId,req.params.id,input.revision,body=>{
  const old=input.id?body.requests.find((item:any)=>item.id===input.id):undefined;if(input.id&&!old)fail('找不到接口。',404);
  const request={...old,id:old?.id||'manual:'+randomUUID(),name:input.name,category:input.category||'未分類',description:input.description,kind:input.kind,method:input.request.method,endpoint:input.request.endpoint,headers:input.request.headers,queryParams:input.request.queryParams,body:input.request.body,variables:JSON.stringify(input.request.variables),operationName:input.request.operationName,defaults:input.request,responseVariables:input.request.responseVariables,parameterTypes:old?.parameterTypes||'',evidence:old?.evidence||[],dependencies:old?.dependencies||{},issues:old?.issues||[],origin:old?.origin||(old?'source':'manual'),definitionHash:digest(input.request),implementationHash:old?.implementationHash||digest([])};
  body.requests=[...body.requests.filter((item:any)=>item.id!==request.id),request];
 });});
 app.delete<{Params:{projectId:string;id:string;requestId:string}}>('/api/api-library/:projectId/versions/:id/requests/:requestId',async req=>{const input=z.object({revision:z.number().int().min(1)}).strict().parse(req.body);return revise(req.params.projectId,req.params.id,input.revision,body=>{if(!body.requests.some((item:any)=>item.id===req.params.requestId))fail('找不到接口。',404);body.requests=body.requests.filter((item:any)=>item.id!==req.params.requestId);});});
 app.post<{Params:{projectId:string}}>('/api/api-library/:projectId/versions',async req=>{
  await project(req.params.projectId);const input=z.object({sourceCatalogId:z.uuid().optional(),name:z.string().trim().min(1).max(100)}).strict().parse(req.body);const source=input.sourceCatalogId?await catalog(input.sourceCatalogId,req.params.projectId):{projectId:req.params.projectId,snapshotId:randomUUID(),issues:[],sourceHash:digest([])};
  return transaction(async(client:any)=>{await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['catalog:'+req.params.projectId]);if(!input.sourceCatalogId)await client.query('INSERT INTO source_snapshots(id,body) VALUES($1,$2)',[source.snapshotId,JSON.stringify({id:source.snapshotId,projectId:req.params.projectId,origin:'manual',files:[],contentHash:digest([])})]);const last=(await client.query('SELECT version FROM request_catalogs WHERE project_id=$1 ORDER BY version DESC LIMIT 1',[req.params.projectId])).rows[0];const body={...source,id:randomUUID(),version:(last?.version||0)+1,revision:1,name:input.name,folders:[],scanHash:digest([]),requests:[],changes:[],createdAt:new Date().toISOString()};
   await client.query('INSERT INTO request_catalogs(id,project_id,snapshot_id,version,body) VALUES($1,$2,$3,$4,$5)',[body.id,body.projectId,body.snapshotId,body.version,JSON.stringify(body)]);return body;
  });
 });
 app.post<{Params:{projectId:string}}>('/api/api-library/:projectId/explain',async req=>{
  const projectId=req.params.projectId;await project(projectId);const input=z.object({catalogId:z.uuid(),requestId:z.string().min(1).max(1000),question:z.string().trim().min(1).max(2000),connectionId:z.string().max(100).optional()}).strict().parse(req.body);const version=await catalog(input.catalogId,projectId);const definition=version.requests.find((item:any)=>item.id===input.requestId);if(!definition)fail('找不到接口。',404);
  const snapshot=(await pool.query('SELECT body FROM source_snapshots WHERE id=$1',[version.snapshotId])).rows[0]?.body;
  const evidence:any[]=[];let size=0;for(const file of snapshot?.files||[]){const related=definition.evidence.some((item:any)=>file.path.endsWith(item.path))||definition.operationName&&file.source.includes(definition.operationName);if(!related)continue;const lines=file.source.split('\n');for(let i=0;i<lines.length;i++)if(definition.operationName?lines[i].includes(definition.operationName):definition.evidence.some((item:any)=>file.path.endsWith(item.path)&&Math.abs(item.line-i-1)<2)){const start=Math.max(0,i-8);const source=lines.slice(start,i+14).join('\n');if(size+source.length>32000)break;evidence.push({path:file.path,line:start+1,source});size+=source.length;}}
  const context={definition:{name:definition.name,method:definition.method,endpoint:definition.endpoint,operationName:definition.operationName},evidence:[] as any[],scope:'僅提供有界的來源片段；不是完整程式。缺少證據時必須說明未知。'};
  for(const item of evidence){if(JSON.stringify({...context,evidence:[...context.evidence,item]}).length>14000)break;context.evidence.push(item);}
  if(!ctx.explain)fail('AI 說明尚未配置。',503);return ctx.explain!('請以繁體中文解釋接口用途、前端使用功能與呼叫流程。引用檔名與行號；未能確定的事項明確說明。只解釋，不改寫接口、不執行請求。問題：'+input.question,context,input.connectionId);
 });
 app.delete<{Params:{projectId:string}}>('/api/api-library/:projectId/legacy-drafts',async req=>{
  const projectId=req.params.projectId;await project(projectId);return transaction(async(client:any)=>{
   const active=(await client.query("SELECT id FROM api_analysis_jobs WHERE project_id=$1 AND status IN ('queued','running') FOR UPDATE",[projectId])).rows;
   if(active.length){await client.query("UPDATE api_analysis_jobs SET cancel_requested=true WHERE project_id=$1 AND status IN ('queued','running')",[projectId]);return {cleared:false,stopping:true};}
   await client.query("UPDATE api_analysis_jobs SET body=body-'items'-'baseline' WHERE project_id=$1 AND status IN ('succeeded','failed','cancelled')",[projectId]);
   await client.query("UPDATE documents SET value=value-$1,revision=revision+1,updated_at=now() WHERE key='archify.api-drafts.v1' AND value ? $1",[projectId]);return {cleared:true};
  });
 });
 async function runtimeEnvironment(id:string,projectId:string){const environment=await envFor(id,projectId);const setting=(await environmentSettings(projectId)).find((item:any)=>item.id===id);const values=await secretValues(projectId,id);const token=values[setting?.tokenVariable||'authToken'];return {...environment,variables:{...environment.variables,...values},headers:{...environment.headers,...(token?{[setting?.tokenHeader||'Authorization']:(setting?.tokenPrefix??'Bearer ')+token}:{})}};}
 return {envFor,runtimeEnvironment,listEnvironments,environmentSettings,secretValues,saveSecrets};
}
