const series = [
  { status: 'passed', label: '成功', color: 'text-success', stroke: 'stroke-success' },
  { status: 'failed', label: '失敗', color: 'text-danger', stroke: 'stroke-danger' },
  { status: 'running', label: '執行中', color: 'text-brand', stroke: 'stroke-brand' },
  { status: 'queued', label: '排隊中', color: 'text-warning', stroke: 'stroke-warning' },
  { status: 'skipped', label: '略過', color: 'text-muted', stroke: 'stroke-muted' },
  { status: 'cancelled', label: '已取消', color: 'text-ink', stroke: 'stroke-ink' },
] as const;

type RunStatus = typeof series[number]['status'];
const circumference = 2 * Math.PI * 44;

export function ResultDistribution({ statuses, conclusion }: { statuses: RunStatus[]; conclusion: string }) {
  let offset = 0;
  const segments = series.map(item => {
    const count = statuses.filter(status => status === item.status).length;
    const length = statuses.length ? count / statuses.length * circumference : 0;
    const segment = { ...item, count, length, offset };
    offset += length;
    return segment;
  });
  const description = segments.filter(item => item.count).map(item => `${item.label} ${item.count} 筆`).join('，');
  return <div className="flex flex-wrap items-center gap-8">
    <svg role="img" aria-label={statuses.length ? `執行結果分布：${description}` : '尚無執行結果'} viewBox="0 0 120 120" className="h-36 w-36 shrink-0 fill-none">
      <circle cx="60" cy="60" r="35" className="fill-canvas" />
      <circle cx="60" cy="60" r="44" strokeWidth="8" className="stroke-line" />
      {segments.filter(item => item.count).map(item => <circle key={item.status} cx="60" cy="60" r="44" strokeWidth="8" strokeDasharray={`${item.length} ${circumference-item.length}`} strokeDashoffset={-item.offset} transform="rotate(-90 60 60)" className={item.stroke} />)}
    </svg>
    <div className="min-w-0 max-w-2xl flex-1 basis-64">
      <h3 className="text-section font-medium">{conclusion}</h3>
      {statuses.length ? <dl aria-label="結果圖例" className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
        {segments.map(item => <div key={item.status} className="flex items-center justify-between gap-3 border-b border-line py-2">
          <dt className={`flex items-center gap-2 ${item.count ? item.color : 'text-muted'}`}>
            <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3 shrink-0 fill-none stroke-current" strokeWidth="1.5"><circle cx="6" cy="6" r="4" /></svg>
            {item.label}
          </dt>
          <dd className={`min-w-8 rounded-lg px-2 py-0.5 text-center font-medium tabular-nums ${item.count ? 'bg-sidebar text-ink' : 'text-muted'}`}>{item.count}</dd>
        </div>)}
      </dl> : <p className="mt-4 text-muted">完成測試後，這裡會呈現結果分布。</p>}
    </div>
  </div>;
}
