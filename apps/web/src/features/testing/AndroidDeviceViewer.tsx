import { AdbRetry } from './AdbRetry';
import { useEffect, useRef, useState } from 'react';
import { Button, Notice, cx } from '../../components/ui/controls';
import { useScrcpy } from './useScrcpy';
type Device = { serial: string; state: string; booted: boolean; canControl: boolean; error: string; profileId?: string };
export function DeviceViewer({ device, refresh, name, retryDisabledReason, onRetried }: { device: Device; refresh: () => Promise<void>; name?: string; retryDisabledReason?: string; onRetried?: () => Promise<void> }) {
  const displayName = name?.trim() || device.serial;
  const [playing, setPlaying] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const changed = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  async function toggleFullscreen() {
    endGesture(); setError('');
    try {
      if (document.fullscreenElement === container.current) await document.exitFullscreen();
      else await container.current?.requestFullscreen();
    } catch { setError('瀏覽器未允許全螢幕；仍可在目前畫面操作。'); }
  }
  const stream = useScrcpy(device.serial, playing && device.state === 'device' && device.booted);
  const streamLabel = playing && !device.booted ? device.state === 'offline' ? '裝置離線，等待連線' : '等待裝置啟動' : stream.state;
  const streamFailed = !!stream.error || !!device.error || device.state === 'offline';
  const streamLive = !streamFailed && playing && device.booted && stream.ready;
  const statusDescription = streamFailed ? device.error || stream.error || '裝置離線' : streamLive ? '已就緒 · 即時串流中' : streamLabel;
  const gesture = useRef<number | null>(null);
  const enabled = device.booted && device.canControl && stream.control && stream.ready && playing && !busy;
  function point(clientX: number, clientY: number, clamp = false) {
    const canvas = stream.canvas.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
    const x = Math.floor((clientX - rect.left - (rect.width - canvas.width * scale) / 2) / scale);
    const y = Math.floor((clientY - rect.top - (rect.height - canvas.height * scale) / 2) / scale);
    if (!clamp && (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height)) return null;
    return { x: Math.max(0, Math.min(canvas.width - 1, x)), y: Math.max(0, Math.min(canvas.height - 1, y)), width: canvas.width, height: canvas.height };
  }
  function endGesture() { gesture.current = null; stream.release(); }
  async function stop() {
    if (busy) return;
    setBusy(true); setError(''); endGesture();
    try {
      const response = await fetch(`/api/android/devices/${device.serial}/stop`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Archify-Client': 'web' }, body: '{}', signal: AbortSignal.timeout(50000) });
      if (!response.ok) throw new Error((await response.json()).error || '無法停止裝置。');
      await refresh();
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  async function clearRecent() {
    if (!enabled) return;
    setBusy(true); setError(''); endGesture();
    try {
      const response = await fetch(`/api/android/devices/${device.serial}/input`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Archify-Client': 'web' }, body: JSON.stringify({ action: 'clearRecent' }), signal: AbortSignal.timeout(35000) });
      if (!response.ok) throw new Error((await response.json()).error || '無法清除最近使用的應用程式。');
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }
  return <div ref={container} className={cx('space-y-3 bg-surface', fullscreen && 'h-dvh overflow-y-auto p-4')}>
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2"><span role="status" title={statusDescription} className="inline-flex min-h-8 items-center"><svg aria-hidden="true" viewBox="0 0 16 16" className={cx("h-4 w-4 shrink-0",streamFailed?"text-danger":streamLive?"text-success":"text-muted")} fill="currentColor"><circle cx="8" cy="8" r="6"/></svg><span className="sr-only">{statusDescription}</span></span><AdbRetry disabledReason={retryDisabledReason || (!device.canControl || !playing || streamFailed || streamLive ? '啟動手機後，只有灰色燈號時可以重試。' : undefined)} onRetried={onRetried || refresh} /></div>
      <div className="ml-auto flex shrink-0 gap-1">
        <Button className="border-0 bg-transparent p-2 shadow-none" title={fullscreen ? '離開全螢幕' : '全螢幕操作'} aria-label={fullscreen ? '離開全螢幕' : '全螢幕操作'} aria-pressed={fullscreen} onClick={() => { void toggleFullscreen(); }}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg></Button>
        <Button className="border-0 bg-transparent p-2 shadow-none" title={playing ? '暫停串流' : '恢復串流'} aria-label={playing ? '暫停串流' : '恢復串流'} aria-pressed={playing} onClick={() => { endGesture(); setPlaying(value => !value); }}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={playing ? "M8 5v14M16 5v14" : "m7 4 14 8-14 8V4Z"}/></svg></Button>
        <Button className="border-0 bg-transparent p-2 shadow-none" title={device.profileId ? '關機並保留資料' : '停止裝置'} aria-label={device.profileId ? '關機並保留資料' : '停止裝置'} variant={device.profileId ? 'secondary' : 'danger'} disabled={!device.canControl || busy} onClick={() => { void stop(); }}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v9M6 5a9 9 0 1 0 12 0"/></svg></Button>
      </div>
    </div>
    {stream.error && <Notice error>{stream.error}</Notice>}
    {device.error && <Notice error>{device.error}</Notice>}
    {error && <Notice error>{error}</Notice>}
    <button type="button" disabled={!enabled} aria-label="點擊裝置畫面或拖曳滑動，方向鍵移動，Enter 點擊中央" className="block w-full touch-none select-none rounded-lg border border-line bg-canvas p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-default"
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0 || gesture.current !== null) return;
        const position = point(event.clientX, event.clientY); if (!position) return;
        event.preventDefault(); event.currentTarget.focus(); gesture.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        stream.touch({ type: 'touch', action: 0, pointerId: 0, ...position });
      }}
      onPointerMove={event => {
        if (gesture.current !== event.pointerId) return;
        const position = point(event.clientX, event.clientY, true);
        if (position) stream.touch({ type: 'touch', action: 2, pointerId: 0, ...position });
      }}
      onPointerUp={event => {
        if (gesture.current !== event.pointerId) return;
        const position = point(event.clientX, event.clientY, true);
        if (position) stream.touch({ type: 'touch', action: 1, pointerId: 0, ...position });
        endGesture();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={endGesture} onLostPointerCapture={endGesture} onBlur={endGesture}
      onKeyDown={event => {
        const keys: Record<string, number> = { ArrowUp: 19, ArrowDown: 20, ArrowLeft: 21, ArrowRight: 22 };
        if (keys[event.key]) { event.preventDefault(); stream.key(keys[event.key]); }
      }}
      onClick={event => {
        if (event.detail !== 0) return;
        const canvas = stream.canvas.current; if (!canvas) return;
        const position = { x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2), width: canvas.width, height: canvas.height };
        stream.touch({ type: 'touch', action: 0, pointerId: 0, ...position }); stream.touch({ type: 'touch', action: 1, pointerId: 0, ...position });
      }}><canvas ref={stream.canvas} width={576} height={1024} role="img" aria-label={`${displayName} 實際裝置畫面`} className={cx('w-full object-contain', fullscreen ? 'h-android-fullscreen' : 'h-android-screen')} /></button>
    <nav aria-label="Android 導覽" className="flex items-center justify-evenly gap-2">
      {([{ keycode: 4, label: '返回' }, { keycode: 3, label: '主畫面' }, { keycode: 187, label: '最近使用' }] as const).map(item => <Button key={item.keycode} variant="ghost" aria-label={item.label} title={item.label} disabled={!enabled} onClick={() => stream.key(item.keycode)}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">{item.keycode===4?<path d="M17 4 5 12l12 8Z" strokeLinejoin="round"/>:item.keycode===3?<circle cx="12" cy="12" r="8"/>:<rect x="5" y="5" width="14" height="14" rx="1"/>}</svg></Button>)}
      <Button variant="ghost" aria-label={busy ? '正在清除最近使用的應用程式' : '清除最近使用的應用程式'} title="清除最近使用的應用程式" aria-busy={busy} disabled={!enabled} onClick={() => { void clearRecent(); }}><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v5m4-5v5"/></svg></Button>
    </nav>
    {!device.canControl && <p className="text-muted">只有啟動此裝置的帳號可操作與停止。外部啟動或重新配對前的裝置僅供檢視。</p>}
    {device.canControl && stream.ready && !stream.control && <p className="text-muted">另一個視窗正在操作此裝置；關閉該視窗後，暫停再恢復可取得操作權。</p>}
  </div>;
}
