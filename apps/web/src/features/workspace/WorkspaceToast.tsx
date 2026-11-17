import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Banner } from '../../components/ui/ds';
import type { Tone } from '../../components/ui/ds';

export function WorkspaceToast({
  open = true,
  tone = 'neutral',
  role,
  children,
  action,
  onDismiss,
  autoHideMs = 3000,
}: {
  open?: boolean;
  tone?: Tone;
  role?: 'status' | 'alert';
  children?: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  autoHideMs?: number;
}) {
  useEffect(() => {
    if (!open || !autoHideMs || !onDismiss) return;
    const timer = setTimeout(() => onDismiss(), autoHideMs);
    return () => clearTimeout(timer);
  }, [open, autoHideMs, onDismiss, children]);

  if (!open || !children) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-50 mx-auto max-w-md">
      <div className="pointer-events-auto">
        <Banner elevated tone={tone} role={role} action={action}>
          {children}
        </Banner>
      </div>
    </div>
  );
}
