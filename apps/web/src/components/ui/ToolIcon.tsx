export type ToolIconName='refresh'|'send'|'pull'|'save'|'settings'|'chat'|'history'|'plus'|'close'|'trash'|'rename'|'stop'|'info'|'bell';

const paths:Record<ToolIconName,string>={
 bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
 refresh:'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1',
 info:'M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
 send:'m5 3 16 9-16 9 3-9-3-9Zm3 9h13',
 pull:'M19 5 5 19M5 9v10h10',
 save:'M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z',
 chat:'M4 4h16v12H9l-5 4V4Z',
 history:'M3 12a9 9 0 1 0 3-7M3 3v5h5M12 7v5l3 2',
 plus:'M12 5v14M5 12h14',
 close:'m6 6 12 12M6 18 18 6',
 trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
 rename:'m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z',
 stop:'M5 5h14v14H5V5Z',
};

export function ToolIcon({name}:{name:ToolIconName}){
 return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;
}
