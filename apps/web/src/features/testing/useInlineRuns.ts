import { useEffect, useState } from 'react';
import { api } from './controlApi';
import type { InlineRun } from './inlineRunModel';
import type { ScriptDraft } from './scriptModel';
import type { FrontendProject } from './types';
export function useInlineRuns(_project: FrontendProject) {
  const [inlineRuns, setInlineRuns] = useState<Record<string, InlineRun>>({});
  const [runHistory, setRunHistory] = useState<InlineRun[]>([]);
  const [runError, setRunError] = useState('');
  useEffect(() => {
    let active = true; let pending = false;
    const refresh = async () => {
      if (pending) return; pending = true;
      try {
        const rows = await api<InlineRun[]>('/runs');
        const workflows=await api<any[]>('/api-library/'+encodeURIComponent(_project.id||'original')+'/assistant');
        rows.unshift(...workflows.filter(job=>job.scriptId&&job.scriptVersion).map(workflowRun));
        if (active) { const latest: Record<string, InlineRun> = {}; rows.forEach(row => { latest[row.scriptId] ||= row; }); setInlineRuns(latest); setRunHistory(rows); setRunError(''); }
      } catch (reason) { if (active) setRunError(`無法同步執行狀態：${reason instanceof Error ? reason.message : '連線中斷'}`); }
      finally { pending = false; }
    };
    void refresh(); const timer = window.setInterval(refresh, 1500);
    return () => { active = false; window.clearInterval(timer); };
  }, [_project.id]);
  const [submitting, setSubmitting] = useState<string[]>([]);
  async function startInlineRun(script: ScriptDraft) {
    if (submitting.includes(script.id)) return;
    setSubmitting(current => [...current, script.id]);
    try {
      const row = script.apiFlow?workflowRun(await api<any>('/scripts/'+encodeURIComponent(script.id)+'/api-execute',{method:'POST',body:JSON.stringify({requestId:crypto.randomUUID(),version:script.version})})):await api<InlineRun>('/runs', { method: 'POST', body: JSON.stringify({ scriptId: script.id, scriptVersion: script.version, requestId: crypto.randomUUID() }) });
      setInlineRuns(current => ({ ...current, [script.id]: row })); setRunError('');
    } catch (reason) { setRunError(reason instanceof Error ? reason.message : '無法排入工作佇列'); }
    finally { setSubmitting(current => current.filter(id => id !== script.id)); }
  }
  async function cancelInlineRun(id: string) {
    const run = inlineRuns[id]; if (!run) return;
    try { if(run.testVersion.startsWith('API-')){await api('/api-library/'+encodeURIComponent(_project.id||'original')+'/assistant/'+run.id+'/stop',{method:'POST',body:'{}'});return;}const row = await api<InlineRun>(`/runs/${run.id}/cancel`, { method: 'POST', body: '{}' }); setInlineRuns(current => ({ ...current, [id]: row })); }
    catch (reason) { setRunError(reason instanceof Error ? reason.message : '無法取消'); }
  }
  return { runHistory, inlineRuns, startInlineRun, cancelInlineRun, runError, submitting };
}

function workflowRun(job:any):InlineRun{return {id:job.id,scriptId:job.scriptId,scriptVersion:job.scriptVersion,scriptName:job.question,source:'',sourceHash:'',sourceSnapshotId:'',environment:job.environmentId,deploymentVerified:false,steps:job.tasks.map((task:any)=>task.name),completed:job.tasks.filter((task:any)=>['passed','draft'].includes(task.status)).length,status:job.status==='completed'?(job.tasks.length&&job.tasks.every((task:any)=>task.status==='passed')?'passed':'skipped'):job.status, message:job.message,mode:'real',testVersion:'API-'+job.id,createdAt:job.createdAt||'',startedAt:null,finishedAt:null,repositories:[]};}
