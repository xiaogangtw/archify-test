import {requestNavigation} from './features/testing/navigationGuard';
import { useEffect, useReducer, useRef, useState } from 'react';
import { pages, navigation } from './data/navigation';
import type { PageId } from './types';
import { canEdit, initialState, reducer } from './state/prototype';
import { PageContent } from './components/PageContent';
import { Button, Notice, UiDensityContext, cx } from './components/ui/controls';
import { AssistantWorkspace } from './features/assistant/AssistantWorkspace';
import theme from '../tailwind.config';
import { Dropdown } from './components/ui/Dropdown';
import { TestingPages, testingPageIds } from './features/testing/TestingPages';
import { useTesting } from './features/testing/TestingProvider';
import { E2EBatchHost } from './features/testing/E2EBatchHost';

const restrictedPages = ['gitlab', 'system', 'security', 'audit', 'members', 'settings'];

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { data: testingData, projects, selectProject } = useTesting();
  const [projectError, setProjectError] = useState('');
  const [closedGroups, setClosedGroups] = useState<string[]>(
    () => {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem('archify.navigation.closed.v1') || '[]');
        return Array.isArray(saved) ? saved.filter((title): title is string =>
          typeof title === 'string' && navigation.some(group => group.title === title)) : [];
      } catch { return []; }
    },
  );
  const [authoringSession, setAuthoringSession] = useState<{ key: number; scriptId?: string }>({ key: 0 });
  const [executionSession, setExecutionSession] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const mobilePanel = useRef<HTMLElement>(null);
  const page = pages.find(item => item.id === state.page)!;
  const isAssistant = ['chat', 'agents', 'llm','llm-status'].includes(page.id);
  const blocked = restrictedPages.includes(page.id) && state.role !== 'Admin';
  const projectLabel = state.project === 'Archify Web' ? testingData.project.name : state.project;

  function navigate(id: PageId, scriptId?: string) {requestNavigation(()=>performNavigate(id,scriptId));}
  function performNavigate(id: PageId, scriptId?: string) {
    if (id === 'journeys') setAuthoringSession(current => ({ key: current.key + 1, scriptId }));
    if (id === 'suites') setExecutionSession(current => current + 1);
    const group = navigation.find(item => (item.ids as readonly string[]).includes(id));
    if (group) setClosedGroups(items => items.filter(title => title !== group.title));
    dispatch({ type: 'navigate', page: id });
    setMobileOpen(false);
  }

  useEffect(() => {
    try { localStorage.setItem('archify.navigation.closed.v1', JSON.stringify(closedGroups)); }
    catch { /* Navigation still works when browser preferences cannot be saved. */ }
  }, [closedGroups]);

  useEffect(() => {
    const desktop = window.matchMedia(`(min-width: ${theme.theme.extend.screens.lg})`);
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const panel = mobilePanel.current;
    const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') || [])
      .filter(element => element.getClientRects().length > 0);
    focusables()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        menuTrigger.current?.focus();
      }
      if (event.key === 'Tab') {
        const items = focusables();
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault(); last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      requestAnimationFrame(() => menuTrigger.current?.focus());
    };
  }, [mobileOpen]);

  return (
    <UiDensityContext.Provider value="compact"><div className="app-shell bg-canvas text-menu text-ink lg:!grid-cols-api-shell">
      {mobileOpen && (
        <button
          type="button"
          aria-label="關閉選單"
          className="fixed inset-0 z-20 bg-scrim lg:hidden"
          onClick={() => { setMobileOpen(false); menuTrigger.current?.focus(); }}
        />
      )}

      <aside
        ref={mobilePanel}
        aria-label="主選單"
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen || undefined}
        className={cx(
          'fixed inset-y-0 left-0 z-30 min-h-0 w-sidebar flex-col overflow-hidden border-r border-line bg-sidebar px-3 py-4 lg:static lg:flex lg:w-auto',
          mobileOpen ? 'flex' : 'hidden',
        )}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between gap-2 px-2">
          <p className="text-section font-bold tracking-tight">Archify <span className="text-brand">Test</span></p>
          <button
            type="button"
            className="min-h-8 rounded-lg px-2 text-menu font-medium text-muted focus-visible:ring-2 focus-visible:ring-brand lg:hidden"
            onClick={() => { setMobileOpen(false); menuTrigger.current?.focus(); }}
          >
            關閉
          </button>
        </div>

        <div className="mb-3 shrink-0 px-2">
          <Dropdown label="目前專案" value={testingData.project.id || 'original'} options={projects.map(project => ({value:project.id!,label:project.name}))} disabled={!projects.length} onChange={id => requestNavigation(()=>selectProject(id).then(() => setProjectError('')).catch(reason => setProjectError(reason.message)))} />
          <Button className="mt-3 w-full justify-start" onClick={() => navigate('projects')}>管理與新增專案</Button>
          {projectError && <Notice error>{projectError}</Notice>}
        </div>

        <nav aria-label="功能導覽" className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navigation.map((group, index) => {
            const open = !closedGroups.includes(group.title);
            return (
              <section key={group.title}>
                <h2>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`nav-group-${index}`}
                    className="flex min-h-8 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-menu font-bold hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    onClick={() => setClosedGroups(items => open
                      ? [...items, group.title]
                      : items.filter(title => title !== group.title))}
                  >
                    <span>{group.title}</span>
                  </button>
                </h2>
                <div id={`nav-group-${index}`} hidden={!open} className="mt-1 space-y-1 pl-2">
                  {group.ids.map(id => {
                    const target = pages.find(item => item.id === id)!;
                    return (
                      <button
                        type="button"
                        key={id}
                        aria-current={id === page.id ? 'page' : undefined}
                        onClick={() => navigate(id)}
                        className={cx(
                          'flex min-h-8 w-full items-center justify-between rounded-lg px-3 text-left text-menu focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                          id === page.id
                            ? 'bg-brand-soft font-medium text-brand'
                            : 'text-muted hover:bg-line hover:text-ink',
                        )}
                      >
                        {target.title}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>

      </aside>

      <div className="flex min-h-0 min-w-0 flex-col" inert={mobileOpen || undefined}>
        <header className={cx('flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-surface','min-h-10 px-3 py-1')}>
          <div className="flex min-w-0 flex-1 items-center gap-3 text-menu text-muted">
            <button
              ref={menuTrigger}
              type="button"
              className="min-h-8 shrink-0 rounded-lg border border-line px-3 font-medium focus-visible:ring-2 focus-visible:ring-brand lg:hidden"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              選單
            </button>
            <span className="min-w-0 truncate font-medium text-ink" title={projectLabel}>{projectLabel}</span>
            <span aria-hidden="true">/</span>
            <span className="shrink-0">{page.group}</span>
          </div>
        </header>

        <main id="main-content" className={cx('min-h-0 flex-1 overflow-y-auto',page.id==='dashboard'?'p-5 lg:p-6':page.id==='api-tests'?'flex flex-col !overflow-hidden p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden':page.id==='agents'?'p-2 lg:flex lg:flex-col':'p-2')}>
          {!['dashboard', 'projects', 'project', 'gitlab', 'api-tests'].includes(page.id) && <div className={cx('flex flex-wrap items-start justify-between gap-5','mb-4',page.id==='agents'&&'shrink-0')}>
            <div>
              <h1 className={cx('font-bold tracking-tight','text-heading')}>{page.title}</h1>
              {page.id!=='api-tests'&&page.subtitle&&<p className="mt-3 max-w-prose text-menu text-muted">{page.subtitle}</p>}
            </div>
            {page.action && page.id !== 'dashboard' && !testingPageIds.includes(page.id) && (
              <Button
                variant="primary"
                disabled={blocked || state.project !== 'Archify Web' || (page.id === 'builder' && !canEdit(state.role))}
                onClick={() => navigate(page.action!.target)}
              >
                {page.action.label}
              </Button>
            )}
          </div>}

          {state.notice && <Notice>{state.notice.replace(/Journey/g, '測試流程')}</Notice>}

          <E2EBatchHost active={page.id === 'e2e-batch' && !blocked && state.project === 'Archify Web'} projectId={testingData.project.id || 'original'} />

          {blocked ? (
            <Notice error>目前角色無權存取此頁面。</Notice>
          ) : state.project !== 'Archify Web' ? (
            <section className="rounded-xl border border-line bg-surface p-8">
              <h2 className="text-section font-bold">這個專案還沒有測試資料</h2>
              <p className="mt-3 text-muted">切回 Archify Web 可查看完整示範。</p>
              <Button className="mt-5" onClick={() => dispatch({ type: 'project', project: 'Archify Web' })}>
                開啟示範專案
              </Button>
            </section>
          ) : testingPageIds.includes(page.id) ? (
            <TestingPages page={page.id} onNavigate={navigate} authoringSession={authoringSession} executionSession={executionSession} />
          ) : isAssistant ? (
            <AssistantWorkspace
              page={page.id}
              canManage={canEdit(state.role)}
              canConfigure={state.role === 'Admin'}
              onNavigate={navigate}
            />
          ) : (
            <PageContent page={page} state={state} dispatch={dispatch} onNavigate={navigate} />
          )}
        </main>
      </div>
    </div></UiDensityContext.Provider>
  );
}


