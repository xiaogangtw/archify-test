import { readFile, lstat } from 'node:fs/promises';
import { resolve, relative, isAbsolute, parse } from 'node:path';
import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
export const planId = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(value);
export async function planFile(root, part, optional = false) {
  if (typeof part !== 'string' || part.includes('\\') || part.includes(':') || part.split('/').some(p => !p || p.startsWith('.'))) throw new Error('案例路徑不合法。');
  const path = resolve(root, part), rel = relative(resolve(root), path);
  if (isAbsolute(rel) || rel.startsWith('..')) throw new Error('案例路徑超出專案。');
  let current = parse(path).root;
  try {
    for (const segment of relative(current, path).split(/[\\/]/)) { current = resolve(current, segment); if ((await lstat(current)).isSymbolicLink()) throw new Error('案例資料不接受連結。'); }
    const stat = await lstat(path);
    if (!stat.isFile() || stat.size > (part === 'knowledge/index.json' ? 2 : 1) * 1024 * 1024) throw new Error('案例資料過大或非一般檔案。');
    return await readFile(path, 'utf8');
  } catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
}
export function planProblems(row) {
  const problems = [];
  for (const [key, label] of [['title', '案例名稱'], ['purpose', '測試目的'], ['preconditions', '前置條件（無則寫無）'], ['expected', '預期結果'], ['cleanup', '清理方式（無則寫不需清理）']]) if (typeof row[key] !== 'string' || !row[key].trim()) problems.push(`請補齊${label}`);
  if (!['api', 'web', 'mobile', 'mixed'].includes(row.target)) problems.push('請指定驗證對象');
  if (!Array.isArray(row.steps) || !row.steps.length || row.steps.some(step => !step || typeof step.action !== 'string' || !step.action.trim() || typeof step.expected !== 'string' || !step.expected.trim())) problems.push('請補齊每個測試步驟與預期');
  if (!Array.isArray(row.questions) || row.questions.some(q => !q.answer?.trim())) problems.push('仍有未回答的問題');
  return problems;
}
export async function planState(root, catalog, row, withReview = true) {
  const feature = catalog.features.find(value => value.id === row.featureId);
  const problems = planProblems(row);
  if (!feature) problems.push('找不到對應功能');
  const knowledge = JSON.parse(await planFile(root, 'knowledge/index.json', true) || '{"documents":[]}');
  const references = [];
  for (const id of [...(row.knowledgeIds || [])].sort()) {
    const doc = knowledge.documents.find(value => value.id === id);
    if (!doc || doc.archivedAt || doc.archived) { problems.push('相關知識已封存或遺失'); references.push([id, 'missing']); continue; }
    if (!/^[a-f0-9-]{36}$/.test(id) || !['md', 'txt'].includes(doc.format)) throw new Error('知識索引格式不合法。');
    const content = await planFile(root, `knowledge/documents/${id}.${doc.format}`, true);
    if (content === null) problems.push('相關知識檔案已遺失');
    references.push([id, doc.title, doc.category, doc.featureIds, content === null ? 'missing' : hash(content)]);
  }
  const fingerprint = hash(JSON.stringify({ row: { id: row.id, featureId: row.featureId, title: row.title, kind: row.kind, purpose: row.purpose, preconditions: row.preconditions, data: row.data, expected: row.expected, steps: row.steps || [], cleanup: row.cleanup || '', target: row.target || '', ...(row.factor ? { factor: row.factor } : {}), ...(row.decisionTable?.length ? { decisionTable: row.decisionTable } : {}), questions: row.questions || [], knowledgeIds: row.knowledgeIds || [] }, feature, sourceHash: catalog.frontendAnalysis?.sourceHash || null, references }));
  const source = withReview ? await planFile(root, `test-cases/reviews/${row.id}.json`, true) : null;
  const review = source ? JSON.parse(source) : null;
  const current = review?.schemaVersion === 1 && review.caseId === row.id && review.fingerprint === fingerprint && Number.isFinite(Date.parse(review.confirmedAt));
  return { fingerprint, problems: [...new Set(problems)], status: problems.length ? 'incomplete' : current ? 'confirmed' : review ? 'changed' : 'pending', confirmedAt: review?.confirmedAt || null };
}
