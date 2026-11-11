import {ManualCommitDetails} from './ManualCommitDetails';
import {useEffect,useRef,useState} from 'react';
import {Modal} from '../../components/ui/Modal';
import {Badge,Button,Input,Notice} from '../../components/ui/controls';
import {ToolIcon} from '../../components/ui/ToolIcon';
import {api} from './controlApi';
import {stepEvidence,reportTitle,displayTime,executionSummary,outcomeLabels,type QualityReport,type QualityReportSummary} from './executionReportModel';

export function QualityReports({items,onDelete,embedded=false}:{embedded?:boolean;items?:QualityReportSummary[];onDelete?:(version:string)=>void}={}) {
 const [reports,setReports]=useState<QualityReportSummary[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [expanded,setExpanded]=useState<string|null>(null),[details,setDetails]=useState<Record<string,QualityReport>>({});
 const [busy,setBusy]=useState<string|null>(null);
 const [editing,setEditing]=useState<string|null>(null),[name,setName]=useState('');
 const [deleting,setDeleting]=useState<QualityReportSummary|null>(null),[deleteError,setDeleteError]=useState('');
 const [removed,setRemoved]=useState<string[]>([]);
 const deletePending=useRef(false),list=useRef<HTMLDivElement>(null),deleteTrigger=useRef<HTMLButtonElement|null>(null);
 const visible=(items||reports).filter(report=>!removed.includes(report.testVersion));
 function closeDelete(){if(deletePending.current)return;setDeleting(null);setDeleteError('');requestAnimationFrame(()=>deleteTrigger.current?.focus());}
 async function remove(){
  if(!deleting||deletePending.current||!deleting.ready)return;
  deletePending.current=true;setBusy(deleting.testVersion);setDeleteError('');
  try{
   await api('/execution-versions/'+encodeURIComponent(deleting.testVersion),{method:'DELETE'});
   setRemoved(current=>[...current,deleting.testVersion]);setReports(current=>current.filter(report=>report.testVersion!==deleting.testVersion));
   setDetails(current=>{const next={...current};delete next[deleting.testVersion];return next;});
   setExpanded(current=>current===deleting.testVersion?null:current);setEditing(null);setDeleting(null);
   requestAnimationFrame(()=>list.current?.focus());
  }catch(reason){setDeleteError(reason instanceof Error?reason.message:'刪除失敗，請重試。');}
  finally{deletePending.current=false;setBusy(null);}
 }
 useEffect(()=>{if(items)return;let active=true;let pending=false;const load=async()=>{if(pending)return;pending=true;try{const rows=await api<QualityReportSummary[]>('/quality-reports');if(active){setReports(rows);setError('');}}catch(reason){if(active)setError(reason instanceof Error?reason.message:'無法讀取品質報告');}finally{pending=false;if(active)setLoading(false);}};void load();const timer=setInterval(load,5000);return()=>{active=false;clearInterval(timer);};},[!!items]);
 async function rename(report:QualityReportSummary){if(!name.trim()){setError('請填寫報告名稱。');return;}setBusy(report.testVersion);try{await api('/quality-reports/'+encodeURIComponent(report.testVersion),{method:'PATCH',body:JSON.stringify({name:name.trim()})});setReports(current=>current.map(item=>item.testVersion===report.testVersion?{...item,name:name.trim()}:item));setEditing(null);setError('');}catch(reason){setError(reason instanceof Error?reason.message:'改名失敗');}finally{setBusy(null);}}
 async function open(report:QualityReportSummary,download=false) {
  if(!download&&expanded===report.testVersion){setExpanded(null);return;}
  setBusy(report.testVersion);setError('');
  try{const detail=await api<QualityReport>('/quality-reports/'+encodeURIComponent(report.testVersion));setDetails(current=>({...current,[report.testVersion]:detail}));if(download){const {downloadReportPdf}=await import('./reportPdf');await downloadReportPdf(detail);}else setExpanded(report.testVersion);}
  catch(reason){setError(reason instanceof Error?reason.message:'報告產生失敗，請重試。');}finally{setBusy(null);}
 }
 return <div ref={list} tabIndex={-1} className="divide-y divide-line text-report-body focus:outline-none">
  {error&&<Notice error>{error}</Notice>}
  {!visible.length&&!items&&<section className="rounded-xl border border-line bg-surface p-6"><p role="status" className="text-body text-muted">{loading?'正在讀取報告…':error?'暫時無法讀取報告':'批次執行後，這裡會保留品質報告。'}</p></section>}
  {visible.map(report=>{const detail=details[report.testVersion],isOpen=expanded===report.testVersion;return <article key={report.testVersion} className="space-y-3 py-3">
   <div className="flex flex-wrap items-center justify-between gap-3">
    <div className="min-w-0 flex-1 space-y-1"><h2 className="break-words text-body font-medium">{reportTitle(report)} 報告</h2><p className="text-menu text-muted">{embedded && '批次執行 · '}{report.total} 個案例</p>
     <ul aria-label="結果摘要" className="flex flex-wrap gap-x-5 gap-y-2 text-menu">{Object.entries(outcomeLabels).filter(([status])=>report.counts[status as keyof typeof outcomeLabels]>0).map(([status,label])=><li key={status} className={status==='failed'?'text-danger':status==='passed'?'text-success':'text-muted'}>{label} {report.counts[status as keyof typeof outcomeLabels]}</li>)}</ul>
    </div>
    <Badge tone={report.counts.failed?'danger':report.ready&&report.counts.passed?'success':'neutral'}>{!report.ready?'執行中':report.counts.failed?'有失敗':report.counts.passed===report.total?'全部成功':'已結束'}</Badge>
   <div className="flex flex-wrap gap-2"><Button disabled={!report.ready||busy!==null} aria-expanded={isOpen} aria-controls={'report-'+report.testVersion} onClick={()=>void open(report)}>{isOpen?'收起報告':'查看報告'}</Button><Button disabled={!report.ready||busy!==null} aria-busy={busy===report.testVersion} onClick={()=>void open(report,true)}>{busy===report.testVersion?'處理中…':'下載 PDF'}</Button>{!items&&<Button disabled={busy!==null} onClick={()=>{setEditing(report.testVersion);setName(report.name||'批次測試');}}>改名</Button>}{(onDelete||!items)&&<Button variant="danger" disabled={!report.ready||busy!==null} aria-label={'刪除報告 '+reportTitle(report)} onClick={event=>{if(onDelete)onDelete(report.testVersion);else{deleteTrigger.current=event.currentTarget;setDeleteError('');setDeleting(report);}}}><ToolIcon name="trash"/></Button>}</div>
   </div>
   {editing===report.testVersion&&<form className="flex flex-wrap gap-2" onSubmit={event=>{event.preventDefault();void rename(report);}}><Input aria-label="報告名稱" maxLength={100} required disabled={busy!==null} value={name} onChange={event=>setName(event.target.value)}/><Button type="submit" disabled={busy!==null}>儲存名稱</Button><Button disabled={busy!==null} onClick={()=>setEditing(null)}>取消</Button></form>}
   {isOpen&&<p className="break-all text-menu text-muted">測試版本：{report.testVersion} · {displayTime(report.createdAt)}</p>}
   <div id={'report-'+report.testVersion} hidden={!isOpen}>{isOpen&&detail&&<ManualCommitDetails commits={detail.manualCommits||detail.records[0]?.manualCommits}/>}
   {isOpen&&detail&&<ol className="divide-y divide-line">{detail.records.map(record=><li key={record.id} className="space-y-2 py-3"><div className="flex flex-wrap justify-between gap-2"><p className="min-w-0 break-words text-body font-medium">{record.scriptName||record.scriptId}</p><span className={record.status==='failed'?'text-menu text-danger':'text-menu text-muted'}>{outcomeLabels[record.status]}</span></div><p className="whitespace-pre-wrap break-words text-menu text-muted">{executionSummary(record.message)||'沒有補充說明'}</p>{record.status==='failed'&&<div className="space-y-3"><p className="text-menu font-medium">失敗步驟與錯誤</p>{record.events?.some(item=>item.event.status==='failed'||item.event.type==='error')?<ol className="space-y-3">{record.events.filter(item=>item.event.status==='failed'||item.event.type==='error').map(item=><li key={item.sequence} className="min-w-0 space-y-1"><p className="break-words text-menu font-medium">{item.event.title||'執行錯誤'}</p><p className="break-all text-menu text-muted">{stepEvidence(item.event)}</p><p className="whitespace-pre-wrap break-all text-menu text-muted">{item.event.message||'未保存詳細錯誤'}</p></li>)}</ol>:<p className="text-menu text-muted">本次紀錄未保存失敗子步驟；請參考執行摘要。</p>}</div>}</li>)}</ol>}</div>
  </article>;})}
  <Modal compact open={!!deleting} title="刪除報告" onClose={closeDelete}>
   <p className="break-words text-body">確定刪除「{deleting&&reportTitle(deleting)}」及其執行紀錄？測試案例與腳本版本仍會保留。</p>
   {deleteError&&<Notice error>{deleteError}</Notice>}
   <div className="flex flex-wrap gap-2"><Button disabled={deletePending.current} onClick={closeDelete}>取消</Button><Button variant="danger" disabled={busy!==null} aria-busy={deletePending.current} onClick={()=>void remove()}>{deletePending.current?'正在刪除':'刪除報告'}</Button></div>
  </Modal>
 </div>;
}
