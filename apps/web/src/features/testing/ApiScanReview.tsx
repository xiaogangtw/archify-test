import {Button,Field,Input} from '../../components/ui/controls';
import type {ApiScanPreview} from '../../../../../services/control-api/src/apiContracts';

export function ApiScanReview({preview,name,busy,onName,onSave,onDiscard}:{preview:ApiScanPreview;name:string;busy:boolean;onName:(value:string)=>void;onSave:()=>void;onDiscard:()=>void}){
 const labels={added:'新增',removed:'移除',changed:'變更'};
 return <div className="space-y-4">
  <p className="text-menu text-muted">{preview.baselineId?'與目前版本「'+preview.baselineName+'」比對':'首次掃描，尚無比對版本'} · {preview.requestCount} 個接口</p>
  <div className="flex flex-wrap gap-4 text-menu">{(['added','removed','changed'] as const).map(kind=><span key={kind}>{labels[kind]} {preview.changes.filter(change=>change.kind===kind).length}</span>)}</div>
  <section aria-label="掃描變動" className="max-h-96 space-y-2 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
   {!preview.changes.length&&<p className="text-menu text-muted">未發現已解析 API 定義或引用檔案變動。</p>}
   {preview.changes.map(change=><article key={change.requestId} className="space-y-2 rounded-lg border border-line p-3">
    <h3 className="break-words text-body font-medium">{labels[change.kind]} · {change.name}</h3>
    <p className="break-words text-menu text-muted">{change.details.join('；')}</p>
    {change.fields?.map((field,index)=><details key={field.label+index} className="text-menu">
     <summary className="min-h-8 cursor-pointer rounded-lg py-1 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">{field.label}差異</summary>
     <div className="grid min-w-0 gap-3 md:grid-cols-2">
      <div className="min-w-0 space-y-1"><p className="font-medium">原版本</p><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-canvas p-2 font-mono">{field.before||'空白'}</pre></div>
      <div className="min-w-0 space-y-1"><p className="font-medium">掃描結果</p><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-canvas p-2 font-mono">{field.after||'空白'}</pre></div>
     </div>
    </details>)}
   </article>)}
   {!!preview.issues.length&&<details className="text-menu"><summary className="min-h-8 cursor-pointer rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">來源解析問題（{preview.issues.length}）</summary><ul className="list-disc space-y-1 pl-5 text-muted">{preview.issues.map((issue,index)=><li key={index} className="break-words">{issue}</li>)}</ul></details>}
  </section>
  <Field label="版本名稱"><Input autoFocus value={name} maxLength={100} disabled={busy} placeholder="輸入這次掃描的版本名稱" onChange={event=>onName(event.target.value)}/></Field>
  <div className="flex flex-wrap gap-2"><Button variant="primary" disabled={busy||!name.trim()} aria-busy={busy} onClick={onSave}>{busy?'處理中…':'儲存版本'}</Button><Button variant="danger" disabled={busy} onClick={onDiscard}>放棄掃描</Button></div>
 </div>;
}
