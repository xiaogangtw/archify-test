import type {ScriptDraft} from './scriptModel.js';
type LibraryTree={folders:{id:string;name:string}[];scriptFolders:Record<string,string|null>};
const cell=(value:string)=>`"${(/^[\s]*[=+@-]/.test(value)?"'":'')+value.replaceAll('"','""')}"`;
export function exportCases(scripts:ScriptDraft[],tree:Pick<LibraryTree,'folders'|'scriptFolders'>):string{
 const rows=[['分類','編碼','項目名稱','項目說明','前置條件','操作','預期結果','資料還原','來源案例','需求依據','證據來源','待確認假設','成熟度','執行證據']];
 for(const script of scripts){
  const m=script.metadata;
  const category=tree.folders.find(folder=>folder.id===tree.scriptFolders[script.id])?.name||'未分類';
  // Include the exact static script rather than guessing normalized business steps.
  rows.push([category,script.caseCode||'',script.name,m?.objective||'',m?.preconditions?.join('\n')||'',script.source,m?.expectedResults?.join('\n')||'',m?.cleanup?.join('\n')||'',m?.referenceCaseCode||'',m?.requirementRefs?.join('\n')||'',m?.sourceRefs?.join('\n')||'',m?.assumptions?.join('\n')||'',script.maturity==='candidate'?'候選':'草稿',script.verification?.outcome==='passed'?`Android Appium 任務草稿通過；task=${script.verification.taskId}；hash=${script.verification.executionHash}`:'未提供有效執行證據']);
 }
 return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
export function downloadCases(scripts:ScriptDraft[],tree:LibraryTree){
 const url=URL.createObjectURL(new Blob([exportCases(scripts,tree)],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download='archify-cases.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
