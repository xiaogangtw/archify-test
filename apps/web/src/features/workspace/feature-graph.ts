import type { CaseView, Catalog, CatalogView, Feature } from './catalog';

export type NodeKind = 'project' | 'feature' | 'page' | 'case' | 'step' | 'api' | 'question';
export type CoverageLevel = 'full' | 'partial' | 'none' | 'retired';
export interface CoverageMetrics {
  coverage: CoverageLevel;
  caseCount: number;
  positiveCount: number;
  negativeCount: number;
  boundaryCount: number;
  securityCount: number;
  errorCount: number;
  missingFactors: string[];
}
export interface TreeCoverageMetrics extends CoverageMetrics {
  isGroup: boolean;
  childCount: number;
}
export interface TreeFeatureItem {
  feature: Feature;
  depth: number;
  parentName?: string;
}
export interface MapNode {
  id: string;
  kind: NodeKind;
  label: string;
  featureId?: string;
  caseId?: string;
  path?: string;
  scope?: string;
  step?: number;
  x: number;
  y: number;
  coverage?: CoverageLevel;
  caseCount?: number;
  level?: 1 | 2 | 3 | 4;
  isGroup?: boolean;
}
export interface MapEdge { id: string; from: string; to: string; direction: 'down' | 'left' | 'right'; dashed?: boolean; label?: string }
export const nodeSize = { width: 220, height: 88 };

const boundaryPattern = /邊界|超過|重複|空狀態|上限|下限|最大|最小|boundary|limit|empty|duplicate|max|min/i;
const securityPattern = /權限|安全|未登入|未授權|鎖定|爆破|token|permission|security|unauthorized|forbidden|auth/i;
const errorPattern = /逾時|超時|斷線|異常|錯誤|500|timeout|network|error/i;
const negativePattern = /失敗|無效|找不到|阻擋|拒絕|禁止|不允許|不可|缺少|invalid|fail|deny|reject|negative|missing/i;
const pureNegativeTitle = /失敗|異常|錯誤|無效|找不到|阻擋|拒絕|禁止|逾時|超時|空狀態|invalid|fail|error|deny|reject|timeout|negative|unauthorized|forbidden/i;

export function featureCoverage(cases: CaseView[], feature?: Feature): CoverageMetrics {
  let positiveCount = 0;
  let negativeCount = 0;
  let boundaryCount = 0;
  let securityCount = 0;
  let errorCount = 0;
  for (const item of cases) {
    if (item.factor === 'positive') { positiveCount++; continue; }
    if (item.factor === 'negative') { negativeCount++; continue; }
    if (item.factor === 'boundary') { boundaryCount++; continue; }
    if (item.factor === 'security') { securityCount++; continue; }
    if (item.factor === 'error') { errorCount++; continue; }
    const text = `${item.id} ${item.title} ${item.purpose} ${item.expected}`;
    let matchedNonPositive = false;
    if (boundaryPattern.test(text)) { boundaryCount++; matchedNonPositive = true; }
    else if (securityPattern.test(text)) { securityCount++; matchedNonPositive = true; }
    else if (errorPattern.test(text)) { errorCount++; matchedNonPositive = true; }
    else if (negativePattern.test(text)) { negativeCount++; matchedNonPositive = true; }
    if (!matchedNonPositive || !pureNegativeTitle.test(`${item.id} ${item.title}`)) {
      if (!matchedNonPositive) positiveCount++;
    }
  }
  const nonPositiveTotal = negativeCount + boundaryCount + securityCount + errorCount;
  const missingFactors: string[] = [];
  if (positiveCount === 0) missingFactors.push('正向冒煙');
  if (nonPositiveTotal === 0) missingFactors.push('反向／邊界／異常驗證');
  const base = { caseCount: cases.length, positiveCount, negativeCount, boundaryCount, securityCount, errorCount, missingFactors };
  if (feature?.frontend?.state === 'not-found') return { ...base, coverage: 'retired' };
  if (!cases.length) return { ...base, coverage: 'none' };
  if (positiveCount >= 1 && nonPositiveTotal >= 1) return { ...base, coverage: 'full' };
  return { ...base, coverage: 'partial' };
}

