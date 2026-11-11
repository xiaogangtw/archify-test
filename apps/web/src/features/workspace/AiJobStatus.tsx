import type { AiJob } from './useAiJob';
import { ActionButton, Banner } from '../../components/ui/ds';

export function AiJobStatus({
  job,
  error,
  onCancel,
  variant = 'inline',
  pendingStage,
}: {
  job?: AiJob;
  error?: string;
  onCancel: () => void;
  variant?: 'inline' | 'toast';
  pendingStage?: string;
}) {
  const isToast = variant === 'toast';
  const activeJob =
    isToast && (pendingStage || job?.status === 'completed') ? undefined : job;
  const stageText = pendingStage || activeJob?.stage;
  const showBanner = !!activeJob || !!pendingStage;

  return (
    <>
      {error && (
        <Banner
          tone="danger"
          elevated={isToast}
          className={isToast ? 'fixed inset-x-4 top-4 z-50 mx-auto max-w-xl' : 'my-3'}
        >
          {error}
        </Banner>
      )}
      {!error && showBanner && (
        <section
          aria-label="AI 分析狀態"
          className={isToast ? 'fixed inset-x-4 top-4 z-50 mx-auto max-w-xl' : 'my-3'}
        >
          <Banner
            elevated={isToast}
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
            {activeJob?.error && <p className="mt-1.5 text-muted">{activeJob.error}</p>}
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
    </>
  );
}
