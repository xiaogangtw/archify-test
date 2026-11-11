import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fixture} from './test-support.mjs';
import {createWorkspace} from './workspace.mjs';
import {quickKnowledgePlan} from './knowledge-fast-update.mjs';
import {prepareUploads} from './knowledge-upload.mjs';
const original=Array.from({length:20},(_,i)=>`第${i+1}項會員資料規則：登入後僅能查看自己的名片資料，欄位必須完整保存。`).join('\n');
async function finish(w,documents){const start=await w.analyzeKnowledgeAi(documents);for(let i=0;i<500;i++){const job=await w.aiStatus(start.id);if(job.status!=='running')return job;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('timeout');}
function merge(prompt){const payload=JSON.parse(prompt.slice(prompt.indexOf('{"existing":')));return {documents:payload.incoming.map(row=>({title:row.name||'規則.md',content:row.content,category:'business',featureIds:[],keepId:null,replaces:[],inputIndices:[row.index]})),conflicts:[]};}

test('相似文字直接採上傳版本、保留 ID／分類／案例與封存還原，重傳完全相同不寫入',async()=>{
 const f=await fixture();try{
  await f.workspace.initialize();const imported=await f.workspace.importKnowledge([{name:'會員.md',content:original,category:'business',featureIds:['F-MEMBER']}]);const id=imported.created[0].id;
  const catalog=await f.workspace.catalog();
  await f.workspace.saveCatalog({revision:catalog.revision,catalog:{schemaVersion:1,features:[{id:'F-MEMBER',name:'會員',sources:[]}],cases:[{id:'TC-MEMBER',featureId:'F-MEMBER',title:'會員資料',kind:'api',purpose:'驗證會員',preconditions:'已登入',data:'',expected:'合法資料',knowledgeIds:[id],questions:[]}]}});
  const cases=JSON.stringify((await f.workspace.catalog()).catalog.cases);
  const w=createWorkspace(f.config,{aiRunner:async()=>{throw new Error('不應呼叫模型');}});
  const next=original.replace('第1項會員資料規則','第1項會員更新規則').replace('僅能查看','禁止查看');
  const job=await finish(w,[{name:'會員新版.md',content:next}]);assert.equal(job.status,'completed',job.error);assert.equal(job.result.directUpdated,1);
  const doc=await w.knowledgeDocument(id);assert.equal(doc.content,next);assert.equal(doc.category,'business');assert.deepEqual(doc.featureIds,['F-MEMBER']);assert.equal((await w.knowledge()).documents.length,1);
  assert.equal(JSON.stringify((await w.catalog()).catalog.cases),cases);
  assert.equal(await readFile(join(f.project,job.result.archive,id+'.md'),'utf8'),original);
  const index=await readFile(join(f.project,'knowledge/index.json'),'utf8');
  const skipped=await finish(w,[{name:'相同副本.md',content:next}]);assert.equal(skipped.status,'completed',skipped.error);assert.equal(skipped.result.updated,0);assert.equal(skipped.result.skipped.length,1);assert.equal(await readFile(join(f.project,'knowledge/index.json'),'utf8'),index);
  await w.restoreKnowledgeAi();assert.equal((await w.knowledgeDocument(id)).content,original);
 }finally{await f.dispose();}
});

test('相同原始來源在 AI 改寫後可略過；人工改檔後處理紀錄失效',async()=>{
 const f=await fixture();try{
  await f.workspace.initialize();let calls=0;
  const w=createWorkspace(f.config,{aiRunner:async(_config,prompt)=>{calls++;const result=merge(prompt);result.documents[0].content='AI 整理後的內容';return result;}});
  const upload={name:'輸入.md',content:'原始資料：這是與整理結果不同的輸入。'};
  assert.equal((await finish(w,[upload])).status,'completed');assert.equal(calls,1);
  assert.equal((await finish(w,[upload])).result.skipped.length,1);assert.equal(calls,1);
  const row=(await w.knowledge()).documents[0];await writeFile(join(f.project,'knowledge/documents',row.id+'.md'),'人工直接修改內容');
  assert.equal((await finish(w,[upload])).status,'completed');assert.equal(calls,2);
 }finally{await f.dispose();}
});

test('混合批次只將新主題交 AI，直接更新與 AI 結果一起驗證並保存；失敗保留全部原文',async()=>{
 const f=await fixture();try{
  await f.workspace.initialize();await f.workspace.importKnowledge([{name:'會員.md',content:original}]);let calls=0;
  const w=createWorkspace(f.config,{aiRunner:async(_config,prompt)=>{calls++;assert.ok(!prompt.includes('第1項會員資料規則'));return merge(prompt);}});
  const changed=original.replace('第1項會員資料規則','第1項新版會員規則');
  let job=await finish(w,[{name:'新版.md',content:changed},{name:'不同主題.md',content:'獨立的物流配送規則'}]);assert.equal(job.status,'completed',job.error);assert.equal(job.result.directUpdated,1);assert.equal(job.result.updated,2);assert.equal(calls,1);
  const snapshot=await readFile(join(f.project,'knowledge/index.json'),'utf8');
  const broken=createWorkspace(f.config,{aiRunner:async()=>{throw new Error('synthetic failure');}});
  job=await finish(broken,[{name:'再更新.md',content:changed.replace('第2項會員資料規則','第2項更新會員規則')},{name:'新主題.md',content:'全新的另一個主題'}]);assert.equal(job.status,'failed');assert.equal(await readFile(join(f.project,'knowledge/index.json'),'utf8'),snapshot);
 }finally{await f.dispose();}
});

test('同名不代表相似、多候選或同批競爭不直接覆蓋；HTML 只使用抽出文字',()=>{
 const before={documents:[{id:'one',title:'會員.md',content:original,hash:'h',category:'business'}]};
 assert.equal(quickKnowledgePlan(prepareUploads([{name:'會員.md',content:'完全不同的文件內容'}]),before).direct.length,0);
 const near=original.replace('第1項會員資料規則','第1項新會員資料規則');
 assert.equal(quickKnowledgePlan(prepareUploads([{name:'會員.html',content:'<p>'+near+'</p>'}]),before).direct.length,1);
 const multiple={documents:[...before.documents,{...before.documents[0],id:'two'}]};assert.equal(quickKnowledgePlan(prepareUploads([{name:'新版.md',content:near}]),multiple).direct.length,0);
 assert.equal(quickKnowledgePlan(prepareUploads([{name:'新版.md',content:near},{name:'另一版.md',content:original.replace('第2項會員資料規則','第2項新會員資料規則')}]),before).direct.length,0);
});

test('舊來源處理紀錄不會把回傳舊版本誤當最新重複；重啟仍能略過最新來源',async()=>{
 const f=await fixture();try{
  await f.workspace.initialize();let calls=0;
  const w=createWorkspace(f.config,{aiRunner:async(_config,prompt)=>{calls++;const result=merge(prompt);result.documents[0].content='# 整理後\n'+result.documents[0].content;return result;}});
  const a={name:'A.md',content:original};let job=await finish(w,[a]);assert.equal(job.status,'completed',job.error);
  const b={name:'B.md',content:original.replace('第1項會員資料規則','第1項會員新版規則')};job=await finish(w,[b]);assert.equal(job.result.directUpdated,1);
  job=await finish(w,[a]);assert.equal(job.result.directUpdated,1);assert.equal(job.result.skipped.length,0);
  const restarted=createWorkspace(f.config,{aiRunner:async()=>{throw new Error('不應呼叫模型');}});job=await finish(restarted,[a]);assert.equal(job.status,'completed',job.error);assert.equal(job.result.skipped.length,1);assert.equal(calls,1);
 }finally{await f.dispose();}
});
