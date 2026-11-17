import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { settings, operation } from './client';
import type { LocalConfig } from './client';
import { factorLabels, flowCategory } from './catalog';
import type { Catalog, TestIntent } from './catalog';
import { WorkspaceToast } from './WorkspaceToast';
import {
  ActionButton,
  Badge,
  EmptyState,
  PageHeader,
  SegmentedGroup,
  Surface,
  WorkspaceShell,
} from '../../components/ui/ds';

function compactPreview(value: string, limit = 110) {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const flat = lines.join(' ');
  if (value.length <= limit && lines.length <= 3) return { short: value, long: false };
  const snippet = flat.slice(0, limit).trimEnd();
  return { short: `${snippet}…`, long: true };
}

function FlowText({
  value,
  limit = 110,
  muted = false,
}: {
  value: string;
  limit?: number;
  muted?: boolean;
}) {
  const { short, long } = compactPreview(value, limit);
  if (!long) {
    return (
      <span className={`whitespace-pre-wrap break-words ${muted ? 'text-muted' : 'text-ink'}`}>
        {value}
      </span>
    );
  }
  return (
    <div className="min-w-0 space-y-1">
      <span className={`block whitespace-pre-wrap break-words ${muted ? 'text-muted' : 'text-ink'}`}>
        {short}
      </span>
      <details className="min-w-0">
        <summary className="inline-block cursor-pointer rounded-lg text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          展開全文
        </summary>
        <p className="mt-1.5 whitespace-pre-wrap break-words rounded-lg border border-line bg-surface-subtle p-2.5 text-muted">
          {value}
        </p>
      </details>
    </div>
  );
}

function targetLabel(target: TestIntent['target']) {
  if (target === 'web') return '網頁';
  if (target === 'mobile') return 'Android 推播';
  if (target === 'mixed') return '跨平台';
  return '';
}

