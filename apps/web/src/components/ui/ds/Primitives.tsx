import { useId } from 'react';
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';
import { WorkspaceIcon } from './WorkspaceIcons';
import type { WorkspaceIconName } from './WorkspaceIcons';

export function cx(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(' ');
}

export type Tone = 'neutral' | 'success' | 'warning' | 'danger';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const controlFocus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none';

const buttonBase = cx(
  'inline-flex min-h-8 min-w-6 items-center gap-2 rounded-lg border px-3 py-1 text-body font-medium',
  'disabled:cursor-not-allowed disabled:opacity-50',
  controlFocus,
);

const buttonAlign = {
  center: 'justify-center text-center',
  start: 'justify-start text-left',
  between: 'justify-between text-left',
};

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'border-brand bg-brand text-on-brand hover:border-brand-strong hover:bg-brand-strong active:border-brand-strong active:bg-brand-strong',
  secondary:
    'border-line-strong bg-surface text-ink hover:bg-brand-soft active:bg-surface-active',
  ghost:
    'border-transparent bg-transparent text-muted hover:bg-surface-subtle hover:text-ink active:bg-brand-soft active:text-ink',
  danger:
    'border-danger bg-danger-soft text-danger hover:border-line-strong active:bg-canvas',
};

export function ActionButton({
  variant = 'secondary',
  align = 'center',
  icon,
  children,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  align?: keyof typeof buttonAlign;
  icon?: WorkspaceIconName;
}) {
  return (
    <button
      type={type}
      className={cx(buttonBase, buttonAlign[align], buttonVariants[variant], className)}
      {...props}
    >
      {icon && <WorkspaceIcon name={icon} />}
      {children}
    </button>
  );
}

export function ActionLink({
  variant = 'secondary',
  align = 'center',
  icon,
  children,
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ButtonVariant;
  align?: keyof typeof buttonAlign;
  icon?: WorkspaceIconName;
}) {
  return (
    <a className={cx(buttonBase, buttonAlign[align], buttonVariants[variant], className)} {...props}>
      {icon && <WorkspaceIcon name={icon} />}
      {children}
    </a>
  );
}

