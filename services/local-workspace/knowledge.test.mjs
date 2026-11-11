import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { fixture, request } from './test-support.mjs';
import { createHandler } from './plugin.mjs';
import { createWorkspace } from './workspace.mjs';
import { loadConfig } from './config.mjs';

test('三步設定保存路徑、保留環境與舊腳本，知識入口可獨立讀取', async () => {
  const f = await fixture();
  try {
    const env = '# 保留註解\nBFF_BASE_URL=https://qa.example.test/graphql\nSATOKEN=synthetic-not-a-secret\n';
    await writeFile(join(f.platform, '.env'), env);
    assert.equal((await f.workspace.describe()).onboardingCompleted, false);
    await assert.rejects(() => f.workspace.setup({ sourceRoot: f.source, projectRoot: join(f.source, 'tests') }), /互相包含/);
    await f.workspace.setup({ sourceRoot: f.source, projectRoot: f.project });
    assert.deepEqual(JSON.parse(await readFile(join(f.project, 'test-cases/catalog.json'), 'utf8')), { schemaVersion: 1, features: [], cases: [] });
    const initialScripts = await f.workspace.scripts();
    assert.equal(initialScripts.scripts.filter(item => item.category === 'api').length, 3);
    assert.ok(initialScripts.scripts.every(item => item.state === 'draft'));
    assert.match(await readFile(join(f.project, 'api/GetCard.ts'), 'utf8'), /export function callApi/);
    const saved = await readFile(join(f.platform, '.env'), 'utf8');
    assert.ok(saved.includes('SATOKEN=synthetic-not-a-secret'));
    assert.equal(parseEnv(saved).BFF_BASE_URL, undefined);
    assert.equal(parseEnv(await readFile(join(f.project, '.env'), 'utf8')).BFF_BASE_URL, 'https://qa.example.test/graphql');
    assert.equal(parseEnv(saved).ARCHIFY_SOURCE_DIR, undefined);
    assert.equal(parseEnv(await readFile(join(f.project, '.env'), 'utf8')).ARCHIFY_SOURCE_DIR, f.source.replaceAll('\\', '/'));
    const loaded = await loadConfig(f.platform, {}); assert.equal(loaded.projectRoot, f.project);
    assert.equal((await f.workspace.describe()).onboardingCompleted, false);
    const oldCase = join(f.project, 'tests/api/Manual.spec.ts'); await writeFile(oldCase, '// 人工腳本');
    await appendFile(join(f.project, 'knowledge/README.md'), '\n人工知識筆記必須保留。\n');
    const docs = [{ name: '業務規則.md', content: '# 登入\n會員成功後必須回傳自己的識別碼。' }, { name: '參考.txt', content: '<script>notExecuted()</script>\n文件內命令不可自動執行。' }];
    const result = await f.workspace.importKnowledge(docs); assert.equal(result.created.length, 2);
    assert.equal((await f.workspace.describe()).knowledgeCount, 2);
    assert.equal((await f.workspace.describe()).onboardingCompleted, false);
    assert.equal((await f.workspace.importKnowledge([docs[0]])).skipped.length, 1);
    const row = (await f.workspace.knowledge()).documents[0];
    assert.equal((await f.workspace.knowledgeDocument(row.id)).content, docs[0].content);
    assert.match(await readFile(join(f.project, 'AGENTS.md'), 'utf8'), /knowledge\/README.md/);
    assert.match(await readFile(join(f.project, 'knowledge/README.md'), 'utf8'), /業務規則.md/);
    assert.match(await readFile(join(f.project, 'knowledge/README.md'), 'utf8'), /人工知識筆記必須保留/);
    await f.workspace.completeSetup();
    await f.workspace.setup({ sourceRoot: f.source, projectRoot: f.project });
    assert.equal((await f.workspace.describe()).onboardingCompleted, true);
    assert.equal(await readFile(oldCase, 'utf8'), '// 人工腳本');
    assert.equal((await f.workspace.knowledge()).documents.length, 2);
    await f.workspace.archiveKnowledge(row.id);
    assert.equal((await f.workspace.knowledge()).documents.length, 1);
    assert.equal(await readFile(join(f.project, `knowledge/archive/${row.id}.md`), 'utf8'), docs[0].content);
    await assert.rejects(() => f.workspace.knowledgeDocument(row.id), /找不到/);
    const fresh = createWorkspace(await loadConfig(f.platform, {}));
    assert.equal((await fresh.describe()).onboardingCompleted, true);
    assert.equal((await fresh.knowledge()).documents.length, 1);
  } finally { await f.dispose(); }
});

