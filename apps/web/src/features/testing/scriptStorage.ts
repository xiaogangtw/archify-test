import type { ScriptDraft } from './scriptModel';
import { cachedScripts } from './controlApi';
export const scriptStorageKey = 'archify.scripts.v1';
export const scriptHistoryKey = 'archify.script-history.v1';
export function loadScripts(key = scriptStorageKey): ScriptDraft[] { return cachedScripts(key === scriptHistoryKey); }
