import { readFile, writeFile, lstat } from 'node:fs/promises';
import { child, noLinks, makeDirectory } from './paths.mjs';
import { hashBytes, SOURCE_LIMIT } from './knowledge-upload.mjs';
export function checkedSources(sources = []) {
  if (!Array.isArray(sources) || sources.length > 200) throw new Error('知識來源關聯過多或格式不符。');
  return sources.map(source => {
    if (!source || typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256) || typeof source.path !== 'string' || !new RegExp('^knowledge/sources/' + source.sha256 + '\\.(md|txt|html?|png|jpe?g|webp)$').test(source.path) || typeof source.name !== 'string' || source.name.length > 200 || /[\\/\0\r\n]/.test(source.name) || !Number.isInteger(source.bytes) || source.bytes < 1 || source.bytes > SOURCE_LIMIT || !['image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/markdown', 'text/html'].includes(source.mediaType) || !['text', 'image'].includes(source.kind)) throw new Error('知識來源關聯不合法。');
    return { name: source.name, path: source.path, sha256: source.sha256, bytes: source.bytes, mediaType: source.mediaType, kind: source.kind, ...(source.kind === 'image' ? { width: source.width, height: source.height } : {}) };
  });
}
export async function storeSources(config, uploads) {
  await makeDirectory(child(config.projectRoot, 'knowledge/sources'));
  for (const upload of uploads) {
    const [source] = checkedSources([upload.source]);
    const path = child(config.projectRoot, source.path); await noLinks(path);
    if (hashBytes(upload.bytes) !== source.sha256) throw new Error('原始來源在儲存前已變更。');
    try { await writeFile(path, upload.bytes, { flag: 'wx' }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; const stat = await lstat(path); if (!stat.isFile() || stat.size !== source.bytes || hashBytes(await readFile(path)) !== source.sha256) throw new Error('既有原始來源內容與指紋不同，請保留檔案並核對。'); }
  }
}
export async function sourceContent(config, source) {
  [source] = checkedSources([source]);
  const file = child(config.projectRoot, source.path); await noLinks(file);
  const stat = await lstat(file);
  if (!stat.isFile() || stat.size !== source.bytes || stat.size > SOURCE_LIMIT) throw new Error('原始來源已變更或不是一般檔案。');
  const bytes = await readFile(file);
  if (hashBytes(bytes) !== source.sha256) throw new Error('原始來源指紋不符，請核對檔案。');
  return { ...source, base64: bytes.toString('base64') };
}
