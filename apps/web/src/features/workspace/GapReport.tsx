import { flowCategory, featureTestDraftHandoff } from './catalog';
import type { CatalogView } from './catalog';
import {
  featureTreeCoverage,
  orderedFeatureTree,
  singleSystemRootFeature,
} from './feature-graph';
import type { CoverageLevel, TreeCoverageMetrics } from './feature-graph';
import { ActionButton, Badge, StatStrip, Surface } from '../../components/ui/ds';
import type { Tone } from '../../components/ui/ds';

const statusLabels: Record<CoverageLevel, string> = {
  full: '充分覆蓋',
  partial: '部分覆蓋',
  none: '漏測',
  retired: '已廢棄／下線',
};

const statusTone: Record<CoverageLevel, Tone> = {
  full: 'success',
  partial: 'warning',
  none: 'danger',
  retired: 'neutral',
};

const statusOrder: Record<CoverageLevel, number> = {
  none: 0,
  partial: 1,
  retired: 2,
  full: 3,
};

export function GapReport({
  view,
  busy,
  onFocusFeature,
  onAddCase,
  onEditCase,
  onCopy,
}: {
  view: CatalogView;
  busy: boolean;
  onFocusFeature: (featureId: string) => void;
  onAddCase: (featureId: string) => void;
  onEditCase: (caseId: string) => void;
  onCopy: (text: string) => void;
}) {
  const featureById = new Map(view.catalog.features.map(item => [item.id, item]));
  const systemRoot = singleSystemRootFeature(view.catalog, view.cases);
  const coverageCache = new Map<string, TreeCoverageMetrics>();
  const rows = orderedFeatureTree(view.catalog.features, systemRoot?.id)
    .map(({ feature, parentName }) => {
      const cases = view.cases.filter(item => item.featureId === feature.id);
      const cov = featureTreeCoverage(feature.id, view, coverageCache);
      const isPureContainer =
        cov.isGroup &&
        cases.length === 0 &&
        !(feature.frontend?.pageIds?.length || 0) &&
        !(feature.frontend?.apiIds?.length || 0);
      return { feature, parentName, cases, cov, isPureContainer };
    })
    .sort(
      (a, b) =>
        Number(a.isPureContainer) - Number(b.isPureContainer) ||
        statusOrder[a.cov.coverage] - statusOrder[b.cov.coverage] ||
        a.feature.name.localeCompare(b.feature.name, 'zh-Hant'),
    );

  const summaryRows = rows.some(row => !row.isPureContainer)
    ? rows.filter(row => !row.isPureContainer)
    : rows;
  const counts = { full: 0, partial: 0, none: 0, retired: 0 };
  for (const row of summaryRows) counts[row.cov.coverage]++;

  let apiCount = 0;
  let uiCount = 0;
  let unclassifiedCount = 0;
  for (const item of view.cases) {
    const cat = flowCategory(item);
    if (cat === 'api') apiCount++;
    else if (cat === 'ui') uiCount++;
    else unclassifiedCount++;
  }
  const totalCases = view.cases.length;
  const apiPct = totalCases ? Math.round((apiCount / totalCases) * 100) : 0;
  const uiPct = totalCases ? Math.round((uiCount / totalCases) * 100) : 0;

  const retiredOrOrphanCases = view.cases.filter(item => {
    const owner = featureById.get(item.featureId);
    return !owner || owner.frontend?.state === 'not-found';
  });

  const staleKnowledgeDocs = view.knowledge.filter(doc =>
    (doc.featureIds || []).some(fid => {
      const target = featureById.get(fid);
      return !target || target.frontend?.state === 'not-found';
    }),
  );

  const featuresWithoutKnowledge = rows.filter(
    row =>
      !row.isPureContainer &&
      row.cov.coverage !== 'retired' &&
      !view.knowledge.some(doc => doc.featureIds?.includes(row.feature.id)),
  );

  return (
    <div className="space-y-6">
      <section aria-label="覆蓋現況與測試金字塔" className="space-y-3">
        <StatStrip
          items={[
            { label: '質量盲區（漏測）', value: counts.none, tone: counts.none ? 'danger' : 'neutral' },
            {
              label: '部分覆蓋',
              value: counts.partial,
              meta: '缺逆向或邊界因子',
              tone: counts.partial ? 'warning' : 'neutral',
            },
            { label: '充分覆蓋', value: counts.full, tone: counts.full ? 'success' : 'neutral' },
            { label: '已廢棄／下線', value: counts.retired },
          ]}
        />
        <Surface variant="subtle" padding="sm">
          <div className="flex flex-wrap items-center justify-between gap-2 text-muted">
            <span>
              {`測試分佈（${totalCases} 案例）：API ${apiCount}（${apiPct}%）· 畫面 ${uiCount}（${uiPct}%）`}
              {unclassifiedCount > 0 ? ` · 待分類 ${unclassifiedCount}` : ''}
            </span>
            {totalCases > 0 && uiCount > apiCount && (
              <Badge tone="warning" dot>
                畫面案例數高於 API
              </Badge>
            )}
          </div>
        </Surface>
      </section>

      <Surface padding="none" aria-label="雙向缺口決策報表" className="overflow-hidden">
        <div className="border-b border-line bg-surface-subtle px-4 py-3">
          <h2 className="text-section font-bold text-ink">功能缺口決策表</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left" aria-label="功能缺口決策表">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="w-2/5 p-3.5 font-medium">功能</th>
                <th className="w-1/5 p-3.5 font-medium">狀態</th>
                <th className="w-1/5 p-3.5 font-medium">測試因子</th>
                <th className="w-1/5 p-3.5 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ feature, parentName, cov, isPureContainer }) => {
                const negAndBound = cov.negativeCount + cov.boundaryCount;
                const secAndErr = cov.securityCount + cov.errorCount;
                return (
                  <tr key={feature.id} className="align-top hover:bg-surface-subtle">
                    <td className="break-words p-3.5">
                      {parentName && <p className="text-muted">{parentName}</p>}
                      <p
                        className={
                          cov.coverage === 'retired'
                            ? 'font-medium text-muted line-through'
                            : 'font-medium text-ink'
                        }
                      >
                        {feature.name}
                        {feature.frontend?.level ? ` · L${feature.frontend.level}` : ''}
                      </p>
                      <p className="mt-1 font-mono text-muted">
                        {`${feature.id} · ${isPureContainer ? `${cov.childCount} 子功能 / ` : ''}${cov.caseCount} 案例`}
                      </p>
                    </td>
                    <td className="p-3.5">
                      <Badge tone={statusTone[cov.coverage]} dot>
                        {statusLabels[cov.coverage]}
                      </Badge>
                    </td>
                    <td className="break-words p-3.5 text-muted">
                      <p className="tabular-nums text-ink">
                        {`正 ${cov.positiveCount} / 反邊 ${negAndBound} / 安異 ${secAndErr}`}
                      </p>
                      {cov.coverage !== 'retired' && cov.missingFactors.length > 0 && (
                        <p className="mt-1 text-warning">{`缺：${cov.missingFactors.join('、')}`}</p>
                      )}
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-wrap gap-2">
                        <ActionButton onClick={() => onFocusFeature(feature.id)}>查看</ActionButton>
                        {!isPureContainer && cov.coverage !== 'full' && cov.coverage !== 'retired' && (
                          <>
                            <ActionButton
                              disabled={busy}
                              onClick={() => onAddCase(feature.id)}
                            >
                              新增測試
                            </ActionButton>
                            <ActionButton
                              variant="ghost"
                              icon="copy"
                              disabled={busy}
                              onClick={() => onCopy(featureTestDraftHandoff(feature, view))}
                            >
                              複製任務
                            </ActionButton>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Surface>

      {retiredOrOrphanCases.length > 0 && (
        <Surface aria-label="孤立與廢棄案例待清理清單" className="space-y-3">
          <h2 className="text-section font-bold text-ink">
            {`孤立／廢棄案例待清理（${retiredOrOrphanCases.length}）`}
          </h2>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-canvas">
            {retiredOrOrphanCases.map(item => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{item.title}</p>
                  <p className="mt-0.5 break-all font-mono text-muted">
                    {`${item.featureId}${item.script ? ` · ${item.script}` : ''}`}
                  </p>
                </div>
                <ActionButton disabled={busy} onClick={() => onEditCase(item.id)}>
                  編輯遷移
                </ActionButton>
              </li>
            ))}
          </ul>
        </Surface>
      )}

      {(staleKnowledgeDocs.length > 0 || featuresWithoutKnowledge.length > 0) && (
        <Surface aria-label="PRD 與知識覆蓋提醒" className="space-y-3">
          <h2 className="text-section font-bold text-ink">PRD／知識比對</h2>
          {staleKnowledgeDocs.length > 0 && (
            <div>
              <p className="font-medium text-warning">
                {`已關聯失效功能 ID 的知識（${staleKnowledgeDocs.length}）`}
              </p>
              <ul className="mt-1 list-inside list-disc text-muted">
                {staleKnowledgeDocs.map(doc => (
                  <li key={doc.id}>{doc.title}</li>
                ))}
              </ul>
            </div>
          )}
          {featuresWithoutKnowledge.length > 0 && (
            <div>
              <p className="text-muted">
                {`尚未關聯知識的功能（${featuresWithoutKnowledge.length}）`}
              </p>
              <p className="mt-1 text-ink">
                {featuresWithoutKnowledge.map(r => r.feature.name).join('、')}
              </p>
            </div>
          )}
        </Surface>
      )}
    </div>
  );
}
