import { execFile, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createServer } from 'node:net';
const execute=(file,args,timeout=5000)=>new Promise((resolve,reject)=>execFile(file,args,{windowsHide:true,shell:false,timeout,maxBuffer:1024*1024},(error,stdout)=>error?reject(new Error('Android 指令未完成，請檢查 SDK 與裝置。')):resolve(stdout)));
const exists=async path=>{try{await access(path);return true;}catch{return false;}};
const free=port=>new Promise(resolve=>{const server=createServer();server.once('error',()=>resolve(false));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));});
export function createAndroidHost(config,options={}){
 const run=options.execute||execute,launch=options.launch||spawn,has=options.exists||exists,request=options.fetch||fetch,portFree=options.portFree||free;
 const managed=new Map();let starting=false,appiumStarting=false;
 async function tools(){for(const root of [...new Set([config.androidSdk,process.env.ANDROID_HOME,process.env.ANDROID_SDK_ROOT,join(config.platformRoot,'.local/android-sdk'),join(homedir(),'AppData/Local/Android/Sdk'),join(homedir(),'Android/Sdk'),join(homedir(),'Library/Android/sdk')].filter(Boolean))]){const suffix=process.platform==='win32'?'.exe':'';const adb=join(root,'platform-tools/adb'+suffix),emulator=join(root,'emulator/emulator'+suffix);if(await has(adb)&&await has(emulator))return {root,adb,emulator};}return null;}
 async function appiumStatus(){try{const response=await request('http://127.0.0.1:4723/status',{signal:AbortSignal.timeout(1500)}),body=await response.json();return response.ok&&body.value?.ready===true;}catch{return false;}}
 async function status(){
  const sdk=await tools(),appium=await appiumStatus();if(!sdk)return {sdkReady:false,avds:[],devices:[],appiumReady:appium,issues:['找不到 Android SDK，請設定 ARCHIFY_ANDROID_SDK。']};
  const [names,text]=await Promise.all([run(sdk.emulator,['-list-avds']),run(sdk.adb,['devices','-l'])]);
  const avds=names.split(/\r?\n/).map(name=>name.trim()).filter(name=>/^[A-Za-z0-9_.-]+$/.test(name));
  const devices=await Promise.all(text.split(/\r?\n/).flatMap(line=>{const match=/^(emulator-\d+)\s+(device|offline|unauthorized)\b/.exec(line);return match?[{serial:match[1],state:match[2]}]:[];}).map(async device=>{let booted=false,avd='';if(device.state==='device'){try{booted=(await run(sdk.adb,['-s',device.serial,'shell','getprop','sys.boot_completed'])).trim()==='1';avd=(await run(sdk.adb,['-s',device.serial,'emu','avd','name'])).split(/\r?\n/)[0].trim();}catch{}}return {...device,avd,booted};}));
  for(const [avd,row] of managed)if(!devices.some(device=>device.serial===row.serial))devices.push({serial:row.serial,avd,state:row.error?'error':'starting',booted:false,error:row.error});
  return {sdkReady:true,avds,devices,appiumReady:appium,issues:avds.length?[]:['尚無 AVD，請先在 Android Studio 建立虛擬裝置。']};
 }
 async function start(avd){
  if(starting)throw new Error('另一個模擬器正在啟動。');starting=true;
  try{const info=await status(),sdk=await tools();if(!sdk||typeof avd!=='string'||!info.avds.includes(avd))throw new Error('請選取本機已存在的虛擬裝置。');if(info.devices.some(device=>device.avd===avd))throw new Error('此模擬器已在執行，請使用現有裝置。');if(info.devices.filter(device=>device.state!=='error').length>=4)throw new Error('最多同時 4 台模擬器。');
   if(!/accel:\s*0(?:\s|$)/.test(await run(sdk.emulator,['-accel-check'])))throw new Error('Android 硬體加速未就緒，請檢查系統設定。');
   let port;for(let candidate=5554;candidate<=5584;candidate+=2)if(!info.devices.some(device=>device.serial==='emulator-'+candidate)&&await portFree(candidate)&&await portFree(candidate+1)){port=candidate;break;}if(!port)throw new Error('沒有可用的模擬器連接埠。');
   const row={serial:'emulator-'+port,error:''};managed.set(avd,row);
   // Native visible emulator is explicitly requested; preserve the AVD's existing data.
   const child=launch(sdk.emulator,['-avd',avd,'-port',String(port),'-gpu','auto','-no-audio'],{windowsHide:true,shell:false,detached:true,stdio:'ignore',env:{...process.env,ANDROID_HOME:sdk.root,ANDROID_SDK_ROOT:sdk.root}});child.on('error',()=>{row.error='模擬器啟動失敗，請檢查 AVD 與硬體加速。';});child.on('exit',()=>{managed.delete(avd);});child.unref?.();return {serial:row.serial,starting:true};
  }finally{starting=false;}
 }
 async function startAppium(){
  if(appiumStarting)throw new Error('Appium 正在啟動。');if(await appiumStatus())return {ready:true};appiumStarting=true;
  try{const sdk=await tools();if(!sdk)throw new Error('Android SDK 未就緒。');if(!await portFree(4723))throw new Error('4723 被其他服務占用，不會停止既有程序。');
   const file=config.appiumCli||join(config.platformRoot,'.local/appium/node_modules/appium/index.js');if(!await has(file)||!file.endsWith('.js'))throw new Error('尚未安裝 Appium，請先執行 npm run android:appium:setup。');
   let failed=false;const child=launch(process.execPath,[file,'--address','127.0.0.1','--port','4723','--use-drivers','uiautomator2','--log-level','error'],{cwd:join(file,'../../..'),windowsHide:true,shell:false,stdio:'ignore',env:{...process.env,ANDROID_HOME:sdk.root,ANDROID_SDK_ROOT:sdk.root}});child.on('error',()=>{failed=true;});child.on('exit',()=>{failed=true;});
   const end=Date.now()+30000;while(!failed&&Date.now()<end){if(await appiumStatus()){child.unref?.();return {ready:true};}await new Promise(resolve=>setTimeout(resolve,500));}child.kill();throw new Error('Appium 未就緒，請檢查安裝、Java 與 UiAutomator2。');
  }finally{appiumStarting=false;}
 }
 return {status,start,startAppium};
}
