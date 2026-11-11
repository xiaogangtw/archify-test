import { readFile, writeFile, mkdir, rename, lstat } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { frontendSnapshot, rejectSourceLinks, sourceDigest } from './frontend-snapshot.mjs';
const json=value=>JSON.stringify(value,null,2)+'\n';
const id=value=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value);
const text=(value,max)=>typeof value==='string'&&value.length<=max&&!value.includes('\0');
const inside=(root,path)=>{const part=relative(root,path);return !part||!part.startsWith('..')&&!isAbsolute(part);};
export function validateFeatureMap(result,evidence,options={}) {
  const fail=()=>{throw new Error('功能整理結果格式或證據不符，請核對 skill 與目前證據包。');};
  if(!result||result.schemaVersion!==1||result.sourceHash!==evidence.sourceHash||result.catalogRevision!==evidence.catalogRevision||!Number.isFinite(Date.parse(result.generatedAt))||!Array.isArray(result.features)||result.features.length>500||!Array.isArray(result.relations)||result.relations.length>2000||!Array.isArray(result.unassignedPageIds)||!Array.isArray(result.unassignedApiIds)||!Array.isArray(result.notes)||result.notes.length>100||result.notes.some(note=>!text(note,2000)))fail();
  const files=new Map(evidence.files.map(row=>[row.path,row])),pages=new Set(evidence.pages.map(row=>row.id)),apis=new Set(evidence.apis.map(row=>row.id)),features=new Map(),assigned=new Set(),assignedApis=new Set();
  function sources(rows){if(!Array.isArray(rows)||!rows.length||rows.length>100)return false;return rows.every(row=>row&&files.has(row.path)&&Number.isInteger(row.line)&&row.line>0&&(!files.get(row.path).lines||row.line<=files.get(row.path).lines));}
  const levelLabels={1:'系統',2:'業務域',3:'模組',4:'原子功能'};
  const maxBranching=8,maxL2=6;
  const stepNamePattern=/^(?:第\s*[一二三四五六七八九十\d]+\s*[步動]|步驟\s*\d+)/;
  for(const row of result.features){
    if(!row||!id(row.id)||features.has(row.id)||!text(row.name,200)||!row.name.trim()||!text(row.description,2000)||!['code','inferred'].includes(row.evidence)||!Array.isArray(row.pageIds)||row.pageIds.length>500||!Array.isArray(row.apiIds)||row.apiIds.length>500||!Array.isArray(row.questions)||row.questions.length>100||row.questions.some(value=>!text(value,2000)||!value.trim())||!sources(row.sources))fail();
    if(stepNamePattern.test(row.name.trim()))throw new Error(`功能 ${row.id}（${row.name}）不可將流程步驟寫成功能節點，請只描述系統功能名稱。`);
    if(row.level!==undefined&&(typeof row.level!=='number'||!Number.isInteger(row.level)||![1,2,3,4].includes(row.level)))throw new Error(`功能 ${row.id} 的 level 必須為 1（${levelLabels[1]}）~4（${levelLabels[4]}），收到 ${row.level}。`);
    if(row.parentId!==undefined&&row.parentId!==null&&(!id(row.parentId)||row.parentId===row.id))throw new Error(`功能 ${row.id} 的 parentId 格式不合法或自我參照。`);
    features.set(row.id,row);
    for(const page of row.pageIds){if(!pages.has(page)||assigned.has(page))fail();assigned.add(page);}
    for(const api of row.apiIds){if(!apis.has(api))fail();assignedApis.add(api);}
  }
  const allowedParents=options.allowedParents||new Map();
  const childCounts=new Map(),siblingNames=new Map();
  for(const row of result.features){
    const scopeKey=row.parentId||'_root';
    const names=siblingNames.get(scopeKey)||new Set();
    const normalizedName=row.name.trim().toLowerCase();
    if(names.has(normalizedName))throw new Error(`功能 ${row.id}（${row.name}）在同一層級與其他功能重複，請合併同義節點。`);
    names.add(normalizedName);siblingNames.set(scopeKey,names);
    if(row.parentId===undefined||row.parentId===null)continue;
    const parent=features.get(row.parentId)||allowedParents.get(row.parentId);
    if(!parent)throw new Error(`功能 ${row.id} 的 parentId「${row.parentId}」不存在於功能清單。`);
    if(row.level!==undefined&&parent.level!==undefined&&parent.level>=row.level)throw new Error(`功能 ${row.id}（L${row.level} ${levelLabels[row.level]}）的父節點 ${row.parentId}（L${parent.level} ${levelLabels[parent.level]}）層級必須高於子節點。`);
    childCounts.set(row.parentId,(childCounts.get(row.parentId)||0)+1);
    const seen=new Set([row.id]);let cursor=parent;
    while(cursor?.parentId){if(seen.has(cursor.parentId))throw new Error(`功能階層出現循環參照（${row.id}）。`);seen.add(cursor.parentId);cursor=features.get(cursor.parentId)||allowedParents.get(cursor.parentId);}
  }
  for(const [parentId,count] of childCounts){
    const parent=features.get(parentId)||allowedParents.get(parentId);
    const limit=parent?.level===1?maxL2:maxBranching;
    if(count>limit)throw new Error(`功能 ${parentId} 的子功能數為 ${count} 個，超過上限 ${limit}。請合併或收斂 L1（系統）~L4（原子功能）架構。`);
  }
  for(const row of result.relations)if(!row||!features.has(row.from)||!features.has(row.to)||row.from===row.to||!['navigation','related'].includes(row.kind)||!['code','inferred'].includes(row.evidence)||!sources(row.sources))fail();
  const navChildren=new Map();
  for(const row of result.relations){if(row.kind==='navigation'){navChildren.set(row.from,(navChildren.get(row.from)||0)+1);}}
  for(const [nodeId,count] of navChildren){if(count>maxBranching)throw new Error(`功能 ${nodeId} 的 navigation 子關聯有 ${count} 個，超過上限 ${maxBranching}。L1（系統）~L4（原子功能）每個節點最多 ${maxBranching} 個子關聯。`);}
  const remainingPages=new Set(result.unassignedPageIds),remainingApis=new Set(result.unassignedApiIds);
  if(remainingPages.size!==result.unassignedPageIds.length||remainingApis.size!==result.unassignedApiIds.length||[...remainingPages].some(page=>!pages.has(page)||assigned.has(page))||[...remainingApis].some(api=>!apis.has(api)||assignedApis.has(api))||[...pages].some(page=>!assigned.has(page)&&!remainingPages.has(page))||[...apis].some(api=>!assignedApis.has(api)&&!remainingApis.has(api)))fail();
  if(Buffer.byteLength(json(result))>2*1024*1024)fail();
  return {features:features.size,pages:assigned.size,totalPages:pages.size,apis:assignedApis.size,totalApis:apis.size,unassignedPages:remainingPages.size,unassignedApis:remainingApis.size};
}
export async function applyFeatureMap(projectRoot,result,evidence,sourceRoot) {
  const coverage=validateFeatureMap(result,evidence);projectRoot=resolve(projectRoot);
  if(!sourceRoot||inside(projectRoot,resolve(sourceRoot))||inside(resolve(sourceRoot),projectRoot))throw new Error('請提供與測試專案分離的完整前端來源路徑。');
  const snapshot=await frontendSnapshot(sourceRoot);
  if(snapshot.sourceHash!==evidence.sourceHash)throw new Error('前端來源已變更，請重新準備證據後更新整理結果。');
  const file=join(projectRoot,'test-cases/catalog.json');await rejectSourceLinks(file);
  let original;try{original=await readFile(file,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  const revision=original===undefined?'missing':sourceDigest(original);
  if(revision!==result.catalogRevision)throw new Error('案例目錄已變更，請重新準備資料並保留最新人工修改。');
  const catalog=original?JSON.parse(original):{schemaVersion:1,features:[],cases:[]};
  if(catalog.schemaVersion!==1||!Array.isArray(catalog.features)||!Array.isArray(catalog.cases))throw new Error('案例目錄不相容。');
  const hashes=new Map(evidence.files.map(row=>[row.path,row.hash])),active=new Set(result.features.map(row=>row.id));
  for(const row of catalog.features)if(row.frontend&&!active.has(row.id))row.frontend={...row.frontend,state:'not-found'};
  for(const incoming of result.features){
    const previous=catalog.features.find(row=>row.id===incoming.id);
    const known=previous?.sources||[], sources=[...known];
    for(const source of incoming.sources)if(!sources.some(row=>row.path===source.path&&row.line===source.line))sources.push({...source,hash:hashes.get(source.path)});
    const dependencies=[...new Set([...incoming.sources.map(row=>row.path),...incoming.pageIds.flatMap(id=>evidence.pages.find(row=>row.id===id)?.dependencies||[])])];
    const row={...(previous||{}),id:incoming.id,name:previous?.name||incoming.name,sources:sources.slice(0,100),frontend:{description:incoming.description,pageIds:incoming.pageIds,apiIds:incoming.apiIds,questions:incoming.questions,evidence:incoming.evidence,sourceHash:result.sourceHash,state:'active',dependencies,...(incoming.level!==undefined?{level:incoming.level}:{}),...(incoming.parentId?{parentId:incoming.parentId}:{})}};
    if(previous)Object.assign(previous,row);else catalog.features.push(row);
  }
  catalog.frontendAnalysis={schemaVersion:1,sourceHash:result.sourceHash,generatedAt:result.generatedAt,coverage,files:evidence.files.map(({path,hash})=>({path,hash})),routes:evidence.routes,pages:evidence.pages.map(({imports,navigation,dependencies,...row})=>row),apis:evidence.apis,relations:result.relations,unassignedPageIds:result.unassignedPageIds,unassignedApiIds:result.unassignedApiIds,notes:result.notes,warnings:evidence.warnings,unresolved:evidence.unresolved};
  if(evidence.incremental)catalog.frontendAnalysis.incremental=evidence.incremental;
  if(catalog.features.length>500||Buffer.byteLength(json(catalog))>1024*1024)throw new Error('合併後案例目錄超過限制，原檔保留。');
  const stamp=Date.now()+'-'+randomUUID(),backup=join(projectRoot,'legacy/frontend-map',stamp);
  await rejectSourceLinks(backup);await mkdir(backup,{recursive:true});
  if(original!==undefined)await writeFile(join(backup,'catalog.json'),original,{flag:'wx'});
  await writeFile(join(backup,'proposal.json'),json(result),{flag:'wx'});
  let latest;try{latest=await readFile(file,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  if((latest===undefined?'missing':sourceDigest(latest))!==revision)throw new Error('案例在套用前已變更，請重新準備資料。');
  await mkdir(join(projectRoot,'test-cases'),{recursive:true});await rejectSourceLinks(file);
  const temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,json(catalog),{flag:'wx'});await rename(temp,file);
  return {applied:true,coverage,backup:relative(projectRoot,backup).replaceAll('\\','/')};
}
