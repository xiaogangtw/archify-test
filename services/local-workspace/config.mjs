import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { noLinks, inside, child } from './paths.mjs';

export const platformRoot = fileURLToPath(new URL('../../', import.meta.url));
export async function loadConfig(root = platformRoot, overrides = process.env) {
  let local = {};
  try { local = parseEnv(await readFile(resolve(root, '.env'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('無法讀取平台 .env。'); }
  let locator = {};
  const pointer = resolve(root, '.local/workspace.json'); await noLinks(pointer);
  try { locator = JSON.parse(await readFile(pointer, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw new Error('無法讀取本機專案定位。'); }
  let localAi = {};
  const aiPointer = resolve(root, '.local/ai.json'); await noLinks(aiPointer);
  try { localAi = JSON.parse(await readFile(aiPointer, 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw new Error('無法讀取本機 AI 設定。'); }
  const project = overrides.ARCHIFY_TEST_PROJECT_DIR?.trim() || locator.projectRoot || local.ARCHIFY_TEST_PROJECT_DIR?.trim();
  let projectEnv = {};
  if (project) {
    const file = resolve(root, project, '.env'); await noLinks(file);
    try { projectEnv = parseEnv(await readFile(file, 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw new Error('無法讀取測試專案 .env。'); }
  }
  const env = { ...local, ...projectEnv, ...overrides };
  const pickAi = (envKey, localKey) => {
    if (overrides[envKey] !== undefined) { const v = overrides[envKey].trim(); return { value: v, source: v ? 'env' : 'default' }; }
    if (projectEnv[envKey] !== undefined) { const v = projectEnv[envKey].trim(); return { value: v, source: v ? 'project' : 'default' }; }
    if (local[envKey] !== undefined) { const v = local[envKey].trim(); return { value: v, source: v ? 'platform' : 'default' }; }
    const v = typeof localAi[localKey] === 'string' ? localAi[localKey].trim() : '';
    return { value: v, source: v ? 'local' : 'default' };
  };
  const aiProviderRaw = pickAi('ARCHIFY_AI_PROVIDER', 'aiProvider');
  const aiProvider = (aiProviderRaw.value || 'codex').toLowerCase();
  if (!['codex', 'claude', 'gemini'].includes(aiProvider)) {
    throw new Error('ARCHIFY_AI_PROVIDER 僅支援 codex、claude 或 gemini。');
  }
  const aiCli = pickAi('ARCHIFY_AI_CLI', 'aiCli'), aiModel = pickAi('ARCHIFY_AI_MODEL', 'aiModel');
  const source = env.ARCHIFY_SOURCE_DIR?.trim();
  const config = { platformRoot: resolve(root), sourceRoot: source ? resolve(root, source) : '', projectRoot: project ? resolve(root, project) : '',
    analysisDir: env.ARCHIFY_ANALYSIS_DIR || 'analysis', apiDir: env.ARCHIFY_API_TEST_DIR || 'tests/api', reportDir: env.ARCHIFY_REPORT_DIR || 'reports',
    targetBaseUrl: env.BFF_BASE_URL ?? env.ARCHIFY_TARGET_BASE_URL ?? '',
    aiProvider, aiProviderSource: aiProviderRaw.value ? aiProviderRaw.source : 'default',
    aiCli: aiCli.value, aiModel: aiModel.value, aiCliSource: aiCli.source, aiModelSource: aiModel.source, androidSdk: env.ARCHIFY_ANDROID_SDK || '', appiumCli: env.ARCHIFY_APPIUM_CLI || '' };
  if (config.projectRoot && (inside(root, config.projectRoot) || inside(config.projectRoot, root))) throw new Error('測試專案必須完全獨立於平台目錄，請修改 ARCHIFY_TEST_PROJECT_DIR。');
  if (config.projectRoot && config.sourceRoot && (inside(config.sourceRoot, config.projectRoot) || inside(config.projectRoot, config.sourceRoot))) throw new Error('來源與測試專案目錄不可互相包含。');
  for (const key of ['analysisDir', 'apiDir', 'reportDir']) {
    const part = config[key].replaceAll('\\', '/');
    if (!part || /(^|\/)\./.test(part) || /^(test-cases|api|framework|support|config|skills|memory|knowledge|requests|node_modules)(\/|$)/i.test(part)) throw new Error(`${key} 必須使用獨立的非保留相對目錄。`);
    child(config.projectRoot || root, part);
    config[key] = part;
  }
  if (!/^tests\//.test(config.apiDir.replaceAll('\\', '/'))) throw new Error('ARCHIFY_API_TEST_DIR 必須位於 tests/ 下，才能由獨立 CLI 發現。');
  const dirs = [config.analysisDir, config.apiDir, config.reportDir].map(part => child(config.projectRoot || root, part));
  if (/^tests(?:\/|$)/.test(config.analysisDir.replaceAll('\\', '/')) || /^tests(?:\/|$)/.test(config.reportDir.replaceAll('\\', '/'))) throw new Error('分析與報告不可放在 tests/ 內。');
  for (let a = 0; a < dirs.length; a++) for (let b = a + 1; b < dirs.length; b++) if (inside(dirs[a], dirs[b]) || inside(dirs[b], dirs[a])) throw new Error('分析、案例與報告目錄不可重疊。');
  if (config.targetBaseUrl) {
    const url = new URL(config.targetBaseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('受測網址僅接受不含帳密、query 或 fragment 的 HTTP／HTTPS URL。');
  }
  return config;
}
