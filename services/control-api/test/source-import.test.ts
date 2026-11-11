import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendUpload, appendUploadChunk, completeUpload, validUploadPath, type UploadState } from '../src/sourceImport.ts';
const {selectSourceFiles,uploadProjectFiles}=await import(new URL('../../../apps/web/src/features/testing/sourceImportModel.ts',import.meta.url).href);
const initial=(count=1):UploadState=>({projectId:'a'.repeat(36),name:'Local project',expectedCount:count,files:[],bytes:0});
test('local file import accepts 10000 paths, rejects duplicates, traversal and incomplete snapshots',()=>{
  let state=initial(10000);
  for(let start=0;start<10000;start+=100)state=appendUpload(state,Array.from({length:100},(_,i)=>({path:`Desktop/project/src/${start+i}.ts`,source:'export {};'})));
  const snapshot=completeUpload(state);assert.equal(snapshot.files.length,10000);assert.equal(snapshot.origin,'upload');assert.deepEqual(snapshot.repositories,[]);assert.equal(snapshot.contentHash.length,64);assert.equal(snapshot.deploymentVerified,false);
  assert.throws(()=>appendUpload(state,[{path:'extra.ts',source:''}]),/10,000/);
  assert.throws(()=>appendUpload(appendUpload(initial(2),[{path:'a.ts',source:''}]),[{path:'a.ts',source:''}]),/重複/);
  assert.throws(()=>completeUpload(initial()),/完整/);
  for(const path of ['../a.ts','/a.ts','C:/a.ts','a\\b.ts','src/.env','node_modules/a.ts','a/../../b.ts'])assert.equal(validUploadPath(path),false,path);
});
test('large files are uploaded in ordered chunks and preserve their full content',async()=>{
  const originalFetch=globalThis.fetch;let state=initial();const requests:string[]=[];
  const source='export const content="'+ '測試'.repeat(600000)+'";';
  const file=new File([source],'large.ts');assert.ok(file.size>1024*1024);
  assert.equal(selectSourceFiles([file]).files.length,1);
  globalThis.fetch=(async(input,init)=>{
    const path=String(input);requests.push(path);const body=JSON.parse(String(init?.body || '{}'));
    assert.ok(Buffer.byteLength(String(init?.body || ''))<3000000);
    if(path==='/api/source-imports')return Response.json({id:'session'});
    if(path.endsWith('/chunks')){state=appendUploadChunk(state,body);return Response.json({uploaded:state.files.length});}
    if(path.endsWith('/complete')){const snapshot=completeUpload(state);assert.equal(snapshot.files[0].source,source);return Response.json({id:snapshot.id,fileCount:1,contentHash:snapshot.contentHash});}
    throw new Error('Unexpected request: '+path);
  }) as typeof fetch;
  try {const result=await uploadProjectFiles('project','Local',[file],()=>{});assert.equal(result.fileCount,1);assert.ok(requests.filter(path=>path.endsWith('/chunks')).length>1);assert.equal(requests.some(path=>/git|sources\/refresh/.test(path)),false);}
  finally {globalThis.fetch=originalFetch;}
  const pending=appendUploadChunk(initial(),{path:'a.ts',offset:0,source:'partial',final:false});
  assert.throws(()=>completeUpload(pending),/完整/);
  assert.throws(()=>appendUploadChunk(pending,{path:'a.ts',offset:0,source:'bad',final:true}),/順序/);
});
test('file import excludes dependency and secret files, reports total quota and cancels failed uploads',async()=>{
  const files=[new File(['x'],'app.ts'),new File(['secret'],'.env'),new File(['secret'],'private.key')];
  assert.equal(selectSourceFiles(files).files.length,1);assert.equal(selectSourceFiles(files).skipped,2);
  assert.throws(()=>selectSourceFiles(Array.from({length:10001},(_,i)=>new File([''],`${i}.ts`))),/10,000/);
  const originalFetch=globalThis.fetch;let cancelled=false;
  globalThis.fetch=(async(input,init)=>{if(String(input)==='/api/source-imports')return Response.json({id:'session'});if(init?.method==='DELETE'){cancelled=true;return Response.json({deleted:true});}return Response.json({error:'Upload failed'},{status:503});}) as typeof fetch;
  try {await assert.rejects(uploadProjectFiles('id','Local',[files[0]],()=>{}),/Upload failed/);assert.equal(cancelled,true);}finally {globalThis.fetch=originalFetch;}
});
test('source-only policy retains frontend roots/config and removes documents, tests, assets and lockfiles',()=>{
  for(const path of ['repo/config/tsconfig.base.json','repo/packages/shared/jsconfig.paths.json'])assert.equal(validUploadPath(path),true,path);
  for(const path of ['repo/src/api.ts','repo/app/page.tsx','repo/pages/index.vue','repo/components/Button.svelte','repo/apps/web/src/main.ts','repo/packages/ui/src/Button.tsx','repo/package.json','repo/tsconfig.json','repo/vite.config.ts','repo/apps/web/package.json','src/api.ts','api.ts'])assert.equal(validUploadPath(path),true,path);
  for(const path of ['repo/README.md','repo/docs/guide.ts','repo/src/api.spec.ts','repo/src/Example.stories.tsx','repo/src/__tests__/case.ts','repo/src/generated/client.ts','repo/public/mock.json','repo/src/fixtures/users.json','repo/scripts/build.ts','repo/package-lock.json','repo/src/private.key','repo/src/.env.local','repo/src/credentials.json','repo/src/image.png','repo/node_modules/a.ts'])assert.equal(validUploadPath(path),false,path);
});
