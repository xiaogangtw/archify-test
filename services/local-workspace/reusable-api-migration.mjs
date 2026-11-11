import { createRequire } from 'node:module';
import { readFile, readdir, lstat, writeFile, rename } from 'node:fs/promises';
import { dirname, relative, basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { child, noLinks, makeDirectory } from './paths.mjs';
import { apiModuleSource } from './api-source.mjs';
import { reportBasename } from '../../test-project/framework/report-name.mjs';
const ts = createRequire(new URL('../../package.json', import.meta.url))('typescript');
const hash = data => createHash('sha256').update(data).digest('hex');

export function splitApiSource(source, moduleImport) {
  const file = ts.createSourceFile('case.ts', source, ts.ScriptTarget.Latest, true);
  if (file.parseDiagnostics.length) throw new Error('語法需人工核對');
  const statements = file.statements.filter(ts.isVariableStatement).filter(statement => statement.declarationList.declarations.some(node => ts.isIdentifier(node.name) && node.name.text === 'operation'));
  if (statements.length !== 1 || statements[0].declarationList.declarations.length !== 1) throw new Error('沒有單一 operation，保留人工核對');
  const statement = statements[0], node = statement.declarationList.declarations[0];
  function staticValue(value) {
    if (!value) return false;
    if (ts.isStringLiteralLike(value) || ts.isNumericLiteral(value) || [ts.SyntaxKind.NullKeyword, ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword].includes(value.kind)) return true;
    if (ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.MinusToken) return ts.isNumericLiteral(value.operand);
    if (ts.isArrayLiteralExpression(value)) return value.elements.every(staticValue);
    return ts.isObjectLiteralExpression(value) && value.properties.every(property => ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && staticValue(property.initializer));
  }
  if (!staticValue(node.initializer) || !ts.isObjectLiteralExpression(node.initializer)) throw new Error('operation 含動態邏輯，保留人工核對');
  const declaration = node.initializer.getText(file);
  const replacement = `import { callApi, operation } from ${JSON.stringify(moduleImport)};\nexport { operation };`;
  return { api: apiModuleSource(null, declaration), test: source.slice(0, statement.getStart(file)) + replacement + source.slice(statement.getEnd()) };
}

export async function planReusableApiMigration(config) {
  const rows = [], skipped = [], directory = child(config.projectRoot, config.apiDir);
  await noLinks(directory);
  for (const name of await readdir(directory)) {
    if (!/^[\p{L}\p{N}_.-]+\.spec\.ts$/u.test(name)) continue;
    const testPart = `${config.apiDir}/${name}`, apiPart = `api/${basename(name, '.spec.ts')}.ts`;
    const testPath = child(config.projectRoot, testPart), apiPath = child(config.projectRoot, apiPart);
    await noLinks(testPath); await noLinks(apiPath);
    const stat = await lstat(testPath);
    if (!stat.isFile() || stat.size > 1024 * 1024) { skipped.push({ path: testPart, reason: '非一般檔案或超過大小限制' }); continue; }
    try { await lstat(apiPath); skipped.push({ path: testPart, reason: 'API 模組已存在，保留原檔' }); continue; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const original = await readFile(testPath, 'utf8');
    let moduleImport = relative(dirname(testPath), apiPath).replaceAll('\\', '/').replace(/\.ts$/, '.js');
    if (!moduleImport.startsWith('.')) moduleImport = './' + moduleImport;
    try { rows.push({ testPart, apiPart, original, hash: hash(original), ...splitApiSource(original, moduleImport) }); }
    catch (error) { skipped.push({ path: testPart, reason: error.message }); }
  }
  return { rows, skipped };
}

export async function applyReusableApiMigration(config, plan) {
  for (const row of plan.rows) {
    const testPath = child(config.projectRoot, row.testPart), apiPath = child(config.projectRoot, row.apiPart);
    await noLinks(testPath); await noLinks(apiPath);
    if (hash(await readFile(testPath)) !== row.hash) throw new Error('腳本已變更，請重新規劃遷移。');
    try { await lstat(apiPath); throw new Error('API 模組已存在，拒絕覆寫。'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const archive = 'legacy/reusable-api/' + reportBasename('execution', new Date().toISOString(), randomUUID());
  for (const row of plan.rows) {
    const backup = child(config.projectRoot, `${archive}/${row.testPart}`);
    await noLinks(backup); await makeDirectory(dirname(backup));
    await writeFile(backup, row.original, { flag: 'wx' });
  }
  for (const row of plan.rows) {
    const testPath = child(config.projectRoot, row.testPart), apiPath = child(config.projectRoot, row.apiPart);
    await makeDirectory(dirname(apiPath)); await noLinks(apiPath); await noLinks(testPath);
    if (hash(await readFile(testPath)) !== row.hash) throw new Error('腳本在遷移中變更，原檔已備份，停止後續處理。');
    await writeFile(apiPath, row.api, { flag: 'wx' });
    const temp = testPath + '.' + randomUUID() + '.tmp';
    await writeFile(temp, row.test, { flag: 'wx' }); await rename(temp, testPath);
  }
  return { migrated: plan.rows.length, archive, skipped: plan.skipped };
}
