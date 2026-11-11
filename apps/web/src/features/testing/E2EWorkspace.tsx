import { useState } from 'react';
import { Button, Field, Input, Notice } from '../../components/ui/controls';
import { Dropdown } from '../../components/ui/Dropdown';

type Actor = { id: string; name: string };
type Step = { id: string; actorId: string; action: string; expected: string };
type Plan = { id: string; name: string; platform: 'android' | 'web'; target: string; actors: Actor[]; steps: Step[] };
const newId = () => crypto.randomUUID();
function createPlan(exchange = false, platform: Plan['platform'] = 'android'): Plan {
  const a = newId(), b = newId();
  return { id: newId(), name: exchange ? '雙帳號名片交換' : '新的 E2E 流程', platform, target: '',
    actors: [{ id: a, name: '使用者 A' }, ...(exchange ? [{ id: b, name: '使用者 B' }] : [])],
    steps: exchange ? [
      { id: newId(), actorId: a, action: '登入 A 帳號並開啟自己的名片', expected: '顯示 A 的名片資料' },
      { id: newId(), actorId: b, action: '登入 B 帳號並開啟接收頁面', expected: 'B 可接收交換邀請' },
      { id: newId(), actorId: a, action: '向 B 發送名片交換邀請', expected: '顯示邀請已送出' },
      { id: newId(), actorId: b, action: '等待 A 的邀請出現後接受交換', expected: '收納 A 的名片，內容與 A 相符' },
      { id: newId(), actorId: a, action: '等待交換完成後查看名片收藏', expected: '收納 B 的名片，沒有重複資料' },
    ] : [] };
}
function validPlans(value: unknown): value is Plan[] {
  return Array.isArray(value) && value.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' &&
    ['android', 'web'].includes(p.platform) && typeof p.target === 'string' && Array.isArray(p.actors) && p.actors.length > 0 &&
    p.actors.every((a: Actor) => a && typeof a.id === 'string' && typeof a.name === 'string') && Array.isArray(p.steps) &&
    p.steps.every((s: Step) => s && typeof s.id === 'string' && typeof s.action === 'string' && typeof s.expected === 'string' && p.actors.some((a: Actor) => a.id === s.actorId)));
}

