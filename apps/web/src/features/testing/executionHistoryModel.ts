import type { ExecutionRecord } from './executionReportModel';
import type { AndroidFlowRun } from './AndroidFlowExecution';
import type { ApiRun } from './ApiActivity';

export type HistoryRecord = Omit<ExecutionRecord, 'recordKind'> & {
  recordKind: ExecutionRecord['recordKind'] | 'android' | 'api-request';
  android?: AndroidFlowRun;
  apiRun?: ApiRun;
  projectId?: string;
};
export const historyType = (run: HistoryRecord) => run.recordKind === 'android' ? 'flow' : run.recordKind === 'api-request' ? 'api' : run.recordKind === 'workflow' ? 'workflow' : 'script';
export const historyTypeLabels: Record<string, string> = { script: 'Test Case', flow: 'Flow Case', workflow: 'API 流程', api: 'API 請求' };
export const historyPath = (run: HistoryRecord) => run.recordKind === 'android' ? '/android/runs/' + encodeURIComponent(run.id) : run.recordKind === 'api-request' ? '/api-library/' + encodeURIComponent(run.projectId || '') + '/runs/' + encodeURIComponent(run.id) : '/execution-records/' + run.recordKind + '/' + encodeURIComponent(run.id);

export function androidRecord(run: AndroidFlowRun): HistoryRecord {
  return {
    manualCommits:run.manualCommits,id: run.id, recordKind: 'android', android: run, batchId: run.executionOrigin === 'e2e-batch' ? run.batchId : undefined, batchName: run.executionOrigin === 'e2e-batch' ? run.batchName : undefined, scriptId: run.scriptId || '', scriptName: run.name, scriptVersion: run.scriptVersion,
    testVersion: run.executionOrigin === 'e2e-batch' && run.batchId ? `ANDROID-BATCH-${run.batchId}` : run.testVersion || '', createdAt: run.createdAt || '', startedAt: null, finishedAt: run.finishedAt || null,
    status: run.status, source: run.source || '', sourceHash: '', sourceSnapshotId: '', repositories: [], deploymentVerified: false,
    environment: 'Android', mode: 'real', completed: run.completed, message: run.message, steps: run.steps.map(step => step.name),
    events: run.trace?.length ? run.trace.map((entry, index) => ({ sequence: index + 1, event: { type: entry.status === 'running' ? 'step-start' : 'step-end', title: `${entry.path} · ${entry.name}`, status: entry.status, message: [entry.phase === 'before' ? '前置' : entry.phase === 'after' ? '清理' : '測試', entry.actor === 'sender' ? '發送者' : entry.actor === 'receiver' ? '接收者' : '', entry.message, entry.durationMs === undefined ? '' : `${entry.durationMs} ms`].filter(Boolean).join(' · ') } })) : run.steps.filter(step => step.status !== 'pending').map((step, index) => ({ sequence: index + 1, event: { type: step.status === 'running' ? 'step-start' : 'step-end', title: step.name, status: step.status } })),
  };
}

export function apiRequestRecord(run: ApiRun, projectId: string): HistoryRecord {
  const result = run.body.result;
  const status = run.status === 'running' || run.status === 'queued' ? run.status : result ? result.outcome : 'failed';
  return {
    id: run.id, recordKind: 'api-request', apiRun: run, projectId, scriptId: '', scriptName: run.body.caseName || run.body.requestName || 'API 請求', scriptVersion: run.body.caseVersion || 0,
    testVersion: '', createdAt: run.created_at || '', startedAt: null, finishedAt: null, status,
    source: '', sourceHash: '', sourceSnapshotId: run.body.sourceSnapshotId || '', repositories: [], deploymentVerified: false,
    environment: run.body.environmentId || '未記錄', mode: 'real', completed: result?.checks.length || 0,
    message: run.body.error || result?.message || '結果尚未回報。', steps: result?.checks.map(check => check.name) || [],
    events: result?.checks.map((check, index) => ({ sequence: index + 1, event: { type: 'step-end', title: check.name, status: check.passed ? 'passed' : 'failed' } })) || [],
  };
}

export function matchesHistory(run: HistoryRecord, filters: { type: string; outcome: string; version: string }) {
  return (filters.type === 'all' || (filters.type === 'batch' ? !!run.batchId : historyType(run) === filters.type)) &&
    (filters.outcome === 'all' || run.status === filters.outcome) && (filters.version === 'all' || run.testVersion === filters.version);
}
