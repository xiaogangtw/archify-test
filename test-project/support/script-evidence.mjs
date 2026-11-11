import { readFileSync, lstatSync, existsSync } from 'node:fs';
import { resolve, relative, dirname, isAbsolute, parse } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const hash = value => createHash('sha256').update(value).digest('hex');
export function intentHash(row) {
  const values = [row.id, row.featureId, row.title, row.kind, row.purpose, row.preconditions, row.data, row.expected, row.knowledgeIds || [], row.questions || []];
  if (row.steps !== undefined || row.cleanup !== undefined || row.target !== undefined) values.push(row.steps || [], row.cleanup || '', row.target || '');
  if (row.factor !== undefined || row.decisionTable !== undefined) values.push(row.factor || '', row.decisionTable || []);
  return hash(JSON.stringify(values));
}
const slash = value => value.replaceAll('\\', '/');
const allowed = part => /^(tests|api|support|framework)\//.test(part) || ['config/http.json', 'playwright.config.ts', 'package.json', 'package-lock.json'].includes(part);
function safeFile(root, part) {
  if (typeof part !== 'string' || isAbsolute(part) || part.includes('\0') || part.includes(':') || part.split(/[\\/]/).some(p => p === '..')) throw new Error('範圍外路徑');
  const path = resolve(root, part), rel = relative(root, path);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error('範圍外路徑');
  let current = parse(path).root;
  for (const segment of relative(current, path).split(/[\\/]/)) { current = resolve(current, segment); if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('不接受連結'); }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size > (part === 'knowledge/index.json' ? 2 : 1) * 1024 * 1024) throw new Error('非一般檔案或過大');
  return path;
}

/** 只讀 AST 與受限相對依賴；不 import 使用者程式、不讀 .env。 */
export function scriptEvidence(root, source) {
  root = resolve(root);
  const files = new Map(), issues = [], caseIds = new Set(), apiIds = new Set(), steps = [], apiFiles = new Set(), apiContracts = {};
  function visit(part, depth = 0) {
    part = slash(part);
    if (files.has(part)) return;
    if (depth > 24 || files.size >= 300 || !allowed(part)) { issues.push('相對依賴超出可追蹤範圍'); return; }
    let text;
    try { text = readFileSync(safeFile(root, part), 'utf8'); } catch { issues.push(`無法追蹤檔案：${part}`); return; }
    files.set(part, hash(text));
    if (part.startsWith('api/')) apiFiles.add(part);
    if (!/\.[cm]?[jt]sx?$/.test(part)) return;
    const file = ts.createSourceFile(part, text, ts.ScriptTarget.Latest, true), arrays = new Map();
    if (file.parseDiagnostics.length) issues.push(`語法需核對：${part}`);
    for (const statement of file.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer && ts.isArrayLiteralExpression(declaration.initializer) && declaration.initializer.elements.every(ts.isStringLiteralLike)) arrays.set(declaration.name.text, declaration.initializer.elements.map(node => node.text));
      if (part.startsWith('api/') && ts.isIdentifier(declaration.name) && declaration.name.text === 'operation' && declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer)) {
        const fields = Object.fromEntries(declaration.initializer.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(file).replace(/^['"]|['"]$/g, ''), p.initializer]));
        const body = fields.body && ts.isObjectLiteralExpression(fields.body) ? Object.fromEntries(fields.body.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(file).replace(/^['"]|['"]$/g, ''), p.initializer])) : {};
        const read = node => node && ts.isStringLiteralLike(node) ? node.text : '';
        apiContracts[part] = hash(JSON.stringify([read(fields.kind), read(fields.method), read(fields.endpoint), read(body.operationName), read(body.query).replace(/\s+/g, ' ').trim()]));
      }
    }
    function string(node) {
      if (node && ts.isStringLiteralLike(node)) return node.text;
      if (node && ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && ts.isNumericLiteral(node.argumentExpression)) return arrays.get(node.expression.text)?.[Number(node.argumentExpression.text)];
    }
    function walk(node) {
      if (part === source && ts.isObjectLiteralExpression(node)) {
        const values = Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(file).replace(/^['"]|['"]$/g, ''), string(p.initializer)]));
        if (values.type === 'archify-case' && values.description) caseIds.add(values.description);
        if (values.type === 'archify-id' && values.description) apiIds.add(values.description);
      }
      if (part === source && ts.isCallExpression(node) && node.expression.getText(file) === 'test.step') { const name = string(node.arguments[0]); if (name) steps.push(name); }
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(file) === 'require')) issues.push(`含動態載入，需核對依賴：${part}`);
      ts.forEachChild(node, walk);
    }
    walk(file);
    for (const statement of file.statements) {
      const specifier = (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier;
      if (!specifier || !ts.isStringLiteralLike(specifier)) continue;
      const value = specifier.text;
      if (!value.startsWith('.')) { if (value.startsWith('/') || /^[A-Za-z]:/.test(value)) issues.push('含絕對路徑依賴'); continue; }
      const base = resolve(dirname(resolve(root, part)), value), rel = slash(relative(root, base));
      if (rel.startsWith('..') || isAbsolute(rel)) { issues.push('相對依賴離開測試專案'); continue; }
      const candidates = [rel, rel.replace(/\.js$/, '.ts'), rel.replace(/\.mjs$/, '.mts'), rel.replace(/\.cjs$/, '.cts'), rel + '.ts', rel + '.mjs', rel + '/index.ts'];
      const found = [...new Set(candidates)].find(candidate => existsSync(resolve(root, candidate)));
      if (!found) { issues.push(`找不到相對依賴：${rel}`); continue; }
      visit(found, depth + 1);
    }
  }
  visit(source);
  for (const part of ['package.json', 'package-lock.json', 'playwright.config.ts', 'config/http.json', 'support/archify-reporter.mjs', 'support/script-evidence.mjs']) {
    if (existsSync(resolve(root, part))) visit(part);
    else if (part === 'package-lock.json') issues.push('缺少鎖檔，無法核對套件版本');
  }
  const rows = [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, hash]) => ({ path, hash }));
  return { schemaVersion: 1, hash: hash(JSON.stringify(rows)), complete: issues.length === 0, files: rows, issues: [...new Set(issues)], caseIds: [...caseIds], apiIds: [...apiIds], apiFiles: [...apiFiles], apiContracts, steps };
}

export function caseEvidence(root, source, declaredId) {
  try {
    const catalog = JSON.parse(readFileSync(safeFile(root, 'test-cases/catalog.json'), 'utf8'));
    const matches = catalog.cases.filter(row => declaredId ? row.id === declaredId : row.script === source);
    if (matches.length !== 1) return null;
    const row = matches[0];
    const index = existsSync(resolve(root, 'knowledge/index.json')) ? JSON.parse(readFileSync(safeFile(root, 'knowledge/index.json'), 'utf8')) : { documents: [] };
    const references = (row.knowledgeIds || []).slice().sort().map(id => {
      const doc = index.documents.find(doc => doc.id === id);
      if (!doc || !/^[a-f0-9-]{36}$/.test(id) || !['md', 'txt'].includes(doc.format)) return [id, 'missing'];
      try { return [id, hash(readFileSync(safeFile(root, `knowledge/documents/${id}.${doc.format}`)))]; } catch { return [id, 'missing']; }
    });
    return { caseId: row.id, intentHash: intentHash(row), knowledgeHash: hash(JSON.stringify(references, null, 2) + '\n'), complete: !references.some(([, hash]) => hash === 'missing') };
  } catch { return null; }
}
