// Shared by the proposal and catalog readers; source existence is checked by the caller.
export function validFeatureSequence(value, validSource) {
  const text = (value, max) => typeof value === 'string' && !!value.trim() && value.length <= max && !value.includes('\0');
  const optional = (value, max) => value === undefined || (typeof value === 'string' && value.length <= max && !value.includes('\0'));
  return value === undefined || (Array.isArray(value) && value.length <= 30 && value.every(step => step && text(step.action, 300) && text(step.from, 80) && text(step.to, 80) && typeof step.condition === 'string' && step.condition.length <= 500 && !step.condition.includes('\0') && optional(step.api, 300) && optional(step.transfer, 500) && step.source && validSource(step.source)));
}
