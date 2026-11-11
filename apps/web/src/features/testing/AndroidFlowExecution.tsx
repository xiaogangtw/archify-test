import {AppiumRetry} from './AppiumRetry';
import {loadTree} from './libraryTree';
import {ToolIcon} from '../../components/ui/ToolIcon';
import {appiumExample} from './appiumFlow';
import { ScriptWorkspace } from './ScriptWorkspace';
import { Modal } from '../../components/ui/Modal';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FlowNotifications, type FlowNotification } from './FlowNotifications';
import { FlowResultToast } from './FlowResultToast';
import { Button, Notice } from '../../components/ui/controls';
import { Dropdown } from '../../components/ui/Dropdown';
import { api, deleteScript } from './controlApi';
import { useTesting } from './TestingProvider';
import { AndroidRunNotStarted, startBatchCase, waitForBatchCase } from './androidBatchStart';
import type { ScriptDraft } from './scriptModel';
import { isDualPhoneFlow } from './appiumFlow';
import { unavailableAndroidStatus, updateAndroidStatus } from './androidStatus';
type Device = { serial: string; booted: boolean; canControl: boolean; profileId?: string };
export type AndroidFlowRun = { executionOrigin?: 'appium' | 'e2e-batch'; scriptId?: string; dependencies?: {scriptId:string;scriptVersion:number;name:string;source:string}[]; trace?: {path:string;name:string;action:string;phase:"before"|"main"|"after";actor?:"sender"|"receiver";status:"running"|"passed"|"failed"|"skipped";message?:string;durationMs?:number}[];batchId?:string;batchName?:string;manualCommits?:Partial<Record<'frontend'|'bff'|'backend',string>>;id: string; name: string; testVersion?: string; createdAt?: string; finishedAt?: string; source?: string; serial?: string; bindings?: { sender: string; receiver: string }; scriptVersion: number; status: 'queued'|'running'|'passed'|'failed'; message: string; completed: number; steps: { name: string; status: string }[] };
export function AndroidFlowExecution({ projectId, cases = [], executionOrigin='appium', batchMetadata={}, expanded=false, onEditingChange, onDeviceChange }: { projectId: string; cases?: ScriptDraft[];executionOrigin?: 'appium'|'e2e-batch';expanded?:boolean;batchMetadata?:{name?:string;manualCommits?:Partial<Record<'frontend'|'bff'|'backend',string>>}; deviceSerial?: string; onEditingChange?:(editing:boolean)=>void; onDeviceChange?:(serial:string)=>void }) {
  const { refreshData } = useTesting();
  const [editedCases,setEditedCases]=useState<Record<string,ScriptDraft>>({});
  const [deletedIds,setDeletedIds]=useState<string[]>([]);
  const [deleteTarget,setDeleteTarget]=useState<ScriptDraft|null>(null),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState('');
  const deletePending=useRef(false), deleteTrigger=useRef<HTMLButtonElement|null>(null);
  const [editing,setEditing]=useState<ScriptDraft|null>(null),[editorDirty,setEditorDirty]=useState(false),[confirmReturn,setConfirmReturn]=useState(false);
  useEffect(()=>{onEditingChange?.(!!editing);},[!!editing,onEditingChange]);
  const [lastResult,setLastResult]=useState<{script:ScriptDraft;run:AndroidFlowRun}|null>(null);
  const [notifications, setNotifications] = useState<FlowNotification[]>([]);
  const [pendingNotification, setPendingNotification] = useState<FlowNotification | null>(null);
  const [toast, setToast] = useState<{ status: 'passed' | 'failed' | 'unknown'; title: string; message: string; script?: ScriptDraft } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 7000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const flows = [...new Map([...cases,...Object.values(editedCases)].map(row=>[row.id,row])).values()].filter(row => row.caseType === 'flow' && row.version > 0 && !deletedIds.includes(row.id));
  const tree=loadTree();
  const categories=[{id:null,name:'未分類'},...tree.folders.filter(folder=>folder.scope==='flow'||flows.some(row=>tree.scriptFolders[row.id]===folder.id))];
  const [selected, setSelected] = useState<string[]>([]), [chosenSerial, setSerial] = useState('');
  const [continueOnFailure, setContinueOnFailure] = useState(false);
  const orderedCases = selected.map(id => flows.find(row => row.id === id)).filter((row): row is ScriptDraft => !!row);
  function moveCase(id: string, offset: number) {
    if (busy) return;
    setSelected(current => {
      const index = current.indexOf(id), next = index + offset;
      if (index < 0 || next < 0 || next >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
      return reordered;
    });
  }
  const serial = chosenSerial;

  const [editorActor,setEditorActor]=useState<'sender'|'receiver'>('sender');
  const [receiver, setReceiver] = useState('');
  const editorSerial=editorActor==='receiver'&&receiver?receiver:serial;
  useEffect(()=>{onDeviceChange?.(editing?editorSerial:serial);},[editing,editorSerial,serial,onDeviceChange]);
  const dual = selected.some(id => isDualPhoneFlow(flows.find(row => row.id === id)?.source || ''));
  const [environment, setEnvironment] = useState<{ devices: Device[]; profiles?: { id: string; name: string }[]; appium: { ready: boolean }; capabilities?: { appiumRuns?: boolean; multiDeviceRuns?: boolean; conditionalFlows?: boolean; batchSessionReuse?: boolean } } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [batchStatus, setBatchStatus] = useState('');
  const alive = useRef(true);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function dismiss(event: PointerEvent) { if (!menu.current?.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } }
    if (open) { document.addEventListener('pointerdown', dismiss); document.addEventListener('keydown', escape); }
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [open]);
  useEffect(() => {
    alive.current = true; let refreshing = false;
    async function refresh() {
      if (refreshing) return; refreshing = true;
      try { const value = await api<NonNullable<typeof environment> & {connected?:boolean}>('/android/status'); if (alive.current) { setEnvironment(current => updateAndroidStatus(current, value)); if(value.connected!==false) setSerial(current => value.devices.some(d => d.serial === current) ? current : value.devices.find(d => d.booted && d.canControl)?.serial || ''); } }
      catch { if (alive.current) setEnvironment(unavailableAndroidStatus); } finally { refreshing = false; }
    }
    void refresh(); const timer = window.setInterval(refresh, 3000);
    return () => { alive.current = false; clearInterval(timer); };
  }, []);
  async function execute(ids=selected) {
    if (busy || deleting || !serial || !ids.length || dual && (!receiver || receiver === serial || !environment?.capabilities?.multiDeviceRuns)) return;
    if(Object.values(batchMetadata.manualCommits||{}).some(value=>value&&!/^[a-fA-F0-9]{40}$/.test(value))){setError('Git commit 請填入完整的 40 碼 SHA，或留空。');return;}
    const batchId=crypto.randomUUID(),batchName=batchMetadata.name?.trim()||'',manualCommits=Object.fromEntries(Object.entries(batchMetadata.manualCommits||{}).filter(([,value])=>value));
    setBusy(true); setError(''); setToast(null);
    const snapshots = ids.map(id => flows.find(row => row.id === id)).filter((row): row is ScriptDraft => !!row);
    let completed = 0;
    let failed = 0;
    let nextName = '';
    let result: { script: ScriptDraft; run: AndroidFlowRun } | null = null;
    try {
      for (const [index, script] of snapshots.entries()) {
        if (!alive.current) break;
        nextName = script.name;
        setBatchStatus(`正在準備「${script.name}」。`);
        const isDual = isDualPhoneFlow(script.source);
        const body = {executionOrigin,batchId,batchName,manualCommits, ...(environment?.capabilities?.batchSessionReuse && index < snapshots.length - 1 ? {batchContinue:true} : {}), scriptId: script.id, scriptVersion: script.version, ...(isDual ? { bindings: { sender: serial, receiver } } : { serial }), requestId: crypto.randomUUID()};
        let run = await startBatchCase<AndroidFlowRun>({api, body, batchId, serials: isDual ? [serial, receiver] : [serial], waitBefore: completed > 0, active: () => alive.current, onWaiting: () => { if (alive.current) setBatchStatus(`等待手機準備「${script.name}」。`); }});
        if (alive.current) setBatchStatus(`正在執行「${script.name}」。`);
        run = await waitForBatchCase({api, run, active: () => alive.current, onWaiting: () => {
          if (alive.current) setBatchStatus(`正在重新確認「${script.name}」的執行結果，不會重複執行。`);
        }});
        if(alive.current) {
          result = {script,run}; setLastResult(result); completed++;
          const notification = result;
          setNotifications(current => [notification, ...current.filter(item => item.run.id !== run.id)].slice(0,50));
        }
        if (run.status === 'failed') failed++;
        if (run.status !== 'passed' && (run.status !== 'failed' || !continueOnFailure)) break;
      }
      if (alive.current && result) {
        const status = failed ? 'failed' : result.run.status === 'passed' ? 'passed' : result.run.status === 'failed' ? 'failed' : 'unknown';
        setToast(snapshots.length > 1
          ? { status, title: status === 'passed' ? '批次測試通過' : status === 'failed' ? completed < snapshots.length ? '批次測試失敗，已停止' : '批次測試完成，含失敗案例' : '批次測試結果未確認', message: `已執行 ${completed} / ${snapshots.length} 個案例，可在通知查看各案例結果。` }
          : { status, title: `${result.script.name} · ${status === 'passed' ? '通過' : status === 'failed' ? '失敗' : '結果未確認'}`, message: result.run.message, script: result.script });
      }
    } catch (reason) {
      if (alive.current) {
        const detail = reason instanceof Error ? reason.message : '請至執行紀錄確認，請勿重複送出。';
        setError(`批次已中斷，已完成 ${completed} / ${snapshots.length} 個案例。「${nextName}」${reason instanceof AndroidRunNotStarted ? '尚未開始' : '結果尚未確認'}：${detail}`);
        setToast(reason instanceof AndroidRunNotStarted
        ? { status: 'failed', title: '案例尚未開始', message: `「${nextName}」尚未開始：${reason.message}${completed ? ` 已完成 ${completed} / ${snapshots.length} 個案例。` : ''}` }
        : { status: 'unknown', title: '執行結果未確認', message: `${reason instanceof Error ? reason.message : '請勿重複送出。'} 請至執行紀錄確認。` });
      }
    }
    finally { if (alive.current) { setBusy(false); setBatchStatus(''); } }
  }
  async function removeCase() {
    if (!deleteTarget || busy || deletePending.current) return;
    const target = deleteTarget;
    deletePending.current = true; setDeleting(true); setDeleteError('');
    try {
      await deleteScript(target);
      setDeletedIds(current => [...current,target.id]);
      setSelected(current => current.filter(id => id !== target.id));
      setEditedCases(current => { const next = {...current}; delete next[target.id]; return next; });
      setDeleteTarget(null);
      try { await refreshData(); }
      catch { setError('案例已刪除，但清單同步失敗，請重新整理。'); }
      requestAnimationFrame(() => trigger.current?.focus());
    } catch (reason) { setDeleteError(reason instanceof Error ? reason.message : '刪除失敗，請重試。'); }
    finally { deletePending.current = false; setDeleting(false); }
  }
  function edit(script:ScriptDraft){setOpen(false);setToast(null);setEditorDirty(false);setEditing(script);}
  function openNotification(item: FlowNotification) {
    if (editing?.id === item.script.id) { setLastResult(item); return; }
    if (editing && editorDirty) { setPendingNotification(item); setConfirmReturn(true); return; }
    setLastResult(item);
    edit(flows.find(script => script.id === item.script.id) || item.script);
  }
  return <div ref={menu} className="min-w-0 space-y-3">
    <div hidden={!!editing} className={editing ? 'hidden' : 'relative flex items-center justify-between gap-3'}>
      {!expanded && !editing && <Button size="compact" ref={trigger} aria-expanded={open} aria-controls="android-flow-picker" onClick={() => setOpen(value => !value)}>選擇 Flow Case{selected.length ? ` · 已選 ${selected.length}` : ''}</Button>}
      <FlowNotifications items={notifications} disabled={busy} deletedIds={deletedIds} onEdit={openNotification} onOpen={() => setOpen(false)} />
    </div>
    {editing&&<section aria-label="編輯 Flow Case" className="min-w-0 space-y-3">

      {lastResult?.script.id===editing.id&&lastResult.run.status==='failed'&&<Notice error>{lastResult.run.message}</Notice>}
      <ScriptWorkspace onBack={()=>editorDirty?setConfirmReturn(true):setEditing(null)} headerDetails={<details className="min-w-0 border-b border-line pb-3"><summary className="min-h-8 cursor-pointer rounded-lg py-1 text-menu text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">手機配對 · A {environment?.profiles?.find(p=>p.id===environment.devices.find(d=>d.serial===serial)?.profileId)?.name||serial||'未選擇'} · B {receiver?(environment?.profiles?.find(p=>p.id===environment.devices.find(d=>d.serial===receiver)?.profileId)?.name||receiver):'未配對'}</summary><div className="pt-3"><div className="flex flex-wrap items-end gap-3" aria-label="編輯手機配對">
        <div className="min-w-0 flex-1 space-y-2"><p className="text-menu text-muted">A 發送者手機</p><Dropdown label="編輯發送者手機" value={serial} options={environment?.devices.filter(d=>d.booted&&d.canControl).map(d=>({value:d.serial,label:environment.profiles?.find(p=>p.id===d.profileId)?.name||d.serial}))||[]} onChange={value=>{setSerial(value);if(value===receiver){setReceiver('');setEditorActor('sender');}}}/></div>
        <div className="min-w-0 flex-1 space-y-2"><p className="text-menu text-muted">B 接收者手機</p><Dropdown label="編輯接收者手機" value={receiver} options={[{value:'',label:'未配對'},...(environment?.devices.filter(d=>d.booted&&d.canControl&&d.serial!==serial).map(d=>({value:d.serial,label:environment.profiles?.find(p=>p.id===d.profileId)?.name||d.serial}))||[])]} onChange={value=>{setReceiver(value);if(!value)setEditorActor('sender');}}/></div>
        <Button className={editorActor==='sender'?'bg-canvas border-line-strong':undefined} aria-pressed={editorActor==='sender'} onClick={()=>setEditorActor('sender')}>查看 A</Button><Button className={editorActor==='receiver'?'bg-canvas border-line-strong':undefined} disabled={!receiver} aria-pressed={editorActor==='receiver'} onClick={()=>setEditorActor('receiver')}>查看 B</Button>
      </div></div></details>} key={editing.id} scriptId={editing.id} initialScript={editing} flowOnly deviceSerial={editorSerial} deviceBindings={receiver&&receiver!==serial?{sender:serial,receiver}:undefined} deviceActor={receiver?editorActor:undefined} onDirtyChange={setEditorDirty} executionContext={lastResult?.script.id===editing.id?JSON.stringify(lastResult.run):undefined} onSaved={script=>{setEditedCases(current=>({...current,[script.id]:script}));setSelected(current=>current.includes(script.id)?current:[...current,script.id]);setEditorDirty(false);setEditing(null);}}/>
    </section>}
    <div hidden={!!editing} className={expanded || open ? '' : '!mt-0'}>
    {batchStatus && <p role="status" className="text-menu text-muted">{batchStatus}</p>}
    <div className="relative min-w-0">
    <div id="android-flow-picker" hidden={!expanded&&!open} className={expanded?"w-full space-y-3 rounded-xl border border-line bg-surface p-4 text-menu":"absolute left-0 top-full z-20 mt-2 w-full overflow-hidden rounded-xl border border-line bg-surface p-3 text-menu sm:w-96"}>
    <div className={expanded ? 'space-y-4' : 'flex max-h-80 flex-col gap-3'}>
    <div className={expanded ? 'space-y-4' : 'min-h-0 flex-1 space-y-4 overflow-y-auto pr-1'}>
    {!environment?.capabilities?.appiumRuns && <Notice>執行服務尚未更新 Appium 功能。</Notice>}
    {environment?.capabilities?.appiumRuns && !environment.capabilities.conditionalFlows && <Notice>條件流程尚未確認可用。請更新服務並重新啟動 Android 執行器。</Notice>}
    {dual && !environment?.capabilities?.multiDeviceRuns && <Notice>雙機執行服務尚未就緒，請部署新版 API 並重新啟動 Android 執行器。</Notice>}
    <div aria-busy={busy} className="flex flex-col gap-3 border-b border-line pb-3">
      <div className="min-w-0 flex-1 space-y-2"><p className="text-menu text-muted">{dual ? '發送者手機' : '執行手機'}</p><Dropdown label={dual ? '發送者手機' : '執行手機'} value={serial} disabled={busy} options={environment?.devices.filter(d => d.booted && (d.canControl || busy && d.serial === serial)).map(d => ({ value:d.serial, label:environment.profiles?.find(p => p.id === d.profileId)?.name || d.serial })) || []} onChange={value => { setSerial(value); if (receiver === value) setReceiver(''); }} /></div>
      {dual && <div className="min-w-0 flex-1 space-y-2"><p className="text-menu text-muted">接收者手機</p><Dropdown label="接收者手機" value={receiver} disabled={busy} options={[{value:'',label:'請選擇接收者手機'},...(environment?.devices.filter(d => d.serial !== serial && d.booted && (d.canControl || busy && d.serial === receiver)).map(d => ({ value:d.serial, label:environment.profiles?.find(p => p.id === d.profileId)?.name || d.serial })) || [])]} onChange={setReceiver} /></div>}
    </div>
    <section aria-label="可執行 Flow Case" className="space-y-2">
      <div className="flex items-center justify-between gap-2"><h3 className="text-body font-medium">案例</h3>{!expanded&&<Button size="compact" aria-label="新增案例" title="新增案例" disabled={busy} onClick={()=>edit({id:crypto.randomUUID(),name:'',source:appiumExample,caseType:'flow',version:0,messages:[]})}><ToolIcon name="plus"/></Button>}</div>
      {!!flows.length && <label className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 font-medium hover:bg-canvas">
        <input type="checkbox" aria-label="全選 Flow Case" disabled={busy} checked={flows.every(row => selected.includes(row.id))} ref={input => { if (input) input.indeterminate = selected.length > 0 && !flows.every(row => selected.includes(row.id)); }} onChange={event => setSelected(event.target.checked ? flows.map(row => row.id) : [])} className="h-4 w-4 shrink-0 accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />全選
      </label>}
      {flows.length ? expanded ? <div className="space-y-4">{categories.map(category=>{
       const items=flows.filter(row=>(tree.scriptFolders[row.id]||null)===category.id);
       const allSelected=items.length>0&&items.every(row=>selected.includes(row.id));
       return <section key={category.id||'root'} aria-label={category.name} className="space-y-2"><div className="flex items-center justify-between gap-3"><h4 className="break-words text-body font-medium">{category.name}</h4><Button size="compact" variant="ghost" aria-label={(allSelected?'取消全選 ':'全選 ')+category.name} disabled={busy||!items.length} onClick={()=>setSelected(current=>allSelected?current.filter(id=>!items.some(row=>row.id===id)):[...current,...items.filter(row=>!current.includes(row.id)).map(row=>row.id)])}>{allSelected?'取消全選':'全選'}</Button></div><ul className="divide-y divide-line">{items.map(row => <li key={row.id} className="flex min-w-0 items-center gap-3 py-1.5"><label className="flex min-h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-canvas"><input type="checkbox" disabled={busy} checked={selected.includes(row.id)} onChange={event => setSelected(current => event.target.checked ? [...current,row.id] : current.filter(id => id !== row.id))} className="h-4 w-4 shrink-0 accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" /><span className="break-words">{row.name}</span></label>{!expanded&&<div className="flex shrink-0 items-center gap-1"><Button size="compact" variant="ghost" disabled={busy || deleting} aria-label={'編輯案例 '+row.name} title={'編輯案例 '+row.name} onClick={()=>edit(row)}><ToolIcon name="rename" /></Button><Button size="compact" variant="danger" disabled={busy || deleting} aria-label={'刪除案例 '+row.name} title={'刪除案例 '+row.name} onClick={event=>{deleteTrigger.current=event.currentTarget;setDeleteError('');setDeleteTarget(row);}}><ToolIcon name="trash" /></Button></div>}</li>)}</ul>{!items.length&&<p className="text-menu text-muted">此分類尚無案例。</p>}</section>;
      })}</div> : <ul className="divide-y divide-line">{flows.map(row => <li key={row.id} className="flex min-w-0 items-center gap-3 py-1.5"><label className="flex min-h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-canvas"><input type="checkbox" disabled={busy} checked={selected.includes(row.id)} onChange={event => setSelected(current => event.target.checked ? [...current,row.id] : current.filter(id => id !== row.id))} className="h-4 w-4 shrink-0 accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" /><span className="break-words">{row.name}</span></label>{!expanded&&<div className="flex shrink-0 items-center gap-1"><Button size="compact" variant="ghost" disabled={busy || deleting} aria-label={'編輯案例 '+row.name} title={'編輯案例 '+row.name} onClick={()=>edit(row)}><ToolIcon name="rename" /></Button><Button size="compact" variant="danger" disabled={busy || deleting} aria-label={'刪除案例 '+row.name} title={'刪除案例 '+row.name} onClick={event=>{deleteTrigger.current=event.currentTarget;setDeleteError('');setDeleteTarget(row);}}><ToolIcon name="trash" /></Button></div>}</li>)}</ul> : <p className="text-muted">尚無已儲存的 Flow Case。</p>}
    </section>
    {!!orderedCases.length && <section aria-label="執行順序" className="space-y-2">
      <h3 className="text-body font-medium">執行順序</h3>
      <ol className="divide-y divide-line">{orderedCases.map((script, index) => <li key={script.id} className="flex min-w-0 flex-wrap items-center gap-2 py-2">
        <span className="text-menu tabular-nums text-muted">{index + 1}.</span>
        <span className="min-w-0 flex-1 break-words text-menu">{script.name}</span>
        <div className="flex shrink-0 gap-1">
          <Button size="compact" aria-label={`上移 ${script.name}`} disabled={busy || index === 0} onClick={() => moveCase(script.id, -1)}>上移</Button>
          <Button size="compact" aria-label={`下移 ${script.name}`} disabled={busy || index === orderedCases.length - 1} onClick={() => moveCase(script.id, 1)}>下移</Button>
        </div>
      </li>)}</ol>
    </section>}
    </div>
    <div className="shrink-0 space-y-2 border-t border-line bg-surface pt-3">
      {orderedCases.length > 1 && <label className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg text-menu text-muted"><input type="checkbox" checked={continueOnFailure} disabled={busy} onChange={event => setContinueOnFailure(event.target.checked)} className="h-4 w-4 shrink-0 accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />失敗後繼續其他案例</label>}
      <div className="flex items-center justify-between gap-2 text-menu text-muted"><span>已選 {selected.length} 個案例</span><span className="inline-flex flex-wrap items-center gap-2">Appium {environment?.appium.ready ? '已就緒' : '尚未就緒'}<AppiumRetry disabled={busy||!environment} onReady={async()=>{const value=await api<NonNullable<typeof environment>>('/android/status');if(alive.current)setEnvironment(value);}}/></span></div>
      <Button size="compact" className="w-full" variant="primary" disabled={busy || !selected.length || !environment?.devices.some(d => d.serial === serial && d.booted && d.canControl) || !environment?.appium.ready || !environment.capabilities?.appiumRuns || dual && (!receiver || receiver === serial || !environment.capabilities?.multiDeviceRuns)} onClick={() => { setOpen(false); void execute(); }}>{busy ? '執行中' : selected.length > 1 ? `批次執行 ${selected.length} 個案例` : '執行所選案例'}</Button>
    </div>
    </div>
    </div>
    {error && <Notice error>{error}</Notice>}
    </div>
    </div>
    <Modal compact open={confirmReturn} title="尚有未儲存修改" onClose={()=>{setConfirmReturn(false);setPendingNotification(null);}}>
      <p>{pendingNotification ? '切換案例會放棄目前的草稿與 AI 修改建議。' : '返回測試會放棄目前的草稿與 AI 修改建議。'}</p>
      <div className="mt-3 flex flex-wrap gap-2"><Button onClick={()=>{setConfirmReturn(false);setPendingNotification(null);}}>繼續編輯</Button><Button variant="danger" onClick={()=>{setConfirmReturn(false);setEditorDirty(false);if(pendingNotification){setLastResult(pendingNotification);edit(flows.find(script=>script.id===pendingNotification.script.id)||pendingNotification.script);setPendingNotification(null);}else setEditing(null);}}>{pendingNotification ? '放棄修改並切換案例' : '放棄修改並返回測試'}</Button></div>
    </Modal>
    <Modal compact open={!!deleteTarget} title="刪除案例" onClose={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(''); requestAnimationFrame(() => deleteTrigger.current?.focus()); } }}>
      <p className="break-words">確定從案例庫刪除「{deleteTarget?.name}」？腳本版本與過去執行紀錄會保留。</p>
      {deleteError && <Notice error>{deleteError}</Notice>}
      <div className="flex flex-wrap gap-2"><Button autoFocus disabled={deleting} onClick={() => { setDeleteTarget(null); setDeleteError(''); requestAnimationFrame(() => deleteTrigger.current?.focus()); }}>取消</Button><Button variant="danger" disabled={deleting} onClick={() => void removeCase()}>{deleting ? '刪除中' : '刪除案例'}</Button></div>
    </Modal>
    {toast && createPortal(<FlowResultToast status={toast.status} title={toast.title} message={toast.message} onClose={() => setToast(null)} />, document.body)}
  </div>;
}
