import { useState } from 'react';
import { Panel } from '../../components/Panel';
import { Badge, Button, Field, Input, Notice, Textarea } from '../../components/ui/controls';
import { Dropdown } from '../../components/ui/Dropdown';
import { useTesting } from './TestingProvider';
import { kindDescriptions, kindNames } from './types';
import type { BrowserActionKind, TestCase, TestKind } from './types';

const actionNames: Record<BrowserActionKind, string> = { goto: '開啟頁面', click: '點擊元素', fill: '輸入文字', visible: '檢查元素可見' };

function emptyCase(): TestCase {
  return { id: crypto.randomUUID(), version: 1, name: '', kind: 'api', description: '', target: '', expected: '', method: 'GET', expectedStatus: 200, actions: [], baseline: '', viewport: { width: 1280, height: 720 } };
}

export function CaseLibrary() {
  const { data, saveCase } = useTesting();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [draft, setDraft] = useState<TestCase | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const filtered = data.cases.filter(item => (kind === 'all' || item.kind === kind) && (item.name + item.description).toLowerCase().includes(query.toLowerCase()));

  function save() {
    if (!draft) return;
    if (!draft.name.trim() || !draft.target.trim() || !draft.expected.trim()) { setError('請填寫名稱、測試目標與預期結果。'); return; }
    if (draft.kind === 'api' && (!Number.isInteger(draft.expectedStatus) || draft.expectedStatus < 100 || draft.expectedStatus > 599)) { setError('預期狀態碼需介於 100 與 599。'); return; }
    if (draft.kind === 'playwright' && (!draft.actions.length || draft.actions.some(action => !action.target.trim() || (action.kind === 'fill' && !action.value.trim())))) { setError('請加入操作步驟，填寫每一步的目標與輸入內容。'); return; }
    if (draft.kind === 'visual' && (!draft.baseline.trim() || !Number.isInteger(draft.viewport.width) || !Number.isInteger(draft.viewport.height) || draft.viewport.width < 1 || draft.viewport.height < 1)) { setError('請填寫基準圖名稱，以及大於零的畫面寬高。'); return; }
    saveCase({ ...draft, name: draft.name.trim(), target: draft.target.trim(), expected: draft.expected.trim() });
    setDraft(null); setError(''); setNotice('案例已儲存。既有流程保留原案例版本，不會被自動改寫。');
  }

  return (
    <div className="space-y-6">
      {notice && <Notice>{notice}</Notice>}
      {error && <Notice error>{error}</Notice>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex w-full flex-wrap gap-3 md:w-auto">
          <div className="w-full sm:w-72"><Input type="search" aria-label="搜尋案例" placeholder="搜尋案例名稱" value={query} onChange={event => setQuery(event.target.value)} /></div>
          <div className="w-full sm:w-52"><Dropdown label="案例類型" value={kind} options={[{ value: 'all', label: '全部類型' }, ...Object.entries(kindNames).map(([value, label]) => ({ value, label }))]} onChange={setKind} /></div>
        </div>
        <Button variant="primary" disabled={!!draft} onClick={() => { setDraft(emptyCase()); setError(''); setNotice(''); }}>新增案例</Button>
      </div>
      <p className="text-body text-muted">案例是可重複使用的單一測試；流程則把多個案例依順序組合。</p>

      {draft ? (
        <Panel title={data.cases.some(item => item.id === draft.id) ? '編輯案例' : '新增案例'}>
          <form className="space-y-6" onSubmit={event => { event.preventDefault(); save(); }}>
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="案例名稱"><Input required maxLength={100} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="例如：使用者登入成功" /></Field>
              <div><p className="mb-2 text-body font-medium">測試類型</p><Dropdown label="編輯案例類型" value={draft.kind} options={Object.entries(kindNames).map(([value, label]) => ({ value, label }))} onChange={value => setDraft({ ...draft, kind: value as TestKind })} /></div>
            </div>
            <p className="text-body text-muted">{kindDescriptions[draft.kind]}</p>
            <Field label={draft.kind === 'api' ? 'API 路徑' : '頁面路徑'}><Input required value={draft.target} onChange={event => setDraft({ ...draft, target: event.target.value })} placeholder={draft.kind === 'api' ? '/bff/projects' : '/login'} /></Field>
            {draft.kind === 'api' && <div className="grid gap-5 md:grid-cols-2"><div><p className="mb-2 text-body font-medium">請求方式</p><Dropdown label="請求方式" value={draft.method} options={['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(value => ({ value, label: value }))} onChange={method => setDraft({ ...draft, method })} /></div><Field label="預期狀態碼"><Input type="number" required min={100} max={599} value={draft.expectedStatus} onChange={event => setDraft({ ...draft, expectedStatus: Number(event.target.value) })} /></Field></div>}
            {draft.kind === 'playwright' && <section className="space-y-4"><h3 className="font-bold">瀏覽器操作步驟</h3>{draft.actions.map((action, index) => <div key={action.id} className="space-y-4 rounded-lg border border-line p-4"><div className="flex flex-wrap items-center justify-between gap-3"><span className="font-medium">第 {index + 1} 步</span><Button onClick={() => setDraft({ ...draft, actions: draft.actions.filter(item => item.id !== action.id) })}>移除這一步</Button></div><div className="grid gap-4 md:grid-cols-2"><Dropdown label={`第 ${index + 1} 步操作`} value={action.kind} options={Object.entries(actionNames).map(([value, label]) => ({ value, label }))} onChange={value => setDraft({ ...draft, actions: draft.actions.map(item => item.id === action.id ? { ...item, kind: value as BrowserActionKind } : item) })} /><Field label={action.kind === 'goto' ? '要開啟的路徑' : '元素選擇器'}><Input required value={action.target} onChange={event => setDraft({ ...draft, actions: draft.actions.map(item => item.id === action.id ? { ...item, target: event.target.value } : item) })} /></Field></div>{action.kind === 'fill' && <Field label="輸入內容或變數"><Input required value={action.value} onChange={event => setDraft({ ...draft, actions: draft.actions.map(item => item.id === action.id ? { ...item, value: event.target.value } : item) })} placeholder="{{testEmail}}" /></Field>}</div>)}<Button onClick={() => setDraft({ ...draft, actions: [...draft.actions, { id: crypto.randomUUID(), kind: 'goto', target: draft.target, value: '' }] })}>新增操作步驟</Button></section>}
            {draft.kind === 'visual' && <div className="space-y-5"><Field label="基準圖名稱（尚未實際建立）"><Input required value={draft.baseline} onChange={event => setDraft({ ...draft, baseline: event.target.value })} placeholder="首頁桌機版" /></Field><div className="grid gap-5 md:grid-cols-2"><Field label="畫面寬度"><Input type="number" min={1} required value={draft.viewport.width} onChange={event => setDraft({ ...draft, viewport: { ...draft.viewport, width: Number(event.target.value) } })} /></Field><Field label="畫面高度"><Input type="number" min={1} required value={draft.viewport.height} onChange={event => setDraft({ ...draft, viewport: { ...draft.viewport, height: Number(event.target.value) } })} /></Field></div></div>}
            <Field label="預期結果"><Textarea required rows={3} value={draft.expected} onChange={event => setDraft({ ...draft, expected: event.target.value })} placeholder="操作完成後，應該看到什麼？" /></Field>
            <Field label="備註（選填）"><Input value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></Field>
            <p className="text-body text-muted">不要填真實密碼或 Token，請使用變數或秘密參照。Playwright 與畫面比對目前只保存設計。</p>
            <div className="flex flex-wrap gap-3"><Button type="submit" variant="primary">儲存案例</Button><Button onClick={() => { setDraft(null); setError(''); }}>返回案例庫</Button></div>
          </form>
        </Panel>
      ) : (
        <div className="space-y-3">{filtered.length ? filtered.map(testCase => <article key={testCase.id} className="flex flex-wrap items-start justify-between gap-5 rounded-lg border border-line bg-surface p-5"><div className="min-w-0 space-y-2"><h2 className="font-bold">{testCase.name}</h2><div className="flex flex-wrap gap-2"><Badge>{kindNames[testCase.kind]}</Badge><Badge>v{testCase.version}</Badge>{testCase.kind !== 'api' && <Badge>執行器規劃中</Badge>}</div><p className="max-w-prose break-words text-body leading-7 text-muted">{testCase.expected}</p><code className="block break-all font-mono text-body text-muted">{testCase.target}</code></div><Button onClick={() => { setDraft(structuredClone(testCase)); setNotice(''); setError(''); }}>查看與編輯</Button></article>) : <p className="rounded-xl border border-line p-8 text-muted">找不到符合條件的案例，可調整搜尋或新增案例。</p>}</div>
      )}
    </div>
  );
}


