import { useEffect, useRef, useState } from 'react';
import type {
  AiInspectResult,
  AiProviderId,
  AiTestResult,
  KnowledgeIndex,
  LocalConfig,
} from './client';
import { operation, settings } from './client';
import { KnowledgeImport } from './KnowledgeImport';
import { WorkspaceToast } from './WorkspaceToast';
import { Dropdown } from '../../components/ui/Dropdown';
import {
  ActionButton,
  Disclosure,
  StatusDot,
  Surface,
  TextField,
  WorkspaceIcon,
  cx,
} from '../../components/ui/ds';

const steps = ['AI CLI', '前端來源', '測試專案', '專案知識'] as const;

const providerMeta: readonly { id: AiProviderId; title: string }[] = [
  { id: 'codex', title: 'Codex' },
  { id: 'claude', title: 'Claude Code' },
  { id: 'gemini', title: 'Gemini' },
];

export function SetupWizard({
  initial,
  onComplete,
  onDismiss,
  onSavedAi,
  required = false,
}: {
  initial: LocalConfig;
  onComplete: (config: LocalConfig) => void;
  onDismiss: () => void;
  onSavedAi?: (config: LocalConfig) => void;
  required?: boolean;
}) {
  const [config, setConfig] = useState(initial);
  const [step, setStep] = useState(required && initial.initialized && initial.configured ? 4 : 1);
  const [aiProvider, setAiProvider] = useState<AiProviderId>(initial.ai?.provider || 'codex');
  const [aiCli, setAiCli] = useState(initial.ai?.cliConfigured || '');
  const [aiModel, setAiModel] = useState(initial.ai?.model || '');
  const [customModelMode, setCustomModelMode] = useState(false);
  const [inspected, setInspected] = useState<AiInspectResult>();
  const [inspecting, setInspecting] = useState(false);
  const [testingCli, setTestingCli] = useState(false);
  const [savingCli, setSavingCli] = useState(false);
  const [source, setSource] = useState(initial.sourceRoot);
  const [project, setProject] = useState(initial.projectRoot);
  const [mode, setMode] = useState<'git' | 'local'>();
  const [url, setUrl] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [count, setCount] = useState(initial.knowledgeCount || 0);
  const pickingRef = useRef(false);
  const locked = busy || importing || testingCli || savingCli;

  async function inspectCli(targetProvider = aiProvider, customPath = aiCli) {
    setInspecting(true);
    try {
      const result = await operation<AiInspectResult>(config, 'ai-inspect', {
        aiProvider: targetProvider,
        ...(customPath.trim() ? { aiCli: customPath.trim() } : {}),
      });
      setInspected(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '無法偵測 AI CLI 狀態。');
    } finally {
      setInspecting(false);
    }
  }

  useEffect(() => {
    void inspectCli(initial.ai?.provider || 'codex', initial.ai?.cliConfigured || '');
  }, []);

  async function testCli() {
    setTestingCli(true);
    setError('');
    setNotice('');
    try {
      const result = await operation<AiTestResult>(config, 'ai-test', {
        aiProvider,
        aiCli,
        aiModel,
      });
      setNotice(
        `${result.label || activeMeta.title} 連線正常${result.model ? `（${result.model}）` : ''}`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'CLI 測試連線失敗，請核對登入與模型。');
    } finally {
      setTestingCli(false);
    }
  }

  async function saveCli() {
    setSavingCli(true);
    setError('');
    setNotice('');
    try {
      const saved = await operation<LocalConfig>(config, 'ai-settings', {
        aiProvider,
        aiCli,
        aiModel,
      });
      const merged = { ...saved, session: saved.session || config.session };
      setConfig(merged);
      onSavedAi?.(merged);
      const label = providerMeta.find(item => item.id === aiProvider)?.title || aiProvider;
      setNotice(`已儲存 ${label}${aiModel.trim() ? ` · ${aiModel.trim()}` : ''}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '無法儲存 AI CLI 設定。');
    } finally {
      setSavingCli(false);
    }
  }

  async function choose(kind: 'source' | 'project', targetMode = mode) {
    if (pickingRef.current || locked) return;
    pickingRef.current = true;
    setBusy(true);
    setPicking(true);
    setError('');
    try {
      const value = await operation<{ path: string; cancelled: boolean }>(
        config,
        'pick-directory',
        { kind },
      );
      if (!value.cancelled) {
        if (kind === 'project') {
          setProject(value.path);
        } else if (targetMode === 'git') {
          const name = url.split(/[/:]/).at(-1)?.replace(/\.git$/, '') || 'frontend';
          setDestination(
            value.path.replace(/[\\/]$/, '') + '/' + name.replace(/[^a-zA-Z0-9_.-]/g, '-'),
          );
        } else {
          setSource(value.path);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '請貼上資料夾路徑。');
    } finally {
      pickingRef.current = false;
      setPicking(false);
      setBusy(false);
    }
  }

  async function next() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (step === 1) {
        const saved = await operation<LocalConfig>(config, 'ai-settings', {
          aiProvider,
          aiCli,
          aiModel,
        });
        const merged = { ...saved, session: saved.session || config.session };
        setConfig(merged);
        onSavedAi?.(merged);
        if (!mode && saved.sourceRoot) setMode('local');
        setStep(2);
      } else if (step === 2) {
        let path = source;
        if (mode === 'git') {
          path = (
            await operation<{ path: string }>(config, 'clone-source', {
              url,
              path: destination,
            })
          ).path;
          setSource(path);
          setMode('local');
        }
        await operation(config, 'validate-source', { path });
        setStep(3);
      } else if (step === 3) {
        await operation(config, 'setup', { sourceRoot: source, projectRoot: project });
        const value = await settings();
        setConfig(value);
        const knowledge = await operation<KnowledgeIndex>(value, 'knowledge');
        setCount(knowledge.documents.filter(row => !('missing' in row && row.missing)).length);
        setStep(4);
      } else {
        await operation(config, 'setup-complete');
        onComplete(await settings());
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '設定失敗，請重試。');
    } finally {
      setBusy(false);
    }
  }

  const enabled =
    step === 1
      ? true
      : step === 2
        ? mode === 'git'
          ? !!url.trim() && !!destination.trim()
          : mode === 'local' && !!source.trim()
        : step === 3
          ? !!project.trim()
          : count > 0;

  const activeProviderInfo =
    inspected?.providers?.[aiProvider] ||
    (inspected?.provider === aiProvider ? inspected : undefined);
  const activeMeta = providerMeta.find(item => item.id === aiProvider) || providerMeta[0];
  const cliResolved =
    activeProviderInfo?.cliResolved ||
    (config.ai?.provider === aiProvider ? config.ai.cliResolved : aiProvider);
  const cliInstalled = activeProviderInfo
    ? activeProviderInfo.installed
    : config.ai?.provider === aiProvider
      ? config.ai.installed
      : false;
  const discoveredModels = activeProviderInfo?.models || [];
  const modelInList = discoveredModels.some(option => option.value === aiModel);
  const dropdownModelValue =
    customModelMode || (!!aiModel && !modelInList) ? '__custom__' : aiModel;
  const modelOptions = [
    { value: '', label: '工具預設' },
    ...discoveredModels,
    { value: '__custom__', label: '自訂' },
  ];

  const progressText = testingCli
    ? '正在測試連線…'
    : savingCli
      ? '正在儲存…'
      : locked && !picking && !importing
        ? step === 1
          ? '正在儲存…'
          : step === 2 && mode === 'git'
            ? '正在下載前端，最長約兩分鐘…'
            : step === 2
              ? '正在驗證前端來源…'
              : step === 3
                ? '正在建立框架並分析前端…'
                : '正在儲存設定…'
        : '';

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-5 font-sans text-body text-ink lg:p-10">
      <section className="w-full max-w-3xl" aria-labelledby="setup-title" aria-busy={locked}>
        <header className="mb-8 flex items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5 text-ink"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 17L12 4l8 13H4Z" />
              <path d="M9 17l3-5 3 5" />
            </svg>
            <p className="text-section font-bold">Archify Test</p>
          </div>
          {!required && (
            <ActionButton variant="ghost" disabled={locked} onClick={onDismiss}>
              返回工作區
            </ActionButton>
          )}
        </header>

        <ol aria-label="設定進度" className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {steps.map((title, index) => {
            const number = index + 1;
            const current = step === number;
            const done = step > number;
            return (
              <li
                key={title}
                aria-current={current ? 'step' : undefined}
                className={cx(
                  'flex items-center gap-3 rounded-xl border px-3.5 py-2.5',
                  current
                    ? 'border-line-strong bg-surface text-ink'
                    : done
                      ? 'border-line bg-surface-subtle text-ink'
                      : 'border-line bg-canvas text-muted',
                )}
              >
                <span
                  className={cx(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-body font-medium tabular-nums',
                    current
                      ? 'border-brand bg-brand text-on-brand'
                      : done
                        ? 'border-success/40 bg-success-soft text-success'
                        : 'border-line-strong text-muted',
                  )}
                >
                  {done ? <WorkspaceIcon name="check" className="h-3.5 w-3.5" /> : number}
                </span>
                <span className={cx('min-w-0 truncate', current && 'font-medium')}>{title}</span>
              </li>
            );
          })}
        </ol>

        <h1 id="setup-title" className="mb-6 text-title font-bold">
          {step === 1
            ? 'AI CLI 設定'
            : step === 2
              ? '前端架構分析'
              : step === 3
                ? '測試專案放置位置'
                : '上傳 PRD、業務流程文件'}
        </h1>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="AI CLI 工具">
              {providerMeta.map(item => {
                const info = inspected?.providers?.[item.id];
                const selected = aiProvider === item.id;
                const dotTone = !info?.installed
                  ? 'danger'
                  : info.loggedIn === true
                    ? 'success'
                    : info.loggedIn === false
                      ? 'warning'
                      : 'neutral';
                const statusText = inspecting
                  ? '偵測中'
                  : !info?.installed
                    ? '未安裝'
                    : info.loggedIn === true
                      ? '已登入'
                      : info.loggedIn === false
                        ? '未登入'
                        : '已安裝';
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={locked}
                    onClick={() => {
                      setAiProvider(item.id);
                      const keepSaved = config.ai?.provider === item.id;
                      setAiCli(keepSaved ? config.ai?.cliConfigured || '' : '');
                      setAiModel(keepSaved ? config.ai?.model || '' : '');
                      setCustomModelMode(false);
                      setError('');
                      setNotice('');
                    }}
                    className={cx(
                      'flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left',
                      'hover:bg-surface-subtle active:bg-surface-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50',
                      selected
                        ? 'border-brand bg-surface'
                        : 'border-line bg-canvas',
                    )}
                  >
                    <span className="font-medium text-ink">{item.title}</span>
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <StatusDot tone={dotTone} />
                      <span>{statusText}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <Surface className="space-y-4" padding="lg">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-section font-medium text-ink">{activeMeta.title}</p>
                    {activeProviderInfo?.version && (
                      <span className="font-mono text-muted">v{activeProviderInfo.version}</span>
                    )}
                    <span className="text-muted">
                      {aiProvider === 'codex' ? '文字與圖片' : '僅支援文字'}
                    </span>
                  </div>
                  <p className="break-all font-mono text-muted">
                    {cliInstalled ? cliResolved : '未找到執行檔'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ActionButton
                    icon="refresh"
                    disabled={locked || inspecting}
                    onClick={() => void inspectCli(aiProvider, aiCli)}
                  >
                    重新偵測
                  </ActionButton>
                  <ActionButton
                    disabled={locked || inspecting}
                    onClick={() => void testCli()}
                  >
                    {testingCli ? '測試中…' : '測試連線'}
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    disabled={locked || inspecting}
                    onClick={() => void saveCli()}
                  >
                    {savingCli ? '儲存中…' : '儲存'}
                  </ActionButton>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="font-medium text-ink">模型</p>
                <Dropdown
                  label="模型"
                  value={dropdownModelValue}
                  disabled={locked}
                  options={modelOptions}
                  onChange={value => {
                    setError('');
                    setNotice('');
                    if (value === '__custom__') {
                      setCustomModelMode(true);
                    } else {
                      setCustomModelMode(false);
                      setAiModel(value);
                    }
                  }}
                />
              </div>

              {(customModelMode || (!!aiModel && !modelInList)) && (
                <TextField
                  label="模型名稱"
                  value={aiModel}
                  disabled={locked}
                  placeholder="例如 o4-mini、sonnet"
                  onChange={event => {
                    setAiModel(event.target.value);
                    setError('');
                    setNotice('');
                  }}
                />
              )}

              <Disclosure summary="自訂執行檔路徑">
                <TextField
                  label="執行檔路徑"
                  value={aiCli}
                  disabled={locked}
                  placeholder="留空自動偵測"
                  onChange={event => {
                    setAiCli(event.target.value);
                    setError('');
                    setNotice('');
                  }}
                />
              </Disclosure>
            </Surface>
          </div>
        ) : step === 2 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2" role="group" aria-label="來源方式">
              {(
                [
                  ['git', 'Git 下載', '從儲存庫下載', 'git'],
                  ['local', '本機資料夾', '讀取電腦中的程式碼', 'folder'],
                ] as const
              ).map(([value, title, caption, icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  disabled={locked}
                  onClick={() => {
                    setMode(value);
                    setError('');
                    if (value === 'local') {
                      void choose('source', 'local');
                    }
                  }}
                  className={cx(
                    'flex min-h-36 flex-col items-start justify-between gap-4 rounded-xl border p-5 text-left',
                    'hover:bg-surface active:bg-surface-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50',
                    mode === value
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-surface-subtle',
                  )}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-muted">
                    <WorkspaceIcon name={icon} className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-section font-medium text-ink">{title}</span>
                    <span className="mt-1 block text-muted">{caption}</span>
                  </span>
                </button>
              ))}
            </div>
            {mode && (
              <Surface className="mt-5 space-y-4">
                {mode === 'git' ? (
                  <>
                    <TextField
                      label="Git 網址"
                      value={url}
                      disabled={locked}
                      placeholder="https://github.com/team/frontend.git"
                      hint="公開 HTTPS 或已設定金鑰 SSH"
                      onChange={e => {
                        setUrl(e.target.value);
                        setError('');
                      }}
                    />
                    <div className="flex flex-wrap items-end gap-3">
                      <TextField
                        label="下載資料夾"
                        className="flex-1"
                        value={destination}
                        disabled={locked}
                        onChange={e => setDestination(e.target.value)}
                      />
                      <ActionButton
                        icon="folder"
                        disabled={locked}
                        onClick={() => void choose('source', 'git')}
                      >
                        選擇下載位置
                      </ActionButton>
                    </div>
                  </>
                ) : (
                  <TextField
                    label="前端專案路徑"
                    value={source}
                    disabled={locked}
                    onChange={e => {
                      setSource(e.target.value);
                      setError('');
                    }}
                  />
                )}
              </Surface>
            )}
          </>
        ) : step === 3 ? (
          <Surface className="mx-auto max-w-xl space-y-5" padding="lg">
            <button
              type="button"
              disabled={locked}
              onClick={() => void choose('project')}
              className="flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-lg border border-line-strong bg-canvas p-5 hover:bg-brand-soft active:bg-surface-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-muted">
                <WorkspaceIcon name="folder" className="h-5 w-5" />
              </span>
              <span className="font-medium text-ink">選擇測試資料夾</span>
            </button>
            <TextField
              label="獨立測試專案路徑"
              value={project}
              disabled={locked}
              hint="位於前端與平台目錄之外；保留既有內容"
              onChange={e => {
                setProject(e.target.value);
                setError('');
              }}
            />
          </Surface>
        ) : (
          <div className="mx-auto max-w-xl space-y-4">
            <KnowledgeImport
              compact
              config={config}
              onBusy={setImporting}
              onImported={() => {
                void operation<KnowledgeIndex>(config, 'knowledge')
                  .then(value => setCount(value.documents.length))
                  .catch(() => setError('無法更新知識清單，請重試。'));
              }}
            />
            {count > 0 && (
              <p role="status" className="text-center text-muted">
                已匯入 {count} 份知識
              </p>
            )}
          </div>
        )}

        <WorkspaceToast
          open={!!error || !!notice || !!progressText}
          tone={error ? 'danger' : notice ? 'success' : 'neutral'}
          role={error ? 'alert' : 'status'}
          autoHideMs={error || notice ? 3000 : 0}
          onDismiss={
            error ? () => setError('') : notice ? () => setNotice('') : undefined
          }
        >
          {error || notice || progressText}
        </WorkspaceToast>

        <footer className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
          <div>
            {step > 1 && (
              <ActionButton
                disabled={locked}
                onClick={() => {
                  setStep(step - 1);
                  if (step === 3 && !mode && source) setMode('local');
                  setError('');
                  setNotice('');
                }}
              >
                上一步
              </ActionButton>
            )}
          </div>
          <ActionButton
            variant="primary"
            disabled={locked || !enabled}
            onClick={() => void next()}
          >
            {step === 4 ? '完成設定' : step === 2 && mode === 'git' ? '下載並繼續' : '下一步'}
          </ActionButton>
        </footer>
      </section>
    </main>
  );
}
