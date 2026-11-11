import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {draftMetadataSchema,draftExecutionHash} from './androidAgentDraft.ts';

export const caseMetadataSchema=draftMetadataSchema.extend({titleOrigin:z.enum(['user','agent']).optional()});
export const caseCode=(number:string|number,caseType?:string)=>`${caseType==='flow'?'FC':'TC'}-${String(number).padStart(6,'0')}`;
type Client={query:(sql:string,args?:any[])=>Promise<any>};
const fail=(statusCode:number,message:string):never=>{throw Object.assign(new Error(message),{statusCode});};

// Caller owns the transaction. Lock order matches document and script writers.
export async function saveScriptCase(client:Client,input:any,owner='local'){
 const folderKey='archify.script-folders.v1';
 if(input.metadata?.title&&input.metadata.title!==input.name)fail(400,'案例名稱與業務標題不一致，請重新讀取草稿。');
 const suggestion=input.metadata?.categorySuggestion;
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[folderKey]);
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[input.id]);
 const existing=(await client.query('SELECT version,deleted_at,case_number FROM scripts WHERE id=$1 FOR UPDATE',[input.id])).rows[0];
 if(existing?.deleted_at)fail(410,'此案例已刪除，請重新整理案例庫。');
 const version=existing?.version||0;
 if(input.version!==version)fail(409,'Script changed in another window; reload before saving');
 const row=(await client.query('SELECT value FROM documents WHERE key=$1',[folderKey])).rows[0];
 const tree=structuredClone(row?.value||{folders:[],scriptFolders:{}});
 if(!Array.isArray(tree.folders)||!tree.scriptFolders||typeof tree.scriptFolders!=='object')fail(409,'案例分類資料無效，請先整理案例庫。');
 const previous=version?(await client.query('SELECT body FROM script_versions WHERE script_id=$1 AND version=$2',[input.id,version])).rows[0]?.body:undefined;
 let categoryId:string|null=tree.scriptFolders[input.id]||null;
 // Re-saving an old suggestion must not undo a later manual library move.
 if(suggestion&&suggestion!==previous?.metadata?.categorySuggestion){
  const name=suggestion.trim(),scope=input.caseType==='flow'?'flow':'test';
  if(name.length>100)fail(400,'分類名稱最多 100 字。');
  if(name==='未分類')categoryId=null;
  else{
   const matches=tree.folders.filter((folder:any)=>folder.name.toLocaleLowerCase()===name.toLocaleLowerCase());
   if(matches.length>1||matches.some((folder:any)=>folder.parentId!==null||folder.scope&&folder.scope!==scope))fail(409,'分類名稱重複或屬於另一類案例，請調整分類建議。');
   categoryId=matches[0]?.id||randomUUID();
   if(!matches.length)tree.folders.push({id:categoryId,name,parentId:null,scope});
  }
  tree.scriptFolders[input.id]=categoryId;
  await client.query('INSERT INTO documents(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2,revision=documents.revision+1,updated_at=now()',[folderKey,JSON.stringify(tree)]);
 }
 const saved=await client.query('INSERT INTO scripts(id,version) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET version=$2,updated_at=now() RETURNING case_number',[input.id,version+1]);
 const number=input.caseType==='flow'?saved.rows[0].case_number:(await client.query("UPDATE scripts SET test_case_number=COALESCE(test_case_number,nextval('script_test_case_number_seq')) WHERE id=$1 RETURNING test_case_number",[input.id])).rows[0].test_case_number;
 const category=tree.folders.find((folder:any)=>folder.id===categoryId);
 if(categoryId&&!category)fail(409,'案例分類已變更，請重新讀取案例庫。');
 const {verification:_untrusted,agentTask:_reference,...editable}=input;
 let verification:any;
 if(input.caseType==='flow'){
  const executionHash=draftExecutionHash({source:input.source,metadata:input.metadata,revision:0,nodes:[]});
  if(previous?.verification?.executionHash===executionHash)verification=previous.verification;
  if(input.agentTask){
   const row=(await client.query('SELECT owner,script_id,body FROM android_agent_tasks WHERE id=$1 FOR SHARE',[input.agentTask.id])).rows[0];
   if(!row||row.owner!==owner||row.script_id!==input.id)fail(404,'找不到所屬的案例撰寫任務。');
   const task=row.body;
   if(task.state==='running'||task.draft.revision!==input.agentTask.draftRevision)fail(409,'Agent 草稿已更新，請重新讀取後再儲存。');
   if(task.verification?.source===input.source&&task.verification.executionHash===executionHash&&task.verification.status==='passed')verification={taskId:input.agentTask.id,draftRevision:task.draft.revision,executionHash,platform:'android',engine:'appium',outcome:'passed',serial:task.serial,...(task.bindings?{bindings:task.bindings}:{})};
  }
 }
 const maturity=previous?.maturity==='candidate'||/^GAP(?:[-_]|$)/i.test(input.metadata?.referenceCaseCode||'')?'candidate':input.maturity||'draft';
 const body={...editable,...(verification?{verification}:{}),caseCode:caseCode(number,input.caseType),version:version+1,categoryId,maturity,...(input.metadata?{metadata:{...input.metadata,title:input.name,...(suggestion?{categorySuggestion:category?.name||'未分類'}:{})}}:{})};
 await client.query('INSERT INTO script_versions(script_id,version,body,source_hash) VALUES($1,$2,$3,$4)',[input.id,body.version,JSON.stringify(body),createHash('sha256').update(input.source).digest('hex')]);
 return body;
}
