import { listReports, readReport } from './reports.mjs';
import { readFile, writeFile, rename, readdir, lstat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { child, noLinks, makeDirectory } from './paths.mjs';
import { scriptEvidence, intentHash } from '../../test-project/support/script-evidence.mjs';
import { knowledgeStore } from './knowledge.mjs';
import { operationStems } from './naming.mjs';
import { planState, planId } from '../../test-project/support/case-plan.mjs';
const digest = text => createHash('sha256').update(text).digest('hex');
const id = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value);
const text = (value, max = 20000) => typeof value === 'string' && value.length <= max && !value.includes('\0');
const safePart = value => text(value, 500) && !value.includes('\\') && !value.includes(':') && !value.startsWith('/') && !value.split('/').some(p => !p || p.startsWith('.'));
const json = value => JSON.stringify(value, null, 2) + '\n';
export function validateCatalog(value) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.features) || !Array.isArray(value.cases) || value.features.length > 500 || value.cases.length > 2000) throw new Error('案例目錄格式不符。');
  const features = new Set(), cases = new Set();
  for (const row of value.features) {
    if (!row || !id(row.id) || features.has(row.id) || !text(row.name, 200) || !row.name.trim() || !Array.isArray(row.sources) || row.sources.length > 100 || row.sources.some(source => !source || !safePart(source.path) || !/\.(tsx?|jsx?|vue|svelte|gql|graphql)$/.test(source.path) || !Number.isInteger(source.line) || source.line < 1)) throw new Error('功能識別碼、名稱或來源格式不符。');
    features.add(row.id);
    if (row.frontend && (!text(row.frontend.description,2000) || !Array.isArray(row.frontend.pageIds) || row.frontend.pageIds.some(value=>!id(value)) || !Array.isArray(row.frontend.apiIds) || row.frontend.apiIds.some(value=>!text(value,80)) || !Array.isArray(row.frontend.questions) || row.frontend.questions.some(question=>!text(question,2000)) || !['code','inferred'].includes(row.frontend.evidence) || !['active','not-found'].includes(row.frontend.state) || (row.frontend.level !== undefined && (!Number.isInteger(row.frontend.level) || ![1,2,3,4].includes(row.frontend.level))) || (row.frontend.parentId !== undefined && row.frontend.parentId !== null && !id(row.frontend.parentId)))) throw new Error('前端功能 metadata 格式不符。');
  }
  if (value.frontendAnalysis && (!Array.isArray(value.frontendAnalysis.pages) || !Array.isArray(value.frontendAnalysis.routes) || !Array.isArray(value.frontendAnalysis.apis) || !Array.isArray(value.frontendAnalysis.relations) || !value.frontendAnalysis.coverage || !/^[a-f0-9]{64}$/.test(value.frontendAnalysis.sourceHash))) throw new Error('前端功能分析格式不符。');
  if (value.frontendAnalysis) {
    const data=value.frontendAnalysis;
    if (data.pages.length>3000 || data.routes.length>5000 || data.apis.length>5000 || data.pages.some(row=>!row||!id(row.id)||!safePart(row.path)||!Array.isArray(row.routeIds)||!Array.isArray(row.apiIds)) || data.routes.some(row=>!row||!id(row.id)||!text(row.url,2000)||!text(row.title,200)||!safePart(row.component)) || data.apis.some(row=>!row||!text(row.id,80)||!text(row.name,200)||!safePart(row.apiFile)||!row.apiFile.startsWith('api/')||!Array.isArray(row.evidence)||row.evidence.some(source=>!source||!safePart(source.path)||!Number.isInteger(source.line)||source.line<1)) || ['features','pages','totalPages','apis','totalApis','unassignedPages','unassignedApis'].some(key=>!Number.isInteger(data.coverage[key])||data.coverage[key]<0)) throw new Error('前端頁面、API 或覆蓋資料格式不符。');
  }
  for (const row of value.cases) {
    if (!row || !id(row.id) || cases.has(row.id) || !features.has(row.featureId) || !text(row.title, 200) || !row.title.trim() || !['api', 'flow'].includes(row.kind) || !['purpose', 'preconditions', 'data', 'expected'].every(key => text(row[key])) || !Array.isArray(row.knowledgeIds) || row.knowledgeIds.length > 100 || row.knowledgeIds.some(value => !/^[a-f0-9-]{36}$/.test(value)) || !Array.isArray(row.questions) || row.questions.length > 100 || row.questions.some(q => !q || !text(q.text, 2000) || !q.text.trim() || !text(q.answer, 5000)) || (row.script && (!safePart(row.script) || !/^tests\/.+\.spec\.ts$/.test(row.script)))) throw new Error('案例資料、關聯或問題格式不符。');
    cases.add(row.id);
    if ((row.steps !== undefined && (!Array.isArray(row.steps) || row.steps.length > 100 || row.steps.some(step => !step || !text(step.action, 5000) || !text(step.expected, 5000)))) || (row.cleanup !== undefined && !text(row.cleanup)) || (row.target !== undefined && !['api', 'web', 'mobile', 'mixed'].includes(row.target)) || (row.factor !== undefined && !['positive', 'negative', 'boundary', 'security', 'error'].includes(row.factor)) || (row.decisionTable !== undefined && (!Array.isArray(row.decisionTable) || row.decisionTable.length > 100 || row.decisionTable.some(entry => !entry || !text(entry.point, 2000) || !text(entry.input, 2000) || !text(entry.expected, 2000))))) throw new Error('測試步驟、清理、因子、決策矩陣或驗證對象格式不符。');
  }
  if (Buffer.byteLength(json(value)) > 1024 * 1024) throw new Error('案例目錄超過 1 MB。');
  return value;
}

