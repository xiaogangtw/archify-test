import { SequenceDiagram } from './SequenceDiagram';
import type { CaseView } from './catalog';
import { Badge, Disclosure } from '../../components/ui/ds';
const labels: Record<string, string> = { passed: '通過', failed: '失敗', skipped: '略過', 'not-run': '未執行' };
export function stepResult(row: CaseView, action: string) {
  if (row.freshness !== 'current' || row.issues.some(issue => issue.type === 'source') || row.scripts.length !== 1) return undefined;
  const planned = row.steps?.filter(step => step.action === action) || [];
  const actual = row.latest?.steps?.filter(step => step.name === action) || [];
  return planned.length === 1 && actual.length === 1 ? actual[0] : undefined;
}
export function CaseSequence({ row, busy, onCode }: { row: CaseView; busy: boolean; onCode: (scope: string, path: string) => void }) {
  const steps = row.steps || [];
  const messages = steps.flatMap((step, index) => step.interaction ? [{ ...step.interaction, action: step.action, number: index + 1, failed: stepResult(row, step.action)?.status === 'failed' }] : []);
  if (!steps.length) return <p className="text-muted">尚無規劃步驟；補齊案例後即可查看互動順序。</p>;
  return <section aria-label="案例流程" className="min-w-0 space-y-3">
    <h3 className="font-medium text-ink">流程步驟</h3>
    <p className="text-muted">{row.latest && row.freshness === 'current' ? '結果僅標示報告中可唯一對應的步驟；未對應不代表未執行。' : '以下為規劃流程；尚無版本相符的逐步結果。'}</p>
    <ol className="divide-y divide-line">{steps.map((step,index) => {
      const result = stepResult(row, step.action);
      return <li key={index} className="space-y-2 py-3 first:pt-0">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 break-words font-medium text-ink">{index + 1}. {step.action}</p>
          <Badge tone={result?.status === 'failed' ? 'danger' : result?.status === 'passed' ? 'success' : 'neutral'}>{result ? labels[result.status] || '未對應' : '未對應'}</Badge>
        </div>
        {step.expected && <p className="whitespace-pre-wrap break-words text-muted">預期：{step.expected}</p>}
        {step.interaction && <p className="break-words text-muted">{step.interaction.from} → {step.interaction.to}</p>}
      </li>;
    })}</ol>
    {messages.length ? <Disclosure summary={'序列圖（' + messages.length + ' 個互動）'}>
      <p className="mb-3 text-muted">編號對應上方步驟，僅呈現有來源的互動。</p>
      <SequenceDiagram title={row.title + '的規劃序列圖'} messages={messages} busy={busy} onCode={onCode} />
    </Disclosure> : <p className="text-muted">尚未提供互動來源，暫不繪製序列圖。</p>}
  </section>;
}
