import {z} from 'zod';
import {editableRequestSchema,assertSavableRequest,assertNoSecrets,executeRequest} from './requestTransport.ts';
function responseValues(body:unknown,rules:{name:string;path:string}[]){
 const output:Record<string,string|number|boolean>=Object.create(null);
 for(const rule of rules){let value:any=body;for(const key of rule.path.split('.'))value=value&&typeof value==='object'&&Object.hasOwn(value,key)?value[key]:undefined;
  if(!['string','number','boolean'].includes(typeof value)||typeof value==='string'&&(!value||value.length>16000||/[\r\n]/.test(value))||typeof value==='number'&&!Number.isFinite(value))throw new Error('API 回應變數擷取失敗。');output[rule.name]=value;
 }return output;
}

export const apiStepSchema=z.object({name:z.string().min(1).max(200),action:z.literal('apiFlow'),scriptId:z.string().min(1).max(100),scriptVersion:z.number().int().positive(),namespace:z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/),authVariable:z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/).optional(),inputs:z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/),z.union([z.string().max(4000),z.number(),z.boolean()])).default({}),overrides:z.array(z.object({caseId:z.string(),request:editableRequestSchema}).strict()).max(30).default([]),pollTimeoutMs:z.number().int().min(0).max(20000).default(0)}).strict();
export const apiStepKey=(step:any)=>JSON.stringify([step.scriptId,step.scriptVersion,step.namespace,step.authVariable||'',step.inputs||{},step.overrides||[],step.pollTimeoutMs||0]);
export function createE2eApi(ctx:{pool:any;script:(id:string,version:number)=>Promise<any>;environment:(id:string,projectId:string)=>Promise<any>;schema?:(environmentId:string,projectId:string)=>Promise<any>;authSettings?:(id:string)=>Promise<any[]>;execute?:typeof executeRequest}){
 async function describe(id:string,version:number){
  const script=await ctx.script(id,version),flow=script?.apiFlow;
  if(!flow||script.version!==version||!flow.cases?.length||flow.cases.length>30)throw new Error('API 流程不存在或版本無效。');
  const cases=[];
  for(const ref of flow.cases){
   const saved=(await ctx.pool.query('SELECT body FROM api_case_versions WHERE case_id=$1 AND version=$2',[ref.id,ref.version])).rows[0]?.body;
   if(!saved||saved.projectId!==flow.projectId||saved.version!==ref.version||saved.pendingChecks?.length)throw new Error('API 流程引用的案例無效或仍有待補檢查。');
   cases.push({id:saved.id,version:saved.version,name:saved.name,request:editableRequestSchema.parse({...saved.request,environmentId:flow.environmentId})});
  }
  return {scriptId:id,scriptVersion:version,name:script.name,projectId:flow.projectId,cases};
 }
 async function prepare(definitions:any[]){
  const frozen:Record<string,any>=Object.create(null);
  async function visit(value:any):Promise<void>{
   if(!value||typeof value!=='object')return;
   if(value.action==='apiFlow'){
    const step=apiStepSchema.parse(value),key=apiStepKey(value);
    if(frozen[key])return;
    if(Object.values(frozen).some(item=>item.step.namespace===step.namespace))throw new Error('API 輸出前綴重複，請為不同步驟指定不同前綴。');
    if(Object.keys(frozen).length>=30)throw new Error('API 流程引用過多。');
    assertNoSecrets(step.inputs);
    const snapshot=await describe(step.scriptId,step.scriptVersion);
    if(step.overrides.some(item=>!snapshot.cases.some(saved=>saved.id===item.caseId))||new Set(step.overrides.map(item=>item.caseId)).size!==step.overrides.length)throw new Error('API 參數引用了無效或重複的案例。');
    for(const item of snapshot.cases){
     const override=step.overrides.find(value=>value.caseId===item.id);
     if(override){if(override.request.method!==item.request.method||override.request.endpoint!==item.request.endpoint||override.request.environmentId!==item.request.environmentId)throw new Error('API 方法、路徑與環境須在共用流程修改。');item.request=override.request;}
     assertSavableRequest(item.request);
     (item as any).environmentBaseUrl=(await ctx.environment(item.request.environmentId,snapshot.projectId)).baseUrl;
     (item as any).schema=await ctx.schema?.(item.request.environmentId,snapshot.projectId);
     let body:any;try{body=JSON.parse(item.request.body);}catch{}
     if(typeof body?.query==='string'&&!(item as any).schema?.data)throw new Error('API 流程的 GraphQL 請求需要此環境的 schema。');
    }
    if(step.pollTimeoutMs&&snapshot.cases.some(item=>!['GET','HEAD'].includes(item.request.method)))throw new Error('只有唯讀 API 流程可以輪詢，寫入請求不自動重送。');
    frozen[key]={...snapshot,step};return;
   }
   for(const child of Object.values(value))await visit(child);
  }
  await visit(definitions);
  return frozen;
 }
 function execution(frozen:Record<string,any>,initial:Record<string,unknown>={}){
  // API outputs never leave this per-run closure or enter environment secret storage.
  const values:Record<string,any>=Object.assign(Object.create(null),initial);
  const used=new Set<string>();let busy=false;
  return async(key:string,path:string,deviceInputs:Record<string,unknown>={})=>{
   if(busy||used.has(path)||!Object.hasOwn(frozen,key))throw new Error('API 步驟無效、重複或仍在執行。');
   busy=true;used.add(path);
   const snapshot=frozen[key],step=snapshot.step;
   for(const item of snapshot.cases)for(const rule of item.request.responseVariables||[])delete values[`${step.namespace}_${rule.name}`];
   const render=(text:string,bindings:Record<string,any>=values)=>text.replace(/\{\{([^{}]+)\}\}/g,(_match,name)=>{if(!Object.hasOwn(bindings,name.trim()))throw new Error('API 輸入變數尚未產生。');return String(bindings[name.trim()]);});
   try{
    const deadline=Date.now()+step.pollTimeoutMs;
    do{
     const outputs:Record<string,string|number|boolean>=Object.create(null);let passed=true;let failure='API 回應未符合預期。';
     for(const item of snapshot.cases){
      const environment=await ctx.environment(item.request.environmentId,snapshot.projectId);
      if(environment.baseUrl!==item.environmentBaseUrl)throw new Error('API 環境已變更，請重新建立執行。');
      const settings=(await ctx.authSettings?.(snapshot.projectId))?.find(value=>value.id===item.request.environmentId);
      const inputs=Object.fromEntries(Object.entries(step.inputs).map(([name,value])=>[name,Object.hasOwn(deviceInputs,name)&&typeof value==='string'&&/\{\{/.test(value)?deviceInputs[name]:typeof value==='string'?(/^\{\{([^{}]+)\}\}$/.test(value)&&Object.hasOwn(values,value.slice(2,-2).trim())?values[value.slice(2,-2).trim()]:render(value)):value]));
      const runtime={...environment,variables:{...environment.variables,...values,...outputs,...inputs},headers:{...environment.headers}};
      const localToken=outputs[settings?.tokenVariable||'authToken'];
      if(localToken)runtime.headers[settings?.tokenHeader||'Authorization']=(settings?.tokenPrefix??'Bearer ')+localToken;
      if(step.authVariable){const token=values[step.authVariable];if(typeof token!=='string'||!token||/[\r\n]/.test(token))throw new Error('API 授權變數尚未產生。');runtime.headers[settings?.tokenHeader||'Authorization']=(settings?.tokenPrefix??'Bearer ')+token;}
      const request=structuredClone(item.request);
      // References are rendered by the transport; assertion values need the same binding.
      const bind=(value:any):any=>typeof value==='string'?(/^\{\{([^{}]+)\}\}$/.test(value)&&Object.hasOwn(runtime.variables,value.slice(2,-2).trim())?runtime.variables[value.slice(2,-2).trim()]:render(value,runtime.variables)):Array.isArray(value)?value.map(bind):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,child])=>[key,bind(child)])):value;
      runtime.variables={...runtime.variables,...bind(request.variables)};
      request.variables={};
      request.assertions=request.assertions.map((assertion:any)=>({...assertion,...(assertion.value!==undefined?{value:bind(assertion.value)}:{})}));
      const response=await (ctx.execute||executeRequest)(runtime,request,item.schema,undefined,async body=>{Object.assign(outputs,responseValues(body,request.responseVariables||[]));return Object.values(outputs).map(String);});
      if(response.outcome!=='passed'){passed=false;failure=`API 案例 ${snapshot.cases.indexOf(item)+1}：HTTP ${response.status}，回應檢查未通過。`;break;}
     }
     if(passed){for(const [name,value] of Object.entries(outputs))values[`${step.namespace}_${name}`]=value;return {passed:true,message:'API 請求與設定的斷言通過。'};}
     if(Date.now()>=deadline)return {passed:false,message:failure};
     await new Promise(resolve=>setTimeout(resolve,500));
    }while(true);
   }finally{busy=false;}
  };
 }
 return {describe,prepare,execution};
}
