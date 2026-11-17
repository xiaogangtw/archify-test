import { readFile, writeFile, rename, lstat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.mjs';
import { noLinks, makeDirectory } from './paths.mjs';

function upsertEnvEntries(original, entries) {
  let next = original;
  for (const [key, value] of Object.entries(entries)) {
    const pattern = new RegExp('^(?:export\\s+)?' + key + '\\s*=.*$', 'gm');
    if ([...next.matchAll(pattern)].some(match => /=[ \t]*["'][^"']*$/.test(match[0]))) {
      throw new Error('請先將測試專案 .env 的路徑設定改為單行後再試。');
    }
    const line = key + '=' + JSON.stringify(value);
    next = pattern.test(next)
      ? next.replace(pattern, () => line)
      : (next ? next.replace(/\s*$/, '\n') : '') + line + '\n';
  }
  return next;
}

export async function validateAiSettings(input = {}) {
  if (input.aiProvider !== undefined && typeof input.aiProvider !== 'string') throw new Error('AI 工具格式不符。');
  const aiProvider = typeof input.aiProvider === 'string' && input.aiProvider.trim() ? input.aiProvider.trim().toLowerCase() : 'codex';
  if (!['codex', 'claude', 'gemini'].includes(aiProvider)) throw new Error('僅支援 codex、claude 或 gemini CLI。');
  const aiCli = typeof input.aiCli === 'string' ? input.aiCli.trim() : '';
  const aiModel = typeof input.aiModel === 'string' ? input.aiModel.trim() : '';
  if (input.aiCli !== undefined && typeof input.aiCli !== 'string') throw new Error('CLI 路徑格式不符。');
  if (input.aiModel !== undefined && typeof input.aiModel !== 'string') throw new Error('模型名稱格式不符。');
  if (aiCli) {
    if (!isAbsolute(aiCli) || /["\r\n\0]/.test(aiCli) || aiCli.length > 2048 || (process.platform === 'win32' && !/\.(exe|js|mjs|cjs)$/i.test(aiCli))) {
      throw new Error('ARCHIFY_AI_CLI 請填有效 CLI 執行檔（.exe／.js／.mjs）的完整路徑。');
    }
    await noLinks(aiCli);
    if (!existsSync(aiCli)) throw new Error('找不到指定的 AI CLI 執行檔，請確認路徑。');
  }
  if (aiModel && !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(aiModel)) {
    throw new Error('模型名稱僅接受英數及 . _ : / - 字元。');
  }
  return { aiProvider, aiCli, aiModel };
}

export async function saveAiSettings(config, input = {}) {
  const { aiProvider, aiCli, aiModel } = await validateAiSettings(input);
  const directory = resolve(config.platformRoot, '.local');
  await makeDirectory(directory);
  const aiFile = resolve(directory, 'ai.json');
  await noLinks(aiFile);
  const aiTemp = resolve(directory, 'ai-' + randomUUID() + '.tmp');
  await writeFile(aiTemp, JSON.stringify({ aiProvider, aiCli, aiModel }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  await rename(aiTemp, aiFile);

  let updatedProject = false;
  if (config.projectRoot) {
    try {
      await noLinks(config.projectRoot);
      if ((await lstat(config.projectRoot)).isDirectory()) {
        await ensureEnvIgnored(config.projectRoot);
        const file = resolve(config.projectRoot, '.env');
        await noLinks(file);
        let original = '';
        try { original = await readFile(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
        const next = upsertEnvEntries(original, {
          ARCHIFY_AI_PROVIDER: aiProvider,
          ARCHIFY_AI_CLI: aiCli,
          ARCHIFY_AI_MODEL: aiModel,
        });
        const temp = resolve(config.projectRoot, '.env-' + randomUUID() + '.tmp');
        await noLinks(temp);
        await writeFile(temp, next, { flag: 'wx', mode: 0o600 });
        await rename(temp, file);
        updatedProject = true;
      }
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  const sourceKind = updatedProject ? 'project' : 'local';
  return {
    aiProvider,
    aiCli,
    aiModel,
    aiProviderSource: sourceKind,
    aiCliSource: aiCli ? sourceKind : 'default',
    aiModelSource: aiModel ? sourceKind : 'default',
  };
}

export async function setupConfig(config, input) {
  for (const key of ['sourceRoot', 'projectRoot']) {
    if (typeof input[key] !== 'string' || !isAbsolute(input[key]) || /["\r\n\0]/.test(input[key]) || input[key].length > 2048) throw new Error('請選擇或貼上資料夾的完整絕對路徑。');
  }
  const candidate = await loadConfig(config.platformRoot, { ...process.env,
    ARCHIFY_SOURCE_DIR: input.sourceRoot, ARCHIFY_TEST_PROJECT_DIR: input.projectRoot,
    ARCHIFY_ANALYSIS_DIR: config.analysisDir, ARCHIFY_API_TEST_DIR: config.apiDir, ARCHIFY_REPORT_DIR: config.reportDir,
    BFF_BASE_URL: config.targetBaseUrl });
  await noLinks(candidate.sourceRoot); await noLinks(candidate.projectRoot);
  if (!(await lstat(candidate.sourceRoot)).isDirectory()) throw new Error('前端來源必須是既有資料夾。');
  try { if (!(await lstat(candidate.projectRoot)).isDirectory()) throw new Error('腳本位置必須是資料夾。'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return candidate;
}
export async function validateSource(path) {
  if (typeof path !== 'string' || !isAbsolute(path) || path.includes('\0')) throw new Error('請選擇或貼上前端專案的完整路徑。');
  await noLinks(path);
  if (!(await lstat(path)).isDirectory()) throw new Error('前端來源必須是既有資料夾。');
  return { path: resolve(path) };
}
export async function ensureEnvIgnored(root) {
  const file = resolve(root, '.gitignore'); await noLinks(file);
  let original = '';
  try { original = await readFile(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const suffix = '\n# 本機環境設定不得提交 Git\n.env\n.env.*\n!.env.example\n';
  if (!original.endsWith(suffix)) await writeFile(file, original + suffix);
}
export async function persistSetup(config) {
  await ensureEnvIgnored(config.projectRoot);
  const file = resolve(config.projectRoot, '.env'); await noLinks(file);
  let original = '';
  try { original = await readFile(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  let legacyEnv = {};
  const legacyFile = resolve(config.platformRoot, '.env'); await noLinks(legacyFile);
  try { legacyEnv = parseEnv(await readFile(legacyFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const existing = parseEnv(original);
  let next = original;
  for (const [key, value] of Object.entries(legacyEnv)) {
    if (!/^(?:ARCHIFY_(?:AI_PROVIDER|AI_CLI|AI_MODEL|ANDROID_SDK|APPIUM_CLI|TARGET_BASE_URL)|BFF_BASE_URL)$/.test(key) || key in existing) continue;
    if (/[\r\n\0]/.test(value)) throw new Error('舊環境設定含多行值，請先人工遷移。');
    next += '\n' + key + '=' + JSON.stringify(value) + '\n';
  }
  let localAi = {};
  const aiFile = resolve(config.platformRoot, '.local', 'ai.json'); await noLinks(aiFile);
  try { localAi = JSON.parse(await readFile(aiFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const afterLegacy = parseEnv(next);
  const aiDefaults = {};
  if (!('ARCHIFY_AI_PROVIDER' in afterLegacy) && typeof localAi.aiProvider === 'string' && localAi.aiProvider) aiDefaults.ARCHIFY_AI_PROVIDER = localAi.aiProvider;
  if (!('ARCHIFY_AI_CLI' in afterLegacy) && typeof localAi.aiCli === 'string' && localAi.aiCli) aiDefaults.ARCHIFY_AI_CLI = localAi.aiCli;
  if (!('ARCHIFY_AI_MODEL' in afterLegacy) && typeof localAi.aiModel === 'string' && localAi.aiModel) aiDefaults.ARCHIFY_AI_MODEL = localAi.aiModel;
  next = upsertEnvEntries(next, {
    ...aiDefaults,
    ARCHIFY_SOURCE_DIR: config.sourceRoot.replaceAll('\\', '/'),
    ARCHIFY_ANALYSIS_DIR: config.analysisDir,
    ARCHIFY_API_TEST_DIR: config.apiDir,
    ARCHIFY_REPORT_DIR: config.reportDir,
  });
  const temp = resolve(config.projectRoot, '.env-' + randomUUID() + '.tmp'); await noLinks(temp);
  await writeFile(temp, next, { flag: 'wx', mode: 0o600 }); await rename(temp, file);
  const directory = resolve(config.platformRoot, '.local'); await makeDirectory(directory);
  const locator = resolve(directory, 'workspace.json'); await noLinks(locator);
  const pointerTemp = resolve(directory, 'workspace-' + randomUUID() + '.tmp');
  await writeFile(pointerTemp, JSON.stringify({ projectRoot: config.projectRoot }) + '\n', { flag: 'wx', mode: 0o600 }); await rename(pointerTemp, locator);
  const legacy = resolve(config.platformRoot, '.env'); await noLinks(legacy);
  try {
    const old = await readFile(legacy, 'utf8');
    const cleaned = old.replace(/^(?:export\s+)?(?:BFF_BASE_URL|ARCHIFY_(?:SOURCE_DIR|TEST_PROJECT_DIR|ANALYSIS_DIR|API_TEST_DIR|REPORT_DIR|AI_PROVIDER|AI_CLI|AI_MODEL|ANDROID_SDK|APPIUM_CLI|TARGET_BASE_URL))\s*=.*(?:\r?\n|$)/gm, '');
    if (old !== cleaned) await writeFile(legacy, cleaned, { mode: 0o600 });
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
