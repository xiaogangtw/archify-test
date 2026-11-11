import { createRequire } from 'node:module';
import { readFile, writeFile, lstat, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { frontendSnapshot, sourceDigest } from '../../test-project/support/frontend-snapshot.mjs';
import { sourceModuleResolver } from '../control-api/src/sourceModuleResolver.ts';
import { operationStems } from './naming.mjs';
import { child, noLinks, makeDirectory } from './paths.mjs';
import { applyFeatureMap, validateFeatureMap } from '../../test-project/support/feature-map.mjs';
const ts = createRequire(new URL('../../package.json',import.meta.url))('typescript');
const json = value => JSON.stringify(value,null,2)+'\n';
const pageFile = path => !/(?:^|\/)(hooks|utils)\//.test(path) && /(?:Page|Screen)\.[jt]sx?$/.test(path);

export function frontendEvidence(snapshot, analysis, catalogRevision) {
  const warnings = new Set(snapshot.warnings), resolveModule = sourceModuleResolver(snapshot.files,warnings);
  const modules = new Map(), ast = new Map();
  for(const input of snapshot.files) {
    if(!/\.[cm]?[jt]sx?$/.test(input.path)) continue;
    const file=ts.createSourceFile(input.path,input.source,ts.ScriptTarget.Latest,true), declarations=new Map(), bindings=new Map(), imports=[];
    for(const statement of file.statements) {
      if(ts.isVariableStatement(statement)) for(const declaration of statement.declarationList.declarations) if(ts.isIdentifier(declaration.name)&&declaration.initializer) declarations.set(declaration.name.text,declaration.initializer);
      if(ts.isFunctionDeclaration(statement)&&statement.name) declarations.set(statement.name.text,statement);
      if(ts.isImportDeclaration(statement)&&statement.importClause&&!statement.importClause.isTypeOnly&&ts.isStringLiteralLike(statement.moduleSpecifier)) {
        const target=resolveModule(input.path,statement.moduleSpecifier.text), clause=statement.importClause;
        if(target) {
          if(clause.name) bindings.set(clause.name.text,{target,name:'default'});
          if(clause.namedBindings&&ts.isNamedImports(clause.namedBindings)) for(const item of clause.namedBindings.elements) if(!item.isTypeOnly) bindings.set(item.name.text,{target,name:item.propertyName?.text||item.name.text});
        }
      }
    }
    function walk(node) {
      let specifier;
      if((ts.isImportDeclaration(node)&&!node.importClause?.isTypeOnly || ts.isExportDeclaration(node)&&!node.isTypeOnly)&&node.moduleSpecifier&&ts.isStringLiteralLike(node.moduleSpecifier)) specifier=node.moduleSpecifier.text;
      if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments[0]&&ts.isStringLiteralLike(node.arguments[0])) specifier=node.arguments[0].text;
      if(specifier) { const target=resolveModule(input.path,specifier); if(target&&!imports.some(row=>row.path===target)) imports.push({path:target,line:file.getLineAndCharacterOfPosition(node.getStart(file)).line+1}); }
      ts.forEachChild(node,walk);
    }
    walk(file); modules.set(input.path,{path:input.path,hash:sourceDigest(input.source),imports}); ast.set(input.path,{file,declarations,bindings});
    if(file.parseDiagnostics.length)warnings.add(`有語法未完整辨識：${input.path}`);
  }
  function unwrap(node){ while(node&&(ts.isAsExpression(node)||ts.isSatisfiesExpression(node)||ts.isParenthesizedExpression(node)||ts.isTypeAssertionExpression(node)))node=node.expression;return node; }
  function symbol(path,name,depth=0) {
    if(depth>16)return undefined;
    const data=ast.get(path);if(!data)return undefined;
    if(data.declarations.has(name))return {path,node:data.declarations.get(name)};
    const binding=data.bindings.get(name);if(binding)return symbol(binding.target,binding.name,depth+1);
    for(const statement of data.file.statements) {
      if(name==='default'&&ts.isExportAssignment(statement))return {path,node:statement.expression};
      if(ts.isExportDeclaration(statement)&&statement.moduleSpecifier&&ts.isStringLiteralLike(statement.moduleSpecifier)) {
        const target=resolveModule(path,statement.moduleSpecifier.text);if(!target)continue;
        if(statement.exportClause&&ts.isNamedExports(statement.exportClause)){const item=statement.exportClause.elements.find(item=>item.name.text===name);if(item)return symbol(target,item.propertyName?.text||item.name.text,depth+1);}
        if(!statement.exportClause){const value=symbol(target,name,depth+1);if(value)return value;}
      }
    }
  }
  function object(path,node,depth=0){node=unwrap(node);if(!node||depth>16)return undefined;if(ts.isObjectLiteralExpression(node))return {path,node};if(ts.isIdentifier(node)){const value=symbol(path,node.text);if(value)return object(value.path,value.node,depth+1);}return undefined;}
  function string(path,node,depth=0){node=unwrap(node);if(!node||depth>16)return undefined;if(ts.isStringLiteralLike(node))return node.text;if(ts.isIdentifier(node)){const value=symbol(path,node.text);if(value)return string(value.path,value.node,depth+1);}if(ts.isPropertyAccessExpression(node)){const value=object(path,node.expression,depth+1);const property=value?.node.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText().replace(/^['"]|['"]$/g,'')===node.name.text);if(property)return string(value.path,property.initializer,depth+1);}return undefined;}
  function component(path,node,depth=0){node=unwrap(node);if(!node||depth>12)return undefined;if(ts.isIdentifier(node)){const binding=ast.get(path)?.bindings.get(node.text);if(binding)return binding.target;const value=symbol(path,node.text);if(value&&value.node!==node)return component(value.path,value.node,depth+1);}let target;function walk(n){if(ts.isCallExpression(n)&&n.expression.kind===ts.SyntaxKind.ImportKeyword&&n.arguments[0]&&ts.isStringLiteralLike(n.arguments[0]))target=resolveModule(path,n.arguments[0].text);ts.forEachChild(n,walk);}walk(node);return target;}
  const routes=new Map(), navigation=[], unresolved=[];
  for(const [path,data] of ast) {
    const {file}=data;
    function route(node,pathNode,componentNode,properties={}) {
      const url=string(path,pathNode), target=component(path,componentNode), line=file.getLineAndCharacterOfPosition(node.getStart(file)).line+1;
      if(url===undefined){unresolved.push({path,line,reason:'動態路由位置需 AI 核對'});return;}
      if(!target){unresolved.push({path,line,reason:'路由元件未能靜態對應'});return;}
      const key=url+'|'+target, id='ROUTE-'+sourceDigest(key).slice(0,16), previous=routes.get(key);
      const readBool=name=>properties[name]?.kind===ts.SyntaxKind.TrueKeyword?true:properties[name]?.kind===ts.SyntaxKind.FalseKeyword?false:null;
      const title=string(path,properties.title), description=string(path,properties.description);
      if(previous){previous.sources.push({path,line});if(title)previous.title=title.slice(0,200);if(description)previous.description=description.slice(0,1000);if(readBool('requireAuth')!==null)previous.requireAuth=readBool('requireAuth');return;}
      routes.set(key,{id,url,component:target,title:title?.slice(0,200)||'',description:description?.slice(0,1000)||'',requireAuth:readBool('requireAuth'),onlyGuest:readBool('onlyGuest'),sources:[{path,line}],container:!pageFile(target)});
    }
    function walk(node) {
      if(ts.isObjectLiteralExpression(node)) {
        const p=Object.fromEntries(node.properties.filter(ts.isPropertyAssignment).map(property=>[property.name.getText(file).replace(/^['"]|['"]$/g,''),property.initializer]));
        if(p.path&&p.component)route(node,p.path,p.component,p);
      }
      if((ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node))&&node.tagName.getText(file)==='Route') {
        const attrs=Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(attr=>[attr.name.getText(file),attr.initializer&&ts.isJsxExpression(attr.initializer)?attr.initializer.expression:attr.initializer]));
        let componentNode;function jsx(n){if(!n)return;if((ts.isJsxSelfClosingElement(n)||ts.isJsxOpeningElement(n))&&ts.isIdentifier(n.tagName)){const target=component(path,n.tagName);if(target&&pageFile(target))componentNode=n.tagName;}ts.forEachChild(n,jsx);}jsx(attrs.element);
        if(attrs.path&&componentNode)route(node,attrs.path,componentNode);
      }
      if(ts.isCallExpression(node)&&/^(navigate|router\.(push|replace))$/.test(node.expression.getText(file))) {
        const to=string(path,node.arguments[0]);if(to&&to.startsWith('/'))navigation.push({path,line:file.getLineAndCharacterOfPosition(node.getStart(file)).line+1,to});
      }
      ts.forEachChild(node,walk);
    }
    walk(file);
  }
  function reachable(start){const visited=new Set(), queue=[start];while(queue.length){const path=queue.shift();if(visited.has(path))continue;visited.add(path);for(const row of modules.get(path)?.imports||[])queue.push(row.path);}return visited;}
  const stems=operationStems(analysis.requests), pages=[];
  const candidates=new Set([...modules.keys()].filter(pageFile));for(const row of routes.values())if(!row.container)candidates.add(row.component);
  for(const path of [...candidates].sort()) {
    const reach=reachable(path), related=[...routes.values()].filter(route=>route.component===path);
    const apiIds=analysis.requests.filter(item=>item.evidence.some(source=>reach.has(source.path))).map(item=>item.id);
    pages.push({id:'PAGE-'+sourceDigest(path).slice(0,16),path,routeIds:related.map(row=>row.id),apiIds,imports:[...(modules.get(path)?.imports||[])],dependencies:[...reach],navigation:navigation.filter(row=>reach.has(row.path)),apiRelation:'static-import-reachability'});
  }
  return {schemaVersion:1,sourceHash:snapshot.sourceHash,catalogRevision,createdAt:new Date().toISOString(),files:snapshot.files.map(file=>({path:file.path,hash:sourceDigest(file.source),lines:file.source.split("\n").length})),modules:[...modules.values()],routes:[...routes.values()],pages,apis:analysis.requests.map(item=>({id:item.id,name:item.name,operationName:item.operationName,kind:item.kind,method:item.method,apiFile:`api/${stems.get(item.id)}.ts`,evidence:item.evidence})),unresolved,warnings:[...warnings,...analysis.warnings],scope:'readable-source-only'};
}

export function frontendFeatureStore(config) {
  const evidencePath=child(config.projectRoot,config.analysisDir+'/feature-evidence.json');
  const proposalPath=child(config.projectRoot,config.analysisDir+'/feature-map.proposal.json');
  async function read(file){await noLinks(file);const stat=await lstat(file);if(!stat.isFile()||stat.size>8*1024*1024)throw new Error('功能分析檔案過大或格式不符。');return JSON.parse(await readFile(file,'utf8'));}
  return {
    async prepare(analysis,catalogRevision,catalog) {
      const snapshot=await frontendSnapshot(config.sourceRoot);if(snapshot.sourceHash!==analysis.sourceHash)throw new Error('來源已變更，請重新分析後準備功能資料。');
      let cached;
      try {cached=await read(evidencePath);}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
      const sourceRootHash=sourceDigest(config.sourceRoot);
      const evidence=cached?.cacheVersion===1&&cached.sourceRootHash===sourceRootHash&&cached.sourceHash===snapshot.sourceHash&&JSON.stringify(cached.snapshotWarnings)===JSON.stringify(snapshot.warnings)&&JSON.stringify(cached.analysisWarnings)===JSON.stringify(analysis.warnings)
        ? {...cached,catalogRevision,createdAt:new Date().toISOString()}
        : frontendEvidence(snapshot,analysis,catalogRevision);
      evidence.cacheVersion=1;evidence.sourceRootHash=sourceRootHash;
      evidence.snapshotWarnings=snapshot.warnings;evidence.analysisWarnings=analysis.warnings;
      const old=new Map((catalog.frontendAnalysis?.files||[]).map(row=>[row.path,row.hash])),next=new Map(evidence.files.map(row=>[row.path,row.hash]));
      const added=[...next.keys()].filter(path=>!old.has(path)),modified=[...next].filter(([path,hash])=>old.has(path)&&old.get(path)!==hash).map(([path])=>path),removed=[...old.keys()].filter(path=>!next.has(path)),changed=new Set([...added,...modified,...removed]);
      evidence.changes={firstRun:!catalog.frontendAnalysis,added,modified,removed,affectedFeatures:catalog.features.filter(row=>[...(row.frontend?.dependencies||[]),...row.sources.map(source=>source.path)].some(path=>changed.has(path))).map(row=>row.id)};
      evidence.previousFeatures=catalog.features;
      const baseline=catalog.frontendAnalysis;
      evidence.previousAnalysis=baseline?{incremental:baseline.incremental,coverage:baseline.coverage,routes:baseline.routes,pages:baseline.pages,apis:baseline.apis,relations:baseline.relations,notes:baseline.notes,warnings:baseline.warnings,unresolved:baseline.unresolved}:undefined;
      await makeDirectory(dirname(evidencePath));await noLinks(evidencePath);
      const temp=evidencePath+'.'+randomUUID()+'.tmp';await writeFile(temp,json(evidence),{flag:'wx'});await rename(temp,evidencePath);
      return {evidenceFile:config.analysisDir+'/feature-evidence.json',proposalFile:config.analysisDir+'/feature-map.proposal.json',sourceHash:evidence.sourceHash,pages:evidence.pages.length,routes:evidence.routes.length,apis:evidence.apis.length,warnings:evidence.warnings};
    },
    async status() {try {const evidence=await read(evidencePath);let proposal=false;try{await noLinks(proposalPath);proposal=(await lstat(proposalPath)).isFile();}catch(error){if(error.code!=='ENOENT')throw error;}return {prepared:true,sourceHash:evidence.sourceHash,pages:evidence.pages.length,routes:evidence.routes.length,proposal};}catch(error){if(error.code==='ENOENT')return {prepared:false,proposal:false};throw error;}},
    async apply(incremental) {const evidence=await read(evidencePath),proposal=await read(proposalPath);if(incremental)evidence.incremental=incremental;validateFeatureMap(proposal,evidence);return applyFeatureMap(config.projectRoot,proposal,evidence,config.sourceRoot);}
  };
}
