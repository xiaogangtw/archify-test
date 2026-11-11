import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const areas = ['apps/web/src', 'services/control-api/src', 'services/android', 'services/agents', 'services/launcher', 'services/runner', 'services/mobile'];
const ignored = new Set(['node_modules', 'dist', '.git']);
async function inspect(directory) {
  const files = [];
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
    const name = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await inspect(name));
    else if (/\.(?:[cm]?js|tsx?)$/.test(name) && !/\.(?:test|spec)\.[^.]+$/.test(name)) {
      const body = await readFile(path.join(root, name), 'utf8');
      files.push({ path: name, bytes: Buffer.byteLength(body), lines: body.split(/\r?\n/).length });
    }
  }
  return files;
}
console.log('架構盤點：正式程式來源，排除 test/spec、node_modules、dist 與符號連結。');
console.log('大小僅協助選擇閱讀順序，不是品質分數或架構驗證。');
for (const area of areas) {
  const files = await inspect(area);
  console.log(`\n${area}：${files.length} 個檔案`);
  for (const file of files.sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path)).slice(0, 5)) {
    console.log(`  ${file.bytes} bytes / ${file.lines} 行  ${file.path}`);
  }
}