export function SegmentedGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  disabled = false,
  className,
}: {
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: readonly { id: T; label: string }[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        'inline-flex flex-wrap items-center gap-1 rounded-xl border border-line bg-sidebar p-1',
        className,
      )}
    >
      {options.map(option => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cx(
              'min-h-8 min-w-6 rounded-lg border px-3 py-1 text-body disabled:cursor-not-allowed disabled:opacity-50',
              controlFocus,
              active
                ? 'border-line bg-brand-soft font-medium text-ink'
                : 'border-transparent bg-transparent text-muted hover:bg-surface hover:text-ink active:bg-surface-active',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

const dotTone: Record<Tone, string> = {
  neutral: 'bg-muted',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

const badgeTone: Record<Tone, string> = {
  neutral: 'border-line bg-surface-subtle text-muted',
  success: 'border-success/30 bg-success-soft text-success',
  warning: 'border-warning/30 bg-warning-soft text-warning',
  danger: 'border-danger/30 bg-danger-soft text-danger',
};

export function StatusDot({ tone = 'neutral' }: { tone?: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={cx('inline-block h-2 w-2 shrink-0 rounded-full', dotTone[tone])}
    />
  );
}

export function Badge({
  tone = 'neutral',
  dot = false,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-0.5 text-body font-medium',
        badgeTone[tone],
        className,
      )}
      {...props}
    >
      {dot && <StatusDot tone={tone} />}
      {children}
    </span>
  );
}

const bannerTone: Record<Tone, string> = {
  neutral: 'border-line bg-surface text-ink',
  success: 'border-line bg-surface text-success',
  warning: 'border-line bg-warning-soft text-warning',
  danger: 'border-danger bg-danger-soft text-danger',
};

const elevatedTone: Record<Tone, string> = {
  neutral: 'border-line-strong bg-surface text-ink shadow-popover',
  success: 'border-success/50 bg-surface text-ink shadow-popover',
  warning: 'border-warning/50 bg-surface text-ink shadow-popover',
  danger: 'border-danger/60 bg-surface text-ink shadow-popover',
};

const iconTone: Record<Tone, string> = {
  neutral: 'text-muted',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function Banner({
  tone = 'neutral',
  elevated = false,
  role,
  children,
  action,
  className,
}: {
  tone?: Tone;
  elevated?: boolean;
  role?: 'status' | 'alert';
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const toneClass = elevated ? elevatedTone[tone] : bannerTone[tone];
  return (
    <div
      role={role || (tone === 'danger' ? 'alert' : 'status')}
      className={cx(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-body',
        toneClass,
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <WorkspaceIcon
          name={tone === 'danger' || tone === 'warning' ? 'alert' : tone === 'success' ? 'check' : 'sparkles'}
          className={cx('mt-0.5 h-4 w-4', elevated && iconTone[tone])}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export const fieldInputClass = cx(
  'min-h-8 w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-body text-ink placeholder:text-muted',
  'hover:border-ink/40 focus:border-brand disabled:cursor-not-allowed disabled:opacity-50',
  controlFocus,
);

export function SearchField({
  label,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div className={cx('relative min-w-0', className)}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"
      >
        <WorkspaceIcon name="search" />
      </span>
      <input
        type="search"
        aria-label={label}
        className={cx(fieldInputClass, 'pl-9')}
        {...props}
      />
    </div>
  );
}

export function TextField({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className={cx('min-w-0 space-y-1.5', className)}>
      <label htmlFor={id} className="block font-medium text-ink">
        {label}
      </label>
      <input id={id} className={fieldInputClass} {...props} />
      {hint && <p className="text-muted">{hint}</p>}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className={cx('min-w-0 space-y-1.5', className)}>
      <label htmlFor={id} className="block font-medium text-ink">
        {label}
      </label>
      <textarea id={id} className={cx(fieldInputClass, 'resize-y')} {...props} />
      {hint && <p className="text-muted">{hint}</p>}
    </div>
  );
}

export function Surface({
  variant = 'default',
  padding = 'md',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & {
  variant?: 'default' | 'subtle' | 'canvas';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}) {
  const bg =
    variant === 'subtle'
      ? 'bg-surface-subtle'
      : variant === 'canvas'
        ? 'bg-canvas'
        : 'bg-surface';
  const pad =
    padding === 'none'
      ? ''
      : padding === 'sm'
        ? 'p-3'
        : padding === 'lg'
          ? 'p-5 lg:p-6'
          : 'p-4 lg:p-5';
  return (
    <section
      className={cx('min-w-0 rounded-xl border border-line', bg, pad, className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function StatStrip({
  items,
  label,
  className,
}: {
  label?: string;
  items: readonly {
    label: string;
    value: ReactNode;
    meta?: ReactNode;
    tone?: Tone;
  }[];
  className?: string;
}) {
  const valueTone: Record<Tone, string> = {
    neutral: 'text-ink',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  };
  return (
    <section
      aria-label={label}
      className={cx(
        'grid divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface lg:divide-x lg:divide-y-0',
        items.length === 4
          ? 'sm:grid-cols-2 lg:grid-cols-4'
          : items.length === 3
            ? 'lg:grid-cols-3'
            : items.length === 2
              ? 'sm:grid-cols-2'
              : '',
        className,
      )}
    >
      {items.map(item => (
        <div key={item.label} className="min-w-0 px-4 py-3.5">
          <p className="text-muted">{item.label}</p>
          <p className={cx('mt-1 truncate text-heading font-bold tabular-nums', valueTone[item.tone || 'neutral'])}>
            {item.value}
          </p>
          {item.meta && <p className="mt-0.5 truncate text-muted">{item.meta}</p>}
        </div>
      ))}
    </section>
  );
}

export function Disclosure({
  summary,
  summaryClassName,
  children,
  className,
  open,
  onToggle,
  'aria-busy': ariaBusy,
}: {
  summary: ReactNode;
  summaryClassName?: string;
  children: ReactNode;
  className?: string;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  'aria-busy'?: boolean;
}) {
  return (
    <details
      open={open}
      aria-busy={ariaBusy}
      onToggle={event => onToggle?.(event.currentTarget.open)}
      className={cx('group rounded-xl border border-line bg-surface', className)}
    >
      <summary
        className={cx(
          'flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 py-2.5 text-body font-medium hover:bg-surface-subtle',
          controlFocus,
          summaryClassName,
        )}
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <WorkspaceIcon
          name="chevron"
          className="h-4 w-4 text-muted group-open:rotate-90"
        />
      </summary>
      <div className="border-t border-line px-4 py-4">{children}</div>
    </details>
  );
}

export function MetadataGrid({
  items,
  columns = 2,
  className,
}: {
  items: readonly { label: string; value: ReactNode; full?: boolean }[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl
      className={cx(
        'grid gap-x-6 gap-y-3',
        columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1',
        className,
      )}
    >
      {items.map(item => (
        <div key={item.label} className={cx('min-w-0', item.full && 'sm:col-span-2')}>
          <dt className="text-muted">{item.label}</dt>
          <dd className="mt-0.5 break-words text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({
  icon = 'sparkles',
  title,
  action,
  className,
}: {
  icon?: WorkspaceIconName;
  title: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        'flex min-h-48 flex-col items-center justify-center gap-4 rounded-xl border border-line bg-surface-subtle px-6 py-10 text-center',
        className,
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-muted">
        <WorkspaceIcon name={icon} className="h-5 w-5" />
      </span>
      <p className="text-section font-medium text-ink">{title}</p>
      {action}
    </section>
  );
}
