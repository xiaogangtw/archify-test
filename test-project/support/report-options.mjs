import { readFileSync, existsSync, lstatSync } from 'node:fs';
import { resolve, relative, isAbsolute, parse } from 'node:path';
import { parseEnv } from 'node:util';
export function reportPath(root, part) {
  if(typeof part!=='string'||!part||part.includes('\\')||part.includes(':')||part.includes('\0')||part.split('/').some(value=>!value||value.startsWith('.')))throw new Error('報告路徑不合法。');
  const path=resolve(root,part),rel=relative(resolve(root),path);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw new Error('報告路徑超出測試專案。');
  let current=parse(path).root;for(const segment of relative(current,path).split(/[\\/]/)){current=resolve(current,segment);if(existsSync(current)&&lstatSync(current).isSymbolicLink())throw new Error('報告不接受連結目錄。');}
  return path;
}
export function loadProjectEnv(root){const path=resolve(root,'.env');if(existsSync(path)){if(lstatSync(path).isSymbolicLink()||lstatSync(path).size>1024*1024)throw new Error('測試環境設定格式不符。');for(const [key,value]of Object.entries(parseEnv(readFileSync(path,'utf8'))))if(!Object.hasOwn(process.env,key))process.env[key]=value;}}
export function readReportSettings(root){
 const file=reportPath(root,'config/report.json');if(!existsSync(file))return {screenshots:false,androidSerial:''};if(lstatSync(file).size>16384)throw new Error('報告設定過大。');
 let value;try{value=JSON.parse(readFileSync(file,'utf8'));}catch{throw new Error('報告設定不是合法 JSON。');}
 if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.screenshots!=='boolean'||(value.androidSerial!==undefined&&value.androidSerial!==''&&!/^emulator-\d+$/.test(value.androidSerial)))throw new Error('報告設定格式不符。');
 return {screenshots:value.screenshots,androidSerial:value.androidSerial||''};
}
export function reportOptions(root,env=process.env){const value=readReportSettings(root);if(env.ARCHIFY_SCREENSHOTS!==undefined){if(!['0','1'].includes(env.ARCHIFY_SCREENSHOTS))throw new Error('ARCHIFY_SCREENSHOTS 請用 0 或 1。');value.screenshots=env.ARCHIFY_SCREENSHOTS==='1';}return {...value,androidSerial:env.ANDROID_UDID||value.androidSerial};}
export function reportRoot(root){const file=reportPath(root,'archify.config.json');const config=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};return {config,part:config.reportDir||'reports',directory:reportPath(root,config.reportDir||'reports')};}
export function caseTarget(source){return source.startsWith('tests/mobile/')?'android':(source.startsWith('tests/ui/')||source.startsWith('tests/web/'))?'web':'api';}
export function pngBuffer(bytes){if(!Buffer.isBuffer(bytes)||bytes.length<24||bytes.length>2*1024*1024||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.toString('ascii',12,16)!=='IHDR')throw new Error('截圖必須是 2 MB 內的 PNG。');const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);if(!width||!height||width>12000||height>12000||width*height>40000000)throw new Error('截圖尺寸不符。');return bytes;}
