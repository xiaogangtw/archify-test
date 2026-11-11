import { useState } from 'react';
import { Panel } from '../../components/Panel';
import { Badge, Button, Disclosure, Field, Input, Notice } from '../../components/ui/controls';
import { useTesting } from './TestingProvider';

type RepositoryRole = '前端' | '中間層 BFF' | '後端';
interface RepositoryRecord {
  role: RepositoryRole;
  url: string;
  branch: string;
  releaseSha: string;
  qaTag: string;
  tagSha: string;
}
interface VersionRecord {
  id: string;
  name: string;
  createdAt: string;
  website: string;
  apiEnvironment: string;
  repositories: RepositoryRecord[];
}
const key = 'archify.release-records.v1';
const roles: RepositoryRole[] = ['前端', '中間層 BFF', '後端'];
const fullSha = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;
export function comparison(record: RepositoryRecord) {
  if (!fullSha.test(record.releaseSha) || !fullSha.test(record.tagSha)) return '尚未填齊完整 SHA';
  return record.releaseSha.toLowerCase() === record.tagSha.toLowerCase()
    ? '手動紀錄相同，Git 尚未驗證' : '手動紀錄不同，需查 Git 歷史';
}
function loadRecords(): VersionRecord[] {
  try {
    const records = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(records) && records.every(record => record && typeof record.id === 'string'
      && typeof record.name === 'string' && typeof record.createdAt === 'string'
      && typeof record.website === 'string' && typeof record.apiEnvironment === 'string'
      && Array.isArray(record.repositories) && record.repositories.length === 3
      && record.repositories.every((repo: RepositoryRecord, index: number) => repo.role === roles[index]
        && ['url', 'branch', 'releaseSha', 'qaTag', 'tagSha'].every(field => typeof repo[field as keyof RepositoryRecord] === 'string')))) return records;
  } catch { /* An unavailable storage is reported when the user saves. */ }
  return [];
}

