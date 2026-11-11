import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './test-support.mjs';
import { createWorkspace } from './workspace.mjs';
import { featureAnalysisScope, mergeFeatureAnalysis } from './feature-incremental.mjs';

const proposal = evidence => ({schemaVersion:1,sourceHash:evidence.sourceHash,catalogRevision:evidence.catalogRevision,generatedAt:new Date().toISOString(),features:evidence.pages.map(page=>({id:page.path.includes('One')?'F-ONE':'F-TWO',name:page.path,description:'頁面功能',evidence:'code',sources:[{path:page.path,line:1}],pageIds:[page.id],apiIds:page.apiIds,questions:[]})),relations:[],unassignedPageIds:[],unassignedApiIds:evidence.apis.filter(api=>!evidence.pages.some(page=>page.apiIds.includes(api.id))).map(api=>api.id),notes:[]});
async function finish(workspace) {
  const start=await workspace.analyzeFeaturesAi();
  for(let i=0;i<400;i++){const job=await workspace.aiStatus(start.id);if(job.status!=='running'){assert.equal(job.status,'completed',job.error);return job;}await new Promise(resolve=>setTimeout(resolve,10));}
  throw new Error('job timeout');
}

test('網站完整建立基準、無變更不呼叫模型、單頁增量保留人工內容，路由與知識變更完整分析',async()=>{
  const f=await fixture();try{
    await f.workspace.initialize();
    await mkdir(join(f.source,'src/pages'));
    await writeFile(join(f.source,'src/pages/OnePage.tsx'),'export default function OnePage(){return null;}');
    await writeFile(join(f.source,'src/pages/TwoPage.tsx'),'export default function TwoPage(){return null;}');
    await writeFile(join(f.source,'src/routes.ts'),'import One from "./pages/OnePage"; import Two from "./pages/TwoPage"; export const routes=[{path:"/one",component:One},{path:"/two",component:Two}];');
    const inputs=[];
    const workspace=createWorkspace(f.config,{aiRunner:async(_config,prompt)=>{
      const data=JSON.parse(prompt.slice(prompt.indexOf('{"evidence":')));inputs.push(data);return proposal(data.evidence);
    }});
    assert.equal((await finish(workspace)).result.mode,'full');
    let value=await workspace.catalog();assert.ok(value.catalog.frontendAnalysis.incremental);
    value.catalog.features.find(row=>row.id==='F-TWO').name='人工名稱';
    await workspace.saveCatalog({revision:value.revision,catalog:value.catalog});
    const before=await readFile(join(f.project,'test-cases/catalog.json'),'utf8');
    assert.equal((await finish(workspace)).result.mode,'unchanged');assert.equal(inputs.length,1);
    assert.equal(await readFile(join(f.project,'test-cases/catalog.json'),'utf8'),before);
    await writeFile(join(f.source,'src/pages/OnePage.tsx'),'export default function OnePage(){return "changed";}');
    assert.equal((await finish(workspace)).result.mode,'incremental');
    assert.deepEqual(inputs.at(-1).evidence.pages.map(row=>row.path),['src/pages/OnePage.tsx']);
    assert.ok(!inputs.at(-1).sourceExcerpts.some(row=>row.path==='src/pages/TwoPage.tsx'));
    value=await workspace.catalog();assert.equal(value.catalog.features.find(row=>row.id==='F-TWO').name,'人工名稱');assert.equal(value.catalog.frontendAnalysis.coverage.pages,2);
    await writeFile(join(f.source,'src/routes.ts'),'import One from "./pages/OnePage"; import Two from "./pages/TwoPage"; export const routes=[{path:"/renamed",component:One},{path:"/two",component:Two}];');
    assert.equal((await finish(workspace)).result.mode,'full');
    await workspace.importKnowledge([{name:'business.md',content:'新版規則'}]);
    assert.equal((await finish(workspace)).result.mode,'full');
  }finally{await f.dispose();}
});

function sample(){
 const features=['A','B'].map(id=>({id:'F-'+id,name:id,sources:[{path:id+'.tsx',line:1}],frontend:{state:'active',description:id,evidence:'code',questions:[],pageIds:[id],apiIds:[],dependencies:[id+'.tsx','shared.ts']}}));
 const pages=features.map(row=>({id:row.name,path:row.name+'.tsx',dependencies:row.frontend.dependencies,routeIds:[],apiIds:[]}));
 const baseline={incremental:{sourceRoot:'root',knowledgeRevision:'k'},pages,apis:[],routes:[],relations:[],notes:[]};
 return {schemaVersion:1,sourceHash:'h',catalogRevision:'c',files:['A.tsx','B.tsx','shared.ts'].map(path=>({path,lines:1})),pages,apis:[],routes:[],warnings:[],unresolved:[],previousFeatures:features,previousAnalysis:baseline,changes:{added:[],modified:['shared.ts'],removed:[],affectedFeatures:['F-A','F-B']}};
}

