import { Button } from '../../components/ui/controls';

const labels = { queued: '排隊中', running: '執行中', passed: '成功', failed: '失敗', skipped: '略過', cancelled: '已取消' };
type ActivityRun = { id: string; scriptName?: string; createdAt: string; status: keyof typeof labels };

export function RecentActivity({ runs, onViewAll }: { runs: ActivityRun[]; onViewAll: () => void }) {
  return <aside aria-labelledby="recent-activity-title" className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface">
    <div aria-hidden="true" className="pointer-events-none relative h-24 overflow-hidden bg-canvas">
      <svg viewBox="0 0 288 40" className="absolute inset-x-0 bottom-0 h-10 w-full" shapeRendering="crispEdges">
        <path d="M0 0h96v40H0zM192 0h96v40H192z" className="fill-line" />
        <path d="M16 0h16v16H16zm32 16h16v16H48zm32 16h16v16H80zM208 0h16v16h-16zm48 16h16v16h-16z" className="fill-surface" />
      </svg>
      <img src="/brand/archify-companion-v2.png" alt="" width="80" height="80" decoding="async" className="absolute bottom-1 right-6 h-20 w-20 select-none object-contain" />
    </div>
    <div className="p-4">
      <h2 id="recent-activity-title" className="text-body font-medium">最近執行</h2>
      {runs.length ? <ol className="mt-4">
        {runs.map((run, index) => <li key={run.id} className="relative pb-5 pl-5 last:pb-0">
          {index < runs.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-1 top-3 w-px bg-line" />}
          <svg aria-hidden="true" viewBox="0 0 10 10" className="absolute left-0 top-1 h-2.5 w-2.5 fill-muted"><circle cx="5" cy="5" r="3" /></svg>
          <time dateTime={run.createdAt} className="text-muted">{new Date(run.createdAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</time>
          <p title={run.scriptName || '未命名案例'} className="mt-1 line-clamp-2 break-words font-medium">{run.scriptName || '未命名案例'}</p>
          <p className={run.status === 'failed' ? 'mt-1 text-danger' : run.status === 'passed' ? 'mt-1 text-success' : 'mt-1 text-muted'}>{labels[run.status]}</p>
        </li>)}
      </ol> : <p className="mt-4 text-muted">尚無執行紀錄</p>}
      <Button className="mt-5 w-full" onClick={onViewAll}>查看執行紀錄</Button>
    </div>
  </aside>;
}
