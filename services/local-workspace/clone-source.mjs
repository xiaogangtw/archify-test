import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {lstat,mkdir} from 'node:fs/promises';
import {resolve,dirname,isAbsolute} from 'node:path';
import {inside,noLinks,makeDirectory} from './paths.mjs';
const execute=promisify(execFile);
export function repositoryUrl(value){
 if(typeof value!=='string'||value.length>2048||/[\s\0]/.test(value))throw new Error('請填 HTTPS 或 SSH Git 網址，不含帳密或 token。');
 if(/^git@[A-Za-z0-9][A-Za-z0-9.-]*:[A-Za-z0-9_.\-/]+$/.test(value))return value;
 let url;try{url=new URL(value);}catch{throw new Error('Git 網址格式不符。');}
 if(!['https:','ssh:'].includes(url.protocol)||url.password||url.search||url.hash||(url.protocol==='https:'&&url.username)||(url.protocol==='ssh:'&&url.username!=='git')||url.pathname==='/'||!url.hostname||url.hostname.startsWith('-'))throw new Error('請使用不含帳密、query 或 token 的 HTTPS／git SSH 網址。');
 return url.href;
}
export async function cloneSource(config,input,run=execute){
 const url=repositoryUrl(input.url),path=input.path;
 if(typeof path!=='string'||!isAbsolute(path)||path.length>2048||/["\r\n\0]/.test(path))throw new Error('請填下載資料夾的完整路徑。');
 const target=resolve(path);
 for(const root of [config.platformRoot,config.projectRoot,config.sourceRoot].filter(Boolean))if(inside(root,target)||inside(target,root))throw new Error('下載位置必須在平台、既有前端與測試專案之外。');
 await noLinks(target);try{await lstat(target);throw new Error('下載位置已存在，請使用新的資料夾，既有內容不會覆寫。');}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!(await lstat(dirname(target))).isDirectory())throw new Error('下載位置的上層資料夾不存在。');
 const gitEnv={...process.env};for(const key of Object.keys(gitEnv))if(key.startsWith('GIT_'))delete gitEnv[key];
 const hooks=resolve(config.platformRoot,'.local/empty-git-hooks');await makeDirectory(hooks);await mkdir(target);
 try{await run('git',['-c','core.hooksPath='+hooks,'-c','init.templateDir='+hooks,'-c','protocol.file.allow=never','-c','protocol.ext.allow=never','-c','submodule.recurse=false','clone','--depth','1','--no-local','--',url,target],{shell:false,windowsHide:true,timeout:120000,maxBuffer:512*1024,env:{...gitEnv,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:resolve(hooks,'empty-config'),GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never',GIT_SSH_COMMAND:'ssh -oBatchMode=yes -oStrictHostKeyChecking=yes'}});await noLinks(target);return {path:target};}
 catch{throw new Error('Git 下載未完成。請確認 Git、網址及本機既有認證；殘留資料夾已保留，重試請選新位置。不會安裝或執行來源。');}
}
