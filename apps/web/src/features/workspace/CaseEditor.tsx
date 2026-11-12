import { useState } from 'react';
import { factorLabels } from './catalog';
import type { CatalogView, TestIntent, Feature, TestFactor } from './catalog';
import {
  ActionButton,
  Disclosure,
  TextAreaField,
  TextField,
  cx,
} from '../../components/ui/ds';

export function CaseEditor({
  initial,
  view,
  busy,
  onSave,
  onCancel,
}: {
  initial: TestIntent;
  view: CatalogView;
  busy: boolean;
  onSave: (row: TestIntent, name: string, sources: Feature['sources']) => void;
  onCancel: () => void;
}) {
  const existing = view.catalog.features.find(feature => feature.id === initial.featureId);
  const [row, setRow] = useState(initial);
  const [name, setName] = useState(existing?.name || '');
  const [sourceText, setSourceText] = useState(
    (existing?.sources || []).map(source => `${source.path}:${source.line}`).join('\n'),
  );

  const update = (key: keyof TestIntent, value: unknown) =>
    setRow(previous => ({ ...previous, [key]: value }));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const sources = sourceText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
      .map(value => {
        const match = /^(.*):(\d+)$/.exec(value);
        return { path: match?.[1] || value, line: match ? Number(match[2]) : 1 };
      });
    const matrix = (row.decisionTable || []).filter(
      entry => entry.point.trim() || entry.input.trim() || entry.expected.trim(),
    );
    const cleanedSteps = row.steps?.map(step => ({
      ...(step.interaction ? { interaction: step.interaction } : {}),
      action: step.action,
      ...(step.data?.trim() ? { data: step.data } : {}),
      expected: step.expected,
    }));
    onSave(
      {
        ...row,
        ...(cleanedSteps ? { steps: cleanedSteps } : {}),
        decisionTable: matrix.length ? matrix : undefined,
      },
      name,
      sources,
    );
  }

  return (
    <form className="space-y-6" aria-label="測試案例編輯" onSubmit={submit}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <h2 className="text-section font-bold text-ink">
            {initial.title ? '編輯測試' : '新增測試'}
          </h2>
          {existing && <p className="mt-1 text-muted">{`功能：${existing.name}`}</p>}
        </div>
        <div className="flex gap-2">
          <ActionButton disabled={busy} onClick={onCancel}>
            取消
          </ActionButton>
          <ActionButton
            type="submit"
            variant="primary"
            disabled={busy || !row.title.trim() || !name.trim()}
          >
            {busy ? '正在儲存…' : '儲存測試'}
          </ActionButton>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="測試名稱"
          className={existing ? 'md:col-span-2' : undefined}
          required
          maxLength={200}
          value={row.title}
          disabled={busy}
          onChange={event => update('title', event.target.value)}
        />
        {!existing && (
          <TextField
            label="功能名稱"
            required
            value={name}
            disabled={busy}
            placeholder="例如：登入、名片管理"
            onChange={event => setName(event.target.value)}
          />
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextAreaField
          label="測試目的"
          rows={3}
          disabled={busy}
          value={row.purpose}
          onChange={event => update('purpose', event.target.value)}
        />
        <TextAreaField
          label="預期結果"
          rows={3}
          disabled={busy}
          value={row.expected}
          onChange={event => update('expected', event.target.value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextAreaField
          label="前置條件"
          rows={2}
          disabled={busy}
          value={row.preconditions}
          placeholder="無則填「無」"
          onChange={event => update('preconditions', event.target.value)}
        />
        <TextAreaField
          label="清理方式"
          rows={2}
          disabled={busy}
          value={row.cleanup || ''}
          placeholder="無則填「不需清理」"
          onChange={event => update('cleanup', event.target.value)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset className="rounded-xl border border-line bg-canvas p-4">
          <legend className="px-1 font-medium text-ink">驗證對象</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {(
              [
                ['api', 'API'],
                ['web', '網頁'],
                ['mobile', '手機 App'],
                ['mixed', '跨平台'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cx(
                  'flex min-h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1',
                  row.target === value
                    ? 'border-line-strong bg-brand-soft text-ink'
                    : 'border-transparent text-muted hover:bg-surface hover:text-ink',
                )}
              >
                <input
                  type="radio"
                  name="case-target"
                  className="accent-brand"
                  checked={row.target === value}
                  disabled={busy}
                  onChange={() => update('target', value)}
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded-xl border border-line bg-canvas p-4">
          <legend className="px-1 font-medium text-ink">測試因子</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            <label
              className={cx(
                'flex min-h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1',
                !row.factor
                  ? 'border-line-strong bg-brand-soft text-ink'
                  : 'border-transparent text-muted hover:bg-surface hover:text-ink',
              )}
            >
              <input
                type="radio"
                name="case-factor"
                className="accent-brand"
                checked={!row.factor}
                disabled={busy}
                onChange={() => update('factor', undefined)}
              />
              未指定
            </label>
            {(Object.keys(factorLabels) as TestFactor[]).map(value => (
              <label
                key={value}
                className={cx(
                  'flex min-h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1',
                  row.factor === value
                    ? 'border-line-strong bg-brand-soft text-ink'
                    : 'border-transparent text-muted hover:bg-surface hover:text-ink',
                )}
              >
                <input
                  type="radio"
                  name="case-factor"
                  className="accent-brand"
                  checked={row.factor === value}
                  disabled={busy}
                  onChange={() => update('factor', value)}
                />
                {factorLabels[value]}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <fieldset className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <legend className="font-medium text-ink">測試步驟</legend>
          <ActionButton
            icon="plus"
            disabled={busy || (row.steps?.length || 0) >= 100}
            onClick={() =>
              update('steps', [...(row.steps || []), { action: '', data: '', expected: '' }])
            }
          >
            新增步驟
          </ActionButton>
        </div>
        {(row.steps || []).map((step, index) => (
          <div key={index} className="space-y-3 rounded-xl border border-line bg-canvas p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-muted">{`步驟 ${index + 1}`}</span>
              <ActionButton
                variant="ghost"
                icon="trash"
                disabled={busy}
                onClick={() => update('steps', (row.steps || []).filter((_, i) => i !== index))}
              >
                {`移除步驟 ${index + 1}`}
              </ActionButton>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <TextAreaField
                label={`步驟 ${index + 1}`}
                rows={2}
                placeholder="例如：輸入用戶名"
                value={step.action}
                disabled={busy}
                onChange={event =>
                  update(
                    'steps',
                    (row.steps || []).map((value, i) =>
                      i === index ? { ...value, action: event.target.value } : value,
                    ),
                  )
                }
              />
              <TextAreaField
                label={`使用資料 ${index + 1}`}
                rows={2}
                placeholder="例如：test_0001（無則留空）"
                value={step.data || ''}
                disabled={busy}
                onChange={event =>
                  update(
                    'steps',
                    (row.steps || []).map((value, i) =>
                      i === index ? { ...value, data: event.target.value } : value,
                    ),
                  )
                }
              />
              <TextAreaField
                label={`步驟 ${index + 1} 預期`}
                rows={2}
                placeholder="驗證步驟才需填預期"
                value={step.expected}
                disabled={busy}
                onChange={event =>
                  update(
                    'steps',
                    (row.steps || []).map((value, i) =>
                      i === index ? { ...value, expected: event.target.value } : value,
                    ),
                  )
                }
              />
            </div>
          </div>
        ))}
      </fieldset>

      <Disclosure summary={`決策矩陣表（${row.decisionTable?.length || 0}）`}>
        <div className="space-y-4">
          {(row.decisionTable || []).map((entry, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-line bg-canvas p-3.5">
              <div className="grid gap-3 md:grid-cols-3">
                <TextField
                  label={`測試點 ${index + 1}`}
                  disabled={busy}
                  value={entry.point}
                  placeholder="用戶名過短（<6 字）"
                  onChange={event =>
                    update(
                      'decisionTable',
                      (row.decisionTable || []).map((item, i) =>
                        i === index ? { ...item, point: event.target.value } : item,
                      ),
                    )
                  }
                />
                <TextField
                  label={`輸入數據 ${index + 1}`}
                  disabled={busy}
                  value={entry.input}
                  placeholder="user"
                  onChange={event =>
                    update(
                      'decisionTable',
                      (row.decisionTable || []).map((item, i) =>
                        i === index ? { ...item, input: event.target.value } : item,
                      ),
                    )
                  }
                />
                <TextField
                  label={`預期提示 ${index + 1}`}
                  disabled={busy}
                  value={entry.expected}
                  placeholder="不可少於 6 位"
                  onChange={event =>
                    update(
                      'decisionTable',
                      (row.decisionTable || []).map((item, i) =>
                        i === index ? { ...item, expected: event.target.value } : item,
                      ),
                    )
                  }
                />
              </div>
              <ActionButton
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  update(
                    'decisionTable',
                    (row.decisionTable || []).filter((_, i) => i !== index),
                  )
                }
              >
                {`移除矩陣列 ${index + 1}`}
              </ActionButton>
            </div>
          ))}
          <ActionButton
            icon="plus"
            disabled={busy || (row.decisionTable?.length || 0) >= 100}
            onClick={() =>
              update('decisionTable', [
                ...(row.decisionTable || []),
                { point: '', input: '', expected: '' },
              ])
            }
          >
            新增矩陣列
          </ActionButton>
        </div>
      </Disclosure>

      <Disclosure summary="檔案、資料與知識關聯">
        <div className="space-y-4">
          <p className="font-mono text-muted">{row.id}</p>
          {existing && (
            <TextField
              label="功能名稱"
              maxLength={200}
              value={name}
              disabled={busy}
              onChange={event => setName(event.target.value)}
            />
          )}
          <fieldset>
            <legend className="mb-2 font-medium text-ink">測試類型</legend>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ['api', '單支 API'],
                  ['flow', '串接流程'],
                ] as const
              ).map(([kind, label]) => (
                <label key={kind} className="flex min-h-8 cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="case-kind"
                    checked={row.kind === kind}
                    disabled={busy}
                    className="accent-brand"
                    onChange={() => update('kind', kind)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField
              label="功能編號"
              required
              pattern="[A-Za-z][A-Za-z0-9_-]{0,79}"
              disabled={busy}
              value={row.featureId}
              onChange={event => {
                update('featureId', event.target.value);
                const feature = view.catalog.features.find(
                  feature => feature.id === event.target.value,
                );
                if (feature) {
                  setName(feature.name);
                  setSourceText(feature.sources.map(s => `${s.path}:${s.line}`).join('\n'));
                }
              }}
            />
            <TextField
              label="對應腳本"
              disabled={busy}
              value={row.script || ''}
              placeholder="tests/api/Name.spec.ts"
              onChange={event => {
                update('script', event.target.value);
                update('kind', event.target.value.includes('/flows/') ? 'flow' : 'api');
              }}
            />
          </div>
          <Disclosure summary="從專案選取腳本">
            <ul className="max-h-60 divide-y divide-line overflow-y-auto">
              {view.scripts.map(script => (
                <li key={script.path}>
                  <ActionButton
                    variant="ghost"
                    align="start"
                    className="w-full break-all font-mono"
                    disabled={busy}
                    onClick={() => {
                      update('script', script.path);
                      update('kind', script.path.includes('/flows/') ? 'flow' : 'api');
                    }}
                  >
                    {script.path}
                  </ActionButton>
                </li>
              ))}
            </ul>
          </Disclosure>
          <div className="grid gap-4 md:grid-cols-2">
            <TextAreaField
              label="前端來源"
              rows={2}
              disabled={busy}
              value={sourceText}
              placeholder="相對路徑:行號，每行一個"
              onChange={event => setSourceText(event.target.value)}
            />
            <TextAreaField
              label="測試資料說明"
              rows={2}
              disabled={busy}
              value={row.data}
              onChange={event => update('data', event.target.value)}
            />
          </div>
          <fieldset>
            <legend className="mb-2 font-medium text-ink">業務依據</legend>
            {!view.knowledge.length && <p className="text-muted">尚未匯入專案知識。</p>}
            <div className="flex flex-wrap gap-3">
              {view.knowledge.map(doc => (
                <label key={doc.id} className="flex min-h-8 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    disabled={busy}
                    checked={row.knowledgeIds.includes(doc.id)}
                    onChange={event =>
                      update(
                        'knowledgeIds',
                        event.target.checked
                          ? [...row.knowledgeIds, doc.id]
                          : row.knowledgeIds.filter(id => id !== doc.id),
                      )
                    }
                  />
                  <span className="break-all">{doc.title}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Disclosure>

      <Disclosure summary={`待確認問題（${row.questions.length}）`}>
        <div className="space-y-4">
          {row.questions.map((question, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-line bg-canvas p-3.5">
              <TextField
                label={`問題 ${index + 1}`}
                disabled={busy}
                value={question.text}
                onChange={event =>
                  update(
                    'questions',
                    row.questions.map((q, i) =>
                      i === index ? { ...q, text: event.target.value } : q,
                    ),
                  )
                }
              />
              <TextAreaField
                label="已確認的答案"
                rows={2}
                disabled={busy}
                value={question.answer}
                onChange={event =>
                  update(
                    'questions',
                    row.questions.map((q, i) =>
                      i === index ? { ...q, answer: event.target.value } : q,
                    ),
                  )
                }
              />
              <ActionButton
                variant="ghost"
                disabled={busy}
                onClick={() => update('questions', row.questions.filter((_, i) => i !== index))}
              >
                移除問題
              </ActionButton>
            </div>
          ))}
          <ActionButton
            icon="plus"
            disabled={busy}
            onClick={() => update('questions', [...row.questions, { text: '', answer: '' }])}
          >
            新增問題
          </ActionButton>
        </div>
      </Disclosure>
    </form>
  );
}