export function singleSystemRootFeature(
  catalog: Pick<Catalog, 'features'>,
  cases: Pick<CaseView, 'featureId'>[],
): Feature | undefined {
  const roots = catalog.features.filter(
    row => row.frontend?.level === 1 && !row.frontend?.parentId,
  );
  if (roots.length !== 1) return undefined;
  const root = roots[0];
  if (root.frontend?.state === 'not-found') return undefined;
  if ((root.frontend?.pageIds?.length || 0) > 0 || (root.frontend?.apiIds?.length || 0) > 0) {
    return undefined;
  }
  if (cases.some(item => item.featureId === root.id)) return undefined;
  if (!catalog.features.some(row => row.frontend?.parentId === root.id)) return undefined;
  return root;
}

export function directChildFeatures(features: Feature[], parentId: string): Feature[] {
  return features.filter(row => row.frontend?.parentId === parentId);
}

export function subtreeFeatureIds(features: Feature[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const row of features) {
    const parentId = row.frontend?.parentId;
    if (!parentId) continue;
    const list = childrenByParent.get(parentId);
    if (list) list.push(row.id);
    else childrenByParent.set(parentId, [row.id]);
  }
  const visited = new Set<string>();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const childId of childrenByParent.get(id) || []) {
      if (!visited.has(childId)) stack.push(childId);
    }
  }
  return visited;
}

export function featureAncestors(
  features: Feature[],
  featureId: string,
  ignoreRootId?: string,
): Feature[] {
  const byId = new Map(features.map(row => [row.id, row]));
  const chain: Feature[] = [];
  const seen = new Set<string>([featureId]);
  let cursor = byId.get(featureId);
  while (cursor?.frontend?.parentId) {
    const parentId = cursor.frontend.parentId;
    if (seen.has(parentId)) break;
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    if (parent.id !== ignoreRootId) chain.unshift(parent);
    cursor = parent;
  }
  return chain;
}

export function orderedFeatureTree(features: Feature[], ignoreRootId?: string): TreeFeatureItem[] {
  const visible = features.filter(row => row.id !== ignoreRootId);
  const byId = new Map(visible.map(row => [row.id, row]));
  const children = new Map<string, Feature[]>();
  const roots: Feature[] = [];
  for (const row of visible) {
    const parentId = row.frontend?.parentId;
    if (parentId && byId.has(parentId)) {
      const list = children.get(parentId);
      if (list) list.push(row);
      else children.set(parentId, [row]);
    } else {
      roots.push(row);
    }
  }
  const result: TreeFeatureItem[] = [];
  const seen = new Set<string>();
  function walk(node: Feature, depth: number) {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    const parent = node.frontend?.parentId ? byId.get(node.frontend.parentId) : undefined;
    result.push({ feature: node, depth, parentName: parent?.name });
    for (const child of children.get(node.id) || []) walk(child, depth + 1);
  }
  for (const root of roots) walk(root, 0);
  for (const row of visible) if (!seen.has(row.id)) walk(row, 0);
  return result;
}

export function featureTreeCoverage(
  featureId: string,
  view: Pick<CatalogView, 'catalog' | 'cases'>,
  cache = new Map<string, TreeCoverageMetrics>(),
  stack = new Set<string>(),
): TreeCoverageMetrics {
  const cached = cache.get(featureId);
  if (cached) return cached;
  const features = view.catalog.features;
  const feature = features.find(row => row.id === featureId);
  const ownCases = view.cases.filter(row => row.featureId === featureId);
  const children = directChildFeatures(features, featureId);
  if (feature?.frontend?.state === 'not-found' || ownCases.length > 0 || !children.length || stack.has(featureId)) {
    const value = {
      ...featureCoverage(ownCases, feature),
      isGroup: children.length > 0,
      childCount: children.length,
    };
    cache.set(featureId, value);
    return value;
  }
  const nextStack = new Set(stack);
  nextStack.add(featureId);
  const childMetrics = children.map(child => featureTreeCoverage(child.id, view, cache, nextStack));
  const subtree = subtreeFeatureIds(features, featureId);
  subtree.delete(featureId);
  const descendantCases = view.cases.filter(row => subtree.has(row.featureId));
  const agg = featureCoverage(descendantCases, feature);
  const activeChildren = childMetrics.filter(item => item.coverage !== 'retired');
  let coverage: CoverageLevel;
  if (!activeChildren.length) coverage = 'retired';
  else if (activeChildren.every(item => item.coverage === 'full')) coverage = 'full';
  else if (activeChildren.every(item => item.coverage === 'none')) coverage = 'none';
  else coverage = 'partial';
  const missingFactors =
    coverage === 'full' || coverage === 'retired'
      ? []
      : agg.missingFactors.length
        ? agg.missingFactors
        : ['部分子功能尚未完整覆蓋'];
  const value = {
    ...agg,
    coverage,
    missingFactors,
    isGroup: true,
    childCount: children.length,
  };
  cache.set(featureId, value);
  return value;
}

