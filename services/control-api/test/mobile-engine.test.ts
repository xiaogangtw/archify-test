import test from 'node:test';
import assert from 'node:assert/strict';
import {androidAppiumEngine,mobileTargetSchema,requireEngine} from '../src/mobileEngine.ts';
import {checkMac} from '../../mobile/mac-check.mjs';
test('Android adapter keeps ownership and dual verification/release in the existing runtime; iOS fails closed',async()=>{
 const calls:any[]=[],engine=androidAppiumEngine({agentDevice:async(...args)=>{calls.push(args);return {xml:'<hierarchy/>'};},verifyAgent:async(...args)=>{calls.push(args);return {status:'passed'};},releaseAgent:async(...args)=>{calls.push(args);}});
 const session={owner:'alice',taskId:'task',serial:'emulator-5554',bindings:{sender:'emulator-5554',receiver:'emulator-5556'}};
 await engine.observe(session,{includeScreenshot:false});await engine.perform(session,{kind:'tap'});await engine.verify(session,'source');await engine.release(session);
 assert.deepEqual(calls[0],['emulator-5554','alice','task',{includeScreenshot:false,kind:'observe'}]);assert.deepEqual(calls[2],['emulator-5554','alice','task','source',session.bindings]);assert.equal(calls.length,5);
 assert.throws(()=>requireEngine({schemaVersion:1,platform:'ios',deviceId:'UDID',target:{bundleId:'com.example.app'}},engine),/不支援/);
 assert.equal(mobileTargetSchema.safeParse({schemaVersion:1,platform:'ios',deviceId:'UDID',target:{appPackage:'com.example.app'}}).success,false);
});
test('Mac preflight is read-only, rejects Windows and distinguishes available simulators from real execution',async()=>{
 let calls=0;const windows=await checkMac({platform:'win32',run:async()=>{calls++;return '';}});assert.equal(windows.ready,false);assert.equal(calls,0);
 const mac=await checkMac({platform:'darwin',run:async(command:string,args:string[])=>{calls++;if(command==='xcrun')return JSON.stringify({devices:{'com.apple.CoreSimulator.SimRuntime.iOS-18-0':[{isAvailable:true,udid:'sim',name:'iPhone Simulator',state:'Shutdown'}]}});if(args[0]==='driver')return JSON.stringify({xcuitest:{version:'installed'}});return 'version';}});
 assert.equal(mac.ready,true);assert.equal(mac.devices[0].kind,'simulator');assert.equal(mac.devices[0].state,'Shutdown');assert.equal(calls,4);
});