export function FlowWorkspace({ navigation }: { navigation: ReactNode }) {
  const [config, setConfig] = useState<LocalConfig>();
  const [catalog, setCatalog] = useState<Catalog>();
  const [category, setCategory] = useState<'api' | 'ui' | 'unclassified'>('api');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function reload() {
    setBusy(true);
    setError('');
    try {
      const next = await settings();
      setConfig(next);
      if (next.initialized) {
        setCatalog((await operation<{ catalog: Catalog }>(next, 'case-plans')).catalog);
      } else {
        setCatalog(undefined);
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '無法讀取流程，請確認專案檔案後重新讀取。',
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const hasUnclassified = !!catalog?.cases.some(row => flowCategory(row) === 'unclassified');
  const rows = catalog?.cases.filter(row => flowCategory(row) === category) || [];
  const options = [
    { id: 'api' as const, label: 'API 流程' },
    { id: 'ui' as const, label: '畫面流程' },
    ...(hasUnclassified ? [{ id: 'unclassified' as const, label: '待分類' }] : []),
  ];

  return (
    <WorkspaceShell navigation={navigation}>
      <PageHeader
        title="測試流程"
        meta={
          config?.initialized && (
            <span className="flex flex-wrap items-center gap-2 font-mono">
              <span className="break-all">{config.projectRoot}</span>
              <span aria-hidden="true">·</span>
              <span>test-cases/catalog.json</span>
            </span>
          )
        }
        actions={
          <ActionButton icon="refresh" disabled={busy} onClick={() => void reload()}>
            {busy ? '正在讀取…' : '重新讀取'}
          </ActionButton>
        }
      />

      <WorkspaceToast open={!!error} tone="danger" role="alert" onDismiss={() => setError('')}>
        {error}
        {catalog ? ' 原表格已保留。' : ''}
      </WorkspaceToast>
      {config && !config.initialized && (
        <EmptyState icon="settings" title="請先從工作區設定連接測試專案。" />
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentedGroup
          label="流程類型"
          value={category}
          onChange={setCategory}
          options={options}
        />
        {catalog?.cases.some(row => !row.target) && (
          <Badge tone="warning" dot>
            部分案例缺 target（待補 api／web／mobile／mixed）
          </Badge>
        )}
      </div>

      {catalog && (
        <Surface padding="none" className="overflow-x-auto" aria-busy={busy}>
          {rows.length > 0 ? (
            <table aria-label="測試流程案例" className="w-full table-fixed text-left">
              <thead>
                <tr className="border-b border-line bg-surface-subtle text-muted">
                  <th scope="col" className="w-1/4 p-3.5 font-medium">
                    案例／功能
                  </th>
                  <th scope="col" className="w-1/4 p-3.5 font-medium">
                    測試步驟
                  </th>
                  <th scope="col" className="w-1/4 p-3.5 font-medium">
                    使用資料
                  </th>
                  <th scope="col" className="w-1/4 p-3.5 font-medium">
                    預期結果
                  </th>
                </tr>
              </thead>
              {rows.map(row => {
                const featureName = catalog.features.find(
                  feature => feature.id === row.featureId,
                )?.name;
                const steps = row.steps?.length
                  ? row.steps
                  : [{ action: '', data: '', expected: '' }];
                const hasStepData = steps.some(step => !!step.data?.trim());
                const unansweredQuestions = row.questions.filter(
                  question => !question.answer.trim(),
                );
                const hasFooterMeta =
                  !!row.preconditions?.trim() ||
                  !!row.expected?.trim() ||
                  (!!row.cleanup?.trim() && row.cleanup.trim() !== '不需清理') ||
                  (hasStepData && !!row.data?.trim()) ||
                  !!row.decisionTable?.length ||
                  unansweredQuestions.length > 0;
                const rowSpan = steps.length + (hasFooterMeta ? 1 : 0);
                const target = targetLabel(row.target);

                return (
                  <tbody
                    key={row.id}
                    className="divide-y divide-line border-t border-line-strong first:border-t-0"
                  >
                    {steps.map((step, index) => {
                      const stepData =
                        step.data?.trim() ||
                        (index === 0 && !hasStepData ? row.data?.trim() || '' : '');
                      return (
                        <tr key={index} className="align-top hover:bg-surface-subtle">
                          {index === 0 && (
                            <th
                              scope="row"
                              rowSpan={rowSpan}
                              className="break-words bg-canvas/30 p-3.5 font-medium text-ink"
                            >
                              <span>{row.title}</span>
                              <span className="mt-1 block font-mono font-normal text-muted">
                                {row.id}
                              </span>
                              {featureName && (
                                <span className="mt-1 block font-normal text-muted">
                                  {featureName}
                                </span>
                              )}
                              {(target || row.factor || unansweredQuestions.length > 0) && (
                                <div className="mt-2 flex flex-wrap gap-1.5 font-normal">
                                  {target && <Badge tone="neutral">{target}</Badge>}
                                  {row.factor && (
                                    <Badge tone="neutral">{factorLabels[row.factor]}</Badge>
                                  )}
                                  {unansweredQuestions.length > 0 && (
                                    <Badge tone="warning" dot>
                                      {`待補 ${unansweredQuestions.length}`}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </th>
                          )}
                          <td className="break-words p-3.5 text-ink">
                            {row.steps?.length ? (
                              <div className="flex items-start gap-2">
                                <span className="shrink-0 tabular-nums text-muted">
                                  {`${index + 1}.`}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <FlowText value={step.action || '尚未填寫'} limit={90} />
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted">尚未填寫</span>
                            )}
                          </td>
                          <td className="break-words p-3.5">
                            {stepData ? (
                              <FlowText value={stepData} limit={100} />
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="break-words p-3.5">
                            {step.expected?.trim() ? (
                              <FlowText value={step.expected} limit={110} />
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {hasFooterMeta && (
                      <tr className="align-top bg-surface-subtle/50">
                        <td colSpan={3} className="break-words p-3.5">
                          <div className="grid gap-3 md:grid-cols-3">
                            {!!row.preconditions?.trim() && (
                              <div className="min-w-0 space-y-1">
                                <span className="block font-medium text-muted">前置條件</span>
                                <FlowText value={row.preconditions} limit={90} muted />
                              </div>
                            )}
                            {!!row.expected?.trim() && (
                              <div className="min-w-0 space-y-1">
                                <span className="block font-medium text-muted">整體預期</span>
                                <FlowText value={row.expected} limit={110} />
                              </div>
                            )}
                            {!!row.cleanup?.trim() && row.cleanup.trim() !== '不需清理' && (
                              <div className="min-w-0 space-y-1">
                                <span className="block font-medium text-muted">清理方式</span>
                                <FlowText value={row.cleanup} limit={90} muted />
                              </div>
                            )}
                            {hasStepData && !!row.data?.trim() && (
                              <div className="min-w-0 space-y-1">
                                <span className="block font-medium text-muted">共用資料</span>
                                <FlowText value={row.data} limit={90} muted />
                              </div>
                            )}
                          </div>

                          {!!row.decisionTable?.length && (
                            <div className="mt-3 border-t border-line pt-3">
                              <p className="mb-2 font-medium text-muted">
                                {`決策矩陣（${row.decisionTable.length}）`}
                              </p>
                              <div className="grid gap-1.5">
                                {row.decisionTable.map((entry, index) => (
                                  <div
                                    key={index}
                                    className="grid gap-2 rounded-lg border border-line bg-canvas px-3 py-2 md:grid-cols-3"
                                  >
                                    <span className="break-words font-medium text-ink">
                                      {entry.point}
                                    </span>
                                    <span className="break-words text-muted">{entry.input}</span>
                                    <span className="break-words text-ink">{entry.expected}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {unansweredQuestions.length > 0 && (
                            <div className="mt-3 border-t border-line pt-3">
                              <p className="mb-1.5 font-medium text-warning">待補資訊</p>
                              <ul className="list-inside list-disc space-y-1 text-warning">
                                {unansweredQuestions.map((question, index) => (
                                  <li key={index} className="whitespace-pre-wrap break-words">
                                    {question.text}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                );
              })}
            </table>
          ) : (
            <p className="p-6 text-muted">尚無測試流程。</p>
          )}
        </Surface>
      )}
    </WorkspaceShell>
  );
}