export function catalogStore(config) {
  const path = part => child(config.projectRoot, part);
  async function load() {
    const file = path('test-cases/catalog.json'); await noLinks(file);
    try {
      const stat = await lstat(file); if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('案例目錄過大或非一般檔案。');
      const source = await readFile(file, 'utf8'); return { catalog: validateCatalog(JSON.parse(source)), revision: digest(source) };
    } catch (error) { if (error.code === 'ENOENT') return { catalog: { schemaVersion: 1, features: [], cases: [] }, revision: 'missing' }; throw error; }
  }
  async function scripts() {
    const rows = [], warnings = []; let count = 0;
    async function walk(part) {
      await noLinks(path(part));
      let entries; try { entries = await readdir(path(part), { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
      for (const entry of entries) {
        if (++count > 5000) throw new Error('測試目錄超過 5000 項，請縮小範圍。');
        if (entry.name.startsWith('.')) continue;
        const rel = `${part}/${entry.name}`;
        if (entry.isSymbolicLink()) { warnings.push(`已略過連結：${rel}`); continue; }
        if (entry.isDirectory()) await walk(rel);
        else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
          const evidence = scriptEvidence(config.projectRoot, rel);
          rows.push({ path: rel, ...evidence });
        }
      }
    }
    await walk('tests'); return { rows, warnings };
  }
  async function reports() {
    const rows = [];
    for (const file of await listReports(config)) {
      if (!file.name.split('/').at(-1).startsWith('report-')) continue;
      try {
        const report = await readReport(config, file.name);
        if (report.kind !== 'execution' || !Array.isArray(report.cases) || !Number.isFinite(Date.parse(report.createdAt))) continue;
        // History only needs provenance; release image payloads after each read.
        rows.push({name:file.name,createdAt:report.createdAt,cases:report.cases.map(item=>({
          caseId:item.caseId,source:item.source,status:item.status,sourceHash:item.sourceHash,
          scriptEvidence:item.scriptEvidence,caseEvidence:item.caseEvidence,
        }))});
      } catch { /* A malformed historical file does not replace valid evidence. */ }
    }
    return rows.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  }

  const knowledgeHash = (row, documents) => digest(json(row.knowledgeIds.slice().sort().map(id => [id, documents.find(doc => doc.id === id)?.hash || 'missing'])));
  return {
    load,
    async confirm(input, analysis) {
      if (!planId(input.id)) throw new Error('案例識別碼不合法。');
      const value = await load();
      if (input.revision !== value.revision) throw new Error('案例已被其他工具修改，請重新讀取。');
      const row = value.catalog.cases.find(row => row.id === input.id);
      if (!row) throw new Error('找不到案例。');
      const state = await planState(config.projectRoot, value.catalog, row);
      if (input.fingerprint !== state.fingerprint) throw new Error('案例或知識已變更，請重新讀取再確認。');
      if (state.problems.length) throw new Error(state.problems.join('；'));
      const view = await this.read(analysis);
      if (view.cases.find(item => item.id === input.id).issues.some(issue => issue.type === 'source')) throw new Error('前端來源已變更，請重新分析並核對流程。');
      const directory = path('test-cases/reviews'); await makeDirectory(directory);
      const file = path(`test-cases/reviews/${input.id}.json`); await noLinks(file);
      try { const old = await readFile(file); const backup = path(`legacy/case-reviews/${input.id}-${Date.now()}-${randomUUID()}.json`); await makeDirectory(dirname(backup)); await writeFile(backup, old, { flag: 'wx' }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if ((await load()).revision !== value.revision || (await planState(config.projectRoot, value.catalog, row)).fingerprint !== state.fingerprint) throw new Error('儲存確認前資料已變更，請重新讀取。');
      const temporary = file + '.' + randomUUID() + '.tmp';
      await writeFile(temporary, json({ schemaVersion: 1, caseId: input.id, fingerprint: state.fingerprint, confirmedAt: new Date().toISOString() }), { flag: 'wx' }); await rename(temporary, file);
      return { confirmed: true };
    },
    async source(scope, part) {
      if (!['source', 'project'].includes(scope) || !safePart(part) || !/\.(tsx?|jsx?|[cm]?[jt]s|vue|svelte|gql|graphql)$/.test(part) || /(?:^|\/)(node_modules|dist|build|coverage|legacy)(?:\/|$)/.test(part) || /secret|credential|private[-_]?key/i.test(part)) throw new Error('只能預覽專案範圍內的程式碼。');
      if (scope === 'project' && !/^(tests|api)\//.test(part)) throw new Error('僅預覽 API 或測試腳本。');
      const file = child(scope === 'source' ? config.sourceRoot : config.projectRoot, part); await noLinks(file);
      const stat = await lstat(file); if (!stat.isFile() || stat.size > 128 * 1024) throw new Error('來源超過預覽上限 128 KB 或非一般檔案。');
      return { path: part, content: await readFile(file, 'utf8') };
    },
    async save(input) {
      const old = await load();
      if (input.revision !== old.revision) throw new Error('案例已被其他工具修改，請重新讀取再儲存。');
      const next = validateCatalog(input.catalog);
      const knowledge = await knowledgeStore(config).list();
      for (const feature of next.features) for (const source of feature.sources) if (!source.hash) {
        const file = child(config.sourceRoot, source.path); await noLinks(file);
        try { const stat = await lstat(file); source.hash = stat.isFile() && stat.size <= 1024 * 1024 ? digest(await readFile(file)) : 'unavailable'; }
        catch (error) { if (error.code === 'ENOENT') source.hash = 'missing'; else throw error; }
      }
      for (const row of next.cases) {
        const previous = old.catalog.cases.find(item => item.id === row.id);
        // Only an edited intent acknowledges its current references; unrelated edits do not clear review flags.
        if (!previous || json({ ...previous, knowledgeHash: undefined }) !== json({ ...row, knowledgeHash: undefined })) row.knowledgeHash = knowledgeHash(row, knowledge.documents);
        else row.knowledgeHash = previous.knowledgeHash;
      }
      const file = path('test-cases/catalog.json'); await makeDirectory(dirname(file));
      if (old.revision !== 'missing') {
        const backup = path(`legacy/test-cases/${Date.now()}-${randomUUID()}.json`); await makeDirectory(dirname(backup));
        await writeFile(backup, await readFile(file), { flag: 'wx' });
      }
      if ((await load()).revision !== old.revision) throw new Error('案例在儲存前已變更，請重新讀取。');
      const temporary = file + '.' + randomUUID() + '.tmp';
      await writeFile(temporary, json(next), { flag: 'wx' }); await rename(temporary, file);
      return load();
    },
    async read(analysis) {
      const value = await load();
      const [{ rows: allScripts, warnings }, knowledge, history] = await Promise.all([scripts(), knowledgeStore(config).list(), reports()]);
      if (analysis && value.catalog.frontendAnalysis && analysis.sourceHash !== value.catalog.frontendAnalysis.sourceHash) warnings.push('前端分析已更新，功能總覽尚未依這份來源重新整理。');
      const stems = operationStems(analysis?.requests || []);
      const apiByFile = new Map((analysis?.requests || []).map(item => [`api/${stems.get(item.id)}.ts`, item]));
      const scannedHashes = new Map((Array.isArray(analysis?.sourceFiles) ? analysis.sourceFiles : []).filter(row => row && safePart(row.path) && /^[a-f0-9]{64}$/.test(row.hash)).map(row => [row.path, row.hash]));
      const sourceState = new Map();
      for (const item of analysis?.requests || []) for (const source of item.evidence || []) {
        if (sourceState.has(source.path)) continue;
        if (!safePart(source.path) || !scannedHashes.has(source.path)) { sourceState.set(source.path, 'unknown'); continue; }
        const file = child(config.sourceRoot, source.path); await noLinks(file);
        try { const stat = await lstat(file); sourceState.set(source.path, stat.isFile() && stat.size <= 1024 * 1024 && digest(await readFile(file)) === scannedHashes.get(source.path) ? 'current' : 'changed'); }
        catch (error) { if (error.code === 'ENOENT') sourceState.set(source.path, 'missing'); else throw error; }
      }
      const sourceIssues = new Map();
      for (const feature of value.catalog.features) {
        const notes = [];
        for (const source of feature.sources) {
          const file = child(config.sourceRoot, source.path); await noLinks(file);
          try { const stat = await lstat(file); if (!stat.isFile() || stat.size > 1024 * 1024 || source.hash !== digest(await readFile(file))) notes.push({ type: 'source', text: `功能來源已變更或尚未建立基準：${source.path}` }); }
          catch (error) { if (error.code === 'ENOENT') notes.push({ type: 'source', text: `功能來源已遺失：${source.path}` }); else throw error; }
        }
        sourceIssues.set(feature.id, notes);
      }
      const cases = await Promise.all(value.catalog.cases.map(async row => {
        const matches = allScripts.filter(script => script.caseIds.includes(row.id) || (row.script && script.path === row.script));
        const script = matches.length === 1 ? matches[0] : undefined;
        const issues = row.questions.filter(question => !question.answer.trim()).map(question => ({ type: 'question', text: question.text }));
        issues.push(...(sourceIssues.get(row.featureId) || []));
        if (!row.expected.trim()) issues.push({ type: 'expected', text: '缺少明確預期結果' });
        if (!matches.length) issues.push({ type: 'script', text: '尚未連結測試腳本' });
        if (matches.length > 1) issues.push({ type: 'duplicate', text: '同一案例連到多份腳本，請核對識別碼' });
        if (script && script.caseIds.length && !script.caseIds.includes(row.id)) issues.push({ type: 'identity', text: '腳本宣告的案例編號與連結不同' });
        if (row.knowledgeHash && row.knowledgeHash !== knowledgeHash(row, knowledge.documents)) issues.push({ type: 'knowledge', text: '相關知識已變更，請核對案例預期與腳本' });
        if (row.knowledgeIds.length && !row.knowledgeHash) issues.push({ type: 'knowledge', text: '知識關聯尚無核對基準，請核對後儲存案例' });
        for (const id of row.knowledgeIds) if (!knowledge.documents.some(doc => doc.id === id && doc.hash !== 'missing')) issues.push({ type: 'knowledge', text: '關聯知識已封存或遺失' });
        const linkedApis = script ? script.apiFiles.map(file => ({ path: file, name: file.slice(4, -3), evidence: apiByFile.get(file)?.evidence || [], inAnalysis: apiByFile.has(file) })) : [];
        if (script && analysis && linkedApis.some(api => !api.inAnalysis)) issues.push({ type: 'source', text: '部分 API 未出現在目前分析，請核對來源或重新分析' });
        if (linkedApis.some(api => api.evidence.some(source => ['changed', 'missing'].includes(sourceState.get(source.path))))) issues.push({ type: 'source', text: '相關前端來源在上次分析後已變更，請重新分析並核對腳本' });
        if (linkedApis.some(api => api.evidence.some(source => sourceState.get(source.path) === 'unknown'))) issues.push({ type: 'source', text: '來源分析尚無逐檔版本證據，請重新分析' });
        if (script && analysis && linkedApis.some(api => {
          const item = apiByFile.get(api.path);
          return item && script.apiContracts[api.path] && script.apiContracts[api.path] !== digest(JSON.stringify([item.kind, item.method, item.endpoint, item.body?.operationName || '', (item.body?.query || '').replace(/\s+/g, ' ').trim()]));
        })) issues.push({ type: 'source', text: '前端分析與 API 模組的請求契約不同，請核對 query、方法或端點' });
        if (script && !script.complete) issues.push({ type: 'dependency', text: '含無法完整追蹤的相對／動態依賴' });
        const candidates = history.flatMap(report => report.cases.filter(item => item && ['passed', 'failed', 'skipped'].includes(item.status) && (item.caseId === row.id || (script && item.source === script.path && (!item.caseId || item.caseId === row.id)))).map(item => ({ report: report.name, createdAt: report.createdAt, status: item.status, evidence: item.scriptEvidence, caseEvidence: item.caseEvidence, sourceHash: item.sourceHash })));
        const latest = candidates[0];
        if (latest?.caseEvidence && latest.caseEvidence.intentHash !== intentHash(row)) issues.push({ type: 'intent', text: '案例意圖在上次執行後更新，請核對腳本並重新驗證' });
        if (latest?.caseEvidence && latest.caseEvidence.knowledgeHash !== knowledgeHash(row, knowledge.documents)) issues.push({ type: 'knowledge-run', text: '業務依據在上次執行後更新，舊結果未驗證新規則' });
        const freshness = !latest ? 'never' : !script || !latest.evidence?.complete || !script.complete || !latest.caseEvidence?.complete ? 'unknown' : latest.evidence.hash === script.hash && latest.caseEvidence.intentHash === intentHash(row) && latest.caseEvidence.knowledgeHash === knowledgeHash(row, knowledge.documents) ? 'current' : 'changed';
        const review = await planState(config.projectRoot, value.catalog, row);
        if (issues.some(issue => issue.type === 'source')) { review.problems.push('前端來源需要重新核對'); review.status = review.confirmedAt ? 'changed' : 'incomplete'; }
        return { ...row, review, issues, script: script?.path || row.script || '', scripts: matches.map(item => item.path), declaredSteps: script?.steps || [], apis: linkedApis, latest: latest ? { report: latest.report, createdAt: latest.createdAt, status: latest.status } : null, freshness };
      }));
      const linked = new Set(cases.flatMap(row => row.scripts));
      return { ...value, cases, scripts: allScripts.map(script => ({ path: script.path, caseIds: script.caseIds })), unlinkedScripts: allScripts.filter(script => !linked.has(script.path)).map(script => script.path), knowledge: knowledge.documents, warnings, analysisAvailable: !!analysis };
    }
  };
}
