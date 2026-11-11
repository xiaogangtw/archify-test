import { pngBuffer } from './report-options.mjs';
const elementKey='element-6066-11e4-a52e-4f735466cecf';
export async function createAndroidSession({serial,appPackage='',base='http://127.0.0.1:4723',request=fetch}={}){
 const url=new URL(base);if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw new Error('Appium 僅接受本機 HTTP 根網址。');
 if(!/^emulator-\d+$/.test(serial||''))throw new Error('請先選取 Android 模擬器或設定 ANDROID_UDID。');
 if(appPackage&&!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+$/.test(appPackage))throw new Error('ANDROID_APP_PACKAGE 格式不符。');
 async function call(path,body,method=body===undefined?'GET':'POST',timeout=30000){
  let response,value;try{response=await request(url.origin+path,{method,headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(timeout)});value=await response.json();}catch{throw new Error('本機 Appium 未完成連線，請核對服務與裝置。');}
  if(!response.ok||value.value?.error)throw new Error('Appium 指令未完成，請核對元素、裝置與 App 狀態；不輸出原始裝置內容。');return value.value;
 }
 const result=await call('/session',{capabilities:{alwaysMatch:{platformName:'Android','appium:automationName':'UiAutomator2','appium:udid':serial,'appium:noReset':true,'appium:fullReset':false,'appium:autoLaunch':false,'appium:dontStopAppOnReset':true,'appium:skipLogcatCapture':true,'appium:newCommandTimeout':90,...(appPackage?{'appium:appPackage':appPackage}:{})},firstMatch:[{}]}},'POST',90000);
 const id=result?.sessionId;if(typeof id!=='string'||!/^[A-Za-z0-9_-]+$/.test(id))throw new Error('Appium 未建立有效 session。');const prefix='/session/'+id;
 let closed=false;const send=(path,body,method)=>{if(closed)throw new Error('Appium session 已結束。');return call(prefix+path,body,method);};
 return {
  serial,
  async find(using,value){if(!['id','accessibility id','xpath','-android uiautomator'].includes(using)||typeof value!=='string'||!value.trim()||value.length>5000)throw new Error('Android 定位器格式不符。');const found=await send('/element',{using,value}),element=found?.[elementKey];if(typeof element!=='string')throw new Error('沒有找到有效元素。');const path='/element/'+encodeURIComponent(element);return {text:()=>send(path+'/text'),click:()=>send(path+'/click',{}),displayed:()=>send(path+'/displayed'),attribute:name=>{if(!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name))throw new Error('屬性名稱不合法。');return send(path+'/attribute/'+name);}};},
  source:()=>send('/source'),
  openNotifications:()=>send('/appium/device/open_notifications',{}),
  async activate(packageName=appPackage){if(!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+$/.test(packageName))throw new Error('請指定已安裝 App package。');await send('/appium/device/activate_app',{appId:packageName});},
  async screenshot(){const data=await send('/screenshot');if(typeof data!=='string'||data.length>2800000||!/^[A-Za-z0-9+/]*={0,2}$/.test(data))throw new Error('Android 截圖格式不符。');return pngBuffer(Buffer.from(data,'base64'));},
  async close(){if(!closed){await call(prefix,undefined,'DELETE');closed=true;}},
 };
}
