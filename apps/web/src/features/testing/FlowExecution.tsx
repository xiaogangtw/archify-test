import { useState } from 'react';
import type { PageId } from '../../types';
import { Panel } from '../../components/Panel';
import { Badge, Button, Notice, cx } from '../../components/ui/controls';
import { useTesting } from './TestingProvider';
import { requiredVariables, variableLabel } from './flowHelpers';
import { kindNames } from './types';

export function FlowExecution({ page, onNavigate }: { page: PageId; onNavigate: (page: PageId) => void }) {
  const { data, selectedFlowId, selectFlow, openFlow } = useTesting();
  const flow = data.flows.find(item => item.id === selectedFlowId);
  const [acknowledged, setAcknowledged] = useState(false);
  const [run, setRun] = useState<'idle' | 'queued' | 'running' | 'passed' | 'cancelling' | 'cancelled'>('idle');
  const missing = flow ? requiredVariables(flow.steps).filter(variable => !flow.variables[variable]?.trim()) : [];
  const future = flow?.steps.some(step => step.snapshot.kind !== 'api');

  if (page === 'suites') return <div className="space-y-6"><Panel title="先選擇一個已儲存的流程"><p className="mb-5 text-body text-muted">看清楚流程名稱與案例內容，再按「下一步」。目前一次選擇一個流程。</p><fieldset className="space-y-4"><legend className="sr-only">要執行的流程</legend>{data.flows.map(item => <label key={item.id} className={cx('flex cursor-pointer items-start gap-4 rounded-lg border p-4', selectedFlowId === item.id ? 'border-brand bg-brand-soft' : 'border-line bg-surface')}><input type="radio" name="execution-flow" className="mt-1 h-5 w-5 shrink-0 accent-brand" checked={selectedFlowId === item.id} onChange={() => { selectFlow(item.id); setAcknowledged(false); setRun('idle'); }} /><span className="space-y-2"><span className="block font-bold">{item.name} · v{item.version}</span><span className="block text-body text-muted">{item.steps.map(step => step.snapshot.name).join('、')}</span><Badge>{item.steps.length} 個案例</Badge></span></label>)}</fieldset>{!data.flows.length && <Button onClick={() => onNavigate('journeys')}>先建立測試流程</Button>}</Panel><Button variant="primary" disabled={!flow} onClick={() => onNavigate('run-new')}>下一步：確認執行內容</Button></div>;

  return <div className="space-y-6">{run !== 'idle' && <Notice>{({ queued: '示範工作已排隊。', running: '示範工作執行中。', passed: '示範工作已完成，沒有發出真實請求。', cancelling: '等待示範工作終止確認。', cancelled: '示範工作已取消。' })[run]}</Notice>}{flow ? <Panel title="本次執行內容"><div className="mb-5 flex flex-wrap gap-2"><Badge>{flow.name}</Badge><Badge>流程 v{flow.version}</Badge><Badge>Staging 示範環境</Badge></div><ol className="list-decimal space-y-3 pl-5">{flow.steps.map(step => <li key={step.id}>{step.snapshot.name} · {kindNames[step.snapshot.kind]} · 案例 v{step.caseVersion}</li>)}</ol><p className="mt-5 text-body text-muted">此階段只模擬執行狀態，不會開啟網站或呼叫 API。</p>{missing.length > 0 && <p className="mt-4 text-body text-warning">尚缺測試資料：{missing.map(variableLabel).join('、')}。請回到流程編輯補齊。</p>}{future && <p className="mt-4 text-body text-warning">這個流程包含 Playwright 或畫面比對，對應執行器還在規劃中，目前只能保存與編輯。</p>}<label className="my-6 flex items-start gap-3 text-body"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-brand" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />我已確認這次選擇的流程與案例內容。</label><div className="flex flex-wrap gap-3"><Button variant="primary" disabled={!acknowledged || !!future || !!missing.length || !['idle', 'passed', 'cancelled'].includes(run)} onClick={() => setRun('queued')}>開始示範執行</Button>{['queued', 'running'].includes(run) && <><Button onClick={() => setRun(run === 'queued' ? 'running' : 'passed')}>模擬下一階段</Button><Button onClick={() => setRun('cancelling')}>取消執行</Button></>}{run === 'cancelling' && <Button onClick={() => setRun('cancelled')}>模擬終止確認</Button>}<Button onClick={() => { openFlow(flow.id); onNavigate('builder'); }}>返回編輯此流程</Button><Button onClick={() => onNavigate('suites')}>重新選擇</Button></div></Panel> : <Panel title="還沒有選擇流程"><Button onClick={() => onNavigate('suites')}>選擇要執行的流程</Button></Panel>}</div>;
}