function layoutFeatureHierarchy(
  rootNode: MapNode,
  visibleFeatures: Feature[],
  view: Pick<CatalogView, 'catalog' | 'cases'>,
  coverageCache: Map<string, TreeCoverageMetrics>,
) {
  const nodes: MapNode[] = [rootNode];
  const edges: MapEdge[] = [];
  const featureMap = new Map(visibleFeatures.map(row => [row.id, row]));
  const roots = visibleFeatures.filter(
    row => !row.frontend?.parentId || !featureMap.has(row.frontend.parentId),
  );
  const minRootLevel = roots.length
    ? Math.min(...roots.map(row => row.frontend?.level ?? 1))
    : 1;
  const depthCache = new Map<string, number>();
  const depthOf = (id: string, seen = new Set<string>()): number => {
    if (depthCache.has(id)) return depthCache.get(id)!;
    const item = featureMap.get(id);
    const parentId = item?.frontend?.parentId;
    let depth =
      item?.frontend?.level !== undefined
        ? Math.max(0, item.frontend.level - minRootLevel)
        : 0;
    if (parentId && featureMap.has(parentId) && !seen.has(parentId)) {
      const nextSeen = new Set(seen);
      nextSeen.add(parentId);
      depth = Math.max(depth, depthOf(parentId, nextSeen) + 1);
    }
    depthCache.set(id, depth);
    return depth;
  };
  const rows = new Map<number, Feature[]>();
  for (const item of visibleFeatures) {
    const d = depthOf(item.id);
    const list = rows.get(d);
    if (list) list.push(item);
    else rows.set(d, [item]);
  }
  const sortedDepths = [...rows.keys()].sort((a, b) => a - b);
  const maxCols = sortedDepths.length
    ? Math.max(1, ...sortedDepths.map(d => Math.min(5, rows.get(d)!.length)))
    : 1;
  const width = Math.max(940, maxCols * 300 + 80);
  nodes[0].x = width / 2 - nodeSize.width / 2;
  let currentY = 230;
  for (const d of sortedDepths) {
    const group = rows.get(d)!;
    const cols = Math.min(5, group.length);
    group.forEach((feature, index) => {
      const id = 'feature:' + feature.id;
      const cov = featureTreeCoverage(feature.id, view, coverageCache);
      const x = 70 + (index % cols) * 300;
      const y = currentY + Math.floor(index / cols) * 160;
      nodes.push({
        id,
        kind: 'feature',
        featureId: feature.id,
        label: feature.name,
        x,
        y,
        coverage: cov.coverage,
        caseCount: cov.caseCount,
        level: feature.frontend?.level,
        isGroup: cov.isGroup,
      });
      const parent =
        feature.frontend?.parentId && featureMap.has(feature.frontend.parentId)
          ? 'feature:' + feature.frontend.parentId
          : rootNode.id;
      edges.push({
        id: (parent === rootNode.id ? 'root-' : 'tree-') + id,
        from: parent,
        to: id,
        direction: 'down',
        dashed: feature.frontend?.evidence === 'inferred' || feature.frontend?.state === 'not-found',
      });
    });
    currentY += Math.ceil(group.length / cols) * 160 + 40;
  }
  const height = Math.max(500, currentY + 40);
  for (const [index, relation] of (view.catalog.frontendAnalysis?.relations || []).entries()) {
    if (
      !nodes.some(node => node.id === 'feature:' + relation.from) ||
      !nodes.some(node => node.id === 'feature:' + relation.to)
    ) {
      continue;
    }
    edges.push({
      id: 'relation:' + index,
      from: 'feature:' + relation.from,
      to: 'feature:' + relation.to,
      direction: 'right',
      dashed: relation.evidence !== 'code',
      label: relation.kind === 'navigation' ? '導航' : '相關',
    });
  }
  return { nodes, edges, width, height };
}

