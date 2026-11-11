import { useRef, useState } from 'react';
import { Button } from '../../components/ui/controls';
import { ToolIcon } from '../../components/ui/ToolIcon';
import { api } from './controlApi';

export function AdbRetry({ disabledReason, onRetried }: { disabledReason?: string; onRetried: () => Promise<void> }) {
  const active = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  async function retry() {
    if (active.current || disabledReason) return;
    active.current = true;
    setPending(true); setMessage(''); setFailed(false);
    try {
      const result = await api<{ restarted: boolean }>('/android/adb/retry', { method: 'POST', body: '{}' });
      if (result.restarted !== true) throw new Error('未能確認連線已重設，請重新整理手機狀態。');
      await onRetried();
      setMessage('連線已重設，請查看手機就緒狀態。');
    } catch (reason) {
      setFailed(true);
      setMessage(reason instanceof Error ? reason.message : '連線重試失敗，請稍後再試。');
    } finally {
      active.current = false; setPending(false);
    }
  }

  return <div className="flex flex-wrap items-center gap-2 text-body">
    <Button variant="ghost" className="border-0" disabled={!!disabledReason || pending} aria-busy={pending} aria-label={pending ? '正在重試連線' : '重試連線'} title={disabledReason || (pending ? '正在重試連線' : '重試連線')} onClick={() => void retry()}>
      <ToolIcon name="refresh" />
    </Button>
    {pending ? <span role="status" className="sr-only">正在重新連接手機，請稍候。</span> : message ? <span role={failed ? 'alert' : 'status'} className={failed ? 'text-danger' : 'sr-only'}>{message}</span> : null}
  </div>;
}