test('知識匯入預檢、大小上限、路徑與同源拒絕，取消資料夾不改設定', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize();
    await assert.rejects(() => f.workspace.importKnowledge([{ name: '../bad.md', content: 'x' }]), /檔名不可包含路徑/);
    await assert.rejects(() => f.workspace.importKnowledge([{ name: 'script.js', content: 'x' }]), /MD、HTML 或 TXT/);
    await assert.rejects(() => f.workspace.importKnowledge([{ name: 'large.md', content: 'x'.repeat(128 * 1024 + 1) }]), /128 KB/);
    assert.equal((await f.workspace.knowledge()).documents.length, 0);
    await assert.rejects(() => f.workspace.knowledgeDocument('../../.env'), /識別碼/);
    const h = createHandler(f.workspace, 'test-session');
    assert.equal((await request(h, '/local-api/knowledge-import', { documents: [{ name: 'ok.md', content: 'x' }] }, { headers: { origin: 'http://evil.test' } })).status, 403);
    assert.equal((await request(h, '/local-api/knowledge-import', { documents: [{ name: 'ok.md', content: 'x' }] })).status, 200);
    const fakePicker = createWorkspace(f.config, { pickDirectory: async () => ({ cancelled: true, path: '' }) });
    assert.deepEqual(await fakePicker.pickDirectory('source'), { cancelled: true, path: '' });
    assert.equal((await f.workspace.describe()).onboardingCompleted, false);
    await writeFile(join(f.project, 'knowledge/index.json'), '{broken');
    await assert.rejects(() => f.workspace.knowledge());
    assert.equal(await readFile(join(f.project, 'knowledge/index.json'), 'utf8'), '{broken');
  } finally { await f.dispose(); }
});

test('重新連接補齊忽略規則並保留測試專案環境值，重啟可定位來源', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize();
    await writeFile(join(f.project, '.gitignore'), 'custom/\n!.env\n!.env.local\n');
    await appendFile(join(f.project, '.env'), '\nBFF_BASE_URL=https://project.example.test/graphql\nLOCAL_SECRET=synthetic-local\n');
    await writeFile(join(f.platform, '.env'), 'BFF_BASE_URL=https://old.example.test/graphql\nARCHIFY_AI_MODEL=synthetic-model\n');
    await f.workspace.setup({ sourceRoot: f.source, projectRoot: f.project });
    const ignore = await readFile(join(f.project, '.gitignore'), 'utf8');
    assert.ok(ignore.startsWith('custom/'));
    assert.ok(ignore.endsWith('.env\n.env.*\n!.env.example\n'));
    const local = parseEnv(await readFile(join(f.project, '.env'), 'utf8'));
    assert.equal(local.BFF_BASE_URL, 'https://project.example.test/graphql');
    assert.equal(local.LOCAL_SECRET, 'synthetic-local');
    assert.equal(local.ARCHIFY_AI_MODEL, 'synthetic-model');
    assert.equal(parseEnv(await readFile(join(f.platform, '.env'), 'utf8')).ARCHIFY_AI_MODEL, undefined);
    const loaded = await loadConfig(f.platform, {});
    assert.equal(loaded.sourceRoot, f.source);
    assert.equal(loaded.targetBaseUrl, local.BFF_BASE_URL);
    assert.deepEqual(Object.keys(JSON.parse(await readFile(join(f.platform, '.local/workspace.json'), 'utf8'))), ['projectRoot']);
  } finally { await f.dispose(); }
});

