import {z} from 'zod';
export const mobileTargetSchema=z.discriminatedUnion('platform',[
 z.object({schemaVersion:z.literal(1),platform:z.literal('android'),deviceId:z.string().regex(/^emulator-\d+$/),target:z.object({appPackage:z.string().regex(/^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/)}).strict()}).strict(),
 z.object({schemaVersion:z.literal(1),platform:z.literal('ios'),deviceId:z.string().min(1).max(100),target:z.object({bundleId:z.string().regex(/^[A-Za-z][\w-]*(\.[A-Za-z][\w-]*)+$/)}).strict()}).strict(),
]);
export type MobileTarget=z.infer<typeof mobileTargetSchema>;
export type EngineSession={owner:string;taskId:string;serial:string;bindings?:{sender:string;receiver:string}};
export interface MobileEngine {
 capabilities():{schemaVersion:1;platform:'android'|'ios';engine:string;deviceKinds:string[]};
 observe(session:EngineSession,options:Record<string,unknown>):Promise<any>;
 perform(session:EngineSession,action:unknown):Promise<any>;
 verify(session:EngineSession,source:string):Promise<any>;
 release(session:EngineSession):Promise<void>;
}
type AndroidRuntime={agentDevice:(serial:string,owner:string,id:string,action:any)=>Promise<any>;releaseAgent:(serial:string,owner:string,id:string)=>Promise<void>;verifyAgent:(serial:string,owner:string,id:string,source:string,bindings?:EngineSession['bindings'])=>Promise<any>};
// Keep ownership, acquisition-at-dispatch and runner handoff in the existing
// runtime. A second lock map here would allow two engines to claim one device.
export function androidAppiumEngine(runtime:AndroidRuntime):MobileEngine{
 return {
  capabilities:()=>({schemaVersion:1,platform:'android',engine:'appium',deviceKinds:['emulator']}),
  observe:(session,options)=>runtime.agentDevice(session.serial,session.owner,session.taskId,{...options,kind:'observe'}),
  perform:(session,action)=>runtime.agentDevice(session.serial,session.owner,session.taskId,action),
  verify:sessionVerify,
  release:async session=>{for(const serial of new Set([session.serial,...Object.values(session.bindings||{})]))if(serial)await runtime.releaseAgent(serial,session.owner,session.taskId);},
 };
 function sessionVerify(session:EngineSession,source:string){return runtime.verifyAgent(session.serial,session.owner,session.taskId,source,session.bindings);}
}
export function requireEngine(target:MobileTarget,engine:MobileEngine):void{
 const valid=mobileTargetSchema.parse(target),capabilities=engine.capabilities();
 if(capabilities.platform!==valid.platform)throw Object.assign(new Error('目前執行器不支援此平台；iOS 需先連接並驗證 Mac Worker。'),{statusCode:409});
}