export function featureGraph(view: CatalogView, featureId: string, layer = 'tests') {
  const coverageCache = new Map<string, TreeCoverageMetrics>();
  if (featureId === 'overview') {
    const systemRoot = singleSystemRootFeature(view.catalog, view.cases);
    const visibleFeatures = systemRoot
      ? view.catalog.features.filter(row => row.id !== systemRoot.id)
      : view.catalog.features;
    const rootNode: MapNode = {
      id: 'project',
      kind: 'project',
      label: systemRoot ? systemRoot.name : '前端功能總覽',
      x: 0,
      y: 40,
    };
    return layoutFeatureHierarchy(rootNode, visibleFeatures, view, coverageCache);
  }
  const feature = view.catalog.features.find(row => row.id === featureId);
  const nodes: MapNode[] = [], edges: MapEdge[] = [];
  if (!feature) return { nodes, edges, width: 940, height: 560 };
  const featureCov = featureTreeCoverage(feature.id, view, coverageCache);
  const directChildren = directChildFeatures(view.catalog.features, feature.id);
  const descendantIds = subtreeFeatureIds(view.catalog.features, feature.id);
  descendantIds.delete(feature.id);
  const descendantFeatures = view.catalog.features.filter(row => descendantIds.has(row.id));
  if (layer === 'product') {
    const data = view.catalog.frontendAnalysis, pages = data?.pages.filter(page => feature.frontend?.pageIds.includes(page.id)) || [], apis = data?.apis.filter(api => feature.frontend?.apiIds.includes(api.id)) || [];
    if (directChildren.length > 0 && pages.length === 0 && apis.length === 0) {
      const branchRoot: MapNode = {
        id: 'feature:' + feature.id,
        kind: 'feature',
        featureId,
        label: feature.name,
        x: 0,
        y: 40,
        coverage: featureCov.coverage,
        caseCount: featureCov.caseCount,
        level: feature.frontend?.level,
        isGroup: featureCov.isGroup,
      };
      return layoutFeatureHierarchy(branchRoot, descendantFeatures, view, coverageCache);
    }
    const nodes: MapNode[] = [{ id: 'feature:' + feature.id, kind: 'feature', featureId, label: feature.name, x: 360, y: 40, coverage: featureCov.coverage, caseCount: featureCov.caseCount, level: feature.frontend?.level, isGroup: featureCov.isGroup }], edges: MapEdge[] = [];
    const columns = Math.max(1, Math.ceil(Math.sqrt(pages.length))), width = Math.max(940, columns * 300 + 80);
    nodes[0].x = width / 2 - 110;
    pages.forEach((page, index) => { const route = data?.routes.find(route => page.routeIds.includes(route.id)); const id = 'page:' + page.id; nodes.push({ id, kind: 'page', featureId, label: route?.title || page.path.split('/').at(-1)?.replace(/\.[^.]+$/, '') || page.path, path: page.path, scope: 'source', x: 70 + index % columns * 300, y: 240 + Math.floor(index / columns) * 150 }); edges.push({ id: 'feature-' + id, from: nodes[0].id, to: id, direction: 'down', dashed: feature.frontend?.evidence === 'inferred' }); });
    const apiTop = 300 + Math.ceil(pages.length / columns) * 150;
    apis.forEach((api, index) => { const id = 'product-api:' + api.id; nodes.push({ id, kind: 'api', featureId, label: api.name, path: api.apiFile, scope: 'project', x: 70 + index % columns * 300, y: apiTop + Math.floor(index / columns) * 150 }); edges.push({ id: 'feature-' + id, from: nodes[0].id, to: id, direction: 'down', dashed: true, label: index === 0 ? '靜態可達 API' : undefined }); });
    return { nodes, edges, width, height: Math.max(500, apiTop + Math.ceil(apis.length / columns) * 150 + 80) };
  }
  const cases = view.cases.filter(row => row.featureId === featureId);
  if (directChildren.length > 0 && cases.length === 0) {
    const branchRoot: MapNode = {
      id: 'feature:' + feature.id,
      kind: 'feature',
      featureId,
      label: feature.name,
      x: 0,
      y: 40,
      coverage: featureCov.coverage,
      caseCount: featureCov.caseCount,
      level: feature.frontend?.level,
      isGroup: featureCov.isGroup,
    };
    return layoutFeatureHierarchy(branchRoot, descendantFeatures, view, coverageCache);
  }
  const root = 'feature:' + feature.id;
  const stepGapY = 116;
  const sideOffset = 260;
  const colGap = 64;
  const rowGap = 68;
  const targetCols = cases.length <= 2 ? Math.max(1, cases.length) : cases.length <= 6 ? 2 : cases.length <= 12 ? 3 : 4;
  const blocks = cases.map(row => {
    const hasIssues = row.issues.length > 0;
    const hasApis = row.apis.length > 0;
    const caseRelX = hasIssues ? sideOffset : 0;
    const blockWidth = caseRelX + nodeSize.width + (hasApis ? sideOffset : 0);
    const blockHeight = Math.max(row.declaredSteps.length + 1, row.apis.length, 1) * stepGapY - 28;
    return { row, hasIssues, hasApis, caseRelX, blockWidth, blockHeight };
  });
  const gridRows: { items: typeof blocks; width: number; height: number }[] = [];
  let currentRow: typeof blocks = [], currentWidth = 0, currentHeight = 0;
  for (const block of blocks) {
    const nextWidth = currentRow.length ? currentWidth + colGap + block.blockWidth : block.blockWidth;
    if (currentRow.length && (currentRow.length >= targetCols || nextWidth > 2600)) {
      gridRows.push({ items: currentRow, width: currentWidth, height: currentHeight });
      currentRow = [block];
      currentWidth = block.blockWidth;
      currentHeight = block.blockHeight;
    } else {
      currentRow.push(block);
      currentWidth = nextWidth;
      currentHeight = Math.max(currentHeight, block.blockHeight);
    }
  }
  if (currentRow.length) gridRows.push({ items: currentRow, width: currentWidth, height: currentHeight });
  const width = Math.max(940, ...gridRows.map(group => group.width + 80));
  nodes.push({ id: root, kind: 'feature', featureId, label: feature.name, x: width / 2 - nodeSize.width / 2, y: 40, coverage: featureCov.coverage, caseCount: featureCov.caseCount, level: feature.frontend?.level, isGroup: featureCov.isGroup });
  let rowTop = 210;
  for (const group of gridRows) {
    let cursorX = (width - group.width) / 2;
    for (const block of group.items) {
      const { row, caseRelX, blockWidth } = block;
      const caseX = cursorX + caseRelX;
      const id = 'case:' + row.id;
      nodes.push({ id, kind: 'case', label: row.title, caseId: row.id, x: caseX, y: rowTop });
      edges.push({ id: root + id, from: root, to: id, direction: 'down' });
      let previous = id;
      row.declaredSteps.forEach((label, index) => {
        const stepId = `${id}:step:${index}`;
        nodes.push({ id: stepId, kind: 'step', label, caseId: row.id, step: index, x: caseX, y: rowTop + (index + 1) * stepGapY });
        edges.push({ id: previous + stepId, from: previous, to: stepId, direction: 'down', dashed: true, label: index === 0 ? '宣告流程' : undefined });
        previous = stepId;
      });
      row.apis.forEach((api, index) => {
        const apiId = `${id}:api:${api.path}`;
        nodes.push({ id: apiId, kind: 'api', label: api.name, caseId: row.id, path: api.path, x: caseX + sideOffset, y: rowTop + index * stepGapY });
        edges.push({ id: id + apiId, from: id, to: apiId, direction: 'right', label: index === 0 ? '引用' : undefined });
      });
      if (row.issues.length) {
        const issueId = id + ':questions';
        nodes.push({ id: issueId, kind: 'question', label: `${row.issues.length} 項待確認`, caseId: row.id, x: cursorX, y: rowTop });
        edges.push({ id: id + issueId, from: id, to: issueId, direction: 'left', dashed: true, label: '待確認' });
      }
      cursorX += blockWidth + colGap;
    }
    rowTop += group.height + rowGap;
  }
  const height = Math.max(440, gridRows.length ? rowTop - rowGap + 48 : 440);
  return { nodes, edges, width, height };
}

export function labelLines(value: string) {
  const lines: string[] = []; let line = '', width = 0;
  for (const char of Array.from(value)) {
    const unit = /[\u0000-\u007f]/.test(char) ? 0.55 : 1;
    if (width + unit > 13) { lines.push(line); line = ''; width = 0; }
    line += char; width += unit;
  }
  if (line) lines.push(line);
  return lines.length > 2 ? [lines[0], lines[1].slice(0, -1) + '…'] : lines;
}
