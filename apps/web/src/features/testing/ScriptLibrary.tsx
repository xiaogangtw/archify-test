import {downloadCases} from './caseExport';
import type {ScriptDraft} from './scriptModel';
import {ToolIcon} from '../../components/ui/ToolIcon';
import {ApiAssistantLauncher} from './ApiAssistantLauncher';
import { deleteScript, serverStorage } from './controlApi';
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Button, Field, Input, Notice, cx } from '../../components/ui/controls';
import { Dropdown } from '../../components/ui/Dropdown';
import { loadScripts } from './scriptStorage';
import { useTesting } from './TestingProvider';
import { loadTree, moveItem, treeStorageKey } from './libraryTree';
import type { LibraryTree } from './libraryTree';

export function ScriptLibrary({ onEdit,scope='test',onRun,onDeleted }: { onEdit: (id: string) => void;scope?:'test'|'flow';onRun?:(script:ScriptDraft)=>void;onDeleted?:(id:string)=>void }) {
  const { inlineRuns, startInlineRun, cancelInlineRun, runError, submitting } = useTesting();
  const [tree, setTree] = useState(loadTree);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<{ id: string | null } | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [renaming, setRenaming] = useState<{id:string;name:string}|null>(null);
  const renameValue = useRef<{id:string;name:string}|null>(null);
  const renameInput = useRef<HTMLInputElement>(null);
  const renameSaving = useRef(false);
  const [savingRename, setSavingRename] = useState(false);
  function editCategory(id:string,name:string) {
    if(renameSaving.current||renameValue.current)return;
    renameValue.current={id,name};setRenaming({id,name});setError('');
  }
  function cancelRename(restoreFocus=false) {
    const id=renameValue.current?.id;renameValue.current=null;setRenaming(null);setError('');
    if(restoreFocus)requestAnimationFrame(()=>[...document.querySelectorAll<HTMLButtonElement>('[data-folder-name]')].find(item=>item.dataset.folderName===id)?.focus());
  }
  async function renameCategory(restoreFocus=false) {
    const editing=renameValue.current;
    if(!editing||renameSaving.current)return;
    const name=editing.name.trim();
    const invalid=!name?'請輸入分類標題。':name==='未分類'?'「未分類」是保留的分類名稱。':tree.folders.some(folder=>folder.id!==editing.id&&folder.name.toLocaleLowerCase()===name.toLocaleLowerCase())?'已經有這個分類標題。':'';
    if(invalid){setError(invalid);requestAnimationFrame(()=>renameInput.current?.focus());return;}
    if(tree.folders.find(folder=>folder.id===editing.id)?.name===name){cancelRename(restoreFocus);return;}
    renameSaving.current=true;setSavingRename(true);
    try {
      if(await persist({...tree,folders:tree.folders.map(folder=>folder.id===editing.id?{...folder,name}:folder)}))cancelRename(restoreFocus);
      else requestAnimationFrame(()=>renameInput.current?.focus());
    } finally {renameSaving.current=false;setSavingRename(false);}
  }
  const [dragging, setDragging] = useState<string | null>(null);
  const draggedId = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null | undefined>(undefined);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState('root');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [savingFolder, setSavingFolder] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const addCaseButton = useRef<HTMLButtonElement | null>(null);

  const [error, setError] = useState('');
  const allScripts=loadScripts();
  const scripts = allScripts.filter(script=>scope==='flow'?script.caseType==='flow':script.caseType!=='flow');
  const categories = [{ id: null, name: '未分類' }, ...tree.folders.filter(folder=>folder.scope?folder.scope===scope:scripts.some(script=>tree.scriptFolders[script.id]===folder.id)||(scope==='test'&&!allScripts.some(script=>tree.scriptFolders[script.id]===folder.id)))];
  const search = query.trim().toLocaleLowerCase();

  async function removeScript() {
    const script = scripts.find(item => item.id === deleteId);
    if (!script || deleting) return;
    setDeleting(true); setError('');
    try {
      await deleteScript(script);onDeleted?.(script.id);
      setDeleteId(null); setMovingId(null);
      requestAnimationFrame(() => addCaseButton.current?.focus());
    } catch (reason) { setError(reason instanceof Error ? reason.message : '刪除失敗，請重試。'); }
    finally { setDeleting(false); }
  }

  async function persist(next: LibraryTree) {
    try {
      await serverStorage.setItem(treeStorageKey, JSON.stringify(next)); setTree(next); setError(''); return true;
    } catch { setError('伺服器無法儲存分類，案例內容沒有變更。'); return false; }
  }
  async function removeCategory() {
    if (renameSaving.current || !deleteFolderId || savingFolder || !tree.folders.some(folder => folder.id === deleteFolderId)) return;
    setSavingFolder(true);
    const next = { folders: tree.folders.filter(folder => folder.id !== deleteFolderId), scriptFolders: Object.fromEntries(Object.entries(tree.scriptFolders).map(([id,folder]) => [id, folder === deleteFolderId ? null : folder])) };
    try { if (await persist(next)) { setDeleteFolderId(null); setMovingId(null); requestAnimationFrame(() => addCaseButton.current?.focus()); } }
    finally { setSavingFolder(false); }
  }
  async function move(id: string, target: string | null) {
    try {
      if (!scripts.some(script => script.id === id)) throw new Error('找不到這個案例。');

      if (await persist(moveItem(tree, { kind: 'script', id }, target))) setMovingId(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '無法移動。'); }
  }
  async function saveCategory() {
    if (!form || renameSaving.current) return;
    const name = categoryName.trim();
    if (!name) { setError('請輸入分類標題。'); return; }
    if (categories.some(category => category.id !== form.id && category.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError('已經有這個分類標題。'); return;
    }
    if (name === '未分類') { setError('「未分類」是保留的分類名稱。'); return; }
    const next = { ...tree, folders: form.id
      ? tree.folders.map(folder => folder.id === form.id ? { ...folder, name } : folder)
      : [...tree.folders, { id: crypto.randomUUID(), name, parentId: null, scope }] };
    if (await persist(next)) { setForm(null); setCategoryName(''); }
  }
  function startDrag(event: DragEvent, id: string) {
    if (form||renaming||savingRename) { event.preventDefault(); return; }
    event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-archify-case', id);
    draggedId.current = id;
    setDragging(id); setMovingId(null);
  }
  function dragOver(event: DragEvent, id: string | null) {
    if (!draggedId.current) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(id);
  }
  function drop(event: DragEvent, id: string | null) {
    event.preventDefault();
    const sourceId = draggedId.current || event.dataTransfer.getData('application/x-archify-case');
    if (sourceId) move(sourceId, id);
    draggedId.current = null;
    setDragging(null); setDropTarget(undefined);
  }
  const visibleCategories = categories.filter(category => !search || category.name.toLocaleLowerCase().includes(search)
    || scripts.some(script => (tree.scriptFolders[script.id] || null) === category.id && script.name.toLocaleLowerCase().includes(search)));

  return <div className="space-y-5">{scope==='test'&&<ApiAssistantLauncher onOpenScript={onEdit}/>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Input className="md:w-80" type="search" aria-label="搜尋案例與分類" placeholder="搜尋案例或分類" value={query} onChange={event => setQuery(event.target.value)} />
      <div className="flex flex-wrap gap-2"><Button disabled={!scripts.length} onClick={()=>downloadCases(scripts,tree)}>匯出案例</Button><Button disabled={!!form||savingRename||!!renaming} onClick={() => { setForm({ id: null }); setCategoryName(''); setError(''); }}>新增分類</Button><Button ref={addCaseButton} variant="primary" onClick={() => onEdit(scope==='flow'?'new-flow':'new')}>新增案例</Button></div>
    </div>
    {(error || runError) && <Notice error>{error || runError}</Notice>}
    {deleteFolderId && <section aria-label="刪除分類確認" aria-busy={savingFolder} className="space-y-3 rounded-xl border border-danger bg-danger-soft p-4" onKeyDown={event => { if(event.key === 'Escape' && !savingFolder) { setDeleteFolderId(null); deleteTrigger.current?.focus(); } }}>
      <h2 className="break-words text-body font-bold">刪除「{tree.folders.find(folder => folder.id === deleteFolderId)?.name}」分類？</h2>
      <p className="text-body">分類中的案例會移回「未分類」，保留案例內容與執行紀錄。</p>
      <div className="flex flex-wrap gap-3"><Button autoFocus disabled={savingFolder} onClick={() => { setDeleteFolderId(null); deleteTrigger.current?.focus(); }}>取消</Button><Button variant="danger" disabled={savingFolder} onClick={() => void removeCategory()}>{savingFolder?'刪除中…':'確認刪除分類'}</Button></div>
    </section>}
    {deleteId && <section aria-labelledby="delete-case-title" aria-busy={deleting} className="space-y-3 rounded-lg border border-danger bg-danger-soft p-4" onKeyDown={event => {
      if (event.key === 'Escape' && !deleting) { setDeleteId(null); deleteTrigger.current?.focus(); }
    }}>
      <h2 id="delete-case-title" className="break-words text-body font-bold">刪除「{scripts.find(item => item.id === deleteId)?.name}」？</h2>
      <p className="text-body">從案例庫移除，保留腳本版本與過去執行結果。</p>
      <div className="flex flex-wrap gap-3"><Button autoFocus disabled={deleting} onClick={() => { setDeleteId(null); deleteTrigger.current?.focus(); }}>取消</Button><Button variant="danger" disabled={deleting} onClick={removeScript}>{deleting ? '刪除中…' : '刪除案例'}</Button></div>
    </section>}
    {form && <form className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-4" onSubmit={event => { event.preventDefault(); saveCategory(); }}>
      <div className="min-w-0 flex-1"><Field label="分類標題"><Input autoFocus required maxLength={100} value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="例如：註冊、登入、搜尋" /></Field></div>
      <Button type="submit">儲存分類</Button><Button onClick={() => setForm(null)}>取消</Button>
    </form>}
    {movingId && <div className="flex flex-wrap items-end gap-3 rounded-lg border border-brand p-4">
      <div className="min-w-0 flex-1"><Dropdown label={`將「${scripts.find(script => script.id === movingId)?.name || '案例'}」移到`} value={moveTarget} options={categories.map(category => ({ value: category.id || 'root', label: category.name }))} onChange={setMoveTarget} /></div>
      <Button onClick={() => move(movingId, moveTarget === 'root' ? null : moveTarget)}>移動</Button><Button onClick={() => setMovingId(null)}>取消</Button>
    </div>}
    {!visibleCategories.length && <p className="py-6 text-body text-muted">沒有符合的案例或分類。</p>}
    {visibleCategories.map(category => {
      const items = scripts.filter(script => (tree.scriptFolders[script.id] || null) === category.id
        && (!search || category.name.toLocaleLowerCase().includes(search) || script.name.toLocaleLowerCase().includes(search)));
      return <section key={category.id || 'root'} aria-label={`${category.name}分類`} onDragOver={event => dragOver(event, category.id)} onDrop={event => drop(event, category.id)}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(undefined); }}
        className={cx('min-w-0 rounded-xl border bg-surface', dropTarget === category.id ? 'border-brand ring-2 ring-brand' : 'border-line')}>
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-line pl-4 pr-3">
          <h2 className="flex min-w-0 flex-1 items-center gap-3 text-body font-bold">{category.id?(renaming?.id===category.id?<Input autoFocus aria-label={`分類名稱 ${category.name}`} aria-invalid={!!error} maxLength={100} disabled={savingRename} value={renaming.name} onFocus={event=>{renameInput.current=event.currentTarget;event.currentTarget.select();}} onChange={event=>{const value={id:category.id!,name:event.target.value};renameValue.current=value;setRenaming(value);setError('');}} onBlur={()=>void renameCategory()} onKeyDown={event=>{if(event.nativeEvent.isComposing)return;if(event.key==='Enter'){event.preventDefault();void renameCategory(true);}else if(event.key==='Escape'){event.preventDefault();cancelRename(true);}}}/>:<button type="button" data-folder-name={category.id} disabled={!!form||savingRename||savingFolder} title="點擊編輯分類名稱" aria-label={`編輯分類名稱 ${category.name}`} className="min-h-8 min-w-0 break-words rounded-lg py-1 text-left hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50" onClick={()=>editCategory(category.id!,category.name)}>{category.name}</button>):<span className="min-w-0 break-words">{category.name}</span>}<span className="shrink-0 text-body font-normal text-muted">{items.length}</span></h2>
          {dragging ? <span className="text-body font-medium text-brand">放到這裡</span> : category.id && <div className="flex shrink-0 gap-2"><Button variant="danger" size="compact" disabled={savingFolder||!!form||savingRename||!!renaming} title={`刪除 ${category.name} 分類`} aria-label={`刪除 ${category.name} 分類`} onClick={event => { deleteTrigger.current=event.currentTarget; setDeleteFolderId(category.id); setError(''); }}><ToolIcon name="trash"/></Button></div>}
        </div>
        <ul className="divide-y divide-line">{items.map(script => {
          const run = inlineRuns[script.id];
          const busy = run?.status === 'running' || run?.status === 'queued';
          const stateText = run ? ({ queued: '排隊中', running: `執行中 ${run.completed}/${run.steps.length}`, passed: '成功', failed: '失敗', skipped: '略過', cancelled: '已停止' })[run.status] : '';
          const rowColor = !run ? 'border-transparent hover:bg-canvas' : ({ queued: 'border-warning bg-warning-soft', running: 'border-warning bg-warning-soft', passed: 'border-success bg-success-soft', failed: 'border-danger bg-danger-soft', skipped: 'border-line bg-canvas', cancelled: 'border-line bg-canvas' })[run.status];
          return <li key={script.id} draggable={!form} tabIndex={form ? -1 : 0} aria-label={`案例 ${script.name}`}
            title={run ? `${run.testVersion} · ${run.message}` : '拖動整列換分類；按 Enter 選分類'}
            onKeyDown={event => { if (event.target === event.currentTarget && !form && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setMovingId(script.id); setMoveTarget(tree.scriptFolders[script.id] || 'root'); } }}
            onDragStart={event => startDrag(event, script.id)} onDragEnd={() => { draggedId.current = null; setDragging(null); setDropTarget(undefined); }}
            className={cx('flex min-h-11 flex-wrap cursor-grab items-center gap-2 sm:flex-nowrap border-y pl-4 pr-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:cursor-grabbing', rowColor)}>
            <div className="flex w-full min-w-0 flex-auto flex-wrap items-center gap-x-4 gap-y-1 text-left sm:w-auto sm:flex-1">
              <span className="flex w-full min-w-0 items-baseline gap-2 text-body sm:w-auto sm:flex-1" title={script.name}>{script.caseCode&&<span className="w-28 shrink-0 whitespace-nowrap tabular-nums text-muted">{script.caseCode}</span>}<span className="min-w-0 truncate">{script.name}</span></span>
              <span className="shrink-0 text-left text-body text-muted">{script.caseType==='flow'?'Flow Case':'Test Case'}</span>
              {run && <span role="status" className="w-full break-words text-body text-muted">{stateText} · {run.message}</span>}
            </div>
            {(scope!=='flow'||onRun)&&<Button variant="ghost" className="shrink-0 cursor-pointer px-3" draggable={false} aria-label={`${busy ? '停止' : '執行'} ${script.name}`} disabled={submitting.includes(script.id)||(script.caseType==='flow'&&!onRun)} title={script.caseType==='flow'?'在目前測試手機執行':busy?'停止執行':script.apiFlow?'執行 API 流程':'在隔離 Runner 執行'} onClick={() => onRun?onRun(script):busy ? cancelInlineRun(script.id) : startInlineRun(script)}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">{busy ? <path d="M6 6h12v12H6z" /> : <path d="M7 4v16l14-8z" />}</svg>
            </Button>}
            <Button variant="ghost" className="shrink-0 cursor-pointer px-3" disabled={busy} draggable={false} aria-label={`編輯 ${script.name}`} onClick={() => onEdit(script.id)}>編輯</Button>
            <Button variant="danger" size="compact" className="shrink-0 cursor-pointer" disabled={busy || deleting || submitting.includes(script.id)} draggable={false} aria-label={`刪除 ${script.name}`} onClick={event => { deleteTrigger.current = event.currentTarget; setDeleteId(script.id); setError(''); }}><ToolIcon name="trash"/></Button>
          </li>;
        })}</ul>
        {!items.length && <div className={cx('m-3 flex min-h-11 items-center justify-center rounded-lg border border-dashed px-4 py-3 text-body', dragging ? 'border-brand bg-brand-soft text-brand' : 'border-line text-muted')}>{dragging ? `放到「${category.name}」` : search ? '沒有符合的案例' : '把案例拖到這裡'}</div>}
      </section>;
    })}
  </div>;
}
