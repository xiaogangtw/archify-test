import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ConfiguredReports } from '../workspace/ConfiguredReports';
import { labels, parseReport, caseCategory } from './report';
import type { Report, Status } from './report';
import { renderText } from '../../../../../test-project/framework/text-report.mjs';
import { reportActual } from '../../../../../test-project/framework/case-narrative.mjs';
import { renderHtml } from '../../../../../test-project/framework/html.mjs';
import { UiTestEnvironment } from '../workspace/UiTestEnvironment';
import {
  ActionButton,
  ActionLink,
  Badge,
  Disclosure,
  EmptyState,
  MetadataGrid,
  PageHeader,
  SearchField,
  SegmentedGroup,
  Surface,
  WorkspaceShell,
} from '../../components/ui/ds';
import type { Tone } from '../../components/ui/ds';

const statusBadgeTone: Record<Status, Tone> = {
  passed: 'success',
  failed: 'danger',
  skipped: 'warning',
  'not-run': 'neutral',
};

export function ReportReader({
  navigation,
  kind,
  onBack,
}: {
  navigation?: ReactNode;
  kind?: Report['kind'];
  onBack?: () => void;
}) {
  const [report, setReport] = useState<Report>();
  const [testType, setTestType] = useState<'api' | 'ui'>(() => {
    const params = new URLSearchParams(location.search);
    return params.get('reportType') === 'ui' || params.get('report')?.startsWith('ui/')
      ? 'ui'
      : 'api';
  });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | Status>('all');

  const categoryCases = report?.cases.filter(item => caseCategory(item, report) === testType) || [];
  const cases = categoryCases.filter(
    item =>
      (filter === 'all' || item.status === filter) &&
      `${item.name} ${item.id} ${item.purpose}`.toLowerCase().includes(query.toLowerCase()),
  );

  function accept(value: Report) {
    if (kind && value.kind !== kind) {
      throw new Error(
        kind === 'flow'
          ? '這是執行報告，請到「測試報告」開啟。'
          : '這是腳本宣告的流程檔；測試流程頁僅顯示專案案例表格。',
      );
    }
    setReport(value);
    setQuery('');
    setFilter('all');
  }

  const reportUrl = useMemo(
    () =>
      report
        ? URL.createObjectURL(
            new Blob([renderHtml({ ...report, cases: categoryCases, testType })], {
              type: 'text/html;charset=utf-8',
            }),
          )
        : '',
    [report, testType],
  );

  useEffect(
    () => () => {
      if (reportUrl) URL.revokeObjectURL(reportUrl);
    },
    [reportUrl],
  );

  const filename = report
    ? 'report-' +
      report.runId.replace(/[^A-Za-z0-9_-]/g, '') +
      (report.volume ? '-part-' + report.volume.index : '') +
      '.html'
    : 'report.html';

  const counts = {
    passed: categoryCases.filter(item => item.status === 'passed').length,
    failed: categoryCases.filter(item => item.status === 'failed').length,
    skipped: categoryCases.filter(item => item.status === 'skipped').length,
  };

  const filterKeys: ('all' | Status)[] = [
    'all',
    ...(report?.kind === 'flow'
      ? (['not-run'] as const)
      : ([
          'passed',
          'failed',
          ...(categoryCases.some(item => item.status === 'skipped') ? (['skipped'] as const) : []),
        ] as const)),
  ];

  return (
    <WorkspaceShell
      asideLabel="閱讀器資訊"
      navigation={
        navigation || (
          <div>
            <p className="font-medium text-ink">{kind === 'flow' ? '測試流程' : '測試報告'}</p>
            <p className="mt-1.5 text-muted">本機檔案閱讀器</p>
          </div>
        )
      }
    >
      <PageHeader
        title={kind === 'flow' ? '測試流程' : '測試報告'}
        actions={
          <>
            <SegmentedGroup
              label="報告類型"
              value={testType}
              onChange={value => {
                if (value === testType) return;
                setTestType(value);
                setReport(undefined);
                setLoading(true);
                setQuery('');
                setFilter('all');
              }}
              options={[
                { id: 'api', label: 'API 測試' },
                { id: 'ui', label: '畫面測試' },
              ]}
            />
            {onBack && <ActionButton onClick={onBack}>返回案例表格</ActionButton>}
          </>
        }
      />

      <div aria-live="polite" aria-busy={loading}>
        {report && categoryCases.length > 0 && (
          <div className="space-y-5">
            <Surface aria-label="報告摘要" className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="break-words text-section font-bold text-ink">{report.project}</h2>
                  <p className="mt-1 text-muted">
                    {`${report.kind === 'flow' ? '預期流程 · 尚未執行' : '執行報告'} · ${new Date(report.createdAt).toLocaleString('zh-TW')}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2" aria-label="結果統計">
                  <Badge tone="neutral">{`${categoryCases.length} 案例`}</Badge>
                  {report.kind === 'execution' && (
                    <>
                      <Badge tone="success" dot>{`${counts.passed} 通過`}</Badge>
                      <Badge tone={counts.failed ? 'danger' : 'neutral'} dot>
                        {`${counts.failed} 失敗`}
                      </Badge>
                      {counts.skipped > 0 && (
                        <Badge tone="warning" dot>{`${counts.skipped} 略過`}</Badge>
                      )}
                    </>
                  )}
                </div>
              </div>
              {!report.testType && (
                <p className="text-muted">舊版報告，類型依腳本路徑推定。</p>
              )}
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <ActionLink
                  variant="primary"
                  icon="download"
                  href={reportUrl}
                  download={filename}
                >
                  下載圖文報告
                </ActionLink>
                <ActionButton
                  icon="download"
                  onClick={() => {
                    const text = renderText({ ...report, cases: categoryCases, testType });
                    const url = URL.createObjectURL(
                      new Blob([text], { type: 'text/plain;charset=utf-8' }),
                    );
                    const link = window.document.createElement('a');
                    link.href = url;
                    link.download =
                      'report-' + report.runId.replace(/[^A-Za-z0-9_-]/g, '') + '.txt';
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  下載文字摘要
                </ActionButton>
              </div>
            </Surface>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <SearchField
                label="搜尋案例"
                placeholder="搜尋案例名稱或編號…"
                className="w-full sm:max-w-xs"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
              <SegmentedGroup
                label="篩選結果"
                value={filter}
                onChange={setFilter}
                options={filterKeys.map(key => ({
                  id: key,
                  label: key === 'all' ? '全部' : labels[key],
                }))}
              />
            </div>

            {!cases.length ? (
              <EmptyState icon="search" title="沒有符合條件的案例。" />
            ) : (
              <ol className="space-y-4" aria-label="案例結果">
                {cases.map(item => (
                  <li key={item.id}>
                    <Surface padding="lg">
                      <article aria-label={`${item.id} ${item.name}`} className="space-y-4">
                        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                          <div className="min-w-0">
                            <p className="font-mono text-muted">{item.id}</p>
                            <h3 className="mt-1 text-section font-medium text-ink">{item.name}</h3>
                          </div>
                          <Badge
                            tone={statusBadgeTone[item.status]}
                            dot
                            aria-label={`結果：${labels[item.status]}`}
                          >
                            {labels[item.status]}
                          </Badge>
                        </header>

                        <p className="text-ink">{reportActual(item)}</p>

                        {(item.expected || item.actual || item.preconditions) && (
                          <div className="rounded-lg border border-line bg-canvas p-3.5">
                            <MetadataGrid
                              items={[
                                ...(item.preconditions
                                  ? [{ label: '前置條件', value: item.preconditions, full: true }]
                                  : []),
                                ...(item.expected ? [{ label: '預期', value: item.expected }] : []),
                                ...(item.actual ? [{ label: '實際', value: item.actual }] : []),
                              ]}
                            />
                          </div>
                        )}

                        {item.scenarioSteps?.length ? (
                          <section aria-label={`${item.id} 正常流程`}>
                            <h4 className="mb-2 font-medium text-ink">正常流程</h4>
                            <ol className="list-decimal space-y-2 pl-5">
                              {item.scenarioSteps.map((step, index) => (
                                <li key={`${step.action}-${index}`}>
                                  <span className="text-ink">{step.action}</span>
                                  <span className="mt-0.5 block text-muted">{`預期：${step.expected}`}</span>
                                </li>
                              ))}
                            </ol>
                          </section>
                        ) : null}

                        {!!item.steps.length && (
                          <section aria-label={`${item.id} 操作步驟`}>
                            <h4 className="mb-2 font-medium text-ink">操作結果</h4>
                            <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-canvas">
                              {item.steps.map((step, index) => (
                                <li
                                  key={`${step.name}-${index}`}
                                  className="grid gap-2 px-3.5 py-2.5 md:grid-cols-[minmax(10rem,0.7fr)_minmax(0,2fr)_auto] md:items-start"
                                >
                                  <span className="font-medium text-ink">{step.name}</span>
                                  <span
                                    className={
                                      step.status === 'failed' || step.error
                                        ? 'text-danger'
                                        : 'text-muted'
                                    }
                                  >
                                    {step.actual || step.error || step.expected}
                                    {step.diagnostic && (
                                      <span className="mt-1 block text-danger">
                                        {`${step.diagnostic.code} · ${step.diagnostic.message}`}
                                      </span>
                                    )}
                                  </span>
                                  <Badge tone={statusBadgeTone[step.status]} dot>
                                    {labels[step.status]}
                                  </Badge>
                                </li>
                              ))}
                            </ol>
                          </section>
                        )}

                        {item.cleanup && (
                          <p
                            className={
                              item.cleanup.status === 'failed' ? 'text-danger' : 'text-muted'
                            }
                          >
                            {`清理：${item.cleanup.status === 'passed' ? '完成' : `未完成${item.cleanup.error ? ` · ${item.cleanup.error}` : ''}`}`}
                          </p>
                        )}
                      </article>
                    </Surface>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>

      <ConfiguredReports
        testType={testType}
        kind={kind}
        onBusy={setLoading}
        onEmpty={() => setReport(undefined)}
        onOpen={value => accept(parseReport(JSON.stringify(value)))}
      />

      {testType === 'ui' && (
        <Disclosure summary={<span className="text-muted">畫面測試設定</span>} className="mt-4">
          <UiTestEnvironment />
        </Disclosure>
      )}
    </WorkspaceShell>
  );
}
