import { listReports, readReport } from './reports.mjs';
import {cloneSource} from './clone-source.mjs';
import { scriptInventory } from './script-inventory.mjs';
import { readdir, readFile, writeFile, lstat, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { child, noLinks, makeDirectory } from './paths.mjs';
import { scanSource } from './scan.mjs';
import { operationStems, legacyOperationStems, operationTitle, artifactNames } from './naming.mjs';
import { apiModuleSource, apiTestSource } from './api-source.mjs';
import { isReportFilename } from '../../test-project/framework/report-name.mjs';
import { knowledgeStore } from './knowledge.mjs';
import { pickDirectory } from './directory-picker.mjs';
import { setupConfig, validateSource, persistSetup, ensureEnvIgnored } from './setup.mjs';
import { scriptSync } from './script-sync.mjs';
import { catalogStore } from './catalog.mjs';
import { prepareUploads } from './knowledge-upload.mjs';
import { analyzeKnowledgeUploads } from './knowledge-analysis.mjs';
import { frontendFeatureStore } from './frontend-features.mjs';
import { aiJobs } from './ai-jobs.mjs';
import { featureAiPrompt, saveFeatureAiResult } from './ai-analysis.mjs';
import { readReportSettings } from '../../test-project/support/report-options.mjs';
import { createAndroidHost } from './android-host.mjs';
import { frontendSnapshot } from '../../test-project/support/frontend-snapshot.mjs';

const template = fileURLToPath(new URL('../../test-project/', import.meta.url));
const json = value => JSON.stringify(value, null, 2) + '\n';
export function createWorkspace(config, options = {}) {
  let current;
  const sourceScanCache={};
  let removalPlan;
  const sync = scriptSync(config);
  const jobs = aiJobs(options.aiRunner ? {runner:options.aiRunner} : {});
  const android=options.androidHost||createAndroidHost(config,options.androidOptions);
  let pending = 0;
  let operationTail = Promise.resolve();
  let analysisRead;
  let activePicker;
  const required = () => {
    if (!config.sourceRoot || !config.projectRoot) throw new Error('請先使用初始設定選擇前端與獨立測試專案。');
  };
  async function exclusive(action, wait = false) {
    if (pending && !wait) throw new Error('另一項檔案操作進行中，請稍後再試。');
    if (!wait && activePicker) activePicker.abort();
    const previous = operationTail;
    let release;
    operationTail = new Promise(resolve => { release = resolve; });
    pending++;
    await previous;
    try { return await action(); } finally { pending--; release(); }
  }
  async function ready() {
    required(); await noLinks(config.projectRoot);
    let marker;
    try { const path = child(config.projectRoot, 'archify.config.json'); await noLinks(path); marker = JSON.parse(await readFile(path, 'utf8')); }
    catch { throw new Error('請先初始化獨立測試專案。既有檔案不會被覆寫。'); }
    if (![1, 2].includes(marker.schemaVersion)) throw new Error('測試專案格式不相容。');
    return marker;
  }
  function output(part = config.apiDir) {
    const normalized = part.replaceAll('\\', '/');
    if (!/^tests\/[a-zA-Z0-9_\-/]+$/.test(normalized) || normalized.split('/').some(value => !value)) throw new Error('腳本位置請填 tests/ 下的相對資料夾，僅使用英數、連字號、底線與斜線。');
    return child(config.projectRoot, normalized);
  }
  async function createFile(path, contents) {
    await noLinks(path);
    await makeDirectory(join(path, '..'));
    try { await writeFile(path, contents, { flag: 'wx' }); return true; }
    catch (error) { if (error.code === 'EEXIST') return false; throw error; }
  }
  async function withExisting(record) {
    const directory = output(record.apiDir), existingIds = [];
    const stems = operationStems(record.requests);
    const legacyStems = legacyOperationStems(record.requests);
    for (const item of record.requests) {
      for (const part of [`${record.apiDir}/${stems.get(item.id)}.spec.ts`, `${record.apiDir}/${legacyStems.get(item.id)}.spec.ts`, ...artifactNames(record.apiDir, item.id, stems.get(item.id)), ...artifactNames(record.apiDir, item.id, legacyStems.get(item.id)), ...artifactNames(record.apiDir, item.id, item.id)]) {
        const path = child(config.projectRoot, part);
        await noLinks(path);
        try { await lstat(path); existingIds.push(item.id); break; }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    }
    return { ...record, existingIds, requests: record.requests.map(item => ({ ...item, name: operationTitle(item), caseFile: `${record.apiDir}/${stems.get(item.id)}.spec.ts` })) };
  }
  async function present(record) {
    removalPlan = await sync.preview(record);
    return { ...await withExisting(record), removed: removalPlan.removed.map(({ hash, ...row }) => row), removalNotice: removalPlan.notice };
  }
  return {
    async scripts() { return exclusive(async () => { await ready(); return scriptInventory(config); }, true); },
    async reportSettings(){await ready();return readReportSettings(config.projectRoot);},
    async saveReportSettings(input){return exclusive(async()=>{
      await ready();const current=readReportSettings(config.projectRoot),next={...current};
      if(input.screenshots!==undefined){if(typeof input.screenshots!=='boolean')throw new Error('截圖選項格式不符。');next.screenshots=input.screenshots;}
      if(input.androidSerial!==undefined){if(typeof input.androidSerial!=='string'||input.androidSerial&&!/^emulator-\d+$/.test(input.androidSerial))throw new Error('裝置識別碼不合法。');if(input.androidSerial&&!(await android.status()).devices.some(device=>device.serial===input.androidSerial&&device.booted))throw new Error('請選擇已就緒的模擬器。');next.androidSerial=input.androidSerial;}
      const directory=child(config.projectRoot,'config');await makeDirectory(directory);const file=child(directory,'report.json');await noLinks(file);let stored={};try{stored=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}const temp=child(directory,'report-'+randomUUID()+'.tmp');await writeFile(temp,json({...stored,...next}),{flag:'wx'});await rename(temp,file);return next;
    });},
    async androidStatus(){await ready();return android.status();},
    async startAndroid(avd){await ready();return android.start(avd);},
    async startAppium(){await ready();return android.startAppium();},
    async pickDirectory(kind, pickOptions = {}) {
      if (!['source', 'project'].includes(kind)) throw new Error('資料夾用途不合法。');
      if (pending) throw new Error('另一項檔案操作進行中，請稍後再試。');
      while (activePicker) {
        const previous = activePicker;
        previous.abort();
        await previous.done;
      }
      if (pending) throw new Error('另一項檔案操作進行中，請稍後再試。');
      if (pickOptions.signal?.aborted) return { path: '', cancelled: true };
      const controller = new AbortController();
      const onCallerAbort = () => controller.abort();
      pickOptions.signal?.addEventListener('abort', onCallerAbort, { once: true });
      const run = (options.pickDirectory || pickDirectory)(
        kind,
        kind === 'source' ? config.sourceRoot : config.projectRoot,
        { signal: controller.signal },
      );
      const entry = {
        abort: () => controller.abort(),
        done: run.catch(() => ({ path: '', cancelled: true })),
      };
      activePicker = entry;
      try {
        return await run;
      } finally {
        pickOptions.signal?.removeEventListener('abort', onCallerAbort);
        if (activePicker === entry) activePicker = undefined;
      }
    },
    async cloneSource(input) { return exclusive(()=>cloneSource(config,input,options.gitRunner)); },
    async validateSource(path) { return validateSource(path); },
    async setup(input) {
      return exclusive(async () => {
        if(jobs.get()?.status==='running')throw new Error('請先等待或取消 AI 工作，再切換專案。');
        const candidate = await setupConfig(config, input);
        const prepared = createWorkspace(candidate);
        await prepared.initialize();
        const marker = JSON.parse(await readFile(child(candidate.projectRoot, 'archify.config.json'), 'utf8'));
        if (marker.reportDir !== candidate.reportDir) throw new Error('既有專案的報告目錄與平台設定不符，請先核對 ARCHIFY_REPORT_DIR。');
        await knowledgeStore(candidate).bootstrap();
        const scan = await prepared.scan();
        let hasApiClient = false;
        try {
          await noLinks(child(candidate.projectRoot, 'support/api-client.mts'));
          await lstat(child(candidate.projectRoot, 'support/api-client.mts'));
          hasApiClient = true;
        } catch {}
        if (marker.schemaVersion === 2 && hasApiClient && scan.requests.length) {
          for (let offset = 0; offset < scan.requests.length; offset += 500) {
            await prepared.generate({
              scanId: scan.scanId,
              ids: scan.requests.slice(offset, offset + 500).map(item => item.id),
            });
          }
        }
        await persistSetup(candidate);
        Object.assign(config, candidate); current = undefined; removalPlan = undefined;
        return { configured: true, initialized: true };
      });
    },
    async knowledge() { await ready(); return knowledgeStore(config).list(); },
    async aiStatus(id) { await ready(); return jobs.get(id); },
    async cancelAi(id) { await ready(); return jobs.cancel(id); },
    async restoreKnowledgeAi() { return exclusive(async()=>{await ready();if(jobs.get()?.status==='running')throw new Error('請先等待 AI 工作完成。');return knowledgeStore(config).restoreAi();}); },
    async analyzeFeaturesAi() {
      await ready();
      return jobs.start('features',config,async context=>{
        await this.prepareFrontendFeatures();
        const input=await featureAiPrompt(config);context.stage(`${input.scope.mode==='full'?'完整':'增量'}分析功能：${input.scope.evidence.pages.length} 個頁面`);
        const result=input.scope.mode==='unchanged'?null:await context.run(input.prompt);
        if(context.signal.aborted)throw new Error('工作已取消。');
        return exclusive(async()=>{
          if(context.signal.aborted)throw new Error('工作已取消。');
          if((await knowledgeStore(config).aiSnapshot()).revision!==input.knowledgeRevision)throw new Error('知識在分析期間已變更，請重新分析。');
          if(input.scope.mode==='unchanged'){
            if((await frontendSnapshot(config.sourceRoot)).sourceHash!==input.evidence.sourceHash||(await catalogStore(config).load()).revision!==input.evidence.catalogRevision)throw new Error('來源或案例已變更，請重新分析。');
            return {applied:false,mode:'unchanged',reason:input.scope.reason,coverage:input.evidence.previousAnalysis.coverage};
          }
          context.commit();context.stage('驗證來源並更新地圖');await saveFeatureAiResult(config,result,input.evidence,input.scope);
          const applied=await frontendFeatureStore(config).apply(input.evidence.incremental);
          return {...applied,mode:input.scope.mode,reason:input.scope.reason,analyzedPages:input.scope.evidence.pages.length,totalPages:input.evidence.pages.length};
        });
      });
    },
    async analyzeKnowledgeAi(documents) {
      await ready();
      const uploads=prepareUploads(documents),before=await knowledgeStore(config).aiSnapshot();
      return jobs.start('knowledge',config,async context=>{
        const input=await analyzeKnowledgeUploads(uploads,before,context);
        if(context.signal.aborted)throw new Error('工作已取消。');
        return exclusive(async()=>{
          if(context.signal.aborted)throw new Error('工作已取消。');
          if(!input.incoming.length){
            if((await knowledgeStore(config).aiSnapshot()).revision!==before.revision)throw new Error('知識在比對期間已變更，請重新分析。');
            return {updated:0,replaced:0,conflicts:[],skipped:input.skipped,directUpdated:0};
          }
          context.commit();context.stage('保存來源、備份舊版並更新知識');
          return {...await knowledgeStore(config).applyAi(input.result,before,input.incoming,input.uploads,input.relations),skipped:input.skipped,directUpdated:input.directUpdated};
        });
      });
    },
    async knowledgeSource(id, sha256) { await ready(); return knowledgeStore(config).source(id,sha256); },
    async knowledgeDocument(id) { await ready(); return knowledgeStore(config).read(id); },
    async updateKnowledge(input) { return exclusive(async () => { await ready(); return knowledgeStore(config).update(input); }); },
    async catalog() { await ready(); const analysis = await this.analysis(); return { ...await catalogStore(config).read(analysis), frontendPreparation: await frontendFeatureStore(config).status() }; },
    async casePlans() { await ready(); return catalogStore(config).load(); },
    async prepareFrontendFeatures() { const analysis=await this.scan(); return exclusive(async()=>{const value=await catalogStore(config).load();return frontendFeatureStore(config).prepare(analysis,value.revision,value.catalog);}); },
    async applyFrontendFeatures() { return exclusive(async()=>{await ready();return frontendFeatureStore(config).apply();}); },
    async saveCatalog(input) { return exclusive(async () => { await ready(); return catalogStore(config).save(input); }); },
    async confirmCase(input) { const analysis = await this.analysis(); return exclusive(async () => { await ready(); return catalogStore(config).confirm(input, analysis); }); },
    async catalogSource(input) { await ready(); return catalogStore(config).source(input.scope, input.path); },
    async importKnowledge(documents) { return exclusive(async () => { await ready(); return knowledgeStore(config).import(documents); }); },
    async archiveKnowledge(id) { return exclusive(async () => { await ready(); return knowledgeStore(config).archive(id); }); },
    async completeSetup() { return exclusive(async () => { await ready(); await validateSource(config.sourceRoot); const knowledge=await knowledgeStore(config).list(); if(!knowledge.documents.some(row=>!row.missing))throw new Error('請先上傳 PRD 或業務流程文件。'); return knowledgeStore(config).complete(); }); },
    async describe() {
      let initialized = false;
      try { await ready(); await validateSource(config.sourceRoot); initialized = true; } catch {}
      let onboardingCompleted = false, knowledgeCount = 0;
      if (initialized) {
        const knowledge = await knowledgeStore(config).list();
        onboardingCompleted = knowledge.onboardingCompleted === true;
        knowledgeCount = knowledge.documents.filter(row=>!row.missing).length;
      }
      return { sourceRoot: config.sourceRoot, projectRoot: config.projectRoot, analysisDir: config.analysisDir,
        apiDir: config.apiDir, reportDir: config.reportDir, configured: !!config.sourceRoot && !!config.projectRoot, initialized, onboardingCompleted, knowledgeCount };
    },
    async initialize() {
      return exclusive(async () => {
        required(); await noLinks(config.sourceRoot); await noLinks(config.projectRoot);
        try { await ready(); await ensureEnvIgnored(config.projectRoot); return { initialized: true, existing: true }; } catch {}
        const planned = [];
        async function collect(path, prefix = '') {
          for (const entry of await readdir(path, { withFileTypes: true })) {
            if (entry.isSymbolicLink()) throw new Error('框架範本包含不允許的連結。');
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            // Only provision empty test directories; never ship template self-tests or product examples.
            if (prefix === 'tests' && !['api', 'flows', 'ui', 'web', 'mobile'].includes(entry.name)) continue;
            if (prefix.startsWith('tests/') && (entry.isDirectory() || entry.name !== '.gitkeep')) continue;
            if (!prefix && !['test-cases', 'api', 'tests', 'framework', 'support', 'config', 'skills', 'memory', 'knowledge', 'fixtures', 'requests', 'AGENTS.md', 'README.md', 'package.json', 'package-lock.json', 'playwright.config.ts', 'tsconfig.json', '.gitignore'].includes(entry.name)) continue;
            if (entry.isDirectory()) await collect(join(path, entry.name), rel);
            else if (entry.isFile()) {
              let contents =
                rel === 'test-cases/catalog.json'
                  ? Buffer.from(json({ schemaVersion: 1, features: [], cases: [] }))
                  : await readFile(join(path, entry.name));
              if (rel === '.gitignore' && config.reportDir !== 'reports') contents = Buffer.concat([contents, Buffer.from(`\n/${config.reportDir.replaceAll('\\', '/')}/\n`)]);
              planned.push([rel, contents]);
            }
          }
        }
        await collect(template);
        planned.push(['archify.config.json', Buffer.from(json({ schemaVersion: 2, framework: 'playwright', apiLayout: 'reusable-v1', project: '獨立中間層測試專案', analysisDir: config.analysisDir, reportDir: config.reportDir }))]);
        const envExample = await readFile(join(template, '.env.example'), 'utf8');
        planned.push(['.env.example',Buffer.from(envExample)]);
        // Reject conflicts before creating any template file; never replace existing content.
        for (const [part, contents] of planned) {
          const path = child(config.projectRoot, part); await noLinks(path);
          try { if (!(await readFile(path)).equals(contents)) throw new Error(`初始化遇到既有檔案：${part}。請選擇空目錄或相容測試專案。`); }
          catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        for (const [part, contents] of planned) await createFile(child(config.projectRoot, part), contents);
        await makeDirectory(output());
        await persistSetup(config);
        return { initialized: true, existing: false };
      });
    },
    async folders(subdir = '') {
      required(); const path = child(config.sourceRoot, subdir); await noLinks(path);
      return (await readdir(path, { withFileTypes: true })).filter(entry => entry.isDirectory() && !entry.isSymbolicLink() && !entry.name.startsWith('.') && !['node_modules', 'dist', 'build', 'coverage'].includes(entry.name)).slice(0, 300).map(entry => entry.name).sort();
    },
    async analysis() {
      if (analysisRead) return analysisRead;
      const reading = exclusive(async () => {
      await ready();
      const directory = child(config.projectRoot, config.analysisDir); await noLinks(directory);
      let files;
      try { files = await readdir(directory); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
      const candidates = [];
      for (const name of files.filter(name => /^analysis-[a-z0-9-]+\.json$/i.test(name)).slice(0, 1000)) {
        const path = child(directory, name); await noLinks(path); const stat = await lstat(path);
        if (stat.isFile() && stat.size <= 10 * 1024 * 1024) candidates.push({ path, modified: stat.mtimeMs });
      }
      const latest = candidates.sort((a, b) => b.modified - a.modified)[0];
      if (!latest) return null;
      const record = JSON.parse(await readFile(latest.path, 'utf8'));
      if (record.schemaVersion !== 1 || typeof record.scanId !== 'string' || typeof record.sourceLabel !== 'string' ||
        !Array.isArray(record.requests) || record.requests.length > 5000 || !Array.isArray(record.warnings) || record.warnings.some(item => typeof item !== 'string') ||
        record.requests.some(item => !item || !/^[a-f0-9]{20}$/.test(item.id) || typeof item.name !== 'string' || typeof item.service !== 'string' || typeof item.endpoint !== 'string' ||
          !['http', 'graphql'].includes(item.kind) || !Array.isArray(item.evidence) || item.evidence.some(row => typeof row.path !== 'string' || !Number.isInteger(row.line)) ||
          !Array.isArray(item.issues) || item.issues.some(issue => typeof issue !== 'string'))) throw new Error('上次分析格式不相容，請重新分析來源。');
      output(record.apiDir);
      current = record;
      return present(record);
      }, true);
      analysisRead = reading;
      try { return await reading; } finally { if (analysisRead === reading) analysisRead = undefined; }
    },
    async scan({ sourceSubdir = '', apiDir = config.apiDir } = {}) {
      return exclusive(async () => {
        apiDir = apiDir.replaceAll('\\', '/');
        await ready(); output(apiDir);
        const scan = await scanSource(config.sourceRoot, sourceSubdir, sourceScanCache);
        const record = { ...scan, apiDir };
        record.syncScope = sync.scope(record);
        const filename = `analysis-${scan.scanId}.json`;
        await createFile(child(config.projectRoot, `${config.analysisDir}/${filename}`), json(record));
        await sync.track(record);
        current = record;
        return present(record);
      });
    },
    async generate({ scanId, ids }) {
      return exclusive(async () => {
        await ready();
        if (!current || current.scanId !== scanId) throw new Error('掃描已失效，請重新分析後再產生。');
        if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) throw new Error('請選擇 1 至 500 個不重複中間層接口。');
        const selected = ids.map(id => current.requests.find(item => item.id === id));
        if (selected.some(item => !item)) throw new Error('包含不屬於本次掃描的中間層接口。');
        const marker = await ready();
        if (marker.schemaVersion !== 2) throw new Error('此專案仍為舊三檔格式，請先完成 Playwright 遷移。');
        await noLinks(child(config.projectRoot, 'support/api-client.mts'));
        try { await lstat(child(config.projectRoot, 'support/api-client.mts')); }
        catch { throw new Error('此既有專案需先補齊可重用 API 框架，平台不會覆寫自訂設定。'); }
        const directory = output(current.apiDir), created = [], apiModules = [], skipped = [];
        const stems = operationStems(current.requests);
        const legacyStems = legacyOperationStems(current.requests);
        for (const item of selected) {
          const stem = stems.get(item.id);
          const casePath = child(config.projectRoot, current.apiDir + '/' + stem + '.spec.ts');
          const apiPath = child(config.projectRoot, `api/${stem}.ts`);
          const files = [apiPath, casePath, child(config.projectRoot, `${current.apiDir}/${legacyStems.get(item.id)}.spec.ts`), ...artifactNames(current.apiDir, item.id, stem).map(part => child(config.projectRoot, part)), ...artifactNames(current.apiDir, item.id, legacyStems.get(item.id)).map(part => child(config.projectRoot, part)), ...artifactNames(current.apiDir, item.id, item.id).map(part => child(config.projectRoot, part))];
          let exists = false;
          for (const file of files) { await noLinks(file); try { await lstat(file); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; } }
          if (exists) { skipped.push(item.id); continue; }
          let helper = relative(directory, apiPath).replaceAll('\\', '/').replace(/\.ts$/, '.js');
          if (!helper.startsWith('.')) helper = './' + helper;
          const code = apiTestSource({ ...item, name: operationTitle(item) }, helper);
          if (!await createFile(apiPath, apiModuleSource(item))) { skipped.push(item.id); continue; }
          if (!await createFile(casePath, code)) { skipped.push(item.id); continue; }
          apiModules.push(relative(config.projectRoot, apiPath).replaceAll('\\', '/'));
          created.push(relative(config.projectRoot, casePath).replaceAll('\\', '/'));
        }
        await sync.track(current);
        return { created, apiModules, skipped, message: '已產生可重用 API 與單支測試草稿；請在 API 填資料、在測試補斷言。未發送請求，既有檔案保留。' };
      });
    },
    async archiveRemoved({ scanId, ids }) {
      return exclusive(async () => {
        await ready();
        if (!current || scanId !== current.scanId) throw new Error('分析已失效，請重新分析後再移除。');
        const fresh = await scanSource(config.sourceRoot, current.sourceLabel === '.' ? '' : current.sourceLabel);
        if (fresh.sourceHash !== current.sourceHash) throw new Error('前端來源已變更，請重新分析後再移除。');
        if (fresh.warnings.length || !fresh.files || current.sourceLabel !== '.') throw new Error('來源分析不完整，請先確認來源與解析警告。');
        const result = await sync.archive(current, removalPlan, ids);
        return { ...result, analysis: await present(current) };
      });
    },
    async restoreRemoved({ archive }) {
      return exclusive(async () => {
        await ready(); const result = await sync.restore(archive);
        return { ...result, analysis: current ? await present(current) : null };
      });
    },
    async reports() {
      await ready(); return listReports(config);
    },
    async report(name) {
      await ready(); return readReport(config, name);
    },
  };
}
