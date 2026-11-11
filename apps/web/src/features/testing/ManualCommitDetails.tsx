import type {InlineRun} from './inlineRunModel';
export function ManualCommitDetails({commits}:{commits?:InlineRun['manualCommits']}){
 if(!commits||!Object.values(commits).some(Boolean))return null;
 return <section aria-label="手動填入的 Git commit" className="space-y-2"><p className="text-menu font-medium">手動填入的 Git commit（未核對部署）</p><dl className="space-y-2 text-menu">{([['frontend','前端'],['bff','中間層'],['backend','後端']] as const).map(([role,label])=>commits[role]?<div key={role}><dt className="text-muted">{label}</dt><dd className="break-all font-mono">{commits[role]}</dd></div>:null)}</dl></section>;
}
