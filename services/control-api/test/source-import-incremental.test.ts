import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import Fastify from 'fastify';
import {registerSourceImports} from '../src/sourceImportRoutes.ts';
import {sourceFingerprint} from '../src/sourceFileFingerprint.ts';
import {apiAnalysisVersion,sourceAnalysisParts} from '../src/apiAnalysis.ts';
import {completeUpload} from '../src/sourceImport.ts';
const {uploadProjectFiles}=await import(new URL('../../../apps/web/src/features/testing/sourceImportModel.ts',import.meta.url).href);
const hash=(source:string)=>createHash('sha256').update(source).digest('hex');
const file=(path:string,source:string)=>{const value=new File([source],path.split('/').at(-1)!);Object.defineProperty(value,'webkitRelativePath',{value:path});return value;};

test('browser SHA-256 fallback matches standard digests across UTF-8, padding boundaries and large input',()=>{
 for(const bytes of [new TextEncoder().encode(''),new TextEncoder().encode('abc'),new TextEncoder().encode('檔案比對\r\nUnicode'),...Array.from([1,55,56,63,64,65,127,128,1024,1000000],size=>Uint8Array.from({length:size},(_,i)=>i%251))])assert.equal(sourceFingerprint(bytes),createHash('sha256').update(bytes).digest('hex'));
});

test('complete folder updates only transfer changed files, keep immutable full snapshots and rebuild all dependency slices',async()=>{
 const projectId=randomUUID();const snapshots=new Map<string,any>();const imports=new Map<string,any>();let recorded=0;
 const original=completeUpload({projectId,name:'project',expectedCount:3,files:[{path:'repo/src/client.ts',source:`export const endpoint='/old';`},{path:'repo/src/page.ts',source:`import {endpoint} from './client';export const Page=()=>fetch(endpoint);`},{path:'repo/src/remove.ts',source:'export const removed=true;'}],bytes:0});snapshots.set(original.id,structuredClone(original));
 const frozen=structuredClone(original);
 const query=async(sql:string,args:any[]=[])=>{
  if(sql.includes('FROM source_snapshots'))return {rows:snapshots.has(args[0])?[{body:structuredClone(snapshots.get(args[0]))}]:[]};
  if(sql.startsWith('SELECT body FROM source_imports'))return {rows:imports.has(args[0])?[{body:structuredClone(imports.get(args[0]))}]:[]};
  if(sql.startsWith('INSERT INTO source_imports'))imports.set(args[0],JSON.parse(args[1]));
  else if(sql.startsWith('UPDATE source_imports'))imports.set(args[0],JSON.parse(args[1]));
  else if(sql.startsWith('INSERT INTO source_snapshots'))snapshots.set(args[0],JSON.parse(args[1]));
  else if(sql.startsWith('DELETE FROM source_imports WHERE id='))imports.delete(args[0]);
  else if(!sql.startsWith('DELETE FROM source_imports WHERE created_at'))throw Error('Unexpected SQL '+sql);
  return {rows:[]};
 };
 const app=Fastify({bodyLimit:3000000});registerSourceImports(app,{pool:{query},transaction:async(fn:any)=>{const before=new Map(snapshots);try{return await fn({query});}catch(error){snapshots.clear();for(const [key,value] of before)snapshots.set(key,value);throw error;}},record:async()=>{recorded++;return {} as any;}});
 const originalFetch=globalThis.fetch;const calls:{path:string;input:any}[]=[];
 globalThis.fetch=(async(url,init)=>{const path=String(url);const input=JSON.parse(String(init?.body||'{}'));calls.push({path,input});const reply=await app.inject({method:(init?.method||'GET') as any,url:path,payload:init?.body?input:undefined});return new Response(reply.body,{status:reply.statusCode,headers:{'Content-Type':'application/json'}});}) as typeof fetch;
 try{
  const changed=[file('repo/src/client.ts',`export const endpoint='/new';`),file('repo/src/page.ts',original.files.find(item=>item.path.endsWith('page.ts'))!.source),file('repo/src/new.ts','export const added=true;')];
  const result=await uploadProjectFiles(projectId,'project',changed,()=>{},{baselineSnapshotId:original.id});assert.deepEqual(result.changes,{added:1,modified:1,deleted:1,reused:1});assert.equal(recorded,1);
  const content=calls.filter(call=>call.path.endsWith('/files')).flatMap(call=>call.input.files);assert.deepEqual(content.map(item=>item.path).sort(),['repo/src/client.ts','repo/src/new.ts']);assert.ok(!JSON.stringify(content).includes('Page=()=>load'));
  const current=snapshots.get(result.id);assert.equal(current.files.length,3);assert.ok(!current.files.some((item:any)=>item.path.endsWith('remove.ts')));assert.equal(current.files.find((item:any)=>item.path.endsWith('page.ts')).source,original.files.find(item=>item.path.endsWith('page.ts'))!.source);assert.deepEqual(snapshots.get(original.id),frozen);
  assert.equal(current.apiAnalysisVersion,apiAnalysisVersion);assert.deepEqual(current.apiAnalysisParts,sourceAnalysisParts(current.files));assert.ok(JSON.stringify(current.apiAnalysisParts).includes('/new'));assert.ok(JSON.stringify(current.apiAnalysisParts).includes('page.ts'),'unchanged caller must stay in dependency slicing');
  calls.length=0;const same=await uploadProjectFiles(projectId,'project',changed,()=>{},{baselineSnapshotId:current.id});assert.deepEqual(same.changes,{added:0,modified:0,deleted:0,reused:3});assert.equal(calls.some(call=>call.path.endsWith('/files')||call.path.endsWith('/chunks')),false);assert.equal(snapshots.get(same.id).contentHash,current.contentHash);
  const start=()=>app.inject({method:'POST',url:'/api/source-imports',payload:{projectId,name:'project',fileCount:1,baselineSnapshotId:original.id}});
  const cross=await app.inject({method:'POST',url:'/api/source-imports',payload:{projectId:randomUUID(),name:'other',fileCount:1,baselineSnapshotId:original.id}});assert.equal(cross.statusCode,409);
  let session=(await start()).json().id;let response=await app.inject({method:'POST',url:'/api/source-imports/'+session+'/plan',payload:{}});assert.equal(response.statusCode,409);
  const path='repo/src/client.ts',source='export const updated=true;';response=await app.inject({method:'PUT',url:'/api/source-imports/'+session+'/manifest',payload:{files:[{path,hash:hash(source),bytes:Buffer.byteLength(source)}]}});assert.equal(response.statusCode,200);assert.equal((await app.inject({method:'POST',url:'/api/source-imports/'+session+'/plan',payload:{}})).statusCode,200);
  response=await app.inject({method:'PUT',url:'/api/source-imports/'+session+'/files',payload:{files:[{path,source:'tampered'}]}});assert.equal(response.statusCode,409);const count=snapshots.size;assert.equal((await app.inject({method:'POST',url:'/api/source-imports/'+session+'/complete',payload:{}})).statusCode,409);assert.equal(snapshots.size,count);
  assert.equal((await app.inject({method:'PUT',url:'/api/source-imports/'+session+'/chunks',payload:{path:'repo/src/not-listed.ts',offset:0,source:'x',final:false}})).statusCode,409);
  assert.equal((await app.inject({method:'DELETE',url:'/api/source-imports/'+session})).statusCode,200);assert.equal(imports.has(session),false);assert.deepEqual(snapshots.get(original.id),frozen);
 }finally{globalThis.fetch=originalFetch;await app.close();}
});

