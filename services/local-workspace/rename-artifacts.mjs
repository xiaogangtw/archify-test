import { readFile, writeFile, unlink, lstat } from 'node:fs/promises';
import { relative, dirname } from 'node:path';
import { child, noLinks } from './paths.mjs';
import { operationStems, artifactNames } from './naming.mjs';

export async function renameLegacyArtifacts(config, record, apply = false) {
  const stems = operationStems(record.requests), planned = [];
  for (const item of record.requests) {
    const old = artifactNames(record.apiDir, item.id, item.id).map(part => child(config.projectRoot, part));
    const next = artifactNames(record.apiDir, item.id, stems.get(item.id)).map(part => child(config.projectRoot, part));
    if (old[0] === next[0]) continue;
    const exists = [];
    for (const path of old) { await noLinks(path); try { exists.push((await lstat(path)).isFile()); } catch (error) { if (error.code !== 'ENOENT') throw error; exists.push(false); } }
    if (!exists.some(Boolean)) continue;
    if (!exists.every(Boolean)) throw new Error('舊草稿組不完整，請先核對：' + item.id);
    const contents = await Promise.all(old.map(path => readFile(path)));
    let code = contents[0].toString('utf8');
    for (const index of [1, 2]) {
      const from = relative(dirname(old[0]), old[index]).replaceAll('\\', '/');
      const to = relative(dirname(next[0]), next[index]).replaceAll('\\', '/');
      if (!code.includes(from)) throw new Error('案例引用已自訂，需人工核對：' + item.id);
      code = code.replaceAll(from, to);
    }
    for (const [index, path] of next.entries()) {
      await noLinks(path);
      try { await lstat(path); throw new Error('新檔名已存在，不覆寫：' + relative(config.projectRoot, path)); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      planned.push({ from: old[index], to: path, before: contents[index], after: index === 0 ? Buffer.from(code) : contents[index] });
    }
  }
  if (apply) {
    const created = [];
    try {
      for (const row of planned) { await writeFile(row.to, row.after, { flag: 'wx' }); created.push(row.to); }
      for (const row of planned) if (!(await readFile(row.from)).equals(row.before)) throw new Error('遷移期間有人工修改，停止並保留原檔。');
    } catch (error) {
      for (const path of created) { await noLinks(path); await unlink(path); }
      throw error;
    }
    for (const row of planned) { await noLinks(row.from); await unlink(row.from); }
  }
  return { files: planned.length, cases: planned.length / 3, paths: planned.map(row => ({ from: relative(config.projectRoot, row.from).replaceAll('\\', '/'), to: relative(config.projectRoot, row.to).replaceAll('\\', '/') })) };
}
