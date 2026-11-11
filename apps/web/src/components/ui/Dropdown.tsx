import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cx,useCompactUi } from './controls';

interface Option { value: string; label: string }
interface Props {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function Dropdown({ label, value, options, onChange, disabled }: Props) {
  const compact=useCompactUi();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef('');
  const lastKey = useRef(0);
  const selected = Math.max(0, options.findIndex(option => option.value === value));

  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function choose(index: number) {
    if (options[index]) onChange(options[index].value);
    close();
  }

  function handleKey(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); choose(active); return;
    }
    const directions: Record<string, number> = {
      ArrowDown: (active + 1) % options.length,
      ArrowUp: (active - 1 + options.length) % options.length,
      Home: 0,
      End: options.length - 1,
    };
    if (event.key in directions) {
      event.preventDefault(); setActive(directions[event.key]); return;
    }
    if (event.key.length === 1) {
      const now = Date.now();
      search.current = now - lastKey.current > 700 ? event.key : search.current + event.key;
      lastKey.current = now;
      const match = options.findIndex(option => option.label.toLowerCase().startsWith(search.current.toLowerCase()));
      if (match >= 0) setActive(match);
    }
  }

  return (
    <div className="relative min-w-0" ref={container}>
      <span id={`${id}-label`} className="sr-only">{label}</span>
      <button
        ref={trigger}
        type="button"
        aria-label={`${label} ${options[selected]?.label || ''} `}
        aria-describedby={`${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        disabled={disabled}
        className={cx('flex min-w-0 w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface text-left font-medium text-ink hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50',compact?'min-h-8 px-2 py-1 text-menu':'min-h-11 px-3 py-2.5 text-body')}
        onClick={() => { setActive(selected); setOpen(!open); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setActive(selected); setOpen(true);
          }
        }}
      >
        <span id={`${id}-value`} className="min-w-0 flex-1 truncate" title={options[selected]?.label}>{options[selected]?.label}</span>
      </button>
      {open && (
        <ul
          id={`${id}-list`}
          ref={list}
          role="listbox"
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-option-${active}`}
          tabIndex={-1}
          onKeyDown={handleKey}
          onBlur={event => {
            if (!container.current?.contains(event.relatedTarget as Node)) setOpen(false);
          }}
          className="absolute left-0 right-0 z-40 mt-2 max-h-64 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-popover outline-none"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              onPointerMove={() => setActive(index)}
              onPointerDown={event => event.preventDefault()}
              onClick={() => choose(index)}
              className={cx(
                'flex cursor-pointer items-center justify-between gap-2 rounded-lg',
                compact?'min-h-8 px-2 py-1 text-menu':'min-h-11 px-3 py-2 text-body',
                active === index || option.value === value ? 'bg-brand-soft text-brand' : 'text-ink',
              )}
            >
              <span className="min-w-0 flex-1 truncate" title={option.label}>{option.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

