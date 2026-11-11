import { isSourceImportPath } from '../../../../../services/control-api/src/sourceImportPolicy.js';
import {sourceFingerprint} from '../../../../../services/control-api/src/sourceFileFingerprint.js';
import { api } from './controlApi.js';
export const FILE_LIMIT = 10000;
export const BYTE_LIMIT = 100 * 1024 * 1024;
export function selectSourceFiles(input:File[]) {
  const files=input.filter(file=>isSourceImportPath(file.webkitRelativePath || file.name));
  if(files.length>FILE_LIMIT) throw new Error('最多匯入 10,000 個檔案。');
  if(files.reduce((total,file)=>total+file.size,0)>BYTE_LIMIT) throw new Error('匯入內容不可超過 100 MB。');
  const paths=files.map(file=>file.webkitRelativePath || file.name);
  if(new Set(paths).size!==paths.length)throw new Error('包含同名檔案，請改用選擇資料夾以保留路徑。');
  return {files,skipped:input.length-files.length};
}
export async function uploadProjectFiles(projectId:string,name:string,files:File[],progress:(count:number)=>void,options:{baselineSnapshotId?:string;onPhase?:(text:string)=>void}={}) {
  const session=await api<{id:string;protocol?:number}>('/source-imports',{method:'POST',body:JSON.stringify({projectId,name,fileCount:files.length,...(options.baselineSnapshotId?{baselineSnapshotId:options.baselineSnapshotId}:{})})});
  try {
    let needed=new Set(files.map(file=>file.webkitRelativePath||file.name));
    if(options.baselineSnapshotId){
      if(session.protocol!==2)throw new Error('增量匯入需要同步更新前端與 Control API。');
      options.onPhase?.('比對檔案');let entries:{path:string;hash:string;bytes:number}[]=[];let checked=0;
      for(const file of files){
        const source=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(source.includes('\0'))throw new Error(file.name+' 不是支援的文字檔案。');
        const bytes=new TextEncoder().encode(source);
        const hash=globalThis.crypto?.subtle?Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join(''):sourceFingerprint(bytes);
        entries.push({path:file.webkitRelativePath||file.name,hash,bytes:bytes.length});progress(++checked);
        if(entries.length===100){await api('/source-imports/'+session.id+'/manifest',{method:'PUT',body:JSON.stringify({files:entries})});entries=[];}
      }
      if(entries.length)await api('/source-imports/'+session.id+'/manifest',{method:'PUT',body:JSON.stringify({files:entries})});
      const plan=await api<{needed:string[]}>('/source-imports/'+session.id+'/plan',{method:'POST',body:'{}'});
      if(!Array.isArray(plan.needed)||new Set(plan.needed).size!==plan.needed.length||plan.needed.some(path=>!needed.has(path)))throw new Error('檔案比對結果不正確，請重新匯入。');
      needed=new Set(plan.needed);
    }
    options.onPhase?.('更新檔案');progress(files.length-needed.size);
    let batch:{path:string;source:string}[]=[];let bytes=0;let uploaded=files.length-needed.size;
    async function flush() {
      if(!batch.length)return;
      await api(`/source-imports/${session.id}/files`,{method:'PUT',body:JSON.stringify({files:batch})});
      uploaded+=batch.length;progress(uploaded);batch=[];bytes=0;
    }
    for(const file of files) {
      if(!needed.has(file.webkitRelativePath||file.name))continue;
      const source=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());
      if(source.includes('\0'))throw new Error(`${file.name} 不是支援的文字檔案。`);
      const item={path:file.webkitRelativePath || file.name,source};
      const size=new TextEncoder().encode(JSON.stringify(item)).length;
      if(size>2000000) {
        await flush();
        for(let offset=0;offset<source.length;offset+=200000) {
          await api(`/source-imports/${session.id}/chunks`,{method:'PUT',body:JSON.stringify({path:item.path,offset,source:source.slice(offset,offset+200000),final:offset+200000>=source.length})});
        }
        uploaded++;progress(uploaded);continue;
      }
      if(batch.length>=100 || bytes+size>2500000)await flush();
      batch.push(item);bytes+=size;
    }
    await flush();
    options.onPhase?.('重建切片');
    return await api<{id:string;fileCount:number;contentHash:string;changes?:{added:number;modified:number;deleted:number;reused:number};analysisParts?:number}>(`/source-imports/${session.id}/complete`,{method:'POST',body:'{}'});
  } catch(reason) {
    await api(`/source-imports/${session.id}`,{method:'DELETE'}).catch(()=>{});
    throw reason;
  }
}
