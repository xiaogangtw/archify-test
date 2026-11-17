import { useEffect, useId, useRef, useState } from 'react';
import type { CatalogView, Feature } from './catalog';
import { featureAncestors } from './feature-graph';
import { FeatureSequence } from './FeatureSequence';
import { ActionButton, Badge, Disclosure, Surface, cx } from '../../components/ui/ds';
import { freshnessLabels, resultLabels } from './catalog';

export function FeatureReader({ feature, view, busy, code, onBack, onNavigate, onCode, onCase, onAddCase, initialTab = 'api' }: {
  feature: Feature; view: CatalogView; busy: boolean; code?: { path: string; content: string };
  onBack: () => void; onNavigate: (id: string) => void; onCode: (scope: string, path: string) => void;
  onCase: (id: string) => void; onAddCase: () => void;
  initialTab?: 'api' | 'cases';
}) {
  const [tab, setTab] = useState<'api' | 'cases'>(initialTab);
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [feature.id]);
  const rows = view.cases.filter(row => row.featureId === feature.id);
  const ancestors = featureAncestors(view.catalog.features, feature.id);
  const extraSources = feature.sources.filter(source => !feature.frontend?.sequence?.some(step => step.source.path === source.path && step.source.line === source.line));
  const options = [{ id: 'api' as const, label: 'API 流程' }, { id: 'cases' as const, label: `測試案例（${rows.length}）` }];
  return (
    <Surface aria-label="功能閱讀器" className="min-w-0 space-y-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav aria-label="功能階層" className="flex min-w-0 flex-wrap items-center gap-1 text-muted">
            <ActionButton variant="ghost" onClick={() => onNavigate('overview')}>全部功能</ActionButton>
            {ancestors.map(item => <span key={item.id} className="inline-flex min-w-0 items-center gap-1"><span aria-hidden="true">/</span><ActionButton variant="ghost" onClick={() => onNavigate(item.id)}>{item.name}</ActionButton></span>)}
          </nav>
          <ActionButton onClick={onBack}>返回功能地圖</ActionButton>
        </div>
        <h2 ref={heading} tabIndex={-1} className="break-words rounded-lg text-heading font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{feature.name}</h2>
        {feature.frontend?.description && <p className="max-w-prose whitespace-pre-wrap break-words text-muted">{feature.frontend.description}</p>}
      </header>
      <div role="tablist" aria-label="功能內容" className="flex gap-1 border-b border-line">
        {options.map(option => <button key={option.id} type="button" role="tab" id={`${id}-${option.id}`} aria-controls={`${id}-panel`} aria-selected={tab === option.id} tabIndex={tab === option.id ? 0 : -1}
          className={cx('min-h-8 rounded-lg px-3 py-2 text-body font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:bg-surface-active',tab === option.id ? 'bg-surface-active text-ink' : 'text-muted hover:bg-surface-subtle hover:text-ink')}
          onClick={() => setTab(option.id)} onKeyDown={event => {
            if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 'api' : event.key === 'End' ? 'cases' : tab === 'api' ? 'cases' : 'api';
            setTab(next); document.getElementById(`${id}-${next}`)?.focus();
          }}>{option.label}</button>)}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${tab}`} className="min-w-0 space-y-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" tabIndex={0}>
        {tab === 'api' ? <>
          <FeatureSequence feature={feature} busy={busy} onCode={onCode} />
          {!!feature.frontend?.questions.length && <Disclosure summary={`業務待確認（${feature.frontend.questions.length}）`}><ul className="list-inside list-disc space-y-2 text-warning">{feature.frontend.questions.map(question => <li key={question}>{question}</li>)}</ul></Disclosure>}
          {!!extraSources.length && <Disclosure summary="其他功能來源"><ul className="space-y-2">{extraSources.map(source => <li key={source.path+source.line}><ActionButton variant="ghost" align="start" className="max-w-full break-all text-left" disabled={busy} onClick={() => onCode('source', source.path)}>{`${source.path}:${source.line}`}</ActionButton></li>)}</ul></Disclosure>}
          {code && <Disclosure summary={`程式碼：${code.path}`} open><section aria-label="程式碼預覽" className="min-w-0"><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-canvas p-3 font-mono text-body text-ink">{code.content}</pre></section></Disclosure>}
        </> : <>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-muted">{rows.length ? `${rows.length} 個對應案例` : '尚未建立測試案例，可先閱讀 API 流程再規劃。'}</p><ActionButton disabled={busy} onClick={onAddCase}>新增測試案例</ActionButton></div>
          {!!rows.length && <ul className="divide-y divide-line">{rows.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><ActionButton variant="ghost" align="start" className="max-w-full break-words text-left" onClick={() => onCase(row.id)}>{row.title}</ActionButton><p className="px-3 text-muted">{freshnessLabels[row.freshness]}</p></div><Badge tone={row.latest?.status === 'failed' ? 'danger' : 'neutral'}>{row.latest ? `上次${resultLabels[row.latest.status] || row.latest.status}` : '尚未執行'}</Badge></li>)}</ul>}
        </>}
      </div>
    </Surface>
  );
}
