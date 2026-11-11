import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { operation, settings } from './client';
import type { ScriptInventory } from './client';
import {
  ActionButton,
  Badge,
  Banner,
  Disclosure,
  PageHeader,
  SegmentedGroup,
  StatStrip,
  Surface,
  WorkspaceShell,
} from '../../components/ui/ds';
import type { Tone } from '../../components/ui/ds';

const categories = [
  ['all', '全部'],
  ['api', 'API 單支'],
  ['flow', 'API 串接'],
  ['web', '網頁'],
  ['mobile', 'Android'],
  ['other', '其他'],
] as const;

const labels = {
  content: '含測試內容',
  draft: '空白草稿',
  unknown: '待核對',
} as const;

const stateTone: Record<'content' | 'draft' | 'unknown', Tone> = {
  content: 'success',
  draft: 'warning',
  unknown: 'neutral',
};

export function ScriptWorkspace({ navigation }: { navigation: ReactNode }) {
  const [inventory, setInventory] = useState<ScriptInventory>();
  const [category, setCategory] = useState<(typeof categories)[number][0]>('all');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    setBusy(true);
    setError('');
    try {
      const config = await settings();
      setInventory(await operation<ScriptInventory>(config, 'scripts'));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '無法讀取測試腳本，請稍後重新讀取。',
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const rows =
    inventory?.scripts.filter(row => category === 'all' || row.category === category) || [];

  return (
    <WorkspaceShell navigation={navigation}>
      <PageHeader
        title="測試腳本"
        actions={
          <ActionButton icon="refresh" disabled={busy} onClick={() => void reload()}>
            {busy ? '正在讀取…' : '重新讀取'}
          </ActionButton>
        }
      />

      {error && (
        <Banner tone="danger" className="mb-5">
          {error}
          {inventory ? ' 原清單已保留，數量可能不是最新。' : ''}
        </Banner>
      )}

      <section aria-label="腳本數量" aria-busy={busy} className="mb-5">
        {inventory ? (
          <StatStrip
            items={[
              {
                label: '含測試內容',
                value: `${inventory.summary.content} 支`,
                meta: `共 ${inventory.summary.total} 支腳本`,
                tone: inventory.summary.content > 0 ? 'success' : 'neutral',
              },
              {
                label: labels.draft,
                value: inventory.summary.draft,
                tone: inventory.summary.draft > 0 ? 'warning' : 'neutral',
              },
              {
                label: labels.unknown,
                value: inventory.summary.unknown,
              },
            ]}
          />
        ) : (
          <Surface variant="subtle">
            <p role="status" className="text-muted">
              {busy ? '正在統計測試專案的腳本…' : '尚未取得腳本數量。'}
            </p>
          </Surface>
        )}
      </section>

      {inventory && (
        <div className="space-y-4">
          <SegmentedGroup
            label="腳本分類"
            value={category}
            onChange={setCategory}
            options={categories.map(([id, label]) => ({
              id,
              label: `${label}（${
                id === 'all'
                  ? inventory.summary.total
                  : inventory.scripts.filter(row => row.category === id).length
              }）`,
            }))}
          />

          {inventory.warnings.length > 0 && (
            <Disclosure
              summary={
                <span className="text-warning">{`部分項目未納入或內容無法判讀（${inventory.warnings.length}）`}</span>
              }
            >
              <ul className="space-y-1 text-muted">
                {inventory.warnings.map(warning => (
                  <li key={warning} className="break-all font-mono">
                    {warning}
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}

          <Surface padding="none" className="overflow-hidden">
            {rows.length ? (
              <table aria-label="測試腳本清單" className="w-full table-fixed text-left">
                <thead>
                  <tr className="border-b border-line bg-surface-subtle text-muted">
                    <th scope="col" className="w-1/2 p-3.5 font-medium">
                      腳本
                    </th>
                    <th scope="col" className="p-3.5 font-medium">
                      內容狀態
                    </th>
                    <th scope="col" className="p-3.5 font-medium">
                      測試宣告
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map(row => (
                    <tr key={row.path} className="align-top hover:bg-surface-subtle">
                      <th scope="row" className="break-all p-3.5 font-mono font-normal text-ink">
                        {row.path}
                      </th>
                      <td className="break-words p-3.5">
                        <Badge tone={stateTone[row.state]} dot>
                          {labels[row.state]}
                        </Badge>
                      </td>
                      <td className="break-words p-3.5 tabular-nums text-ink">
                        {row.state === 'unknown' ? (
                          <span className="text-muted">待核對</span>
                        ) : (
                          <>
                            {`${row.tests} 個`}
                            {row.skipped > 0 && (
                              <span className="mt-1 block text-muted">{`${row.skipped} 個標記略過`}</span>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-6 text-muted">
                {inventory.summary.total ? '此分類尚無測試腳本。' : '尚無測試腳本。'}
              </p>
            )}
          </Surface>
        </div>
      )}
    </WorkspaceShell>
  );
}
