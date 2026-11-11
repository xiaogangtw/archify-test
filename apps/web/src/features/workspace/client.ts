export interface LocalConfig { sourceRoot: string; projectRoot: string; analysisDir: string; apiDir: string; reportDir: string; configured: boolean; initialized: boolean; session: string; onboardingCompleted?: boolean; knowledgeCount?: number }
export interface KnowledgeSource { name: string; sha256: string; path: string; bytes: number; mediaType: string; kind: 'image' | 'text' }
export interface KnowledgeDocument { id: string; title: string; format: string; size: number; createdAt: string; content?: string; hash?: string; category?: string; featureIds?: string[]; revision?: string; sources?: KnowledgeSource[] }
export interface KnowledgeIndex { documents: KnowledgeDocument[]; onboardingCompleted: boolean; directory: string; entry: string; lastAiUpdate?: { at: string; archive: string; conflicts: string[] } }
export interface ApiItem { id: string; name: string; kind: 'http' | 'graphql'; method: string; endpoint: string; operationName: string; operationType: string; service: string; evidence: { path: string; line: number }[]; issues: string[]; caseFile?: string }
export interface RemovedScript { id: string; name: string; path: string }
export interface Analysis { schemaVersion: number; scanId: string; createdAt: string; sourceLabel: string; files: number; apiDir: string; sourceHash: string; requests: ApiItem[]; warnings: string[]; existingIds?: string[]; removed?: RemovedScript[]; removalNotice?: string }
export interface ReportFile { name: string; size: number; modifiedAt: string;testType?:'api'|'ui' }
export interface ScriptInventory {
  summary: { total: number; content: number; draft: number; unknown: number };
  scripts: { path: string; category: 'api' | 'flow' | 'web' | 'mobile' | 'other'; state: 'content' | 'draft' | 'unknown'; tests: number; withContent: number; skipped: number }[];
  warnings: string[];
}
export async function settings(): Promise<LocalConfig> {
  const response = await fetch('/local-api/config', { cache: 'no-store' });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || '無法載入本機設定。');
  return value;
}
export async function operation<T>(config: LocalConfig, action: string, input = {}): Promise<T> {
  const response = await fetch(`/local-api/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Archify-Session': config.session }, body: JSON.stringify(input) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || '本機操作失敗。');
  return value;
}
