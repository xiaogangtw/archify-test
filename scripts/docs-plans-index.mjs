import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const statuses = ['已開始', '實作完成', '文件已同步', '設計文件已同步或註明不適用', '可供審查'];
export async function plans(dir = path.join(root, 'docs/plans')) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await plans(file));
    else if (entry.name !== 'README.md' && entry.name.endsWith('.md')) {
      const body = (await readFile(file, 'utf8')).replace(/^\uFEFF/, '');
      const relative = path.relative(path.join(root, 'docs/plans'), file).replaceAll('\\', '/');
      const area = body.match(/^## 領域\s*\n([^\n]+)/m)?.[1].trim() || '未分類';
      const done = statuses.every(s => body.includes(`- [x] ${s}`));
      result.push({ file, relative, body, area, done, month: entry.name.slice(0, 7), title: body.match(/^# (.+)/m)?.[1] || entry.name });
    }
  }
  return result.sort((a, b) => b.relative.localeCompare(a.relative, 'en'));
}
export function renderIndex(items) {
  const lines = ['# 任務計畫索引', '', '由 `npm run docs:plans:index` 產生，請勿手動修改。計畫記錄進度與證據，現況請看 [文件總索引](../README.md)。', '', '## 月份索引', ''];
  const row = p => `- [${p.title}](${p.relative})：${p.done ? '已完成' : '進行中'}；${p.area}`;
  for (const month of [...new Set(items.map(p => p.month))].sort().reverse()) {
    lines.push(`### ${month}`, '', ...items.filter(p => p.month === month).map(row), '');
  }
  lines.push('## 領域索引', '');
  for (const area of [...new Set(items.map(p => p.area))].sort()) {
    lines.push(`### ${area}`, '', ...items.filter(p => p.area === area).map(row), '');
  }
  return lines.join('\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const items = await plans();
  await writeFile(path.join(root, 'docs/plans/README.md'), renderIndex(items), 'utf8');
  console.log(`PASS：已更新計畫索引（${items.length} 份計畫）`);
}
