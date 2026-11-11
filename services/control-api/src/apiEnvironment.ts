import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {validateTarget,allowedEnvironment,type Environment} from './requestTransport.ts';
export const environmentEditSchema=z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(100),baseEnvironmentId:z.string().min(1).max(100),baseUrl:z.url(),variables:z.record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),z.string().max(4000)).default({}),headerVariables:z.array(z.string().regex(/^[A-Za-z0-9-]+$/).refine(value=>!/^(host|content-length|connection|transfer-encoding|proxy-|sec-)/i.test(value))).max(50).default([]),tokenVariable:z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).default('authToken'),tokenHeader:z.string().regex(/^[A-Za-z0-9-]+$/).refine(value=>!/^(host|content-length|connection|transfer-encoding|proxy-|sec-)/i.test(value)).default('Authorization'),tokenPrefix:z.string().max(100).refine(value=>!/[\r\n]/.test(value)).default('Bearer ')}).strict();
export function managedEnvironment(base:Environment[],settings:unknown,projectId:string):Environment{
 const value=environmentEditSchema.parse(settings);const parent=allowedEnvironment(base,value.baseEnvironmentId,projectId);validateTarget(value.baseUrl,parent);
 if(Object.keys(value.variables).some(key=>/password|secret|token|authorization|cookie|api.?key/i.test(key)))throw Object.assign(new Error('秘密變量請由登入回應擷取或伺服器認證參照提供。'),{statusCode:400});
 const variables={...parent.variables,...value.variables};const headers=Object.fromEntries(value.headerVariables.filter(name=>Object.hasOwn(variables,name)).map(name=>[name,variables[name]]));
 if(Object.values(headers).some(value=>/[\r\n]/.test(value)))throw Object.assign(new Error('Header 環境變量不得包含換行。'),{statusCode:400});
 return {...parent,id:value.id,name:value.name,baseUrl:value.baseUrl,variables,headers:{...parent.headers,...headers}};
}
async function key(){const file=process.env.WORKER_TOKEN_FILE;if(!file)throw new Error('Server secret key is unavailable');return createHash('sha256').update('archify-api-environment-v1').update(await readFile(file)).digest();}
export async function sealVariables(value:Record<string,string>,scope:string){
 const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',await key(),iv);cipher.setAAD(Buffer.from(scope));const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');
}
export async function openVariables(value:string,scope:string):Promise<Record<string,string>>{
 const data=Buffer.from(value,'base64');const decipher=createDecipheriv('aes-256-gcm',await key(),data.subarray(0,12));decipher.setAAD(Buffer.from(scope));decipher.setAuthTag(data.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8'));
}
export function readResponseVariables(body:unknown,rules:{name:string;path:string}[]){
 const values:Record<string,string>={};for(const rule of rules){let value:any=body;for(const part of rule.path.split('.'))value=value&&typeof value==='object'&&Object.hasOwn(value,part)?value[part]:undefined;if(typeof value!=='string'||!value||value.length>16000||/[\r\n]/.test(value))throw new Error('回應變量 '+rule.name+' 擷取失敗，原有值已清除。');values[rule.name]=value;}return values;
}
