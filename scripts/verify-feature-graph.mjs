import assert from 'node:assert/strict';
import {
  featureAncestors,
  featureCoverage,
  featureGraph,
  featureTreeCoverage,
  labelLines,
  nodeSize,
  orderedFeatureTree,
  singleSystemRootFeature,
  subtreeFeatureIds,
} from '../apps/web/src/features/workspace/feature-graph.ts';
const row = { id: 'TC-ONE', featureId: 'F-CARD', title: '名片流程', declaredSteps: ['登入', '查詢名片', '驗證結果'], apis: [{ path: 'api/Login.ts', name: 'Login' }, { path: 'api/GetCard.ts', name: 'GetCard' }], issues: [{ text: '權限待確認' }] };
const view = { catalog: { features: [{ id: 'F-CARD', name: '名片管理' }] }, cases: [row, { ...row, id: 'TC-TWO', title: '其他情境', declaredSteps: [], issues: [] }] };
const graph = featureGraph(view, 'F-CARD');
assert.equal(graph.nodes.filter(node => node.kind === 'case').length, 2);
assert.equal(graph.nodes.filter(node => node.kind === 'api').length, 4);
const ids = new Set(graph.nodes.map(node => node.id)); assert.equal(ids.size, graph.nodes.length);
for (const edge of graph.edges) {
  assert.ok(ids.has(edge.from) && ids.has(edge.to));
  const source = graph.nodes.find(node => node.id === edge.from), target = graph.nodes.find(node => node.id === edge.to);
  if (target.kind === 'step' || target.kind === 'question') assert.equal(edge.dashed, true, '未核對的宣告順序不得畫成已知流程');
  if (target.kind === 'api') assert.equal(source.kind, 'case', '引用不等於步驟呼叫順序');
}
for (const a of graph.nodes) for (const b of graph.nodes) if (a.id !== b.id) assert.ok(a.x + nodeSize.width <= b.x || b.x + nodeSize.width <= a.x || a.y + nodeSize.height <= b.y || b.y + nodeSize.height <= a.y, 'nodes must not overlap');
assert.deepEqual(featureGraph(view, 'missing').nodes, []);
assert.equal(labelLines('這是非常長的測試名稱必須能夠安全換行而不是蓋到連線上或其他節點').length, 2);
assert.ok(!graph.nodes.some(node => node.label.includes('取得 token')), '不能自行捏造缺少證據的業務步驟');
const overview=featureGraph(view,'overview');assert.equal(overview.nodes.filter(node=>node.kind==='feature').length,1);
const product=featureGraph({...view,catalog:{...view.catalog,features:[{id:'F-CARD',name:'名片管理',frontend:{pageIds:['P-ONE'],apiIds:[]}}],frontendAnalysis:{pages:[{id:'P-ONE',path:'src/pages/Card.tsx',routeIds:['R-ONE'],apiIds:[]}],routes:[{id:'R-ONE',title:'查看名片'}],apis:[]}}},'F-CARD','product');
assert.equal(product.nodes.filter(node=>node.kind==='page').length,1);assert.equal(product.nodes.filter(node=>node.kind==='case').length,0,'產品圖不得混入測試順序');
assert.equal(featureCoverage([]).coverage, 'none');
assert.equal(featureCoverage([{ ...row, id: 'TC-POS', title: '正常名片流程' }]).coverage, 'partial');
assert.equal(featureCoverage([{ ...row, id: 'TC-POS', title: '正常名片流程' }, { ...row, id: 'TC-NEG', title: '無權限阻擋失敗' }]).coverage, 'full');
assert.equal(featureCoverage([{ ...row, id: 'TC-1', title: '一般標題', factor: 'positive' }, { ...row, id: 'TC-2', title: '一般標題2', factor: 'boundary' }]).coverage, 'full');
assert.equal(featureCoverage([{ ...row, id: 'TC-1', title: '正常名片流程' }], { id: 'F-OLD', name: '舊功能', sources: [], frontend: { description: '', pageIds: [], apiIds: [], questions: [], evidence: 'code', state: 'not-found' } }).coverage, 'retired');
const layered = featureGraph({
  catalog: {
    features: [
      { id: 'F-SYS', name: '名片系統', sources: [], frontend: { description: '', pageIds: [], apiIds: [], questions: [], evidence: 'code', state: 'active', level: 1 } },
      { id: 'F-MOD', name: '名片模組', sources: [], frontend: { description: '', pageIds: [], apiIds: [], questions: [], evidence: 'code', state: 'active', level: 3, parentId: 'F-SYS' } },
      { id: 'F-EMPTY', name: '未測模組', sources: [], frontend: { description: '', pageIds: [], apiIds: [], questions: [], evidence: 'code', state: 'active', level: 4, parentId: 'F-MOD' } },
    ],
    cases: [],
  },
  cases: [
    { ...row, id: 'TC-POS', featureId: 'F-MOD', title: '正常名片流程' },
    { ...row, id: 'TC-NEG', featureId: 'F-MOD', title: '查無名片失敗' },
    { ...row, id: 'TC-ONE', featureId: 'F-SYS', title: '系統入口檢查' },
  ],
}, 'overview');
assert.equal(layered.nodes.find(n => n.featureId === 'F-SYS')?.coverage, 'partial');
assert.equal(layered.nodes.find(n => n.featureId === 'F-MOD')?.coverage, 'full');
assert.equal(layered.nodes.find(n => n.featureId === 'F-EMPTY')?.coverage, 'none');
for (const a of layered.nodes) for (const b of layered.nodes) if (a.id !== b.id) assert.ok(a.x + nodeSize.width <= b.x || b.x + nodeSize.width <= a.x || a.y + nodeSize.height <= b.y || b.y + nodeSize.height <= a.y, 'layered nodes must not overlap');
const manyCases = Array.from({ length: 23 }, (_, i) => ({ ...row, id: `TC-M-${i + 1}`, title: `案例 ${i + 1}`, declaredSteps: ['步驟一', '步驟二'], apis: [{ path: 'api/Login.ts', name: 'Login' }], issues: [] }));
const dense = featureGraph({ catalog: { features: [{ id: 'F-CARD', name: '名片管理' }] }, cases: manyCases }, 'F-CARD');
assert.equal(dense.nodes.filter(node => node.kind === 'case').length, 23);
assert.ok(dense.width <= 3000, `multi-case graph should wrap into rows, got width ${dense.width}`);
for (const a of dense.nodes) for (const b of dense.nodes) if (a.id !== b.id) assert.ok(a.x + nodeSize.width <= b.x || b.x + nodeSize.width <= a.x || a.y + nodeSize.height <= b.y || b.y + nodeSize.height <= a.y, 'dense multi-row nodes must not overlap');
const aiwowView = {
  catalog: {
    features: [
      { id: 'F-ROOT', name: 'Aiwow 智慧名片系統', sources: [], frontend: { description: '系統總稱', pageIds: [], apiIds: [], questions: [], evidence: 'code', state: 'active', level: 1 } },
      { id: 'F-DOM', name: '名片域', sources: [], frontend: { description: '域層', pageIds: [], apiIds: [], questions: [], evidence: 'code', state: 'active', level: 2, parentId: 'F-ROOT' } },
      { id: 'F-LEAF-OK', name: '查看名片', sources: [], frontend: { description: '', pageIds: [], apiIds: [], questions: [], evidence: 'code', state: 'active', level: 4, parentId: 'F-DOM' } },
      { id: 'F-LEAF-MISS', name: '刪除名片', sources: [], frontend: { description: '', pageIds: [], apiIds: [], questions: [], evidence: 'code', state: 'active', level: 4, parentId: 'F-DOM' } },
    ],
    cases: [],
  },
  cases: [
    { ...row, id: 'TC-LEAF-1', featureId: 'F-LEAF-OK', title: '正常查看名片' },
    { ...row, id: 'TC-LEAF-2', featureId: 'F-LEAF-OK', title: '查無名片失敗' },
  ],
};
assert.equal(singleSystemRootFeature(aiwowView.catalog, aiwowView.cases)?.id, 'F-ROOT');
const aiwowOverview = featureGraph(aiwowView, 'overview');
assert.equal(aiwowOverview.nodes.find(n => n.kind === 'project')?.label, 'Aiwow 智慧名片系統');
assert.equal(aiwowOverview.nodes.some(n => n.featureId === 'F-ROOT'), false, 'redundant empty L1 wrapper folded into project node');
assert.equal(aiwowOverview.nodes.find(n => n.featureId === 'F-DOM')?.coverage, 'partial', 'group coverage rolled up from descendants');
assert.equal(aiwowOverview.nodes.find(n => n.featureId === 'F-DOM')?.isGroup, true);
assert.equal(aiwowOverview.nodes.find(n => n.featureId === 'F-LEAF-OK')?.isGroup, false);
assert.equal(aiwowOverview.nodes.find(n => n.featureId === 'F-DOM')?.caseCount, 2);
assert.equal(featureTreeCoverage('F-DOM', aiwowView).isGroup, true);
const branchProduct = featureGraph(aiwowView, 'F-DOM', 'product');
assert.equal(branchProduct.nodes.filter(n => n.kind === 'feature').length, 3, 'branch group drill-down renders child features');
const branchTests = featureGraph(aiwowView, 'F-DOM', 'tests');
assert.equal(branchTests.nodes.filter(n => n.kind === 'feature').length, 3);
for (const graphCandidate of [aiwowOverview, branchProduct, branchTests]) {
  for (const a of graphCandidate.nodes) for (const b of graphCandidate.nodes) if (a.id !== b.id) assert.ok(a.x + nodeSize.width <= b.x || b.x + nodeSize.width <= a.x || a.y + nodeSize.height <= b.y || b.y + nodeSize.height <= a.y, 'folded/branch nodes must not overlap');
}
assert.deepEqual(orderedFeatureTree(aiwowView.catalog.features, 'F-ROOT').map(item => [item.feature.id, item.depth]), [['F-DOM', 0], ['F-LEAF-OK', 1], ['F-LEAF-MISS', 1]]);
assert.deepEqual(featureAncestors(aiwowView.catalog.features, 'F-LEAF-OK', 'F-ROOT').map(f => f.id), ['F-DOM']);
assert.deepEqual([...subtreeFeatureIds(aiwowView.catalog.features, 'F-DOM')].sort(), ['F-DOM', 'F-LEAF-MISS', 'F-LEAF-OK']);
console.log('PASS feature graph: stable IDs, non-overlapping multi-case & layered layout, L1 system folding, rolled-up group coverage, branch drill-down, coverage classification (full/partial/none), truthful edge kinds, no guessed API sequence, long text and empty data.');
