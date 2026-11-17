import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { operation, settings } from './client';
import type { Analysis, LocalConfig } from './client';
import { WorkspaceDialog } from './WorkspaceDialog';
import { WorkspaceToast } from './WorkspaceToast';
import {
  ActionButton,
  Badge,
  Banner,
  Disclosure,
  EmptyState,
  MetadataGrid,
  PageHeader,
  SearchField,
  SegmentedGroup,
  StatStrip,
  Surface,
  TextField,
  WorkspaceShell,
  cx,
} from '../../components/ui/ds';

const folderName = (path?: string) => path?.split(/[\\/]/).filter(Boolean).at(-1);

export function SourceWorkspace({
  navigation,
  onKnowledge,
}: {
  navigation: ReactNode;
  onKnowledge: () => void;
}) {
  const [config, setConfig] = useState<LocalConfig>();
  const [sourceSubdir, setSourceSubdir] = useState('');
  const [apiDir, setApiDir] = useState('tests/api');
  const [analysis, setAnalysis] = useState<Analysis>();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [folders, setFolders] = useState<string[]>();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | 'graphql' | 'http'>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [generated, setGenerated] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [removedSelection, setRemovedSelection] = useState<string[]>([]);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [lastArchive, setLastArchive] = useState<string>();

  async function reload() {
    setBusy('config');
    setError('');
    setRemovedSelection([]);
    setConfirmRemoval(false);
    try {
      const value = await settings();
      setConfig(value);
      setApiDir(value.apiDir);
      if (value.initialized) {
        const previous = await operation<Analysis | null>(value, 'analysis');
        setAnalysis(previous || undefined);
        setSkipped(previous?.existingIds || []);
        if (previous) setSourceSubdir(previous.sourceLabel === '.' ? '' : previous.sourceLabel);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '讀取設定失敗。');
    } finally {
      setBusy('');
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function perform(action: string, input = {}) {
    if (!config) return;
    setBusy(action);
    setError('');
    setNotice('');
    try {
      if (action === 'initialize') {
        await operation(config, action);
        setConfig({ ...config, initialized: true });
        setNotice('獨立測試專案已建立，請先在該資料夾執行 npm ci。');
      }
      if (action === 'folders') {
        setFolders(await operation<string[]>(config, action, input));
      }
      if (action === 'scan') {
        const value = await operation<Analysis>(config, action, { sourceSubdir, apiDir });
        setAnalysis(value);
        setSelected([]);
        setGenerated([]);
        setSkipped(value.existingIds || []);
        setQuery('');
        setKind('all');
        setRemovedSelection([]);
      }
      if ((action === 'generate' || action === 'fill') && analysis) {
        const ids = action === 'fill' ? analysis.requests.map(item => item.id) : selected;
        let created = 0;
        let preserved = 0;
        for (let offset = 0; offset < ids.length; offset += 500) {
          const batch = ids.slice(offset, offset + 500);
          const value = await operation<{ created: string[]; skipped: string[] }>(
            config,
            'generate',
            { scanId: analysis.scanId, ids: batch },
          );
          created += value.created.length;
          preserved += value.skipped.length;
          setGenerated(previous => [
            ...new Set([...previous, ...batch.filter(id => !value.skipped.includes(id))]),
          ]);
          setSkipped(previous => [...new Set([...previous, ...value.skipped])]);
          setNotice(`已建立 ${created} 支腳本，${preserved} 支保留原檔。`);
        }
        const latest = await operation<Analysis | null>(config, 'analysis');
        if (latest?.scanId === analysis.scanId) {
          setAnalysis(latest);
          setGenerated([]);
          setSkipped(latest.existingIds || []);
        }
      }
      if (action === 'archive-removed' && analysis) {
        const value = await operation<{ archive: string; paths: string[]; analysis: Analysis }>(
          config,
          action,
          { scanId: analysis.scanId, ids: removedSelection },
        );
        setAnalysis(value.analysis);
        setLastArchive(value.archive);
        setRemovedSelection([]);
        setConfirmRemoval(false);
        setNotice(`已移出 ${value.paths.length} 支腳本，原檔已封存。`);
      }
      if (action === 'restore-removed' && lastArchive) {
        const value = await operation<{ restored: string[]; analysis: Analysis | null }>(
          config,
          action,
          { archive: lastArchive },
        );
        if (value.analysis) setAnalysis(value.analysis);
        setLastArchive(undefined);
        setNotice(`已還原 ${value.restored.length} 支腳本。`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失敗，請重試。');
    } finally {
      setBusy('');
    }
  }

  const rows =
    analysis?.requests.filter(
      item =>
        (kind === 'all' || item.kind === kind) &&
        `${item.name} ${item.endpoint} ${item.service} ${item.evidence.map(row => row.path).join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) || [];
  const allSelected = rows.length > 0 && rows.every(item => selected.includes(item.id));
  const outdated =
    !!analysis && (analysis.apiDir !== apiDir || analysis.sourceLabel !== (sourceSubdir || '.'));
  const existing = new Set([...generated, ...skipped]);
  const missingCount = analysis?.requests.filter(item => !existing.has(item.id)).length || 0;

  return (
    <WorkspaceShell navigation={navigation}>
      <PageHeader
        title="API測試腳本"
        actions={
          <ActionButton
            variant={!analysis ? 'primary' : 'secondary'}
            icon="analysis"
            disabled={!!busy || !config?.initialized}
            onClick={() => void perform('scan')}
          >
            {busy === 'scan' ? '正在分析…' : '分析前端'}
          </ActionButton>
        }
      />

      <WorkspaceToast
        open={!!error || !!notice}
        tone={error ? 'danger' : 'neutral'}
        role={error ? 'alert' : 'status'}
        onDismiss={() => {
          setError('');
          setNotice('');
        }}
      >
        {error || notice}
      </WorkspaceToast>
      {lastArchive && (
        <Banner
          tone="neutral"
          className="mb-5"
          action={
            <ActionButton
              disabled={!!busy}
              onClick={() => void perform('restore-removed')}
            >
              還原上次移除
            </ActionButton>
          }
        >
          <span className="break-all font-mono text-muted">
            legacy/removed-api/{lastArchive}/
          </span>
        </Banner>
      )}

      <StatStrip
        label="專案流程"
        className="mb-5"
        items={[
          {
            label: '讀取前端',
            value: folderName(config?.sourceRoot) || '尚未選擇',
            meta: config?.sourceRoot || undefined,
          },
          {
            label: '輸出腳本',
            value: folderName(config?.projectRoot) || '尚未選擇',
            meta: `${apiDir}/`,
          },
          {
            label: 'AI 參考知識',
            value: (
              <ActionButton
                variant="ghost"
                align="start"
                className="-ml-3"
                onClick={onKnowledge}
              >
                <span className="text-heading font-bold tabular-nums text-ink">
                  {`${config?.knowledgeCount || 0} 份知識`}
                </span>
              </ActionButton>
            ),
            meta: '測試專案知識庫',
          },
        ]}
      />

      <Disclosure
        summary="資料夾設定"
        aria-busy={!!busy}
        className="mb-6"
      >
        <div className="space-y-4">
          <MetadataGrid
            items={[
              {
                label: '前端來源',
                value: <span className="break-all font-mono">{config?.sourceRoot || '尚未設定'}</span>,
              },
              {
                label: '測試專案',
                value: <span className="break-all font-mono">{config?.projectRoot || '尚未設定'}</span>,
              },
            ]}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <TextField
              label="來源子資料夾（留空分析根目錄）"
              value={sourceSubdir}
              disabled={!!busy}
              onChange={event => {
                setSourceSubdir(event.target.value);
                setFolders(undefined);
              }}
            />
            <TextField
              label="中間層腳本輸出資料夾"
              value={apiDir}
              disabled={!!busy}
              onChange={event => setApiDir(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton
              icon="refresh"
              disabled={!!busy}
              onClick={() => void reload()}
            >
              重新讀取設定
            </ActionButton>
            <ActionButton
              icon="folder"
              disabled={!!busy || !config?.configured}
              onClick={() => void perform('folders', { subdir: sourceSubdir })}
            >
              瀏覽來源子資料夾
            </ActionButton>
            {!config?.initialized && (
              <ActionButton
                variant="primary"
                disabled={!!busy || !config?.configured}
                onClick={() => void perform('initialize')}
              >
                {busy === 'initialize' ? '正在初始化…' : '初始化獨立測試專案'}
              </ActionButton>
            )}
          </div>
          {folders && (
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <ActionButton
                variant="ghost"
                onClick={() => {
                  setSourceSubdir('');
                  setFolders(undefined);
                }}
              >
                來源根目錄
              </ActionButton>
              {folders.map(name => (
                <ActionButton
                  key={name}
                  variant="secondary"
                  onClick={() => {
                    setSourceSubdir([sourceSubdir, name].filter(Boolean).join('/'));
                    setFolders(undefined);
                  }}
                >
                  {name}
                </ActionButton>
              ))}
              {!folders.length && <p className="py-1 text-muted">沒有子資料夾。</p>}
            </div>
          )}
          {analysis?.removalNotice && <p className="text-muted">{analysis.removalNotice}</p>}
        </div>
      </Disclosure>

      {!analysis ? (
        <EmptyState
          icon="analysis"
          title="還沒有中間層清單"
          action={
            <ActionButton
              variant="primary"
              disabled={!!busy || !config?.initialized}
              onClick={() => void perform('scan')}
            >
              分析前端
            </ActionButton>
          }
        />
      ) : (
        <section aria-label="中間層清單" className="space-y-4">
          {!!analysis.removed?.length && (
            <Disclosure
              summary={
                <span className="text-warning">
                  前端未再出現（{analysis.removed.length} 支腳本）
                </span>
              }
            >
              <ul className="divide-y divide-line">
                {analysis.removed.map(row => (
                  <li key={row.id} className="py-2">
                    <label className="flex min-h-8 cursor-pointer items-start gap-3">
                      <input
                        className="mt-1 h-4 w-4 shrink-0 accent-brand focus-visible:ring-2 focus-visible:ring-brand"
                        type="checkbox"
                        disabled={!!busy || outdated}
                        checked={removedSelection.includes(row.id)}
                        onChange={() =>
                          setRemovedSelection(previous =>
                            previous.includes(row.id)
                              ? previous.filter(id => id !== row.id)
                              : [...previous, row.id],
                          )
                        }
                      />
                      <span className="min-w-0 break-all">
                        {row.name}
                        <span className="mt-0.5 block font-mono text-muted">{row.path}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <ActionButton
                variant="danger"
                icon="trash"
                className="mt-3"
                disabled={!!busy || outdated || !removedSelection.length || removedSelection.length > 500}
                onClick={() => {
                  setError('');
                  setConfirmRemoval(true);
                }}
              >
                {`移除所選腳本（${removedSelection.length}）`}
              </ActionButton>
            </Disclosure>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-section font-medium">{analysis.requests.length} 支中間層</h2>
              <Badge tone="success" dot>
                {`${analysis.requests.length - missingCount} 已建立`}
              </Badge>
              {missingCount > 0 && (
                <Badge tone="warning" dot>
                  {`${missingCount} 待建立`}
                </Badge>
              )}
            </div>
          </div>

          {!!analysis.warnings.length && (
            <Disclosure
              summary={<span className="text-warning">{`分析提醒（${analysis.warnings.length}）`}</span>}
            >
              <ul className="list-inside list-disc space-y-1 text-muted">
                {analysis.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </Disclosure>
          )}

          {outdated && (
            <Banner tone="warning">位置已變更，請重新分析。</Banner>
          )}

          <Surface padding="sm" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SearchField
                label="搜尋中間層接口"
                placeholder="搜尋中間層、端點、服務或檔案…"
                className="w-full sm:max-w-xs"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
              <SegmentedGroup
                label="接口類型"
                value={kind}
                onChange={setKind}
                options={[
                  { id: 'all', label: '全部' },
                  { id: 'graphql', label: 'GraphQL' },
                  { id: 'http', label: 'HTTP' },
                ]}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <label className="flex min-h-8 cursor-pointer items-center gap-2 text-ink">
                <input
                  className="h-4 w-4 accent-brand focus-visible:ring-2 focus-visible:ring-brand"
                  type="checkbox"
                  checked={allSelected}
                  disabled={!rows.length || !!busy}
                  onChange={() =>
                    setSelected(previous =>
                      allSelected
                        ? previous.filter(id => !rows.some(item => item.id === id))
                        : [...new Set([...previous, ...rows.map(item => item.id)])],
                    )
                  }
                />
                {`選取目前結果（${rows.length}）`}
              </label>
              <div className="flex flex-wrap gap-2">
                <ActionButton
                  disabled={!!busy || outdated || !selected.length || selected.length > 500}
                  onClick={() => void perform('generate')}
                >
                  {busy === 'generate' ? '正在建立…' : `建立所選腳本（${selected.length}）`}
                </ActionButton>
                <ActionButton
                  variant="primary"
                  title="補齊全部分析結果，不受搜尋或類型篩選影響"
                  disabled={!!busy || outdated || !missingCount}
                  onClick={() => void perform('fill')}
                >
                  {busy === 'fill' ? '正在補齊…' : `補齊缺少腳本（${missingCount}）`}
                </ActionButton>
              </div>
            </div>
          </Surface>

          {selected.length > 500 && (
            <Banner tone="warning">一次最多 500 支，請減少選取。</Banner>
          )}

          {!rows.length ? (
            <EmptyState icon="search" title="沒有符合的中間層。" />
          ) : (
            <Surface padding="none" className="overflow-hidden">
              <div className="hidden items-center gap-3 border-b border-line bg-surface-subtle px-3 py-2.5 text-muted lg:flex">
                <span className="w-8 shrink-0" aria-hidden="true" />
                <div className="grid min-w-0 flex-1 grid-cols-api-catalog gap-x-5 px-2 font-medium">
                  <span>中間層</span>
                  <span>腳本檔案</span>
                  <span>建立狀態</span>
                  <span className="text-right">操作</span>
                </div>
              </div>
              <div className="divide-y divide-line">
                {rows.map(item => {
                  const built = existing.has(item.id);
                  return (
                    <article
                      key={item.id}
                      className="flex min-w-0 items-start gap-3 px-3 py-2"
                    >
                      <label className="flex min-h-8 w-8 shrink-0 cursor-pointer items-center justify-center">
                        <input
                          aria-label={`選取 ${item.name}`}
                          className="h-4 w-4 accent-brand focus-visible:ring-2 focus-visible:ring-brand"
                          type="checkbox"
                          disabled={!!busy}
                          checked={selected.includes(item.id)}
                          onChange={() =>
                            setSelected(previous =>
                              previous.includes(item.id)
                                ? previous.filter(id => id !== item.id)
                                : [...previous, item.id],
                            )
                          }
                        />
                      </label>
                      <details className="min-w-0 flex-1">
                        <summary className="grid min-h-8 cursor-pointer list-none items-center gap-x-5 gap-y-1 rounded-lg px-2 py-1 hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:grid-cols-api-catalog">
                          <h3 className="flex min-w-0 flex-wrap items-center gap-2 break-all font-medium text-ink">
                            <span className="min-w-0 break-all">{item.name}</span>
                            {item.kind === 'graphql' && (
                              <Badge tone="neutral">
                                {item.operationType === 'query'
                                  ? '查詢'
                                  : item.operationType === 'mutation'
                                    ? '寫入'
                                    : item.operationType}
                              </Badge>
                            )}
                          </h3>
                          <span
                            className="min-w-0 truncate font-mono text-muted"
                            title={item.caseFile}
                          >
                            {item.caseFile?.split('/').at(-1) || '尚無檔名'}
                          </span>
                          <span className="whitespace-nowrap">
                            <Badge data-script-status tone={built ? 'success' : 'neutral'} dot>
                              {built ? '已建立腳本' : '尚未建立'}
                            </Badge>
                          </span>
                          <span
                            data-catalog-details
                            className="justify-self-end whitespace-nowrap text-right text-muted"
                          >
                            詳情
                          </span>
                        </summary>
                        <div className="mt-2 space-y-3 rounded-lg border border-line bg-canvas p-4 text-muted">
                          <MetadataGrid
                            items={[
                              {
                                label: '腳本',
                                value: (
                                  <span className="break-all font-mono">
                                    {item.caseFile || '需重新分析'}
                                  </span>
                                ),
                              },
                              {
                                label: '端點',
                                value: (
                                  <span className="break-all font-mono">
                                    {item.endpoint || '待確認'}
                                  </span>
                                ),
                              },
                              { label: '服務', value: <span className="break-all">{item.service}</span> },
                              {
                                label: '來源',
                                value: (
                                  <ul className="space-y-1 font-mono">
                                    {item.evidence.map((row, index) => (
                                      <li key={index} className="break-all">
                                        {row.path}:{row.line}
                                      </li>
                                    ))}
                                  </ul>
                                ),
                              },
                            ]}
                          />
                          {!!item.issues.length && (
                            <ul className="list-inside list-disc space-y-1 text-warning">
                              {item.issues.map((issue, index) => (
                                <li key={index}>{issue}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
            </Surface>
          )}
        </section>
      )}

      {confirmRemoval && (
        <WorkspaceDialog
          title="移除未再出現的腳本"
          busy={!!busy}
          onDismiss={() => setConfirmRemoval(false)}
        >
          <p className={cx('mb-3 text-ink')}>
            {`移出 ${removedSelection.length} 支腳本？原檔會封存，可還原。`}
          </p>
          <ul className="mb-4 max-h-60 space-y-1.5 overflow-y-auto rounded-lg border border-line bg-canvas p-3 font-mono text-muted">
            {analysis?.removed
              ?.filter(row => removedSelection.includes(row.id))
              .map(row => (
                <li key={row.id} className="break-all">
                  {row.path}
                </li>
              ))}
          </ul>
          {error && (
            <Banner tone="danger" className="mb-4">
              {error}
            </Banner>
          )}
          <div className="flex justify-end gap-2">
            <ActionButton disabled={!!busy} onClick={() => setConfirmRemoval(false)}>
              取消
            </ActionButton>
            <ActionButton
              variant="danger"
              disabled={!!busy}
              onClick={() => void perform('archive-removed')}
            >
              {busy ? '正在移除…' : '確認移除並封存'}
            </ActionButton>
          </div>
        </WorkspaceDialog>
      )}
    </WorkspaceShell>
  );
}
