import { api, cachedScripts, saveScript, serverStorage, bootstrap } from './controlApi';
import type { ScriptDraft } from './scriptModel';
import type { TestingData } from './types';
export function hasBrowserData() {
  try { return ['archify.testing.v1','archify.scripts.v1'].some(key=>!!localStorage.getItem(key)); } catch { return false; }
}
export async function importBrowserData() {
  // Explicit import only. Keep browser originals and never replace a saved server script.
  const rawScripts: unknown=JSON.parse(localStorage.getItem('archify.scripts.v1') || '[]');
  if(!Array.isArray(rawScripts)) throw new Error('舊案例格式錯誤');
  let count=0;
  for(const item of rawScripts as ScriptDraft[]) {
    if(!item || typeof item.id!=='string' || typeof item.source!=='string' || typeof item.name!=='string' || !Array.isArray(item.messages)) throw new Error('舊案例格式錯誤');
    if(cachedScripts().some(saved=>saved.id===item.id))continue;
    await saveScript({...item,version:0}); count++;
  }
  const previous:TestingData|null=JSON.parse(localStorage.getItem('archify.testing.v1') || 'null');
  const current:TestingData|null=JSON.parse(serverStorage.getItem('archify.testing.v1') || 'null');
  if(previous?.project && current) {
    await serverStorage.setItem('archify.testing.v1',JSON.stringify({...current,project:current.project.repositoryUrl?current.project:previous.project,cases:[...current.cases,...(previous.cases || []).filter(item=>!current.cases.some(saved=>saved.id===item.id))],flows:[...current.flows,...(previous.flows || []).filter(item=>!current.flows.some(saved=>saved.id===item.id))]}));
  }
  for(const key of ['archify.script-folders.v1','archify.agents.v1']) {
    const raw=localStorage.getItem(key); if(raw && !serverStorage.getItem(key))await serverStorage.setItem(key,raw);
  }
  await bootstrap();
  // Keep a non-secret marker only. Original browser data is deliberately retained.
  localStorage.setItem('archify.server-import.v1','done');
  return count;
}
export { api };
