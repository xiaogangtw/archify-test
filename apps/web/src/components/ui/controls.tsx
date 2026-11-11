import {ToolIcon} from './ToolIcon';
import {cloneElement,createContext,isValidElement,useContext,useId} from 'react';
import type {
  ReactElement,
  ButtonHTMLAttributes,
  DetailsHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from 'react';

export const UiDensityContext=createContext<'comfortable'|'compact'>('comfortable');
export const useCompactUi=()=>useContext(UiDensityContext)==='compact';

export function cx(...values: (string | false | undefined)[]) {
  return values.filter(Boolean).join(' ');
}

const buttonBase = [
  'inline-flex items-center justify-center gap-2 rounded-lg',
  'font-medium',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const buttonVariants = {
  primary: 'border border-brand bg-brand text-on-brand hover:bg-brand-strong active:bg-brand-strong',
  secondary: 'border border-line bg-surface text-ink hover:border-line-strong hover:bg-canvas active:bg-sidebar',
  chat: 'border border-transparent bg-transparent text-ink hover:bg-canvas active:bg-sidebar',
  ghost: 'border border-transparent text-muted hover:bg-canvas hover:text-ink active:bg-sidebar',
  danger: 'border border-danger bg-danger-soft text-danger hover:border-line-strong active:bg-canvas',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  ref?: Ref<HTMLButtonElement>;
  size?: 'default' | 'compact';
};

export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  size = 'default',
  children,
  ...props
}: ButtonProps) {
  const compact=useCompactUi();
  const iconOnly=isValidElement(children)&&(children.type===ToolIcon||children.type==='svg');
  const appearance=iconOnly
    ? (variant==='danger' ? 'border-0 bg-transparent text-danger hover:bg-danger-soft active:bg-danger-soft' : 'border-0 bg-transparent text-muted hover:bg-canvas hover:text-ink active:bg-sidebar')
    : buttonVariants[variant];
  return (
    <button
      type={type}
      className={cx(buttonBase, iconOnly ? 'min-w-11 min-h-11 p-2' : size === 'compact'||compact ? 'min-h-8 px-2 py-1 text-menu' : 'min-h-11 px-4 py-2 text-body', appearance, className)}
      {...props}
    >{children}</button>
  );
}

const inputBase = [
  'w-full min-w-0 rounded-lg border border-line bg-surface',
  'text-ink placeholder:text-muted',
  'hover:border-line-strong focus:border-brand focus:outline-none',
  'focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const compact=useCompactUi();
  return <input className={cx(inputBase,compact?'min-h-8 px-2 py-1.5 text-menu':'px-3 py-2.5 text-body',className)} {...props} />;
}

export function Textarea({
  className,
  resizable=true,
  visibleScrollbars=false,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>&{resizable?:boolean;visibleScrollbars?:boolean}) {
  const compact=useCompactUi();
  return <textarea className={cx(inputBase,compact?'px-2 py-1.5 text-menu':'px-3 py-2.5 text-body',compact&&!visibleScrollbars&&'[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',resizable?'resize-y':'resize-none',className)} {...props} />;
}

export function Field({ label, children, hint, fill=false }: { label: string; children: ReactNode; hint?:string;fill?:boolean }) {
  const compact=useCompactUi();
  const generated=useId();
  const control=isValidElement(children)&&(children.type===Input||children.type===Textarea||children.type==='input'||children.type==='textarea');
  const element=children as ReactElement<{id?:string}>;
  const id=control?(element.props.id||generated):undefined;
  return (
    <div className={cx('font-medium text-ink',compact?'text-menu':'text-body',fill?'flex h-full min-h-0 flex-col gap-1':compact?'block space-y-1':'block space-y-2')}>
      {control?<label htmlFor={id} className="block shrink-0">{label}</label>:<span className="block shrink-0">{label}</span>}
      {control?cloneElement(element,{id,...(hint?{'aria-describedby':id+'-hint'}:{})}):children}
      {hint&&<p id={id? id+'-hint':undefined} role="status" className="shrink-0 break-words text-menu font-normal text-danger">{hint}</p>}
    </div>
  );
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'danger';
  children: ReactNode;
}) {
  const colors = {
    neutral: 'bg-canvas text-muted',
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
  };
  return (
    <span className={cx('inline-flex rounded-lg px-2 py-1 text-body font-medium', colors[tone])}>
      {children}
    </span>
  );
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={cx(
        'mb-5 rounded-lg border p-4 text-body leading-6',
        error ? 'border-danger bg-danger-soft text-danger' : 'border-line bg-brand-soft text-brand',
      )}
    >
      {children}
    </div>
  );
}

export function Disclosure({
  title,
  children,
  ...props
}: DetailsHTMLAttributes<HTMLDetailsElement> & { title: string }) {
  return (
    <details className="mt-4 border-t border-line pt-4" {...props}>
      <summary className="min-h-8 cursor-pointer rounded-lg text-body font-medium text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
        {title}
      </summary>
      <div className="mt-3 space-y-3 text-body leading-7 text-muted">{children}</div>
    </details>
  );
}

