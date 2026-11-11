import { serverStorage,bootstrap } from './controlApi';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { FrontendProject, TestCase, TestFlow, TestingData } from './types';
import { useInlineRuns } from './useInlineRuns';

const storageKey = 'archify.testing.v1';

function load(): TestingData {
  try {
    const data = JSON.parse(serverStorage.getItem(storageKey) || 'null');
    const validCase = (item: TestCase) => item && typeof item.id === 'string'
      && typeof item.name === 'string' && ['api', 'playwright', 'visual'].includes(item.kind)
      && Number.isInteger(item.version) && typeof item.target === 'string'
      && typeof item.expected === 'string' && typeof item.description === 'string'
      && typeof item.method === 'string' && Number.isInteger(item.expectedStatus)
      && typeof item.baseline === 'string' && Array.isArray(item.actions)
      && item.actions.every(action => action && typeof action.id === 'string'
        && ['goto', 'click', 'fill', 'visible'].includes(action.kind)
        && typeof action.target === 'string' && typeof action.value === 'string')
      && item.viewport && Number.isFinite(item.viewport.width) && Number.isFinite(item.viewport.height);
    if (data && data.project
      && ['name', 'repositoryUrl', 'branch', 'websiteUrl'].every(key => typeof data.project[key] === 'string')
      && ['bffRepositoryUrl', 'backendRepositoryUrl', 'frontendConnectionId', 'bffConnectionId', 'backendConnectionId'].every(key => data.project[key] === undefined || typeof data.project[key] === 'string')
      && Array.isArray(data.cases) && data.cases.every(validCase)
      && new Set(data.cases.map((item: TestCase) => item.id)).size === data.cases.length
      && Array.isArray(data.flows)
      && new Set(data.flows.map((flow: TestFlow) => flow.id)).size === data.flows.length
      && data.flows.every((flow: TestFlow) => flow && typeof flow.id === 'string'
        && typeof flow.name === 'string' && Number.isInteger(flow.version)
        && flow.variables && typeof flow.variables === 'object' && !Array.isArray(flow.variables)
        && Object.values(flow.variables).every(value => typeof value === 'string')
        && Array.isArray(flow.steps) && flow.steps.every(step => step && validCase(step.snapshot)))) {
      return data as TestingData;
    }
  } catch {
    // Do not replace unreadable server data with example cases.
  }
  return { project: {name:'Archify Test',repositoryUrl:'',branch:'release',websiteUrl:''},cases:[],flows:[] };
}

interface Store extends ReturnType<typeof useInlineRuns> {
  data: TestingData;
  storageError: string;
  projects: FrontendProject[];
  selectProject: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  editingFlowId: string | null;
  editorKey: number;
  selectedFlowId: string;
  selectFlow: (id: string) => void;
  openFlow: (id: string | null) => void;
  saveProject: (project: FrontendProject) => Promise<void>;
  saveCase: (testCase: TestCase) => void;
  saveFlow: (flow: Omit<TestFlow, 'id' | 'version' | 'updatedAt'> & { id?: string }) => TestFlow;
}

const Context = createContext<Store | null>(null);

export function TestingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(load);
  const inlineRunStore = useInlineRuns(data.project);
  const [storageError, setStorageError] = useState('');
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [selectedFlowId, selectFlow] = useState('');

  async function persist(next: TestingData) {
    try { await serverStorage.setItem(storageKey, JSON.stringify(next)); setData(next); setStorageError(''); }
    catch (reason) { setStorageError(reason instanceof Error ? reason.message : '伺服器儲存失敗'); throw reason; }
  }

  function saveCase(testCase: TestCase) {
    const current = data;
    {
      const existing = current.cases.find(item => item.id === testCase.id);
      const next = structuredClone({ ...testCase, version: existing ? existing.version + 1 : 1 });
      void persist({ ...current, cases: existing ? current.cases.map(item => item.id === next.id ? next : item) : [...current.cases, next] }).catch(() => {});
    }
  }

  function saveFlow(input: Omit<TestFlow, 'id' | 'version' | 'updatedAt'> & { id?: string }) {
    const existing = data.flows.find(item => item.id === input.id);
    const next: TestFlow = structuredClone({ ...input, id: input.id || crypto.randomUUID(), version: (existing?.version || 0) + 1, updatedAt: new Date().toISOString() });
    void persist({ ...data, flows: existing ? data.flows.map(item => item.id === next.id ? next : item) : [...data.flows, next] }).catch(() => {});
    setEditingFlowId(next.id);
    selectFlow(next.id);
    return next;
  }

  const projects = data.projects || (data.project.repositoryUrl ? [{...data.project, id:data.project.id || 'original'}] : []);
  async function saveProject(project: FrontendProject) {
    const previous = projects.find(item => item.id === project.id);
    const changed = previous && ['repositoryUrl','bffRepositoryUrl','backendRepositoryUrl'].some(key => previous[key as keyof FrontendProject] !== project[key as keyof FrontendProject]);
    const saved = {...project, ...(changed ? {sourceSnapshotId:undefined,importedFileCount:undefined,importedAt:undefined} : {}), id:project.id || crypto.randomUUID()};
    await persist({...data, project:saved, projects:projects.some(item => item.id === saved.id) ? projects.map(item => item.id === saved.id ? saved : item) : [...projects, saved]});
  }
  async function selectProject(id: string) {
    const project = projects.find(item => item.id === id);
    if (project) await persist({...data, project, projects});
  }
  async function removeProject(id: string) {
    const next = projects.filter(item => item.id !== id);
    await persist({...data, projects:next, project:(data.project.id || 'original') === id ? next[0] || {name:'尚未選擇專案',repositoryUrl:'',branch:'release',websiteUrl:''} : data.project});
  }
  return (
    <Context.Provider value={{
      ...inlineRunStore,
      data, storageError, editingFlowId, editorKey, selectedFlowId, selectFlow,
      openFlow: id => { setEditingFlowId(id); setEditorKey(key => key + 1); },
      projects, selectProject, removeProject, saveProject,refreshData:async()=>{await bootstrap();setData(load());},
      saveCase, saveFlow,
    }}>
      {children}
    </Context.Provider>
  );
}

export function useTesting() {
  const store = useContext(Context);
  if (!store) throw new Error('TestingProvider is missing');
  return store;
}

