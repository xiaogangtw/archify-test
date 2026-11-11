import type { PageId } from '../../types';
import { Badge, Button } from '../../components/ui/controls';
import { useTesting } from './TestingProvider';
import { requiredVariables } from './flowHelpers';
import { kindNames } from './types';

export function FlowList({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { data, openFlow, selectFlow } = useTesting();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-body text-muted">先建立案例，再把案例組成流程。不需要審核。</p><div className="flex flex-wrap gap-3"><Button onClick={() => onNavigate('cases')}>前往案例庫</Button><Button variant="primary" onClick={() => { openFlow(null); onNavigate('builder'); }}>新增流程</Button></div></div>
      <div className="space-y-4">{data.flows.map(flow => {
        const missing = requiredVariables(flow.steps).filter(variable => !flow.variables[variable]?.trim());
        const planned = flow.steps.some(step => step.snapshot.kind !== 'api');
        return <article key={flow.id} className="flex flex-wrap items-start justify-between gap-5 rounded-xl border border-line bg-surface p-5"><div className="min-w-0 space-y-3"><h2 className="text-section font-bold">{flow.name}</h2><div className="flex flex-wrap gap-2"><Badge>v{flow.version}</Badge><Badge>{flow.steps.length} 個案例</Badge><Badge>{missing.length ? '測試資料待補' : planned ? '執行器規劃中' : '可示範執行'}</Badge></div><ol className="list-decimal space-y-2 pl-5 text-body text-muted">{flow.steps.map(step => <li key={step.id}>{step.snapshot.name} · {kindNames[step.snapshot.kind]}</li>)}</ol></div><div className="flex flex-wrap gap-3"><Button onClick={() => { openFlow(flow.id); onNavigate('builder'); }}>編輯流程</Button><Button onClick={() => { selectFlow(flow.id); onNavigate('suites'); }}>選擇執行</Button></div></article>;
      })}{!data.flows.length && <p className="rounded-xl border border-line p-8 text-muted">尚未建立流程，按「新增流程」開始勾選案例。</p>}</div>
    </div>
  );
}