test('incremental large Unicode files preserve chunk order and must match the planned digest',async()=>{
 const {appendManifest,planUpload,appendUploadChunk}=await import('../src/sourceImport.ts');
 const source='export const text="'+'中文'.repeat(400000)+'";';
 let state=appendManifest({projectId:'p',name:'Large',expectedCount:1,files:[],bytes:0},[{path:'src/large.ts',hash:hash(source),bytes:Buffer.byteLength(source)}]);state=planUpload(state,{files:[{path:'src/large.ts',source:'old'}]});
 for(let offset=0;offset<source.length;offset+=200000)state=appendUploadChunk(state,{path:'src/large.ts',offset,source:source.slice(offset,offset+200000),final:offset+200000>=source.length});
 const snapshot=completeUpload(state);assert.equal(snapshot.files[0].source,source);assert.deepEqual(snapshot.importChanges,{added:0,modified:1,deleted:0,reused:0});
});

test('incremental client refuses an old backend and discards its temporary session without uploading content',async()=>{
 const originalFetch=globalThis.fetch;const calls:{path:string;method?:string}[]=[];
 globalThis.fetch=(async(url,init)=>{calls.push({path:String(url),method:init?.method});return Response.json({id:'session'});}) as typeof fetch;
 try{await assert.rejects(uploadProjectFiles('p','Project',[file('src/a.ts','export {};')],()=>{},{baselineSnapshotId:randomUUID()}),/同步更新/);assert.deepEqual(calls,[{path:'/api/source-imports',method:'POST'},{path:'/api/source-imports/session',method:'DELETE'}]);}finally{globalThis.fetch=originalFetch;}
});
