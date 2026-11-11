import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { isSourceImportPath } from './sourceImportPolicy.ts';
export const UPLOAD_FILE_LIMIT = 10000;
export const UPLOAD_BYTE_LIMIT = 100 * 1024 * 1024;
export const validUploadPath = isSourceImportPath;
export const uploadedFileSchema = z.object({path:z.string().refine(validUploadPath,'Unsupported or unsafe file path'),source:z.string().refine(value=>!value.includes('\0'),'File is not text')}).strict();
export type UploadedFile = z.infer<typeof uploadedFileSchema>;
export interface ManifestEntry {path:string;hash:string;bytes:number}
export interface ImportChanges {added:number;modified:number;deleted:number;reused:number}
export interface UploadState {baselineSnapshotId?:string;manifest?:ManifestEntry[];planned?:boolean;changes?:ImportChanges; projectId:string; name:string; expectedCount:number; files:UploadedFile[]; bytes:number; pending?:UploadedFile }
export function appendUpload(state:UploadState, raw:unknown):UploadState {
  if(state.pending)throw Object.assign(new Error('上一個檔案尚未完成。'),{statusCode:409});
  const files=z.array(uploadedFileSchema).min(1).max(100).parse(raw);
  if(state.files.length+files.length>state.expectedCount || state.files.length+files.length>UPLOAD_FILE_LIMIT) throw Object.assign(new Error('匯入檔案超過預定數量或 10,000 個上限。'),{statusCode:400});
  const names=new Set(state.files.map(file=>file.path));
  for(const file of files) {if(names.has(file.path)) throw Object.assign(new Error('匯入包含重複路徑。'),{statusCode:400});names.add(file.path);}
  if(state.manifest){
    if(!state.planned)throw Object.assign(new Error('請先完成檔案比對。'),{statusCode:409});
    for(const file of files){const entry=state.manifest.find(item=>item.path===file.path);if(!entry||entry.hash!==createHash('sha256').update(file.source).digest('hex')||entry.bytes!==Buffer.byteLength(file.source))throw Object.assign(new Error('檔案與比對清單不符，請重新選擇完整資料夾。'),{statusCode:409});}
  }
  const bytes=state.bytes+files.reduce((total,file)=>total+Buffer.byteLength(file.source),0);
  if(bytes>UPLOAD_BYTE_LIMIT) throw Object.assign(new Error('匯入內容超過 100 MB。'),{statusCode:400});
  return {...state,files:[...state.files,...files],bytes};
}
export function completeUpload(state:UploadState) {
  if(state.manifest&&!state.planned)throw Object.assign(new Error('檔案比對尚未完成。'),{statusCode:409});
  if(state.pending || state.files.length!==state.expectedCount || !state.files.length) throw Object.assign(new Error('檔案尚未完整上傳。'),{statusCode:409});
  const files=state.files.map(file=>({...file,hash:createHash('sha256').update(file.source).digest('hex')})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  const contentHash=createHash('sha256').update(JSON.stringify(files.map(file=>({path:file.path,hash:file.hash})))).digest('hex');
  return {id:randomUUID(),projectId:state.projectId,origin:'upload' as const,name:state.name,contentHash,importChanges:state.changes||{added:files.length,modified:0,deleted:0,reused:0},baselineSnapshotId:state.baselineSnapshotId,repositories:[],files,environment:'isolated-fixture',deploymentVerified:false};
}

export function appendUploadChunk(state:UploadState,raw:unknown):UploadState {
  const chunk=z.object({path:z.string().refine(validUploadPath),offset:z.number().int().min(0),source:z.string().max(250000).refine(value=>!value.includes('\0')),final:z.boolean()}).strict().parse(raw);
  if(state.manifest&&(!state.planned||!state.manifest.some(file=>file.path===chunk.path)))throw Object.assign(new Error('檔案不在已確認的更新清單中。'),{statusCode:409});
  const pending=state.pending;
  if((pending && pending.path!==chunk.path) || chunk.offset!==(pending?.source.length || 0))throw Object.assign(new Error('檔案片段順序不一致，請重新匯入。'),{statusCode:409});
  if(!pending && state.files.some(file=>file.path===chunk.path))throw Object.assign(new Error('匯入包含重複路徑。'),{statusCode:400});
  const file={path:chunk.path,source:(pending?.source || '')+chunk.source};
  if(state.bytes+Buffer.byteLength(file.source)>UPLOAD_BYTE_LIMIT)throw Object.assign(new Error('匯入內容超過 100 MB。'),{statusCode:400});
  if(state.manifest&&Buffer.byteLength(file.source)>(state.manifest.find(item=>item.path===chunk.path)?.bytes||0))throw Object.assign(new Error('檔案大小與比對清單不符。'),{statusCode:409});
  const {pending:discard,...complete}=state;
  if(chunk.final)return appendUpload(complete,[file]);
  if(state.files.length>=state.expectedCount)throw Object.assign(new Error('匯入超過預定檔案數量。'),{statusCode:400});
  return {...state,pending:file};
}

const manifestSchema=z.array(z.object({path:z.string().refine(validUploadPath,'Unsupported or unsafe file path'),hash:z.string().regex(/^[a-f0-9]{64}$/),bytes:z.number().int().min(0).max(UPLOAD_BYTE_LIMIT)}).strict()).min(1).max(100);
export function appendManifest(state:UploadState,raw:unknown):UploadState{
 if(state.planned||state.files.length||state.pending)throw Object.assign(new Error('此匯入已開始傳送內容，不能更改檔案清單。'),{statusCode:409});
 const entries=manifestSchema.parse(raw),manifest=[...(state.manifest||[]),...entries];
 if(manifest.length>state.expectedCount||new Set(manifest.map(item=>item.path)).size!==manifest.length)throw Object.assign(new Error('檔案清單數量不符或路徑重複。'),{statusCode:400});
 if(manifest.reduce((sum,item)=>sum+item.bytes,0)>UPLOAD_BYTE_LIMIT)throw Object.assign(new Error('匯入內容超過 100 MB。'),{statusCode:400});
 return {...state,manifest};
}
export function planUpload(state:UploadState,baseline?:{files:UploadedFile[]}):UploadState{
 if(state.planned)return state;
 if(!state.manifest||state.manifest.length!==state.expectedCount)throw Object.assign(new Error('請先提供完整專案的檔案清單。'),{statusCode:409});
 const old=new Map((baseline?.files||[]).map(file=>[file.path,file]));const files:UploadedFile[]=[];let added=0,modified=0;
 for(const entry of state.manifest){const previous=old.get(entry.path);old.delete(entry.path);if(previous&&createHash('sha256').update(previous.source).digest('hex')===entry.hash&&Buffer.byteLength(previous.source)===entry.bytes)files.push({path:previous.path,source:previous.source});else if(previous)modified++;else added++;}
 return {...state,planned:true,files,bytes:files.reduce((sum,file)=>sum+Buffer.byteLength(file.source),0),changes:{added,modified,reused:files.length,deleted:old.size}};
}
