import { validateFeatureMap } from '../../test-project/support/feature-map.mjs';

// Scope whole existing features so a partial result cannot retire sibling pages.
export function featureAnalysisScope(evidence, knowledgeRevision, sourceRoot) {
  const baseline = evidence.previousAnalysis;
  const full = reason => ({ mode: 'full', reason, evidence, preserved: [] });
  if (!baseline?.incremental || baseline.incremental.sourceRoot !== sourceRoot) return full('首次分析或來源位置改變');
  if (baseline.incremental.knowledgeRevision !== knowledgeRevision) return full('專案知識已變更');
  const changed = new Set([...evidence.changes.added, ...evidence.changes.modified, ...evidence.changes.removed]);
  if (evidence.warnings.some(warning => !(baseline.warnings || []).includes(warning) || [...changed].some(path => warning.includes(path))) || JSON.stringify(evidence.unresolved)!==JSON.stringify(baseline.unresolved || []) || evidence.unresolved.some(row => changed.has(row.path))) return full('解析警告或未解析來源受到變更影響');
  if (!changed.size) return { mode: 'unchanged', reason: '來源與知識未變更', evidence };
  if ([...changed].some(path => /(?:^|\/)(?:tsconfig[^/]*|jsconfig[^/]*|package)\.json$/.test(path))) return full('來源解析設定已變更');
  if (JSON.stringify(baseline.routes) !== JSON.stringify(evidence.routes)) return full('路由對應或 metadata 已變更');
  const previous = evidence.previousFeatures.filter(row => row.frontend?.state === 'active');
  const affected = new Set(evidence.changes.affectedFeatures);
  const pages = new Set(evidence.pages.filter(page => page.dependencies.some(path => changed.has(path))).map(page => page.id));
  const apis = new Set(evidence.apis.filter(api => api.evidence.some(source => changed.has(source.path))).map(api => api.id));
  const oldPages = new Set(baseline.pages.map(row => row.id)), oldApis = new Set(baseline.apis.map(row => row.id));
  for (const page of evidence.pages) if (!oldPages.has(page.id)) pages.add(page.id);
  for (const api of evidence.apis) if (!oldApis.has(api.id)) apis.add(api.id);
  const currentPages = new Set(evidence.pages.map(row => row.id)), currentApis = new Set(evidence.apis.map(row => row.id));
  for (const row of previous) if (row.frontend.pageIds.some(id => pages.has(id) || !currentPages.has(id)) || row.frontend.apiIds.some(id => apis.has(id) || !currentApis.has(id))) affected.add(row.id);
  for (const row of previous) if (affected.has(row.id)) {
    for (const id of row.frontend.pageIds) if (currentPages.has(id)) pages.add(id);
    for (const id of row.frontend.apiIds) if (currentApis.has(id)) apis.add(id);
  }
  for (const page of evidence.pages) if (pages.has(page.id)) for (const id of page.apiIds) apis.add(id);
  // Unknown changed modules may be entry points, providers or runtime wiring.
  const known = new Set([...evidence.pages.flatMap(row => row.dependencies), ...previous.flatMap(row => row.frontend.dependencies || []), ...evidence.routes.flatMap(row => row.sources.map(source => source.path)), ...evidence.apis.flatMap(row => row.evidence.map(source => source.path))]);
  if ([...changed].some(path => !known.has(path))) return full('異動檔案無法界定頁面影響範圍');
  const preserved = previous.filter(row => !affected.has(row.id)).map(row => ({ id: row.id, name: row.name, ...row.frontend, sources: row.sources.filter(source => evidence.files.some(file => file.path === source.path && source.line <= file.lines)) }));
  if (preserved.some(row => !row.sources.length)) return full('既有功能證據無法安全保留');
  const scoped = { ...evidence, previousAnalysis: undefined, previousFeatures: evidence.previousFeatures.filter(row => affected.has(row.id)), pages: evidence.pages.filter(row => pages.has(row.id)), apis: evidence.apis.filter(row => apis.has(row.id)) };
  scoped.routes = evidence.routes.filter(row => scoped.pages.some(page => page.routeIds.includes(row.id)));
  const paths = new Set([...changed, ...scoped.pages.flatMap(row => row.dependencies), ...scoped.routes.flatMap(row => row.sources.map(source => source.path)), ...scoped.previousFeatures.flatMap(row => row.sources.map(source => source.path)), ...scoped.apis.flatMap(row => row.evidence.map(source => source.path))]);
  scoped.files = evidence.files.filter(row => paths.has(row.path));
  const mode = !changed.size ? 'unchanged' : 'incremental';
  return { mode, reason: mode === 'unchanged' ? '來源與知識未變更' : '依頁面依賴及既有功能歸屬分析', evidence: scoped, preserved, changed, affected, baseline };
}

export function mergeFeatureAnalysis(result, scope, evidence) {
  if (scope.mode === 'full') return result;
  validateFeatureMap(result, scope.evidence, { allowedParents: new Map(scope.preserved.map(row => [row.id, row])) });
  const preservedIds = new Set(scope.preserved.map(row => row.id));
  if (result.features.some(row => preservedIds.has(row.id))) throw new Error('增量結果使用未受影響功能的 ID，原地圖保留。');
  const features = [...scope.preserved, ...result.features];
  const ids = new Set(features.map(row => row.id));
  const relations = [...scope.baseline.relations.filter(row => ids.has(row.from) && ids.has(row.to) && !(scope.affected.has(row.from) && scope.affected.has(row.to)) && row.sources.every(source => !scope.changed.has(source.path) && evidence.files.some(file => file.path === source.path && source.line <= file.lines))), ...result.relations];
  const assignedPages = new Set(features.flatMap(row => row.pageIds)), assignedApis = new Set(features.flatMap(row => row.apiIds));
  const merged = { ...result, features, relations, unassignedPageIds: evidence.pages.filter(row => !assignedPages.has(row.id)).map(row => row.id), unassignedApiIds: evidence.apis.filter(row => !assignedApis.has(row.id)).map(row => row.id), notes: [...new Set([...(scope.baseline.notes || []), ...result.notes])].slice(-100) };
  validateFeatureMap(merged, evidence);
  return merged;
}
