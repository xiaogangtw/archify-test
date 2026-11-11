import { readdir, lstat, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { child, noLinks } from './paths.mjs';

const ts = createRequire(new URL('../../test-project/package.json', import.meta.url))('typescript');
const category = path => /^tests\/api\//.test(path) ? 'api' : /^tests\/flows\//.test(path) ? 'flow' : /^tests\/(ui|web)\//.test(path) ? 'web' : /^tests\/mobile\//.test(path) ? 'mobile' : 'other';

/** 只讀語法；不載入測試或依賴，不以內容存在宣稱已完成或通過。 */
export function inspectScript(source, path) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  if (file.parseDiagnostics.length) return { state: 'unknown', tests: 0, withContent: 0, skipped: 0 };
  const names = new Set(['test']);
  for (const node of file.statements) {
    if (!ts.isImportDeclaration(node)) continue;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const item of bindings.elements) if ((item.propertyName || item.name).text === 'test') names.add(item.name.text);
  }
  let tests = 0, withContent = 0, skipped = 0;
  function walk(node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const modifier = ts.isPropertyAccessExpression(expr) ? expr.name.text : '';
      const base = modifier ? expr.expression : expr;
      if (ts.isIdentifier(base) && names.has(base.text) && ['', 'skip', 'fixme', 'only'].includes(modifier)) {
        const callback = node.arguments.at(-1);
        if (node.arguments.length >= 2 && callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
          tests++;
          if (['skip', 'fixme'].includes(modifier)) skipped++;
          if (!ts.isBlock(callback.body) || callback.body.statements.some(statement => !ts.isEmptyStatement(statement))) withContent++;
        }
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(file);
  return { state: !tests ? 'unknown' : withContent ? 'content' : 'draft', tests, withContent, skipped };
}

export async function scriptInventory(config) {
  const scripts = [], warnings = [];
  let entriesSeen = 0, bytes = 0;
  async function walk(part, depth = 0) {
    if (depth > 30) throw new Error('測試目錄層級過深，無法提供完整腳本數量。');
    const directory = child(config.projectRoot, part); await noLinks(directory);
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      if (++entriesSeen > 5000) throw new Error('測試目錄超過 5000 項，無法提供完整腳本數量。');
      if (entry.name.startsWith('.') || ['node_modules', 'legacy', 'dist', 'build', 'coverage'].includes(entry.name)) continue;
      const path = `${part}/${entry.name}`;
      if (entry.isSymbolicLink()) { warnings.push(`已略過連結：${path}`); continue; }
      if (entry.isDirectory()) { await walk(path, depth + 1); continue; }
      if (!entry.isFile() || !/\.(spec|test)\.[cm]?[jt]sx?$/.test(entry.name)) continue;
      const file = child(config.projectRoot, path); await noLinks(file);
      const stat = await lstat(file);
      if (!stat.isFile()) throw new Error('測試檔案狀態已變更，請重新讀取。');
      bytes += stat.size;
      if (bytes > 20 * 1024 * 1024) throw new Error('測試腳本超過 20 MB，無法提供完整腳本數量。');
      let detail = { state: 'unknown', tests: 0, withContent: 0, skipped: 0 };
      if (stat.size > 1024 * 1024) warnings.push(`檔案超過 1 MB，內容待核對：${path}`);
      else detail = inspectScript(await readFile(file, 'utf8'), path);
      scripts.push({ path, category: category(path), ...detail });
    }
  }
  await walk('tests');
  scripts.sort((a, b) => a.path.localeCompare(b.path));
  return { scripts, warnings, summary: { total: scripts.length, content: scripts.filter(row => row.state === 'content').length, draft: scripts.filter(row => row.state === 'draft').length, unknown: scripts.filter(row => row.state === 'unknown').length } };
}
