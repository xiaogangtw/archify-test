import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/controls';
import { ToolIcon } from '../../components/ui/ToolIcon';
import type { AndroidFlowRun } from './AndroidFlowExecution';
import type { ScriptDraft } from './scriptModel';

export type FlowNotification = { script: ScriptDraft; run: AndroidFlowRun };

export function FlowNotifications({ items, disabled, deletedIds = [], onEdit, onOpen }: { items: FlowNotification[]; disabled: boolean; deletedIds?: string[]; onEdit: (item: FlowNotification) => void; onOpen?: () => void }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<string[]>([]);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const unread = items.filter(item => !read.includes(item.run.id)).length;
  useEffect(() => {
    if (!open) return;
    setRead(items.map(item => item.run.id));
    const dismiss = (event: PointerEvent) => { if (!container.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [items, open]);
  return <div ref={container} className="flex min-w-0 flex-1 justify-end">
    <Button ref={trigger} size="compact" aria-label={`測試通知${unread ? `，${unread} 則未讀` : ''}`} aria-expanded={open} aria-controls="flow-notifications" title="測試通知" onClick={() => { if (!open) onOpen?.(); setOpen(value => !value); }}>
      <ToolIcon name="bell" />{unread > 0 && <span className="tabular-nums">{unread}</span>}
    </Button>
    <section id="flow-notifications" aria-label="測試通知清單" hidden={!open} className="absolute right-0 top-full z-30 mt-2 w-full min-w-0 rounded-xl border border-line bg-surface p-3 shadow-popover sm:w-96">
      <h3 className="mb-2 text-body font-medium">測試通知</h3>
      {!items.length ? <p className="py-3 text-menu text-muted">本頁尚無測試結果。</p> : <ol className="max-h-80 space-y-2 overflow-y-auto">
        {items.map(item => {
          const passed = item.run.status === 'passed', failed = item.run.status === 'failed', removed = deletedIds.includes(item.script.id);
          return <li key={item.run.id}><button type="button" disabled={disabled || removed} onClick={() => { setOpen(false); onEdit(item); }} className={`w-full space-y-1 rounded-lg border p-3 text-left text-menu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50 ${passed ? 'border-success bg-success-soft text-success hover:bg-surface active:bg-success-soft' : failed ? 'border-danger bg-danger-soft text-danger hover:bg-surface active:bg-danger-soft' : 'border-warning bg-warning-soft text-warning hover:bg-surface active:bg-warning-soft'}`}>
            <span className="flex flex-wrap items-center justify-between gap-2"><span className="min-w-0 break-words font-medium">{item.script.name}</span><span>{passed ? '通過' : failed ? '失敗' : '結果未確認'}</span></span>
            <span className="block break-words">{item.run.message}</span>
            <span className="block text-ink">{removed ? '案例已刪除' : '編輯案例'}</span>
          </button></li>;
        })}
      </ol>}
    </section>
  </div>;
}
