import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
const decode = value => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
export function screenNodes(xml) {
  return (xml.match(/<[A-Za-z_][\w:.$-]*\b[^>]*>/g) || []).map((raw, index) => ({ raw, index,
    attributes: Object.fromEntries([...raw.matchAll(/([\w:.-]+)="([^"]*)"/g)].map(match => [match[1], decode(match[2])])),
  }));
}
const volatile = new Set(['agent-ref', 'index', 'drawing-order', 'selection-start', 'selection-end', 'text-selection-start', 'text-selection-end']);
export function screenEvidence(xml) {
  // Preserve element ordering, content, enabled state, focus and geometry.
  // Only declared non-target attributes may change without invalidating refs.
  const nodes = screenNodes(xml);
  const canonical = omit => nodes.map(node => [node.raw.match(/^<([^\s/>]+)/)?.[1],
    Object.entries(node.attributes).filter(([key]) => !volatile.has(key) && !omit.includes(key)).sort(([a], [b]) => a.localeCompare(b))]);
  return {
    stable: hash(JSON.stringify(canonical([]))),
    content: hash(JSON.stringify(canonical(['bounds', 'focused']))),
    layout: hash(JSON.stringify(nodes.map(node => node.attributes.bounds || ''))),
    focus: hash(JSON.stringify(nodes.filter(node => node.attributes.focused === 'true').map(node => node.index))),
    keyboard: hash(JSON.stringify(nodes.filter(node => /inputmethod|keyboard|swiftkey/i.test(node.attributes.package || '')).map(node => [node.index, node.attributes.bounds]))),
  };
}
export function compareScreens(before, after) {
  if (!before || !after) return { reason: 'unknown', safeForElement: false };
  if (before.stable === after.stable) return { reason: 'cosmetic_or_unchanged', safeForElement: true };
  if (before.keyboard !== after.keyboard) return { reason: 'keyboard_changed', safeForElement: false };
  if (before.content !== after.content) return { reason: 'content_changed', safeForElement: false };
  if (before.layout !== after.layout) return { reason: 'layout_changed', safeForElement: false };
  if (before.focus !== after.focus) return { reason: 'focus_changed', safeForElement: false };
  return { reason: 'unknown', safeForElement: false };
}
export function inputDescriptor(node) {
  const attr = node.attributes;
  const editable = /EditText$/.test(attr.class || '') || attr.editable === 'true';
  // Only field metadata participates. A normal value containing "password" is
  // not itself proof this is a secret input. Never return its actual text.
  const sensitive = attr.password === 'true' || /password|passwd|verification.?code|驗證碼|密碼|\botp\b/i.test(
    [attr['resource-id'], attr['content-desc'], attr.hint].filter(Boolean).join(' '));
  const enabled = attr.enabled === 'true', visible = attr.displayed === 'false' ? false : attr.displayed === 'true' ? true : null;
  return { ref: 'e' + (node.index + 1), resourceId: attr['resource-id'] || undefined, class: attr.class || undefined,
    focused: attr.focused === 'true', editable, sensitive, enabled, visible,
    inputType: attr['input-type'] || undefined,
    diagnosis: sensitive ? 'sensitive_input' : !editable ? 'input_not_editable' : !enabled ? 'target_disabled'
      : visible === false ? 'target_hidden' : attr.focused === 'true' ? 'ready' : 'input_focus_required' };
}
export function inputState(xml, keyboardShown = null, target) {
  const nodes = screenNodes(xml);
  const focused = nodes.filter(node => node.attributes.focused === 'true' && (/EditText$/.test(node.attributes.class || '') || node.attributes.editable === 'true'));
  const fields = nodes.filter(node => /EditText$/.test(node.attributes.class || '') || node.attributes.editable === 'true');
  return { keyboardShown, focusedInput: focused.length === 1 ? inputDescriptor(focused[0]) : null,
    focusedInputCount: focused.length, fields: fields.slice(0, 30).map(inputDescriptor), truncated: fields.length > 30,
    ...(target ? { target: inputDescriptor(target) } : {}),
    editorActionReady: focused.length === 1 && inputDescriptor(focused[0]).diagnosis === 'ready' };
}
