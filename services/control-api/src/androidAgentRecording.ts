import {parseFlow} from '../../android/flow-contract.mjs';
import {patchAgentDraft,type AgentDraft} from './androidAgentDraft.ts';

export function appendAgentRecording(draft:AgentDraft,input:unknown):AgentDraft{
 if(!input||typeof input!=='object')throw new Error('執行器未提供可重播步驟。');
 const flow=parseFlow(draft.source),last=flow.steps.at(-1),index=flow.steps.length-1;
 const group=last?.action==='repeat'&&last.times===1&&last.name==='Agent 實際操作紀錄'&&last.steps.length<30;
 const container=group?['steps',index,'steps']:['steps'];
 const tail=draft.nodes.filter(node=>node.path.length===container.length+1&&container.every((key,i)=>node.path[i]===key)).at(-1);
 const step=group?input:{name:'Agent 實際操作紀錄',action:'repeat',times:1,steps:[input]};
 return patchAgentDraft(draft,{revision:draft.revision,operations:[{op:'insert',container,after:tail?.id??null,steps:[step]}]});
}
export function hasNewAgentAssertion(before:string,after:string){
 const assertions=(source:string)=>{const result:string[]=[];const walk=(item:any)=>{if(!item||typeof item!=='object')return;if(typeof item.action==='string'&&item.action.startsWith('assert')){const {name:_name,...rest}=item;result.push(JSON.stringify(rest));}for(const value of Object.values(item))if(value&&typeof value==='object')Array.isArray(value)?value.forEach(walk):walk(value);};walk(parseFlow(source));return result;};
 const old=assertions(before);return assertions(after).some(item=>{const index=old.indexOf(item);if(index<0)return true;old.splice(index,1);return false;});
}
export function agentRecordingCovered(source:string,step:unknown){
 if(!step||typeof step!=='object')return false;const entries=Object.entries(step).filter(([key])=>key!=='name');
 const walk=(item:any):boolean=>!!item&&typeof item==='object'&&(entries.every(([key,value])=>JSON.stringify(item[key])===JSON.stringify(value))||Object.values(item).some(value=>value&&typeof value==='object'&&(Array.isArray(value)?value.some(walk):walk(value))));
 return walk(parseFlow(source));
}
