import type {ScriptDraft,CaseMetadata} from './scriptModel.js';
import type {AndroidAgentTask} from './androidAgentClient.js';

export function mergeAgentDraft(current:ScriptDraft,task:AndroidAgentTask,previous?:ScriptDraft):ScriptDraft|null{
 if(task.scriptVersion!==current.version||task.resolution?.action==='dismissed')return null;
 const expected=previous||{...current,source:task.baseSource,metadata:task.baseMetadata};
 if(current.source!==expected.source&&current.source!==task.draft.source)return null;
 // A manual edit made after submission wins, including an unsaved title edit.
 const metadata:CaseMetadata={...current.metadata,...task.draft.metadata};
 const baselineTitle=previous?.name||task.baseMetadata?.title;
 const manual=current.metadata?.titleOrigin==='user';
 if(manual&&(baselineTitle!==undefined&&current.name!==baselineTitle||task.draft.metadata?.titleOrigin!=='user')){
  metadata.title=current.name;metadata.titleOrigin='user';
 }
 const name=metadata.title||current.name;
 const maturity=current.maturity==='candidate'||/^GAP(?:[-_]|$)/i.test(metadata.referenceCaseCode||'')?'candidate':current.maturity;
 return {...current,source:task.draft.source,name,maturity,agentTask:{id:task.id,draftRevision:task.draft.revision},...(Object.keys(metadata).length?{metadata}:{}),scenario:undefined,sourceScenarioKey:undefined};
}

export function taskMetadata(draft:ScriptDraft){
 const {titleOrigin:_origin,...metadata}=draft.metadata||{};
 // Do not submit an Agent-generated name as a new manual rename.
 if(draft.metadata?.titleOrigin!=='user')delete metadata.title;
 else if(draft.name.trim())metadata.title=draft.name.trim();
 else delete metadata.title;
 return metadata;
}
