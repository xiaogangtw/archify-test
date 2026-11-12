import type { Feature } from './catalog';
import { Disclosure } from '../../components/ui/ds';
import { SequenceDiagram } from './SequenceDiagram';

export function FeatureSequence({ feature, busy, onCode }: {
  feature: Feature; busy: boolean; onCode: (scope: string, path: string) => void;
}) {
  const sequence = feature.frontend?.sequence;
  if (!sequence?.length) return (
    <section aria-label="功能序列圖" className="space-y-2">
      <h3 className="font-medium text-ink">序列圖</h3>
      <p className="text-muted">{sequence ? '目前來源不足以確認互動順序，請先查看來源證據與業務待確認。' : '尚未分析互動順序，請使用頁首「AI 分析功能」更新；不需先建立測試案例。'}</p>
    </section>
  );
  return (
    <section aria-label="功能序列圖" className="min-w-0 space-y-2">
      {feature.frontend?.sequenceStale && <p className="text-warning">來源已變更或缺少版本基準；以下為上次分析，請重新分析。</p>}
      <Disclosure summary={`序列圖（${sequence.length} 個互動）`}>
        <p className="mb-3 text-muted">前端程式分析，尚非測試結果。編號對應下方步驟。</p>
        <SequenceDiagram title={`${feature.name}的前端序列圖`} messages={sequence.map((step,index) => ({...step,number:index + 1}))} busy={busy} onCode={onCode}>
        <ol className="mt-3 divide-y divide-line" aria-label="前端互動步驟">
          {sequence.map((step,index) => <li key={index} className="space-y-1 py-3"><p className="break-words font-medium text-ink">{`${index + 1}. ${step.action}`}</p><p className="break-words text-muted">{`${step.from} → ${step.to}`}</p>{step.condition && <p className="whitespace-pre-wrap break-words text-muted">{`條件：${step.condition}`}</p>}</li>)}
        </ol>
        </SequenceDiagram>
      </Disclosure>
    </section>
  );
}