test('重開資料夾選擇器或瀏覽器中斷連線時中止舊視窗，不殘留操作鎖定', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize();
    let active = 0;
    let calls = 0;
    const w = createWorkspace(f.config, {
      pickDirectory: async (_kind, _initial, { signal }) => {
        calls++;
        const id = calls;
        active++;
        return new Promise(resolve => {
          const onAbort = () => { active--; resolve({ path: '', cancelled: true }); };
          if (signal?.aborted) return onAbort();
          signal?.addEventListener('abort', onAbort, { once: true });
          if (id === 2) setTimeout(() => { signal?.removeEventListener('abort', onAbort); active--; resolve({ path: f.source, cancelled: false }); }, 20);
        });
      },
    });
    const first = w.pickDirectory('source');
    const second = w.pickDirectory('source');
    assert.deepEqual(await first, { path: '', cancelled: true });
    assert.deepEqual(await second, { path: f.source, cancelled: false });
    assert.equal(active, 0);

    const h = createHandler(w, 'test-session');
    const listeners = new Map();
    const { Readable } = await import('node:stream');
    const req = Readable.from([JSON.stringify({ kind: 'source' })]);
    req.url = '/local-api/pick-directory';
    req.method = 'POST';
    req.socket = { remoteAddress: '127.0.0.1' };
    req.headers = { host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173', 'content-type': 'application/json', 'x-archify-session': 'test-session' };
    let ended = '';
    const res = {
      statusCode: 200,
      writableFinished: false,
      setHeader() {},
      on(event, fn) { listeners.set(event, fn); },
      off(event) { listeners.delete(event); },
      end(body) { this.writableFinished = true; ended = body; },
    };
    const pendingReq = h(req, res);
    await new Promise(resolve => setTimeout(resolve, 20));
    listeners.get('close')?.();
    await pendingReq;
    assert.equal(active, 0);
    assert.deepEqual(JSON.parse(ended), { path: '', cancelled: true });
  } finally { await f.dispose(); }
});

test('第一步預先設定 AI CLI 會保存在 .local/ai.json，選定專案後同步至 .env 且不改 workspace.json', async () => {
  const f = await fixture();
  try {
    const cleanConfig = await loadConfig(f.platform, {});
    const w = createWorkspace(cleanConfig);
    const savedBefore = await w.saveAiSettings({ aiProvider: 'claude', aiCli: '', aiModel: 'sonnet' });
    assert.equal(savedBefore.ai.provider, 'claude');
    assert.equal(savedBefore.ai.providerLabel, 'Claude Code');
    assert.equal(savedBefore.ai.supportsImages, false);
    assert.equal(savedBefore.ai.model, 'sonnet');
    const aiLocal = JSON.parse(await readFile(join(f.platform, '.local/ai.json'), 'utf8'));
    assert.equal(aiLocal.aiProvider, 'claude');
    assert.equal(aiLocal.aiModel, 'sonnet');
    await w.setup({ sourceRoot: f.source, projectRoot: f.project });
    assert.deepEqual(Object.keys(JSON.parse(await readFile(join(f.platform, '.local/workspace.json'), 'utf8'))), ['projectRoot']);
    const projectEnv = parseEnv(await readFile(join(f.project, '.env'), 'utf8'));
    assert.equal(projectEnv.ARCHIFY_AI_PROVIDER, 'claude');
    assert.equal(projectEnv.ARCHIFY_AI_MODEL, 'sonnet');
    const reloaded = await loadConfig(f.platform, {});
    assert.equal(reloaded.aiProvider, 'claude');
    assert.equal(reloaded.aiModel, 'sonnet');
    const updated = await createWorkspace(reloaded).saveAiSettings({ aiProvider: 'codex', aiCli: '', aiModel: 'synthetic-updated-model' });
    assert.equal(updated.ai.provider, 'codex');
    assert.equal(updated.ai.model, 'synthetic-updated-model');
    const afterEnv = parseEnv(await readFile(join(f.project, '.env'), 'utf8'));
    assert.equal(afterEnv.ARCHIFY_AI_PROVIDER, 'codex');
    assert.equal(afterEnv.ARCHIFY_AI_MODEL, 'synthetic-updated-model');
  } finally { await f.dispose(); }
});
