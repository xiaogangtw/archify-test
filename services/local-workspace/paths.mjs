import { lstat, mkdir } from 'node:fs/promises';
import { resolve, relative, isAbsolute, parse, join } from 'node:path';

export function inside(root, target) {
  const part = relative(resolve(root), resolve(target));
  return part === '' || (!part.startsWith('..') && !isAbsolute(part));
}
export function child(root, part = '') {
  if (typeof part !== 'string' || isAbsolute(part) || part.includes('\0') || part.includes(':')) throw new Error('請使用目錄範圍內的相對路徑。');
  const path = resolve(root, part);
  if (!inside(root, path)) throw new Error('路徑不可離開設定的目錄。');
  return path;
}
export async function noLinks(path) {
  const absolute = resolve(path), base = parse(absolute).root;
  let current = base;
  for (const part of relative(base, absolute).split(/[\\/]/).filter(Boolean)) {
    current = join(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error('不接受符號連結或 junction 路徑。'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return absolute;
}
export async function makeDirectory(path) {
  await noLinks(path);
  await mkdir(path, { recursive: true });
  await noLinks(path);
}
