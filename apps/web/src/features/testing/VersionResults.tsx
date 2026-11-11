import {ManualCommitDetails} from './ManualCommitDetails';
import { androidRecord, apiRequestRecord, historyPath, historyType, historyTypeLabels, matchesHistory, type HistoryRecord } from './executionHistoryModel';
import type { AndroidFlowRun } from './AndroidFlowExecution';
import type { ApiRun } from './ApiActivity';
import { useEffect, useRef, useState } from 'react';
import { Panel } from '../../components/Panel';
import { Badge, Button, Disclosure, Notice } from '../../components/ui/controls';
import { Dropdown } from '../../components/ui/Dropdown';
import { api } from './controlApi';
import type { InlineRunStatus } from './inlineRunModel';
import {Modal} from '../../components/ui/Modal';
import {ToolIcon} from '../../components/ui/ToolIcon';
import {type ExecutionRecord} from './executionReportModel';

type RunDetail = HistoryRecord & {
  events: { sequence: number; event: { type: string; title?: string; message?: string; status?: string } }[];
};
const labels: Record<InlineRunStatus, string> = {
  queued: '排隊中', running: '執行中', passed: '成功', failed: '失敗', skipped: '略過', cancelled: '已取消',
};
const roleNames = { frontend: '前端', bff: '中間層', backend: '後端' };
const formatTime = (value: string) => new Date(value).toLocaleString('zh-TW');
const isRunning = (status?: InlineRunStatus) => status === 'queued' || status === 'running';

