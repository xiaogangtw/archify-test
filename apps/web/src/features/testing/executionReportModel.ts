import type {InlineRun,InlineRunStatus} from './inlineRunModel';

export const outcomeLabels:Record<InlineRunStatus,string>={passed:'成功',failed:'失敗',skipped:'略過',cancelled:'已取消',queued:'排隊中',running:'執行中'};
export const activeExecution=(status?:string)=>status==='queued'||status==='running';
export interface ExecutionRecord extends InlineRun {
 recordKind:'run'|'workflow'|'android';
 batchId?:string|null;batchName?:string;batchCreatedAt?:string;
 events?:{sequence:number;event:{path?:string;action?:string;phase?:string;actor?:string;durationMs?:number;type:string;title?:string;message?:string;status?:string}}[];
}
export interface QualityReportSummary {
 manualCommits?:InlineRun['manualCommits'];
 testVersion:string;createdAt:string;total:number;ready:boolean;names:string[];
 batchId?:string;name?:string;
 counts:Record<InlineRunStatus,number>;
}
export interface QualityReport extends QualityReportSummary {records:ExecutionRecord[]}
export const executionPath=(record:ExecutionRecord)=>'/execution-records/'+record.recordKind+'/'+encodeURIComponent(record.id);
export const displayTime=(value?:string|null)=>value?new Date(value).toLocaleString('zh-TW'):'未記錄';
export function reportTitle(report:{name?:string;createdAt:string}){const date=new Date(report.createdAt);const pad=(value:number)=>String(value).padStart(2,'0');return (report.name||'批次測試')+' · '+date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+' '+pad(date.getHours())+':'+pad(date.getMinutes());}
export function executionSummary(message:string){const counts=message.match(/^(\d+) tests, (\d+) failures, (\d+) skipped$/);return counts?`共 ${counts[1]} 個測試，失敗 ${counts[2]} 個，略過 ${counts[3]} 個。`:message;}

export function stepEvidence(event:NonNullable<ExecutionRecord['events']>[number]['event']){return [event.path,event.action,event.actor=== 'sender'?'發送者':event.actor==='receiver'?'接收者':event.actor,typeof event.durationMs==='number'?event.durationMs+' ms':undefined].filter(Boolean).join(' · ');}
