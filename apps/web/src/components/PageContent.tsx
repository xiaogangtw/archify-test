import type { Dispatch } from 'react';
import type { PageId, PageSpec, PrototypeState } from '../types';
import type { Action } from '../state/prototype';
import { Panel } from './Panel';
import { DataTable } from './DataTable';
import { Disclosure, Input } from './ui/controls';
import { Dashboard } from '../features/dashboard/Dashboard';

interface Props {
  page: PageSpec;
  state: PrototypeState;
  dispatch: Dispatch<Action>;
  onNavigate: (page: PageId) => void;
}

// Specialized project/case/flow screens live in features/testing.
export function PageContent({ page, state, dispatch, onNavigate }: Props) {
  if (page.id === 'dashboard') {
    return <Dashboard onNavigate={onNavigate} />;
  }

  return (
    <div className="space-y-7">
      {page.metrics && (
        <dl className="flex flex-wrap gap-x-12 gap-y-6 border-b border-line pb-7">
          {page.metrics.map(metric => (
            <div key={metric.label}>
              <dt className="text-body text-muted">{metric.label}</dt>
              <dd className="mt-2 text-metric font-bold tabular-nums">{metric.value}</dd>
              <dd className="mt-1 text-body text-muted">{metric.note}</dd>
            </div>
          ))}
        </dl>
      )}

      {page.columns && page.rows && (
        <Panel title="資料列表">
          <div className="mb-5 max-w-sm">
            <Input
              type="search"
              aria-label="搜尋列表"
              value={state.query}
              onChange={event => dispatch({ type: 'query', query: event.target.value })}
              placeholder="搜尋名稱、狀態或版本"
            />
          </div>
          <DataTable columns={page.columns} rows={page.rows} query={state.query} />
        </Panel>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-2">
        {page.sections.map(section => (
          <Panel key={section.title} title={section.title}>
            {section.body && <p className="mb-4 break-words font-mono text-body">{section.body}</p>}
            {section.items && (
              <>
                <p className="max-w-prose text-body leading-7 text-muted">{section.items[0]}</p>
                {section.items.length > 1 && (
                  <Disclosure title="詳細資訊">
                    <ul className="list-disc space-y-2 pl-5">
                      {section.items.slice(1).map(item => <li key={item}>{item}</li>)}
                    </ul>
                  </Disclosure>
                )}
              </>
            )}
          </Panel>
        ))}
      </div>
    </div>
  );
}

