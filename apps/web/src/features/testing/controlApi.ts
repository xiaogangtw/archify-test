import llmTimeouts from '../../../../../services/control-api/src/llmTimeouts.json';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('X-Archify-Client')) headers.set('X-Archify-Client', 'web');
  if (typeof init.body === 'string' && init.body.length && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`/api${path}`, { ...init, headers, signal: init.signal || AbortSignal.timeout(path === '/sources/refresh' ? 900000 : path === '/llm' ? llmTimeouts.browserMs : 70000) });
  const route=path.split('?')[0];
  let body:any;
  try {body=await response.json();}
  catch {
    const detail=[502,503,504].includes(response.status)?'網頁無法取得 Control API 回應，請確認 VM 服務與連線。':response.status===404?'找不到 API 路徑，請確認 VM 已更新及網頁代理設定。':response.status===413?'請求超過伺服器或代理的大小限制。':'伺服器未回傳 JSON，請檢查服務或代理紀錄。';
    throw new Error(`${detail}（HTTP ${response.status}，/api${route}）`);
  }
  if(response.ok && body===null && route==='/api-analyses/latest')return body as T;
  if(!body || typeof body!=='object')throw new Error(`Control API 回應格式錯誤（HTTP ${response.status}，/api${route}）`);
  if (!response.ok) {
    const message = route === '/llm' && response.status === 400 && body.error === 'Invalid request' ? 'AI 服務拒絕了這次對話資料，請重新整理後再試。' : body.error || `HTTP ${response.status}`;
    throw Object.assign(new Error(message),{status:response.status});
  }
  return body as T;
}
const documents = new Map<string, { value: unknown; revision: number }>();
let scripts: import('./scriptModel').ScriptDraft[] = [];
let history: import('./scriptModel').ScriptDraft[] = [];
export const serverStorage = {
  getItem(key: string): string | null { const item = documents.get(key); return item ? JSON.stringify(item.value) : null; },
  async setItem(key: string, text: string) {
    const value = JSON.parse(text); const revision = documents.get(key)?.revision || 0;
    const result = await api<{ revision: number }>(`/documents/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ value, revision }) });
    documents.set(key, { value, revision: result.revision });
  },
};
export function cachedScripts(isHistory = false) { return structuredClone(isHistory ? history : scripts); }
export async function saveScript(input: import('./scriptModel').ScriptDraft) {
  const saved = await api<import('./scriptModel').ScriptDraft>(`/scripts/${encodeURIComponent(input.id)}`, { method: 'PUT', body: JSON.stringify(input) });
  scripts = [saved, ...scripts.filter(item => item.id !== saved.id)]; history = [...history, saved];
  return saved;
}
export async function deleteScript(input: import('./scriptModel').ScriptDraft) {
  await api(`/scripts/${encodeURIComponent(input.id)}`, { method: 'DELETE', body: JSON.stringify({version: input.version}) });
  scripts = scripts.filter(item => item.id !== input.id);
}
export async function bootstrap() {
  const body = await api<{ documents: { key: string; value: unknown; revision: number }[]; scripts: typeof scripts; history: typeof history }>('/bootstrap');
  documents.clear(); body.documents.forEach(item => documents.set(item.key, item)); scripts = body.scripts; history = body.history;
}
