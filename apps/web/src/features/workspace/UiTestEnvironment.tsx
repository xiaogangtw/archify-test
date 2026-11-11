import { useEffect, useRef, useState } from 'react';
import { operation, settings } from './client';
import type { LocalConfig } from './client';
import { ActionButton, Badge, Banner, Disclosure, Surface } from '../../components/ui/ds';

interface Settings {
  screenshots: boolean;
  androidSerial: string;
}

interface AndroidStatus {
  sdkReady: boolean;
  avds: string[];
  devices: { serial: string; state: string; booted: boolean; avd: string }[];
  appiumReady: boolean;
  issues: string[];
}

export function UiTestEnvironment() {
  const [config, setConfig] = useState<LocalConfig>();
  const [value, setValue] = useState<Settings>();
  const [android, setAndroid] = useState<AndroidStatus>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const checking = useRef(false);

  useEffect(() => {
    void settings()
      .then(async config => {
        setConfig(config);
        if (config.initialized) setValue(await operation<Settings>(config, 'report-settings'));
      })
      .catch(() => setError('無法讀取畫面測試設定。'));
  }, []);

  async function refresh() {
    if (!config || checking.current) return;
    checking.current = true;
    try {
      setAndroid(await operation<AndroidStatus>(config, 'android-status'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '無法檢查 Android。');
    } finally {
      checking.current = false;
    }
  }

  useEffect(() => {
    if (!android?.devices.some(device => !device.booted && device.state !== 'error')) return;
    const timer = setInterval(() => void refresh(), 4000);
    return () => clearInterval(timer);
  }, [config, android?.devices.some(device => !device.booted && device.state !== 'error')]);

  async function save(input: Partial<Settings>) {
    if (!config) return;
    const previous = value;
    if (value) setValue({ ...value, ...input });
    setBusy(true);
    setError('');
    try {
      setValue(await operation<Settings>(config, 'report-settings-save', input));
      setNotice('已儲存，下次測試執行生效。');
    } catch (reason) {
      setValue(previous);
      setError(reason instanceof Error ? reason.message : '設定未儲存。');
    } finally {
      setBusy(false);
    }
  }

  async function start(action: string, input = {}) {
    if (!config) return;
    setBusy(true);
    setError('');
    setNotice(action === 'android-start' ? '正在啟動模擬器…' : '正在啟動 Appium…');
    try {
      await operation(config, action, input);
      setNotice(action === 'android-start' ? '模擬器正在啟動，請等待裝置就緒。' : 'Appium 已就緒。');
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '啟動未完成。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface aria-label="畫面測試設定" className="space-y-4">
      <label className="flex min-h-8 cursor-pointer items-center gap-2.5 text-ink">
        <input
          type="checkbox"
          className="h-4 w-4 accent-brand focus-visible:ring-2 focus-visible:ring-brand"
          checked={value?.screenshots || false}
          disabled={busy || !value}
          onChange={event => void save({ screenshots: event.target.checked })}
        />
        保留畫面截圖（下次畫面測試生效）
      </label>

      <Disclosure
        summary="Android 推播測試環境"
        onToggle={open => {
          if (open && !android) void refresh();
        }}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <ActionButton
              icon="refresh"
              disabled={busy || !config?.initialized}
              onClick={() => void refresh()}
            >
              檢查環境
            </ActionButton>
            <Badge tone={android?.appiumReady ? 'success' : 'neutral'} dot>
              {android?.appiumReady ? 'Appium 已就緒' : 'Appium 尚未就緒'}
            </Badge>
            <ActionButton
              disabled={busy || !android?.sdkReady || android.appiumReady}
              onClick={() => void start('appium-start')}
            >
              啟動 Appium
            </ActionButton>
          </div>
          {android?.issues.map(text => (
            <p key={text} className="text-muted">
              {text}
            </p>
          ))}
          {!!android?.devices.length && (
            <ul className="divide-y divide-line rounded-lg border border-line bg-canvas px-3">
              {android.devices.map(device => (
                <li
                  key={device.serial}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0 break-all font-mono text-ink">
                    {`${device.serial} · ${device.booted ? '已就緒' : device.state === 'error' ? '啟動失敗' : '準備中'}`}
                  </span>
                  <ActionButton
                    variant={value?.androidSerial === device.serial ? 'primary' : 'secondary'}
                    disabled={busy || !device.booted}
                    aria-pressed={value?.androidSerial === device.serial}
                    onClick={() => void save({ androidSerial: device.serial })}
                  >
                    {value?.androidSerial === device.serial ? '目前使用' : '使用這台'}
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
          {!!android?.avds.length && (
            <ul className="divide-y divide-line rounded-lg border border-line bg-canvas px-3">
              {android.avds.map(avd => (
                <li key={avd} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 break-all font-mono text-ink">{avd}</span>
                  <ActionButton
                    disabled={busy || android.devices.some(device => device.avd === avd)}
                    aria-label={`啟動 ${avd}`}
                    onClick={() => void start('android-start', { avd })}
                  >
                    啟動模擬器
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Disclosure>

      {notice && <Banner tone="neutral">{notice}</Banner>}
      {error && <Banner tone="danger">{error}</Banner>}
    </Surface>
  );
}
