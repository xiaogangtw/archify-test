import { useEffect } from 'react';
import type { AiJob } from './useAiJob';
import { ActionButton, Banner } from '../../components/ui/ds';

export function AiJobStatus({
  job,
  error,
  onCancel,
  onDismiss,
  hideCompleted = false,
  pendingStage,
}: {
  job?: AiJob;
  error?: string;
  onCancel: () => void;
  onDismiss?: () => void;
  hideCompleted?: boolean;
  pendingStage?: string;
}) {
  const activeJob =
    hideCompleted && (pendingStage || job?.status === 'completed') ? undefined : job;
  const stageText = pendingStage || activeJob?.stage;
  const showBanner = !!activeJob || !!pendingStage;
  const isRunning = !!pendingStage || activeJob?.status === 'running';

  useEffect(() => {
    if (!onDismiss || isRunning || (!error && !activeJob)) return;
    const timer = setTimeout(() => onDismiss(), 3000);
    return () => clearTimeout(timer);
  }, [error, isRunning, activeJob?.id, activeJob?.status, onDismiss]);

  if (!error && !showBanner) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-50 mx-auto max-w-md">
      <div className="pointer-events-auto">
        {error && (
          <Banner tone="danger" elevated role="alert">
            {error}
          </Banner>
        )}
        {!error && showBanner && (
          <section aria-label="AI 分析狀態">
            <Banner
              elevated
              tone={
                activeJob?.status === 'failed'
                  ? 'danger'
                  : activeJob?.status === 'completed'
                    ? 'success'
                    : 'neutral'
              }
              role={activeJob?.status === 'failed' ? 'alert' : 'status'}
              action={
                activeJob?.status === 'running' ? (
                  <ActionButton variant="secondary" onClick={onCancel}>
                    取消分析
                  </ActionButton>
                ) : undefined
              }
            >
              <p className="font-medium">
                {stageText}
                {activeJob?.status === 'completed' && activeJob.kind === 'knowledge'
                  ? `：已整理 ${activeJob.result?.updated || 0} 份、取代 ${activeJob.result?.replaced || 0} 份舊知識`
                  : activeJob?.status === 'completed' && activeJob.kind === 'features'
                    ? `：${activeJob.result?.coverage?.features || 0} 個功能`
                    : ''}
              </p>
              {activeJob?.error && <p className="mt-1 text-muted">{activeJob.error}</p>}
              {!!activeJob?.result?.conflicts?.length && (
                <ul className="mt-2 list-inside list-disc space-y-1 text-warning">
                  {activeJob.result.conflicts.map(text => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              )}
            </Banner>
          </section>
        )}
      </div>
    </div>
  );
}
