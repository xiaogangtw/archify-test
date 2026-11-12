import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './test-support.mjs';
import { frontendEvidence } from './frontend-features.mjs';
import { frontendSnapshot } from '../../test-project/support/frontend-snapshot.mjs';
import { validateFeatureMap, applyFeatureMap } from '../../test-project/support/feature-map.mjs';

test('路由、頁面與 alias 匯入唯讀取證，提案需完整交代覆蓋並保留案例與人工名稱', async () => {
 const f=await fixture();
 try {
  await f.workspace.initialize();
  await mkdir(join(f.source,'src/pages'),{recursive:true});
  await writeFile(join(f.source,'tsconfig.json'),JSON.stringify({compilerOptions:{baseUrl:'.',paths:{'@/*':['src/*']}}}));
  await writeFile(join(f.source,'src/pages/CardPage.tsx'),"import {list} from '@/api'; export default function CardPage(){ throw new Error('DO_NOT_EXECUTE'); }");
  await writeFile(join(f.source,'src/routes.tsx'),"import React from 'react'; const CardPage=React.lazy(()=>import('./pages/CardPage'));const PATHS={CARD:'/cards'} as const; export const routes=[{path:PATHS.CARD,component:CardPage,title:'名片',requireAuth:true}];");
  const analysis=await f.workspace.scan(),before=await f.workspace.catalog();
  const prepared=await f.workspace.prepareFrontendFeatures();assert.equal(prepared.pages,1);assert.equal(prepared.routes,1);
  const evidence=JSON.parse(await readFile(join(f.project,'analysis/feature-evidence.json'),'utf8'));
  assert.equal(evidence.routes[0].url,'/cards');assert.equal(evidence.routes[0].requireAuth,true);assert.ok(evidence.pages[0].apiIds.length);
  assert.ok(!JSON.stringify(evidence).includes('DO_NOT_EXECUTE'));
  const feature={id:'F-CARD',name:'名片',description:'名片管理',evidence:'code',sources:[{path:'src/routes.tsx',line:1}],pageIds:evidence.pages.map(p=>p.id),apiIds:evidence.apis.map(a=>a.id),questions:['權限需確認']};
  const proposal={schemaVersion:1,sourceHash:evidence.sourceHash,catalogRevision:evidence.catalogRevision,generatedAt:new Date().toISOString(),features:[feature],relations:[],unassignedPageIds:[],unassignedApiIds:[],notes:[]};
  feature.sequence=[{action:'請求名片',from:'前端',to:'名片 API',condition:'進入頁面時',source:{path:'src/pages/CardPage.tsx',line:1}}];
  for(const source of [{path:'.env',line:1},{path:'src/pages/CardPage.tsx',line:9000}])assert.throws(()=>validateFeatureMap({...proposal,features:[{...feature,sequence:[{...feature.sequence[0],source}]}]},evidence));
  assert.throws(()=>validateFeatureMap({...proposal,features:[{...feature,sequence:Array(31).fill(feature.sequence[0])}]},evidence));
  assert.equal(validateFeatureMap(proposal,evidence).features,1);
  assert.throws(()=>validateFeatureMap({...proposal,features:[{...feature,pageIds:[]}]},evidence));
  assert.throws(()=>validateFeatureMap({...proposal,features:[{...feature,sources:[{path:'.env',line:1}]}]},evidence));
  await writeFile(join(f.project,'analysis/feature-map.proposal.json'),JSON.stringify(proposal));
  await f.workspace.applyFrontendFeatures();
  let current=await f.workspace.catalog();assert.equal(current.catalog.frontendAnalysis.coverage.pages,1);
  assert.deepEqual(current.catalog.features[0].frontend.sequence,feature.sequence);
  assert.equal(current.catalog.features[0].frontend.sequenceStale,false);
  assert.equal(current.catalog.cases.length,0);
  const originalCases=JSON.stringify(current.catalog.cases);
  current.catalog.features[0].name='人工命名';
  await f.workspace.saveCatalog({revision:current.revision,catalog:current.catalog});
  await assert.rejects(()=>applyFeatureMap(f.project,proposal,evidence,f.source),/案例目錄已變更/);
  await f.workspace.prepareFrontendFeatures();
  const nextEvidence=JSON.parse(await readFile(join(f.project,'analysis/feature-evidence.json'),'utf8'));assert.equal(nextEvidence.changes.firstRun,false);assert.deepEqual(nextEvidence.changes.modified,[]);
  await applyFeatureMap(f.project,{...proposal,catalogRevision:nextEvidence.catalogRevision},nextEvidence,f.source);
  current=await f.workspace.catalog();assert.equal(current.catalog.features[0].name,'人工命名');assert.equal(JSON.stringify(current.catalog.cases),originalCases);
  await writeFile(join(f.source,'src/pages/CardPage.tsx'),'export default function CardPage(){return null;}');
  assert.equal((await f.workspace.catalog()).catalog.features[0].frontend.sequenceStale,true);
  await assert.rejects(()=>applyFeatureMap(f.project,{...proposal,catalogRevision:nextEvidence.catalogRevision},nextEvidence,f.source),/來源已變更/);
  await f.workspace.prepareFrontendFeatures();
  const changed=JSON.parse(await readFile(join(f.project,'analysis/feature-evidence.json'),'utf8'));
  assert.ok(changed.changes.modified.includes('src/pages/CardPage.tsx'));
  assert.ok(changed.changes.affectedFeatures.includes('F-CARD'));
 } finally {await f.dispose();}
});

