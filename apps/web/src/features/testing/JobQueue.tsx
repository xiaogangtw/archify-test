import { useTesting } from './TestingProvider';
import { Panel } from '../../components/Panel';
import { Badge, Button, Notice } from '../../components/ui/controls';
export function JobQueue() {
  const {runHistory,cancelInlineRun,runError}=useTesting();
  const rows=runHistory.filter(run=>run.status==='queued'||run.status==='running');
  return <div className="space-y-5">{runError && <Notice error>{runError}</Notice>}<Panel title="工作佇列"><ul className="divide-y divide-line">{rows.map(run=><li key={run.id} className="flex flex-wrap items-center gap-4 py-4"><div className="min-w-0 flex-1"><p className="font-bold">{run.scriptName}</p><p className="break-all text-body text-muted">{run.testVersion}</p><p className="text-body">{run.message}</p></div><Badge>{run.status==='queued'?'排隊中':'執行中'}</Badge><Button onClick={()=>cancelInlineRun(run.scriptId)}>取消</Button></li>)}</ul>{!rows.length && <p className="py-4 text-muted">目前沒有排隊或執行中的工作</p>}</Panel></div>;
}