export function E2EWorkspace({ projectId, platform = 'android' }: { projectId: string; platform?: Plan['platform'] }) {
  const storageKey = `archify.e2e-plans.v1.${projectId}`;
  const [initial] = useState(() => {
    try { const raw = localStorage.getItem(storageKey); const value: unknown = raw ? JSON.parse(raw) : []; if (!validPlans(value)) throw new Error(); return { plans: value, error: '' }; }
    catch { return { plans: [] as Plan[], error: '無法讀取已保存的 E2E 流程，原始資料未被覆蓋。' }; }
  });
  const [plans, setPlans] = useState<Plan[]>(initial.plans);
  const [draft, setDraft] = useState<Plan | null>(null);
  const [error, setError] = useState(initial.error);
  const [message, setMessage] = useState('');
  function edit(plan: Plan) { setDraft(structuredClone(plan)); setMessage(''); }
  function save() {
    if (!draft) return;
    if (!draft.name.trim() || !draft.target.trim() || draft.actors.some(a => !a.name.trim()) || !draft.steps.length || draft.steps.some(s => !s.action.trim() || !s.expected.trim())) {
      setError('請填寫流程名稱、測試對象、角色，以及至少一個完整的操作與預期結果。'); return;
    }
    const target = draft.target.trim();
    let validTarget = /^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/.test(target);
    if (draft.platform === 'web') {
      try { validTarget = ['http:', 'https:'].includes(new URL(target).protocol); }
      catch { validTarget = false; }
    }
    if (!validTarget) { setError(draft.platform === 'android' ? '請填寫有效的 Android 套件名稱。' : '請填寫完整的 HTTP 或 HTTPS 網址。'); return; }
    const next = [...plans.filter(p => p.id !== draft.id), { ...draft, name: draft.name.trim() }];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setPlans(next); setError(''); setMessage('流程草稿已儲存在此瀏覽器，尚未執行驗證。'); }
    catch { setError('儲存失敗，請保留目前內容後重試。'); }
  }
  function updateStep(id: string, patch: Partial<Step>) { if (draft) setDraft({ ...draft, steps: draft.steps.map(s => s.id === id ? { ...s, ...patch } : s) }); }
  function moveStep(index: number, offset: number) {
    if (!draft) return; const steps = [...draft.steps]; [steps[index], steps[index + offset]] = [steps[index + offset], steps[index]]; setDraft({ ...draft, steps });
  }
  return <div className="space-y-4 text-section">
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4" aria-label="E2E 執行環境">
      <div><h2 className="font-bold">自動化腳本尚未接入</h2><p className="mt-1 text-muted">{platform === 'android' ? '模擬器操作與流程測試分開管理。這些白話步驟仍是草稿，尚不能由 Appium 自動執行。' : '可先保存網頁測試流程；Playwright 瀏覽器執行器尚未接入。'}</p></div>
      <Button disabled title="尚未接入此流程的自動化腳本">開始執行</Button>
    </section>
    {error && <Notice error>{error}</Notice>}
    {message && <div role="status" className="rounded-lg bg-success-soft p-3 text-success">{message}</div>}
    {!draft ? <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-heading font-bold">測試流程</h2><div className="flex flex-wrap gap-2">{platform === 'android' && <Button onClick={() => edit(createPlan(true))}>使用名片交換範本</Button>}<Button variant="primary" onClick={() => edit(createPlan(false, platform))}>新增流程</Button></div></div>
      {!plans.filter(p => p.platform === platform).length ? <div className="py-16"><h3 className="text-heading font-medium">建立第一個端到端流程</h3><p className="mt-3 text-muted">從登入到完成交換，安排每個角色的操作與預期結果。</p></div> : <ul className="mt-4 divide-y divide-line">{plans.filter(p => p.platform === platform).map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><h3 className="font-medium">{p.name}</h3><p className="mt-1 text-muted">{p.platform === 'android' ? 'Android · Appium' : '網頁 · Playwright'} · {p.actors.length} 個角色 · {p.steps.length} 個步驟 · 草稿未驗證</p></div><Button onClick={() => edit(p)} aria-label={`編輯 ${p.name}`}>編輯</Button></li>)}</ul>}
    </section> : <>
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><Field label="流程名稱"><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></Field></div><Button onClick={() => { setDraft(null); setMessage(''); setError(initial.error); }}>返回清單</Button><Button variant="primary" disabled={!!initial.error} onClick={save}>儲存流程</Button></div>
        <p className="mt-3 text-muted">本機流程草稿；尚未產生自動化腳本或執行結果。返回清單會捨棄尚未儲存的變更。</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><Field label={draft.platform === 'android' ? 'Android 套件名稱' : '網站網址'}><Input placeholder={draft.platform === 'android' ? 'com.company.app' : 'https://test.example.com'} value={draft.target} onChange={e => setDraft({ ...draft, target: e.target.value })} /></Field></div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-heading font-bold">{draft.platform === 'android' ? '裝置與角色' : '瀏覽器與角色'}</h2><Button onClick={() => setDraft({ ...draft, actors: [...draft.actors, { id: newId(), name: `使用者 ${draft.actors.length + 1}` }] })}>新增角色</Button></div>
        <p className="mt-2 text-muted">每個角色使用獨立{draft.platform === 'android' ? '模擬器' : '瀏覽器工作階段'}；依步驟順序協調操作。這裡尚未啟動裝置，請勿填寫密碼。</p>
        <div className="mt-4 space-y-3">{draft.actors.map((actor, i) => <div key={actor.id} className="flex items-end gap-3"><div className="min-w-0 flex-1"><Field label={`角色 ${i + 1}`}><Input value={actor.name} onChange={e => setDraft({ ...draft, actors: draft.actors.map(a => a.id === actor.id ? { ...a, name: e.target.value } : a) })} /></Field></div><Button variant="danger" disabled={draft.actors.length === 1 || draft.steps.some(s => s.actorId === actor.id)} title="角色被步驟使用時不能移除" aria-label={`移除角色 ${i + 1}`} onClick={() => setDraft({ ...draft, actors: draft.actors.filter(a => a.id !== actor.id) })}>移除</Button></div>)}</div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-4"><h2 className="text-heading font-bold">流程步驟</h2><ol className="mt-4 space-y-4">{draft.steps.map((step, i) => <li key={step.id} className="rounded-lg border border-line p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">步驟 {i + 1}</h3><div className="flex flex-wrap gap-2"><Button aria-label={`上移步驟 ${i + 1}`} disabled={!i} onClick={() => moveStep(i, -1)}>上移</Button><Button aria-label={`下移步驟 ${i + 1}`} disabled={i === draft.steps.length - 1} onClick={() => moveStep(i, 1)}>下移</Button><Button variant="danger" aria-label={`移除步驟 ${i + 1}`} onClick={() => setDraft({ ...draft, steps: draft.steps.filter(s => s.id !== step.id) })}>移除</Button></div></div><div className="grid gap-3 lg:grid-cols-3"><Dropdown label={`步驟 ${i + 1} 操作角色`} value={step.actorId} options={draft.actors.map(a => ({ value: a.id, label: a.name || '未命名角色' }))} onChange={actorId => updateStep(step.id, { actorId })} /><Field label={`步驟 ${i + 1} 操作`}><Input value={step.action} onChange={e => updateStep(step.id, { action: e.target.value })} /></Field><Field label={`步驟 ${i + 1} 預期結果`}><Input value={step.expected} onChange={e => updateStep(step.id, { expected: e.target.value })} /></Field></div></li>)}</ol><Button className="mt-4" onClick={() => setDraft({ ...draft, steps: [...draft.steps, { id: newId(), actorId: draft.actors[0].id, action: '', expected: '' }] })}>新增步驟</Button></section>
    </>}
  </div>;
}

