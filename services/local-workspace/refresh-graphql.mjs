import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { playwrightSource } from './playwright-source.mjs';

const ts = createRequire(new URL('../../package.json', import.meta.url))('typescript');
function literal(node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) return -literal(node.operand);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node)) return Object.fromEntries(node.properties.map(property => {
    if (!ts.isPropertyAssignment(property) || ![ts.SyntaxKind.Identifier, ts.SyntaxKind.StringLiteral].includes(property.name.kind)) throw new Error('不是靜態物件。');
    return [property.name.text, literal(property.initializer)];
  }));
  throw new Error('包含人工動態邏輯。');
}
function operation(source) {
  const file = ts.createSourceFile('case.ts', source, ts.ScriptTarget.Latest, true);
  const nodes = file.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations]).filter(node => ts.isIdentifier(node.name) && node.name.text === 'operation');
  if (file.parseDiagnostics.length || nodes.length !== 1 || !nodes[0].initializer) throw new Error('測試格式需人工核對。');
  return { file, node: nodes[0].initializer, value: literal(nodes[0].initializer) };
}
const expected = item => ({ kind: item.kind, method: item.method, endpoint: item.endpoint, operationType: item.operationType || '', headers: item.headers || {}, queryParams: item.queryParams || {}, body: item.body ?? null });

// One-time payload refresh: retain scenario, business assertions, and all surrounding code.
export function refreshGraphqlSource(source, previous, next) {
  if (previous.kind !== 'graphql' || next.kind !== 'graphql' || previous.id !== next.id) return { skipped: '操作識別已變更，保留人工核對。' };
  try {
    const original = operation(source);
    if (!isDeepStrictEqual(original.value, expected(previous))) return { skipped: '請求已有人工作業，保留原檔。' };
    const before = { ...original.value, body: null }, after = { ...expected(next), body: null };
    if (!isDeepStrictEqual(before, after)) return { skipped: '其他請求設定已變更，保留原檔。' };
    const replacement = operation(playwrightSource(next, undefined, './support-placeholder.mjs'));
    const text = replacement.node.getText(replacement.file);
    return { source: source.slice(0, original.node.getStart(original.file)) + text + source.slice(original.node.getEnd()) };
  } catch { return { skipped: '測試包含動態或不同格式，保留原檔。' }; }
}
