import type {RequestDefinition,RequestUsage} from './apiContracts.ts';

type Values=Record<string,unknown>;
function object(value:unknown):value is Values{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function parse(value:string):Values{try{const result=JSON.parse(value);return object(result)?result:{};}catch{return {};}}
function safe(value:unknown,path:string):unknown{
 if(value==='秘密參照')return '{{'+path+'}}';
 if(Array.isArray(value))return value.map((item,index)=>safe(item,path+'.'+index));
 if(object(value))return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,safe(item,path?path+'.'+key:key)]));
 return value;
}
function common(values:unknown[],path:string):unknown{
 if(values.every(object)){const keys=[...new Set(values.flatMap(value=>Object.keys(value as Values)))];return Object.fromEntries(keys.map(key=>[key,common(values.map(value=>(value as Values)[key]),path?path+'.'+key:key)]));}
 if(values.every(value=>JSON.stringify(value)===JSON.stringify(values[0]))&&values[0]!==undefined)return safe(values[0],path);
 return '{{'+path+'}}';
}
export function sourceVariables(item:RequestDefinition,usage?:RequestUsage):Values{
 const base=parse(item.sourceRequest?.variables||item.variables||'{}');
 if(usage?.variables)return {...base,...safe(usage.variables,'') as Values};
 if(usage){const parameters=Object.fromEntries(Object.entries(usage.parameters).map(([key,value])=>{let parsed:unknown=value;if(!new RegExp('\\$'+key+':\\s*(String|ID)\\b').test(item.parameterTypes||''))try{parsed=JSON.parse(value);}catch{}return [key,safe(parsed,key)];}));return {...base,...parameters};}
 const candidates=(item.usages||[]).filter(value=>value.scope==='caller'&&value.variables).map(value=>value.variables!);
 if(!candidates.length)return safe(base,'') as Values;
 return {...base,...common(candidates,'') as Values};
}
