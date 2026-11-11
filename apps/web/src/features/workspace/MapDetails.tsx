import { useEffect, useRef } from 'react';
import type { CatalogView } from './catalog';
import type { MapNode } from './feature-graph';
import { featureCoverage } from './feature-graph';
import {
  aiHandoff,
  factorLabels,
  featureTestDraftHandoff,
  freshnessLabels,
  resultLabels,
} from './catalog';
import {
  ActionButton,
  ActionLink,
  Badge,
  Disclosure,
  MetadataGrid,
  Surface,
} from '../../components/ui/ds';

export function MapDetails({
  node,
  featureId,
  view,
  busy,
  code,
  onClose,
  onEdit,
  onCode,
  onCase,
  onCopy,
  onAddCase,
}: {
  node: MapNode;
  featureId: string;
  view: CatalogView;
  busy: boolean;
  code?: { path: string; content: string };
  onClose: () => void;
  onEdit: (id: string) => void;
  onCode: (scope: string, path: string) => void;
  onCase: (id: string) => void;
  onCopy: (text: string) => void;
  onAddCase?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const row = view.cases.find(row => row.id === node.caseId);
  const feature = view.catalog.features.find(feature => feature.id === featureId);
  const featureCases = view.cases.filter(item => item.featureId === featureId);
  const cov = featureCoverage(featureCases, feature);

  useEffect(() => {
    heading.current?.focus({ preventScroll: innerWidth >= 1440 });
  }, [node.id]);

  const current = row?.freshness === 'current';

  return (
    <Surface className="self-start" aria-label="節點詳情">
      <header className="mb-4 flex items-start justify-between gap-3 border-b border-line pb-4">
        <h2
          ref={heading}
          tabIndex={-1}
          className="min-w-0 break-words rounded-lg text-section font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {node.label}
        </h2>
        <ActionButton variant="ghost" className="shrink-0" onClick={onClose}>
          關閉詳情
        </ActionButton>
      </header>

      <div className="space-y-5">
        {node.kind === 'feature' ||
        node.kind === 'page' ||
        (node.kind === 'api' && !node.caseId) ||
        node.kind === 'project' ? (
          <>
            {feature?.frontend?.description && (
              <p className="text-muted">{feature.frontend.description}</p>
            )}
            {node.kind === 'feature' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium text-ink">對應測試</h3>
                  <Badge
                    tone={
                      cov.coverage === 'full'
                        ? 'success'
                        : cov.coverage === 'partial'
                          ? 'warning'
                          : cov.coverage === 'retired'
                            ? 'neutral'
                            : 'danger'
                    }
                    dot
                  >
                    {cov.coverage === 'full'
                      ? '充分覆蓋'
                      : cov.coverage === 'partial'
                        ? '部分覆蓋'
                        : cov.coverage === 'retired'
                          ? '已廢棄'
                          : '漏測'}
                  </Badge>
                </div>
                {featureCases.length > 0 && (
                  <ul className="space-y-1.5">
                    {featureCases.map(row => (
                      <li key={row.id}>
                        <ActionButton
                          variant="secondary"
                          align="start"
                          className="w-full"
                          onClick={() => onCase(row.id)}
                        >
                          {row.title}
                        </ActionButton>
                      </li>
                    ))}
                  </ul>
                )}
                {cov.coverage === 'retired' && (
                  <p className="text-muted">功能已自最新來源移除。</p>
                )}
                {cov.coverage === 'none' && <p className="text-danger">尚未建立測試案例。</p>}
                {cov.coverage === 'partial' && (
                  <p className="text-warning">{`缺：${cov.missingFactors.join('、')}`}</p>
                )}
                {feature && cov.coverage !== 'full' && cov.coverage !== 'retired' && (
                  <div className="flex flex-wrap gap-2">
                    {onAddCase && (
                      <ActionButton
                        variant="primary"
                        icon="plus"
                        disabled={busy}
                        onClick={onAddCase}
                      >
                        新增測試案例
                      </ActionButton>
                    )}
                    <ActionButton
                      icon="copy"
                      disabled={busy}
                      onClick={() => onCopy(featureTestDraftHandoff(feature, view))}
                    >
                      複製 AI 補齊草稿任務
                    </ActionButton>
                  </div>
                )}
              </div>
            )}

            {node.path && <p className="break-all font-mono text-muted">{node.path}</p>}

            {node.kind === 'page' && (
              <ul className="space-y-1 font-mono text-muted">
                {view.catalog.frontendAnalysis?.routes
                  .filter(route => route.component === node.path)
                  .map(route => (
                    <li key={route.id}>{route.url}</li>
                  ))}
              </ul>
            )}

            {feature?.frontend?.questions.length ? (
              <section className="space-y-2">
                <h3 className="font-medium text-ink">業務待確認</h3>
                <ul className="list-inside list-disc space-y-1.5 text-warning">
                  {feature.frontend.questions.map(question => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {!!feature?.sources.length && (
              <Disclosure summary="來源證據">
                <ul className="space-y-2">
                  {feature.sources.map(source => (
                    <li key={source.path + source.line}>
                      <ActionButton
                        icon="code"
                        align="start"
                        className="max-w-full break-all font-mono"
                        disabled={busy}
                        onClick={() => onCode('source', source.path)}
                      >
                        {`${source.path}:${source.line}`}
                      </ActionButton>
                    </li>
                  ))}
                </ul>
              </Disclosure>
            )}
          </>
        ) : (
          row && (
            <>
              {node.kind !== 'api' && (
                <section className="space-y-2.5 rounded-lg border border-line bg-canvas p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium text-ink">最近結果</h3>
                    <Badge
                      tone={
                        row.latest
                          ? current && row.latest.status === 'passed'
                            ? 'success'
                            : row.latest.status === 'failed'
                              ? 'danger'
                              : 'neutral'
                          : 'neutral'
                      }
                      dot
                    >
                      {row.latest
                        ? `上次${resultLabels[row.latest.status] || row.latest.status}`
                        : '尚未執行'}
                    </Badge>
                  </div>
                  {row.latest && <p className="text-muted">{freshnessLabels[row.freshness]}</p>}
                  {row.latest && (
                    <ActionLink
                      icon="open"
                      href={`?view=reports&report=${encodeURIComponent(row.latest.report)}`}
                    >
                      查看報告
                    </ActionLink>
                  )}
                </section>
              )}

              {node.kind === 'case' && (
                <div className="space-y-4">
                  {row.factor && (
                    <p className="text-muted">{`測試因子：${factorLabels[row.factor]}`}</p>
                  )}
                  {row.purpose && (
                    <section>
                      <h3 className="mb-1.5 font-medium text-ink">要確認什麼</h3>
                      <p className="whitespace-pre-wrap text-muted">{row.purpose}</p>
                    </section>
                  )}
                  <section>
                    <h3 className="mb-1.5 font-medium text-ink">預期結果</h3>
                    <p className="whitespace-pre-wrap text-muted">
                      {row.expected || '尚未補充'}
                    </p>
                  </section>
                  {!!row.decisionTable?.length && (
                    <section>
                      <h3 className="mb-2 font-medium text-ink">
                        {`決策矩陣表（${row.decisionTable.length}）`}
                      </h3>
                      <table className="w-full table-fixed border-collapse text-left">
                        <thead>
                          <tr className="border-b border-line text-muted">
                            <th className="py-2 pr-2 font-medium">測試點</th>
                            <th className="py-2 pr-2 font-medium">輸入</th>
                            <th className="py-2 font-medium">預期</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {row.decisionTable.map((entry, index) => (
                            <tr key={index} className="align-top">
                              <td className="break-words py-2 pr-2 text-ink">{entry.point}</td>
                              <td className="break-words py-2 pr-2 text-muted">{entry.input}</td>
                              <td className="break-words py-2 text-muted">{entry.expected}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}
                </div>
              )}

              {node.kind === 'step' && (
                <p className="text-muted">腳本宣告步驟，實際結果請查看執行報告。</p>
              )}

              {!!row.issues.length &&
                (node.kind === 'question' ? (
                  <section>
                    <h3 className="mb-2 font-medium text-ink">需要補充的內容</h3>
                    <ul className="list-inside list-disc space-y-2 text-warning">
                      {row.issues.map((issue, i) => (
                        <li key={i}>{issue.text}</li>
                      ))}
                    </ul>
                  </section>
                ) : (
                  <Disclosure
                    summary={
                      <span className="text-warning">{`${row.issues.length} 項待確認`}</span>
                    }
                  >
                    <ul className="list-inside list-disc space-y-1.5 text-muted">
                      {row.issues.map((issue, i) => (
                        <li key={i}>{issue.text}</li>
                      ))}
                    </ul>
                  </Disclosure>
                ))}

              {node.kind === 'api' && node.path && (
                <div className="space-y-2.5">
                  <ActionButton
                    icon="code"
                    disabled={busy}
                    onClick={() => onCode('project', node.path!)}
                  >
                    查看 API 程式碼
                  </ActionButton>
                  <ul className="space-y-1.5">
                    {row.apis
                      .find(api => api.path === node.path)
                      ?.evidence.map(source => (
                        <li key={source.path + source.line}>
                          <ActionButton
                            variant="ghost"
                            align="start"
                            className="max-w-full break-all font-mono"
                            disabled={busy}
                            onClick={() => onCode('source', source.path)}
                          >
                            {`${source.path}:${source.line}`}
                          </ActionButton>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <ActionButton
                  variant="primary"
                  icon="edit"
                  disabled={busy}
                  onClick={() => onEdit(row.id)}
                >
                  編輯測試
                </ActionButton>
                {node.kind !== 'api' && row.script && (
                  <ActionButton
                    icon="code"
                    disabled={busy}
                    onClick={() => onCode('project', row.script!)}
                  >
                    查看腳本
                  </ActionButton>
                )}
              </div>

              <Disclosure summary="更多資料">
                <MetadataGrid
                  columns={1}
                  items={[
                    ...(row.preconditions
                      ? [{ label: '前置條件', value: `前置條件：${row.preconditions}` }]
                      : []),
                    ...(row.data ? [{ label: '資料說明', value: `資料說明：${row.data}` }] : []),
                    {
                      label: '對應腳本',
                      value: (
                        <span className="break-all font-mono">
                          {row.script || '尚未連結腳本'}
                        </span>
                      ),
                    },
                    { label: '案例編號', value: <span className="font-mono">{row.id}</span> },
                    ...(row.knowledgeIds.length
                      ? [
                          {
                            label: '參考知識',
                            value: (
                              <ul className="space-y-1">
                                {row.knowledgeIds.map(id => (
                                  <li key={id}>
                                    {view.knowledge.find(doc => doc.id === id)?.title ||
                                      '知識已封存或遺失'}
                                  </li>
                                ))}
                              </ul>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </Disclosure>

              <Disclosure summary="交給本機 AI 補充">
                <div className="space-y-3">
                  <ActionButton icon="copy" onClick={() => onCopy(aiHandoff(row, feature))}>
                    複製任務文字
                  </ActionButton>
                  <textarea
                    readOnly
                    rows={6}
                    aria-label="AI 任務文字"
                    value={aiHandoff(row, feature)}
                    className="w-full resize-y rounded-lg border border-line-strong bg-canvas p-3 font-mono text-body text-ink"
                  />
                </div>
              </Disclosure>
            </>
          )
        )}

        {code && (
          <section aria-label="程式碼預覽" className="border-t border-line pt-4">
            <h3 className="mb-2.5 break-all font-mono font-medium text-ink">{code.path}</h3>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-canvas p-3 font-mono text-body text-ink">
              {code.content}
            </pre>
          </section>
        )}
      </div>
    </Surface>
  );
}
