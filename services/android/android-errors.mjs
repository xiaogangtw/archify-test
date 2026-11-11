export const androidErrorCodes = [
  'invalid_tool_format', 'invalid_arguments', 'screen_changed', 'visual_changed',
  'target_not_found', 'target_ambiguous', 'target_disabled', 'target_hidden',
  'input_not_editable', 'sensitive_input', 'input_focus_required', 'stable_target_required',
  'unsupported_command', 'permission_denied', 'session_lost', 'device_unavailable',
  'observation_failed', 'result_too_large', 'session_cleanup_failed', 'operation_unconfirmed',
];
const recovery = {
  invalid_tool_format: 'fix_format', invalid_arguments: 'fix_format',
  screen_changed: 'observe', visual_changed: 'observe',
  target_not_found: 'choose_locator', target_ambiguous: 'choose_locator',
  target_disabled: 'observe', target_hidden: 'observe',
  input_not_editable: 'inspect_input', sensitive_input: 'manual_input', input_focus_required: 'inspect_input',
  stable_target_required: 'choose_locator', unsupported_command: 'use_supported_command',
  permission_denied: 'stop', session_lost: 'observe', device_unavailable: 'stop',
  observation_failed: 'observe', result_too_large: 'observe', session_cleanup_failed: 'stop', operation_unconfirmed: 'stop',
};
export function androidError(code, message, detail = {}) {
  return Object.assign(new Error(message), { code, dispatch: 'not_sent', notDispatched: true, ...detail });
}
export function androidFailure(reason, dispatched = false, completed = false) {
  const webdriver = reason?.webdriver;
  const code = androidErrorCodes.includes(reason?.code) ? reason.code
    : ['unknown command', 'unsupported operation', 'unknown method'].includes(webdriver) ? 'unsupported_command'
    : webdriver === 'no such element' ? 'target_not_found'
    : webdriver === 'invalid argument' ? 'invalid_arguments'
    : webdriver === 'invalid session id' ? 'session_lost'
    : webdriver === 'element not interactable' ? 'target_disabled'
    : 'operation_unconfirmed';
  // A returned unknown-command rejection proves that command was not executed.
  // An arbitrary timeout or driver error does not prove a mutation was unsent.
  const dispatch = completed ? 'completed' : reason?.dispatch
    || (reason?.notDispatched === true || !dispatched ? 'not_sent' : code === 'unsupported_command' ? 'rejected' : 'unknown');
  return { code, dispatch, recovery: recovery[code], safeToReplan: ['not_sent', 'rejected'].includes(dispatch),
    ...(reason?.changeReason ? { changeReason: reason.changeReason } : {}) };
}
