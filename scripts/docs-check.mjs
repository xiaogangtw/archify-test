import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { root, plans, renderIndex, statuses } from './docs-plans-index.mjs';
const errors = [];
const items = await plans();
const index = await readFile(path.join(root, 'docs/plans/README.md'), 'utf8').catch(() => '');
if (index !== renderIndex(items)) errors.push('計畫索引過期：請執行 npm run docs:plans:index');
const required = ['範圍', '影響檔案', '資料庫影響', '風險', '設計文件同步', '領域', '任務狀態', '驗證證據'];
for (const p of items) {
  const fail = message => errors.push(`${p.relative}：${message}`);
  if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(path.basename(p.file))) fail('檔名格式不符');
  for (const heading of required) {
    if (!new RegExp(`^## ${heading}\\r?$`, 'm').test(p.body)) fail(`缺少章節：${heading}`);
  }
  for (const s of statuses) if (!p.body.includes(`- [ ] ${s}`) && !p.body.includes(`- [x] ${s}`)) fail(`缺少狀態：${s}`);
  if (p.body.includes('- [x] 可供審查') && !p.done) fail('可供審查前須完成所有里程碑');
  if (p.relative.startsWith('archive/') && (!p.done || !p.relative.startsWith(`archive/${p.month}/`))) fail('歸檔須全部完成且月份一致');
  if (p.done && /待執行|待驗證/.test(p.body.split('## 驗證證據')[1] || '')) fail('完成計畫仍有待驗證記號');
}
const files = ['AGENTS.md', 'docs/README.md', 'docs/architecture.md', 'docs/decisions/README.md', 'docs/plans/README.md', ...items.map(p => path.relative(root, p.file))];
for (const name of files) {
  const file = path.join(root, name);
  const body = (await readFile(file, 'utf8')).replace(/```[\s\S]*?```/g, '');
  for (const match of body.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1].replace(/^<|>$/g, '');
    if (/^(?:[a-z]+:|#)/i.test(href)) continue;
    const target = path.resolve(path.dirname(file), decodeURIComponent(href.split('#')[0]));
    if (!await stat(target).catch(() => null)) errors.push(`${name}：連結不存在 ${href}`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`PASS：文件入口、本機連結、${items.length} 份計畫結構與索引一致性（未檢查遠端連結、錨點或產品行為）`);
