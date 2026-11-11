import { useRef, useState } from 'react';
import type { KnowledgeIndex, LocalConfig } from './client';
import { operation, settings } from './client';
import { KnowledgeImport } from './KnowledgeImport';
import {
  ActionButton,
  Banner,
  Surface,
  TextField,
  WorkspaceIcon,
  cx,
} from '../../components/ui/ds';

const steps = ['前端來源', '測試專案', '專案知識'] as const;

export function SetupWizard({
  initial,
  onComplete,
  onDismiss,
  required = false,
}: {
  initial: LocalConfig;
  onComplete: (config: LocalConfig) => void;
  onDismiss: () => void;
  required?: boolean;
}) {
  const [config, setConfig] = useState(initial);
  const [step, setStep] = useState(initial.initialized && initial.configured ? 3 : 1);
  const [source, setSource] = useState(initial.sourceRoot);
  const [project, setProject] = useState(initial.projectRoot);
  const [mode, setMode] = useState<'git' | 'local'>();
  const [url, setUrl] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [count, setCount] = useState(initial.knowledgeCount || 0);
  const pickingRef = useRef(false);
  const locked = busy || importing;

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
    try {
      if (step === 1) {
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
        setStep(2);
      } else if (step === 2) {
        await operation(config, 'setup', { sourceRoot: source, projectRoot: project });
        const value = await settings();
        setConfig(value);
        const knowledge = await operation<KnowledgeIndex>(value, 'knowledge');
        setCount(knowledge.documents.filter(row => !('missing' in row && row.missing)).length);
        setStep(3);
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
      ? mode === 'git'
        ? !!url.trim() && !!destination.trim()
        : mode === 'local' && !!source.trim()
      : step === 2
        ? !!project.trim()
        : count > 0;

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

        <ol aria-label="設定進度" className="mb-8 grid grid-cols-3 gap-3">
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
          {step === 1 ? '前端架構分析' : step === 2 ? '測試專案放置位置' : '上傳 PRD、業務流程文件'}
        </h1>

        {step === 1 ? (
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
        ) : step === 2 ? (
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

        {locked && !picking && !importing && (
          <Banner tone="neutral" className="mt-5">
            {step === 1 && mode === 'git'
              ? '正在下載前端，最長約兩分鐘…'
              : step === 1
                ? '正在驗證前端來源…'
                : step === 2
                  ? '正在建立框架並分析前端…'
                  : '正在儲存設定…'}
          </Banner>
        )}
        {error && (
          <Banner tone="danger" className="mt-5">
            {error}
          </Banner>
        )}

        <footer className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
          <div>
            {step > 1 && (
              <ActionButton
                disabled={locked}
                onClick={() => {
                  setStep(step - 1);
                  if (step === 2 && !mode) setMode('local');
                  setError('');
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
            {step === 3 ? '完成設定' : step === 1 && mode === 'git' ? '下載並繼續' : '下一步'}
          </ActionButton>
        </footer>
      </section>
    </main>
  );
}
