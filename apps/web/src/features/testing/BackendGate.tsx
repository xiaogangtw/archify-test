import { hasBrowserData, importBrowserData } from './browserImport';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Notice } from '../../components/ui/controls';
import { bootstrap } from './controlApi';
export function BackendGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [legacy, setLegacy] = useState(() => { try { return hasBrowserData() && !localStorage.getItem('archify.server-import.v1'); } catch { return false; } });
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState('');
  const [generation, setGeneration] = useState(0);
  async function importLegacy() { setImporting(true); try { const count=await importBrowserData(); setImportNotice(`已匯入 ${count} 個新案例，舊瀏覽器資料仍保留。`); setLegacy(false); setGeneration(value=>value+1); } catch(reason) { setImportNotice(`匯入未完成：${reason instanceof Error ? reason.message : '請重試'}`); } finally {setImporting(false);} }
  const [error, setError] = useState('');
  async function connect() {
    setState('loading');
    try { await bootstrap(); setState('ready'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '無法連線'); setState('error'); }
  }
  useEffect(() => { void connect(); }, []);
  if (state !== 'ready') return <main className="flex min-h-screen items-center justify-center bg-canvas p-6"><div className="w-full max-w-xl space-y-5 rounded-xl border border-line bg-surface p-6"><h1 className="text-section font-bold">Archify Test</h1>{state === 'loading' ? <p role="status">正在讀取伺服器資料…</p> : <><Notice error>Control API 尚未連線：{error}</Notice><p className="text-body text-muted">請先啟動本機 PostgreSQL 與 Control API，再重新連線。啟動方式見 LOCAL-SETUP.md。</p><Button onClick={connect}>重新連線</Button></>}</div></main>;
  return <div key={generation}>{legacy && <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-6 py-3"><p className="text-body">找到此瀏覽器舊資料，匯入時保留伺服器既有案例。</p><Button disabled={importing} onClick={importLegacy}>{importing?'匯入中…':'匯入舊資料'}</Button><Button disabled={importing} onClick={()=>setLegacy(false)}>稍後</Button></div>}{importNotice && <Notice>{importNotice}</Notice>}{children}</div>;
}
