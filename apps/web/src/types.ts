export type PageId = 'automation-cases' | 'e2e-batch' | 'web-e2e' | 'android-e2e' | 'e2e' | 'dashboard' | 'projects' | 'project' | 'gitlab' | 'git-connections' | 'scans' | 'scan' | 'evidence' | 'cases' | 'api-tests' | 'journeys' | 'builder' | 'review' | 'suites' | 'run-new' | 'runs' | 'run' | 'failure' | 'reports' | 'environments' | 'data' | 'schedules' | 'jobs' | 'system' | 'security' | 'audit' | 'members' | 'settings' | 'access' | 'chat' | 'agents' | 'llm' | 'llm-status';
export type Role = 'Viewer' | 'Author' | 'Operator' | 'Admin';
export type ViewState = 'ready' | 'loading' | 'empty' | 'error' | 'forbidden' | 'stale';
export interface Metric { label: string; value: string; note: string }
export interface Section { title: string; body?: string; items?: string[] }
export interface PageSpec {
  id: PageId; group: string; title: string; subtitle: string; route: string;
  action?: { label: string; target: PageId }; metrics?: Metric[];
  columns?: string[]; rows?: string[][]; sections: Section[];
}
export interface JourneyStep { id: string; name: string; method: string; path: string; assertion: string; evidence: string; mutates: boolean }
export interface PrototypeState { page: PageId; project: string; role: Role; viewState: ViewState; query: string; notice: string }
