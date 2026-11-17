import { useId } from 'react';
import type { ReactNode } from 'react';
import { ActionButton } from '../../components/ui/ds';

export interface SequenceMessage {
  action: string; from: string; to: string; source: { path: string; line: number };
  number: number; failed?: boolean;
}

export function SequenceDiagram({ title, messages, busy, onCode, children }: {
  title: string; messages: SequenceMessage[]; busy: boolean;
  onCode: (scope: string, path: string) => void;
  children?: ReactNode;
}) {
  const markerId = useId().replaceAll(':', '');
  const participants = [...new Set(messages.flatMap(step => [step.from, step.to]))];
  const width = Math.max(240, participants.length * 120);
  const x = (name: string) => 60 + participants.indexOf(name) * 120;
  const headerHeight = Math.max(64, ...participants.map(name => Math.ceil(name.length / 6) * 24));
  const height = headerHeight + 24 + messages.length * 64;
  return (
    <>
      <div className="max-w-full overflow-x-auto rounded-lg border border-line bg-canvas p-2" tabIndex={0} role="region" aria-label="序列圖，可水平捲動">
        <svg width={width} height={height} role="img" aria-label={title} className="text-muted">
          <title>互動順序，編號對應文字步驟</title>
          <defs><marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8" fill="currentColor" /></marker></defs>
          {participants.map(name => (
            <g key={name}>
              <foreignObject x={x(name) - 52} y={0} width={104} height={headerHeight}><p className="break-words text-center font-medium text-ink">{name}</p></foreignObject>
              <line x1={x(name)} x2={x(name)} y1={headerHeight} y2={height} stroke="currentColor" strokeDasharray="4 4" />
            </g>
          ))}
          {messages.map((step, index) => {
            const from = x(step.from), to = x(step.to), y = headerHeight + 24 + index * 64;
            return (
              <g key={step.number} className={step.failed ? 'text-danger' : 'text-ink'}>
                <title>{`${step.number}. ${step.action}${step.failed ? '（失敗）' : ''}`}</title>
                {from === to
                  ? <path d={`M${from},${y} h40 v24 h-40`} fill="none" stroke="currentColor" markerEnd={`url(#${markerId})`} />
                  : <line x1={from} x2={to} y1={y} y2={y} stroke="currentColor" markerEnd={`url(#${markerId})`} />}
                <text x={from === to ? from + 16 : (from + to) / 2} y={y - 10} textAnchor="middle" fill="currentColor" className="text-body font-medium">{step.number}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {children}
      <ul className="mt-3 space-y-2" aria-label="互動來源">
        {messages.map(step => <li key={step.number}><ActionButton variant="ghost" align="start" className="max-w-full whitespace-normal break-all text-left" disabled={busy} onClick={() => onCode('source', step.source.path)}>{`${step.number}. ${step.source.path}:${step.source.line}`}</ActionButton></li>)}
      </ul>
    </>
  );
}
