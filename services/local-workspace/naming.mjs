import { parse } from 'graphql';

const generic = name => !name || /^(query|mutation|subscription|anonymous(?:-[a-f0-9]+)?)$/i.test(name);
function fieldName(item) {
  if (item.kind !== 'graphql' || !generic(item.operationName) || typeof item.body?.query !== 'string') return '';
  try {
    const document = parse(item.body.query);
    const operations = document.definitions.filter(node => node.kind === 'OperationDefinition');
    const operation = item.operationName ? operations.find(node => node.name?.value === item.operationName) : operations.length === 1 ? operations[0] : undefined;
    if (!operation) return '';
    const fragments = new Map(document.definitions.filter(node => node.kind === 'FragmentDefinition').map(node => [node.name.value, node]));
    const fields = new Set();
    function collect(selectionSet, seen = new Set()) {
      for (const selection of selectionSet.selections) {
        if (selection.kind === 'Field' && selection.name.value !== '__typename') fields.add(selection.name.value);
        if (selection.kind === 'InlineFragment') collect(selection.selectionSet, seen);
        if (selection.kind === 'FragmentSpread' && !seen.has(selection.name.value) && fragments.has(selection.name.value)) collect(fragments.get(selection.name.value).selectionSet, new Set([...seen, selection.name.value]));
      }
    }
    collect(operation.selectionSet);
    return [...fields].map(name => name[0].toUpperCase() + name.slice(1)).join('And');
  } catch { return ''; }
}
export const operationTitle = item => fieldName(item) || item.name;
export function operationStems(requests, { legacy = false } = {}) {
  const stems = new Map();
  const base = item => {
    let endpoint = item.endpoint || 'unknown-endpoint';
    try { if (/^https?:/.test(endpoint)) endpoint = new URL(endpoint).pathname; } catch {}
    let value = (!legacy && fieldName(item)) || item.operationName || `${item.method}-${endpoint.split('?')[0].split('#')[0]}`;
    value = value.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96) || 'operation';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value)) value = 'operation-' + value;
    return value;
  };
  const names = requests.map(item => base(item));
  for (const [index, item] of requests.entries()) {
    const name = names[index];
    const collides = names.filter(value => value.toLowerCase() === name.toLowerCase()).length > 1;
    stems.set(item.id, collides ? `${name}-${item.id.slice(0, 8)}` : name);
  }
  return stems;
}
export const legacyOperationStems = requests => operationStems(requests, { legacy: true });
export function artifactNames(apiDir, id, stem) {
  return [`${apiDir}/${stem}.case.mjs`, `requests/generated/${stem}.json`, `fixtures/api/${stem}.json`];
}
