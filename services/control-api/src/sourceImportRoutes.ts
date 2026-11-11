import type {FastifyInstance} from 'fastify';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {pool as defaultPool,transaction as defaultTransaction} from './db.ts';
import {appendUpload,appendUploadChunk,completeUpload,appendManifest,planUpload,type UploadState} from './sourceImport.ts';
import {recordCatalog} from './apiLibrary.ts';
import {apiAnalysisVersion,sourceAnalysisParts} from './apiAnalysis.ts';
const fail=(statusCode:number,message:string):never=>{throw Object.assign(new Error(message),{statusCode});};
export function registerSourceImports(app:FastifyInstance,deps:{pool?:any;transaction?:any;record?:typeof recordCatalog}={}){
 const pool=deps.pool||defaultPool,transaction=deps.transaction||defaultTransaction,record=deps.record||recordCatalog;
 async function baseline(client:any,state:UploadState){
  if(!state.baselineSnapshotId)return undefined;
  const source=(await client.query('SELECT body FROM source_snapshots WHERE id=$1',[state.baselineSnapshotId])).rows[0]?.body;
  if(!source||source.origin!=='upload'||source.projectId!==state.projectId||!Array.isArray(source.files))fail(409,'找不到此專案的原始匯入版本，請重新載入專案。');
  return source;
 }
 async function session(client:any,id:string):Promise<UploadState>{const row=(await client.query('SELECT body FROM source_imports WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!row)fail(404,'找不到匯入工作，請重新匯入。');return row.body;}
 async function update(client:any,id:string,state:UploadState){await client.query('UPDATE source_imports SET body=$2 WHERE id=$1',[id,JSON.stringify(state)]);}
 app.post('/api/source-imports',async(req,reply)=>{
  const {projectId,name,fileCount,baselineSnapshotId}=z.object({projectId:z.uuid(),name:z.string().trim().min(1).max(100),fileCount:z.number().int().min(1).max(10000),baselineSnapshotId:z.uuid().optional()}).strict().parse(req.body);
  const id=randomUUID();const state:UploadState={projectId,name,expectedCount:fileCount,files:[],bytes:0,...(baselineSnapshotId?{baselineSnapshotId,manifest:[]}: {})};
  await baseline(pool,state);
  await pool.query("DELETE FROM source_imports WHERE created_at<now()-interval '24 hours'");
  await pool.query('INSERT INTO source_imports(id,body) VALUES($1,$2)',[id,JSON.stringify(state)]);reply.code(201);return {id,protocol:2};
 });
 app.put<{Params:{id:string}}>('/api/source-imports/:id/manifest',async req=>transaction(async(client:any)=>{
  const id=z.uuid().parse(req.params.id),state=await session(client,id);const input=z.object({files:z.array(z.unknown())}).strict().parse(req.body);const next=appendManifest(state,input.files);await update(client,id,next);return {received:next.manifest!.length};
 }));
 app.post<{Params:{id:string}}>('/api/source-imports/:id/plan',async req=>transaction(async(client:any)=>{
  const id=z.uuid().parse(req.params.id),state=await session(client,id);const next=planUpload(state,await baseline(client,state));await update(client,id,next);const present=new Set(next.files.map(file=>file.path));return {needed:next.manifest!.filter(file=>!present.has(file.path)).map(file=>file.path),changes:next.changes};
 }));
 app.put<{Params:{id:string}}>('/api/source-imports/:id/files',async req=>transaction(async(client:any)=>{
  const id=z.uuid().parse(req.params.id),state=await session(client,id);const {files}=z.object({files:z.array(z.unknown())}).strict().parse(req.body);const next=appendUpload(state,files);await update(client,id,next);return {uploaded:next.files.length};
 }));
 app.put<{Params:{id:string}}>('/api/source-imports/:id/chunks',async req=>transaction(async(client:any)=>{
  const id=z.uuid().parse(req.params.id),next=appendUploadChunk(await session(client,id),req.body);await update(client,id,next);return {uploaded:next.files.length};
 }));
 app.post<{Params:{id:string}}>('/api/source-imports/:id/complete',async req=>transaction(async(client:any)=>{
  const id=z.uuid().parse(req.params.id),state=await session(client,id);await baseline(client,state);
  const snapshot=completeUpload(state);
  // Always rebuild dependency groups from the assembled full source. Never reuse model answers here.
  const prepared={...snapshot,apiAnalysisVersion,apiAnalysisParts:sourceAnalysisParts(snapshot.files)};
  await client.query('INSERT INTO source_snapshots(id,body) VALUES($1,$2)',[prepared.id,JSON.stringify(prepared)]);
  await record(client,prepared);
  await client.query('DELETE FROM source_imports WHERE id=$1',[id]);return {id:prepared.id,fileCount:prepared.files.length,contentHash:prepared.contentHash,changes:prepared.importChanges,analysisParts:prepared.apiAnalysisParts.length};
 }));
 app.delete<{Params:{id:string}}>('/api/source-imports/:id',async req=>{await pool.query('DELETE FROM source_imports WHERE id=$1',[z.uuid().parse(req.params.id)]);return {deleted:true};});
}
