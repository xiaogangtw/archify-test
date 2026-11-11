import { useRef, useState } from 'react';
import { Button, Field, Input, Notice } from '../../components/ui/controls';
import type { FrontendProject } from './types';
import { selectSourceFiles, uploadProjectFiles } from './sourceImportModel';
import { useTesting } from './TestingProvider';
export function ProjectFileImport({project,onFinished}:{project:FrontendProject;onFinished:()=>void}) {
  const {saveProject}=useTesting();
  const [name,setName]=useState(project.name);
  const [files,setFiles]=useState<File[]>([]);
  const [skipped,setSkipped]=useState(0);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [uploaded,setUploaded]=useState(0);
  const [phase,setPhase]=useState('');
  const folderInput=useRef<HTMLInputElement>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  function choose(input:FileList|null) {
    if(!input?.length)return;
    setError('');
    try {const selected=selectSourceFiles(Array.from(input));setFiles(selected.files);setSkipped(selected.skipped);if(!selected.files.length)setError('未找到支援的原始碼或設定檔。');}
    catch(reason){setFiles([]);setError(reason instanceof Error?reason.message:'檔案選擇失敗');}
  }
  async function save() {
    if(!name.trim()){setError('請填寫專案名稱。');return;}
    if(!files.length && !project.sourceSnapshotId){setError('請選擇專案資料夾或檔案。');return;}
    setBusy(true);setError('');setUploaded(0);
    try {
      const id=project.id || crypto.randomUUID();
      const result=files.length?await uploadProjectFiles(id,name.trim(),files,setUploaded,{baselineSnapshotId:project.sourceSnapshotId,onPhase:setPhase}):null;
      await saveProject({...project,id,name:name.trim(),sourceType:'upload',repositoryUrl:'',bffRepositoryUrl:'',backendRepositoryUrl:'',branch:'release',
        ...(result?{sourceSnapshotId:result.id,importedFileCount:result.fileCount,importedAt:new Date().toISOString()}: {})});
      onFinished();
    }catch(reason){setError(reason instanceof Error?reason.message:'匯入失敗，請重試');}
    finally{setBusy(false);}
  }
  return <form className="space-y-6" onSubmit={event=>{event.preventDefault();void save();}}>
    <h2 className="text-heading font-bold">匯入專案檔案</h2>
    {error && <Notice error>{error}</Notice>}
    <Field label="專案名稱"><Input required maxLength={100} disabled={busy} value={name} onChange={event=>setName(event.target.value)}/></Field>
    <div className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <p className="text-body text-muted">免設定 Git。選擇原始碼與設定檔，最多 10,000 個檔案、100 MB。</p>
      <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={()=>folderInput.current?.click()}>選擇資料夾</Button><Button disabled={busy} onClick={()=>fileInput.current?.click()}>選擇檔案</Button></div>
      <input ref={folderInput} type="file" multiple {...{webkitdirectory:''}} className="hidden" tabIndex={-1} aria-label="選擇專案資料夾" disabled={busy} onChange={event=>{choose(event.target.files);event.target.value='';}}/>
      <input ref={fileInput} type="file" multiple accept=".ts,.tsx,.js,.jsx,.mjs,.cjs,.mts,.cts,.json,.css,.scss,.html,.vue,.svelte,.md,.yaml,.yml,.graphql,.gql" className="hidden" tabIndex={-1} aria-label="選擇專案檔案" disabled={busy} onChange={event=>{choose(event.target.files);event.target.value='';}}/>
      <p role="status" className="text-body">{busy?`${phase||'處理中'}：${uploaded} / ${files.length} 個檔案`:files.length?`已選擇 ${files.length} 個檔案${skipped?`，略過 ${skipped} 個不支援或排除的檔案`:''}`:project.sourceSnapshotId?`目前已匯入 ${project.importedFileCount} 個檔案`:'尚未選擇檔案'}</p>
      <p className="text-body text-muted">每次選擇完整資料夾；自動沿用相同檔案，只上傳新增或修改內容，未選到的舊檔案會從新版本移除。舊版本保留。</p>
    </div>
    <div className="flex flex-wrap gap-3"><Button type="submit" variant="primary" disabled={busy}>{busy?'匯入中…':files.length || !project.sourceSnapshotId?'匯入專案':'儲存'}</Button><Button disabled={busy} onClick={onFinished}>返回</Button></div>
  </form>;
}
