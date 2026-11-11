import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  KnowledgeDocument,
  KnowledgeIndex,
  KnowledgeSource,
  LocalConfig,
} from './client';
import { operation, settings } from './client';
import { KnowledgeImport } from './KnowledgeImport';
import { WorkspaceDialog } from './WorkspaceDialog';
import { useAiJob } from './useAiJob';
import { AiJobStatus } from './AiJobStatus';
import {
  ActionButton,
  Badge,
  Banner,
  EmptyState,
  PageHeader,
  SearchField,
  Surface,
  TextAreaField,
  TextField,
  WorkspaceShell,
  cx,
} from '../../components/ui/ds';

const categories = [
  ['business', '業務規則'],
  ['api', 'API 文件'],
  ['testing', '測試規範'],
  ['notes', '補充說明'],
] as const;

export function KnowledgeWorkspace({ navigation }: { navigation: ReactNode }) {
  const [config, setConfig] = useState<LocalConfig>();
  const [index, setIndex] = useState<KnowledgeIndex>();
  const [document, setDocument] = useState<KnowledgeDocument>();
  const [archive, setArchive] = useState<KnowledgeDocument>();
  const [sourceView, setSourceView] = useState<{ url: string; name: string }>();
  const [showImport, setShowImport] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<KnowledgeDocument>();
  const [category, setCategory] = useState('all');
  const [featureIdsText, setFeatureIdsText] = useState('');
  const [restore, setRestore] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ai = useAiJob(config);

  useEffect(() => {
    setSourceView(undefined);
  }, [document?.id]);

  useEffect(
    () => () => {
      if (sourceView) URL.revokeObjectURL(sourceView.url);
    },
    [sourceView?.url],
  );

  useEffect(() => {
    if (ai.job?.kind === 'knowledge' && ai.job.status === 'completed') void reload();
  }, [ai.job?.id, ai.job?.status]);

  async function openSource(source: KnowledgeSource) {
    if (!config || !document) return;
    setBusy(true);
    setError('');
    try {
      const result = await operation<KnowledgeSource & { base64: string }>(
        config,
        'knowledge-source',
        { id: document.id, sha256: source.sha256 },
      );
      const raw = atob(result.base64);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      const url = URL.createObjectURL(
        new Blob([bytes.buffer], {
          type: result.kind === 'image' ? result.mediaType : 'application/octet-stream',
        }),
      );
      if (result.kind === 'image') {
        setSourceView({ url, name: result.name });
      } else {
        const link = window.document.createElement('a');
        link.href = url;
        link.download = result.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '無法讀取原始來源。');
    } finally {
      setBusy(false);
    }
  }

  async function restoreAi() {
    if (!config) return;
    setBusy(true);
    setError('');
    try {
      await operation(config, 'knowledge-ai-restore');
      setRestore(false);
      setDocument(undefined);
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '還原失敗');
    } finally {
      setBusy(false);
    }
  }

  async function reload() {
    setBusy(true);
    setError('');
    try {
      const value = await settings();
      setConfig(value);
      if (value.initialized) setIndex(await operation<KnowledgeIndex>(value, 'knowledge'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '無法載入知識庫。');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function read(row: KnowledgeDocument) {
    if (!config) return;
    setBusy(true);
    setError('');
    try {
      setDocument(await operation<KnowledgeDocument>(config, 'knowledge-document', { id: row.id }));
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '讀取失敗。');
    } finally {
      setBusy(false);
    }
  }

  async function confirmArchive() {
    if (!config || !archive) return;
    setBusy(true);
    setError('');
    try {
      await operation(config, 'knowledge-archive', { id: archive.id });
      if (document?.id === archive.id) setDocument(undefined);
      setArchive(undefined);
      setIndex(await operation<KnowledgeIndex>(config, 'knowledge'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '封存失敗，請重試。');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!config || !draft || !document) return;
    setBusy(true);
    setError('');
    try {
      setDocument(
        await operation<KnowledgeDocument>(config, 'knowledge-update', {
          ...draft,
          featureIds: featureIdsText
            .split(/[,，]/)
            .map(value => value.trim())
            .filter(Boolean),
          expectedHash: document.hash,
          expectedRevision: document.revision,
        }),
      );
      setIndex(await operation<KnowledgeIndex>(config, 'knowledge'));
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '儲存失敗。');
    } finally {
      setBusy(false);
    }
  }

  const rows =
    index?.documents.filter(
      row =>
        row.title.toLowerCase().includes(query.toLowerCase()) &&
        (category === 'all' || (row.category || 'notes') === category),
    ) || [];

  return (
    <WorkspaceShell navigation={navigation}>
      <PageHeader
        title="專案知識"
        meta={
          config?.initialized && (
            <span className="break-all font-mono">{`${config.projectRoot}/knowledge/`}</span>
          )
        }
        actions={
          <>
            <ActionButton
              icon="refresh"
              disabled={busy || editing}
              onClick={() => void reload()}
            >
              {busy ? '正在讀取…' : '重新整理知識'}
            </ActionButton>
            <ActionButton
              variant="primary"
              icon={showImport ? 'close' : 'plus'}
              disabled={importBusy || editing}
              aria-expanded={showImport}
              aria-controls="knowledge-import-panel"
              onClick={() => setShowImport(previous => !previous)}
            >
              {showImport ? '收起新增' : '新增知識'}
            </ActionButton>
          </>
        }
      />

      {!showImport && (
        <AiJobStatus
          job={ai.job?.kind === 'knowledge' ? ai.job : undefined}
          error={ai.error}
          onCancel={() => void ai.cancel()}
        />
      )}
      {error && (
        <Banner tone="danger" className="mb-5">
          {error}
        </Banner>
      )}
      {config && !config.initialized && (
        <EmptyState icon="settings" title="請先開啟「工作區設定」。" />
      )}

      {config?.initialized && (
        <div className="space-y-5">
          {index?.lastAiUpdate && (
            <Banner
              tone={index.lastAiUpdate.conflicts.length ? 'warning' : 'neutral'}
              action={
                <ActionButton
                  disabled={busy || editing}
                  onClick={() => setRestore(true)}
                >
                  還原上次 AI 更新
                </ActionButton>
              }
            >
              <p className="text-muted">
                {`最近 AI 更新：${new Date(index.lastAiUpdate.at).toLocaleString('zh-TW')}`}
              </p>
              {!showImport &&
                !(ai.job?.kind === 'knowledge' && ai.job.status === 'completed') &&
                !!index.lastAiUpdate.conflicts.length && (
                  <ul className="mt-2 list-inside list-disc space-y-1 text-warning">
                    {index.lastAiUpdate.conflicts.map(text => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                )}
            </Banner>
          )}

          {showImport && (
            <Surface id="knowledge-import-panel" aria-label="補充知識">
              <KnowledgeImport
                config={config}
                onBusy={setImportBusy}
                onImported={() => void reload()}
              />
            </Surface>
          )}

          <div className="grid min-w-0 gap-5 lg:grid-cols-knowledge-reader">
            <section className="min-w-0 space-y-3" aria-labelledby="knowledge-list-title">
              <h2 id="knowledge-list-title" className="text-section font-medium text-ink">
                {`已匯入知識（${index?.documents.length || 0}）`}
              </h2>
              <SearchField
                label="搜尋知識"
                placeholder="搜尋文件"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
              <div className="flex flex-wrap gap-1.5" aria-label="知識分類">
                {[['all', '全部'], ...categories].map(([id, label]) => (
                  <ActionButton
                    key={id}
                    variant={category === id ? 'primary' : 'ghost'}
                    disabled={editing}
                    aria-pressed={category === id}
                    onClick={() => setCategory(id)}
                  >
                    {label}
                  </ActionButton>
                ))}
              </div>
              {!rows.length ? (
                <p className="py-6 text-muted">
                  {query ? '沒有符合的文件。' : '尚未匯入知識文件。'}
                </p>
              ) : (
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                  {rows.map(row => {
                    const active = document?.id === row.id;
                    const catLabel =
                      categories.find(([id]) => id === (row.category || 'notes'))?.[1] ||
                      '補充說明';
                    return (
                      <li
                        key={row.id}
                        className={cx('p-2.5', active && 'bg-surface-active')}
                      >
                        <ActionButton
                          variant="ghost"
                          align="start"
                          aria-pressed={active}
                          disabled={busy || editing}
                          onClick={() => void read(row)}
                          className={cx(
                            'w-full break-all font-medium',
                            active && 'bg-brand-soft text-ink',
                          )}
                        >
                          {row.title}
                        </ActionButton>
                        <div className="mt-1.5 flex items-center justify-between gap-2 px-3">
                          <Badge tone="neutral">{catLabel}</Badge>
                          <ActionButton
                            variant="ghost"
                            disabled={busy || editing}
                            onClick={() => setArchive(row)}
                            aria-label={`封存 ${row.title}`}
                          >
                            封存
                          </ActionButton>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <Surface padding="lg" aria-label="知識內容">
              {document ? (
                <>
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="break-all text-section font-bold text-ink">{document.title}</h2>
                      {!editing && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone="neutral">
                            {categories.find(([id]) => id === (document.category || 'notes'))?.[1] ||
                              '補充說明'}
                          </Badge>
                          {(document.featureIds || []).length > 0 ? (
                            document.featureIds!.map(fid => (
                              <Badge key={fid} tone="neutral">
                                {fid}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted">整個專案</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <ActionButton
                        icon="edit"
                        disabled={busy || editing}
                        onClick={() => {
                          setDraft({ ...document });
                          setFeatureIdsText((document.featureIds || []).join(', '));
                          setEditing(true);
                        }}
                      >
                        編輯知識
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        disabled={editing}
                        onClick={() => setDocument(undefined)}
                      >
                        收起內容
                      </ActionButton>
                    </div>
                  </div>

                  {editing && draft ? (
                    <form
                      className="space-y-4"
                      onSubmit={event => {
                        event.preventDefault();
                        void save();
                      }}
                    >
                      <TextField
                        label="知識名稱"
                        required
                        maxLength={200}
                        disabled={busy}
                        value={draft.title}
                        onChange={event => setDraft({ ...draft, title: event.target.value })}
                      />
                      <fieldset>
                        <legend className="mb-2 font-medium text-ink">分類</legend>
                        <div className="flex flex-wrap gap-2">
                          {categories.map(([id, label]) => (
                            <ActionButton
                              key={id}
                              variant={(draft.category || 'notes') === id ? 'primary' : 'secondary'}
                              disabled={busy}
                              aria-pressed={(draft.category || 'notes') === id}
                              onClick={() => setDraft({ ...draft, category: id })}
                            >
                              {label}
                            </ActionButton>
                          ))}
                        </div>
                      </fieldset>
                      <TextField
                        label="適用功能編號"
                        disabled={busy}
                        value={featureIdsText}
                        onChange={event => setFeatureIdsText(event.target.value)}
                        placeholder="F-LOGIN, F-CARD"
                      />
                      <TextAreaField
                        label="知識內容"
                        required
                        rows={12}
                        disabled={busy}
                        value={draft.content || ''}
                        onChange={event => setDraft({ ...draft, content: event.target.value })}
                      />
                      <div className="flex gap-2">
                        <ActionButton type="submit" variant="primary" disabled={busy}>
                          {busy ? '正在儲存…' : '儲存知識'}
                        </ActionButton>
                        <ActionButton disabled={busy} onClick={() => setEditing(false)}>
                          取消
                        </ActionButton>
                      </div>
                    </form>
                  ) : (
                    <>
                      <pre className="max-w-prose whitespace-pre-wrap break-words font-sans text-body text-ink">
                        {document.content}
                      </pre>
                      {!!document.sources?.length && (
                        <section className="mt-6 border-t border-line pt-4" aria-label="原始來源">
                          <h3 className="font-medium text-ink">原始來源</h3>
                          <ul className="mt-3 flex flex-wrap gap-2">
                            {document.sources.map(source => (
                              <li key={source.path}>
                                <ActionButton
                                  icon={source.kind === 'image' ? 'open' : 'download'}
                                  disabled={busy}
                                  onClick={() => void openSource(source)}
                                >
                                  {`${source.kind === 'image' ? '查看原圖' : '下載原檔'}：${source.name}`}
                                </ActionButton>
                              </li>
                            ))}
                          </ul>
                          {sourceView && (
                            <figure className="mt-4 rounded-xl border border-line bg-canvas p-3">
                              <figcaption className="mb-2 break-all text-muted">
                                {sourceView.name}
                              </figcaption>
                              <img
                                src={sourceView.url}
                                alt={sourceView.name}
                                className="max-h-96 max-w-full rounded-lg border border-line object-contain"
                              />
                            </figure>
                          )}
                        </section>
                      )}
                    </>
                  )}
                </>
              ) : (
                <EmptyState
                  icon="knowledge"
                  title="選一份文件，查看內容"
                  className="min-h-64 border-0 bg-transparent"
                />
              )}
            </Surface>
          </div>
        </div>
      )}

      {restore && (
        <WorkspaceDialog
          title="還原上次 AI 知識更新"
          busy={busy}
          onDismiss={() => setRestore(false)}
        >
          <p className="mb-5 text-muted">
            還原被取代的舊知識與案例關聯，原封存仍保留；若後續已有手動修改會拒絕覆寫。
          </p>
          <div className="flex justify-end gap-2">
            <ActionButton disabled={busy} onClick={() => setRestore(false)}>
              取消
            </ActionButton>
            <ActionButton variant="danger" disabled={busy} onClick={() => void restoreAi()}>
              確認還原
            </ActionButton>
          </div>
        </WorkspaceDialog>
      )}

      {archive && (
        <WorkspaceDialog
          title="封存知識文件"
          busy={busy}
          onDismiss={() => setArchive(undefined)}
        >
          <p className="break-all text-ink">{`封存「${archive.title}」？`}</p>
          <p className="mt-2 text-muted">保留原檔，僅從有效知識清單移除。</p>
          {error && (
            <Banner tone="danger" className="mt-4">
              {error}
            </Banner>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <ActionButton disabled={busy} onClick={() => setArchive(undefined)}>
              取消
            </ActionButton>
            <ActionButton
              variant="danger"
              disabled={busy}
              onClick={() => void confirmArchive()}
            >
              {busy ? '正在封存…' : '確認封存'}
            </ActionButton>
          </div>
        </WorkspaceDialog>
      )}
    </WorkspaceShell>
  );
}
