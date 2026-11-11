import ts from 'typescript';
import {posix} from 'node:path';

// Resolve only against the immutable upload. Never read the host filesystem.
export function sourceModuleResolver(files:{path:string;source:string}[], warnings:Set<string>) {
 const root='/snapshot/';
 const contents=new Map(files.map(file=>[posix.normalize(root+file.path),file.source]));
 const directories=new Set<string>(['/','/snapshot']);
 for(const path of contents.keys())for(let dir=posix.dirname(path);dir!=='/';dir=posix.dirname(dir))directories.add(dir);
 const host:ts.ParseConfigFileHost={
  useCaseSensitiveFileNames:true,getCurrentDirectory:()=>'/snapshot',
  fileExists:path=>contents.has(posix.normalize(path)),
  readFile:path=>contents.get(posix.normalize(path)),
  readDirectory:()=>[],
  onUnRecoverableConfigFileDiagnostic:diagnostic=>warnings.add(`設定解析失敗：${ts.flattenDiagnosticMessageText(diagnostic.messageText,' ')}`),
 };
 const moduleHost:ts.ModuleResolutionHost={...host,directoryExists:path=>directories.has(posix.normalize(path)),realpath:path=>posix.normalize(path)};
 const cache=new Map<string,ts.CompilerOptions>();
 function options(from:string) {
  let dir=posix.dirname(root+from);
  while(dir.startsWith('/snapshot')){
   for(const name of ['tsconfig.json','jsconfig.json']){
    const path=posix.join(dir,name);if(!contents.has(path))continue;
    if(!cache.has(path)){
     const parsed=ts.getParsedCommandLineOfConfigFile(path,{},host);
     for(const diagnostic of parsed?.errors || [])if(![18002,18003].includes(diagnostic.code))warnings.add(`${path.slice(root.length)}：${ts.flattenDiagnosticMessageText(diagnostic.messageText,' ')}`);
     cache.set(path,parsed?.options || {});
    }
    return cache.get(path)!;
   }
   dir=posix.dirname(dir);
  }
  return {};
 }
 return (from:string,specifier:string):string|undefined=>{
  const config=options(from);
  const compilerOptions:ts.CompilerOptions={...config,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,allowJs:true,resolveJsonModule:true};
  const result=ts.resolveModuleName(specifier,root+from,compilerOptions,moduleHost).resolvedModule;
  if(result && contents.has(result.resolvedFileName))return result.resolvedFileName.slice(root.length);
  // TypeScript does not resolve GraphQL documents. Apply its resolved path mappings
  // to these source assets, including mappings inherited from another config.
  const bases:string[]=[];
  if(specifier.startsWith('.'))bases.push(posix.resolve(root,posix.dirname(from),specifier));
  else {
   const base=config.baseUrl || (config as ts.CompilerOptions & {pathsBasePath?:string}).pathsBasePath || '/snapshot';
   for(const [pattern,targets] of Object.entries(config.paths || {}).sort(([a],[b])=>b.replace('*','').length-a.replace('*','').length)){
    const star=pattern.indexOf('*');
    if(star<0){if(pattern===specifier)for(const target of targets)bases.push(posix.resolve(base,target));continue;}
    const before=pattern.slice(0,star),after=pattern.slice(star+1);
    if(!specifier.startsWith(before)||!specifier.endsWith(after)||specifier.length<before.length+after.length)continue;
    const capture=specifier.slice(before.length,after?-after.length:undefined);
    for(const target of targets)bases.push(posix.resolve(base,target.replace('*',capture)));
   }
  }
  for(const base of bases)for(const suffix of ['', '.graphql','.gql'])if(contents.has(base+suffix))return (base+suffix).slice(root.length);
  return undefined;
 };
}
