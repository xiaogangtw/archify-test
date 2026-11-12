import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { operation, settings } from './client';
import type { LocalConfig } from './client';
import { CaseEditor } from './CaseEditor';
import { FeatureMap } from './FeatureMap';
import { GapReport } from './GapReport';
import { MapDetails } from './MapDetails';
import {
  directChildFeatures,
  featureAncestors,
  featureGraph,
  featureTreeCoverage,
  orderedFeatureTree,
  singleSystemRootFeature,
  subtreeFeatureIds,
} from './feature-graph';
import type { MapNode, TreeCoverageMetrics } from './feature-graph';
import type { CaseView, CatalogView, TestIntent, Feature } from './catalog';
import { resultLabels, organizeFeaturesTask, featureTestDraftHandoff } from './catalog';
import { useAiJob } from './useAiJob';
import { AiJobStatus } from './AiJobStatus';
import { WorkspaceToast } from './WorkspaceToast';
import {
  ActionButton,
  Badge,
  Disclosure,
  EmptyState,
  PageHeader,
  SearchField,
  SegmentedGroup,
  StatStrip,
  StatusDot,
  Surface,
  WorkspaceIcon,
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

function summarizeCaseIssues(issues: CaseView['issues']) {
  if (!issues.length) return '';
  const labels: string[] = [];
  for (const issue of issues) {
    let label = '待確認';
    if (issue.text.includes('請求契約不同')) label = 'API 契約不同';
    else if (issue.text.includes('未出現在目前分析')) label = 'API 未再出現';
    else if (issue.type === 'source') label = '來源已變更';
    else if (issue.type === 'knowledge' || issue.type === 'knowledge-run') label = '知識已更新';
    else if (issue.type === 'script') label = '未連結腳本';
    else if (issue.type === 'question') label = '待確認問題';
    else if (issue.type === 'expected') label = '缺預期結果';
    else if (issue.type === 'intent') label = '案例已更新';
    else if (issue.type === 'duplicate') label = '重複腳本';
    if (!labels.includes(label)) labels.push(label);
  }
  const head = labels.slice(0, 2).join('、');
  return issues.length > 1 ? `${head}（${issues.length} 項）` : head;
}

const collapsedStorageKey = (projectRoot?: string) =>
  projectRoot ? `archify.catalog.collapsed.v1:${projectRoot}` : 'archify.catalog.collapsed.v1';

function readCollapsedFeatures(key: string): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

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
  const [collapsedIds, setCollapsedIds] = useState<string[]>(() =>
    readCollapsedFeatures(collapsedStorageKey()),
  );

  const ai = useAiJob(config, 'features');

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
      setCollapsedIds(readCollapsedFeatures(collapsedStorageKey(value.projectRoot)));
      if (value.initialized) {
        const next = await operation<CatalogView>(value, 'catalog');
        const nextSystemRoot = singleSystemRootFeature(next.catalog, next.cases);
        setView(next);
        setFeatureId(previous =>
          previous === 'overview' ||
          (nextSystemRoot?.id !== previous &&
            next.catalog.features.some(feature => feature.id === previous))
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

  const systemRoot = useMemo(
    () => (view ? singleSystemRootFeature(view.catalog, view.cases) : undefined),
    [view],
  );
  const coverageCache = useMemo(() => new Map<string, TreeCoverageMetrics>(), [view]);
  const featureNameMap = useMemo(
    () => new Map((view?.catalog.features || []).map(row => [row.id, row.name])),
    [view?.catalog.features],
  );
  const treeFeatures = useMemo(
    () => (view ? orderedFeatureTree(view.catalog.features, systemRoot?.id) : []),
    [view, systemRoot?.id],
  );
  const features = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return treeFeatures;
    return treeFeatures.filter(({ feature }) =>
      `${feature.name} ${
        view?.cases
          .filter(row => row.featureId === feature.id)
          .map(row => row.title)
          .join(' ') || ''
      }`
        .toLowerCase()
        .includes(trimmed),
    );
  }, [treeFeatures, view, query]);
  const collapsedSet = useMemo(() => new Set(collapsedIds), [collapsedIds]);
  const visibleFeatures = useMemo(() => {
    if (!view || query.trim()) return features;
    return features.filter(
      ({ feature }) =>
        !featureAncestors(view.catalog.features, feature.id, systemRoot?.id).some(ancestor =>
          collapsedSet.has(ancestor.id),
        ),
    );
  }, [features, view, query, systemRoot?.id, collapsedSet]);

  function toggleCollapsed(id: string) {
    const key = collapsedStorageKey(config?.projectRoot);
    setCollapsedIds(previous => {
      const next = previous.includes(id)
        ? previous.filter(item => item !== id)
        : [...previous, id];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Ignore storage write failures cleanly.
      }
      return next;
    });
  }
  const subtreeIds = useMemo(
    () =>
      view && featureId !== 'overview'
        ? subtreeFeatureIds(view.catalog.features, featureId)
        : undefined,
    [view, featureId],
  );
  const cases =
    view?.cases.filter(row => featureId === 'overview' || subtreeIds?.has(row.featureId)) || [];

  function navigateFeature(nextId: string) {
    setFeatureId(nextId);
    setSelected(undefined);
    setCode(undefined);
  }

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
    if (
      node?.kind === 'feature' &&
      node.featureId &&
      (featureId === 'overview' || node.featureId !== featureId)
    ) {
      navigateFeature(node.featureId);
      if (!view?.catalog.features.some(feature => feature.frontend?.parentId === node.featureId)) setSelected(node);
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
    if (mode === 'map') {
      setFeatureId(match.featureId);
      setLayer('tests');
    }
    setSelected(
      featureGraph(view, match.featureId, 'tests').nodes.find(
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
  const currentChildren =
    view && currentFeature ? directChildFeatures(view.catalog.features, currentFeature.id) : [];
  const currentCoverage =
    view && currentFeature ? featureTreeCoverage(currentFeature.id, view, coverageCache) : undefined;
  const fa = view?.catalog.frontendAnalysis;
  const showFeatureLabelInList = !subtreeIds || subtreeIds.size > 1;

  return (
    <WorkspaceShell navigation={navigation} wide>
      <PageHeader
        title="功能地圖"
        meta={
          config?.ai && (
            <span className="text-muted">
              {`目前 AI：${config.ai.providerLabel || 'Codex'} · ${config.ai.model || '預設模型'}`}
            </span>
          )
        }
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

      <AiJobStatus
        job={ai.job?.kind === 'features' ? ai.job : undefined}
        error={ai.error}
        onCancel={() => void ai.cancel()}
        onDismiss={ai.dismiss}
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
      {config && !config.initialized && (
        <EmptyState icon="settings" title="請先開啟「工作區設定」。" />
      )}

      {view && (
        <div className="grid min-w-0 gap-5 lg:grid-cols-map-browser">
          <section
            className="min-w-0 space-y-3 lg:sticky lg:top-0 lg:self-start lg:border-r lg:border-line lg:pr-4"
            aria-label="功能選擇"
          >
            <SearchField
              label="搜尋功能"
              placeholder="搜尋功能"
              disabled={!!editor}
              value={query}
              onChange={event => setQuery(event.target.value)}
            />

            <div className="min-h-0 max-h-96 space-y-1 overflow-y-auto overscroll-contain lg:max-h-[max(18rem,calc(100dvh-20rem))] lg:pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ActionButton
                variant="ghost"
                align="start"
                disabled={!!editor}
                aria-pressed={featureId === 'overview'}
                onClick={() => navigateFeature('overview')}
                className={cx(
                  'w-full',
                  featureId === 'overview' && 'bg-surface-active font-medium text-ink',
                )}
              >
                全部功能
              </ActionButton>

                <ul className="space-y-1">
                  {visibleFeatures.map(({ feature, depth }, index) => {
                    const cov = featureTreeCoverage(feature.id, view, coverageCache);
                    const active = feature.id === featureId;
                    const topGroup = !query.trim() && depth === 0 && cov.isGroup;
                    const subGroup = cov.isGroup && !topGroup;
                    const collapsed = !query.trim() && collapsedSet.has(feature.id);
                    const indentClass =
                      !query.trim() &&
                      (cov.isGroup
                        ? depth === 1
                          ? 'pl-3'
                          : depth >= 2
                            ? 'pl-6'
                            : undefined
                        : depth === 1
                          ? 'pl-5'
                          : depth === 2
                            ? 'pl-9'
                            : depth >= 3
                              ? 'pl-11'
                              : undefined);
                    const itemContent = (
                      <>
                        <span className="flex min-w-0 items-center gap-2">
                          {cov.coverage === 'retired' ? (
                            <StatusDot tone="neutral" />
                          ) : topGroup ? (
                            <WorkspaceIcon name="folder" className="h-4 w-4 text-muted" />
                          ) : subGroup ? null : cov.coverage === 'full' ||
                            cov.coverage === 'partial' ? (
                            <StatusDot tone={covDotTone[cov.coverage]} />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="inline-block h-2 w-2 shrink-0 rounded-full border border-line-strong"
                            />
                          )}
                          <span
                            className={cx(
                              'min-w-0 break-words',
                              cov.coverage === 'retired'
                                ? 'text-muted line-through'
                                : topGroup
                                  ? 'font-medium text-ink'
                                  : subGroup
                                    ? active
                                      ? 'font-medium text-ink'
                                      : 'font-medium text-muted'
                                    : 'text-ink',
                            )}
                          >
                            {feature.name}
                          </span>
                        </span>
                        {cov.coverage === 'retired' ? (
                          <span className="shrink-0 tabular-nums text-muted">
                            {cov.caseCount > 0 ? `廢棄 ${cov.caseCount}` : '廢棄'}
                          </span>
                        ) : cov.caseCount > 0 ? (
                          <span className="inline-flex shrink-0 items-center gap-1.5 tabular-nums text-muted">
                            {cov.isGroup && <StatusDot tone={covDotTone[cov.coverage]} />}
                            {cov.caseCount}
                          </span>
                        ) : null}
                      </>
                    );
                    return (
                      <li
                        key={feature.id}
                        className={cx(
                          index > 0 && topGroup && 'mt-2 border-t border-line pt-2',
                          indentClass,
                        )}
                      >
                        {cov.isGroup && !query.trim() ? (
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              disabled={!!editor}
                              aria-expanded={!collapsed}
                              aria-label={`${feature.name} 分類`}
                              onClick={() => toggleCollapsed(feature.id)}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand active:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                            >
                              <WorkspaceIcon
                                name="chevron"
                                className={cx(
                                  'h-4 w-4 transition-transform motion-reduce:transition-none',
                                  !collapsed && 'rotate-90',
                                )}
                              />
                            </button>
                            <ActionButton
                              variant="ghost"
                              align="between"
                              disabled={!!editor}
                              aria-pressed={active}
                              onClick={() => navigateFeature(feature.id)}
                              className={cx(
                                'min-w-0 flex-1',
                                active && 'bg-surface-active font-medium text-ink',
                              )}
                            >
                              {itemContent}
                            </ActionButton>
                          </div>
                        ) : (
                          <ActionButton
                            variant="ghost"
                            align="between"
                            disabled={!!editor}
                            aria-pressed={active}
                            onClick={() => navigateFeature(feature.id)}
                            className={cx(
                              'w-full',
                              active && 'bg-surface-active font-medium text-ink',
                            )}
                          >
                            {itemContent}
                          </ActionButton>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {!visibleFeatures.length && (
                  <p className="px-3 py-4 text-muted">
                    {query ? '沒有符合的功能。' : '尚未整理功能。'}
                  </p>
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

            {view.unlinkedScripts.length > 0 && (
              <Disclosure
                summary={`尚未分類（${view.unlinkedScripts.length}）`}
                className="bg-surface-subtle"
              >
                <div className="space-y-2">
                  <p className="text-muted">
                    以下測試檔尚未連到功能地圖，點選即可建立案例並歸入目前功能：
                  </p>
                  <ul className="max-h-72 space-y-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                </div>
              </Disclosure>
            )}
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
                      if (value === 'gaps') {
                        select();
                        return;
                      }
                      if (value === 'map' && selected?.caseId && view) {
                        const match = view.cases.find(row => row.id === selected.caseId);
                        if (match) {
                          setFeatureId(match.featureId);
                          setLayer('tests');
                          setSelected(
                            featureGraph(view, match.featureId, 'tests').nodes.find(
                              node => node.kind === 'case' && node.caseId === match.id,
                            ),
                          );
                        }
                      }
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
                        !currentChildren.length &&
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
                      selected && (selected.kind === 'feature' ? 'map-wide:grid-cols-map-flow-detail' : 'map-wide:grid-cols-map-detail'),
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
                          onNavigateFeature={navigateFeature}
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
                              {cases.map(row => {
                                const hasSourceIssue = row.issues.some(
                                  issue => issue.type === 'source',
                                );
                                const ownerName = showFeatureLabelInList
                                  ? featureNameMap.get(row.featureId)
                                  : undefined;
                                return (
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
                                      {ownerName && (
                                        <p className="mt-0.5 px-3 text-muted">{ownerName}</p>
                                      )}
                                    </td>
                                    <td className="p-3.5">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Badge
                                          tone={
                                            row.latest?.status === 'passed' &&
                                            row.freshness === 'current' &&
                                            !hasSourceIssue
                                              ? 'success'
                                              : row.latest?.status === 'failed'
                                                ? 'danger'
                                                : hasSourceIssue
                                                  ? 'warning'
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
                                        {hasSourceIssue && (
                                          <span className="text-warning">來源已變更</span>
                                        )}
                                      </div>
                                    </td>
                                    <td
                                      className="break-words p-3.5 text-muted"
                                      title={
                                        row.issues.length
                                          ? row.issues.map(issue => issue.text).join('\n')
                                          : undefined
                                      }
                                    >
                                      {row.issues.length ? (
                                        <span className="text-warning">
                                          {summarizeCaseIssues(row.issues)}
                                        </span>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
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
                        onFeature={navigateFeature}
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

            <Disclosure summary="手動分析工具" className="bg-surface-subtle">
              <div className="space-y-4">
                <p className="text-muted">
                  平常使用上方「AI 分析功能」即可自動完成；僅於自動分析失敗，或需在本機編輯器手動微調提案時依序操作：
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="flex flex-col justify-between gap-3 rounded-lg border border-line bg-canvas p-3">
                    <div className="space-y-1">
                      <p className="font-medium text-ink">1. 產出前端證據</p>
                      <p className="text-muted">重新掃描程式碼並產生唯讀分析資料。</p>
                    </div>
                    <ActionButton
                      className="w-full"
                      disabled={busy || !!editor}
                      onClick={() => void prepare('frontend-features-prepare')}
                    >
                      準備分析資料
                    </ActionButton>
                  </div>
                  <div className="flex flex-col justify-between gap-3 rounded-lg border border-line bg-canvas p-3">
                    <div className="space-y-1">
                      <p className="font-medium text-ink">2. 交給本機 AI 整理</p>
                      <p className="text-muted">複製任務文字給本機 AI 產出功能提案檔。</p>
                    </div>
                    <ActionButton
                      icon="copy"
                      className="w-full"
                      onClick={() => void copy(organizeFeaturesTask)}
                    >
                      複製整理任務
                    </ActionButton>
                  </div>
                  <div className="flex flex-col justify-between gap-3 rounded-lg border border-line bg-canvas p-3">
                    <div className="space-y-1">
                      <p className="font-medium text-ink">3. 套用到功能地圖</p>
                      <p className="text-muted">確認提案檔就緒後，驗證並更新地圖。</p>
                    </div>
                    <ActionButton
                      className="w-full"
                      disabled={busy || !!editor || !view.frontendPreparation?.proposal}
                      onClick={() => void prepare('frontend-features-apply')}
                    >
                      載入 AI 結果
                    </ActionButton>
                  </div>
                </div>
                <Disclosure summary="查看任務指令原文">
                  <textarea
                    aria-label="功能整理任務"
                    readOnly
                    rows={6}
                    className="w-full resize-y rounded-lg border border-line-strong bg-canvas p-3 font-mono text-body text-ink"
                    value={organizeFeaturesTask}
                  />
                </Disclosure>
              </div>
            </Disclosure>
          </div>
        </div>
      )}
    </WorkspaceShell>
  );
}
