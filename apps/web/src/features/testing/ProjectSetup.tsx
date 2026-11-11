import {ToolIcon} from '../../components/ui/ToolIcon';
import { api } from './controlApi';
import { useRef, useState } from 'react';
import type { PageId } from '../../types';
import type { FrontendProject } from './types';
import { Button, Field, Input, Notice } from '../../components/ui/controls';
import { useTesting } from './TestingProvider';
import { ProjectFileImport } from './ProjectFileImport';
import { desktopPicker, readDirectory } from './localDirectory';
import { selectSourceFiles, uploadProjectFiles } from './sourceImportModel';

export function validRepository(value: string): boolean {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && url.pathname !== '/' && !url.search && !url.hash; }
  catch { return false; }
}
const empty: FrontendProject = {name:'',repositoryUrl:'',bffRepositoryUrl:'',backendRepositoryUrl:'',branch:'release',websiteUrl:''};
export function ProjectSetup({page,onNavigate}:{page:PageId;onNavigate:(page:PageId)=>void}) {
  const {data,projects,saveProject,selectProject,removeProject} = useTesting();
  const [draft,setDraft] = useState<FrontendProject|null>(page === 'projects' ? null : {...data.project,id:data.project.id || (data.project.repositoryUrl ? 'original' : undefined)});
  const [error,setError] = useState('');
  const [status,setStatus] = useState('');
  const [busy,setBusy] = useState(false);
  const [importId,setImportId] = useState('');
  const folderInput=useRef<HTMLInputElement>(null);
  const importTarget=useRef<FrontendProject|null>(null);

  async function perform(action:()=>Promise<void>) {
    setBusy(true);setError('');setStatus('');
    try {await action();}catch(reason){setError(reason instanceof Error ? reason.message : '操作失敗');}
    finally {setBusy(false);}
  }
  async function openFolder(project:FrontendProject|null=null) {
    importTarget.current=project;
    const picker=desktopPicker();
    if(!picker){folderInput.current?.click();return;}
    try {
      const directory=await picker({startIn:'desktop',mode:'read'});
      setBusy(true);setError('');setStatus('正在讀取所選資料夾…');
      const selected=await readDirectory(directory);
      await importFolder(selected.files,selected.skipped);
    }catch(reason) {
      if(!(reason instanceof DOMException && reason.name==='AbortError'))setError(reason instanceof Error?reason.message:'無法讀取資料夾');
      setStatus('');
    }finally {setBusy(false);}
  }
  async function importFolder(input:File[],preSkipped=0) {
    if(!input.length)return;
    await perform(async()=>{
      const selected=selectSourceFiles(input);
      const files=selected.files;const skipped=selected.skipped+preSkipped;
      if(!files.length)throw new Error('選擇的資料夾沒有支援的原始碼或設定檔。');
      const previous=importTarget.current;
      const id=previous?.id || crypto.randomUUID();
      const name=previous?.name || input[0].webkitRelativePath.split('/')[0] || '本機專案';
      const result=await uploadProjectFiles(id,name,files,count=>setStatus(`處理中：${count} / ${files.length} 個檔案`),{baselineSnapshotId:previous?.sourceSnapshotId,onPhase:setStatus});
      await saveProject({...empty,...previous,id,name,sourceType:'upload',repositoryUrl:'',bffRepositoryUrl:'',backendRepositoryUrl:'',
        sourceSnapshotId:result.id,importedFileCount:result.fileCount,importedAt:new Date().toISOString()});
      setStatus(`已匯入 ${result.fileCount} 個檔案${result.changes?`（新增 ${result.changes.added}、修改 ${result.changes.modified}、移除 ${result.changes.deleted}、沿用 ${result.changes.reused}）`:""}${skipped?`，略過 ${skipped} 個不需上傳的檔案或資料夾`:''}`);
      setDraft(null);onNavigate('projects');
    });
  }
  async function save() {
    if(!draft)return;
    if(!draft.name.trim() || !draft.repositoryUrl.trim()) {setError('請填寫專案名稱與前端 Git 地址。');return;}
    if([draft.repositoryUrl,draft.bffRepositoryUrl,draft.backendRepositoryUrl].some(value => value && !validRepository(value.trim()))) {setError('請使用不含密碼或 Token 的 HTTPS GitLab 倉庫地址。');return;}
    await perform(async()=>{
      await saveProject({...draft,name:draft.name.trim(),sourceType:'git',repositoryUrl:draft.repositoryUrl.trim(),bffRepositoryUrl:draft.bffRepositoryUrl?.trim(),backendRepositoryUrl:draft.backendRepositoryUrl?.trim(),branch:'release'});
      setDraft(null);onNavigate('projects');
    });
  }
  async function refresh(project:FrontendProject) {
    if(project.sourceType==='upload'){openFolder(project);return;}
    setImportId(project.id!);
    await perform(async()=>{
      await selectProject(project.id!);
      const result=await api<{id:string;fileCount:number}>('/sources/refresh',{method:'POST',body:'{}'});
      await saveProject({...project,sourceSnapshotId:result.id,importedFileCount:result.fileCount,importedAt:new Date().toISOString()});
      setStatus(`已讀取 ${result.fileCount} 個來源檔案`);
    });
    setImportId('');
  }
  function finish() {setDraft(null);onNavigate('projects');}
  return <div className="space-y-5">
    <h1 className="sr-only">測試專案</h1>
    <input ref={folderInput} type="file" multiple {...{webkitdirectory:''}} className="hidden" tabIndex={-1} aria-label="匯入本機專案資料夾" disabled={busy} onChange={event=>{const files=Array.from(event.target.files || []);event.target.value='';void importFolder(files);}}/>
    {error && <Notice error>{error}</Notice>}{status && <Notice>{status}</Notice>}
    {draft?.sourceType==='upload' ? <ProjectFileImport project={draft} onFinished={finish}/> : draft ? <form className="space-y-6" onSubmit={event=>{event.preventDefault();void save();}}>
      <fieldset disabled={busy} className="space-y-5">
        <Field label="專案名稱"><Input required maxLength={100} value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></Field>
        <Field label="前端 Git 地址"><Input required value={draft.repositoryUrl} onChange={event=>setDraft({...draft,repositoryUrl:event.target.value})} placeholder="https://gitlab.example.com/team/frontend.git"/></Field>
        <Field label="中間層 Git 地址"><Input value={draft.bffRepositoryUrl || ''} onChange={event=>setDraft({...draft,bffRepositoryUrl:event.target.value})}/></Field>
        <Field label="後端 Git 地址"><Input value={draft.backendRepositoryUrl || ''} onChange={event=>setDraft({...draft,backendRepositoryUrl:event.target.value})}/></Field>
      </fieldset>
      <div className="flex flex-wrap gap-3"><Button type="submit" variant="primary" disabled={busy}>{busy?'儲存中…':'儲存'}</Button><Button disabled={busy} onClick={finish}>返回</Button><Button onClick={()=>onNavigate('git-connections')}>Git 管理</Button></div>
    </form> : <>
      {projects.length > 0 && <div className="flex flex-wrap justify-end gap-3"><Button disabled={busy} variant="primary" onClick={()=>openFolder()}>匯入本機資料夾</Button><Button disabled={busy} onClick={()=>setDraft({...empty})}>新增 Git 專案</Button></div>}
      {!projects.length ? <div className="flex min-h-64 flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-line">
        <h2 className="text-section font-bold">尚未新增專案</h2>
        <div className="flex flex-wrap justify-center gap-3"><Button disabled={busy} variant="primary" onClick={()=>openFolder()}>匯入本機資料夾</Button><Button disabled={busy} onClick={()=>setDraft({...empty})}>新增 Git 專案</Button></div>
        <p className="text-body text-muted">只匯入前端程式碼與必要設定，最多 10,000 個檔案、100 MB。</p>
      </div> : <div className="space-y-3">{projects.map(project=><div key={project.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
        <p className="min-w-0 w-full truncate text-left font-medium sm:w-auto sm:flex-1" title={project.name}>{project.name}{(data.project.id || 'original')===project.id?' · 目前專案':''}</p>
        <span className="text-body text-muted">{project.sourceType==='upload'?'本機檔案':'Git'} · {importId===project.id?'讀取中…':project.sourceSnapshotId?`${project.importedFileCount} 個檔案`:'尚未讀取'}</span>
        <Button disabled={busy} variant="ghost" aria-label={`刷新 ${project.name}`} onClick={()=>refresh(project)}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6.1A8 8 0 0 1 19.5 10M4.5 14A8 8 0 0 0 17.9 17.9"/></svg></Button>
        {project.sourceType==='upload' && <Button disabled={busy} onClick={()=>openFolder(project)}>重新選擇資料夾</Button>}
        <Button disabled={busy} onClick={()=>setDraft({...project})}>編輯</Button><Button aria-label="刪除" disabled={busy} variant="danger" onClick={()=>perform(()=>removeProject(project.id!))}><ToolIcon name="trash"/></Button>
      </div>)}</div>}
    </>}
  </div>;
}
