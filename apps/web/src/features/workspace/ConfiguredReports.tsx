import { useEffect, useRef, useState } from 'react';
import { settings, operation } from './client';
import type { ReportFile } from './client';
import { parseReport } from '../reader/report';
import { renderHtml } from '../../../../../test-project/framework/html.mjs';
import { ActionButton, Badge, Banner, SearchField, Surface } from '../../components/ui/ds';

type Props = {
  onOpen: (value: unknown) => void;
  onBusy: (busy: boolean) => void;
  onEmpty: () => void;
  kind?: 'flow' | 'execution';
  testType?: 'api' | 'ui';
};

export function ConfiguredReports({ onOpen, onBusy, onEmpty, kind, testType }: Props) {
  const [historyQuery, setHistoryQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const [rows, setRows] = useState<ReportFile[]>([]);
  const [project, setProject] = useState('');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(true);
  const [downloading, setDownloading] = useState('');
  const [opening, setOpening] = useState('');
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const callbacks = useRef({ onOpen, onBusy, onEmpty });
  callbacks.current = { onOpen, onBusy, onEmpty };
  const deepLink = useRef(new URLSearchParams(location.search).get('report'));
  const selectedRef = useRef('');

  async function read(name?: string) {
    const id = ++sequence.current;
    setBusy(true);
    callbacks.current.onBusy(true);
    setError('');
    try {
      const config = await settings();
      const files = await operation<ReportFile[]>(config, 'reports');
      if (id !== sequence.current) return;
      setProject(config.projectRoot.split(/[\\/]/).filter(Boolean).at(-1) || '目前專案');
      const matching = files.filter(
        row =>
          (!kind || row.name.split('/').at(-1)?.startsWith(kind === 'flow' ? 'flow-' : 'report-')) &&
          (!testType || (row.testType || (row.name.startsWith('ui/') ? 'ui' : 'api')) === testType),
      );
      setRows(matching);
      const linked = deepLink.current;
      deepLink.current = null;
      const isDetailPage = new URLSearchParams(window.location.search).has('report');
      const target =
        name ||
        linked ||
        (isDetailPage && matching.some(row => row.name === selectedRef.current)
          ? selectedRef.current
          : undefined);
      if (target) {
        const value = await operation(config, 'report', { name: target });
        if (id !== sequence.current) return;
        callbacks.current.onOpen(value);
        setSelected(target);
        selectedRef.current = target;
      } else {
        setSelected('');
        selectedRef.current = '';
        callbacks.current.onEmpty();
      }
    } catch (reason) {
      if (id === sequence.current) setError(reason instanceof Error ? reason.message : '報告讀取失敗。');
    } finally {
      if (id === sequence.current) {
        setBusy(false);
        callbacks.current.onBusy(false);
      }
    }
  }

  async function download(name: string) {
    if (downloading || opening) return;
    setDownloading(name);
    setError('');
    try {
      const config = await settings();
      const value = await operation(config, 'report', { name });
      const report = parseReport(JSON.stringify(value));
      const url = URL.createObjectURL(
        new Blob([renderHtml(report)], { type: 'text/html;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.kind === 'flow' ? 'flow-' : 'report-'}${report.runId.replace(/[^A-Za-z0-9_-]/g, '')}.html`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '報告下載失敗。');
    } finally {
      setDownloading('');
    }
  }

  async function openHtml(name: string) {
    if (downloading || opening) return;
    const tab = window.open('about:blank', '_blank');
    if (!tab) {
      setError('瀏覽器封鎖了新分頁，允許彈出視窗後再開啟。');
      return;
    }
    tab.opener = null;
    tab.document.title = '正在開啟測試報告';
    tab.document.body.textContent = '正在準備 HTML 報告…';
    setOpening(name);
    setError('');
    try {
      const config = await settings();
      const value = await operation(config, 'report', { name });
      const report = parseReport(JSON.stringify(value));
      const url = URL.createObjectURL(
        new Blob([renderHtml(report)], { type: 'text/html;charset=utf-8' }),
      );
      tab.location.replace(url);
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (reason) {
      tab.close();
      setError(reason instanceof Error ? reason.message : 'HTML 報告開啟失敗。');
    } finally {
      setOpening('');
    }
  }

  useEffect(() => {
    setSelected('');
    selectedRef.current = '';
    void read();
    return () => {
      sequence.current++;
    };
  }, [kind, testType]);

  const visibleHistory = rows.filter(row =>
    (row.name + ' ' + new Date(row.modifiedAt).toLocaleString('zh-TW'))
      .toLowerCase()
      .includes(historyQuery.toLowerCase()),
  );

  return (
    <Surface aria-label="專案報告紀錄" aria-busy={busy} className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="font-medium text-ink">{project || '目前專案'}</span>
          <Badge tone="neutral">{busy ? '正在讀取報告…' : `${rows.length} 份報告`}</Badge>
        </div>
        <ActionButton icon="refresh" disabled={busy} onClick={() => void read()}>
          {busy ? '讀取中…' : '重新整理'}
        </ActionButton>
      </div>

      {!!rows.length && (
        <div className="space-y-3">
          <SearchField
            label="搜尋報告"
            placeholder="搜尋報告檔名或日期…"
            className="sm:max-w-sm"
            value={historyQuery}
            onChange={event => {
              setHistoryQuery(event.target.value);
              setVisibleCount(50);
            }}
          />
          {visibleHistory.length > 0 ? (
            <ul
              aria-label="報告清單"
              className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-canvas"
            >
              {visibleHistory.slice(0, visibleCount).map(row => (
                <li
                  key={row.name}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-surface-subtle"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {new Date(row.modifiedAt).toLocaleString('zh-TW')}
                    </p>
                    <p className="mt-0.5 break-all font-mono text-muted">
                      {row.name.split('/').at(-1)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <ActionButton
                      icon="download"
                      disabled={!!downloading || !!opening}
                      onClick={() => void download(row.name)}
                    >
                      {downloading === row.name ? '準備下載…' : '下載'}
                    </ActionButton>
                    <ActionButton
                      variant="primary"
                      icon="open"
                      aria-label={`開啟 ${row.name}`}
                      title={row.name}
                      disabled={!!downloading || !!opening}
                      onClick={() => void openHtml(row.name)}
                    >
                      {opening === row.name ? '開啟中…' : '開啟'}
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-muted">沒有符合條件的報告。</p>
          )}
          {visibleHistory.length > visibleCount && (
            <ActionButton onClick={() => setVisibleCount(value => value + 50)}>
              {`顯示更早的報告（尚有 ${visibleHistory.length - visibleCount} 份）`}
            </ActionButton>
          )}
        </div>
      )}

      {!busy && !rows.length && !error && (
        <p className="text-muted">目前沒有符合此類型的報告。</p>
      )}
      {error && (
        <Banner tone="danger">
          {error}
          {' 請重新整理。'}
          {selected ? ' 原報告已保留。' : ''}
        </Banner>
      )}
    </Surface>
  );
}
