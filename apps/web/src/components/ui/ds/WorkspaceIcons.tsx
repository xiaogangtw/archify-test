export type WorkspaceIconName =
  | 'analysis'
  | 'map'
  | 'flow'
  | 'script'
  | 'report'
  | 'knowledge'
  | 'settings'
  | 'search'
  | 'refresh'
  | 'plus'
  | 'close'
  | 'chevron'
  | 'copy'
  | 'download'
  | 'open'
  | 'folder'
  | 'code'
  | 'edit'
  | 'trash'
  | 'sparkles'
  | 'alert'
  | 'check'
  | 'upload'
  | 'zoom-in'
  | 'zoom-out'
  | 'fit'
  | 'git';

const paths: Record<WorkspaceIconName, string> = {
  analysis: 'M9 3h6M10 3v5l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3',
  map: 'M4 6a2 2 0 1 0 4 0 2 2 0 1 0-4 0Zm12 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0ZM10 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0ZM8 7l3 9M16 7l-3 9M8 6h8',
  flow: 'M5 6h5v4H5V6Zm9 8h5v4h-5v-4ZM10 8h4a2 2 0 0 1 2 2v4',
  script: 'm8 8-4 4 4 4m8-8 4 4-4 4M13 5l-2 14',
  report: 'M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm7 0v4h4M9 13h6M9 17h4',
  knowledge: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v16H6.5A2.5 2.5 0 0 0 4 21.5V5.5Zm0 14A2.5 2.5 0 0 1 6.5 17H19',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm7.4 3a7.5 7.5 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-1.7-1L15 3.5h-4l-.3 2.5a7.5 7.5 0 0 0-1.7 1l-2.3-.9-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9a7.5 7.5 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.5 7.5 0 0 0 1.7-1l2.3.9 2-3.4-2-1.5c.1-.3.1-.7.1-1Z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm10 17-4.4-4.4',
  refresh: 'M20 7v5h-5M4 17v-5h5M6.3 7.5A7 7 0 0 1 18.8 9l1.2 3M4 12l1.2 3a7 7 0 0 0 12.5 1.5',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
  chevron: 'm9 6 6 6-6 6',
  copy: 'M9 9h10v11H9V9Zm-4 6H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1',
  download: 'M12 4v11m-4-4 4 4 4-4M4 19h16',
  open: 'M14 4h6v6M10 14 20 4M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z',
  code: 'm10 8-4 4 4 4m4-8 4 4-4 4',
  edit: 'm15 5 4 4M4 20l4.5-1L19.5 8l-4-4L4.5 15 4 20Z',
  trash: 'M4 6h16M9 6V4h6v2m-8 0 1 14h8l1-14',
  sparkles: 'm12 3 1.8 4.6L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.4L12 3Zm6.5 12 .8 2 .8.3.3.8-.3.8-.8.3-.8 2-.8-2-.8-.3-.3-.8.3-.8.8-.3.8-2Z',
  alert: 'M12 8v5m0 4h.01M10.3 3.9 2.6 17.5a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  check: 'm5 12.5 4.2 4.2L19 7',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3',
  'zoom-in': 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 4v6m-3-3h6m7 10-4.4-4.4',
  'zoom-out': 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm-3 7h6m10 10-4.4-4.4',
  fit: 'M4 9V4h5m6 0h5v5m0 6v5h-5M9 20H4v-5',
  git: 'M7 5a2 2 0 1 0 0 4 2 2 0 1 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 1 0 0-4ZM7 15a2 2 0 1 0 0 4 2 2 0 1 0 0-4ZM7 9v6m10-6c0 4-3 5-10 6',
};

export function WorkspaceIcon({
  name,
  className = 'h-4 w-4',
}: {
  name: WorkspaceIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
