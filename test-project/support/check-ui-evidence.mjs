import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
export function checkUiEvidence(root) {
  const errors = [];
  function visit(directory) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) { errors.push('畫面測試目錄不可含連結。'); continue; }
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) { visit(path); continue; }
      if (!/\.[cm]?[jt]s$/.test(entry.name)) continue;
      const ast = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
      let usesFixture = false;
      for (const node of ast.statements) {
        if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
        const clause = node.importClause;
        if (!clause || clause.isTypeOnly) continue;
        const names = clause.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements.filter(item => !item.isTypeOnly).map(item => (item.propertyName || item.name).text) : [];
        const source = node.moduleSpecifier.text.replaceAll('\\', '/');
        if (/^(?:@playwright\/test|playwright)(?:\/|$)/.test(source) && (clause.name || names.some(name => ['test', 'expect', 'chromium', 'firefox', 'webkit'].includes(name)) || clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))) errors.push(path + '：畫面 test／expect 必須使用 support/web-test.js，不可自行啟動瀏覽器。');
        if (/\/support\/web-test\.[jt]s$/.test(source) && names.includes('test') && resolve(dirname(path), source).replace(/\.[jt]s$/, '') === resolve(root, 'support/web-test')) usesFixture = true;
      }
      if (/\.(spec|test)\.[cm]?[jt]s$/.test(entry.name) && !usesFixture) errors.push(path + '：缺少共用 support/web-test.js 的 test import。');
    }
  }
  for (const part of ['tests/ui', 'tests/web']) visit(resolve(root, part));
  if (errors.length) throw new Error(errors.join('\n'));
}
export default function setup(config) { checkUiEvidence(dirname(config.configFile)); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkUiEvidence(fileURLToPath(new URL('../', import.meta.url)));
  console.log('PASS：畫面腳本共用逐操作 fixture 檢查');
}
