import type { AndroidRun } from './androidRuns.ts';

export function androidReportRecord(run: AndroidRun) {
  const { owner: _owner, requestId: _requestId, ...evidence } = run;
  const reportBatch = run.executionOrigin === 'e2e-batch' ? run.batchId : undefined;
  const events = run.trace?.length ? run.trace : run.steps.filter(step => step.status !== 'pending').map(step => ({ ...step, message: '' }));
  return {
    ...evidence, batchId: reportBatch, recordKind: 'android', scriptName: run.name,
    // Group historical per-case versions without rewriting their saved evidence.
    reportVersion: reportBatch ? `ANDROID-BATCH-${reportBatch}` : run.testVersion,
    sourceHash: '', sourceSnapshotId: '', repositories: [], environment: 'Android', mode: 'real',
    startedAt: null, finishedAt: run.finishedAt || null,
    steps: run.steps.map(step => step.name),
    events: events.map((entry, index) => ({ sequence: index + 1, event: { type: entry.status === 'running' ? 'step-start' : 'step-end', title: entry.name, status: entry.status, message: entry.message || '', ...('path' in entry ? {path:entry.path,action:entry.action,phase:entry.phase,actor:entry.actor,durationMs:entry.durationMs} : {}) } })),
  };
}
