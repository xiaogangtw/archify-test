import { useState } from 'react';
import { Panel } from '../../components/Panel';
import { Badge, Button, Field, Input, Notice, cx } from '../../components/ui/controls';
import { Dropdown } from '../../components/ui/Dropdown';
import { useTesting } from './TestingProvider';
import { kindNames } from './types';
import type { FlowStep, TestCase } from './types';
import { caseToFlowStep, requiredVariables, variableLabel } from './flowHelpers';

const stages = ['命名流程', '選擇案例', '順序與資料', '儲存確認'];

export function FlowBuilder({ onFinished }: { onFinished: () => void }) {
  const { data, editingFlowId, saveFlow } = useTesting();
  const existing = data.flows.find(flow => flow.id === editingFlowId);
  const [stage, setStage] = useState(0);
  const [id, setId] = useState(existing?.id);
  const [name, setName] = useState(existing?.name || '');
  const [steps, setSteps] = useState<FlowStep[]>(structuredClone(existing?.steps || []));
  const [variables, setVariables] = useState<Record<string, string>>({ ...existing?.variables });
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const needed = requiredVariables(steps);
  const missing = needed.filter(variable => !variables[variable]?.trim());
  const planned = steps.filter(step => step.snapshot.kind !== 'api');
  const filtered = data.cases.filter(testCase => (!testCase.projectId||testCase.projectId===(data.project.id||'original')) && (kind === 'all' || testCase.kind === kind) && testCase.name.toLowerCase().includes(query.toLowerCase()));

  function pick(testCase: TestCase) {
    setSaved('');
    setSteps(current => current.some(step => step.caseId === testCase.id)
      ? current.filter(step => step.caseId !== testCase.id)
      : [...current, caseToFlowStep(testCase)]);
  }

  function move(index: number, direction: number) {
    const next = [...steps];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSteps(next); setSaved('');
  }

  function next() {
    setError('');
    if (stage === 0 && !name.trim()) { setError('先給這個流程一個名稱，例如「使用者登入後收藏專案」。'); return; }
    if (stage >= 1 && !steps.length) { setError('請至少勾選一個案例。'); return; }
    setStage(current => Math.min(3, current + 1));
  }

  function save() {
    if (!name.trim() || !steps.length) { setError('請填流程名稱，並至少選擇一個案例。'); return; }
    const relevant = Object.fromEntries(needed.map(variable => [variable, variables[variable] || '']));
    const result = saveFlow({ id, name: name.trim(), projectId: data.project.id||'original', steps, variables: relevant });
    setId(result.id);
    setSaved(`已儲存「${result.name}」v${result.version}。${missing.length ? '測試資料尚未填齊，先保存為待完成流程。' : ''}`);
    setError('');
  }

  return (
    <div className="space-y-6">
      {error && <Notice error>{error}</Notice>}
      {saved && <Notice>{saved}</Notice>}
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="流程建立步驟">
        {stages.map((label, index) => <li key={label}><button type="button" aria-current={stage === index ? 'step' : undefined} disabled={index > stage} onClick={() => { setStage(index); setError(''); }} className={cx('min-h-11 w-full rounded-lg border p-4 text-left text-body font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50', stage === index ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-muted')}>{index + 1}. {label}</button></li>)}
      </ol>

      {stage === 0 && <Panel title="這個流程要測什麼？"><div className="max-w-prose space-y-5"><p className="text-body leading-7 text-muted">流程是一組依順序執行的案例。先取一個你看得懂的名稱。</p><Field label="流程名稱"><Input autoFocus maxLength={100} value={name} onChange={event => { setName(event.target.value); setSaved(''); }} placeholder="例如：瀏覽專案並加入收藏" /></Field><p className="text-body text-muted">專案：{data.project.name}。不需要送審或等待他人核准。</p></div></Panel>}

      {stage === 1 && <Panel title="勾選要放進流程的案例"><div className="mb-5 flex flex-wrap gap-3"><div className="w-full sm:w-72"><Input type="search" aria-label="搜尋可選案例" placeholder="搜尋案例" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="w-full sm:w-52"><Dropdown label="篩選可選案例類型" value={kind} options={[{ value: 'all', label: '全部類型' }, ...Object.entries(kindNames).map(([value, label]) => ({ value, label }))]} onChange={setKind} /></div></div><p className="mb-4 text-body text-muted">已選 {steps.length} 個案例。依勾選順序加入，下一步可調整。</p><div className="space-y-3">{filtered.map(testCase => {
        const selected = steps.find(step => step.caseId === testCase.id);
        const shown = selected?.snapshot || testCase;
        return <label key={testCase.id} className={cx('flex cursor-pointer items-start gap-4 rounded-lg border p-4', selected ? 'border-brand bg-brand-soft' : 'border-line bg-surface')}><input type="checkbox" checked={!!selected} onChange={() => pick(testCase)} className="mt-1 h-5 w-5 shrink-0 accent-brand focus-visible:ring-2 focus-visible:ring-brand" /><span className="min-w-0 space-y-2"><span className="block font-medium">{shown.name}</span><span className="flex flex-wrap gap-2"><Badge>{kindNames[shown.kind]}</Badge><Badge>v{selected?.caseVersion || testCase.version}</Badge>{shown.kind !== 'api' && <Badge>執行器規劃中</Badge>}</span><span className="block text-body leading-7 text-muted">{shown.expected}</span>{selected && selected.caseVersion !== testCase.version && <span className="block text-body text-warning">案例庫已有 v{testCase.version}，目前固定 v{selected.caseVersion}。取消勾選再加入可更新。</span>}</span></label>;
      })}{!filtered.length && <p className="p-5 text-muted">沒有符合條件的案例，請調整搜尋。</p>}</div></Panel>}

      {stage === 2 && <div className="space-y-6"><Panel title="確認執行順序"><ol className="space-y-4">{steps.map((step, index) => <li key={step.id} className="space-y-3 rounded-lg border border-line p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-bold">{index + 1}. {step.snapshot.name}</h3><p className="mt-2 text-body text-muted">{step.snapshot.expected}</p><div className="mt-2 flex flex-wrap gap-2"><Badge>{kindNames[step.snapshot.kind]}</Badge><Badge>案例 v{step.caseVersion}</Badge></div></div><div className="flex flex-wrap gap-2"><Button disabled={index === 0} onClick={() => move(index, -1)}>上移</Button><Button disabled={index === steps.length - 1} onClick={() => move(index, 1)}>下移</Button><Button onClick={() => { setSteps(current => current.filter(item => item.id !== step.id)); setSaved(''); }}>移出流程</Button></div></div></li>)}</ol>{!steps.length && <p className="text-muted">流程已沒有案例，請回到上一步選擇。</p>}</Panel><Panel title="填寫本次測試資料">{needed.length ? <div className="grid gap-5 md:grid-cols-2">{needed.map(variable => <Field key={variable} label={variableLabel(variable)}><Input value={variables[variable] || ''} onChange={event => { setVariables({ ...variables, [variable]: event.target.value }); setSaved(''); }} placeholder={/secret|password|token/i.test(variable) ? '填秘密參照名稱，不要填真正的密碼' : '填入測試用的值'} /></Field>)}</div> : <p className="text-body text-muted">這些案例沒有需要填寫的變數。</p>}<p className="mt-4 text-body leading-6 text-muted">資料由案例中的雙大括號變數帶入。可以先留白存草稿；請勿填寫真實密碼或 Token。</p></Panel></div>}

      {stage === 3 && <Panel title="確認後直接儲存"><dl className="space-y-4"><div><dt className="text-body text-muted">流程名稱</dt><dd className="mt-1 text-section font-bold">{name}</dd></div><div><dt className="text-body text-muted">執行順序</dt><dd className="mt-2"><ol className="list-decimal space-y-2 pl-5">{steps.map(step => <li key={step.id}>{step.snapshot.name}（{kindNames[step.snapshot.kind]}）</li>)}</ol></dd></div></dl>{missing.length > 0 && <p className="mt-5 rounded-lg bg-warning-soft p-4 text-body text-warning">尚缺測試資料：{missing.map(variableLabel).join('、')}。可以先儲存，執行前再補齊。</p>}{planned.length > 0 && <p className="mt-5 rounded-lg border border-line p-4 text-body text-muted">包含 {planned.length} 個瀏覽器操作或畫面比對案例，可保存設計；目前還沒有對應執行器。</p>}<p className="mt-5 text-body text-muted">儲存會固定每個案例的版本，不會觸發測試或送出審核。</p></Panel>}

      <div className="flex flex-wrap items-center justify-between gap-3"><Button onClick={() => { if (stage > 0) { setStage(stage - 1); setError(''); } else onFinished(); }}>{stage > 0 ? '上一步' : '返回我的流程'}</Button><div className="flex flex-wrap gap-3">{saved && <Button onClick={onFinished}>查看我的流程</Button>}{stage < 3 ? <Button variant="primary" onClick={next}>下一步：{stages[stage + 1]}</Button> : <Button variant="primary" disabled={!steps.length || !!saved} onClick={save}>{saved ? '已儲存' : missing.length ? '儲存草稿' : '儲存流程'}</Button>}</div></div>
    </div>
  );
}



