export type Status = 'not-run' | 'passed' | 'failed' | 'skipped';
export interface Diagnostic {code:string;message:string;operation?:string;timeoutMs?:number;pageErrors?:number;requestFailures?:number;httpErrors?:number}
export interface Step { name: string; expected: string; actual?:string; diagnostic?:Diagnostic; status: Status; error?: string; durationMs?: number }
export interface Case { scenarioSteps?:{action:string;expected:string}[]; id: string; name: string; purpose: string; expected?:string;actual?:string;preconditions?:string; source: string; sourceHash: string; status: Status; steps: Step[]; durationMs?: number; target?:'api'|'web'|'android';dataMode?:'liff-mock-real-api'|'mocked'|'unspecified';responses?:{status:number;body:unknown}[];screenshots?:{caption:string;data:string;expected?:string;actual?:string;diagnostic?:Diagnostic}[];cleanup?: { status: 'passed' | 'failed'; error?: string } }
export interface Report { schemaVersion: 1; kind: 'flow' | 'execution'; project: string; runId: string; createdAt: string; cases: Case[];testType?:'api'|'ui';screenshotsEnabled?:boolean; volume?:{index:number;total:number};volumes?:string[] }
const statuses = ['not-run', 'passed', 'failed', 'skipped'];
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function text(value: unknown,max=20000): value is string { return typeof value === 'string' && value.length <= max; }
function duration(value: unknown) { return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0); }
function narrative(value:Record<string,unknown>){
 if(['expected','actual','preconditions'].some(key=>value[key]!==undefined&&!text(value[key])))return false;
 const d=value.diagnostic;if(d===undefined)return true;
 return object(d)&&['UI_NOT_READY','RESPONSE_TIMEOUT','NAVIGATION_TIMEOUT','ACTION_TIMEOUT','ASSERTION_FAILED','PAGE_RUNTIME_ERROR','NETWORK_FAILURE','EVIDENCE_INCOMPLETE','UNKNOWN_FAILURE'].includes(String(d.code))&&text(d.message)&&
 (d.operation===undefined||text(d.operation,80)&&/^[A-Z][A-Za-z0-9_]{1,79}$/.test(d.operation))&&['timeoutMs','pageErrors','requestFailures','httpErrors'].every(key=>d[key]===undefined||Number.isSafeInteger(d[key])&&Number(d[key])>=0);
}
export function parseReport(source: string): Report {
  const value: unknown = JSON.parse(source);
  const reject = (): never => { throw new Error('格式不相容。請使用測試專案產生的 schemaVersion 1 流程或執行報告。'); };
  if (!object(value) || value.schemaVersion !== 1 || !['flow', 'execution'].includes(String(value.kind)) ||
    !text(value.project) || !text(value.runId) || !text(value.createdAt) || !Number.isFinite(Date.parse(value.createdAt)) ||
    !Array.isArray(value.cases) || value.cases.length > 100000) return reject();
  const ids = new Set();
  if(value.volume!==undefined&&(!object(value.volume)||!Number.isSafeInteger(value.volume.index)||!Number.isSafeInteger(value.volume.total)||Number(value.volume.index)<1||Number(value.volume.total)>10000||Number(value.volume.index)>Number(value.volume.total)))return reject();
  if(value.volumes!==undefined&&(!Array.isArray(value.volumes)||value.volumes.length>10000||value.volumes.some(name=>typeof name!=='string'||!/^(report|flow)-[a-zA-Z0-9_-]+\.html$/.test(name))))return reject();
  for (const item of value.cases) {
    if (!object(item) || !text(item.id) || !item.id || ids.has(item.id) || !text(item.name) || !text(item.purpose) ||
      !text(item.source) || !text(item.sourceHash) || !/^[a-f0-9]{64}$/.test(item.sourceHash) || !statuses.includes(String(item.status)) ||
      !duration(item.durationMs) || !Array.isArray(item.steps) || !item.steps.length || item.steps.length > 100000) return reject();
    ids.add(item.id);
    if(item.scenarioSteps!==undefined&&(!Array.isArray(item.scenarioSteps)||item.scenarioSteps.length>100000||item.scenarioSteps.some(step=>!object(step)||!text(step.action)||!text(step.expected))))return reject();
    if(!narrative(item)||item.steps.some(step=>!object(step)||!narrative(step)))return reject();
    if(item.responses!==undefined&&(!Array.isArray(item.responses)||item.responses.length>100000||item.responses.some(response=>!object(response)||!Number.isInteger(response.status)||Number(response.status)<100||Number(response.status)>599)))return reject();
    if(item.target!==undefined&&!['api','web','android'].includes(String(item.target))||item.dataMode!==undefined&&!['liff-mock-real-api','mocked','unspecified'].includes(String(item.dataMode)))return reject();
    if(item.screenshots!==undefined){if(!Array.isArray(item.screenshots)||item.screenshots.length>100000)return reject();for(const image of item.screenshots){if(!object(image)||!narrative(image)||!text(image.caption,200)||typeof image.data!=='string'||image.data.length>2800000||image.data.length<32||image.data.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(image.data))return reject();try{const prefix=atob(image.data.slice(0,32));if([...prefix.slice(0,8)].map(char=>char.charCodeAt(0).toString(16).padStart(2,'0')).join('')!=='89504e470d0a1a0a'||prefix.slice(12,16)!=='IHDR')return reject();const width=[...prefix.slice(16,20)].reduce((n,char)=>n*256+char.charCodeAt(0),0),height=[...prefix.slice(20,24)].reduce((n,char)=>n*256+char.charCodeAt(0),0);if(!width||!height||width>12000||height>12000||width*height>40000000)return reject();}catch{return reject();}}}
    for (const step of item.steps) {
      if (!object(step) || !text(step.name) || !text(step.expected) || !statuses.includes(String(step.status)) ||
        !duration(step.durationMs) || (step.error !== undefined && !text(step.error))) return reject();
    }
    if (item.cleanup !== undefined && (!object(item.cleanup) || !['passed', 'failed'].includes(String(item.cleanup.status)) ||
      (item.cleanup.error !== undefined && !text(item.cleanup.error)))) return reject();
    if (value.kind === 'flow' && (item.status !== 'not-run' || item.steps.some(step => step.status !== 'not-run') || item.cleanup !== undefined)) return reject();
    if (value.kind === 'execution' && (!['passed', 'failed', 'skipped'].includes(String(item.status)) || item.steps.some(step => step.status === 'not-run') ||
      (item.status === 'skipped' && (item.steps.some(step => step.status === 'failed') || !item.steps.some(step => step.status === 'skipped'))) ||
      (item.status === 'passed' && item.steps.some(step => step.status !== 'passed')) ||
      (item.status === 'failed' && !item.steps.some(step => step.status === 'failed') && !(object(item.cleanup) && item.cleanup.status === 'failed')))) return reject();
  }
  if(value.testType!==undefined&&!['api','ui'].includes(String(value.testType))||value.screenshotsEnabled!==undefined&&typeof value.screenshotsEnabled!=='boolean')return reject();
  return value as unknown as Report;
}
export function caseCategory(item:Case,report?:Report):'api'|'ui'{return item.target?item.target==='api'?'api':'ui':report?.testType||(/^tests\/(ui|web|mobile)\//.test(item.source)?'ui':'api');}
export const labels: Record<Status, string> = { 'not-run': '未執行', passed: '通過', failed: '失敗', skipped: '略過' };
