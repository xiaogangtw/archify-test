import ts from 'typescript';
import {createHash} from 'node:crypto';
import {parse,print,Kind} from 'graphql';
import {sourceModuleResolver} from './sourceModuleResolver.ts';
import {selectApiSources} from './apiAnalysis.ts';
import {collectRequestUsages} from './requestUsages.ts';
import type {RequestDefinition,RequestChange,ApiImpact,SavedApiCase} from './apiContracts.ts';

export const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
type File={path:string;source:string};
type Value=any;
export function extractRequests(input:File[]) {
 const files=input.filter(file=>/\.(?:[cm]?[jt]sx?|graphql|gql|vue|svelte|json)$/i.test(file.path)).map(file=>({...file,source:file.source.replace(/\r\n/g,'\n')}));
 const warnings=new Set<string>();const resolve=sourceModuleResolver(files,warnings);
 const index=new Map<string,{file:File;sf:ts.SourceFile;locals:Map<string,ts.Node>;imports:Map<string,{path:string;name:string}>}>();
 const prefixes=new Set(files.map(file=>file.path.split('/')[0]));
 const trim=(path:string)=>{const src=path.indexOf('/src/');if(src>=0)return path.slice(src+1);if(path.startsWith('src/'))return path;return prefixes.size===1&&files.every(file=>file.path.includes('/'))?path.split('/').slice(1).join('/'):path;};
 for(const file of files.filter(file=>/\.[cm]?[jt]sx?$/i.test(file.path))){
  const sf=ts.createSourceFile(file.path,file.source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const locals=new Map<string,ts.Node>(),imports=new Map<string,{path:string;name:string}>();
  const visit=(node:ts.Node)=>{
   if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer&&node.parent.parent.parent===sf)locals.set(node.name.text,node.initializer);
   if(ts.isFunctionDeclaration(node)&&node.name&&node.parent===sf)locals.set(node.name.text,node);
   if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)){
    const path=resolve(file.path,node.moduleSpecifier.text),clause=node.importClause;
    if(path&&clause){if(clause.name)imports.set(clause.name.text,{path,name:'default'});if(clause.namedBindings&&ts.isNamedImports(clause.namedBindings))for(const item of clause.namedBindings.elements)imports.set(item.name.text,{path,name:item.propertyName?.text||item.name.text});if(clause.namedBindings&&ts.isNamespaceImport(clause.namedBindings))imports.set(clause.namedBindings.name.text,{path,name:'*'});}
   }
   if(ts.isExportDeclaration(node)&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){const path=resolve(file.path,node.moduleSpecifier.text);if(path){if(node.exportClause&&ts.isNamedExports(node.exportClause))for(const item of node.exportClause.elements)imports.set(item.name.text,{path,name:item.propertyName?.text||item.name.text});else if(!node.exportClause)imports.set('*:'+node.moduleSpecifier.text,{path,name:'*'});}}
   if(ts.isExportAssignment(node))locals.set('default',node.expression);
   ts.forEachChild(node,visit);
  };visit(sf);index.set(file.path,{file,sf,locals,imports});
 }
 function evaluate(node:ts.Node|undefined,path:string,seen=new Set<string>(),depth=0,bindings:Record<string,unknown>={}):Value {
  if(!node||depth>20)return undefined;
  const state=index.get(path);if(!state)return undefined;
  const next=(child:ts.Node|undefined)=>evaluate(child,path,new Set(seen),depth+1,bindings);
  if(ts.isStringLiteralLike(node)||ts.isNumericLiteral(node))return ts.isNumericLiteral(node)?Number(node.text):node.text;
  if(node.kind===ts.SyntaxKind.TrueKeyword)return true;if(node.kind===ts.SyntaxKind.FalseKeyword)return false;if(node.kind===ts.SyntaxKind.NullKeyword)return null;
  if(ts.isParenthesizedExpression(node)||ts.isAsExpression(node)||ts.isSatisfiesExpression(node)||ts.isNonNullExpression(node))return next(node.expression);
  if(ts.isIdentifier(node)){
   if(Object.hasOwn(bindings,node.text))return bindings[node.text];
   for(let scope:ts.Node|undefined=node.parent;scope&&scope!==state.sf;scope=scope.parent){
    if(ts.isFunctionLike(scope)&&scope.parameters.some(parameter=>ts.isIdentifier(parameter.name)&&parameter.name.text===node.text))return `{{${node.text}}}`;
    if(ts.isBlock(scope))for(const statement of scope.statements)if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations)if(ts.isIdentifier(declaration.name)&&declaration.name.text===node.text&&declaration.initializer&&declaration.initializer!==node)return evaluate(declaration.initializer,path,new Set(seen),depth+1,bindings);
   }
   const key=path+':'+node.text;if(seen.has(key))return undefined;seen.add(key);
   const binding=state.imports.get(node.text);if(binding){const target=index.get(binding.path);if(target)return evaluate(target.locals.get(binding.name),binding.path,seen,depth+1);const asset=files.find(file=>file.path===binding.path);return asset?.source;}
   return state.locals.has(node.text)?evaluate(state.locals.get(node.text),path,seen,depth+1,bindings):`{{${node.text}}}`;
  }
  if(ts.isTemplateExpression(node))return node.head.text+node.templateSpans.map(span=>String(next(span.expression)??`{{${span.expression.getText(state.sf)}}}`)+span.literal.text).join('');
  if(ts.isTaggedTemplateExpression(node))return next(node.template);
  if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.PlusToken){const a=next(node.left),b=next(node.right);return typeof a==='string'||typeof b==='string'?String(a??'')+String(b??''):undefined;}
  if(ts.isBinaryExpression(node)&&[ts.SyntaxKind.QuestionQuestionToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.AmpersandAmpersandToken].includes(node.operatorToken.kind)){
   const left=next(node.left);const unknown=typeof left==='string'&&left.includes('{{');
   if(unknown){if(/^(?:import\.meta|process)\.env\./.test(node.left.getText(state.sf))&&node.operatorToken.kind!==ts.SyntaxKind.AmpersandAmpersandToken)return next(node.right);return '{{'+node.getText(state.sf)+'}}';}
   if(node.operatorToken.kind===ts.SyntaxKind.QuestionQuestionToken)return left===null||left===undefined?next(node.right):left;
   if(node.operatorToken.kind===ts.SyntaxKind.BarBarToken)return left||next(node.right);
   return left?next(node.right):left;
  }
  if(ts.isConditionalExpression(node)){const condition=next(node.condition);return typeof condition==='string'&&condition.includes('{{')?'{{'+node.getText(state.sf)+'}}':next(condition?node.whenTrue:node.whenFalse);}
  if(ts.isArrayLiteralExpression(node))return node.elements.map(next);
  if(ts.isObjectLiteralExpression(node)){
   const value:Record<string,Value>={};for(const property of node.properties){
    if(ts.isPropertyAssignment(property)){const name=property.name.getText(state.sf).replace(/^['"]|['"]$/g,'');value[name]=next(property.initializer);}
    else if(ts.isShorthandPropertyAssignment(property))value[property.name.text]=next(property.name);
    else if(ts.isSpreadAssignment(property)){const spread=next(property.expression);if(spread&&typeof spread==='object')Object.assign(value,spread);}
   }return value;
  }
  if(ts.isPropertyAccessExpression(node)){
   const text=node.getText(state.sf);if(text.startsWith('import.meta.env.')||text.startsWith('process.env.'))return `{{${node.name.text}}}`;
   const object=next(node.expression);return object&&typeof object==='object'?object[node.name.text]:`{{${text}}}`;
  }
  if(ts.isCallExpression(node)){
   if(ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='create')return {__client:next(node.arguments[0])||{}};
   if(node.expression.getText(state.sf)==='JSON.stringify'){const value=next(node.arguments[0]);return value===undefined?undefined:JSON.stringify(value);}
  }
  return undefined;
 }
 const selection=selectApiSources(files);for(const warning of selection.unresolved)warnings.add(warning);
 const requests:RequestDefinition[]=[];const seen=new Set<string>();
 function dependencies(path:string) {
  const related=new Set<string>([path]);
  // Request wrappers and interceptors in the same file influence its operations.
  for(const group of selection.groups||[])if(group[0]?.path===path)for(const item of group)related.add(item.path);
  return Object.fromEntries([...related].sort().map(path=>[trim(path),digest(files.find(file=>file.path===path)?.source||'')]));
 }
 function add(path:string,node:ts.Node|undefined,values:Partial<RequestDefinition>,key:string){
  if(seen.has(key))return;seen.add(key);const sf=index.get(path)?.sf;
  const line=sf&&node?sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1:1;
  const deps=dependencies(path);const value={id:key,name:key,kind:'http',method:'UNKNOWN',endpoint:'',headers:{},queryParams:{},body:'',variables:'{}',operationName:'',parameterTypes:'',issues:[],...values} as RequestDefinition;
  value.evidence=[{path:trim(path),line}];value.dependencies=deps;
  value.definitionHash=digest([value.kind,value.method,value.endpoint,value.headers,value.queryParams,value.body,value.variables,value.operationName,value.parameterTypes]);value.implementationHash=digest(deps);requests.push(value);
 }
 function graphql(source:string,path:string,node?:ts.Node){
  let document;try{document=parse(source);}catch{return;}
  for(const definition of document.definitions){if(definition.kind!==Kind.OPERATION_DEFINITION)continue;
   const name=definition.name?.value||`anonymous-${digest(print(definition)).slice(0,12)}`;
   const fragments=document.definitions.filter(item=>item.kind===Kind.FRAGMENT_DEFINITION);
   const query=print({kind:Kind.DOCUMENT,definitions:[definition,...fragments]});
   const variables=Object.fromEntries((definition.variableDefinitions||[]).filter(item=>item.defaultValue).map(item=>[item.variable.name.value,undefined]));
   const parameterTypes=(definition.variableDefinitions||[]).map(item=>`$${item.variable.name.value}: ${print(item.type)}${item.defaultValue?' = '+print(item.defaultValue):''}`).join('\n');
   const issues=['端點使用環境設定；認證與有效測試資料需於執行時提供。'];
   if(definition.operation==='mutation')issues.push('此操作會變更資料，按發送才執行。');
   if(definition.operation==='subscription')issues.push('Subscription 需要對應串流傳輸；目前單點發送器只支援 HTTP。');
   const body=JSON.stringify({query,operationName:definition.name?.value,variables},null,2);const baseKey=`graphql:${trim(path)}:${name}`;const existing=requests.find(item=>item.id===baseKey);const key=existing&&existing.body!==body?baseKey+':'+digest(query).slice(0,12):baseKey;
   add(path,node,{name,kind:'graphql',method:'POST',endpoint:'{{BASE_URL}}',body,operationName:definition.name?.value||'',parameterTypes,issues},key);
  }
 }
 for(const file of files){
  if(/\.(graphql|gql)$/i.test(file.path)){graphql(file.source,file.path);continue;}
  const state=index.get(file.path);if(!state)continue;const ordinals=new Map<string,number>();
  function owner(node:ts.Node):string {let fallback='module';let item:ts.Node|undefined=node;while(item){if(ts.isFunctionDeclaration(item)&&item.name)return item.name.text;if((ts.isArrowFunction(item)||ts.isFunctionExpression(item))&&ts.isVariableDeclaration(item.parent)&&ts.isIdentifier(item.parent.name))return item.parent.name.text;if(ts.isVariableDeclaration(item)&&ts.isIdentifier(item.name))fallback=item.name.text;item=item.parent;}return fallback;}
  const visit=(node:ts.Node)=>{
   if(ts.isStringLiteralLike(node)||ts.isTemplateExpression(node)||ts.isTaggedTemplateExpression(node)){
    const value=evaluate(node,file.path);if(typeof value==='string'&&/\b(query|mutation|subscription)\b/.test(value))graphql(value,file.path,node);
   }
   if(ts.isCallExpression(node)){
    const call=node.expression;const callName=call.getText(state.sf);
    const member=ts.isPropertyAccessExpression(call)?call.name.text:'';
    const supported=/^(get|post|put|patch|delete|head|options|request)$/.test(member);
    if(callName==='fetch'||callName==='axios'||supported){
     const first=evaluate(node.arguments[0],file.path);let config:Value={},method='UNKNOWN',endpoint:Value='',body:Value;
     if(callName==='fetch'){endpoint=first;config=evaluate(node.arguments[1],file.path)||{};method=typeof config.method==='string'?config.method.toUpperCase():'GET';body=config.body;}
     else if(callName==='axios'||member==='request'){config=first&&typeof first==='object'?first:{};endpoint=config.url;method=typeof config.method==='string'?config.method.toUpperCase():'GET';body=config.data;}
     else {
      method=member.toUpperCase();endpoint=first;const hasBody=['post','put','patch'].includes(member);body=hasBody?evaluate(node.arguments[1],file.path):undefined;config=evaluate(node.arguments[hasBody?2:1],file.path)||{};
     }
     const client=ts.isPropertyAccessExpression(call)?evaluate(call.expression,file.path):undefined;
     const knownClient=callName==='fetch'||callName==='axios'||!!client?.__client||/^(?:axios|[\w$]*(?:[Cc]lient|[Hh]ttp|[Aa]pi|[Rr]equest))[\w$.]*\.(?:get|post|put|patch|delete|head|options|request)$/.test(callName);
     const urlLike=typeof endpoint==='string'&&(/^(?:https?:\/\/|\/|\.\.?\/)/.test(endpoint)||/\{\{[^{}]*(?:url|endpoint)[^{}]*\}\}/i.test(endpoint));
     if(!knownClient&&!urlLike){ts.forEachChild(node,visit);return;}
     const clientConfig=client?.__client||{};const base=config.baseURL||clientConfig.baseURL;
     if(base&&typeof base==='string'&&typeof endpoint==='string'&&!/^https?:\/\//.test(endpoint))endpoint=base.replace(/\/$/,'')+'/'+endpoint.replace(/^\//,'');
     // GraphQL operations are represented by their documents, not generic transport wrappers.
     const parsedBody=typeof body==='string'?(()=>{try{return JSON.parse(body);}catch{return null;}})():body;
     if(!parsedBody?.query && !/graphql/i.test(callName)){
      const location=owner(node);const ordinal=(ordinals.get(location)||0)+1;ordinals.set(location,ordinal);
      const headers={...(clientConfig.headers&&typeof clientConfig.headers==='object'?clientConfig.headers:{}),...(config.headers&&typeof config.headers==='object'?config.headers:{})};
      const issues:string[]=[];if(!/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(method)){method='UNKNOWN';issues.push('HTTP 方法為動態值，需確認後選擇方法。');}if(!endpoint||typeof endpoint!=='string'||endpoint.includes('{{'))issues.push('請求網址包含動態值，需提供環境變數。');
      if(!knownClient)issues.push('方法接收者未確認為 HTTP client，發送前請核對來源。');
      const requestBody=typeof body==='string'?body:body===undefined?'':JSON.stringify(body,null,2);
      if(requestBody.includes('{{'))issues.push('請求內容包含動態參數，需提供有效資料。');
      const visibleHeaders=Object.fromEntries(Object.entries(headers).filter(([key,value])=>typeof value==='string'&&!/authorization|cookie|token|secret|api[-_]?key/i.test(key))) as Record<string,string>;
      if(Object.keys(visibleHeaders).length!==Object.keys(headers).length)issues.push('認證 Header 已省略，請在執行時選擇秘密參照。');
      add(file.path,node,{name:`${location} · ${method} ${typeof endpoint==='string'?endpoint:'動態網址'}`,method,endpoint:typeof endpoint==='string'?endpoint:'',headers:visibleHeaders,queryParams:config.params&&typeof config.params==='object'?config.params:{},body:requestBody,issues},`http:${trim(file.path)}:${location}:${ordinal}`);
     }
    }
   }
   ts.forEachChild(node,visit);
  };visit(state.sf);
 }
 return {requests:collectRequestUsages(requests,index,(node,path,bindings)=>evaluate(node,path,new Set(),0,bindings),trim),issues:[...warnings]};
}

export function diffRequests(before:RequestDefinition[],after:RequestDefinition[]):RequestChange[]{
 const old=new Map(before.map(item=>[item.id,item]));const changes:RequestChange[]=[];
 for(const item of after){const previous=old.get(item.id);old.delete(item.id);if(!previous){changes.push({requestId:item.id,name:item.name,kind:'added',details:['新增 API 定義']});continue;}
  const details:string[]=[];const fields:{label:string;before:string;after:string}[]=[];
  if(previous.usages&&digest(previous.usages)!==digest(item.usages)){details.push('前端呼叫參數或位置變更');fields.push({label:'前端使用方式',before:JSON.stringify(previous.usages,null,2),after:JSON.stringify(item.usages||[],null,2)});}
  for(const [field,label] of [['method','方法'],['endpoint','端點'],['body','請求內容'],['headers','Headers'],['queryParams','查詢參數'],['parameterTypes','參數型別'],['operationName','操作名稱']] as const)if(digest(previous[field])!==digest(item[field])){details.push(`${label}變更`);fields.push({label,before:typeof previous[field]==='string'?previous[field]:JSON.stringify(previous[field],null,2),after:typeof item[field]==='string'?item[field]:JSON.stringify(item[field],null,2)});}
  if(previous.implementationHash!==item.implementationHash){const paths=[...new Set([...Object.keys(previous.dependencies),...Object.keys(item.dependencies)])].filter(path=>previous.dependencies[path]!==item.dependencies[path]);details.push('引用或實作檔案變更，需檢查影響：'+paths.join('、'));}
  if(details.length)changes.push({requestId:item.id,name:item.name,kind:'changed',details,fields});
 }
 for(const item of old.values())changes.push({requestId:item.id,name:item.name,kind:'removed',details:['API 已不在此版本來源中']});return changes;
}

export function affectedCases(changes:RequestChange[],cases:SavedApiCase[],scripts:any[],flows:any[]):ApiImpact[]{
 const byRequest=new Map(changes.map(item=>[item.requestId,item]));
 return cases.filter(item=>byRequest.has(item.requestId)).map(item=>({caseId:item.id,caseName:item.name,reason:byRequest.get(item.requestId)!.details,
  scripts:[...item.scriptLinks.map(link=>{const script=scripts.find(script=>script.id===link.scriptId);return {id:link.scriptId,name:script?.name||link.scriptId,step:link.step,version:script?.version};}),...scripts.filter(script=>script.apiFlow?.projectId===item.projectId&&script.apiFlow.cases?.some((ref:any)=>ref.id===item.id)&&!item.scriptLinks.some(link=>link.scriptId===script.id)).map(script=>({id:script.id,name:script.name,step:item.name,version:script.version}))],
  flows:flows.filter(flow=>flow.projectId===item.projectId&&flow.steps?.some((step:any)=>step.caseId===item.id||item.scriptLinks.some(link=>link.scriptId===step.caseId))).map(flow=>({id:flow.id,name:flow.name,steps:flow.steps.filter((step:any)=>step.caseId===item.id||item.scriptLinks.some(link=>link.scriptId===step.caseId)).map((step:any)=>step.snapshot?.name||step.caseId)})),
 }));
}

export function inferredScriptImpacts(projectId:string,changes:RequestChange[],definitions:RequestDefinition[],scripts:any[],flows:any[]):ApiImpact[]{
 const impacts:ApiImpact[]=[];
 for(const script of scripts){if(typeof script.source!=='string')continue;
  const sf=ts.createSourceFile('script.ts',script.source,ts.ScriptTarget.Latest,true);const literals:{value:string;step:string}[]=[];
  const visit=(node:ts.Node)=>{
   if(ts.isStringLiteralLike(node)){
    let step='';for(let parent:ts.Node|undefined=node.parent;parent;parent=parent.parent)if(ts.isCallExpression(parent)&&parent.expression.getText(sf)==='test.step'&&parent.arguments[0]&&ts.isStringLiteralLike(parent.arguments[0])){step=parent.arguments[0].text;break;}
    literals.push({value:node.text,step});
   }ts.forEachChild(node,visit);
  };visit(sf);
  for(const change of changes){
   const definition=definitions.find(item=>item.id===change.requestId);if(!definition)continue;
   const matches=literals.filter(item=>definition.operationName?item.value===definition.operationName||new RegExp('\\b(?:query|mutation|subscription)\\s+'+definition.operationName+'\\b').test(item.value):!!definition.endpoint&&!definition.endpoint.includes('{{')&&item.value===definition.endpoint);
   if(!matches.length)continue;
   impacts.push({caseId:`inferred:${script.id}:${change.requestId}`,caseName:change.name,inferred:true,reason:[...change.details,'腳本字面值匹配，屬潛在影響，需核對實際呼叫關係'],scripts:[...new Set(matches.map(item=>item.step))].map(step=>({id:script.id,name:script.name,version:script.version,step,inferred:true})),flows:flows.filter(flow=>flow.projectId===projectId&&flow.steps?.some((step:any)=>step.caseId===script.id)).map(flow=>({id:flow.id,name:flow.name,steps:flow.steps.filter((step:any)=>step.caseId===script.id).map((step:any)=>step.snapshot?.name||step.caseId)}))});
  }
 }return impacts;
}
