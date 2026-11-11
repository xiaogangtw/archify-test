import { readFile, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFeatureMap, applyFeatureMap } from './feature-map.mjs';
import { rejectSourceLinks } from './frontend-snapshot.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),[command,...args]=process.argv.slice(2);
async function load(file){await rejectSourceLinks(file);const stat=await lstat(file);if(!stat.isFile()||stat.size>8*1024*1024)throw new Error('分析檔案過大或非一般檔案。');return JSON.parse(await readFile(file,'utf8'));}
try{
  const marker=await load(join(root,'archify.config.json'));
  const dir=marker.analysisDir||'analysis';
  if(typeof dir!=='string'||dir.includes('..')||dir.includes(':')||/^[\\/]/.test(dir))throw new Error('分析位置必須在測試專案內。');
  const proposal=await load(resolve(root,args[0]||dir+'/feature-map.proposal.json')),evidence=await load(resolve(root,dir+'/feature-evidence.json'));
  if(command==='validate')console.log(JSON.stringify(validateFeatureMap(proposal,evidence)));
  else if(command==='apply'){const index=args.indexOf('--source-root');if(index<0||!args[index+1])throw new Error('套用時請指定 --source-root 前端絕對路徑；不會執行來源。');console.log(JSON.stringify(await applyFeatureMap(root,proposal,evidence,args[index+1])));}
  else throw new Error('請使用 npm run features:validate 或 features:apply。');
}catch(error){console.error(error.message);process.exitCode=1;}
