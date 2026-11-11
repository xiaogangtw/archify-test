import {ApiAssistantLauncher} from './ApiAssistantLauncher';
import { useEffect, useRef, useState } from 'react';
import { useTesting } from './TestingProvider';
import { Panel } from '../../components/Panel';
import { Badge, Button, Field, Input, Notice, cx } from '../../components/ui/controls';
import { loadScripts } from './scriptStorage';
import { loadTree } from './libraryTree';
import { api } from './controlApi';
import type { InlineRun } from './inlineRunModel';
import type { PageId } from '../../types';

interface Batch { id: string; testVersion: string; runs: InlineRun[] }
const labels = { queued: '排隊中', running: '執行中', passed: '成功', failed: '失敗', skipped: '略過', cancelled: '已停止' };
const active = (run: InlineRun) => run.status === 'queued' || run.status === 'running';


export function ScriptExecution({ onEdit, onNavigate, initialScriptId }: {
  initialScriptId?: string; onEdit: (id: string) => void; onNavigate: (page: PageId) => void;
}) {
  const scripts = loadScripts().filter(script=>!script.apiFlow&&script.caseType!=='flow');
  const tree = loadTree();
  const { inlineRuns } = useTesting();
  const [selected, setSelected] = useState<string[]>(initialScriptId ? [initialScriptId] : []);
  const [query, setQuery] = useState('');
  const [batchName,setBatchName]=useState('');
  const [manualCommits,setManualCommits]=useState({frontend:'',bff:'',backend:''});
  const [batch, setBatch] = useState<Batch | null>(null);
  const [batchId, setBatchId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState('');
  const dragged = useRef<string | null>(null);
  const requestId = useRef<string | null>(null);
  const busy = submitting || canceling || !!batch?.runs.some(active);
  const completed = batch?.runs.filter(run => !active(run)).length || 0;
  const categories = [{ id: null, name: '未分類' }, ...tree.folders];
  const search = query.trim().toLocaleLowerCase();

  useEffect(() => {
    if (!batchId) return;
    let alive = true; let pending = false;
    let timer: number | undefined;
    async function refresh() {
      if (pending) return; pending = true;
      try {
        const result = await api<Batch>(`/batches/${batchId}`);
        if (alive) {
          setBatch(result); setError('');
          if (!result.runs.some(active) && timer !== undefined) window.clearInterval(timer);
        }
      } catch (reason) {
        if (alive) { setError(reason instanceof Error ? reason.message : '無法讀取批次進度'); }
      } finally { pending = false; }
    }
    void refresh(); timer = window.setInterval(refresh, 1500);
    return () => { alive = false; if (timer !== undefined) window.clearInterval(timer); };
  }, [batchId]);

  function updateSelection(ids: string[]) { setSelected(ids); requestId.current = null; }
  function toggle(id: string) {
    updateSelection(selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id]);
  }
  function move(id: string, target: number) {
    const next = selected.filter(item => item !== id);
    next.splice(Math.max(0, Math.min(target, next.length)), 0, id);
    updateSelection(next);
  }
  async function start() {
    if (!selected.length || busy) return;
    const chosen = selected.map(id => scripts.find(script => script.id === id));
    if (chosen.some(script => !script)) { setError('有案例已移除，請重新選擇。'); return; }
    const commits=Object.fromEntries(Object.entries(manualCommits).map(([role,value])=>[role,value.trim()]).filter(([,value])=>value));
    if(Object.values(commits).some(value=>! /^[a-fA-F0-9]{40}$/.test(String(value)))){setError('Git commit 請填入完整的 40 碼 SHA，或留空。');return;}
    setSubmitting(true); setError('');
    requestId.current ||= crypto.randomUUID();
    try {
      const result = await api<Batch>('/batches', { method: 'POST', body: JSON.stringify({ requestId: requestId.current,name:batchName.trim(), manualCommits:commits, scripts: chosen.map(script => ({ scriptId: script!.id, scriptVersion: script!.version })) }) });
      setBatch(result); setBatchId(result.id); requestId.current = null;

    } catch (reason) { setError(reason instanceof Error ? reason.message : '無法建立批次'); }
    finally { setSubmitting(false); }
  }
  async function cancel() {
    if (!batch || canceling) return; setCanceling(true);
    try { setBatch(await api<Batch>(`/batches/${batch.id}/cancel`, { method: 'POST', body: '{}' })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '無法停止批次'); }
    finally { setCanceling(false); }
  }

  return <div className="min-w-0 space-y-3 pb-14"><ApiAssistantLauncher onOpenScript={onEdit}/><p className="text-menu text-muted">API 流程請在腳本案例庫執行，或使用 AI 測試助手依序執行單點 API。</p>
    {error && <Notice error>{error}</Notice>}
    <Field label="批次名稱"><Input maxLength={100} disabled={busy} value={batchName} placeholder="推薦填入版本號" onChange={event=>{setBatchName(event.target.value);requestId.current=null;}}/></Field>
    <fieldset className="min-w-0 space-y-2"><legend className="text-body font-medium">Git commit（選填）</legend><div className="grid min-w-0 gap-3 md:grid-cols-3">{([['frontend','前端'],['bff','中間層'],['backend','後端']] as const).map(([role,label])=><Field key={role} label={label+' Git commit'}><Input maxLength={40} disabled={busy} value={manualCommits[role]} placeholder="完整 commit SHA（選填）" onChange={event=>{setManualCommits(current=>({...current,[role]:event.target.value}));requestId.current=null;}}/></Field>)}</div></fieldset>
    {batch && <Panel title={batch.runs.some(active) ? '本次執行進度' : '最近一次批次結果'}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="break-all text-body text-muted">{batch.testVersion}</p><Badge>{completed} / {batch.runs.length} 已結束</Badge></div>
        <ol className="divide-y divide-line">{batch.runs.map((run, index) => <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0"><p className="break-words font-medium">{index + 1}. {run.scriptName}</p>{run.status === 'running' && <p className="mt-1 break-words text-body text-muted">{run.message}</p>}</div>
          <Badge tone={run.status === 'passed' ? 'success' : run.status === 'failed' ? 'danger' : 'neutral'}>{labels[run.status]}</Badge>
        </li>)}</ol>
        <Button onClick={() => onNavigate('runs')}>查看詳細結果</Button>
      </div>
    </Panel>}
    <div className="grid min-w-0 items-stretch gap-3 lg:grid-cols-2">
      <Panel title="選擇案例">
        <Input type="search" aria-label="搜尋案例與分類" placeholder="搜尋案例或分類" value={query} onChange={event => setQuery(event.target.value)} />
        <div className={scripts.length?"mt-3 space-y-3":"hidden"}>{categories.map(category => {
          const items = scripts.filter(script => (tree.scriptFolders[script.id] || null) === category.id && (!search || category.name.toLocaleLowerCase().includes(search) || script.name.toLocaleLowerCase().includes(search)));
          if (!items.length) return null;
          const selectable = items.filter(script => !inlineRuns[script.id] || !active(inlineRuns[script.id]));
          const allSelected = selectable.length > 0 && selectable.every(script => selected.includes(script.id));
          return <section key={category.id || 'root'} className="space-y-2">
            <div className="flex items-center justify-between gap-3"><h3 className="text-body font-bold">{category.name}</h3><Button size="compact" variant="ghost" disabled={busy || !selectable.length} onClick={() => updateSelection(allSelected ? selected.filter(id => !selectable.some(script => script.id === id)) : [...selected, ...selectable.filter(script => !selected.includes(script.id)).map(script => script.id)])}>{allSelected ? '取消全選' : '全選'}</Button></div>
            <ul className="divide-y divide-line">{items.map(script => {
              const unavailable = !!inlineRuns[script.id] && active(inlineRuns[script.id]);
              return <li key={script.id}><label className={cx('flex min-h-11 items-center gap-3 rounded-lg px-2 py-3', busy || unavailable ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-canvas', selected.includes(script.id) && 'bg-brand-soft')}>
                <input type="checkbox" className="h-5 w-5 shrink-0 accent-brand" disabled={busy || unavailable} checked={selected.includes(script.id)} onChange={() => toggle(script.id)} />
                <span className="min-w-0 flex-1 break-words text-body">{script.name}</span>{unavailable&&<span className="shrink-0 text-body text-muted">執行中</span>}
              </label></li>;
            })}</ul>
          </section>;
        })}</div>
        {!scripts.length && <Button className="mt-3" onClick={() => onNavigate('journeys')}>新增案例</Button>}
        {scripts.length > 0 && search && !scripts.some(script => script.name.toLocaleLowerCase().includes(search) || categories.find(category => category.id === (tree.scriptFolders[script.id] || null))?.name.toLocaleLowerCase().includes(search)) && <p className="mt-5 text-body text-muted">沒有符合的案例</p>}
      </Panel>
      <Panel title={`執行順序 · ${selected.length} 個案例`}>
        <p id="batch-order-help" className="sr-only">拖曳整列調整順序；鍵盤聚焦案例後按 Alt 加上下方向鍵排序。</p>
        {!selected.length ? <p className="py-3 text-menu text-muted">選擇要一起執行的案例後，這裡會顯示順序。</p> : <ol className="divide-y divide-line">{selected.map((id, index) => {
          const script = scripts.find(item => item.id === id);
          if (!script) return null;
          return <li key={id} draggable={!busy} tabIndex={busy ? -1 : 0} aria-label={`第 ${index + 1} 個案例：${script.name}`} aria-describedby="batch-order-help" onKeyDown={event => {
            if (busy || event.target !== event.currentTarget || !event.altKey) return;
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault(); move(id, index + (event.key === 'ArrowUp' ? -1 : 1));
            }
          }} onDragStart={event => { dragged.current = id; event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { dragged.current = null; }} onDragOver={event => { if (!busy && dragged.current) event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (!busy && dragged.current) move(dragged.current, index); dragged.current = null; }} className={cx('space-y-3 rounded-lg px-2 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand', !busy && 'cursor-grab hover:bg-canvas active:cursor-grabbing')}>
            <div className="flex items-start gap-3"><span className="text-body text-muted">{index + 1}.</span><p className="min-w-0 flex-1 break-words font-medium">{script.name}</p></div>
            <div className="flex flex-wrap gap-2"><Button size="compact" disabled={busy} onClick={() => onEdit(id)}>編輯</Button><Button size="compact" disabled={busy} aria-label={`移除 ${script.name}`} onClick={() => toggle(id)}>移除</Button></div>
          </li>;
        })}</ol>}
      </Panel>
    </div>
    <div role="region" aria-label="批次執行操作" className="sticky bottom-14 z-10 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3">
      <div className="space-y-1"><p className="font-bold">{batch?.runs.some(active) ? `執行進度 ${completed} / ${batch.runs.length}` : `已選 ${selected.length} 個案例`}</p><p className="text-body text-muted">依順序執行 · 共用測試版本</p></div>
      <div className="flex flex-wrap gap-3"><Button disabled={busy || !selected.length} onClick={() => updateSelection([])}>清空選擇</Button>{batch?.runs.some(active) ? <Button variant="danger" disabled={canceling} onClick={cancel}>{canceling ? '停止中…' : '停止批次'}</Button> : <Button variant="primary" disabled={busy || !selected.length} aria-busy={submitting} onClick={start}>{submitting ? '排隊中…' : '執行測試'}</Button>}</div>
    </div>
  </div>;
}
