import {createHash,randomUUID} from 'node:crypto';
import {parseFlow,flowSchema} from '../../android/flow-contract.mjs';
import {z} from 'zod';

export type DraftNode={id:string;path:(string|number)[];name:string;fingerprint:string};
const text=z.string().trim().min(1).max(2000);
const items=z.array(text).max(50);
// Business metadata remains outside the executable Flow contract. IDs and formal
// case codes are deliberately not writable by the model.
export const draftMetadataSchema=z.object({
 title:z.string().trim().min(1).max(200).optional(),
 categorySuggestion:z.string().trim().min(1).max(200).optional(),
 objective:text.optional(),preconditions:items.optional(),dataRefs:items.optional(),
 expectedResults:items.optional(),cleanup:items.optional(),
 requirementRefs:items.optional(),sourceRefs:items.optional(),assumptions:items.optional(),
 referenceCaseCode:z.string().trim().min(1).max(100).optional(),
}).strict();
export type DraftMetadata=z.infer<typeof draftMetadataSchema> & {titleOrigin?:'user'|'agent'};
export type AgentDraft={source:string;revision:number;nodes:DraftNode[];metadata?:DraftMetadata};
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function canonical(value:any):any{return Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;}
export function draftExecutionHash(draft:AgentDraft):string{
 const {title:_title,titleOrigin:_origin,categorySuggestion:_category,...semantics}=draft.metadata||{};
 return digest(canonical({platform:'android',engine:'appium',flow:parseFlow(draft.source),metadata:semantics}));
}
const pathSchema=z.array(z.union([z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/).refine(value=>!['constructor','prototype','__proto__'].includes(value)),z.number().int().min(0).max(300)])).min(1).max(20);
export const patchSchema=z.object({revision:z.number().int().min(0),operations:z.array(z.discriminatedUnion('op',[
 z.object({op:z.literal('insert'),container:pathSchema,after:z.string().uuid().nullable(),steps:z.array(z.record(z.string(),z.unknown())).min(1).max(30)}).strict(),
 z.object({op:z.literal('replace'),id:z.string().uuid(),step:z.record(z.string(),z.unknown())}).strict(),
 z.object({op:z.literal('remove'),id:z.string().uuid()}).strict(),
 z.object({op:z.literal('configure'),field:z.enum(['appPackage','variables','actors']),value:z.unknown()}).strict(),
 z.object({op:z.literal('metadata'),value:draftMetadataSchema}).strict(),
])).min(1).max(30)}).strict();
function index(flow:any,previous:DraftNode[]=[],fixedPaths=new Map<string,string>()):DraftNode[]{
 const available=new Map<string,DraftNode[]>();
 for(const node of previous)available.set(node.fingerprint,[...(available.get(node.fingerprint)||[]),node]);
 const nodes:DraftNode[]=[];
 function walk(value:any,path:(string|number)[]){
  if(Array.isArray(value)){value.forEach((step,i)=>{if(step&&typeof step==='object'&&typeof step.action==='string'&&typeof step.name==='string'){const fingerprint=digest(step);nodes.push({id:fixedPaths.get(JSON.stringify([...path,i]))||available.get(fingerprint)?.shift()?.id||randomUUID(),path:[...path,i],name:step.name,fingerprint});}walk(step,[...path,i]);});}
  else if(value&&typeof value==='object')for(const [key,child]of Object.entries(value))walk(child,[...path,key]);
 }
 walk(flow,[]);return nodes;
}
export function createAgentDraft(source:string,metadata?:z.infer<typeof draftMetadataSchema>):AgentDraft{
 const valid=metadata===undefined?undefined:draftMetadataSchema.parse(metadata);
 return {source,revision:0,nodes:index(parseFlow(source)),...(valid?{metadata:{...valid,...(valid.title?{titleOrigin:'user' as const}:{})}}:{})};
}
export function patchAgentDraft(draft:AgentDraft,input:unknown):AgentDraft{
 const patch=patchSchema.parse(input);if(patch.revision!==draft.revision)throw new Error('草稿版本已改變，請依最新步驟重新提出局部修改。');
 const flow=structuredClone(parseFlow(draft.source));const removed=new Set<string>();
 let metadata=structuredClone(draft.metadata),changedFlow=false;
 const at=(path:(string|number)[])=>path.reduce((node:any,key)=>node&&Object.hasOwn(node,key)?node[key]:undefined,flow);
 // Resolve each target against the current tree by object identity, so an insert
 // earlier in this patch cannot redirect a later operation to another step.
 const targets=new Map(draft.nodes.map(node=>[node.id,at(node.path)]));
 function find(target:any,node:any=flow):{list:any[];position:number}|undefined{
  if(Array.isArray(node)){const position=node.indexOf(target);if(position>=0)return {list:node,position};for(const child of node){const found=find(target,child);if(found)return found;}}
  else if(node&&typeof node==='object')for(const child of Object.values(node)){const found=find(target,child);if(found)return found;}
 }
 for(const op of patch.operations){
  if(op.op==='metadata'){
   if(op.value.title!==undefined&&metadata?.titleOrigin==='user'&&op.value.title!==metadata.title)throw new Error('使用者命名不可由 Agent 覆寫，請保留目前標題。');
   metadata={...metadata,...op.value,...(op.value.title!==undefined&&metadata?.titleOrigin!=='user'?{titleOrigin:'agent' as const}:{})};continue;
  }
  changedFlow=true;
  if(op.op==='configure'){if(op.field==='variables'){if(!op.value||typeof op.value!=='object'||Array.isArray(op.value))throw new Error('變數設定格式錯誤。');(flow as any).variables={...(flow as any).variables,...op.value};}else (flow as any)[op.field]=op.value;continue;}
  if(op.op==='insert'){
   if(op.container.length===1&&['before','after'].includes(String(op.container[0]))&&!Object.hasOwn(flow,op.container[0]))(flow as any)[op.container[0]]=[];
   if(op.container.length===2&&op.container[0]==='routines'&&typeof op.container[1]==='string'){(flow as any).routines??={};if(!Object.hasOwn((flow as any).routines,op.container[1]))(flow as any).routines[op.container[1]]=[];}
   const list=at(op.container);if(!Array.isArray(list))throw new Error('插入位置不是流程列表。');
   const target=op.after===null?undefined:targets.get(op.after);const position=op.after===null?-1:list.indexOf(target);
   if(op.after!==null&&(position<0||removed.has(op.after)))throw new Error('找不到指定插入步驟。');
   list.splice(position+1,0,...structuredClone(op.steps));continue;
  }
  const target=targets.get(op.id),location=target&&!removed.has(op.id)?find(target):undefined;
  if(!location)throw new Error('找不到指定修改步驟。');
  if(op.op==='remove'){location.list.splice(location.position,1);removed.add(op.id);}
  else{location.list[location.position]=structuredClone(op.step);targets.set(op.id,location.list[location.position]);}
 }
 const identities=new Map<any,string>([...targets.entries()].filter(([id])=>!removed.has(id)).map(([id,value])=>[value,id]));
 const fixedPaths=new Map<string,string>();
 function locate(value:any,path:(string|number)[]){if(identities.has(value))fixedPaths.set(JSON.stringify(path),identities.get(value)!);if(Array.isArray(value))value.forEach((child,i)=>locate(child,[...path,i]));else if(value&&typeof value==='object')for(const [key,child]of Object.entries(value))locate(child,[...path,key]);}
 locate(flow,[]);
 const valid=flowSchema.parse(flow);const source=`export const flow = ${JSON.stringify(valid,null,2)} as const;`;
 parseFlow(source);return {source:changedFlow?source:draft.source,revision:draft.revision+1,nodes:changedFlow?index(valid,[],fixedPaths):draft.nodes,...(metadata?{metadata}:{})};
}
