import { readFile, writeFile, lstat, rename, mkdir, copyFile, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { child, noLinks, makeDirectory } from './paths.mjs';
import { operationStems, operationTitle } from './naming.mjs';
import { reportBasename } from '../../test-project/framework/report-name.mjs';

const ts = createRequire(new URL('../../package.json', import.meta.url))('typescript');
const hash = value => createHash('sha256').update(value).digest('hex');
const idPattern = /^[a-f0-9]{20}$/;
const hashPattern = /^[a-f0-9]{64}$/;
const archivePattern = /^removed-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}-[a-f0-9]{8}$/;
const json = value => JSON.stringify(value, null, 2) + '\n';
const testPath = part => typeof part === 'string' && /^tests\/[\p{L}\p{N}_/.-]+\.spec\.ts$/u.test(part) && !part.split('/').some(value => value === '..' || value === '.');

function owns(source, id) {
  const file = ts.createSourceFile('case.ts', source, ts.ScriptTarget.Latest, true);
  const ids = [];
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const values = Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).filter(property => ts.isStringLiteral(property.initializer)).map(property => [property.name.getText(file).replace(/^['"]|['"]$/g, ''), property.initializer.text]));
      if (values.type === 'archify-id') ids.push(values.description);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return ids.length === 1 && ids[0] === 'API-' + id;
}

export function scriptSync(config) {
  const scope = record => hash(JSON.stringify([process.platform === 'win32' ? resolve(config.sourceRoot).toLowerCase() : resolve(config.sourceRoot), record.sourceLabel, record.apiDir]));
  const statePath = record => child(config.projectRoot, `${config.analysisDir}/script-sync-${scope(record)}.json`);
  const filePath = part => child(config.projectRoot, part);
  async function readJson(path, fallback) {
    await noLinks(path);
    try {
      const stat = await lstat(path);
      if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error('同步紀錄過大或不是一般檔案。');
      try { return JSON.parse(await readFile(path, 'utf8')); } catch { throw new Error('同步紀錄格式不符，請保留原檔並修復。'); }
    } catch (error) { if (error.code === 'ENOENT' && fallback) return fallback; throw error; }
  }
  async function state(record) {
    const value = await readJson(statePath(record), { schemaVersion: 1, scope: scope(record), entries: [] });
    if (!value || value.schemaVersion !== 1 || value.scope !== scope(record) || !Array.isArray(value.entries) || value.entries.length > 5000 || value.entries.some(row => !row || !idPattern.test(row.id) || !testPath(row.path) || !row.path.startsWith(record.apiDir + '/') || typeof row.name !== 'string' || !['http', 'graphql'].includes(row.kind) || typeof row.endpoint !== 'string' || typeof row.method !== 'string' || typeof row.operationName !== 'string' || !Array.isArray(row.evidence) || row.evidence.some(path => typeof path !== 'string'))) throw new Error('腳本同步索引格式不符。');
    return value;
  }
  async function contents(part) {
    if (!testPath(part)) throw new Error('同步只接受 tests/ 下的 .spec.ts。');
    const path = filePath(part); await noLinks(path);
    try {
      const stat = await lstat(path);
      if (!stat.isFile() || stat.size > 1024 * 1024) return null;
      return await readFile(path);
    } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async function track(record) {
    const value = await state(record), stems = operationStems(record.requests);
    for (const item of record.requests) {
      const part = `${record.apiDir}/${stems.get(item.id)}.spec.ts`, data = await contents(part);
      if (!data || !owns(data.toString('utf8'), item.id)) continue;
      const row = { id: item.id, path: part, name: operationTitle(item), kind: item.kind, method: item.method, endpoint: item.endpoint, operationName: item.operationName || '', evidence: item.evidence.map(row => row.path) };
      value.entries = value.entries.filter(previous => previous.path.toLowerCase() !== part.toLowerCase()); value.entries.push(row);
    }
    const encoded = json(value);
    if (value.entries.length > 5000 || Buffer.byteLength(encoded) > 2 * 1024 * 1024) throw new Error('腳本同步索引超過容量。');
    await makeDirectory(dirname(statePath(record))); await noLinks(statePath(record));
    const temp = statePath(record) + '.' + randomUUID() + '.tmp';
    await writeFile(temp, encoded, { flag: 'wx' }); await rename(temp, statePath(record));
  }
  async function preview(record) {
    const result = { scope: scope(record), removed: [], notice: '' };
    if (record.syncScope !== scope(record)) { result.notice = '請重新分析以建立同步基準。'; return result; }
    if (record.sourceLabel !== '.' || record.warnings.length || !record.files) { result.notice = '需完整分析來源根目錄，且無解析警告，才提供移除建議。'; return result; }
    const value = await state(record);
    for (const row of value.entries) {
      if (value.entries.filter(item => item.id === row.id).length !== 1) continue;
      if (record.requests.some(item => item.id === row.id)) continue;
      // A changed operation is not evidence of deletion. Keep it for later updating.
      if (record.requests.some(item => item.kind === row.kind && ((row.kind === 'graphql' && row.operationName && item.operationName === row.operationName) || item.evidence.some(evidence => row.evidence.includes(evidence.path))))) continue;
      const data = await contents(row.path);
      if (!data || !owns(data.toString('utf8'), row.id)) continue;
      result.removed.push({ id: row.id, name: row.name, path: row.path, hash: hash(data) });
    }
    return result;
  }
  async function archive(record, plan, ids) {
    if (!plan || plan.scope !== scope(record) || !Array.isArray(ids) || !ids.length || ids.length > 500 || new Set(ids).size !== ids.length) throw new Error('請重新分析並選擇要移除的腳本。');
    const rows = ids.map(id => plan.removed.find(row => row.id === id));
    if (rows.some(row => !row)) throw new Error('包含不屬於本次移除清單的腳本。');
    for (const row of rows) {
      const data = await contents(row.path);
      if (!data || hash(data) !== row.hash || !owns(data.toString('utf8'), row.id)) throw new Error('腳本已變更，請重新分析後再移除。');
    }
    const name = reportBasename('execution', new Date(), randomUUID()).replace(/^report-/, 'removed-');
    const directory = filePath(`legacy/removed-api/${name}`); await noLinks(directory);
    await makeDirectory(dirname(directory)); await mkdir(directory);
    const manifest = { schemaVersion: 1, name, createdAt: new Date().toISOString(), scanId: record.scanId, sourceHash: record.sourceHash, apiDir: record.apiDir, rows };
    await writeFile(child(directory, 'manifest.json'), json(manifest), { flag: 'wx' });
    const removed = [];
    try {
      for (const row of rows) {
        const destination = child(directory, 'files/' + row.path); await makeDirectory(dirname(destination)); await noLinks(destination);
        await copyFile(filePath(row.path), destination, constants.COPYFILE_EXCL);
        const current = await contents(row.path);
        if (!current || hash(current) !== row.hash || hash(await readFile(destination)) !== row.hash) throw new Error('腳本已變更，原檔保留，請重新分析。');
        await unlink(filePath(row.path)); removed.push(row);
      }
    } catch (error) {
      for (const row of removed) { try { await copyFile(child(directory, 'files/' + row.path), filePath(row.path), constants.COPYFILE_EXCL); } catch {} }
      throw new Error(`移除未完成，請核對原檔與 legacy/removed-api/${name} 封存；不會覆寫現有檔案。`);
    }
    return { archive: name, paths: rows.map(row => row.path) };
  }
  async function restore(name) {
    if (typeof name !== 'string' || !archivePattern.test(name)) throw new Error('封存識別不合法。');
    const directory = filePath(`legacy/removed-api/${name}`);
    const manifest = await readJson(child(directory, 'manifest.json'));
    if (!manifest || manifest.schemaVersion !== 1 || manifest.name !== name || !Array.isArray(manifest.rows) || !manifest.rows.length || manifest.rows.length > 500 || typeof manifest.apiDir !== 'string' || !testPath(manifest.apiDir + '/placeholder.spec.ts') || manifest.rows.some(row => !row || !idPattern.test(row.id) || !testPath(row.path) || !row.path.startsWith(manifest.apiDir + '/') || !hashPattern.test(row.hash))) throw new Error('封存紀錄格式不符。');
    const rows = manifest.rows;
    for (const row of rows) {
      const archived = child(directory, 'files/' + row.path); await noLinks(archived); await noLinks(filePath(row.path));
      const stat = await lstat(archived);
      if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('封存檔案格式不符。');
      const data = await readFile(archived);
      if (hash(data) !== row.hash || !owns(data.toString('utf8'), row.id)) throw new Error('封存內容已變更，無法自動還原。');
      try { await lstat(filePath(row.path)); throw new Error(`還原位置已有檔案：${row.path}，原內容保留。`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    // Exclusive copies retain the archive, including when a partial restore must be retried manually.
    for (const row of rows) { await makeDirectory(dirname(filePath(row.path))); await noLinks(filePath(row.path)); await copyFile(child(directory, 'files/' + row.path), filePath(row.path), constants.COPYFILE_EXCL); }
    return { restored: rows.map(row => row.path) };
  }
  return { scope, track, preview, archive, restore };
}
