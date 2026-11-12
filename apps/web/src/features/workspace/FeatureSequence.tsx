import type { Feature } from './catalog';
import { ActionButton, Disclosure } from '../../components/ui/ds';

export function FeatureSequence({ feature, busy, onCode }: {
  feature: Feature; busy: boolean; onCode: (scope: string, path: string) => void;
}) {
  const sequence = feature.frontend?.sequence;
  if (!sequence?.length) return (
    <section aria-label="前端操作與 API 流程" className="space-y-2">
      <h3 className="font-medium text-ink">前端操作與 API 流程</h3>
      <p className="text-muted">{sequence ? '目前來源不足以確認互動順序，請先查看來源證據與業務待確認。' : '尚未分析互動順序，請使用頁首「AI 分析功能」更新；不需先建立測試案例。'}</p>
    </section>
  );
  return (
    <section aria-label="前端操作與 API 流程" className="min-w-0 space-y-3">
      <h3 className="font-medium text-ink">前端操作與 API 流程</h3>
      {feature.frontend?.sequenceStale && <p className="text-warning">來源已變更或缺少版本基準；以下為上次分析，請重新分析。</p>}
      <p className="text-muted">依前端程式整理，尚非實際執行結果。</p>
      {sequence.some(step => step.api === undefined || step.transfer === undefined) && <p className="text-muted">舊分析尚缺 API 或資料傳遞說明，可使用頁首「AI 分析功能」補齊。</p>}
      <div className="max-w-full overflow-x-auto rounded-lg border border-line" role="region" aria-label="API 流程表，可水平捲動" tabIndex={0}>
        <table className="w-full min-w-feature-flow table-fixed border-collapse text-left" aria-label="前端操作與 API 流程表">
          <thead className="bg-canvas text-muted"><tr>{['前端操作', '呼叫的 API', '資料傳遞', '等待／執行條件'].map(label => <th key={label} scope="col" className="px-3 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {sequence.map((step,index) => (
              <tr key={index} className="align-top">
                <th scope="row" className="whitespace-pre-wrap break-words px-3 py-3 font-medium text-ink">{`${index + 1}. ${step.action}`}</th>
                <td className="whitespace-pre-wrap break-words px-3 py-3 text-muted">{step.api === undefined ? '尚未分析' : step.api || '未呼叫 API'}</td>
                <td className="whitespace-pre-wrap break-words px-3 py-3 text-muted">{step.transfer === undefined ? '尚未分析' : step.transfer || '無需傳遞資料'}</td>
                <td className="whitespace-pre-wrap break-words px-3 py-3 text-muted">{step.condition || '未列額外條件'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Disclosure summary="流程來源證據">
        <ul className="space-y-2">{sequence.map((step,index) => <li key={index}><ActionButton variant="ghost" align="start" className="max-w-full whitespace-normal break-all text-left" disabled={busy} onClick={() => onCode('source', step.source.path)}>{`${index + 1}. ${step.source.path}:${step.source.line}`}</ActionButton></li>)}</ul>
      </Disclosure>
    </section>
  );
}
