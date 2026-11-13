import { useState } from 'react';
import type { CaseView, Feature } from './catalog';
import { flowCategory, freshnessLabels, resultLabels } from './catalog';
import { ActionButton, Badge, Disclosure, SearchField, SegmentedGroup, Surface } from '../../components/ui/ds';
type Filter = 'all' | 'quality' | 'scripts' | 'failed' | 'version';
type Category = 'all' | 'api' | 'ui' | 'unclassified';
const needsQuality = (row: CaseView) => !!(row.qualityWarnings?.length || row.review?.problems.length);
const needsScript = (row: CaseView) => row.scripts.length !== 1 || row.issues.some(issue => ['identity', 'duplicate'].includes(issue.type));
const needsVersion = (row: CaseView) => (!!row.latest && row.freshness !== 'current') || row.issues.some(issue => ['source', 'knowledge', 'knowledge-run', 'intent', 'dependency'].includes(issue.type));
const matchesFilter = (row: CaseView, filter: Filter) => filter === 'all' || (filter === 'quality' ? needsQuality(row) : filter === 'scripts' ? needsScript(row) : filter === 'failed' ? row.latest?.status === 'failed' : needsVersion(row));
const priority = (row: CaseView) => row.latest?.status === 'failed' ? 0 : needsVersion(row) ? 1 : needsQuality(row) ? 2 : needsScript(row) ? 3 : 4;
export function CaseTrackingTable({ cases, features, busy, onCase }: {
    cases: CaseView[];
    features: Feature[];
    busy: boolean;
    onCase: (id: string) => void;
}) {
    const [filter, setFilter] = useState<Filter>('all');
    const [category, setCategory] = useState<Category>('all');
    const [query, setQuery] = useState('');
    const owners = new Map(features.map(feature => [feature.id, feature.name]));
    const scope = cases.filter(row => (category === 'all' || flowCategory(row) === category) && `${row.title} ${row.id} ${owners.get(row.featureId) || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
    const filters: {
        id: Filter;
        label: string;
    }[] = [
        { id: 'all', label: '全部' }, { id: 'quality', label: '案例待補' }, { id: 'scripts', label: '腳本待核對' }, { id: 'failed', label: '最近失敗' }, { id: 'version', label: '版本待核對' },
    ];
    const rows = scope.filter(row => matchesFilter(row, filter)).sort((a, b) => priority(a) - priority(b) || a.title.localeCompare(b.title, 'zh-Hant'));
    return <section className="min-w-0 space-y-3" aria-label="測試追蹤">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h3 className="font-medium text-ink">測試追蹤</h3><p className="mt-1 text-muted">案例品質、腳本與實測結果分別核對；無提醒仍需確認業務規則。</p></div>
      <p className="text-muted" role="status">{`顯示 ${rows.length} / ${cases.length} 個案例`}</p>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <SearchField label="搜尋測試案例" placeholder="搜尋案例、功能或編號" value={query} onChange={event => setQuery(event.target.value)} className="w-full max-w-sm"/>
      <SegmentedGroup<Category> label="驗證類型" value={category} onChange={setCategory} options={[{ id: 'all', label: '全部類型' }, { id: 'api', label: 'API' }, { id: 'ui', label: '畫面' }, { id: 'unclassified', label: '未分類' }]}/>
    </div>
    <SegmentedGroup<Filter> label="追蹤狀態" value={filter} onChange={setFilter} options={filters.map(item => ({ ...item, label: `${item.label}（${scope.filter(row => matchesFilter(row, item.id)).length}）` }))}/>
    <p className="text-muted">待處理數量可重疊；失敗優先，其次為版本與案例疑點。</p>
    <Surface padding="none" className="min-w-0 overflow-hidden" aria-label="測試清單">
      {rows.length ? <div className="overflow-x-auto"><table aria-label="測試清單" className="w-full table-fixed text-left text-body">
        <caption className="sr-only">依最近失敗與待核對項目排序的測試追蹤表</caption>
        <thead><tr className="border-b border-line bg-surface-subtle text-muted">{['功能／案例', '案例品質', '腳本關聯', '最近結果', '版本核對'].map(label => <th key={label} scope="col" className={label === '功能／案例' ? 'w-1/4 p-3 font-medium' : 'p-3 font-medium'}>{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{rows.map(row => {
                const sourceIssue = row.issues.some(issue => issue.type === 'source');
                const warnings = row.qualityWarnings;
                const problems = row.review?.problems || [];
                return <tr key={row.id} className="align-top hover:bg-surface-subtle">
            <td className="break-words p-3"><p className="mb-1 text-muted">{owners.get(row.featureId) || '未對應功能'}</p><ActionButton disabled={busy} variant="ghost" align="start" className="max-w-full whitespace-normal break-words text-left" title={row.title} onClick={() => onCase(row.id)}><span className="line-clamp-2">{row.title}</span></ActionButton></td>
            <td className="break-words p-3">{needsQuality(row) ? <Disclosure className="border-0 bg-transparent" summaryClassName="px-0 py-1" summary="查看待補項目"><ul className="space-y-2 text-muted">{problems.map((message, i) => <li key={`problem-${i}`}>{message}</li>)}{warnings?.map((warning, i) => <li key={`warning-${i}`}><p>{warning.message}</p><p className="mt-1 break-all font-mono">{warning.location}</p></li>)}</ul></Disclosure> : <span className="text-muted">{warnings ? '無提醒' : '尚未檢查'}</span>}</td>
            <td className="break-words p-3"><Badge tone={needsScript(row) ? 'warning' : 'neutral'}>{!row.scripts.length ? '未連結' : needsScript(row) ? '關聯待核對' : '已連結'}</Badge><Disclosure className="border-0 bg-transparent" summaryClassName="px-0 py-1" summary="腳本與關聯"><ul className="space-y-2 break-all text-muted">{row.scripts.length ? row.scripts.map(path => <li key={path} className="font-mono">{path}</li>) : <li>尚未找到對應腳本。</li>}{row.issues.filter(issue => ['script', 'identity', 'duplicate'].includes(issue.type)).map((issue, i) => <li key={i}>{issue.text}</li>)}</ul></Disclosure></td>
            <td className="break-words p-3"><Badge tone={row.latest?.status === 'failed' ? 'danger' : row.latest?.status === 'passed' && row.freshness === 'current' && !sourceIssue && !needsScript(row) ? 'success' : 'neutral'}>{row.latest ? `上次${resultLabels[row.latest.status] || '狀態未知'}` : '未執行'}</Badge>{row.latest && <p className="mt-2 text-muted">{new Date(row.latest.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>}</td>
            <td className="break-words p-3"><span className={needsVersion(row) ? 'text-warning' : 'text-muted'}>{sourceIssue ? '來源待核對' : row.latest ? freshnessLabels[row.freshness] : '尚無報告基準'}</span>{row.issues.filter(issue => !['script', 'identity', 'duplicate'].includes(issue.type)).length > 0 && <Disclosure className="border-0 bg-transparent" summaryClassName="px-0 py-1" summary="核對明細"><ul className="space-y-2 text-muted">{row.issues.filter(issue => !['script', 'identity', 'duplicate'].includes(issue.type)).map((issue, i) => <li key={i}>{issue.text}</li>)}</ul></Disclosure>}</td>
          </tr>;
            })}</tbody>
      </table></div> : <div className="space-y-3 p-6"><p className="text-muted">{cases.length ? '沒有符合條件的案例。' : '這個功能還沒有測試。'}</p>{cases.length > 0 && <ActionButton onClick={() => { setFilter('all'); setCategory('all'); setQuery(''); }}>清除篩選</ActionButton>}</div>}
    </Surface>
  </section>;
}
