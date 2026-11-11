import ts from 'typescript';
import {posix} from 'node:path';
import {sourceModuleResolver} from './sourceModuleResolver.ts';
export const apiAnalysisVersion=2;
export const analysisEvidenceLimit=190000;
export interface SourceFile {path:string;source:string}
interface Unit {file:SourceFile;node?:ts.Statement;start:number;end:number;names:string[];refs:Set<string>;reason:string}
export interface AnalysisSelection {snippets:{path:string;startLine:number;continued:boolean;source:string;reason:string}[];groups?:{path:string;startLine:number;continued:boolean;source:string;reason:string}[][];totalFiles:number;selectedFiles:number;selectedCharacters:number;totalCharacters:number;unresolved:string[]}
const supported=/\.(?:[cm]?[jt]sx?|vue|svelte|graphql|gql|json)$/i;
const networkMethods=new Set(['get','post','put','patch','delete','request','send','mutate','query','subscribe','create']);
export function selectApiSources(input:SourceFile[]):AnalysisSelection {
 const files=input.filter(file=>supported.test(file.path));const byPath=new Map(files.map(file=>[posix.normalize(file.path),file]));
 const parsed=new Map<string,ts.SourceFile>();const units:Unit[]=[];const byFile=new Map<string,Unit[]>();const locals=new Map<string,Map<string,Unit>>();const imports=new Map<string,Map<string,{specifier:string;name:string;unit:Unit}>>();
 const warnings=new Set<string>();
 const resolveModule=sourceModuleResolver(files,warnings);
 for(const file of files){
  const list:Unit[]=[];const names=new Map<string,Unit>();const bindings=new Map<string,{specifier:string;name:string;unit:Unit}>();
  if(/\.(?:graphql|gql|json)$/.test(file.path)) {
   const unit={file,start:0,end:file.source.length,names:[],refs:new Set<string>(),reason:/\b(?:query|mutation|subscription|fragment)\b/.test(file.source)&&!/\.json$/.test(file.path)?'GraphQL 文件':''};units.push(unit);list.push(unit);
  }else{
   const sf=ts.createSourceFile(file.path,file.source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);parsed.set(file.path,sf);
   if((sf as ts.SourceFile & {parseDiagnostics?:readonly ts.Diagnostic[]}).parseDiagnostics?.length)warnings.add(`${file.path}：包含解析不完整的語法（Vue／Svelte 尚未使用專用解析器）`);
   for(const node of sf.statements){
    const refs=new Set<string>();const declared:string[]=[];let reason='';
    const visit=(item:ts.Node)=>{
     if(ts.isIdentifier(item))refs.add(item.text);
     if(ts.isCallExpression(item)){
      const call=item.expression;
      if(ts.isIdentifier(call) && /^(?:fetch|axios|request|graphql|gql)$/.test(call.text))reason='請求呼叫／GraphQL client';
      if(ts.isPropertyAccessExpression(call) && networkMethods.has(call.name.text) && (/client|axios|http|request|api|graphql/i.test(call.expression.getText(sf)) || ['post','put','patch','request','mutate'].includes(call.name.text)))reason='請求方法呼叫（靜態候選，需確認接收者）';
     }
     if((ts.isStringLiteralLike(item) || ts.isNoSubstitutionTemplateLiteral(item) || ts.isTemplateHead(item)) && /\b(?:query|mutation|subscription)\s+[A-Za-z_]\w*(?:\s*\(|\s*\{)/.test(item.text))reason='GraphQL 操作定義';
     if(ts.isTaggedTemplateExpression(item) && /gql|graphql/i.test(item.tag.getText(sf)))reason='GraphQL 模板定義';
     ts.forEachChild(item,visit);
    };visit(node);
    if(ts.isVariableStatement(node))for(const declaration of node.declarationList.declarations)if(ts.isIdentifier(declaration.name))declared.push(declaration.name.text);
    if(('name' in node) && node.name && ts.isIdentifier(node.name as ts.Node))declared.push((node.name as ts.Identifier).text);
    const unit:Unit={file,node,start:node.getStart(sf),end:node.end,names:declared,refs,reason};units.push(unit);list.push(unit);for(const name of declared)names.set(name,unit);
    if(ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)){
     const specifier=node.moduleSpecifier.text;const clause=node.importClause;
     if(clause?.name)bindings.set(clause.name.text,{specifier,name:'default',unit});
     if(clause?.namedBindings){if(ts.isNamespaceImport(clause.namedBindings))bindings.set(clause.namedBindings.name.text,{specifier,name:'*',unit});else for(const element of clause.namedBindings.elements)bindings.set(element.name.text,{specifier,name:element.propertyName?.text || element.name.text,unit});}
    }
   }
  }
  byFile.set(file.path,list);locals.set(file.path,names);imports.set(file.path,bindings);
 }
 function resolve(from:string,specifier:string):SourceFile|undefined {
  const resolved=resolveModule(from,specifier);if(resolved)return byPath.get(resolved);
  const bases:string[]=[];
  if(specifier.startsWith('.'))bases.push(posix.normalize(posix.join(posix.dirname(from),specifier)));
  else{
   if(/^[@~]\//.test(specifier)){const marker=from.lastIndexOf('/src/');const root=marker>=0?from.slice(0,marker+4):from.startsWith('src/')?'src':'';if(root){bases.push(root+'/'+specifier.slice(2));warnings.add(`${from}：alias ${specifier} 未由設定解析，暫依 src 目錄推定，需確認 alias 設定`);}}
  }
  for(const base of bases)for(const suffix of ['', '.ts','.tsx','.js','.jsx','.mts','.cts','.mjs','.cjs','.json','.graphql','.gql','/index.ts','/index.tsx','/index.js']){const file=byPath.get(base+suffix);if(file)return file;}
  return undefined;
 }
 const selected=new Set<Unit>();const pending:Unit[]=[];const links=new Map<Unit,Set<Unit>>();let owner:Unit|undefined;
 function add(unit:Unit|undefined){if(unit && owner && unit!==owner){if(!links.has(owner))links.set(owner,new Set());links.get(owner)!.add(unit);}if(unit && !selected.has(unit)){selected.add(unit);pending.push(unit);}}
 function exported(file:SourceFile,name:string,seen=new Set<string>()):void {
  const key=file.path+':'+name;if(seen.has(key))return;seen.add(key);
  const list=byFile.get(file.path) || [];
  if(!parsed.has(file.path)){list.forEach(add);return;}
  if(name==='*'){list.forEach(add);warnings.add(`${file.path}：namespace／動態引用，保留整個模組`);return;}
  const direct=locals.get(file.path)?.get(name);if(direct){add(direct);return;}
  let found=false;
  for(const unit of list){const node=unit.node!;
   if(name==='default' && (ts.isExportAssignment(node) || ts.canHaveModifiers(node) && ts.getModifiers(node)?.some(mod=>mod.kind===ts.SyntaxKind.DefaultKeyword))){add(unit);return;}
   if(ts.isExportDeclaration(node)){
    const elements=node.exportClause && ts.isNamedExports(node.exportClause)?node.exportClause.elements:undefined;
    const match=elements?.find(element=>element.name.text===name);
    if(match || !node.exportClause){found=true;add(unit);if(node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)){const target=resolve(file.path,node.moduleSpecifier.text);if(target)exported(target,match?.propertyName?.text || match?.name.text || name,seen);else warnings.add(`${file.path}：未解析重新匯出 ${node.moduleSpecifier.text}`);}else if(match)add(locals.get(file.path)?.get(match.propertyName?.text || match.name.text));}
   }
  }
  if(!found)warnings.add(`${file.path}：未解析匯出 ${name}，需確認包裝實作或動態設定`);
 }
 units.filter(unit=>unit.reason).forEach(add);
 while(pending.length){
  const unit=pending.shift()!;owner=unit;const sf=parsed.get(unit.file.path);
  if(unit.node && ts.isImportDeclaration(unit.node))continue;
  for(const name of unit.refs){
   const local=locals.get(unit.file.path)?.get(name);if(local!==unit)add(local);
   const binding=imports.get(unit.file.path)?.get(name);if(!binding)continue;add(binding.unit);
   const target=resolve(unit.file.path,binding.specifier);
   if(target)exported(target,binding.name);else if(binding.specifier.startsWith('.') || /^[@~]\//.test(binding.specifier))warnings.add(`${unit.file.path}：未解析引用 ${binding.specifier}`);
  }
  if(sf)for(const other of byFile.get(unit.file.path) || []){
   if(!other.node)continue;
   // Client configuration and interceptors affect requests even when their return value is unused.
   const text=other.node.getText(sf);if(/(?:\.interceptors\.|\.defaults\.|setContext\s*\(|setLink\s*\()/.test(text))add(other);
  }
 }
 owner=undefined;
 const snippets=[...selected].filter(unit=>unit.end>unit.start).sort((a,b)=>a.file.path.localeCompare(b.file.path)||a.start-b.start).map(unit=>({path:unit.file.path,startLine:unit.file.source.slice(0,unit.start).split('\n').length,continued:false,source:unit.file.source.slice(unit.start,unit.end),reason:unit.reason || '請求引用的常數／型別／設定'}));
 const ordered=[...selected].filter(unit=>unit.end>unit.start).sort((a,b)=>a.file.path.localeCompare(b.file.path)||a.start-b.start);
 const sourceByUnit=new Map(ordered.map((unit,index)=>[unit,snippets[index]]));
 const groups=units.filter(unit=>unit.reason).map(root=>{const reached=new Set<Unit>();const visit=(unit:Unit)=>{if(reached.has(unit))return;reached.add(unit);for(const target of links.get(unit)||[])visit(target);};visit(root);return [...reached].map(unit=>sourceByUnit.get(unit)!).filter(Boolean);});
 return {snippets,groups,totalFiles:files.length,selectedFiles:new Set(snippets.map(item=>item.path)).size,selectedCharacters:snippets.reduce((sum,item)=>sum+item.source.length,0),totalCharacters:files.reduce((sum,file)=>sum+file.source.length,0),unresolved:[...warnings]};
}
export function sourceAnalysisParts(files:SourceFile[]) {
 const selection=selectApiSources(files);const parts:AnalysisSelection['snippets'][]=[];let current:AnalysisSelection['snippets']=[];let size=0;const included=new Set<string>();const coveredGroups: Set<string>[]=[];
 const key=(item:AnalysisSelection['snippets'][number])=>item.path+':'+item.startLine+':'+item.source;
 function flush(){if(current.length)parts.push(current);current=[];size=0;included.clear();}
 for(const group of selection.groups || []) {
  // A whole dependency closure already analyzed together needs no second request.
  // Never deduplicate an individual shared dependency across separate batches.
  if(coveredGroups.some(covered=>group.every(item=>covered.has(key(item)))))continue;
  const completeSize=group.reduce((sum,item)=>sum+JSON.stringify(item).length,0);
  if(completeSize>160000 && group.length>1)throw new Error(`來源依賴超出單批分析容量：${group[0]?.path}；未拆散依賴送出，請縮小分析範圍。`);
  const newItems=group.filter(item=>!included.has(key(item)));const groupSize=newItems.reduce((sum,item)=>sum+JSON.stringify(item).length,0);
  const batchLimit=completeSize>48000 || size>48000?160000:48000;
  if(size && size+groupSize>batchLimit)flush();
  for(const snippet of group){if(included.has(key(snippet)))continue;let line=snippet.startLine;
   for(let offset=0;offset<snippet.source.length;offset+=12000){const source=snippet.source.slice(offset,offset+12000);const item={...snippet,startLine:line,continued:offset>0 || offset+12000<snippet.source.length,source};const length=JSON.stringify(item).length;
    if(current.length && size+length>(completeSize>48000 && group.length>1 || size>48000?180000:48000))flush();current.push(item);size+=length;line+=(source.match(/\n/g)||[]).length;
   }included.add(key(snippet));
  }
  coveredGroups.push(new Set(group.map(key)));
 }
 flush();return parts;
}
