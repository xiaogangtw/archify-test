import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { ActionButton } from '../../components/ui/ds';

export function WorkspaceDialog({
  title,
  children,
  busy,
  onDismiss,
}: {
  title: string;
  children: ReactNode;
  busy?: boolean;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const items = Array.from(
          ref.current!.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
          ),
        ).filter(item => item.getClientRects().length);
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={event => {
        event.preventDefault();
        if (!busy) onDismiss();
      }}
      className="m-auto max-h-full w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-surface p-0 font-sans text-body text-ink backdrop:bg-scrim"
    >
      <div className="p-5 lg:p-6">
        <header className="mb-5 flex items-center justify-between gap-4 border-b border-line pb-4">
          <h2 id={titleId} className="text-heading font-bold">
            {title}
          </h2>
          <ActionButton
            variant="ghost"
            disabled={busy}
            onClick={onDismiss}
            aria-label="關閉對話框"
          >
            關閉
          </ActionButton>
        </header>
        {children}
      </div>
    </dialog>
  );
}