function ResultDetail({ detail }: { detail: RunDetail }) {
  const events = detail.events.filter(item => item.event.type === 'step-end' || item.event.type === 'error');
  const lastEvent = detail.events.at(-1)?.event;
  const counts = detail.message.match(/^(\d+) tests, (\d+) failures, (\d+) skipped$/);
  const summary = counts ? `共 ${counts[1]} 個測試，失敗 ${counts[2]} 個，略過 ${counts[3]} 個。` : detail.message;
  return <div className="space-y-5 border-t border-line pt-5">
    {summary && <p className="whitespace-pre-wrap break-words text-body">{summary}</p>}
    <div className="grid gap-4 sm:grid-cols-2">
      <div><p className="text-body text-muted">執行環境</p><p className="mt-1 font-medium">{detail.environment === 'isolated-fixture' ? '隔離測試環境' : detail.environment}</p></div>
      <div><p className="text-body text-muted">執行時間</p><p className="mt-1">{detail.startedAt ? formatTime(detail.startedAt) : '尚未開始'}{detail.finishedAt && ` ～ ${formatTime(detail.finishedAt)}`}</p></div>
    </div>
    <section aria-label="執行步驟" className="space-y-3">
      <h4 className="text-body font-bold">執行步驟</h4>
      {!events.length && <p className="text-body text-muted">{isRunning(detail.status) ? '等待執行步驟回報' : '沒有步驟紀錄'}</p>}
      <ol className="space-y-3">{events.map((item, index) => <li key={item.sequence} className="space-y-2 rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="min-w-0 break-words font-medium">{index + 1}. {item.event.title || '執行錯誤'}</p><Badge tone={item.event.status === 'passed' ? 'success' : item.event.status==='failed'||item.event.type==='error' ? 'danger':'neutral'}>{labels[item.event.status as InlineRunStatus]||(item.event.type==='error'?'失敗':'未確認')}</Badge></div>
        {item.event.message && <pre className={`overflow-x-auto whitespace-pre-wrap break-words font-mono text-body ${item.event.status === 'failed' || item.event.type === 'error' ? 'text-danger' : 'text-muted'}`}>{item.event.message}</pre>}
      </li>)}</ol>
      {isRunning(detail.status) && lastEvent?.type === 'step-start' && <p role="status" className="text-body font-medium">執行中：{lastEvent.title}</p>}
    </section>
    {detail.android?.batchName&&<p className="break-words text-menu text-muted">批次名稱：{detail.android.batchName}</p>}
    <ManualCommitDetails commits={detail.manualCommits}/>
    {detail.android && <p className="break-words text-menu text-muted">{detail.android.bindings ? `發送者：${detail.android.bindings.sender} · 接收者：${detail.android.bindings.receiver}` : `執行手機：${detail.android.serial || '未記錄'}`}</p>}
    {detail.apiRun?.body.result && <Disclosure title="API 回應"><p>HTTP {detail.apiRun.body.result.status} · {detail.apiRun.body.result.durationMs} ms</p><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-menu">{detail.apiRun.body.result.body}</pre></Disclosure>}
    <p className="break-all text-menu text-muted">執行編號：{detail.id}</p>
    <Disclosure title="版本與來源">
      <dl className="space-y-3">
        <div><dt className="font-medium text-ink">測試版本</dt><dd className="break-all">{detail.testVersion || '未記錄'}</dd></div>
        <div><dt className="font-medium text-ink">腳本版本</dt><dd>{detail.scriptVersion>0 ? '第 '+detail.scriptVersion+' 版' : '未記錄'}</dd></div>
        <div><dt className="font-medium text-ink">腳本內容指紋（SHA256）</dt><dd className="break-all font-mono">{detail.sourceHash || '未記錄'}</dd></div>
      </dl>
      {!detail.repositories.length && detail.recordKind !== 'android' && detail.recordKind !== 'api-request' && <p>{detail.recordKind==='workflow'?'API 流程執行紀錄；未核對 Git 與實際部署版本。':detail.sourceOrigin==='upload'?'本機檔案快照；未驗證 Git 版本。執行環境仍為隔離測試服務。':'此筆使用隔離測試服務，未連接 Git 倉庫。'}</p>}
      {detail.sourceOrigin==='upload' && <p className="break-all font-mono">來源內容指紋：{detail.sourceContentHash}</p>}
      {detail.repositories.map(repo => <div key={repo.role} className="space-y-2 rounded-lg border border-line p-4">
        <p className="font-bold text-ink">{roleNames[repo.role]}</p><p className="break-all font-mono">{repo.commitSha}</p><p>QA tag：{repo.qaTag} · {repo.tagMatchesRelease ? '與 release 相同' : '與 release 不同'}</p>
      </div>)}
      {detail.repositories.length > 0 && !detail.deploymentVerified && <p>尚未核對 dev 實際部署版本。</p>}
    </Disclosure>
    {detail.source&&<Disclosure title="本次執行的 TypeScript"><pre className="max-h-96 overflow-auto rounded-lg bg-canvas p-4 font-mono text-body text-ink">{detail.source}</pre></Disclosure>}
  </div>;
}

export function VersionResults({ projectId }: { projectId?: string } = {}) {
  const [runs, setRuns] = useState<HistoryRecord[]>([]);
  const [deleting,setDeleting]=useState<{record?:HistoryRecord;version:string}|null>(null);
  const [deleteBusy,setDeleteBusy]=useState(false),[deleteError,setDeleteError]=useState('');
  const listGeneration=useRef(0);
  const [kind, setKind] = useState('all');
  const [version, setVersion] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, RunDetail>>({});
  const [detailError, setDetailError] = useState('');
  const [retry, setRetry] = useState(0);
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);
  const activeDetail = isRunning(runs.find(run => run.id === expandedId)?.status);

  useEffect(() => {
    let active = true; let pending = false;
    async function refresh() {
      if (pending) return; pending = true;
      try {
        const generation=listGeneration.current;
        const results = await Promise.allSettled([
          api<ExecutionRecord[]>('/execution-records'),
          api<AndroidFlowRun[]>('/android/runs'),
          projectId ? api<ApiRun[]>('/api-library/' + encodeURIComponent(projectId) + '/runs') : Promise.resolve([]),
        ]);
        if (active && generation === listGeneration.current) {
          setRuns(current => {
            const [standard, android, requests] = results;
            return [
              ...(standard.status === 'fulfilled' ? standard.value : current.filter(run => run.recordKind === 'run' || run.recordKind === 'workflow')),
              ...(android.status === 'fulfilled' ? android.value.map(androidRecord) : current.filter(run => run.recordKind === 'android')),
              ...(requests.status === 'fulfilled' ? requests.value.map(run => apiRequestRecord(run, projectId || '')) : current.filter(run => run.recordKind === 'api-request')),
            ].sort((a,b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
          });
          const sources = ['Test Case／API 流程', 'Flow Case', 'API 請求'];
          setListError(results.flatMap((result,index) => result.status === 'rejected' ? [sources[index] + '：' + (result.reason instanceof Error ? result.reason.message : '紀錄讀取失敗')] : []).join('；'));
        }
      } catch (reason) { if (active) setListError(reason instanceof Error ? reason.message : '無法讀取結果'); }
      finally { pending = false; if (active) setLoading(false); }
    }
    void refresh(); const timer = window.setInterval(refresh, 2000);
    return () => { active = false; window.clearInterval(timer); };
  }, [projectId]);

  useEffect(() => {
    if (!expandedId) return;
    const id = expandedId;
    let active = true; let pending = false;
    setDetailError('');
    async function refresh() {
      if (pending) return; pending = true;
      try {
        const run=runs.find(item=>item.id===id);if(!run)return;
        const result = run.recordKind === 'android' ? androidRecord(await api<AndroidFlowRun>(historyPath(run))) : run.recordKind === 'api-request' ? run : await api<RunDetail>(historyPath(run));
        if (active) { setDetails(current => ({ ...current, [id]: { ...result, events: result.events || [] } })); setDetailError(''); }
      } catch (reason) { if (active) setDetailError(reason instanceof Error ? reason.message : '無法讀取詳情'); }
      finally { pending = false; }
    }
    void refresh();
    const timer = activeDetail ? window.setInterval(refresh, 2000) : undefined;
    return () => { active = false; if (timer !== undefined) window.clearInterval(timer); };
  }, [expandedId, activeDetail, retry]);

  const singleRuns = runs.filter(run=>!run.batchId);
  const entries = singleRuns.filter(run => matchesHistory(run, { type: kind, version, outcome }));
  async function remove(){
    if(!deleting||deleteBusy)return;setDeleteBusy(true);setDeleteError('');
    try{await api(deleting.record?historyPath(deleting.record):'/execution-versions/'+encodeURIComponent(deleting.version),{method:'DELETE'});
      const keep=(run:HistoryRecord)=>deleting.record?run.id!==deleting.record.id:run.testVersion!==deleting.version;
      listGeneration.current++;setRuns(current=>current.filter(keep));setExpandedId(null);setDeleting(null);setVersion('all');
    }catch(reason){setDeleteError(reason instanceof Error?reason.message:'刪除失敗，請重試。');}finally{setDeleteBusy(false);}
  }
  function filterChanged() { setExpandedId(null); }

  return <div className="space-y-6">
    {listError && <Notice error>{listError}</Notice>}
    <div aria-label="執行紀錄篩選" className="grid gap-3 sm:grid-cols-3">
      <Dropdown label="執行類型" value={kind} options={[{value:'all',label:'全部執行'},...Object.entries(historyTypeLabels).map(([value,label])=>({value,label}))]} onChange={value => { setKind(value); filterChanged(); }} />
      <Dropdown label="測試版本" value={version} options={[{value:'all',label:'全部版本'},...[...new Set(singleRuns.map(run=>run.testVersion).filter(Boolean))].map(value=>({value,label:value}))]} onChange={value => {setVersion(value);filterChanged();}} />
      <Dropdown label="執行結果" value={outcome} options={[{value:'all',label:'全部結果'},...Object.entries(labels).map(([value,label])=>({value,label}))]} onChange={value => {setOutcome(value);filterChanged();}} />
    </div>
    <Panel title="執行紀錄">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 text-menu text-muted"><p>{entries.length} 筆紀錄</p>{version !== 'all' && runs.filter(run=>run.testVersion===version).length>1 && !runs.some(run=>run.testVersion===version&&(run.recordKind==='android'||run.recordKind==='api-request')) && <Button variant="danger" disabled={deleteBusy||runs.some(run=>run.testVersion===version&&isRunning(run.status))} aria-label={'刪除版本 '+version} onClick={()=>{setDeleteError('');setDeleting({version});}}><ToolIcon name="trash"/></Button>}</div>
      <div className="divide-y divide-line">{entries.map(run => {
        const expanded = expandedId === run.id;
        const detail = details[run.id];
        return <article key={run.recordKind+'-'+run.id} aria-label={run.scriptName || run.scriptId} className="space-y-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1"><h3 className="break-words text-body font-medium">{run.scriptName || run.scriptId}</h3><p className="break-words text-menu text-muted">{historyTypeLabels[historyType(run)]} · {run.createdAt ? formatTime(run.createdAt) : '時間未記錄'}</p>{run.testVersion && <p className="break-all text-menu text-muted">{run.testVersion}</p>}</div>
            <Badge tone={run.status==='passed'?'success':run.status==='failed'?'danger':'neutral'}>{labels[run.status]}</Badge>
            <div className="flex flex-wrap gap-2"><Button size="compact" aria-expanded={expanded} aria-controls={'result-'+run.id} onClick={()=>setExpandedId(expanded?null:run.id)}>{expanded?'收起結果':'查看結果'}</Button>{<Button size="compact" variant="danger" disabled={deleteBusy||runs.some(item=>(run.testVersion ? item.testVersion===run.testVersion : item.id===run.id)&&isRunning(item.status))} title="刪除此筆執行紀錄" aria-label={'刪除紀錄 '+(run.scriptName||run.scriptId)} onClick={()=>{setDeleteError('');setDeleting({record:run,version:run.testVersion});}}><ToolIcon name="trash"/></Button>}</div>
          </div>
          <div id={'result-'+run.id} hidden={!expanded}>{expanded && <>
            {detailError && <div className="space-y-3"><Notice error>{detailError}</Notice><Button onClick={()=>setRetry(value=>value+1)}>重新讀取結果</Button></div>}
            {detail ? <ResultDetail detail={detail}/> : !detailError && <p role="status" className="py-3 text-menu text-muted">正在讀取結果…</p>}
          </>}</div>
        </article>;
      })}</div>
      {!entries.length && <p role="status" className="py-5 text-muted">{loading?'正在讀取紀錄…':listError?'暫時無法讀取紀錄':'沒有符合的執行紀錄'}</p>}
    </Panel>
    <Modal compact open={!!deleting} title={deleting?.record?'刪除執行紀錄':'刪除執行版本'} onClose={()=>{if(!deleteBusy)setDeleting(null);}}>
      <p className="break-words text-body">{deleting?.record?'刪除這筆執行紀錄？測試案例仍會保留。':runs.some(run=>run.testVersion===deleting?.version&&run.batchId)?'刪除這份報告及其執行紀錄？測試案例仍會保留。':'刪除此版本的所有執行紀錄？測試案例仍會保留。'}</p>
      {deleteError&&<Notice error>{deleteError}</Notice>}
      <div className="flex flex-wrap gap-2"><Button disabled={deleteBusy} onClick={()=>setDeleting(null)}>取消</Button><Button variant="danger" disabled={deleteBusy} onClick={()=>void remove()}>{deleteBusy?'刪除中…':deleting?.record?'刪除執行紀錄':'刪除執行版本'}</Button></div>
    </Modal>
  </div>;
}
