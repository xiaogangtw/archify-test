import ts from 'typescript';
import {buildClientSchema,getNamedType,isInputObjectType,parse,printType,typeFromAST,visit,type GraphQLType} from 'graphql';
import {sourceModuleResolver} from './sourceModuleResolver.ts';
import type {RequestDefinition} from './apiContracts.ts';

// Read only the immutable snapshot; never resolve imports against the host disk.
export function workflowEvidence(files:{path:string;source:string}[],requests:RequestDefinition[],cachedSchema?:any){
 const warnings=new Set<string>();const byPath=new Map(files.map(file=>[file.path,file]));const resolve=sourceModuleResolver(files,warnings);
 const edges=new Map<string,string[]>();const reverse=new Map<string,string[]>();
 for(const file of files){if(!/\.(?:[cm]?[jt]sx?|vue|svelte)$/.test(file.path))continue;const sf=ts.createSourceFile(file.path,file.source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const targets:string[]=[];
  for(const node of sf.statements){if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)){const target=resolve(file.path,node.moduleSpecifier.text);if(target){targets.push(target);reverse.set(target,[...(reverse.get(target)||[]),file.path]);}}}edges.set(file.path,targets);
 }
 const queue=requests.flatMap(item=>[...(item.evidence||[]).map(value=>({path:value.path,depth:0,reason:'接口定義'})),...(item.usages||[]).map(value=>({path:value.path,depth:0,reason:'前端呼叫位置'}))]);
 const seen=new Set<string>();const selected:{path:string;startLine:number;source:string;reason:string}[]=[];let characters=0;
 const symbols=new Set(requests.flatMap(item=>[item.operationName,item.name,...[...(item.parameterTypes||'').matchAll(/\b[A-Z][A-Za-z0-9_]*(?:Input|Args)\b/g)].map(value=>value[0])]));
 for(let cursor=0;cursor<queue.length;cursor++){const item=queue[cursor];if(seen.has(item.path))continue;seen.add(item.path);const file=byPath.get(item.path);if(!file)continue;
  if(seen.size>40){warnings.add('關聯檔案超過 40 個；尚未讀取的分支不能推定為未使用。');break;}
  let snippets:{source:string;startLine:number}[]=[{source:file.source,startLine:1}];
  if(file.source.length>16000){const sf=ts.createSourceFile(file.path,file.source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);snippets=sf.statements.filter(node=>ts.isImportDeclaration(node)||[...symbols].some(name=>name&&node.getText(sf).includes(name))).map(node=>({source:node.getText(sf),startLine:sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1}));warnings.add(`${file.path}：大型檔案只提供匹配的完整宣告，其他宣告未檢查。`);}
  for(const snippet of snippets){if(characters+snippet.source.length>105000){warnings.add(`${file.path}:${snippet.startLine} 超出證據容量，未提供此完整片段。`);continue;}selected.push({path:file.path,...snippet,reason:item.reason});characters+=snippet.source.length;}
  if(item.depth<3){for(const path of edges.get(item.path)||[])queue.push({path,depth:item.depth+1,reason:'引用實作或型別'});for(const path of reverse.get(item.path)||[])queue.push({path,depth:item.depth+1,reason:'匯入此模組的呼叫端，需依內容確認使用關係'});}
 }
 const types=new Map<string,string>();
 if(cachedSchema?.data){try{const schema=buildClientSchema(cachedSchema.data);const collect=(type:GraphQLType)=>{const named=getNamedType(type);if(!named||types.has(named.name))return;types.set(named.name,printType(named));if(isInputObjectType(named))for(const field of Object.values(named.getFields()))collect(field.type);};for(const request of requests){let query='';try{query=JSON.parse(request.sourceRequest?.body||request.body).query||'';}catch{}if(!query)continue;visit(parse(query),{VariableDefinition(node){const type=typeFromAST(schema,node.type);if(type)collect(type);}});}}catch{warnings.add('此環境 schema 無法解析；不能猜測 input 欄位。');}}
 else warnings.add('目前環境尚未載入 schema；請先載入以辨識 GraphQL input 欄位。');
 return {sources:selected,schema:{hash:cachedSchema?.hash,checkedAt:cachedSchema?.checkedAt,inputTypes:[...types.values()]},warnings:[...warnings],scope:'僅上述快照片段與型別是已提供證據；未提供不代表不存在或未使用。'};
}
