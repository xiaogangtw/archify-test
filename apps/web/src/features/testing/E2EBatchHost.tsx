import { useEffect, useState } from 'react';
import { E2EBatchExecution } from './E2EBatchExecution';

// Navigation must hide a batch view, rather than destroy its in-flight queue.
// Keep each visited project's frozen selection and runner in the app lifetime.
export function E2EBatchHost({ active, projectId }: { active: boolean; projectId: string }) {
  const [visited, setVisited] = useState<string[]>(() => active ? [projectId] : []);
  useEffect(() => {
    if (active) setVisited(current => current.includes(projectId) ? current : [...current, projectId]);
  }, [active, projectId]);

  return <>{visited.map(id => <div key={id} hidden={!active || id !== projectId}>
    <E2EBatchExecution projectId={id} />
  </div>)}</>;
}
