import { Button, cx } from '../../components/ui/controls';
import { ToolIcon } from '../../components/ui/ToolIcon';

export function FlowResultToast({ status, title, message, onClose }: {
  status: 'passed' | 'failed' | 'unknown';
  title: string;
  message: string;
  onClose: () => void;
}) {
  return <section aria-label="測試結果通知" role="status" aria-live="polite" aria-atomic="true"
    className="fixed bottom-4 right-4 z-50 flex w-toast max-w-toast items-start gap-3 rounded-xl border border-line bg-surface p-4 font-sans text-ink shadow-popover">
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={cx('mt-1 h-5 w-5 shrink-0', status === 'passed' ? 'text-success' : status === 'failed' ? 'text-danger' : 'text-warning')}>
      {status === 'passed' ? <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></> : status === 'failed' ? <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></> : <><path d="m12 3 10 18H2L12 3Z" /><path d="M12 9v4m0 4h.01" /></>}
    </svg>
    <div className="min-w-0 flex-1 space-y-1">
      <p className="break-words text-section font-medium">{title}</p>
      <p className="line-clamp-3 break-words text-body text-muted">{message}</p>
    </div>
    <Button size="compact" variant="ghost" className="shrink-0 border-0" aria-label="關閉測試結果通知" title="關閉提示" onClick={onClose}>
      <ToolIcon name="close" />
    </Button>
  </section>;
}
