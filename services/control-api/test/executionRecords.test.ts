import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerExecutionRecords,workflowRecord,reportSummary} from '../src/executionRecords.ts';

const id='11111111-1111-4111-8111-111111111111';
const run=(status='passed')=>({id,script_id:'script',script_version:2,test_version:'QA-1',status,message:'done',snapshot:{scriptName:'登入',repositories:[]},created_at:'2026-10-27T00:00:00Z',deleted_at:null});
const androidRun=(index:number,status='passed',owner='local'):any=>({executionOrigin:'e2e-batch',id:`phone-run-${index}`,requestId:`request-${index}`,owner,batchId:id,batchName:'E2E 回歸',testVersion:`ANDROID-old-${index}`,scriptId:`case-${index}`,scriptVersion:3,name:`手機案例 ${index}`,source:'saved source',status,createdAt:'2026-10-29T01:00:00Z',finishedAt:status==='running'?undefined:'2026-10-29T01:01:00Z',serial:'emulator-5554',completed:1,steps:[{name:'確認畫面',status}],trace:[{name:'確認畫面',status,phase:'main'}],manualCommits:{frontend:'a'.repeat(40)},deploymentVerified:false});

test('Android E2E batches appear in reports with all saved cases and unchanged historical evidence',async()=>{
 const android=Array.from({length:25},(_,index)=>androidRun(index,index===0?'failed':'passed'));
 android.push(androidRun(30,'passed','other-user'));
 android.push({...androidRun(31),executionOrigin:'appium'});
 android.push({...androidRun(32),executionOrigin:undefined});
 const {app}=harness([],[],android);
 try{
  const summaries=(await app.inject('/api/quality-reports')).json();
  assert.equal(summaries.length,1);assert.equal(summaries[0].total,25);assert.equal(summaries[0].counts.failed,1);assert.equal(summaries[0].ready,true);
  const version='ANDROID-BATCH-'+id;
  assert.equal(summaries[0].testVersion,version);
  const response=await app.inject('/api/quality-reports/'+version);assert.equal(response.statusCode,200);
  const report=response.json();assert.equal(report.records.length,25);assert.equal(report.name,'E2E 回歸');
  assert.equal(report.records[0].recordKind,'android');assert.equal(report.records[0].testVersion,'ANDROID-old-0');
  assert.equal(report.records[0].source,'saved source');assert.equal(report.records[0].scriptVersion,3);
  assert.deepEqual(report.manualCommits,{frontend:'a'.repeat(40)});assert.equal(report.records[0].owner,undefined);
  assert.equal(android[0].testVersion,'ANDROID-old-0');
  await app.inject({method:'PATCH',url:'/api/quality-reports/'+version,payload:{name:'新版名稱'}});
  assert.equal(android[0].batchName,'新版名稱');assert.equal(android[25].batchName,'E2E 回歸');
  assert.equal(android[26].batchName,'E2E 回歸');assert.equal(android[27].batchName,'E2E 回歸');
  assert.equal((await app.inject({method:'DELETE',url:'/api/execution-versions/'+version})).statusCode,200);
  assert.deepEqual((await app.inject('/api/quality-reports')).json(),[]);assert.equal(android[25].deletedAt,undefined);
  assert.equal(android[26].deletedAt,undefined);assert.equal(android[27].deletedAt,undefined);
 }finally{await app.close();}
});

