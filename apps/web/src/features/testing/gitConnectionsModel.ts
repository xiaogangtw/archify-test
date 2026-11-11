import { serverStorage } from './controlApi';
export type GitConnectionKind = 'repository' | 'metadata' | 'ssh';
export interface GitConnection {
  id: string; name: string; host: string; kind: GitConnectionKind;
  repositories: string[]; secretRef: string; expiresAt: string; enabled: boolean;
}
export const gitConnectionKey = 'archify.git-connections.v1';
export const kindLabels: Record<GitConnectionKind, string> = { repository: 'HTTPS 唯讀倉庫', metadata: '唯讀 API', ssh: 'SSH 唯讀金鑰' };
export function repositoryIdentity(value: string): { host: string; path: string } | null {
  const ssh = /^git@([^\s:]+):([^\s?#]+)$/.exec(value.trim());
  if (ssh) return { host: ssh[1].toLowerCase(), path: ssh[2].replace(/\.git$/, '').replace(/\/$/, '') };
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname === '/') return null;
    return { host: url.host.toLowerCase(), path: url.pathname.replace(/^\//, '').replace(/\/$/, '').replace(/\.git$/, '') };
  } catch { return null; }
}
export function validateConnection(connection: GitConnection): string {
  if (!connection.name.trim()) return '請填寫連線名稱。';
  let host: URL;
  try { host = new URL(connection.host); } catch { return 'GitLab 主機請填完整 HTTPS 網址。'; }
  if (host.protocol !== 'https:' || host.username || host.password || host.pathname !== '/' || host.search || host.hash) return 'GitLab 主機只能包含 HTTPS 與主機名稱。';
  if (!/^vault:\/\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)+$/.test(connection.secretRef)) return '保管位置請填 vault:// 開頭的憑證參照，不能填 Token 或私鑰。';
  if (!connection.repositories.length || connection.repositories.some(repo => repositoryIdentity(repo)?.host !== host.host.toLowerCase())) return '請列出此 GitLab 主機允許使用的倉庫地址。';
  if (connection.repositories.some(repo => connection.kind === 'ssh' ? !repo.startsWith('git@') : !repo.startsWith('https://'))) return '倉庫地址需符合選擇的 HTTPS 或 SSH 方式。';
  if (connection.expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(connection.expiresAt)) return '到期日格式不正確。';
  return '';
}
export function loadGitConnections(): GitConnection[] {
  try {
    const items = JSON.parse(serverStorage.getItem(gitConnectionKey) || '[]');
    if (Array.isArray(items) && items.every(item => item && typeof item.id === 'string'
      && typeof item.name === 'string' && typeof item.host === 'string' && ['repository', 'metadata', 'ssh'].includes(item.kind)
      && Array.isArray(item.repositories) && item.repositories.every((repo: unknown) => typeof repo === 'string')
      && typeof item.secretRef === 'string' && typeof item.expiresAt === 'string' && typeof item.enabled === 'boolean'
      && !validateConnection(item))) return items;
  } catch { /* No raw credentials are accepted or persisted. */ }
  return [];
}
export function connectionAllows(connection: GitConnection, repository: string, role: 'frontend' | 'metadata') {
  if (!connection.enabled || (role === 'metadata' ? connection.kind !== 'metadata' : connection.kind === 'metadata')) return false;
  if (connection.expiresAt && connection.expiresAt <= new Date().toISOString().slice(0, 10)) return false;
  if (role === 'frontend' && (connection.kind === 'ssh' ? !repository.startsWith('git@') : !repository.startsWith('https://'))) return false;
  const target = repositoryIdentity(repository);
  if (!target) return false;
  return connection.repositories.some(repo => { const allowed = repositoryIdentity(repo); return allowed?.host === target.host && allowed.path === target.path; });
}

