import Fastify from 'fastify';
import {randomUUID} from 'node:crypto';
import {registerAndroid} from '../services/control-api/src/android.ts';
import {createAndroidBridge} from '../services/android/bridge.mjs';
const app=Fastify({bodyLimit:3000000}),bridge=createAndroidBridge(),session=randomUUID();registerAndroid(app);
let controller;
try{
 const state=await bridge.status();const device=state.devices.find(d=>d.state==='device');
 if(!device)throw new Error('No connected emulator; no emulator was started or stopped by this check.');
 const heartbeat=()=>app.inject({method:'POST',url:'/internal/android/status',payload:{session,status:state}});
 await heartbeat();await app.listen({host:'127.0.0.1',port:0});const port=app.server.address().port;
 controller=new AbortController();const response=await fetch('http://127.0.0.1:'+port+'/api/android/devices/'+device.serial+'/stream',{signal:controller.signal});
 if(!response.ok)throw new Error('Stream HTTP '+response.status);
 const reader=response.body.getReader();let count=0,buffer='';const decoder=new TextDecoder();
 const timeout=setTimeout(()=>controller.abort(),45000);
 const receiving=(async()=>{while(count<3){const result=await reader.read();if(result.done)throw new Error('Stream ended early');buffer+=decoder.decode(result.value,{stream:true});let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){const event=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);if(event.startsWith('event: frame\n')){const data=JSON.parse(event.split('\ndata: ')[1]);const bytes=Buffer.from(data.png,'base64');if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('Invalid PNG');count++;console.log('FRAME',count,'bytes',bytes.length);}}}})();
 receiving.catch(()=>{}); timeout.unref(); const started=Date.now();
 for(let i=0;i<3;i++){await heartbeat();const png=await bridge.screen(device.serial);const result=await app.inject({method:'POST',url:'/internal/android/frame',payload:{session,serial:device.serial,png:png.toString('base64')}});if(result.statusCode!==200)throw new Error('Frame relay HTTP '+result.statusCode);}
 await receiving;clearTimeout(timeout);console.log('PASS real emulator -> local relay -> continuous HTTP stream:',count,'frames in',Date.now()-started,'ms; VM deployment not tested.');
}finally{controller?.abort();await app.close();bridge.close();}