test('Android reports block active downloads/deletion and cannot read another owner',async()=>{
 const android=[androidRun(0,'running')],{app}=harness([],[],android),version='ANDROID-BATCH-'+id;
 try{
  assert.equal((await app.inject('/api/quality-reports')).json()[0].ready,false);
  assert.equal((await app.inject('/api/quality-reports/'+version)).statusCode,409);
  assert.equal((await app.inject({method:'DELETE',url:'/api/execution-versions/'+version})).statusCode,409);
  const headers={'x-archify-user':'other-user'};
  assert.deepEqual((await app.inject({url:'/api/quality-reports',headers})).json(),[]);
  assert.equal((await app.inject({url:'/api/quality-reports/'+version,headers})).statusCode,404);
  assert.equal((await app.inject({method:'PATCH',url:'/api/quality-reports/'+version,headers,payload:{name:'not yours'}})).statusCode,404);
  assert.equal(android[0].deletedAt,undefined);
 }finally{await app.close();}
});
function harness(records:any[],workflows:any[]=[],android:any[]=[]){
 const sqls:string[]=[];const query=async(sql:string,args:any[]=[])=>{
  sqls.push(sql);let rows:any[]=[];
  if(sql.includes('android_runs')) {
   const selected=android.filter(row=>(!sql.includes("executionOrigin")||row.executionOrigin==='e2e-batch')&&!row.deletedAt&&row.owner===args[sql.includes("batchId")?1:0]&&(!sql.includes('batchId')||row.batchId===args[0]));
   if(sql.startsWith('UPDATE'))for(const row of selected){if(sql.includes('batchName'))row.batchName=args[2];else row.deletedAt='deleted';}
   rows=selected.map(body=>({id:body.id,body}));
  }
  else if(sql.startsWith('UPDATE runs SET deleted_at')){records.filter(row=>sql.includes('test_version')?row.test_version===args[0]:row.id===args[0]).forEach(row=>row.deleted_at='deleted');}
  else if(sql.startsWith('UPDATE api_workflow_jobs SET deleted_at'))workflows.filter(row=>row.id===args[0]).forEach(row=>row.deleted_at='deleted');
  else if(sql.startsWith('UPDATE batches SET name')){records.filter(row=>row.test_version===args[0]&&row.batch_id).forEach(row=>{row.batch_name=args[1];rows.push({id:row.batch_id});});}
  else if(sql.includes('FROM run_events'))rows=[{sequence:1,event:{type:'step-end',title:'登入',status:'passed'}}];
  else if(sql.includes('FROM runs')){rows=records.filter(row=>!sql.includes('deleted_at IS NULL')||!row.deleted_at);if(sql.includes('test_version=$1'))rows=rows.filter(row=>row.test_version===args[0]);else if(sql.includes('id=$1'))rows=rows.filter(row=>row.id===args[0]);if(sql.includes("status IN ('queued','running')"))rows=rows.filter(row=>['queued','running'].includes(row.status));}
  else if(sql.includes('FROM api_workflow_jobs')){rows=workflows.filter(row=>!row.deleted_at&&row.body.scriptId);if(sql.includes('id=$1'))rows=rows.filter(row=>row.id===args[0]);}
  return {rows,rowCount:rows.length};
 };
 const app=Fastify();app.setErrorHandler((error:any,_req,reply)=>reply.code(error.statusCode||500).send({error:error.message}));
 registerExecutionRecords(app,{pool:{query},transaction:async(fn:any)=>fn({query})});return {app,sqls};
}
test('execution records delete a terminal row, retain script snapshots and hide its report',async()=>{
 const records=[run()],{app,sqls}=harness(records);try{
  const response=await app.inject({method:'DELETE',url:'/api/execution-records/run/'+id});assert.equal(response.statusCode,200);assert.equal(records[0].deleted_at,'deleted');
  assert.deepEqual((await app.inject('/api/execution-records')).json(),[]);assert.deepEqual((await app.inject('/api/quality-reports')).json(),[]);
  assert.equal((await app.inject('/api/execution-records/run/'+id)).statusCode,404);
  assert.equal(sqls.some(sql=>/DELETE FROM|UPDATE script|UPDATE run_events/.test(sql)),false);
 }finally{await app.close();}
});
test('deleting an active row or a terminal member of an active version is rejected',async()=>{
 for(const records of [[run('running')],[run(),{...run('queued'),id:'22222222-2222-4222-8222-222222222222'}]]){
  const {app,sqls}=harness(records);try{assert.equal((await app.inject({method:'DELETE',url:'/api/execution-records/run/'+id})).statusCode,409);assert.equal((await app.inject({method:'DELETE',url:'/api/execution-versions/QA-1'})).statusCode,409);assert.equal(sqls.some(sql=>sql.startsWith('UPDATE')),false);}finally{await app.close();}
 }
});
test('version deletion removes all visible records together, with row locks',async()=>{
 const records=[run(),{...run('failed'),id:'22222222-2222-4222-8222-222222222222'}],{app,sqls}=harness(records);try{
  assert.equal((await app.inject({method:'DELETE',url:'/api/execution-versions/QA-1'})).json().count,2);assert.ok(records.every(row=>row.deleted_at));assert.ok(sqls.some(sql=>sql.includes('ORDER BY id FOR UPDATE')));
 }finally{await app.close();}
});
test('quality reports group a batch, include steps and reject an unfinished PDF snapshot',async()=>{
 const records=[{...run(),batch_id:id,batch_name:'登入回歸'},{...run('failed'),batch_id:id,batch_name:'登入回歸',id:'22222222-2222-4222-8222-222222222222'}],{app}=harness(records);try{
  const summary=(await app.inject('/api/quality-reports')).json();assert.equal(summary.length,1);assert.equal(summary[0].total,2);assert.equal(summary[0].counts.failed,1);
  const report=(await app.inject('/api/quality-reports/QA-1')).json();assert.equal(report.records.length,2);assert.equal(report.records[0].events[0].event.title,'登入');
  records[0].status='running';assert.equal((await app.inject('/api/quality-reports/QA-1')).statusCode,409);
 }finally{await app.close();}
});
test('script API workflows keep draft steps skipped and support report deletion',async()=>{
 const row={id,project_id:'p',status:'completed',created_at:'2026-10-27T00:00:00Z',updated_at:'2026-10-27T00:01:00Z',body:{scriptId:'api',scriptVersion:1,question:'API 流程',tasks:[{name:'未驗證',status:'draft'}]}};
 const record=workflowRecord(row);assert.equal(record.status,'skipped');assert.equal(record.events[0].event.status,'skipped');assert.equal(reportSummary([record]).counts.passed,0);
 const {app}=harness([],[row]);try{assert.equal((await app.inject('/api/quality-reports/API-'+id)).statusCode,404);assert.equal((await app.inject({method:'DELETE',url:'/api/execution-versions/API-'+id})).statusCode,200);assert.deepEqual((await app.inject('/api/execution-records')).json(),[]);}finally{await app.close();}
});

