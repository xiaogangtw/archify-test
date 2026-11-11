import {Modal} from '../../components/ui/Modal';
import {AutomationLibrary} from './AutomationLibrary';
import {loadScripts} from './scriptStorage';
import { lazy, Suspense, useState } from 'react';
const AndroidWorkspace = lazy(() => import('./AndroidWorkspace').then(module => ({ default: module.AndroidWorkspace })));
import { WebPlaywrightWorkspace } from './WebPlaywrightWorkspace';
import { JobQueue } from './JobQueue';

import type { PageId } from '../../types';
import { Button, Notice } from '../../components/ui/controls';
import { useTesting } from './TestingProvider';
import { ScriptLibrary } from './ScriptLibrary';

import { ApiWorkbench } from './ApiWorkbench';
import { VersionResults } from './VersionResults';
import {QualityReports} from './QualityReports';
import { ScriptExecution } from './ScriptExecution';
import { ProjectSetup } from './ProjectSetup';
import { FlowBuilder } from './FlowBuilder';
import { ScriptWorkspace } from './ScriptWorkspace';
import { FlowExecution } from './FlowExecution';
import { GitConnections } from './GitConnections';

export const testingPageIds: PageId[] = ['e2e-batch', 'automation-cases', 'web-e2e', 'android-e2e', 'e2e', 'projects', 'project', 'gitlab', 'git-connections', 'cases', 'api-tests', 'journeys', 'builder', 'review', 'suites', 'run-new', 'runs', 'reports', 'jobs'];

export function TestingPages({ page, onNavigate, authoringSession, executionSession }: { page: PageId; onNavigate: (page: PageId, scriptId?: string) => void; authoringSession: { key: number; scriptId?: string }; executionSession: number }) {
  const { storageError, editorKey, data } = useTesting();


  const editScript = (id: string) => onNavigate('journeys', id);
  return <>{storageError && <Notice error>{storageError}</Notice>}
    {['projects', 'project', 'gitlab'].includes(page) && <ProjectSetup key={page} page={page==='gitlab'?'projects':page} onNavigate={onNavigate} />}
    {page === 'git-connections' && <GitConnections onNavigate={onNavigate} />}
    {page === 'automation-cases' && <AutomationLibrary key={data.project.id||'original'}/> }
    {page === 'cases' && <ScriptLibrary onEdit={editScript} />}
    {page === 'api-tests' && <ApiWorkbench key={data.project.id || 'original'} onOpenScript={editScript}/>}
    {page === 'web-e2e' && <WebPlaywrightWorkspace key={'web-' + (data.project.id || 'original')} projectId={data.project.id || 'original'} />}
    {['e2e', 'android-e2e'].includes(page) && <Suspense fallback={<p role="status">正在載入模擬器工作區。</p>}><AndroidWorkspace key={data.project.id || 'original'} projectId={data.project.id || 'original'} cases={loadScripts()} /></Suspense>}
    {page === 'jobs' && <JobQueue />}
    {page === 'runs' && <VersionResults key={data.project.id || 'original'} projectId={data.project.id} />}
    {page === 'reports' && <QualityReports />}
    {page === 'journeys' && <ScriptEditorPage key={authoringSession.key} scriptId={authoringSession.scriptId} onReturn={()=>onNavigate('cases')} />}
    {['builder', 'review'].includes(page) && <FlowBuilder key={editorKey} onFinished={() => onNavigate('journeys')} />}
    {page === 'suites' && <ScriptExecution key={executionSession} onEdit={editScript} onNavigate={onNavigate} />}
    {page === 'run-new' && <FlowExecution page={page} onNavigate={onNavigate} />}
  </>;
}

function ScriptEditorPage({scriptId,onReturn}:{scriptId?:string;onReturn:()=>void}) {
  const [dirty,setDirty]=useState(false);
  const [confirm,setConfirm]=useState(false);
  return <>
    <ScriptWorkspace scriptId={scriptId} onDirtyChange={setDirty}
      backLabel="返回案例庫" onBack={scriptId?()=>dirty?setConfirm(true):onReturn():undefined}/>
    <Modal compact open={confirm} title="尚有未儲存修改" onClose={()=>setConfirm(false)}>
      <p>返回案例庫會放棄目前修改。</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={()=>setConfirm(false)}>繼續編輯</Button>
        <Button variant="danger" onClick={()=>{setConfirm(false);onReturn();}}>放棄修改並返回</Button>
      </div>
    </Modal>
  </>;
}
