import ts from 'typescript';
import {createHash} from 'node:crypto';
import {parse,print,Kind} from 'graphql';
import type {RequestDefinition,RequestUsage} from './apiContracts.ts';

export function requestFamily(item:RequestDefinition){
 if(item.kind==='graphql')try{const operation=parse(JSON.parse(item.body).query).definitions.find(value=>value.kind===Kind.OPERATION_DEFINITION);if(operation?.kind===Kind.OPERATION_DEFINITION)return 'graphql:'+operation.operation+':'+operation.selectionSet.selections.filter(value=>value.kind===Kind.FIELD).map(value=>value.name.value).sort().join(',');}catch{}
 return item.method+':'+item.endpoint.replace(/\{\{[^}]+\}\}/g,'{{parameter}}');
}
type State={file:{path:string;source:string};sf:ts.SourceFile;locals:Map<string,ts.Node>;imports:Map<string,{path:string;name:string}>};
export function collectRequestUsages(requests:RequestDefinition[],index:Map<string,State>,evaluate:(node:ts.Node|undefined,path:string,bindings?:Record<string,unknown>)=>any,trim:(path:string)=>string){
 const signatures=new Map<string,RequestDefinition[]>();
 function callable(path:string,name:string,visited=new Set<string>()):string|undefined{const key=path+':'+name;if(visited.has(key))return undefined;visited.add(key);const state=index.get(path);if(!state)return undefined;if(state.locals.has(name))return key;const binding=state.imports.get(name);if(binding&&binding.name!=='*')return callable(binding.path,binding.name,visited);for(const [alias,binding] of state.imports)if(alias.startsWith('*:')){const resolved=callable(binding.path,name,new Set(visited));if(resolved)return resolved;}return undefined;}
 function querySignatures(source:string){try{return parse(source).definitions.filter(value=>value.kind===Kind.OPERATION_DEFINITION).map(value=>print(value));}catch{return [];}}
 for(const item of requests)if(item.kind==='graphql')try{for(const key of querySignatures(JSON.parse(item.body).query)){const values=signatures.get(key)||[];values.push(item);signatures.set(key,values);}}catch{}
 function owner(node:ts.Node){let fallback:ts.SignatureDeclaration|undefined;for(let item:ts.Node|undefined=node.parent;item;item=item.parent)if(ts.isFunctionLike(item)){fallback=fallback||item;if(functionName(item)!=='anonymous')return item;}return fallback;}
 function functionName(node:ts.Node|undefined){if(!node)return 'module';if('name' in node&&node.name&&ts.isIdentifier(node.name as ts.Node))return (node.name as ts.Identifier).text;if(ts.isVariableDeclaration(node.parent)&&ts.isIdentifier(node.parent.name))return node.parent.name.text;return 'anonymous';}
 const calls:{node:ts.CallExpression;path:string;state:State;owner:ts.SignatureDeclaration|undefined;target?:string;direct:RequestDefinition[];parameters:any}[]=[];
 const functions=new Map<string,Set<string>>();const definitions=new Map(requests.map(item=>[item.id,item]));
 const templates=new Map<string,Map<string,unknown>>();
 for(const [path,state] of index){const visit=(node:ts.Node)=>{
  if(ts.isCallExpression(node)){
   const fn=owner(node);const name=functionName(fn);const ownerKey=path+':'+name;
   let target:string|undefined;
   if(ts.isIdentifier(node.expression))target=callable(path,node.expression.text);
   else if(ts.isPropertyAccessExpression(node.expression)&&ts.isIdentifier(node.expression.expression)){const binding=state.imports.get(node.expression.expression.text);if(binding?.name==='*')target=callable(binding.path,node.expression.name.text);}
   const args=node.arguments.map(arg=>evaluate(arg,path));let body=args.find(value=>value&&typeof value==='object'&&typeof value.query==='string');
   if(!body)for(const value of args)if(typeof value==='string')try{const json=JSON.parse(value);if(typeof json?.query==='string')body=json;}catch{}
   let direct:RequestDefinition[]=[];const callName=node.expression.getText(state.sf);const network=callName==='fetch'||callName==='axios'||/\.(get|post|put|patch|delete|head|options|request|query|mutate)$/.test(callName);
   if(body&&network)for(const signature of querySignatures(body.query))direct.push(...(signatures.get(signature)||[]));
   if(!direct.length&&network){const line=state.sf.getLineAndCharacterOfPosition(node.getStart(state.sf)).line+1;const endpoint=typeof args[0]==='string'?args[0]:args[0]?.url;direct=requests.filter(item=>item.kind==='http'&&(!endpoint||item.endpoint===endpoint||item.endpoint.endsWith('/'+String(endpoint).replace(/^\//,'')))&&item.evidence.some(value=>value.path===trim(path)&&value.line===line));}
   if(direct.length){const set=functions.get(ownerKey)||new Set<string>();const values=templates.get(ownerKey)||new Map<string,unknown>();for(const item of direct){set.add(item.id);if(body?.variables!==undefined){if(!values.has(item.id))values.set(item.id,body.variables);else if(JSON.stringify(values.get(item.id))!==JSON.stringify(body.variables))values.set(item.id,null);}}functions.set(ownerKey,set);templates.set(ownerKey,values);}
   calls.push({node,path,state,owner:fn,target,direct,parameters:body?.variables});
  }ts.forEachChild(node,visit);
 };visit(state.sf);}
 // Follow statically imported/local wrappers without executing their bodies.
 for(let pass=0;pass<8;pass++){let changed=false;for(const call of calls){if(!call.target)continue;const targets=functions.get(call.target);if(!targets)continue;const key=call.path+':'+functionName(call.owner);const set=functions.get(key)||new Set<string>();const bindings:Record<string,unknown>={};const targetState=index.get(call.target.slice(0,call.target.lastIndexOf(':')));const fn=targetState?.locals.get(call.target.slice(call.target.lastIndexOf(':')+1));if(fn&&ts.isFunctionLike(fn))call.node.arguments.forEach((arg,position)=>{const parameter=fn.parameters[position];if(parameter&&ts.isIdentifier(parameter.name))bindings[parameter.name.text]=evaluate(arg,call.path);});const values=templates.get(key)||new Map<string,unknown>();
 for(const id of targets){if(!set.has(id)){set.add(id);changed=true;}const template=templates.get(call.target)?.get(id);if(template!==undefined){const resolved=substitute(template,bindings);if(!values.has(id)){values.set(id,resolved);changed=true;}else if(values.get(id)!==null&&JSON.stringify(values.get(id))!==JSON.stringify(resolved)){values.set(id,null);changed=true;}}}templates.set(key,values);functions.set(key,set);}if(!changed)break;}

 const callsByOwner=new Map<string,typeof calls>();for(const call of calls){const key=call.path+':'+functionName(call.owner);const entries=callsByOwner.get(key)||[];entries.push(call);callsByOwner.set(key,entries);}
 function bind(target:string,args:readonly ts.Expression[],path:string,parent:Record<string,unknown>={}){
  const state=index.get(target.slice(0,target.lastIndexOf(':')));const fn=state?.locals.get(target.slice(target.lastIndexOf(':')+1));const bindings:Record<string,unknown>={};
  if(fn&&ts.isFunctionLike(fn))fn.parameters.forEach((parameter,position)=>{if(ts.isIdentifier(parameter.name)){const value=args[position]?evaluate(args[position],path,parent):undefined;bindings[parameter.name.text]=value===undefined&&parameter.initializer?evaluate(parameter.initializer,state!.file.path,bindings):value;}});return bindings;
 }
 function resolvedVariables(target:string,id:string,bindings:Record<string,unknown>,visited=new Set<string>()):any{
  if(visited.has(target)||visited.size>=8)return undefined;const seen=new Set(visited).add(target);const results:any[]=[];
  for(const call of callsByOwner.get(target)||[]){
   if(call.direct.some(item=>item.id===id)){
    for(const arg of call.node.arguments){let body=evaluate(arg,call.path,bindings);if(typeof body==='string')try{body=JSON.parse(body);}catch{}if(body&&typeof body.query==='string'&&body.variables&&typeof body.variables==='object')results.push(body.variables);}
   }else if(call.target&&functions.get(call.target)?.has(id)){const result=resolvedVariables(call.target,id,bind(call.target,call.node.arguments,call.path,bindings),seen);if(result)results.push(result);}
  }
  return results.length&&results.every(result=>JSON.stringify(result)===JSON.stringify(results[0]))?results[0]:undefined;
 }
 const result=new Map<string,RequestUsage[]>();
 function publicValue(value:any):any{if(Array.isArray(value))return value.map(publicValue);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,/token|password|secret|cookie|authorization/i.test(key)?'秘密參照':publicValue(item)]));return value;}
 function substitute(value:any,bindings:Record<string,unknown>):any{if(typeof value==='string'){const match=/^\{\{([A-Za-z_$][\w$]*(?:\.[\w$]+)*)\}\}$/.exec(value);if(match){let resolved:any=bindings;for(const part of match[1].split('.'))resolved=resolved&&typeof resolved==='object'&&Object.hasOwn(resolved,part)?resolved[part]:undefined;return resolved===undefined?value:resolved;}return value;}if(Array.isArray(value))return value.map(item=>substitute(item,bindings));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,substitute(item,bindings)]));return value;}
 for(const call of calls){const ids=new Set([...call.direct.map(item=>item.id),...(call.target?functions.get(call.target)||[]:[])]);if(!ids.size)continue;
  const parameters:Record<string,string>={};const notes:string[]=[];let input=call.parameters;
  const bindings:Record<string,unknown>={};
  if(!call.direct.length){input={};const targetState=call.target?index.get(call.target.slice(0,call.target.lastIndexOf(':'))):undefined;const fn=call.target?targetState?.locals.get(call.target.slice(call.target.lastIndexOf(':')+1)):undefined;
   call.node.arguments.forEach((arg,position)=>{const value=evaluate(arg,call.path);const parameter=fn&&ts.isFunctionLike(fn)?fn.parameters[position]:undefined;if(parameter&&ts.isIdentifier(parameter.name))bindings[parameter.name.text]=value;if(value&&typeof value==='object'&&!Array.isArray(value))Object.assign(input,value);else{const name=parameter?parameter.name.getText():`argument${position+1}`;input[name]=value??'{{動態值}}';}});
  }
  if(input&&typeof input==='object'&&!Array.isArray(input))for(const [key,value] of Object.entries(input))parameters[key]=/token|password|secret|cookie|authorization/i.test(key)?'秘密參照':typeof value==='string'?value:JSON.stringify(publicValue(value))??'未解析';
  else if(input!==undefined)notes.push('變數物件為動態值，無法靜態確定完整欄位。');
  if(call.node.getText(call.state.sf).includes('...'))notes.push('包含展開或動態參數，列出的欄位可能不完整。');
  if(Object.values(parameters).some(value=>value.includes('{{')))notes.push('動態值需在測試時提供；這不是已驗證資料。');
  const position=call.state.sf.getLineAndCharacterOfPosition(call.node.getStart(call.state.sf));const usage:RequestUsage={path:trim(call.path),line:position.line+1,column:position.character+1,caller:functionName(call.owner),scope:call.direct.length?'transport':'caller',parameters,notes};
  for(const id of ids)if(definitions.has(id)){const template=call.direct.length?call.parameters:call.target?templates.get(call.target)?.get(id):undefined;const resolved=call.direct.length?template:call.target?resolvedVariables(call.target,id,bind(call.target,call.node.arguments,call.path))??substitute(template,bindings):undefined;const entry={...usage,...(resolved&&typeof resolved==='object'&&!Array.isArray(resolved)?{variables:publicValue(resolved)}:{})};const values=result.get(id)||[];if(!values.some(item=>item.path===usage.path&&item.line===usage.line&&item.column===usage.column&&item.scope===usage.scope))values.push(entry);result.set(id,values);}
 }
 const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const sources=new Map([...index.values()].map(state=>[trim(state.file.path),state.file.source]));
 return requests.map(item=>{const usages=result.get(item.id)||[];const dependencies={...item.dependencies};for(const usage of usages)if(sources.has(usage.path))dependencies[usage.path]=hash(sources.get(usage.path));const ordered=Object.fromEntries(Object.entries(dependencies).sort(([a],[b])=>a.localeCompare(b)));return {...item,dependencies:ordered,implementationHash:hash(ordered),family:requestFamily(item),usages,sourceRequest:{headers:item.headers,queryParams:item.queryParams,body:item.body,variables:item.variables,operationName:item.operationName,method:item.method,endpoint:item.endpoint}};});
}