test('only explicit batch membership creates a report, even for one case; rename keeps evidence',async()=>{
 const records=[run(),{...run(),id:'22222222-2222-4222-8222-222222222222',test_version:'BATCH-1',batch_id:id,batch_name:''}],{app}=harness(records);try{
  const summaries=(await app.inject('/api/quality-reports')).json();assert.equal(summaries.length,1);assert.equal(summaries[0].testVersion,'BATCH-1');assert.equal(summaries[0].total,1);assert.equal(summaries[0].name,'');
  assert.equal((await app.inject('/api/quality-reports/QA-1')).statusCode,404);
  assert.equal((await app.inject({method:'PATCH',url:'/api/quality-reports/BATCH-1',payload:{name:'會員登入回歸'}})).statusCode,200);
  assert.equal((await app.inject('/api/quality-reports/BATCH-1')).json().name,'會員登入回歸');assert.equal(records[1].test_version,'BATCH-1');assert.equal(records[1].created_at,'2026-10-27T00:00:00Z');
 }finally{await app.close();}
});

test('manual commit snapshot survives execution detail and report summary/detail',async()=>{
 const manualCommits={frontend:'a'.repeat(40),bff:'b'.repeat(40),backend:'c'.repeat(40)};
 const record={...run(),batch_id:'batch',snapshot:{...run().snapshot,manualCommits}};
 const {app}=harness([record]);
 try{
  for(const url of ['/api/execution-records/run/'+id,'/api/quality-reports/QA-1']){
   const response=await app.inject(url);assert.equal(response.statusCode,200);
   assert.deepEqual(response.json().manualCommits,manualCommits);
   if(response.json().records)assert.deepEqual(response.json().records[0].manualCommits,manualCommits);
  }
  assert.deepEqual((await app.inject('/api/quality-reports')).json()[0].manualCommits,manualCommits);
 }finally{await app.close();}
});
