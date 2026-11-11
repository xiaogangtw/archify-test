import type { ReactNode } from 'react';
import {cx,useCompactUi} from './ui/controls';

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  const compact=useCompactUi();
  return (
    <section className={cx('min-w-0 rounded-xl border border-line bg-surface',compact?'p-3':'p-5 md:p-6')}>
      {title && <h2 className={cx('font-bold text-ink',compact?'mb-3 text-body':'mb-5 text-heading')}>{title}</h2>}
      {children}
    </section>
  );
}