test('功能地圖 MECE L1~L4 層級限制、父子階層及單節點最多 8 個子分支約束', async () => {
 const f=await fixture();
 try {
  await f.workspace.initialize();
  await mkdir(join(f.source,'src/pages'),{recursive:true});
  await writeFile(join(f.source,'src/pages/CardPage.tsx'),"export default function CardPage(){ return null; }");
  await f.workspace.scan();
  await f.workspace.prepareFrontendFeatures();
  const evidence=JSON.parse(await readFile(join(f.project,'analysis/feature-evidence.json'),'utf8'));
  const sources=[{path:'src/pages/CardPage.tsx',line:1}];
  const base={schemaVersion:1,sourceHash:evidence.sourceHash,catalogRevision:evidence.catalogRevision,generatedAt:new Date().toISOString(),relations:[],unassignedPageIds:[],unassignedApiIds:evidence.apis.map(a=>a.id),notes:[]};
  const sys={id:'F-SYS',name:'全系統',level:1,description:'系統層',evidence:'code',sources,pageIds:[],apiIds:[],questions:[]};
  const mod={id:'F-MOD',name:'名片模組',level:3,parentId:'F-SYS',description:'模組層',evidence:'code',sources,pageIds:evidence.pages.map(p=>p.id),apiIds:[],questions:[]};
  assert.equal(validateFeatureMap({...base,features:[sys,mod]},evidence).features,2);
  assert.throws(()=>validateFeatureMap({...base,features:[{...mod,parentId:undefined,level:5}]},evidence),/level 必須為 1/);
  assert.throws(()=>validateFeatureMap({...base,features:[{...sys,level:3},mod]},evidence),/層級必須高於子節點/);
  assert.throws(()=>validateFeatureMap({...base,features:[{...sys,level:undefined,parentId:'F-MOD'},{...mod,level:undefined}]},evidence),/循環參照/);
  assert.throws(()=>validateFeatureMap({...base,features:[{...mod,parentId:undefined,name:'第一步 進入首頁'}]},evidence),/不可將流程步驟寫成功能節點/);
  assert.throws(()=>validateFeatureMap({...base,features:[{...mod,parentId:undefined},{...mod,id:'F-MOD-DUP',parentId:undefined,pageIds:[]}]},evidence),/重複/);
  const sevenDomains=Array.from({length:7},(_,i)=>({id:`F-DOM-${i}`,name:`業務域 ${i}`,level:2,parentId:'F-SYS',description:'業務域',evidence:'code',sources,pageIds:i===0?evidence.pages.map(p=>p.id):[],apiIds:[],questions:[]}));
  assert.throws(()=>validateFeatureMap({...base,features:[sys,...sevenDomains]},evidence),/超過上限 6/);
  const domain={id:'F-DOM',name:'名片域',level:2,description:'業務域',evidence:'code',sources,pageIds:[],apiIds:[],questions:[]};
  const nineChildren=Array.from({length:9},(_,i)=>({id:`F-SUB-${i}`,name:`子功能 ${i}`,level:4,parentId:'F-DOM',description:'子功能',evidence:'code',sources,pageIds:i===0?evidence.pages.map(p=>p.id):[],apiIds:[],questions:[]}));
  assert.throws(()=>validateFeatureMap({...base,features:[domain,...nineChildren]},evidence),/超過上限 8/);
  const targets=Array.from({length:9},(_,i)=>({id:`F-T-${i}`,name:`目標 ${i}`,level:2,description:'目標',evidence:'code',sources,pageIds:[],apiIds:[],questions:[]}));
  const nineNavs=targets.map(t=>({from:'F-MOD',to:t.id,kind:'navigation',evidence:'code',sources}));
  assert.throws(()=>validateFeatureMap({...base,features:[{...mod,parentId:undefined},...targets],relations:nineNavs},evidence),/navigation 子關聯.*超過上限 8/);
  await writeFile(join(f.project,'analysis/feature-map.proposal.json'),JSON.stringify({...base,features:[sys,mod]}));
  await f.workspace.applyFrontendFeatures();
  const catalog=await f.workspace.catalog();
  assert.equal(catalog.catalog.features.find(r=>r.id==='F-MOD').frontend.level,3);
  assert.equal(catalog.catalog.features.find(r=>r.id==='F-MOD').frontend.parentId,'F-SYS');
 } finally {await f.dispose();}
});
