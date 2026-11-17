import { useEffect, useState } from 'react';
import { ReportReader } from '../reader/ReportReader';
import { SourceWorkspace } from './SourceWorkspace';
import { KnowledgeWorkspace } from './KnowledgeWorkspace';
import { SetupWizard } from './SetupWizard';
import { CatalogWorkspace } from './CatalogWorkspace';
import { FlowWorkspace } from './FlowWorkspace';
import { ScriptWorkspace } from './ScriptWorkspace';
import { settings } from './client';
import type { LocalConfig } from './client';
import { ActionButton, WorkspaceIcon, cx } from '../../components/ui/ds';
import type { WorkspaceIconName } from '../../components/ui/ds';
import { WorkspaceToast } from './WorkspaceToast';

const navItems: readonly { id: string; label: string; icon: WorkspaceIconName }[] = [
  { id: 'analysis', label: '前端程式碼分析', icon: 'analysis' },
  { id: 'catalog', label: '功能地圖', icon: 'map' },
  { id: 'flows', label: '測試流程', icon: 'flow' },
  { id: 'scripts', label: '測試腳本', icon: 'script' },
  { id: 'reports', label: '測試報告', icon: 'report' },
  { id: 'knowledge', label: '專案知識', icon: 'knowledge' },
];

export function WorkspaceApp() {
  const [page, setPage] = useState(() => {
    const view = new URLSearchParams(location.search).get('view');
    return view && ['reports', 'flows', 'scripts', 'catalog', 'knowledge'].includes(view) ? view : 'analysis';
  });
  const [config, setConfig] = useState<LocalConfig>();
  const [setup, setSetup] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const value = await settings();
      setConfig(value);
      setSetup(!value.configured || !value.initialized || !value.onboardingCompleted);
    } catch {
      setError('無法讀取本機設定，請確認平台已啟動。');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function navigate(id: string) {
    setPage(id);
    const url = new URL(location.href);
    url.searchParams.set('view', id);
    url.searchParams.delete('report');
    history.replaceState(null, '', url);
  }

  async function openSetup() {
    try {
      setConfig(await settings());
      setSetup(true);
      setError('');
    } catch {
      setError('無法載入工作區設定，請確認本機平台已啟動。');
    }
  }

  const navigation = (
    <nav aria-label="主要功能" className="flex flex-1 flex-col justify-between gap-4">
      <div className="flex flex-col gap-1">
        {navItems.map(item => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex min-h-8 w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left text-body',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                active
                  ? 'border-line bg-surface-active font-medium text-ink'
                  : 'border-transparent text-muted hover:bg-surface hover:text-ink active:bg-brand-soft',
              )}
            >
              <WorkspaceIcon name={item.icon} />
              <span className="min-w-0 truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="space-y-2 border-t border-line pt-3">
        {config?.ai && (
          <p
            className="truncate px-2.5 text-body text-muted"
            title={config.ai.cliResolved}
          >
            {`AI：${config.ai.providerLabel || 'Codex'} · ${config.ai.model || '預設模型'}`}
          </p>
        )}
        <button
          type="button"
          data-workspace-setup
          onClick={() => void openSetup()}
          className="flex min-h-8 w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-1.5 text-left text-body text-muted hover:bg-surface hover:text-ink active:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <WorkspaceIcon name="settings" />
          <span>工作區設定</span>
        </button>
        <WorkspaceToast open={!!error} tone="danger" role="alert" onDismiss={() => setError('')}>
          {error}
        </WorkspaceToast>
      </div>
    </nav>
  );

  if (loading || !config) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-6 font-sans text-body text-ink">
        <section
          aria-live="polite"
          className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 text-center"
        >
          <h1 className="text-heading font-bold">Archify Test</h1>
          <p className="mt-3 text-muted">{error || '正在讀取工作區…'}</p>
          {error && (
            <ActionButton icon="refresh" className="mt-4" onClick={() => void load()}>
              重新整理
            </ActionButton>
          )}
        </section>
      </main>
    );
  }

  if (setup || !config.configured || !config.initialized || !config.onboardingCompleted) {
    return (
      <SetupWizard
        initial={config}
        required={!config.configured || !config.initialized || !config.onboardingCompleted}
        onSavedAi={value => {
          setConfig(value);
          setRevision(v => v + 1);
        }}
        onDismiss={() => {
          setSetup(false);
          void settings()
            .then(value => {
              setConfig(value);
              setRevision(v => v + 1);
            })
            .catch(() => {});
          requestAnimationFrame(() =>
            document.querySelector<HTMLButtonElement>('[data-workspace-setup]')?.focus(),
          );
        }}
        onComplete={value => {
          setConfig(value);
          setSetup(false);
          setRevision(v => v + 1);
          navigate('analysis');
        }}
      />
    );
  }

  if (page === 'analysis') {
    return (
      <SourceWorkspace
        key={revision}
        navigation={navigation}
        onKnowledge={() => navigate('knowledge')}
      />
    );
  }
  if (page === 'catalog') {
    return <CatalogWorkspace key={revision} navigation={navigation} />;
  }
  if (page === 'knowledge') {
    return <KnowledgeWorkspace key={revision} navigation={navigation} />;
  }
  if (page === 'flows') {
    return <FlowWorkspace key={revision} navigation={navigation} />;
  }
  if (page === 'scripts') {
    return <ScriptWorkspace key={revision} navigation={navigation} />;
  }
  return <ReportReader key={`${revision}:${page}`} navigation={navigation} kind="execution" />;
}
