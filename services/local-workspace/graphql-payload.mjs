import { parse, print, visit, valueFromASTUntyped } from 'graphql';

const secret = /password|passwd|secret|token|authorization|cookie|api[-_]?key|credential/i;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const placeholder = path => `{{${path || 'value'}}}`;
function safe(value, path) {
  const key = path.split('.').at(-1);
  if (secret.test(key)) return placeholder(key.replace(/[^a-z0-9_]/gi, '_').toUpperCase());
  if (value === undefined || value === '秘密參照') return placeholder(path);
  if (Array.isArray(value)) return value.map((item, index) => safe(item, `${path}.${index}`));
  if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, safe(item, path ? `${path}.${key}` : key)]));
  return value;
}
function merge(values, path) {
  if (values.some(value => value === undefined)) return placeholder(path);
  if (values.every(value => JSON.stringify(value) === JSON.stringify(values[0]))) return values[0];
  if (values.every(object)) {
    const keys = [...new Set(values.flatMap(value => Object.keys(value)))];
    return Object.fromEntries(keys.map(key => [key, merge(values.map(value => value[key]), path ? `${path}.${key}` : key)]));
  }
  if (values.every(Array.isArray) && values.every(value => value.length === values[0].length)) return values[0].map((_, index) => merge(values.map(value => value[index]), `${path}.${index}`));
  return placeholder(path);
}

// Use request-site templates, not runtime execution or guessed business values.
export function graphqlPayload(value, usages = []) {
  if (!object(value) || typeof value.query !== 'string') return value;
  const original = parse(value.query);
  const operations = original.definitions.filter(node => node.kind === 'OperationDefinition' && (!value.operationName || node.name?.value === value.operationName));
  const defaults = {};
  const declared = [];
  for (const operation of operations) for (const variable of operation.variableDefinitions || []) {
    const name = variable.variable.name.value; declared.push(name);
    if (variable.defaultValue) defaults[name] = valueFromASTUntyped(variable.defaultValue);
  }
  const known = usages.filter(usage => object(usage.variables));
  const transport = known.filter(usage => usage.scope === 'transport');
  const samples = (transport.length ? transport : known).map(usage => safe(usage.variables, ''));
  if (!samples.length && object(value.variables) && Object.keys(value.variables).length) samples.push(safe(value.variables, ''));
  const keys = [...new Set([...declared, ...samples.flatMap(sample => Object.keys(sample))])];
  const variables = Object.fromEntries(keys.map(name => {
    const values = samples.map(sample => Object.hasOwn(sample, name) ? sample[name] : defaults[name]);
    return [name, safe(values.length ? merge(values, name) : Object.hasOwn(defaults, name) ? defaults[name] : undefined, name)];
  }));
  const document = visit(original, {
    VariableDefinition(node) { return { ...node, defaultValue: undefined }; },
    Argument(node) { return secret.test(node.name.value) && node.value.kind !== 'Variable' ? { ...node, value: { kind: 'StringValue', value: '{{SECRET}}' } } : undefined; },
    ObjectField(node) { return secret.test(node.name.value) && node.value.kind !== 'Variable' ? { ...node, value: { kind: 'StringValue', value: '{{SECRET}}' } } : undefined; },
  });
  return { ...value, query: print(document), variables };
}