export function ReleaseVersions() {
  const { data } = useTesting();
  const [records, setRecords] = useState(loadRecords);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState(data.project.websiteUrl || 'http://localhost:5173');
  const [apiEnvironment, setApiEnvironment] = useState('dev');
  const [repositories, setRepositories] = useState<RepositoryRecord[]>(() => roles.map((role, index) => ({
    role, url: index === 0 ? data.project.repositoryUrl : '', branch: 'release', releaseSha: '', qaTag: '', tagSha: '',
  })));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  function change(index: number, field: keyof RepositoryRecord, value: string) {
    setRepositories(current => current.map((record, position) => position === index ? { ...record, [field]: value } : record));
    setMessage('');
  }
  function save() {
    setError(''); setMessage('');
    if (!name.trim() || records.some(record => record.name === name.trim())) {
      setError('請填寫未使用過的測試版本號。'); return;
    }
    if (repositories.some(repo => !repo.url.trim() || !repo.branch.trim() || !repo.qaTag.trim()
      || !fullSha.test(repo.releaseSha.trim()) || !fullSha.test(repo.tagSha.trim()))) {
      setError('三個倉庫都需填寫連結、release 分支、QA tag 與兩個完整 commit SHA。'); return;
    }
    try {
      const url = new URL(website);
      if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch { setError('前端網址請填本機 http://localhost 或 127.0.0.1 網址。'); return; }
    if (!apiEnvironment.trim()) { setError('請填寫前端環境設定所使用的 API 環境。'); return; }
    for (const repo of repositories) {
      try {
        if (/^git@[^\s:]+:[^\s]+$/.test(repo.url.trim())) continue;
        const url = new URL(repo.url.trim());
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
      } catch { setError('倉庫請填不含密碼或 Token 的 HTTPS／SSH Clone 連結。'); return; }
    }
    const next = [...records, structuredClone({ id: crypto.randomUUID(), name: name.trim(), createdAt: new Date().toISOString(),
      website: website.trim(), apiEnvironment: apiEnvironment.trim(), repositories: repositories.map(repo => Object.fromEntries(
        Object.entries(repo).map(([field, value]) => [field, value.trim()])) as unknown as RepositoryRecord) })];
    try {
      localStorage.setItem(key, JSON.stringify(next)); setRecords(next); setName('');
      setMessage('已保存手動版本快照；尚未驗證 Git，也不代表 dev 已部署這些 commit。');
    } catch { setError('瀏覽器無法保存，請保留目前表單後再試。'); }
  }
  return <div className="space-y-6">
    <Notice>一個測試版本記錄三個倉庫。只規劃取得前端 release 程式碼；中間層與後端只讀 Git 版本資訊。</Notice>
    {error && <Notice error>{error}</Notice>}{message && <Notice>{message}</Notice>}
    <Panel title="建立測試版本">
      <form className="space-y-6" onSubmit={event => { event.preventDefault(); save(); }}>
        <div className="grid gap-5 lg:grid-cols-3">
          <Field label="自訂測試版本號"><Input required value={name} onChange={event => setName(event.target.value)} placeholder="例如 QA-20261023-01" /></Field>
          <Field label="前端本機網址"><Input required value={website} onChange={event => setWebsite(event.target.value)} /></Field>
          <Field label="前端 env 指向的 API 環境"><Input required value={apiEnvironment} onChange={event => setApiEnvironment(event.target.value)} placeholder="dev" /></Field>
        </div>
        <p className="text-body text-muted">這裡只記錄環境，不修改前端 .env。SHA 是 Git commit 的完整 hash；QA tag 必須解析成 commit 再比對。</p>
        {repositories.map((repo, index) => <fieldset key={repo.role} className="space-y-5 rounded-lg border border-line p-5">
          <legend className="px-2 text-section font-bold">{repo.role}</legend>
          <Badge>{index === 0 ? '程式碼來源：僅前端' : '只記錄版本，不下載原始碼'}</Badge>
          <div className="grid gap-5 lg:grid-cols-2">
            <Field label={`${repo.role} GitLab 倉庫`}><Input required value={repo.url} onChange={event => change(index, 'url', event.target.value)} /></Field>
            <Field label={`${repo.role} release 分支`}><Input required value={repo.branch} onChange={event => change(index, 'branch', event.target.value)} /></Field>
            <Field label={`${repo.role} release commit SHA`}><Input required value={repo.releaseSha} onChange={event => change(index, 'releaseSha', event.target.value)} /></Field>
            <Field label={`${repo.role} QA tag 名稱`}><Input required value={repo.qaTag} onChange={event => change(index, 'qaTag', event.target.value)} placeholder="例如 qa-20261023" /></Field>
            <Field label={`${repo.role} QA tag 指向的 commit SHA`}><Input required value={repo.tagSha} onChange={event => change(index, 'tagSha', event.target.value)} /></Field>
          </div>
          <p className="text-body text-muted">{comparison(repo)}</p>
        </fieldset>)}
        <Button type="submit" variant="primary">保存版本快照</Button>
        <Disclosure title="未來怎麼確認版本？">
          <p>讀取三個倉庫的 release 分支頂端與 QA tag 指向的 commit。相同 SHA 才算完全一致；不同時查祖先關係，區分 release 已往前、tag 在前或分岔。僅檔案內容相同仍不算同一 commit。</p>
          <p>dev 真正執行的版本需再以部署紀錄或版本端點確認。Git tag 相同，不能單獨證明 dev 的部署版本。每次執行要固定版本快照、流程版本與環境，避免分支移動後失去依據。</p>
        </Disclosure>
      </form>
    </Panel>
    <Panel title="已保存的測試版本">
      {!records.length && <p className="text-body text-muted">尚未建立版本。保存後保留當時的三個 SHA，不隨 release 更新。</p>}
      <div className="space-y-5">{records.map(record => <article key={record.id} className="space-y-3 rounded-lg border border-line p-5">
        <h3 className="text-section font-bold">{record.name}</h3>
        <p className="break-all text-body text-muted">{record.website} · API：{record.apiEnvironment} · {new Date(record.createdAt).toLocaleString()}</p>
        {record.repositories.map(repo => <div key={repo.role} className="space-y-2 text-body">
          <p className="font-bold">{repo.role} · {repo.branch} · {repo.qaTag}</p>
          <p className="break-all text-muted">release：{repo.releaseSha}</p>
          <p className="break-all text-muted">QA tag：{repo.tagSha}</p>
          <Badge>{comparison(repo)}</Badge>
        </div>)}
        <p className="text-body text-muted">手動快照 · Git 未驗證 · dev 部署未驗證 · 尚未綁定執行</p>
      </article>)}</div>
    </Panel>
    <Panel title="測試怎麼分？">
      <dl className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3"><dt className="font-bold">目的：這次為什麼測？</dt><dd className="text-body leading-7 text-muted">Smoke：快速確認登入、首頁與關鍵 API 可用。<br />回歸：確認既有功能沒有被改壞。<br />變更驗證：針對本次修正與新增功能。</dd></div>
        <div className="space-y-3"><dt className="font-bold">方式：測哪個範圍？</dt><dd className="text-body leading-7 text-muted">單支 BFF／後端 API：直接檢查一個端點。<br />API 串接：多個端點與資料傳遞。<br />瀏覽器流程：Playwright 操作本機前端。<br />畫面比對：指定頁面、視窗與基準圖。</dd></div>
      </dl>
      <p className="mt-5 text-body text-muted">目前呈現分類規格；案例庫與執行綁定將依這個方向延伸，這裡尚未新增分類篩選或真實執行。</p>
    </Panel>
  </div>;
}

