import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {lookup} from 'node:dns/promises';
import https from 'node:https';
import {isDeepStrictEqual} from 'node:util';
import {z} from 'zod';
import {parse,validate,getOperationAST,getVariableValues,buildClientSchema,getIntrospectionQuery,buildSchema,introspectionFromSchema} from 'graphql';
import {digest} from './requestCatalog.ts';
import type {EditableRequest,ApiResponse} from './apiContracts.ts';

const authSchema=z.object({id:z.string().min(1).max(100),name:z.string().min(1).max(100),headersFile:z.string().min(1),variablesFile:z.string().min(1).optional(),expiresAt:z.iso.date().optional()}).strict();
export const environmentSchema=z.object({id:z.string().min(1).max(100),name:z.string().min(1).max(100),baseUrl:z.url(),projectIds:z.array(z.string()).default([]),enabled:z.boolean().default(true),expiresAt:z.iso.date().optional(),variables:z.record(z.string(),z.string()).default({}),headers:z.record(z.string(),z.string()).default({}),authReferences:z.array(authSchema).default([])}).strict();
export type Environment=z.infer<typeof environmentSchema>;
export const editableRequestSchema=z.object({environmentId:z.string().min(1).max(100),authReference:z.string().max(100).default(''),method:z.enum(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS']),endpoint:z.string().max(4000),headers:z.record(z.string().max(100),z.string().max(16000)).default({}),queryParams:z.record(z.string(),z.json()).default({}),body:z.string().max(200000).default(''),variables:z.record(z.string(),z.json()).default({}),operationName:z.string().max(200).default(''),expectedGraphqlErrors:z.boolean().default(false),expectedStatus:z.number().int().min(100).max(599).default(200),responseVariables:z.array(z.object({name:z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).max(100),path:z.string().min(1).max(500)}).strict()).max(20).default([]),assertions:z.array(z.object({path:z.string().min(1).max(500),operator:z.enum(['exists','equals','contains']),value:z.json().optional()}).strict().refine(value=>value.operator==='exists'||value.value!==undefined,'Assertion requires value')).max(50).default([])}).strict();
const sensitive=/authorization|cookie|token|secret|password|api[-_]?key/i;
const invalid=(message:string)=>Object.assign(new Error(message),{statusCode:400});
const expired=(date?:string)=>!!date&&Date.parse(date+'T23:59:59Z')<Date.now();
export async function requestEnvironments(){
 const path=process.env.ARCHIFY_REQUEST_CONFIG||new URL('../../../config/api-environments.json',import.meta.url);
 const value=z.object({environments:z.array(environmentSchema).max(50)}).strict().parse(JSON.parse(await readFile(path,'utf8')));
 if(new Set(value.environments.map(item=>item.id)).size!==value.environments.length)throw new Error('測試環境 ID 重複。');
 return value.environments;
}
export function allowedEnvironment(environments:Environment[],id:string,projectId:string){
 const value=environments.find(item=>item.id===id);if(!value||!value.enabled||expired(value.expiresAt)||(value.projectIds.length&&!value.projectIds.includes(projectId)))throw invalid('此專案無可用的測試環境，請檢查伺服器設定與到期日。');
 return value;
}
export function validateTarget(value:string,environment:Environment){
 const base=new URL(environment.baseUrl);const url=new URL(value);
 if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw invalid('測試環境需使用不含帳密的 HTTPS baseUrl。');
 const prefix=base.pathname.replace(/\/$/,'');
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.origin!==base.origin||(url.pathname!==prefix&&!url.pathname.startsWith(prefix+'/')))throw invalid('請求超出此測試環境允許的主機或路徑。');
 return url;
}
export function publicAddress(address:string){
 if(address.includes(':'))return /^[23][0-9a-f]{3}:/i.test(address)&&!/^2001:db8:/i.test(address);
 const parts=address.split('.').map(Number);if(parts.length!==4||parts.some(part=>!Number.isInteger(part)||part<0||part>255))return false;
 const [a,b,c]=parts;return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===88&&c===99)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}
export type Transport=(url:URL,method:string,headers:Record<string,string>,body:string)=>Promise<{status:number;contentType:string;body:string}>;
export const transport:Transport=async(url,method,headers,body)=>{
 let dnsTimer:ReturnType<typeof setTimeout>|undefined;
 const addresses=await Promise.race([lookup(url.hostname.replace(/^\[|\]$/g,''),{all:true,verbatim:true}),new Promise<never>((_done,reject)=>{dnsTimer=setTimeout(()=>reject(new Error('API DNS 查詢超過 10 秒。')),10000);})]).finally(()=>clearTimeout(dnsTimer));
 if(!addresses.length||addresses.some(item=>!publicAddress(item.address)))throw new Error('測試環境解析至非公開或保留位址，已停止請求。');
 const address=addresses[0];
 return new Promise((done,reject)=>{
  const request=https.request(url,{method,headers:{...headers,...(body?{'Content-Length':String(Buffer.byteLength(body))}:{})},lookup:(_hostname,options,callback)=>{if(options.all)(callback as (error:null,results:typeof addresses)=>void)(null,[address]);else callback(null,address.address,address.family);}},response=>{
   if((response.statusCode||0)>=300&&(response.statusCode||0)<400){response.destroy();reject(new Error('測試請求不跟隨重新導向，請核對允許的端點。'));return;}
   const chunks:Buffer[]=[];let bytes=0;
   response.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>2000000){response.destroy(new Error('回應超過 2 MB 上限。'));return;}chunks.push(chunk);});
   response.on('error',reject);response.on('end',()=>done({status:response.statusCode||0,contentType:String(response.headers['content-type']||''),body:Buffer.concat(chunks).toString('utf8')}));
  });
  request.setTimeout(30000,()=>request.destroy(new Error('API 請求超過 30 秒。')));
  const total=setTimeout(()=>request.destroy(new Error('API 請求超過 30 秒。')),30000);
  request.on('close',()=>clearTimeout(total));request.on('error',reject);request.end(body||undefined);
 });
};
export function redact(value:unknown,secrets:string[]=[]):any {
 if(typeof value==='string'){let result=value;for(const secret of secrets.filter(item=>item.length>=4))result=result.split(secret).join('[REDACTED]');return result;}
 if(Array.isArray(value))return value.map(item=>redact(item,secrets));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,sensitive.test(key)?'[REDACTED]':redact(item,secrets)]));
 return value;
}
export function assertNoSecrets(value:unknown){
 if(Array.isArray(value)){value.forEach(assertNoSecrets);return;}
 if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){if(/^(authorization|cookie|satoken|token|auth[-_]?token|(?:[A-Za-z_]+_)?password|clientSecret|api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token)$/i.test(key)){if(typeof item!=='string'||!/^\{\{[A-Za-z_][A-Za-z0-9_]*\}\}$/.test(item))throw invalid('認證資料請使用秘密參照，不放在請求編輯器或保存內容中。');}assertNoSecrets(item);}
}
export function assertSafeHeaders(headers:Record<string,string>){if(Object.keys(headers).some(key=>sensitive.test(key)))throw invalid('認證 Header 請使用秘密參照，不放在請求編輯器或保存內容中。');}
export function assertSavableRequest(input:EditableRequest){
 assertSafeHeaders(input.headers);assertNoSecrets(input.variables);
 if(Object.keys(input.queryParams).some(key=>sensitive.test(key))||/[?&](?:[^=&]*(?:token|password|secret|api[_-]?key|authorization|cookie)[^=&]*)=/i.test(input.endpoint)||/^https?:\/\/[^/]*@/i.test(input.endpoint))throw invalid('網址不得夾帶認證資料，請使用秘密參照。');
 if(input.body){try{assertNoSecrets(JSON.parse(input.body));}catch(error){if(!(error instanceof SyntaxError))throw error;}}
}
async function headersFor(environment:Environment,reference:string){
 const headers={...environment.headers};
 if(reference){
  const auth=environment.authReferences.find(item=>item.id===reference);if(!auth||expired(auth.expiresAt))throw new Error('認證參照不存在或已到期。');
  const root=resolve(process.env.ARCHIFY_REQUEST_SECRETS_ROOT||'/run/integration-secrets');const path=resolve(root,auth.headersFile);
  if(!path.startsWith(root+sep))throw new Error('認證參照超出秘密目錄。');
  const secretHeaders=z.record(z.string().regex(/^[A-Za-z0-9-]+$/),z.string().max(16000).refine(value=>!/[\r\n]/.test(value))).parse(JSON.parse(await readFile(path,'utf8')));Object.assign(headers,secretHeaders);
 }
 return headers;
}
async function secretVariablesFor(environment:Environment,reference:string){
 if(!reference)return {};const auth=environment.authReferences.find(item=>item.id===reference);if(!auth||expired(auth.expiresAt))throw invalid('認證參照不存在或已到期。');if(!auth.variablesFile)return {};
 const root=resolve(process.env.ARCHIFY_REQUEST_SECRETS_ROOT||'/run/integration-secrets');const path=resolve(root,auth.variablesFile);if(!path.startsWith(root+sep))throw invalid('認證參照超出秘密目錄。');
 return z.record(z.string(),z.string().max(16000)).parse(JSON.parse(await readFile(path,'utf8')));
}
export async function loadSchema(environment:Environment,reference:string,send:Transport=transport){
 const headers=await headersFor(environment,reference);const response=await send(validateTarget(environment.baseUrl,environment),'POST',{'Content-Type':'application/json',...headers},JSON.stringify({query:getIntrospectionQuery(),operationName:'IntrospectionQuery',variables:{}}));
 if(response.status!==200)throw new Error(`Schema 讀取失敗：HTTP ${response.status}`);
 let result;try{result=JSON.parse(response.body);}catch{throw new Error('Schema 端點未回傳 JSON。');}
 if(result.errors?.length||!result.data?.__schema)throw new Error('Schema 無法讀取；請檢查認證或匯入 SDL／introspection JSON。');
 buildClientSchema(result.data);return {data:result.data,hash:digest(result.data),typeCount:result.data.__schema.types.length,checkedAt:new Date().toISOString()};
}
export function importSchema(source:string){
 let data;try{const parsed=JSON.parse(source);data=parsed.data?.__schema?parsed.data:parsed.__schema?parsed:undefined;}catch{data=introspectionFromSchema(buildSchema(source));}
 if(!data)throw new Error('請提供 GraphQL SDL 或 introspection JSON。');buildClientSchema(data);return {data,hash:digest(data),typeCount:data.__schema.types.length,checkedAt:new Date().toISOString()};
}
export async function executeRequest(environment:Environment,input:EditableRequest,schema:any,send:Transport=transport,onResponse?:(body:unknown)=>Promise<string[]>):Promise<Omit<ApiResponse,'id'>>{
 assertSavableRequest(input);
 const credentialVariables=await secretVariablesFor(environment,input.authReference);
 const privateValues=[...Object.values(environment.variables),...Object.values(credentialVariables)];
 const values={...environment.variables,BASE_URL:environment.baseUrl,...input.variables,...credentialVariables};
 const render=(source:string)=>source.replace(/\{\{([^{}]+)\}\}/g,(_match,name)=>{if(!Object.hasOwn(values,name.trim()))throw new Error(`請提供變數 ${name.trim()}`);const value=values[name.trim() as keyof typeof values];return typeof value==='object'?JSON.stringify(value):String(value);});
 let endpoint=render(input.endpoint||environment.baseUrl);if(!/^https?:\/\//i.test(endpoint))endpoint=environment.baseUrl.replace(/\/$/,'')+'/'+endpoint.replace(/^\//,'');
 const url=validateTarget(endpoint,environment);for(const [key,value] of Object.entries(input.queryParams))url.searchParams.set(key,render(typeof value==='string'?value:JSON.stringify(value)));
 for(const [key,value] of url.searchParams)if(sensitive.test(key))throw new Error('網址不得夾帶認證資料，請使用秘密參照。');
 const renderJson=(value:any):any=>{
  if(typeof value==='string'){const match=/^\{\{([^{}]+)\}\}$/.exec(value);if(match){if(!Object.hasOwn(values,match[1].trim()))throw new Error(`請提供變數 ${match[1].trim()}`);return values[match[1].trim() as keyof typeof values];}return render(value);}
  if(Array.isArray(value))return value.map(renderJson);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,renderJson(item)]));return value;
 };
 let body='';if(input.body){let parsed:any;try{parsed=JSON.parse(input.body);}catch{}body=parsed===undefined?render(input.body):JSON.stringify(renderJson(parsed));}
 const checks:{name:string;passed:boolean}[]=[];let graphql=false;
 if(body){let value:any;try{value=JSON.parse(body);}catch{if(/json/i.test(input.headers['Content-Type']||input.headers['content-type']||''))throw new Error('請求內容不是有效的 JSON。');}
  if(value){if(typeof value.query==='string'){
   graphql=true;const document=parse(value.query);const operation=getOperationAST(document,input.operationName||value.operationName);if(!operation)throw new Error('GraphQL 操作名稱不存在，或多個操作尚未指定名稱。');
   if(operation.operation==='subscription')throw new Error('GraphQL subscription 尚未接上串流傳輸，已停止 HTTP 發送。');
   if(value.variables&&(!value.variables||typeof value.variables!=='object'||Array.isArray(value.variables)))throw new Error('GraphQL variables 必須是物件。');
   const environmentVariables:Record<string,unknown>={};for(const definition of operation.variableDefinitions||[]){const name=definition.variable.name.value;if(Object.hasOwn(values,name)){let entry:unknown=values[name as keyof typeof values];let type=definition.type;while(type.kind!=='NamedType')type=type.type;if(typeof entry==='string'&&!['String','ID'].includes(type.name.value))try{entry=JSON.parse(entry);}catch{}environmentVariables[name]=entry;}}
   value.variables={...environmentVariables,...(value.variables||{}),...input.variables};value.operationName=input.operationName||value.operationName;
   if(!schema?.data)throw new Error('請先載入或匯入此環境的 GraphQL schema。');
   const model=buildClientSchema(schema.data);const errors=validate(model,document);if(errors.length)throw new Error('GraphQL schema 驗證失敗：'+errors.map(item=>item.message).join('；'));
   const coerced=getVariableValues(model,operation.variableDefinitions||[],value.variables);if(coerced.errors?.length&&!input.expectedGraphqlErrors)throw new Error('GraphQL 變數驗證失敗：'+redact(coerced.errors.map(item=>item.message).join('；'),privateValues));
   checks.push({name:coerced.errors?.length?'GraphQL schema 有效；變數錯誤交由反向斷言驗證':'GraphQL schema 與變數有效',passed:true});body=JSON.stringify(value);
  }}
 }
 if(['GET','HEAD'].includes(input.method)&&body)throw new Error('GET／HEAD 請求不能包含 body，請使用查詢參數。');
 const privateHeaders=await headersFor(environment,input.authReference);const userHeaders=Object.fromEntries(Object.entries(input.headers).map(([key,value])=>[key,render(value)]));
 for(const [key,value] of Object.entries(userHeaders))if(!/^[A-Za-z0-9-]+$/.test(key)||/[\r\n]/.test(value)||/^(host|content-length|connection|transfer-encoding|proxy-)/i.test(key))throw new Error('Headers 含不允許的名稱或字元。');
 if(input.expectedGraphqlErrors&&(!graphql||!input.assertions.some(rule=>/^errors\.\d+\./.test(rule.path)&&rule.operator!=='exists')))throw new Error('GraphQL 預期錯誤必須是 GraphQL 請求，並明確檢查 errors 的訊息或代碼。');
 const started=Date.now();const response=await send(url,input.method,{...(graphql?{'Content-Type':'application/json'}:{}),...userHeaders,...privateHeaders},body);const durationMs=Date.now()-started;
 checks.push({name:`HTTP ${input.expectedStatus}`,passed:response.status===input.expectedStatus});
 let responseBody:unknown=response.body;try{responseBody=JSON.parse(response.body);}catch{}
 if(input.expectedGraphqlErrors&&!graphql)throw new Error('GraphQL 預期錯誤只適用 GraphQL 請求。');
 if(graphql){const errors=(responseBody as any)?.errors;const hasErrors=Array.isArray(errors)&&errors.length>0;
  if(input.expectedGraphqlErrors){if(!input.assertions.some(rule=>/^errors\.\d+\./.test(rule.path)&&rule.operator!=='exists'))throw new Error('GraphQL 反向案例必須明確檢查 errors 的錯誤訊息或代碼。');checks.push({name:'GraphQL 回傳預期錯誤（另核對錯誤斷言）',passed:hasErrors});}
  else checks.push({name:'GraphQL 回傳 data 且沒有 errors',passed:!!responseBody&&typeof responseBody==='object'&&'data' in responseBody&&!hasErrors});
 }
 for(const assertion of input.assertions||[]){
  let actual:any=responseBody;for(const key of assertion.path.split('.'))actual=actual&&typeof actual==='object'&&Object.hasOwn(actual,key)?actual[key]:undefined;
  const passed=assertion.operator==='exists'?actual!==undefined:assertion.operator==='equals'?isDeepStrictEqual(actual,assertion.value):typeof actual==='string'&&typeof assertion.value==='string'?actual.includes(assertion.value):Array.isArray(actual)&&actual.some(item=>isDeepStrictEqual(item,assertion.value));
  checks.push({name:`回應 ${assertion.path} ${assertion.operator}`,passed});
 }
 const extracted=checks.every(check=>check.passed)&&onResponse?await onResponse(responseBody):[];
 const responseSecrets=(input.responseVariables||[]).flatMap(rule=>{let value:any=responseBody;for(const part of rule.path.split('.'))value=value&&typeof value==='object'&&Object.hasOwn(value,part)?value[part]:undefined;return typeof value==='string'?[value]:[];});
 const sanitized=redact(responseBody,[...Object.values(privateHeaders),...privateValues,...extracted,...responseSecrets]);
 return {status:response.status,durationMs,body:typeof sanitized==='string'?sanitized:JSON.stringify(sanitized,null,2),contentType:response.contentType,outcome:checks.every(check=>check.passed)?'passed':'failed',checks,schemaHash:graphql?schema?.hash:undefined,request:{method:input.method,url:url.href,bodyHash:digest(body),authReference:input.authReference},message:input.assertions?.length?'已評估本次設定的協定與回應斷言。':'僅評估列出的協定檢查，業務斷言尚未設定。'};
}



