import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { settings, operation } from './client';
import type { LocalConfig } from './client';
import { factorLabels, flowCategory } from './catalog';
import type { Catalog } from './catalog';
import {
  ActionButton,
  Badge,
  Banner,
  EmptyState,
  PageHeader,
  SegmentedGroup,
  Surface,
  WorkspaceShell,
} from '../../components/ui/ds';

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

      {error && (
        <Banner tone="danger" className="mb-5">
          {error}
          {catalog ? ' 原表格已保留。' : ''}
        </Banner>
      )}
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
                  {['案例／功能', '前置條件', '測試步驟', '預期結果／清理', '待補資訊'].map(
                    label => (
                      <th scope="col" key={label} className="p-3.5 font-medium">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(row => (
                  <tr key={row.id} className="align-top hover:bg-surface-subtle">
                    <th scope="row" className="break-words p-3.5 font-medium text-ink">
                      <span className="block">{row.title}</span>
                      <span className="mt-1.5 block font-normal text-muted">
                        {catalog.features.find(feature => feature.id === row.featureId)?.name}
                      </span>
                      {(row.target === 'web' ||
                        row.target === 'mobile' ||
                        row.target === 'mixed' ||
                        row.factor) && (
                        <div className="mt-2 flex flex-wrap gap-1.5 font-normal">
                          {(row.target === 'web' ||
                            row.target === 'mobile' ||
                            row.target === 'mixed') && (
                            <Badge tone="neutral">
                              {row.target === 'web'
                                ? '網頁'
                                : row.target === 'mobile'
                                  ? 'Android 推播'
                                  : '跨平台'}
                            </Badge>
                          )}
                          {row.factor && <Badge tone="neutral">{factorLabels[row.factor]}</Badge>}
                        </div>
                      )}
                    </th>
                    <td className="whitespace-pre-wrap break-words p-3.5 text-ink">
                      {row.preconditions || <span className="text-muted">尚未填寫</span>}
                    </td>
                    <td className="break-words p-3.5">
                      {row.steps?.length ? (
                        <ol className="list-inside list-decimal space-y-2.5">
                          {row.steps.map((step, index) => (
                            <li key={index}>
                              <span className="whitespace-pre-wrap text-ink">
                                {step.action || '尚未填寫'}
                              </span>
                              <p className="mt-1 whitespace-pre-wrap text-muted">
                                {`預期：${step.expected || '尚未填寫'}`}
                              </p>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <span className="text-muted">尚未填寫</span>
                      )}
                      {!!row.decisionTable?.length && (
                        <div className="mt-3 border-t border-line pt-3">
                          <p className="mb-2 font-medium text-muted">
                            {`決策矩陣（${row.decisionTable.length}）`}
                          </p>
                          <ul className="space-y-1.5 text-muted">
                            {row.decisionTable.map((entry, index) => (
                              <li key={index}>
                                <span className="font-medium text-ink">{entry.point}</span>
                                {`：${entry.input} ➔ ${entry.expected}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </td>
                    <td className="break-words p-3.5">
                      <p className="whitespace-pre-wrap text-ink">
                        {row.expected || '尚未填寫'}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-muted">
                        {`清理：${row.cleanup || '尚未填寫'}`}
                      </p>
                    </td>
                    <td className="break-words p-3.5">
                      {row.questions.some(question => !question.answer.trim()) ? (
                        <ul className="space-y-2 text-warning">
                          {row.questions
                            .filter(question => !question.answer.trim())
                            .map((question, index) => (
                              <li key={index} className="whitespace-pre-wrap">
                                {question.text}
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-6 text-muted">尚無測試流程。</p>
          )}
        </Surface>
      )}
    </WorkspaceShell>
  );
}
