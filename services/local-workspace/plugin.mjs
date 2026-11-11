import { randomBytes } from 'node:crypto';
import { loadConfig } from './config.mjs';
import { createWorkspace } from './workspace.mjs';

export function createHandler(workspace, token = randomBytes(32).toString('hex')) {
  return async (req, res, next = () => {}) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (!pathname.startsWith('/local-api/')) return next();
    const send = (status, value) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(value)); };
    const host = req.headers.host || '';
    const origin = req.headers.origin;
    if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host) ||
      (req.socket.remoteAddress && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) ||
      (origin && origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: '僅接受同來源的本機操作。' });
    try {
      if (req.method === 'GET' && pathname === '/local-api/config') return send(200, { ...await workspace.describe(), session: token });
      if (req.method !== 'POST' || req.headers['x-archify-session'] !== token || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return send(403, { error: '本機工作階段不符，請重新載入設定。' });
      const chunks=[];let bytes=0;
      const limit = pathname==='/local-api/ai-knowledge-start'?48*1024*1024:['/local-api/knowledge-import', '/local-api/knowledge-update', '/local-api/catalog-save'].includes(pathname) ? 2 * 1024 * 1024 : 65536;
      if(Number(req.headers['content-length'])>limit)return send(413,{error:'操作資料過大。'});
      for await (const chunk of req) { const data=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=data.length;if(bytes>limit)return send(413,{error:'操作資料過大。'});chunks.push(data); }
      const body=Buffer.concat(chunks).toString('utf8');
      const input = JSON.parse(body || '{}');
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('操作資料格式不符。');
      let pickAbort;
      const cleanup = () => {
        if (pickAbort && !res.writableFinished) pickAbort.abort();
      };
      const routes = {
        '/local-api/pick-directory': () => {
          pickAbort = new AbortController();
          return workspace.pickDirectory(input.kind, { signal: pickAbort.signal });
        },
        '/local-api/clone-source': () => workspace.cloneSource(input),
        '/local-api/validate-source': () => workspace.validateSource(input.path),
        '/local-api/setup': () => workspace.setup(input),
        '/local-api/setup-complete': () => workspace.completeSetup(),
        '/local-api/knowledge': () => workspace.knowledge(),
        '/local-api/report-settings': () => workspace.reportSettings(),
        '/local-api/report-settings-save': () => workspace.saveReportSettings(input),
        '/local-api/android-status': () => workspace.androidStatus(),
        '/local-api/android-start': () => workspace.startAndroid(input.avd),
        '/local-api/appium-start': () => workspace.startAppium(),
        '/local-api/ai-inspect': () => workspace.inspectAi(input),
        '/local-api/ai-test': () => workspace.testAi(input),
        '/local-api/ai-settings': () => workspace.saveAiSettings(input),
        '/local-api/ai-status': () => workspace.aiStatus(input.id),
        '/local-api/ai-cancel': () => workspace.cancelAi(input.id),
        '/local-api/ai-features-start': () => workspace.analyzeFeaturesAi(),
        '/local-api/ai-knowledge-start': () => workspace.analyzeKnowledgeAi(input.documents),
        '/local-api/knowledge-ai-restore': () => workspace.restoreKnowledgeAi(),
        '/local-api/knowledge-document': () => workspace.knowledgeDocument(input.id),
        '/local-api/knowledge-source': () => workspace.knowledgeSource(input.id,input.sha256),
        '/local-api/knowledge-import': () => workspace.importKnowledge(input.documents),
        '/local-api/knowledge-archive': () => workspace.archiveKnowledge(input.id),
        '/local-api/knowledge-update': () => workspace.updateKnowledge(input),
        '/local-api/catalog': () => workspace.catalog(),
        '/local-api/case-plans': () => workspace.casePlans(),
        '/local-api/scripts': () => workspace.scripts(),
        '/local-api/catalog-save': () => workspace.saveCatalog(input),
        '/local-api/case-confirm': () => workspace.confirmCase(input),
        '/local-api/catalog-source': () => workspace.catalogSource(input),
        '/local-api/frontend-features-prepare': () => workspace.prepareFrontendFeatures(),
        '/local-api/frontend-features-apply': () => workspace.applyFrontendFeatures(),
        '/local-api/initialize': () => workspace.initialize(),
        '/local-api/folders': () => workspace.folders(input.subdir),
        '/local-api/analysis': () => workspace.analysis(),
        '/local-api/scan': () => workspace.scan(input),
        '/local-api/generate': () => workspace.generate(input),
        '/local-api/archive-removed': () => workspace.archiveRemoved(input),
        '/local-api/restore-removed': () => workspace.restoreRemoved(input),
        '/local-api/reports': () => workspace.reports(),
        '/local-api/report': () => workspace.report(input.name),
      };
      if (!routes[pathname]) return send(404, { error: '找不到本機操作。' });
      if (typeof res.on === 'function') res.on('close', cleanup);
      try {
        send(200, await routes[pathname]());
      } finally {
        if (typeof res.off === 'function') res.off('close', cleanup);
        else if (typeof res.removeListener === 'function') res.removeListener('close', cleanup);
      }
    } catch (error) {
      const message = error.code ? '檔案操作失敗，請確認設定目錄存在、權限及檔案狀態。' : error.message;
      send(400, { error: message || '本機操作失敗。' });
    }
  };
}
export function localWorkspacePlugin() {
  let handler;
  const configure = async server => {
    try { handler = createHandler(createWorkspace(await loadConfig())); }
    catch { handler = (req, res, next) => {
      if (!req.url?.startsWith('/local-api/')) return next();
      res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: '平台 .env 設定不合法，請核對範例與目錄範圍後重新啟動。' }));
    }; }
    server.middlewares.use(handler);
  };
  return { name: 'archify-local-workspace', configureServer: configure, configurePreviewServer: configure };
}
