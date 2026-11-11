import test from 'node:test';
import assert from 'node:assert/strict';
import {saveScriptCase} from '../src/scriptCases.ts';
import {draftExecutionHash} from '../src/androidAgentDraft.ts';
import {scriptSchema} from '../src/model.ts';
import {mergeAgentDraft,taskMetadata} from '../../../apps/web/src/features/testing/agentDraftSync.ts';
import type {ScriptDraft} from '../../../apps/web/src/features/testing/scriptModel.ts';
import type {AndroidAgentTask} from '../../../apps/web/src/features/testing/androidAgentClient.ts';
import {exportCases} from '../../../apps/web/src/features/testing/caseExport.ts';

const input={id:'case',name:'儲存後保留姓名',source:'export const flow={appPackage:"com.example.app",steps:[{name:"確認",action:"assertAppForeground"}]} as const;',version:0,caseType:'flow',messages:[],metadata:{title:'儲存後保留姓名',titleOrigin:'agent',categorySuggestion:'名片',expectedResults:['重開後姓名相同']}};
function database(){
 const scripts=new Map<string,any>(),versions=new Map<string,any>(),tasks=new Map<string,any>();let sequence=0,testSequence=0,tree:any={folders:[],scriptFolders:{}};
 const client={query:async(sql:string,args:any[]=[])=>{
  if(sql.includes('FROM scripts WHERE'))return {rows:scripts.has(args[0])?[structuredClone(scripts.get(args[0]))]:[]};
  if(sql.includes('FROM documents'))return {rows:[{value:structuredClone(tree)}]};
  if(sql.includes('FROM android_agent_tasks'))return {rows:tasks.has(args[0])?[structuredClone(tasks.get(args[0]))]:[]};
  if(sql.includes('FROM script_versions'))return {rows:versions.has(args[0]+':'+args[1])?[{body:structuredClone(versions.get(args[0]+':'+args[1]))}]:[]};
  if(sql.startsWith('INSERT INTO documents'))tree=JSON.parse(args[1]);
  if(sql.startsWith('INSERT INTO scripts(')){const row={...scripts.get(args[0]),version:args[1],case_number:scripts.get(args[0])?.case_number||++sequence};scripts.set(args[0],row);return {rows:[row]};}
  if(sql.startsWith('UPDATE scripts SET test_case_number')){const row=scripts.get(args[0]);row.test_case_number??=++testSequence;return {rows:[row]};}
  if(sql.startsWith('INSERT INTO script_versions'))versions.set(args[0]+':'+args[1],JSON.parse(args[2]));
  return {rows:[]};
 }};
 return {client,scripts,versions,tasks,get tree(){return tree;}};
}
test('save freezes metadata with server code, retains identity across versions and respects a later manual move',async()=>{
 const db=database();const first=await saveScriptCase(db.client,{...input,caseCode:'TC-999999',categoryId:'guessed'});
 assert.equal(first.caseCode,'FC-000001');assert.equal(first.categoryId,db.tree.folders[0].id);assert.equal(first.maturity,'draft');
 db.tree.folders.push({id:'other',name:'其他',parentId:null,scope:'flow'});db.tree.scriptFolders.case='other';
 const second=await saveScriptCase(db.client,{...first,name:'人工名稱',metadata:{...first.metadata,title:'人工名稱',titleOrigin:'user'}});
 assert.equal(second.caseCode,first.caseCode);assert.equal(second.categoryId,'other');assert.equal(second.metadata.categorySuggestion,'其他');assert.equal(second.version,2);
 assert.equal(db.versions.get('case:1').name,input.name);assert.deepEqual(db.versions.get('case:1').metadata.expectedResults,['重開後姓名相同']);
 assert.notEqual((await saveScriptCase(db.client,{...input,id:'another'})).caseCode,first.caseCode);
 const before=db.versions.size;await assert.rejects(saveScriptCase(db.client,input),/another window/);assert.equal(db.versions.size,before);
});
test('test cases use TC while flow cases use FC with stable numeric identity',async()=>{
 const db=database();
 const flow=await saveScriptCase(db.client,{...input,metadata:undefined});
 const script=await saveScriptCase(db.client,{...input,id:'test-case',caseType:'test',metadata:undefined});
 assert.equal(flow.caseCode,'FC-000001');
 assert.equal(script.caseCode,'TC-000001');
 const updated=await saveScriptCase(db.client,{...script,caseCode:'FC-999999'});
 assert.equal(updated.caseCode,script.caseCode);
 const nextFlow=await saveScriptCase(db.client,{...input,id:'flow-two',metadata:undefined});
 const nextTest=await saveScriptCase(db.client,{...input,id:'test-two',caseType:'test',metadata:undefined});
 assert.equal(nextFlow.caseCode,'FC-000003');
 assert.equal(nextTest.caseCode,'TC-000002');
});
test('saved FC with an inserted API flow passes the save contract and retains its identity',async()=>{
 const db=database();
 const first=await saveScriptCase(db.client,input);
 const source='export const flow='+JSON.stringify({appPackage:'com.example.app',steps:[{name:'API 查詢',action:'apiFlow',scriptId:'api-flow',scriptVersion:1,namespace:'lookup'},{name:'確認',action:'assertAppForeground'}]})+' as const;';
 const next=await saveScriptCase(db.client,scriptSchema.parse({...first,source}));
 assert.equal(next.version,2);
 assert.equal(next.caseCode,first.caseCode);
 assert.equal(next.source,source);
 const legacy=await saveScriptCase(db.client,scriptSchema.parse({...next,caseCode:'TC-000001'}));
 assert.equal(legacy.caseCode,first.caseCode);
 assert.equal(scriptSchema.safeParse({...next,caseCode:'XX-000001'}).success,false);
});

