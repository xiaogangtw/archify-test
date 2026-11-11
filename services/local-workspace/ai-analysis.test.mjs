import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture,request} from './test-support.mjs';
import {createWorkspace} from './workspace.mjs';
import {createHandler} from './plugin.mjs';
import {knowledgeInput} from './knowledge-input.mjs';
async function finish(workspace,id){for(let i=0;i<100;i++){const job=await workspace.aiStatus(id);if(job.status!=='running')return job;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('job timeout');}

test('HTML 只抽文字不執行，保留標題表格與實體字符',()=>{
 const [doc]=knowledgeInput([{name:'規則.html',content:'<h1>權限 &amp; 名片</h1><script>DO_NOT_EXECUTE()</script><style>secret</style><table><tr><td>登入</td><td>必要</td></tr></table><iframe src="https://bad.test"></iframe>'}]);
 assert.equal(doc.name,'規則.md');assert.ok(doc.content.includes('權限 & 名片'));assert.ok(doc.content.includes('必要'));assert.ok(!doc.content.includes('DO_NOT_EXECUTE')&&!doc.content.includes('https://'));
});

test('網站知識 AI 工作合併取代、更新關聯、原版可還原，過期資料拒絕',async()=>{
 const f=await fixture();try{
  await f.workspace.initialize();const docs=await f.workspace.importKnowledge([{name:'舊規則.md',content:'舊規則：允許讀取。'},{name:'重複規則.md',content:'讀取目前允許。'}]);
  const ids=docs.created.map(row=>row.id),keep=ids[0];
  const aiRunner=async()=>({documents:[{title:'最新規則.md',content:'最新規則：禁止跨帳號讀取；其餘保留。',category:'business',featureIds:[],keepId:keep,replaces:ids,inputIndices:[0]}],conflicts:['歷史角色例外待確認']});
  const w=createWorkspace(f.config,{aiRunner});
  const before=await w.catalog();await w.saveCatalog({revision:before.revision,catalog:{schemaVersion:1,features:[{id:'F-CARD',name:'名片',sources:[]}],cases:[{id:'TC-CARD',featureId:'F-CARD',title:'讀取',kind:'api',purpose:'',preconditions:'',data:'',expected:'指定資料',knowledgeIds:[ids[1]],questions:[]}]}});
  const start=await w.analyzeKnowledgeAi([{name:'新版.html',content:'<h1>新規則</h1><p>禁止跨帳號讀取。</p>'}]);assert.equal(start.status,'running');
  const job=await finish(w,start.id);assert.equal(job.status,'completed',job.error);assert.equal(job.result.replaced,2);
  const index=await w.knowledge();assert.equal(index.documents.length,1);assert.equal(index.documents[0].id,keep);assert.equal((await w.catalog()).catalog.cases[0].knowledgeIds[0],keep);
  assert.ok((await w.knowledgeDocument(keep)).content.includes('禁止'));
  await w.restoreKnowledgeAi();assert.equal((await w.knowledge()).documents.length,2);assert.equal((await w.catalog()).catalog.cases[0].knowledgeIds[0],ids[1]);
  const again=await w.analyzeKnowledgeAi([{name:'新.md',content:'禁止跨帳號'}]);await finish(w,again.id);
  const edited=await w.knowledgeDocument(keep);await w.updateKnowledge({...edited,expectedHash:edited.hash,content:'後續人工修改'});
  await assert.rejects(()=>w.restoreKnowledgeAi(),/再次修改/);
  let release;const pending=createWorkspace(f.config,{aiRunner:()=>new Promise(resolve=>{release=resolve;})});const task=await pending.analyzeKnowledgeAi([{name:'新.md',content:'更新'}]);await new Promise(resolve=>setTimeout(resolve,0));
  const doc=await pending.knowledgeDocument(keep);await pending.updateKnowledge({...doc,expectedHash:doc.hash,content:'人工更新'});
  release({documents:[{title:"規則.md",content:"AI 更新",category:"business",featureIds:[],keepId:keep,replaces:[keep],inputIndices:[0]}],conflicts:[]});const failed=await finish(pending,task.id);assert.equal(failed.status,'failed');assert.ok(failed.error.includes('已變更'));assert.equal((await pending.knowledgeDocument(keep)).content,'人工更新');
 }finally{await f.dispose();}
});

test('AI 失敗與取消不更新資料，並拒絕未帶 session 的啟動',async()=>{
 const f=await fixture();try{
 await f.workspace.initialize();const w=createWorkspace(f.config,{aiRunner:async()=>{throw new Error('CLI unavailable');}});const handler=createHandler(w,'test-session');
 assert.equal((await request(handler,'/local-api/ai-knowledge-start',{documents:[{name:'a.md',content:'a'}]},{headers:{'x-archify-session':'bad'}})).status,403);
 const start=await w.analyzeKnowledgeAi([{name:'a.md',content:'a'}]);assert.equal((await finish(w,start.id)).status,'failed');assert.equal((await w.knowledge()).documents.length,0);
 const pending=createWorkspace(f.config,{aiRunner:async(_config,_prompt,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('cancelled')));})});
 const running=await pending.analyzeKnowledgeAi([{name:'a.md',content:'a'}]);await new Promise(resolve=>setTimeout(resolve,0));await assert.rejects(()=>pending.analyzeKnowledgeAi([{name:'b.md',content:'b'}]),/另一項/);await pending.cancelAi(running.id);assert.equal((await finish(pending,running.id)).status,'cancelled');assert.equal((await pending.knowledge()).documents.length,0);
 }finally{await f.dispose();}
});
