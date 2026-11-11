import { readdir, lstat, readFile } from 'node:fs/promises';
import { join, relative, resolve, parse } from 'node:path';
import { createHash } from 'node:crypto';
export const sourceDigest = value => createHash('sha256').update(value).digest('hex');
export async function rejectSourceLinks(path) {
  const absolute = resolve(path); let cursor = parse(absolute).root;
  for (const part of relative(cursor, absolute).split(/[\\/]/).filter(Boolean)) { cursor = join(cursor, part); try { if ((await lstat(cursor)).isSymbolicLink()) throw new Error('不接受來源連結路徑。'); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
}
export async function frontendSnapshot(directory) {
  directory = resolve(directory); await rejectSourceLinks(directory);
  if (!(await lstat(directory)).isDirectory()) throw new Error('來源不是資料夾。');
  const files = [], warnings = []; let bytes = 0, entries = 0;
  async function walk(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (++entries > 20000) throw new Error('目錄超過 20000 個項目，請縮小來源範圍。');
      if (entry.name.startsWith('.') || ['node_modules','dist','build','coverage','vendor','__tests__','__mocks__','__fixtures__','tests','test','e2e'].includes(entry.name) || /\.(test|spec)\.[cm]?[jt]sx?$/i.test(entry.name)) continue;
      const file = join(path, entry.name), part = relative(directory, file).replaceAll('\\','/');
      if (entry.isSymbolicLink()) { warnings.push('略過連結：' + part); continue; }
      if (entry.isDirectory()) { await walk(file); continue; }
      if (!entry.isFile() || !/\.(?:[cm]?[jt]sx?|graphql|gql|vue|svelte|json)$/i.test(entry.name) || /lock|secret|credential|token|private|\.min\./i.test(entry.name)) continue;
      await rejectSourceLinks(file); const stat = await lstat(file);
      if (stat.size > 1024*1024) { warnings.push('略過大於 1 MB 的來源：' + part); continue; }
      if (files.length >= 3000 || bytes + stat.size > 20*1024*1024) throw new Error('來源超過 3000 檔或 20 MB，請縮小來源範圍。');
      bytes += stat.size; files.push({ path: part, source: await readFile(file,'utf8') });
    }
  }
  await walk(directory);
  return { files, warnings, sourceHash: sourceDigest(JSON.stringify(files.map(file=>[file.path,sourceDigest(file.source)]))) };
}
