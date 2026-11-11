import type {ScriptDraft} from './scriptModel';
export type FlowStep = {name:string;action:string;scriptId?:string;scriptVersion?:number;actor?:string;[key:string]:unknown};
export type SharedDefinition = {appPackage:string;steps:FlowStep[];before?:FlowStep[];actors?:string[];variables?:unknown;routines?:unknown;[key:string]:unknown};

// Parse literals only. Never evaluate user-authored TypeScript.
export async function readSharedDefinition(source:string):Promise<SharedDefinition>{
 const ts=await import('typescript');
 if(source.length>1000000)throw new Error('流程內容過長。');
 const file=ts.createSourceFile('flow.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const statement=file.statements[0];
 if((file as typeof file & {parseDiagnostics:unknown[]}).parseDiagnostics.length||file.statements.length!==1||!statement||!ts.isVariableStatement(statement)||!(statement.declarationList.flags&ts.NodeFlags.Const)||!statement.modifiers?.some(item=>item.kind===ts.SyntaxKind.ExportKeyword)||statement.declarationList.declarations.length!==1)throw new Error('請先使用單一 export const flow 靜態流程定義。');
 const declaration=statement.declarationList.declarations[0];
 if(!ts.isIdentifier(declaration.name)||declaration.name.text!=='flow'||!declaration.initializer)throw new Error('流程名稱必須是 flow。');
 function literal(node:import('typescript').Node,depth=0):unknown{
  if(depth>24)throw new Error('流程結構過深。');
  if(ts.isAsExpression(node)||ts.isParenthesizedExpression(node)||ts.isSatisfiesExpression(node))return literal(node.expression,depth+1);
  if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;
  if(ts.isNumericLiteral(node))return Number(node.text);
  if(ts.isPrefixUnaryExpression(node)&&ts.isNumericLiteral(node.operand)&&[ts.SyntaxKind.MinusToken,ts.SyntaxKind.PlusToken].includes(node.operator))return Number(node.operand.text)*(node.operator===ts.SyntaxKind.MinusToken?-1:1);
  if(node.kind===ts.SyntaxKind.TrueKeyword)return true;
  if(node.kind===ts.SyntaxKind.FalseKeyword)return false;
  if(ts.isArrayLiteralExpression(node))return node.elements.map(child=>literal(child,depth+1));
  if(ts.isObjectLiteralExpression(node)){
   const result:Record<string,unknown>=Object.create(null);
   for(const property of node.properties){
    if(!ts.isPropertyAssignment(property)||!(ts.isIdentifier(property.name)||ts.isStringLiteral(property.name)))throw new Error('共用流程只接受靜態欄位。');
    const key=property.name.text;
    if(['__proto__','constructor','prototype'].includes(key)||Object.hasOwn(result,key))throw new Error('流程有重複或無效欄位。');
    result[key]=literal(property.initializer,depth+1);
   }
   return result;
  }
  throw new Error('共用流程不接受函式、變數或展開語法。');
 }
 const value=literal(declaration.initializer) as SharedDefinition;
 if(!value||typeof value.appPackage!=='string'||!Array.isArray(value.steps)||!value.steps.length||value.steps.some(step=>!step||typeof step.name!=='string'||typeof step.action!=='string')||value.before!==undefined&&!Array.isArray(value.before))throw new Error('請先填寫 App 套件與有效流程步驟。');
 if(value.actors!==undefined&&(!Array.isArray(value.actors)||!value.actors.length||value.actors.some(actor=>typeof actor!=='string'||!actor.trim())||new Set(value.actors).size!==value.actors.length))throw new Error('手機角色必須是非空且不重複的角色清單。');
 return value;
}
export const sharedSource=(flow:SharedDefinition)=>'export const flow = '+JSON.stringify(flow,null,2)+' as const;\n';
export function referenceStep(script:ScriptDraft):FlowStep{
 if(script.caseType!=='flow'||!Number.isInteger(script.version)||script.version<1)throw new Error('只能引用已儲存的 Flow Case 版本。');
 return {name:`共用前置：${script.name} · v${script.version}`,action:'callFlow',scriptId:script.id,scriptVersion:script.version};
}
export function prependShared(flow:SharedDefinition,script:ScriptDraft,child:SharedDefinition,actor?:string):SharedDefinition{
 if((flow.before||[]).some(item=>item.scriptId===script.id&&item.scriptVersion===script.version&&item.actor===actor))throw new Error('已套用這個版本的共用前置流程。');
 return applyShared(flow,script,child,{path:['before'],index:flow.before?.length||0},actor);
}
export type InsertionPoint={path:(string|number)[];index:number};
export function insertionOptions(flow:SharedDefinition):{value:string;label:string}[]{
 const options:{value:string;label:string}[]=[];
 function visit(list:FlowStep[],path:(string|number)[],label:string){
  for(let index=0;index<=list.length;index++)options.push({value:JSON.stringify({path,index}),label:`${label} / ${index===list.length?'最後':`第 ${index+1} 步「${list[index].name}」之前`}`});
  for(const [index,step] of list.entries())for(const [key,name] of [['then','條件成立'],['else','條件不成立'],['steps','群組內步驟']]){
   if(Array.isArray(step[key]))visit(step[key] as FlowStep[],[...path,index,key],`${label} / ${index+1}. ${step.name} / ${name}`);
  }
 }
 visit(flow.before||[],['before'],'前置流程');
 visit(flow.steps,['steps'],'主流程');
 visit(Array.isArray(flow.after)?flow.after:[],['after'],'清理流程');
 return options;
}
export function applyShared(flow:SharedDefinition,script:ScriptDraft,child:SharedDefinition,point:InsertionPoint|'replace',actor?:string):SharedDefinition{
 const step=referenceStep(script);
 step.name=`共用流程：${script.name} · v${script.version}`;
 if(point==='replace')return {appPackage:child.appPackage,...(child.actors?{actors:child.actors}:{}),steps:[step]};
 if(child.actors&&!flow.actors)throw new Error('這是多機共用流程，請先將目前案例設為多機。');
 if(child.actors&&actor)throw new Error('多機共用流程使用流程內的角色，不能指定單一手機。');
 if(actor&&!flow.actors?.includes(actor))throw new Error('所選角色不在目前案例中，請重新選擇。');
 if(flow.actors&&!child.actors&&!actor)throw new Error('請選擇執行共用流程的手機角色。');
 if(actor)step.actor=actor;
 if(!insertionOptions(flow).some(option=>option.value===JSON.stringify(point)))throw new Error('插入位置已失效，請重新選擇。');
 const updated=structuredClone(flow);
 let target:unknown=updated;
 for(const key of point.path.slice(0,-1))target=(target as Record<string|number,unknown>)[key];
 const owner=target as Record<string|number,unknown>,key=point.path.at(-1)!;
 const list=(owner[key]||[]) as FlowStep[];
 if(list.length>=300)throw new Error('此區段已達步驟上限，請選擇其他位置。');
 owner[key]=[...list.slice(0,point.index),step,...list.slice(point.index)];
 return updated;
}
export const actorLabel=(actor:string)=>actor==='sender'?'發送者':actor==='receiver'?'接收者':actor;
export type SharedReference = {path:(string|number)[];step:FlowStep;inherited?:string};
export function sharedReferences(flow:SharedDefinition):SharedReference[]{
 const result:SharedReference[]=[];
 function visit(list:unknown,path:(string|number)[],inherited?:string){
  if(!Array.isArray(list))return;
  for(const [index,step] of list.entries()){
   if(!step||typeof step!=='object')continue;
   const here=[...path,index];
   if(step.action==='callFlow')result.push({path:here,step,inherited});
   for(const key of ['steps','then','else'])visit(step[key],[...here,key],step.actor||inherited);
  }
 }
 for(const key of ['before','steps','after'])visit(flow[key],[key]);
 if(flow.routines&&typeof flow.routines==='object')for(const [key,list] of Object.entries(flow.routines))visit(list,['routines',key]);
 return result;
}
export function bindSharedRole(flow:SharedDefinition,path:(string|number)[],actor:string):SharedDefinition{
 if(actor&&!flow.actors?.includes(actor))throw new Error('所選角色不在目前案例中，請重新選擇。');
 const updated=structuredClone(flow);
 let target:unknown=updated;
 for(const key of path)target=(target as Record<string|number,unknown>)[key];
 const step=target as FlowStep;
 if(step.action!=='callFlow')throw new Error('共用流程已變更，請重新選擇。');
 if(actor)step.actor=actor;else delete step.actor;
 return updated;
}
export function extractShared(flow:SharedDefinition,count:number){
 if(!Number.isInteger(count)||count<1||count>=flow.steps.length)throw new Error('請保留至少一個案例專屬步驟。');
 return {appPackage:flow.appPackage,...(flow.actors?{actors:flow.actors}:{}),...(flow.variables?{variables:flow.variables}:{}),...(flow.routines?{routines:flow.routines}:{}),steps:flow.steps.slice(0,count)};
}