test('invalid business metadata, conflicting titles and cross-scope categories cannot save',async()=>{
 const db=database();
 assert.equal(scriptSchema.safeParse({...input,metadata:{expectedResults:['']}}).success,false);
 assert.equal(scriptSchema.safeParse({...input,maturity:'ready'}).success,false);
 await assert.rejects(saveScriptCase(db.client,{...input,name:'不同名稱'}),/不一致/);
 db.tree.folders.push({id:'test',name:'名片',scope:'test',parentId:null});
 await assert.rejects(saveScriptCase(db.client,input),/另一類案例/);assert.equal(db.versions.size,0);
});
test('GAP references remain candidates through later saves even when populated',async()=>{
 const db=database(),first=await saveScriptCase(db.client,{...input,metadata:{...input.metadata,referenceCaseCode:'GAP-03'}});
 assert.equal(first.maturity,'candidate');const second=await saveScriptCase(db.client,{...first,maturity:'draft'});assert.equal(second.maturity,'candidate');
});
test('only owned exact task evidence can attach to a version; renaming preserves it and semantic edits invalidate it',async()=>{
 const db=database(),id='339c23bf-2a35-4f54-b401-1d73732626c0';
 const executionHash=draftExecutionHash({source:input.source,metadata:input.metadata as any,revision:0,nodes:[]});
 db.tasks.set(id,{owner:'alice',script_id:input.id,body:{state:'ready',draft:{revision:2},serial:'emulator-5554',verification:{source:input.source,status:'passed',executionHash}}});
 const forged=await saveScriptCase(db.client,{...input,id:'forged',verification:{executionHash:'fake',outcome:'passed'}});assert.equal(forged.verification,undefined);
 await assert.rejects(saveScriptCase(db.client,{...input,agentTask:{id,draftRevision:2}},'bob'),/所屬/);
 const first=await saveScriptCase(db.client,{...input,version:db.scripts.get(input.id)?.version||0,agentTask:{id,draftRevision:2}},'alice');
 assert.equal(first.verification?.taskId,id);assert.equal(first.verification?.executionHash,executionHash);
 const renamed=await saveScriptCase(db.client,{...first,name:'人工改名',metadata:{...first.metadata,title:'人工改名'}});
 assert.deepEqual(renamed.verification,first.verification);
 const changed=await saveScriptCase(db.client,{...renamed,metadata:{...renamed.metadata,expectedResults:['不同的結果']}});
 assert.equal(changed.verification,undefined);
});
const current:ScriptDraft={id:'case',name:'',source:'base',version:1,messages:[],caseType:'flow'};
const task:AndroidAgentTask={id:'task',threadId:'thread',scriptVersion:1,revision:2,state:'waiting',message:'待回答',baseSource:'base',draft:{source:'new',revision:2,metadata:{title:'接收端隱藏手機整欄',titleOrigin:'agent',expectedResults:['接收端不顯示手機']}},events:[]};
test('one draft synchronizes source, title and metadata, fences source conflicts and preserves manual names',()=>{
 const merged=mergeAgentDraft(current,task)!;assert.equal(merged.name,task.draft.metadata?.title);assert.equal(merged.source,'new');
 assert.equal(mergeAgentDraft({...current,source:'manual'},task),null);
 assert.equal(mergeAgentDraft({...current,version:2},task),null);
 const manual={...current,name:'人工名稱',metadata:{title:'人工名稱',titleOrigin:'user' as const}};
 assert.equal(mergeAgentDraft(manual,task)?.name,'人工名稱');
 assert.equal(taskMetadata(merged).title,undefined);assert.equal(taskMetadata(manual).title,'人工名稱');
 assert.equal(taskMetadata({...manual,name:'',metadata:{title:'',titleOrigin:'user'}}).title,undefined);
 assert.equal(mergeAgentDraft(current,{...task,draft:{...task.draft,metadata:{...task.draft.metadata,referenceCaseCode:'GAP-03'}}})?.maturity,'candidate');
 assert.equal(mergeAgentDraft(current,{...task,resolution:{draftRevision:2,action:'dismissed'}}),null);
 const next={...task,draft:{...task.draft,source:'newer',revision:3}};
 assert.equal(mergeAgentDraft(merged,next,merged)?.source,'newer');
});
test('case export retains candidate references and unknown results, escapes CSV and neutralizes formulas',()=>{
 const csv=exportCases([{...current,name:'=danger,"case"',caseCode:'TC-000001',source:'line1\nline2',maturity:'candidate',metadata:{referenceCaseCode:'GAP-03',expectedResults:['待確認']}}],{folders:[{id:'f',name:'名片'}],scriptFolders:{case:'f'}});
 assert.ok(csv.startsWith('\ufeff'));assert.match(csv,/"'=danger,""case"""/);assert.match(csv,/GAP-03/);assert.match(csv,/候選/);assert.match(csv,/未提供有效執行證據/);assert.match(csv,/"line1\nline2"/);assert.doesNotMatch(csv,/通過/);
});
