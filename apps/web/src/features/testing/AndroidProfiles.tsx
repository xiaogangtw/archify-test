import { useEffect, useRef, useState } from 'react';
import { Button, Input, Notice, UiDensityContext } from '../../components/ui/controls';
export type Profile = { id: string; name: string; state: 'new' | 'ready'; serial: string | null };
export function AndroidProfiles({ profiles, connected, supported, refresh, select }: { profiles: Profile[]; connected: boolean; supported: boolean; refresh: () => Promise<void>; select: (serial: string) => void }) {
  const [name, setName] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [starting, setStarting] = useState<string | null>(null);
  const operation = useRef(false);
  useEffect(() => {
    if (starting && profiles.some(profile => profile.id === starting && profile.serial)) setStarting(null);
  }, [profiles, starting]);
  async function perform(path: string, body: object = {}, startId?: string) {
    if (operation.current || starting) return;
    operation.current = true;
    if (startId) setStarting(startId);
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/android/profiles${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Archify-Client': 'web' }, body: JSON.stringify(body), signal: AbortSignal.timeout(35000) });
      if (!response.ok) throw new Error((await response.json()).error || '手機操作失敗。');
      if (!path) setName('');
    } catch (reason) { setError((reason as Error).message); setStarting(null); }
    finally {
      try { await refresh(); }
      finally { operation.current = false; setBusy(false); }
    }
  }
  return <UiDensityContext.Provider value="compact"><section aria-label="固定手機管理" className="space-y-3 rounded-xl border border-line bg-surface p-3 text-body">
    <p className="text-menu text-muted">每台手機保留 App 與登入資料，再次啟動不必重裝 LINE；帳號可能仍需重新驗證。</p>
    {!supported && <Notice>固定手機功能尚未在執行服務啟用，請先完成版本更新。</Notice>}
    {error && <Notice error>{error}</Notice>}
    <form className="flex flex-col items-start gap-2 sm:flex-row sm:items-end" aria-busy={busy || !!starting} onSubmit={event => { event.preventDefault(); void perform('', { name: name.trim() }); }}>
      <label className="w-full min-w-0 flex-1 space-y-1"><span className="block text-menu text-muted">手機名稱</span><Input value={name} maxLength={80} placeholder="例如：LINE 測試帳號 A" disabled={busy || !!starting || !supported} onChange={event => setName(event.target.value)} /></label>
      <Button type="submit" variant="primary" disabled={busy || !!starting || !connected || !supported || !name.trim()}>{busy && !starting ? '處理中' : '新增固定手機'}</Button>
    </form>
    {profiles.length ? <ul className="divide-y divide-line">{profiles.map(profile => <li key={profile.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0"><p className="break-words text-body font-medium">{profile.name}</p><p className="text-menu text-muted">{starting === profile.id && !profile.serial ? '啟動中，等待手機連線' : profile.serial ? `執行中 · ${profile.serial}` : profile.state === 'ready' ? '已關機 · 資料保留' : '尚未完成建立'}</p></div>
      <Button aria-busy={starting === profile.id} disabled={busy || !!starting || !connected} onClick={() => { if (profile.serial) select(profile.serial); else void perform(`/${profile.id}/${profile.state === 'ready' ? 'start' : 'prepare'}`, {}, profile.state === 'ready' ? profile.id : undefined); }}>{starting === profile.id ? '啟動中' : profile.serial ? '查看手機' : profile.state === 'ready' ? '啟動手機' : '重試建立'}</Button>
    </li>)}</ul> : <p className="text-muted">尚未建立固定手機。雙帳號交換請各建立一台，分別登入。</p>}
  </section></UiDensityContext.Provider>;
}
