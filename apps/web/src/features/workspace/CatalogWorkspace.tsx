import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { operation, settings } from './client';
import type { LocalConfig } from './client';
import { CaseEditor } from './CaseEditor';
import { FeatureMap } from './FeatureMap';
import { GapReport } from './GapReport';
import { MapDetails } from './MapDetails';
import { featureCoverage, featureGraph } from './feature-graph';
import type { MapNode } from './feature-graph';
import type { CatalogView, TestIntent, Feature } from './catalog';
import { resultLabels, organizeFeaturesTask, featureTestDraftHandoff } from './catalog';
import { useAiJob } from './useAiJob';
import { AiJobStatus } from './AiJobStatus';
import {
  ActionButton,
  Badge,
  Banner,
  Disclosure,
  EmptyState,
  PageHeader,
  SearchField,
  SegmentedGroup,
  StatStrip,
  StatusDot,
  Surface,
  WorkspaceShell,
  cx,
} from '../../components/ui/ds';
import type { Tone } from '../../components/ui/ds';

const covDotTone: Record<'full' | 'partial' | 'none' | 'retired', Tone> = {
  full: 'success',
  partial: 'warning',
  none: 'danger',
  retired: 'neutral',
};

export function CatalogWorkspace({ navigation }: { navigation: ReactNode }) {
  const [config, setConfig] = useState<LocalConfig>();
  const [view, setView] = useState<CatalogView>();
  const [featureId, setFeatureId] = useState('overview');
  const [selected, setSelected] = useState<MapNode>();
  const [editor, setEditor] = useState<TestIntent>();
  const [layer, setLayer] = useState<'product' | 'tests'>('product');
  const [mode, setMode] = useState<'map' | 'list' | 'gaps'>('map');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [code, setCode] = useState<{ path: string; content: string }>();

  const ai = useAiJob(config);

  useEffect(() => {
    if (ai.job?.kind === 'features' && ai.job.status === 'completed') void reload();
  }, [ai.job?.id, ai.job?.status]);

  async function reload() {
    setBusy(true);
    setError('');
    setCode(undefined);
    setSelected(undefined);
    try {
      const value = await settings();
      setConfig(value);
      if (value.initialized) {
        const next = await operation<CatalogView>(value, 'catalog');
        setView(next);
        setFeatureId(previous =>
          previous === 'overview' || next.catalog.features.some(feature => feature.id === previous)
            ? previous
            : 'overview',
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '無法讀取功能。');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const cases =
    view?.cases.filter(row => featureId === 'overview' || row.featureId === featureId) || [];
  const features =
    view?.catalog.features.filter(feature =>
      `${feature.name} ${view.cases
        .filter(row => row.featureId === feature.id)
        .map(row => row.title)
        .join(' ')}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) || [];

  async function readCode(scope: string, path: string) {
    if (!config) return;
    setBusy(true);
    setError('');
    try {
      setCode(await operation(config, 'catalog-source', { scope, path }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '無法讀取來源。');
    } finally {
      setBusy(false);
    }
  }

  function select(node?: MapNode) {
    if (featureId === 'overview' && node?.featureId) {
      setFeatureId(node.featureId);
      setSelected(undefined);
      setCode(undefined);
      return;
    }
    setSelected(node);
    setCode(undefined);
    setNotice('');
    if ((node?.kind === 'api' || node?.kind === 'page') && node.path) {
      void readCode(node.scope || 'project', node.path);
    }
  }

  function selectCase(id: string) {
    if (!view) return;
    const match = view.cases.find(row => row.id === id);
    if (!match) return;
    setFeatureId(match.featureId);
    setLayer('tests');
    setSelected(
      featureGraph(view, match.featureId).nodes.find(
        node => node.kind === 'case' && node.caseId === id,
      ),
    );
    setCode(undefined);
  }

  function close() {
    const id = selected?.id;
    setSelected(undefined);
    setCode(undefined);
    if (id) {
      requestAnimationFrame(() =>
        document.querySelector<SVGElement>(`[data-map-node="${CSS.escape(id)}"]`)?.focus(),
      );
    }
  }

  function add(script = '', newFeature = false) {
    const declared = view?.scripts.find(row => row.path === script)?.caseIds[0];
    setEditor({
      id: declared || 'TC-' + crypto.randomUUID().slice(0, 8),
      featureId:
        newFeature || !featureId || featureId === 'overview'
          ? 'F-' + crypto.randomUUID().slice(0, 8)
          : featureId,
      title: '',
      kind: script.includes('/flows/') ? 'flow' : 'api',
      purpose: '',
      preconditions: '',
      data: '',
      expected: '',
      script,
      knowledgeIds: [],
      questions: [],
    });
    setSelected(undefined);
    setCode(undefined);
    setNotice('');
  }

  async function save(record: TestIntent, name: string, sources: Feature['sources']) {
    if (!config || !view) return;
    setBusy(true);
    setError('');
    try {
      const catalog = {
        ...view.catalog,
        features: [
          ...view.catalog.features.filter(feature => feature.id !== record.featureId),
          {
            ...view.catalog.features.find(feature => feature.id === record.featureId),
            id: record.featureId,
            name: name.trim(),
            sources,
          },
        ],
        cases: [
          ...view.catalog.cases.filter(row => row.id !== record.id),
          { ...record, questions: record.questions.filter(question => question.text.trim()) },
        ],
      };
      await operation(config, 'catalog-save', { revision: view.revision, catalog });
      const next = await operation<CatalogView>(config, 'catalog');
      setView(next);
      setFeatureId(record.featureId);
      setEditor(undefined);
      setMode('map');
      setLayer('tests');
      setSelected(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '儲存失敗。');
    } finally {
      setBusy(false);
    }
  }

  async function prepare(action: string) {
    if (!config) return;
    setBusy(true);
    setError('');
    try {
      const result = await operation<{ pages?: number; routes?: number }>(config, action);
      setNotice(
        action.endsWith('prepare')
          ? `已準備 ${result.pages} 個頁面的來源證據，請交給本機 AI 整理。`
          : '已載入 AI 功能結果。',
      );
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '功能整理失敗');
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice('已複製任務文字。');
    } catch {
      setError('無法使用剪貼簿，請從 AI 任務文字欄位自行複製。');
    }
  }

  const currentFeature =
    featureId !== 'overview'
      ? view?.catalog.features.find(item => item.id === featureId)
      : undefined;
  const currentCoverage = currentFeature ? featureCoverage(cases, currentFeature) : undefined;
  const fa = view?.catalog.frontendAnalysis;

  return (
    <WorkspaceShell navigation={navigation} wide>
      <PageHeader
        title="功能地圖"
        actions={
          <>
            <ActionButton
              variant="primary"
              icon="sparkles"
              disabled={busy || !!editor || ai.running || !view}
              onClick={() => {
                void ai.start('ai-features-start').catch(() => {});
              }}
            >
              AI 分析功能
            </ActionButton>
            <ActionButton
              icon="refresh"
              disabled={busy || !!editor || ai.running}
              onClick={() => void reload()}
            >
              {busy ? '正在讀取…' : '重新讀取'}
            </ActionButton>
            <ActionButton
              icon="plus"
              disabled={busy || !view || !!editor || ai.running}
              onClick={() => add()}
            >
              新增測試
            </ActionButton>
          </>
        }
      />

      <AiJobStatus job={ai.job} error={ai.error} onCancel={() => void ai.cancel()} />

      {error && (
        <Banner tone="danger" className="mb-4">
          {error}
        </Banner>
      )}
      {notice && (
        <Banner tone="neutral" className="mb-4">
          {notice}
        </Banner>
      )}
      {config && !config.initialized && (
        <EmptyState icon="settings" title="請先開啟「工作區設定」。" />
      )}

      {view && (
        <div className="grid min-w-0 gap-5 lg:grid-cols-map-browser">
          <section className="min-w-0 space-y-3 lg:border-r lg:border-line lg:pr-4" aria-label="功能選擇">
            <SearchField
              label="搜尋功能"
              placeholder="搜尋功能"
              disabled={!!editor}
              value={query}
              onChange={event => setQuery(event.target.value)}
            />

            <div className="space-y-1">
              <ActionButton
                variant="ghost"
                align="start"
                disabled={!!editor}
                aria-pressed={featureId === 'overview'}
                onClick={() => {
                  setFeatureId('overview');
                  select();
                }}
                className={cx(
                  'w-full',
                  featureId === 'overview' && 'bg-surface-active font-medium text-ink',
                )}
              >
                全部功能
              </ActionButton>

              <ul className="space-y-1">
                {features.map(feature => {
                  const cov = featureCoverage(
                    view.cases.filter(row => row.featureId === feature.id),
                    feature,
                  );
                  const active = feature.id === featureId;
                  return (
                    <li key={feature.id}>
                      <ActionButton
                        variant="ghost"
                        align="between"
                        disabled={!!editor}
                        aria-pressed={active}
                        onClick={() => {
                          setFeatureId(feature.id);
                          select();
                        }}
                        className={cx(
                          'w-full',
                          active && 'bg-surface-active font-medium text-ink',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <StatusDot tone={covDotTone[cov.coverage]} />
                          <span
                            className={cx(
                              'min-w-0 break-words',
                              cov.coverage === 'retired' && 'text-muted line-through',
                            )}
                          >
                            {feature.name}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted">
                          {cov.coverage === 'retired' ? `廢棄 ${cov.caseCount}` : cov.caseCount}
                        </span>
                      </ActionButton>
                    </li>
                  );
                })}
              </ul>

              {!features.length && (
                <p className="px-3 py-4 text-muted">{query ? '沒有符合的功能。' : '尚未整理功能。'}</p>
              )}

              <ActionButton
                variant="ghost"
                align="start"
                icon="plus"
                className="w-full"
                disabled={busy || !!editor}
                onClick={() => add('', true)}
              >
                新增功能
              </ActionButton>
            </div>

            <Disclosure summary="手動分析工具" className="bg-surface-subtle">
              <div className="space-y-2.5">
                <ActionButton
                  className="w-full"
                  disabled={busy || !!editor}
                  onClick={() => void prepare('frontend-features-prepare')}
                >
                  準備分析資料
                </ActionButton>
                <ActionButton
                  className="w-full"
                  disabled={busy || !!editor || !view.frontendPreparation?.proposal}
                  onClick={() => void prepare('frontend-features-apply')}
                >
                  載入 AI 結果
                </ActionButton>
                <ActionButton
                  icon="copy"
                  className="w-full"
                  onClick={() => void copy(organizeFeaturesTask)}
                >
                  複製整理任務
                </ActionButton>
                <textarea
                  aria-label="功能整理任務"
                  readOnly
                  rows={5}
                  className="w-full resize-y rounded-lg border border-line-strong bg-canvas p-2.5 font-mono text-body text-ink"
                  value={organizeFeaturesTask}
                />
              </div>
            </Disclosure>

            <Disclosure
              summary={`尚未分類（${view.unlinkedScripts.length}）`}
              className="bg-surface-subtle"
            >
              {view.unlinkedScripts.length > 0 ? (
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {view.unlinkedScripts.map(path => (
                    <li key={path}>
                      <ActionButton
                        variant="ghost"
                        align="start"
                        className="w-full break-all"
                        disabled={busy || !!editor}
                        onClick={() => add(path)}
                      >
                        {path.replace(/^tests\/(api|flows)\//, '').replace(/\.spec\.ts$/, '')}
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">全部腳本皆已分類。</p>
              )}
            </Disclosure>
          </section>

          <div className="min-w-0 space-y-4">
            {featureId === 'overview' && fa && !editor && (
              <StatStrip
                items={[
                  { label: '識別功能', value: fa.coverage.features },
                  {
                    label: '頁面歸屬',
                    value: `${fa.coverage.pages}/${fa.coverage.totalPages}`,
                    tone: fa.coverage.unassignedPages === 0 ? 'success' : 'neutral',
                  },
                  {
                    label: '未分配來源',
                    value: `${fa.coverage.unassignedPages} 頁 · ${fa.coverage.unassignedApis} API`,
                    tone:
                      fa.coverage.unassignedPages || fa.coverage.unassignedApis
                        ? 'warning'
                        : 'success',
                  },
                ]}
              />
            )}

            {editor ? (
              <Surface padding="lg">
                <CaseEditor
                  key={editor.id}
                  initial={editor}
                  view={view}
                  busy={busy}
                  onSave={(row, name, sources) => void save(row, name, sources)}
                  onCancel={() => setEditor(undefined)}
                />
              </Surface>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SegmentedGroup
                    label="顯示方式"
                    value={mode}
                    onChange={value => {
                      setMode(value);
                      select();
                    }}
                    options={[
                      { id: 'map', label: '地圖' },
                      { id: 'list', label: '測試清單' },
                      { id: 'gaps', label: '缺口與覆蓋報表' },
                    ]}
                  />

                  {mode === 'map' && currentFeature && (
                    <div className="flex flex-wrap items-center gap-2">
                      <SegmentedGroup
                        label="檢視圖層"
                        value={layer}
                        onChange={value => {
                          setLayer(value);
                          select();
                        }}
                        options={[
                          { id: 'product', label: '產品頁面與 API' },
                          { id: 'tests', label: '測試流程' },
                        ]}
                      />
                      {currentCoverage &&
                        currentCoverage.coverage !== 'full' &&
                        currentCoverage.coverage !== 'retired' && (
                          <ActionButton
                            icon="copy"
                            disabled={busy}
                            onClick={() => void copy(featureTestDraftHandoff(currentFeature, view))}
                          >
                            複製 AI 補齊測試草稿任務
                          </ActionButton>
                        )}
                    </div>
                  )}
                </div>

                {!view.catalog.features.length ? (
                  <EmptyState
                    icon="map"
                    title="從一個功能開始"
                    className="min-h-map-canvas"
                    action={
                      <ActionButton variant="primary" onClick={() => add('', true)}>
                        建立第一個功能
                      </ActionButton>
                    }
                  />
                ) : mode === 'gaps' ? (
                  <GapReport
                    view={view}
                    busy={busy}
                    onFocusFeature={id => {
                      setFeatureId(id);
                      setMode('map');
                      select();
                    }}
                    onAddCase={id => {
                      setFeatureId(id);
                      setEditor({
                        id: 'TC-' + crypto.randomUUID().slice(0, 8),
                        featureId: id,
                        title: '',
                        kind: 'flow',
                        purpose: '',
                        preconditions: '',
                        data: '',
                        expected: '',
                        script: '',
                        knowledgeIds: [],
                        questions: [],
                      });
                    }}
                    onEditCase={id => setEditor(view.catalog.cases.find(row => row.id === id))}
                    onCopy={text => void copy(text)}
                  />
                ) : (
                  <div
                    className={cx(
                      'grid min-w-0 gap-4',
                      selected && 'map-wide:grid-cols-map-detail',
                    )}
                  >
                    {mode === 'map' ? (
                      <div className="min-w-0">
                        <FeatureMap
                          key={featureId + layer}
                          layer={layer}
                          view={view}
                          featureId={featureId}
                          selected={selected?.id}
                          onSelect={select}
                          disabled={busy}
                        />
                      </div>
                    ) : (
                      <Surface padding="none" className="min-w-0 overflow-hidden" aria-label="測試清單">
                        {cases.length > 0 ? (
                          <table aria-label="測試清單" className="w-full table-fixed text-left">
                            <thead>
                              <tr className="border-b border-line bg-surface-subtle text-muted">
                                <th className="p-3.5 font-medium">測試名稱</th>
                                <th className="p-3.5 font-medium">最近結果</th>
                                <th className="p-3.5 font-medium">需補充</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              {cases.map(row => (
                                <tr key={row.id} className="hover:bg-surface-subtle">
                                  <td className="p-3">
                                    <ActionButton
                                      variant="ghost"
                                      align="start"
                                      className="max-w-full break-words text-ink"
                                      onClick={() => selectCase(row.id)}
                                    >
                                      {row.title}
                                    </ActionButton>
                                  </td>
                                  <td className="p-3.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge
                                        tone={
                                          row.latest?.status === 'passed' &&
                                          row.freshness === 'current'
                                            ? 'success'
                                            : row.latest?.status === 'failed'
                                              ? 'danger'
                                              : 'neutral'
                                        }
                                        dot
                                      >
                                        {row.latest
                                          ? `上次${resultLabels[row.latest.status] || row.latest.status}`
                                          : '尚未執行'}
                                      </Badge>
                                      {row.latest && row.freshness !== 'current' && (
                                        <span className="text-muted">新版未驗證</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3.5 tabular-nums text-muted">
                                    {row.issues.length || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="p-6 text-muted">這個功能還沒有測試。</p>
                        )}
                      </Surface>
                    )}

                    {selected && (
                      <MapDetails
                        node={selected}
                        featureId={featureId}
                        view={view}
                        busy={busy}
                        code={code}
                        onClose={close}
                        onEdit={id => setEditor(view.catalog.cases.find(row => row.id === id))}
                        onCode={(scope, path) => void readCode(scope, path)}
                        onCase={id => {
                          const target = view.cases.find(row => row.id === id);
                          if (target) {
                            setFeatureId(target.featureId);
                            setLayer('tests');
                            setSelected(
                              featureGraph(view, target.featureId).nodes.find(
                                node => node.caseId === id && node.kind === 'case',
                              ),
                            );
                            setCode(undefined);
                          }
                        }}
                        onCopy={text => void copy(text)}
                        onAddCase={() => add()}
                      />
                    )}
                  </div>
                )}
              </>
            )}

            {!!view.warnings.length && (
              <Disclosure
                summary={<span className="text-warning">{`讀取限制（${view.warnings.length}）`}</span>}
              >
                <ul className="space-y-1.5 text-muted">
                  {view.warnings.map(message => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </Disclosure>
            )}
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
