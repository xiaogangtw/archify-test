import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { defineCase, describeCase, executeCase } from './runtime.mjs';
import { renderHtml } from './html.mjs';
import { parseEnv } from 'node:util';
import { reportBasename } from './report-name.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  for (const [key, value] of Object.entries(parseEnv(await readFile(join(root, '.env'), 'utf8')))) if (!Object.hasOwn(process.env, key)) process.env[key] = value;
} catch (error) { if (error.code !== 'ENOENT') throw new Error('無法讀取測試專案 .env'); }
let projectConfig = {};
try { projectConfig = JSON.parse(await readFile(join(root, 'archify.config.json'), 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw new Error('測試專案設定格式不符'); }
const mode = process.argv[2];
if (!['run', 'flow'].includes(mode)) throw new Error('使用方式：node framework/cli.mjs run|flow');
const args = process.argv.slice(3);
if (args.length && (args.length !== 2 || args[0] !== '--case' || !args[1])) throw new Error('單一案例使用 --case <案例 id 或相對檔名>');
const selectedCase = args[1]?.replaceAll('\\', '/');
async function discover(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await discover(path));
    else if (entry.isFile() && entry.name.endsWith('.case.mjs')) files.push(path);
  }
  return files.sort();
}
const cases = [];
const ids = new Set();
// Validate the complete collection before starting any case.
for (const file of await discover(join(root, 'tests'))) {
  const value = defineCase((await import(pathToFileURL(file).href)).default);
  if (ids.has(value.id)) throw new Error(`案例 id 重複：${value.id}`);
  ids.add(value.id);
  cases.push({ value, source: relative(root, file).replaceAll('\\', '/'),
    sourceHash: createHash('sha256').update(await readFile(file)).digest('hex') });
}
if (!cases.length) throw new Error('tests 內沒有 .case.mjs 案例');
const selected = selectedCase ? cases.filter(item => item.value.id === selectedCase || item.source === selectedCase) : cases;
if (!selected.length) throw new Error('找不到指定案例，未執行測試');
const report = { schemaVersion: 1, kind: mode === 'run' ? 'execution' : 'flow', project: projectConfig.project || '本機測試專案',
  runId: randomUUID(), createdAt: new Date().toISOString(), cases: [] };
for (const { value, source, sourceHash } of selected) {
  const item = mode === 'run' ? await executeCase(value, source, sourceHash) : describeCase(value, source, sourceHash);
  report.cases.push(item);
  console.log(`${item.status} ${item.id} ${item.name}`);
}
const reportDir = projectConfig.reportDir || 'reports';
if (typeof reportDir !== 'string' || reportDir.includes('..') || /^[\\/]|:/.test(reportDir)) throw new Error('reportDir 必須為測試專案內的相對路徑');
const directory = resolve(root, reportDir);
await mkdir(directory, { recursive: true });
const output = join(directory, reportBasename(report.kind, report.createdAt, report.runId) + '.json');
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
await writeFile(output.replace(/\.json$/, '.html'), renderHtml(report), { flag: 'wx' });
console.log(`報告：${output}`);
if (report.cases.some(item => item.status === 'failed')) process.exitCode = 1;
