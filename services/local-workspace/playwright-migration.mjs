import { readFile, writeFile, lstat, unlink, rmdir } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { child, noLinks, makeDirectory } from './paths.mjs';
import { operationStems, artifactNames } from './naming.mjs';
import { playwrightSource } from './playwright-source.mjs';
import { createRequire } from 'node:module';
import { reportBasename } from '../../test-project/framework/report-name.mjs';
const ts = createRequire(new URL('../../package.json', import.meta.url))('typescript');

function simpleLegacy(source) {
  const file = ts.createSourceFile('legacy.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  if (file.parseDiagnostics.length || file.statements.some(node => !ts.isImportDeclaration(node) && !ts.isExportAssignment(node))) return null;
  const exported = file.statements.filter(ts.isExportAssignment);
  if (exported.length !== 1 || !ts.isCallExpression(exported[0].expression) || exported[0].expression.expression.getText(file) !== 'defineCase') return null;
  const object = exported[0].expression.arguments[0];
  if (!object || !ts.isObjectLiteralExpression(object)) return null;
  const props = new Map();
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) return null;
    const key = property.name.getText(file).replace(/['"]/g, '');
    if (!['id', 'name', 'purpose', 'steps'].includes(key) || props.has(key)) return null;
    props.set(key, property.initializer);
  }
  const steps = props.get('steps');
  if (!steps || !ts.isArrayLiteralExpression(steps) || steps.elements.length !== 1 || !ts.isObjectLiteralExpression(steps.elements[0])) return null;
  const run = steps.elements[0].properties.find(node => ts.isMethodDeclaration(node) && node.name.getText(file) === 'run');
  if (!run?.body || run.body.statements.length !== 1 || run.body.statements[0].getText(file).replace(/\s/g, '') !== 'awaitexecuteApi(request,fixture,verify);') return null;
  if (steps.elements[0].properties.some(node => !['name', 'expected', 'run'].includes(node.name?.getText(file).replace(/['"]/g, '')))) return null;
  const id = props.get('id'), name = props.get('name');
  return id && name && ts.isStringLiteral(id) && ts.isStringLiteral(name) ? { id: id.text, name: name.text, imports: file.statements.filter(ts.isImportDeclaration).map(node => node.moduleSpecifier.text) } : null;
}

const hash = value => createHash('sha256').update(value).digest('hex');
export async function planPlaywrightMigration(config, record) {
  const stems = operationStems(record.requests), cases = [], manual = [];
  for (const item of record.requests) {
    const stem = stems.get(item.id), paths = artifactNames(record.apiDir, item.id, stem).map(part => child(config.projectRoot, part));
    const target = child(config.projectRoot, `${record.apiDir}/${stem}.spec.ts`);
    await noLinks(target);
    try { await lstat(target); manual.push({ id: item.id, reason: '已有 .spec.ts，保留原檔' }); continue; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const bytes = [];
    for (const path of paths) { await noLinks(path); bytes.push(await readFile(path)); }
    const source = bytes[0].toString('utf8');
    const metadata = simpleLegacy(source);
    if (!metadata) {
      manual.push({ id: item.id, reason: '已有自訂測試邏輯，保留並待人工遷移' }); continue;
    }
    const { id, name } = metadata;
    const allowed = [child(config.projectRoot, 'framework/runtime.mjs'), child(config.projectRoot, 'framework/http.mjs'), paths[1], paths[2]].map(path => relative(dirname(paths[0]), path).replaceAll('\\', '/'));
    if (metadata.imports.some(path => !allowed.includes(path))) { manual.push({ id: item.id, reason: '已有自訂 import，保留並待人工遷移' }); continue; }
    const request = JSON.parse(bytes[1]), settings = JSON.parse(bytes[2]);
    const sensitive = object => Object.entries(object || {}).some(([key, value]) => /token|secret|password|authorization|cookie/i.test(key) && value !== null && value !== '' && !String(value).includes('{{'));
    if (sensitive(settings.headers) || sensitive(settings.variables) || sensitive(request.headers)) { manual.push({ id: item.id, reason: '資料可能含秘密常數，先改為 .env 參照再遷移' }); continue; }
    if (!Array.isArray(settings.assertions) || settings.assertions.some(value => typeof value.path !== 'string' || !['equals', 'exists', 'contains'].includes(value.operator) || (value.operator !== 'exists' && !Object.hasOwn(value, 'value')))) throw new Error('舊斷言格式不相容，停止遷移：' + item.id);
    let helper = relative(dirname(target), child(config.projectRoot, 'support/bff.mjs')).replaceAll('\\', '/');
    if (!helper.startsWith('.')) helper = './' + helper;
    cases.push({ id: item.id, paths, bytes, target, code: playwrightSource({ ...request, name }, settings, helper, id) });
  }
  return { cases, manual };
}
export async function applyPlaywrightCases(config, plan) {
  const stamp = reportBasename('flow', new Date().toISOString(), randomUUID()).slice(5);
  const archive = child(config.projectRoot, `legacy/pre-playwright/${stamp}`);
  for (const item of plan.cases) for (const [index, path] of item.paths.entries()) {
    await noLinks(path); await noLinks(item.target);
    if (hash(await readFile(path)) !== hash(item.bytes[index])) throw new Error('遷移前有人工修改，停止：' + item.id);
  }
  const created = [];
  try {
    for (const item of plan.cases) {
      for (const [index, path] of item.paths.entries()) {
        const destination = child(archive, relative(config.projectRoot, path));
        await makeDirectory(dirname(destination)); await writeFile(destination, item.bytes[index], { flag: 'wx' });
      }
      await writeFile(item.target, item.code, { flag: 'wx' }); created.push(item.target);
    }
  } catch (error) { for (const path of created) { await noLinks(path); await unlink(path); } throw error; }
  for (const item of plan.cases) for (const path of item.paths) { await noLinks(path); await unlink(path); }
  for (const directory of ['requests/generated', 'fixtures/api']) {
    const path = child(config.projectRoot, directory); await noLinks(path);
    try { await rmdir(path); } catch (error) { if (!['ENOENT', 'ENOTEMPTY'].includes(error.code)) throw error; }
  }
  return { migrated: plan.cases.length, manual: plan.manual, archive: relative(config.projectRoot, archive).replaceAll('\\', '/') };
}