test('共用依賴擴大、設定與不明檔案回退，刪除頁面仍可合併而不假造覆蓋',()=>{
 const evidence=sample();assert.equal(featureAnalysisScope(evidence,'k','root').evidence.pages.length,2);
 for(const path of ['tsconfig.json','src/provider.ts']){
  const next=structuredClone(evidence);next.changes.modified=[path];assert.equal(featureAnalysisScope(next,'k','root').mode,'full');
 }
 const removed=sample();removed.pages=removed.pages.filter(row=>row.id!=='A');removed.files=removed.files.filter(row=>row.path!=='A.tsx');removed.changes={added:[],modified:[],removed:['A.tsx'],affectedFeatures:['F-A']};
 const scope=featureAnalysisScope(removed,'k','root');assert.equal(scope.mode,'incremental');assert.equal(scope.evidence.pages.length,0);
 const result={schemaVersion:1,sourceHash:'h',catalogRevision:'c',generatedAt:new Date().toISOString(),features:[],relations:[],unassignedPageIds:[],unassignedApiIds:[],notes:[]};
 const merged=mergeFeatureAnalysis(result,scope,removed);assert.deepEqual(merged.features.map(row=>row.id),['F-B']);
 assert.throws(()=>mergeFeatureAnalysis({...result,features:[{...scope.preserved[0],pageIds:[]}]},scope,removed),/格式或證據|未受影響/);
});

test('新增頁面納入範圍；同功能其他頁面一併分析，跨功能關聯只保留未變更證據',()=>{
 const evidence=sample();evidence.changes={added:['C.tsx'],modified:[],removed:[],affectedFeatures:[]};
 evidence.files.push({path:'C.tsx',lines:1});evidence.pages.push({id:'C',path:'C.tsx',dependencies:['C.tsx'],routeIds:[],apiIds:[]});
 let scope=featureAnalysisScope(evidence,'k','root');assert.deepEqual(scope.evidence.pages.map(row=>row.id),['C']);
 const grouped=sample();grouped.previousFeatures[0].frontend.pageIds.push('C');grouped.previousFeatures[0].frontend.dependencies.push('C.tsx');grouped.pages.push({id:'C',path:'C.tsx',dependencies:['C.tsx'],routeIds:[],apiIds:[]});grouped.files.push({path:'C.tsx',lines:1});
 grouped.previousAnalysis.relations=[{from:'F-A',to:'F-B',kind:'related',evidence:'code',sources:[{path:'B.tsx',line:1}]}];
 grouped.changes={added:[],modified:['A.tsx'],removed:[],affectedFeatures:['F-A']};scope=featureAnalysisScope(grouped,'k','root');
 assert.deepEqual(scope.evidence.pages.map(row=>row.id),['A','C']);
 const result={schemaVersion:1,sourceHash:'h',catalogRevision:'c',generatedAt:new Date().toISOString(),features:[{id:'F-A',name:'A',description:'A',evidence:'code',sources:[{path:'A.tsx',line:1}],pageIds:['A','C'],apiIds:[],questions:[]}],relations:[],unassignedPageIds:[],unassignedApiIds:[],notes:[]};
 assert.equal(mergeFeatureAnalysis(result,scope,grouped).relations.length,1);
 grouped.previousAnalysis.relations[0].sources=[{path:'A.tsx',line:1}];assert.equal(mergeFeatureAnalysis(result,scope,grouped).relations.length,0);
});

test('既有解析限制保留；新增警告、動態路由異動及換來源均完整分析',()=>{
 const evidence=sample();evidence.warnings=['既有解析限制'];evidence.previousAnalysis.warnings=[...evidence.warnings];
 assert.equal(featureAnalysisScope(evidence,'k','root').mode,'incremental');
 evidence.warnings.push('新增限制');assert.equal(featureAnalysisScope(evidence,'k','root').mode,'full');
 evidence.warnings=evidence.previousAnalysis.warnings;evidence.unresolved=[{path:'shared.ts',line:1}];evidence.previousAnalysis.unresolved=[...evidence.unresolved];assert.equal(featureAnalysisScope(evidence,'k','root').mode,'full');
 assert.equal(featureAnalysisScope(sample(),'k','other').mode,'full');
});

test('解析快取不會隱藏 API 修改或來源切換',async()=>{
 const {scanSource}=await import('./scan.mjs');const f=await fixture();try{
  const cache={};const first=await scanSource(f.source,'',cache);const second=await scanSource(f.source,'',cache);
  assert.deepEqual(second.requests,first.requests);
  await writeFile(join(f.source,'src/api.ts'),'export const changed=()=>fetch("/changed");');
  const changed=await scanSource(f.source,'',cache);assert.ok(changed.requests.some(row=>row.endpoint==='/changed'));assert.ok(!changed.requests.some(row=>row.endpoint==='/cards'));
  await mkdir(join(f.root,'other'));await writeFile(join(f.root,'other/api.ts'),'export const other=()=>fetch("/other");');
  const other=await scanSource(join(f.root,'other'),'',cache);assert.equal(other.requests.length,1);assert.equal(other.requests[0].endpoint,'/other');
 }finally{await f.dispose();}
});
