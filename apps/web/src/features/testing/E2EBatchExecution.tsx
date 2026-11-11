import {useState} from 'react';
import {Field,Input} from '../../components/ui/controls';
import {AndroidFlowExecution} from './AndroidFlowExecution';
import {loadScripts} from './scriptStorage';
export function E2EBatchExecution({projectId}:{projectId:string}){
 const [batchName,setBatchName]=useState('');
 const [manualCommits,setManualCommits]=useState({frontend:'',bff:'',backend:''});
 return <div className="min-w-0 space-y-4"><section aria-label="E2E 批次設定" className="space-y-3"><Field label="批次名稱"><Input value={batchName} placeholder="推薦填入版本號" maxLength={100} onChange={event=>setBatchName(event.target.value)}/></Field><fieldset className="min-w-0 space-y-2"><legend className="text-body font-medium">Git commit（選填）</legend><div className="grid min-w-0 gap-3 md:grid-cols-3">{([['frontend','前端'],['bff','中間層'],['backend','後端']] as const).map(([role,label])=><Field key={role} label={label+' Git commit'}><Input value={manualCommits[role]} maxLength={40} placeholder="完整 commit SHA（選填）" onChange={event=>setManualCommits(current=>({...current,[role]:event.target.value.trim()}))}/></Field>)}</div></fieldset></section><AndroidFlowExecution executionOrigin="e2e-batch" projectId={projectId} cases={loadScripts()} expanded batchMetadata={{name:batchName,manualCommits}}/></div>;
}
