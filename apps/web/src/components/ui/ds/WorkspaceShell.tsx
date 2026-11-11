import type { ReactNode } from 'react';
import { cx } from './Primitives';

export function WorkspaceShell({
  navigation,
  children,
  wide = false,
  asideLabel,
}: {
  navigation: ReactNode;
  children: ReactNode;
  wide?: boolean;
  asideLabel?: string;
}) {
  return (
    <div className="app-shell !flex flex-col bg-canvas font-sans text-body text-ink lg:!grid lg:!grid-cols-api-shell">
      <aside
        aria-label={asideLabel}
        className="flex shrink-0 flex-col gap-5 border-b border-line bg-sidebar p-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r lg:p-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex items-center gap-2.5 px-1">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 shrink-0 text-ink"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 17L12 4l8 13H4Z" />
            <path d="M9 17l3-5 3 5" />
          </svg>
          <p className="text-section font-bold tracking-tight text-ink">Archify Test</p>
        </div>
        {navigation}
      </aside>
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5 [overflow-wrap:anywhere] lg:p-7">
        <div className={cx('mx-auto min-w-0', !wide && 'max-w-workspace')}>{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cx(
        'mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-heading font-bold text-ink">{title}</h1>
        {meta && <div className="mt-1.5 min-w-0 text-muted">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
