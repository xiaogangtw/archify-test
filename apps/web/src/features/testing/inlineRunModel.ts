export type InlineRunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'skipped' | 'cancelled';
export interface InlineRun {
  id: string; scriptId: string; scriptVersion: number; scriptName?: string; source: string;
  manualCommits?:Partial<Record<'frontend'|'bff'|'backend',string>>;
  sourceOrigin?: 'upload' | 'git'; sourceContentHash?: string; importedSnapshotId?: string;
  sourceHash: string; sourceSnapshotId: string; environment: string; deploymentVerified: boolean;
  steps: string[]; completed: number; status: InlineRunStatus; message: string; mode: 'real';
  testVersion: string; createdAt: string; startedAt: string | null; finishedAt: string | null;
  repositories: { role: 'frontend' | 'bff' | 'backend'; url: string; ref: 'release'; commitSha: string; qaTag: string; qaTagSha: string; tagMatchesRelease: boolean }[];
}
