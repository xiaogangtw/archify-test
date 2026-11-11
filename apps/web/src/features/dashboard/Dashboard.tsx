import type { PageId } from '../../types';
import { Notice, UiDensityContext } from '../../components/ui/controls';
import { ResultDistribution } from '../../components/ui/ResultDistribution';
import { useTesting } from '../testing/TestingProvider';
import { WorkspaceIdentity } from './WorkspaceIdentity';
import { RecentActivity } from './RecentActivity';

export function Dashboard({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { runHistory, runError } = useTesting();
  const recent = [...runHistory].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3);
  const statuses = runHistory.map(run => run.status);
  const conclusion = runError ? '結果同步中斷'
    : !statuses.length ? '尚未執行測試'
    : statuses.includes('failed') ? '有測試未通過'
    : statuses.includes('running') ? '測試正在執行'
    : statuses.includes('queued') ? '有測試等待執行'
    : statuses.every(status => status === 'passed') ? '測試皆已通過'
    : '部分測試未完成';
  return (
    <UiDensityContext.Provider value="compact">
      <div className="max-w-workspace space-y-5 text-body selection:bg-brand-soft selection:text-ink">
        <WorkspaceIdentity />
        {runError && <Notice error>{runError}。目前結果可能不完整。</Notice>}
        <div className="grid items-start gap-6 lg:grid-cols-dashboard-overview">
        <section aria-labelledby="results-title" className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-canvas px-4 py-3">
            <h2 id="results-title" className="flex items-center gap-2 text-body font-medium">
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-none stroke-current text-muted" strokeWidth="1.5"><path d="M6 3h8M8 3v5l-4 6a2 2 0 0 0 1.7 3h8.6a2 2 0 0 0 1.7-3l-4-6V3M6 12h8" /></svg>
              測試結果
            </h2>
          </header>
          <div className="px-5 py-6">
            <ResultDistribution statuses={statuses} conclusion={conclusion} />
          </div>
        </section>
        <RecentActivity runs={recent} onViewAll={() => onNavigate('runs')} />
        </div>
      </div>
    </UiDensityContext.Provider>
  );
}
