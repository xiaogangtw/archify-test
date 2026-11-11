import {AppiumRetry} from './AppiumRetry';
import { DeviceViewer } from './AndroidDeviceViewer';
import { AndroidProfiles, type Profile } from './AndroidProfiles';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Notice, cx } from '../../components/ui/controls';
import { Dropdown } from '../../components/ui/Dropdown';
import { AndroidFlowExecution } from './AndroidFlowExecution';
import type { ScriptDraft } from './scriptModel';
import { unavailableAndroidStatus, updateAndroidStatus } from './androidStatus';

type Device = { serial: string; state: string; booted: boolean; managed: boolean; canControl: boolean; avd: string; error: string; profileId?: string; appiumBusy?: boolean };
type Environment = {
  connected: boolean; checkedAt: string | null; queued: number;
  sdk: { ready: boolean; path: string }; avds: string[]; devices: Device[]; issues: string[];
  appium: { reachable: boolean; ready: boolean };
  profiles?: Profile[]; capabilities?: { persistentDevices: boolean; adbRecovery?: boolean };
  adb?: { ready: boolean; error: string };
};
async function request(path: string, body?: unknown) {
  const response = await fetch(`/api/android${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Archify-Client': 'web' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(35000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Android 服務無法連線，請重試。');
  }
  return response;
}
const label = (device: Device) => device.error ? '啟動失敗' : device.booted ? '已就緒' : device.state === 'offline' ? '離線' : '啟動中';

export function AndroidWorkspace({ projectId, cases }: { projectId: string; cases?: ScriptDraft[] }) {
  return <Emulators projectId={projectId} cases={cases} />;
}

function Emulators({ projectId, cases }: { projectId: string; cases?: ScriptDraft[] }) {
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [avd, setAvd] = useState('');
  const [count, setCount] = useState('1');
  const [editingCase,setEditingCase]=useState(false);
  const [editingSerial,setEditingSerial]=useState('');
  const [selected, setSelected] = useState('');
  const [panel, setPanel] = useState<'environment' | 'profiles' | 'temporary' | null>(null);
  const [viewerEpoch, setViewerEpoch] = useState(0);
  const togglePanel = (value: 'environment' | 'profiles' | 'temporary') => setPanel(current => current === value ? null : value);
  const alive = useRef(true);
  const refreshing = useRef(false);
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const data: Environment = await (await request('/status')).json();
      if (!alive.current) return;
      setEnvironment(current => updateAndroidStatus(current, data)); setError('');
      if (!data.connected) return;
      const temporary = data.avds.filter(value => !value.startsWith('Archify_Device_'));
      setAvd(current => temporary.includes(current) ? current : temporary[0] || '');
      setSelected(current => data.devices.some(d => d.serial === current) ? current : data.devices[0]?.serial || '');
    } catch (reason) {
      if (alive.current) { setError((reason as Error).message); setEnvironment(unavailableAndroidStatus); }
    } finally { refreshing.current = false; if (alive.current) setLoading(false); }
  }, []);
  useEffect(() => {
    alive.current = true; void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 5000);
    return () => { alive.current = false; window.clearInterval(interval); };
  }, [refresh]);
  async function start() {
    setBusy(true); setError('');
    try { await request('/start', { avd, count: Number(count) }); await refresh(); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  const visibleDevices = environment?.devices.slice(0,4) || [];
  return <div className="min-w-0 space-y-4 overflow-x-hidden text-section">
    <section aria-label="Android 執行環境" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="font-medium">{loading ? '正在檢查連線' : environment?.connected ? '執行主機已連線' : '執行主機未連線'}</p>
          {environment?.connected && <span className="text-muted">{environment.sdk.ready ? `${environment.devices.length} 台裝置` : 'SDK 尚未就緒'}</span>}
          {!!environment?.queued && <span className="text-muted">{environment.queued} 個操作處理中</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button aria-expanded={panel === 'environment'} aria-controls="android-environment" onClick={() => togglePanel('environment')}>環境資訊</Button>
          <Button aria-expanded={panel === 'profiles'} aria-controls="android-profiles" onClick={() => togglePanel('profiles')}>固定手機管理{environment?.profiles?.length ? ` · ${environment.profiles.length} 台` : ''}</Button>
          <Button aria-expanded={panel === 'temporary'} aria-controls="android-temporary" onClick={() => togglePanel('temporary')}>臨時模擬器</Button>
          <Button disabled={loading || busy} onClick={() => { setLoading(true); void refresh(); }}>{loading ? '讀取中' : '重新整理'}</Button>
        </div>
      </div>

      {environment?.adb?.error && <p role="status" className="text-body text-danger">{environment.adb.error}</p>}
      <div id="android-environment" hidden={panel !== 'environment'} className="rounded-xl border border-line bg-surface p-3 text-body text-muted">
        <div className="space-y-2">
          <p>{environment?.connected ? 'Windows 執行主機提供模擬器，跨專案共用。' : '請先在 Windows 主機安裝 Android 工具、完成 VM 配對並啟動執行器。'}</p>
          <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-2"><dt>Android SDK</dt><dd className="text-ink">{environment?.connected ? environment.sdk.ready ? '已偵測' : '尚未就緒' : '等待主機連線'}</dd></div>
            <div className="flex flex-wrap items-center gap-x-2"><dt>Appium</dt><dd className="flex flex-wrap items-center gap-2 text-ink">{environment?.appium.ready ? '已就緒，結果以各案例為準' : '尚未就緒'}<AppiumRetry disabled={!environment?.connected||busy} onReady={refresh}/></dd></div>
          </dl>
          {environment?.connected && environment.issues.map(issue => <p key={issue}>{issue}</p>)}
          <p className="text-menu">可單獨安裝 SDK Command-line Tools、Platform-Tools、Android Emulator、系統映像與 Java，或使用 Android Studio 圖形介面管理。</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-menu">
            <a href="https://developer.android.com/studio#command-line-tools-only" target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center rounded-lg text-brand underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Android 官方下載</a>
            {environment?.checkedAt && <p>最近回報：{new Date(environment.checkedAt).toLocaleTimeString('zh-TW')}</p>}
          </div>
        </div>
      </div>
    </section>
    <div id="android-profiles" hidden={panel !== 'profiles'}>
    <AndroidProfiles profiles={environment?.profiles || []} connected={!!environment?.connected} supported={!!environment?.capabilities?.persistentDevices} refresh={refresh} select={setSelected} />
    </div>
    <div id="android-temporary" hidden={panel !== 'temporary'}>
    <section aria-label="啟動模擬器" className="rounded-xl border border-line bg-surface p-4 text-body">
      <div className="grid items-end gap-4 md:grid-cols-3">
        <div className="space-y-2"><p className="font-medium">虛擬裝置設定</p><Dropdown label="虛擬裝置設定" value={avd} options={environment?.avds.filter(value => !value.startsWith('Archify_Device_')).map(value => ({ value, label: value })) || []} disabled={!environment?.connected || !avd || busy} onChange={setAvd} /></div>
        <div className="space-y-2"><p className="font-medium">啟動數量</p><Dropdown label="啟動數量" value={count} options={[1, 2, 3, 4].map(n => ({ value: String(n), label: `${n} 台` }))} disabled={busy} onChange={setCount} /></div>
        <Button variant="primary" disabled={!environment?.connected || !environment.sdk.ready || !avd || busy} onClick={start}>{busy ? '正在送出啟動要求' : '啟動模擬器'}</Button>
      </div>
      <p className="mt-3 text-muted">雙帳號交換可啟動兩台。最多四台是服務限制，實際數量取決於主機資源；新工作階段的 App 資料不會永久保存。</p>
    </section>
    </div>
    {error && <Notice error>{error}</Notice>}
    <section aria-label="裝置工作階段" className={cx("grid min-w-0 grid-cols-1 items-start gap-4",!editingCase&&"lg:grid-cols-android-workspace")}>
      <div hidden={editingCase} className="min-w-0 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-body font-medium">裝置</h2>
        {!environment?.devices.length ? <p className="py-8 text-muted">--</p> : <ul className="mt-4 space-y-2">
          {environment.devices.map(item => <li key={item.serial}>
            <button type="button" aria-pressed={selected === item.serial} onClick={() => setSelected(item.serial)} className="min-h-11 w-full rounded-lg border border-line p-3 text-left text-menu hover:bg-canvas active:bg-sidebar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
              <span className="block break-words font-medium">{environment.profiles?.find(profile => profile.id === item.profileId)?.name || item.serial}</span>
              <span className="mt-1 block break-words text-muted">{item.avd || '外部啟動的模擬器'} · {label(item)}</span>
              <span className="mt-1 block text-muted">{item.canControl ? '可操作' : '僅供檢視'}</span>
            </button>
          </li>)}
        </ul>}
      </div>
      <div className={cx("min-w-0 rounded-xl border border-line bg-surface p-4",editingCase?"grid items-start gap-4 lg:grid-cols-editor-phone":"space-y-4")}>
        <AndroidFlowExecution key={projectId} projectId={projectId} cases={cases} deviceSerial={selected} onEditingChange={setEditingCase} onDeviceChange={setEditingSerial} />
        <div className="min-w-0">
        {visibleDevices.length ? <div className="relative flex min-w-0 items-start gap-4 overflow-x-auto pb-3">{(editingCase?(environment?.devices||[]).filter(device=>device.serial===editingSerial):visibleDevices).map(device=><section key={`${device.serial}:${viewerEpoch}`} aria-label={(environment?.profiles?.find(profile=>profile.id===device.profileId)?.name||device.serial)+" 手機"} className="w-80 max-w-full shrink-0 grow space-y-3 rounded-xl border border-line p-3"><h3 className="break-words text-body font-medium">{environment?.profiles?.find(profile=>profile.id===device.profileId)?.name||device.serial}</h3><DeviceViewer device={device} name={environment?.profiles?.find(profile=>profile.id===device.profileId)?.name} refresh={refresh} retryDisabledReason={loading ? '正在讀取執行主機狀態。' : !environment?.connected ? '執行主機未連線，請先在 Windows 主機啟動執行器。' : !environment.capabilities?.adbRecovery ? '請更新並重啟執行器，以啟用連線重試。' : busy || environment.queued > 0 || environment.devices.some(device => device.appiumBusy) ? '手機正在處理操作，請結束後再重試。' : undefined} onRetried={async () => { await refresh(); setViewerEpoch(current => current + 1); }}/></section>)}</div> : <div role="img" aria-label="尚未選擇裝置的手機外框" className="flex h-android-screen items-center justify-center p-4">
          <div aria-hidden="true" className="flex aspect-android-phone h-full max-w-full flex-col items-center rounded-xl border-4 border-line-strong bg-canvas p-3">
            <div className="h-1 w-12 shrink-0 rounded-lg bg-line-strong" />
            <div className="w-full flex-1" />
            <div className="h-1 w-20 shrink-0 rounded-lg bg-line-strong" />
          </div>
        </div>}
        </div>
      </div>
    </section>
  </div>;
}
