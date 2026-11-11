import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
const execute=promisify(execFile);
export async function checkMac({platform=process.platform,run=async(command,args)=>(await execute(command,args,{timeout:20000,maxBuffer:2000000,windowsHide:true})).stdout}={}){
 if(platform!=='darwin')return {platform,ready:false,checks:[{name:'macOS',ready:false,message:'此檢查需在 Mac 執行；Windows 不提供 iOS Simulator。'}],devices:[]};
 const checks=[],devices=[];
 async function probe(name,command,args,parse){try{const output=await run(command,args);parse?.(output);checks.push({name,ready:true});}catch{checks.push({name,ready:false,message:'未能確認，請安裝或設定後重跑。'});}}
 await probe('Xcode','xcodebuild',['-version']);
 await probe('iOS Simulator','xcrun',['simctl','list','devices','available','--json'],output=>{
  const result=JSON.parse(output);for(const [runtime,list]of Object.entries(result.devices||{}))if(runtime.includes('.iOS-'))for(const device of list)if(device.isAvailable)devices.push({platform:'ios',kind:'simulator',deviceId:device.udid,name:device.name,state:device.state,runtime});
 });
 await probe('Appium','appium',['--version']);
 await probe('XCUITest driver','appium',['driver','list','--installed','--json'],output=>{const value=JSON.parse(output);if(!value.xcuitest)throw new Error('missing');});
 return {platform:'darwin',ready:checks.every(check=>check.ready)&&devices.length>0,checks,devices,limits:['只檢查工具及可用模擬器清單；未啟動裝置、安裝 App、連接控制台或執行測試。','自有 App 需 Simulator build；正式 LINE／真機推播與跨 App 驗收需另備 iPhone。']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const report=await checkMac();console.log(JSON.stringify(report,null,2));process.exitCode=report.ready?0:1;}
