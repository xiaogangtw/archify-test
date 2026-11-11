import { readFileSync, mkdirSync, writeFileSync, existsSync, renameSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { reportBasename } from '../framework/report-name.mjs';
import { renderHtml } from '../framework/html.mjs';
import { reportOptions, reportPath, caseTarget, pngBuffer } from './report-options.mjs';
import { fileURLToPath } from 'node:url';
import { scriptEvidence, caseEvidence } from './script-evidence.mjs';
import { MAX_REPORT_BYTES } from '../framework/report-document.mjs';
import { caseActual } from '../framework/case-narrative.mjs';
import { safeDiagnostic } from './ui-diagnostics.mjs';

const safeError = '測試未通過，請於本機檢查斷言、資料或環境；報告不保存原始例外，回應僅顯示已附加的遮蔽預覽。';
export default class ArchifyReporter {
  constructor() { this.records = new Map(); this.runId = randomUUID(); this.createdAt = new Date().toISOString(); this.errors = 0; this.root = fileURLToPath(new URL('../', import.meta.url)); this.config = {}; }
  onBegin(config, suite) {
    this.root = dirname(config.configFile); this.config = {};
    const file = resolve(this.root, 'archify.config.json');
    if (existsSync(file)) this.config = JSON.parse(readFileSync(file, 'utf8'));
    this.options = reportOptions(this.root);
    for (const test of suite.allTests()) {
      let id = test.annotations.find(row => row.type === 'archify-id')?.description || test.id;
      if ([...this.records.values()].some(item => item.id === id)) id += '-' + test.id.slice(0, 8);
      const declaration = test.annotations.find(row => row.type === 'archify-plan')?.description;
      let names = ['測試內容（尚未執行）'];
      if (declaration) try { const value = JSON.parse(declaration); if (Array.isArray(value) && value.length && value.every(item => typeof item === 'string')) names = value; } catch {}
      const source = relative(this.root, test.location.file).replaceAll('\\', '/');
      const evidence = scriptEvidence(this.root, source);
      const intent = caseEvidence(this.root, source, test.annotations.find(row => row.type === 'archify-case')?.description);
      let plan;
      try { const catalog = JSON.parse(readFileSync(resolve(this.root, 'test-cases/catalog.json'), 'utf8')); const declaredId=test.annotations.find(row=>row.type==='archify-case')?.description;const matches=catalog.cases.filter(row=>declaredId?row.id===declaredId:row.script===source);plan=matches.length===1?matches[0]:undefined; } catch {}
      this.records.set(test.id, { id, name: test.title, purpose: typeof plan?.purpose==='string' ? plan.purpose : '未提供結構化案例目的；本報告僅記錄實際執行證據。', source,
        target: caseTarget(source), dataMode: ['liff-mock-real-api','mocked'].includes(test.annotations.find(row=>row.type==='archify-data-mode')?.description)?test.annotations.find(row=>row.type==='archify-data-mode').description:'unspecified', sourceHash: createHash('sha256').update(readFileSync(test.location.file)).digest('hex'), scriptEvidence: evidence,
        caseEvidence: intent, caseId: intent?.caseId || test.annotations.find(row => row.type === 'archify-case')?.description, status: 'not-run', actual:'尚未執行。',
        expected: typeof plan?.expected === 'string' ? plan.expected : '未提供結構化案例預期；請在 catalog 補齊。',
        preconditions: typeof plan?.preconditions === 'string' ? plan.preconditions : Array.isArray(plan?.preconditions) ? plan.preconditions.filter(item=>typeof item==='string').join('；') : undefined,
        plannedSteps: Array.isArray(plan?.steps) ? plan.steps.filter(row=>typeof row.action==='string'&&typeof row.expected==='string') : [],
        steps: names.map(name => ({ name, expected: plan?.steps?.find(row=>row.action===name)?.expected || '尚未執行；未提供此步驟的結構化預期。', status: 'not-run' })) });
    }
  }
  onTestBegin(test) { console.log('開始案例：' + test.title); }
  onStepBegin(test, result, step) { if (step.category === 'test.step') console.log('開始步驟：' + step.title); }
  onStepEnd(test, result, step) { if (step.category === 'test.step') console.log((step.error ? '步驟失敗：' : '步驟完成：') + step.title); }
  onError() { this.errors++; console.log('執行環境錯誤：請核對本機設定；不輸出原始例外。'); }
  onStdOut(chunk) { process.stdout.write(chunk); }
  onTestEnd(test, result) {
    const record = this.records.get(test.id);
    record.status = result.status === 'passed' ? 'passed' : result.status === 'skipped' ? 'skipped' : 'failed';
    record.durationMs = result.duration;
    const pending = (result.attachments || []).find(item => item.name === '待核對清理' && item.body);
    if (pending) {
      let ids = [];
      try { const rows = JSON.parse(pending.body.toString('utf8')); if (Array.isArray(rows)) ids = rows.map(row => row.accountId).filter(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id)).slice(0, 100); } catch {}
      record.cleanup = { status: 'failed', error: '清理提醒：帳號刪除未確認，需人工追蹤。本輪帳號：' + (ids.join('、') || '未取得可安全列出的識別碼') };
    }
    record.responses = (result.attachments || []).filter(item => item.name === 'archify-response' && item.contentType === 'application/json' && item.body).flatMap(item => {
      try { return [JSON.parse(item.body.toString('utf8'))]; } catch { return []; }
    });
    if(this.options.screenshots && record.target !== 'api') {
      const images=(result.attachments||[]).filter(item=>item.name.startsWith('archify-screenshot:') && item.contentType==='image/png' && item.body);
      record.screenshots=images.map(item=>({caption:item.name.slice('archify-screenshot:'.length, 'archify-screenshot:'.length+200),data:pngBuffer(item.body).toString('base64')}));
    }
    const collect = rows => rows.flatMap(step => [...(step.category === 'test.step' ? [step] : []), ...collect(step.steps || [])]);
    const steps = collect(result.steps || []);
    const details = new Map((result.attachments || []).filter(item=>item.name==='archify-step-detail'&&item.body).flatMap(item=>{
      try { const row=JSON.parse(item.body.toString('utf8')); return typeof row.name==='string'&&typeof row.expected==='string'&&typeof row.actual==='string' ? [[row.name,row]] : []; } catch { return []; }
    }));
    record.steps = steps.length ? steps.map(step => {
      const detail=details.get(step.title);
      const nestedDiagnostic=step.error ? collect(step.steps||[]).map(child=>details.get(child.title)?.diagnostic).find(Boolean) : undefined;
      const diagnosticSource=detail?.diagnostic||nestedDiagnostic;
      const diagnostic=diagnosticSource ? safeDiagnostic({archifyDiagnostic:diagnosticSource}) : step.error ? safeDiagnostic(step.error) : undefined;
      return { name: step.title, expected: detail?.expected || record.plannedSteps?.find(row=>row.action===step.title)?.expected || (step.title.startsWith('前置') ? record.preconditions : undefined) || '未提供此步驟的結構化預期；不能由通過狀態反推。',
        actual: detail?.actual || (step.error ? diagnostic.message : '此步驟已結束。'), status: step.error ? (record.status === 'skipped' ? 'skipped' : 'failed') : 'passed', durationMs: step.duration,
        ...(diagnostic ? { diagnostic, error: diagnostic.message } : {}) };
    }) : [{ name: record.status === 'skipped' ? '草稿或條件未符合，未執行' : '測試準備', expected: record.expected || '正常載入並執行測試', status: record.status, ...(record.status === 'failed' ? { diagnostic: safeDiagnostic(result.error), error: safeDiagnostic(result.error).message } : {}) }];
    if ((result.attachments || []).some(item => item.name === 'archify-evidence-error')) {
      this.evidenceErrors = true;
      record.status = 'failed';
      record.steps.push({ name: '逐步畫面證據', expected: '每個已執行操作都有證據', status: 'failed', error: '逐步截圖失敗，證據不完整。' });
    }
    if (record.status === 'skipped' && !record.steps.some(step => step.status === 'skipped')) record.steps.push({ name: '案例略過，後續未執行', expected: '完成全部預期', status: 'skipped' });
    if (record.status === 'failed' && !record.steps.some(step => step.status === 'failed')) record.steps.push({ name: '測試結束檢查', expected: '測試正常完成', status: 'failed', error: safeError });
    const observation = (result.attachments || []).find(item => item.name === 'archify-case-result' && item.contentType === 'text/plain' && item.body && item.body.length <= 20000)?.body.toString('utf8');
    record.actual = caseActual(record, observation);
    if(record.screenshots) record.screenshots=record.screenshots.map(image=>{
      const step=record.steps.find(step=>image.caption.startsWith(step.name+'｜'));
      return step ? {...image,expected:step.expected,actual:step.actual,...(step.diagnostic?{diagnostic:step.diagnostic}:{})} : image;
    });
    record.scenarioSteps = record.plannedSteps;
    delete record.plannedSteps;
    console.log(`${record.status} ${record.name}`);
    if (process.env.ARCHIFY_REPORT_MODE !== 'flow') this.writeReports(
      [...this.records.values()].filter(item => item.status !== 'not-run').map(item => ({ ...item,
        purpose: '執行中快照：僅含已結束案例，整批尚未完成。' + item.purpose })), false, 'running');
  }
  onEnd(result) {
    const flow = process.env.ARCHIFY_REPORT_MODE === 'flow';
    const cases = [...this.records.values()];
    for (const record of cases) {
      const current = scriptEvidence(this.root, record.source);
      if (current.hash !== record.scriptEvidence?.hash) { record.scriptEvidence.complete = false; record.scriptEvidence.issues.push('執行期間檔案已變更，需重新執行'); }
      const intent = caseEvidence(this.root, record.source, record.caseId);
      if (record.caseEvidence && JSON.stringify(intent) !== JSON.stringify(record.caseEvidence)) record.caseEvidence.complete = false;
    }
    if (!flow) for (const item of cases) if (item.status === 'not-run') { item.status = 'skipped'; item.steps.forEach(step => { step.status = 'skipped'; }); }
    if (this.errors || (result.status !== 'passed' && !cases.some(item => item.status === 'failed'))) {
      cases.push({ id: 'RUN-ERROR-' + this.runId, name: '測試啟動或執行環境錯誤', purpose: '沒有產品通過證據', source: 'playwright.config.ts', target: ['web','android'].includes(process.env.ARCHIFY_TEST_TARGET)?process.env.ARCHIFY_TEST_TARGET:'api', sourceHash: createHash('sha256').update(readFileSync(resolve(this.root, 'playwright.config.ts'))).digest('hex'), status: flow ? 'not-run' : 'failed', steps: [{ name: '檢查執行環境', expected: '正常載入案例', status: flow ? 'not-run' : 'failed', ...(flow ? {} : { error: safeError }) }] });
    }
    this.writeReports(cases, flow, result.status === 'interrupted' ? 'interrupted' : 'finished');
    if (this.evidenceErrors) return { status: 'failed' };
  }
  writeReports(cases, flow, runStatus) {
    const groups = new Map();
    for(const record of cases){const type=record.target==='api'?'api':'ui';if(!groups.has(type))groups.set(type,[]);groups.get(type).push(record);}
    for(const [testType,items]of groups){
      const report={schemaVersion:1,runStatus,kind:flow?'flow':'execution',testType,screenshotsEnabled:!flow && testType==='ui' && this.options.screenshots,project:this.config.project||'Playwright 測試專案',runId:this.runId,createdAt:this.createdAt,cases:items};
      const part=this.config.reportDir||'reports';const directory=reportPath(this.root,part+'/'+testType);mkdirSync(directory,{recursive:true});
      const name=reportBasename(report.kind,report.createdAt,report.runId);
      const content = renderHtml(report);
      if(Buffer.byteLength(content)>MAX_REPORT_BYTES)throw new Error('單檔報告超過512MB容量上限；未丟棄證據，請將大量資料案例分批執行。');
        const target = resolve(directory, name + '.html');
        const temporary = target + '.tmp';
        writeFileSync(temporary, content);
        renameSync(temporary, target);
      console.log('報告：'+testType+'/'+name+'.html（同一次執行持續更新同一份檔案）');
    }
  }
}
