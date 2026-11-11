import { readFile } from 'node:fs/promises';

export const appiumKnowledge = `Appium 操作知識（Archify 執行契約）：
使用前先確認最新觀察與輸入框焦點。一般已知 ID 可用 type 自行填入，不因鍵盤搜尋按鈕不在 XML 就要求人工輸入。
鍵盤搜尋用 {kind:"editorAction",editorAction:"search"}；送出、完成、下一欄分別為 send、done、next。這是 IME action，不是換行，也不等同實體 Enter。Flow 對應 {name:"搜尋",action:"editorAction",editorAction:"search"}。操作後用結果畫面斷言驗證。
更廣泛能力透過 {kind:"mobileCommand",command:"不帶 mobile: 前綴的名稱",params:{參數}}；Flow 對應 {name,action:"mobileCommand",command,params,variable?}。
標準或驅動 WebDriver endpoint 用 {kind:"webdriverCommand",method:"GET|POST|DELETE",path:"目前 session 內的相對路徑",params?:物件}；Flow 對應 {name,action:"webdriverCommand",method,path,params?,variable?}。不接受 URL、session ID、session 建立刪除或 execute 腳本路徑。工作階段生命週期由 Archify 管理。
先用 {kind:"appiumHelp",query:"指令名稱或參數關鍵字"} 查執行器實際安裝驅動的命令表，讀 required/optional 後再操作；query:"" 列出名稱索引。不憑記憶猜參數，不因舊對話說不支援就放棄。命令表表示已安裝驅動宣告能力，不是裝置實測成功。
常用：mobileCommand performEditorAction {action:"search"}；pressKey {keycode:66} 送實體 Enter（App 不一定當搜尋）；deepLink {url,package}；activateApp/terminateApp/queryAppState {appId}；backgroundApp {seconds}；isKeyboardShown {}；getCurrentPackage {}；getCurrentActivity {}；swipeGesture/scrollGesture {left,top,width,height,direction,percent}；pinchOpenGesture/pinchCloseGesture {left,top,width,height,percent}。座標與範圍必須來自實際畫面。
WebDriver 例：GET /orientation、POST /orientation {orientation:"LANDSCAPE"}、GET /contexts、GET /context、POST /context {name:"實際查得的context"}、POST /actions {actions:[W3C輸入序列]}、DELETE /actions、GET /appium/settings、POST /appium/settings {settings:{設定}}、GET /appium/commands（若伺服器支援可查目前工作階段命令）。
需要讀取結果時明確設 returnValue:true，結果只進本輪回饋，不存事件。Flow variable 保存純量或序列化 JSON 字串；resultPath:["欄位","子欄位"] 可取指定回傳值，例如 POST /element 的 resultPath:["element-6066-11e4-a52e-4f735466cecf"] 保存為 element，再用 path:"/element/{{element}}/click"。params 巢狀字串和 path 支援 {{變數}}；物件/陣列參數仍需保持官方型別。元素 ID 僅當次 session 有效，不能把探索 session 的 elementId 寫死進回歸腳本，請保留既有定位器動作。
mobileCommand/webdriverCommand 是受控傳送通道，不代表安裝所有 Appium 驅動、外掛或啟用 insecure features。Android 目前是 UiAutomator2；其他平台命令可能不支援。server 回 unknown command/unsupported operation 時說明實際限制，不宣稱已執行。不得自動安裝外掛、啟用 relaxed security、執行 shell 或讀取秘密。清資料、移除 App、改權限及發訊息必須在使用者要求範圍內。
每次只送一次，不自動重送有副作用的命令。指令成功不等於業務驗證通過，仍需實際結果斷言。大型二進位回傳不適合存 Flow 變數。當回傳太大或觀察失敗，先 observe 核對，不能重送。
官方參考：https://appium.github.io/appium-uiautomator2-driver/latest/reference/execute-methods/ 和 https://appium.io/docs/en/latest/reference/api/webdriver/ 。`;

// Read the installed driver's own inherited map rather than maintain a second
// static allowlist that goes stale when Appium is upgraded.
export async function installedAppiumHelp(query = '') {
  const root = new URL('../../.local/appium/node_modules/appium-uiautomator2-driver/', import.meta.url);
  try {
    const [mobile, endpoints, pkg] = await Promise.all([
      import(new URL('build/lib/execute-method-map.js', root).href),
      import(new URL('build/lib/method-map.js', root).href),
      readFile(new URL('package.json', root), 'utf8').then(JSON.parse),
    ]);
    const commands = Object.entries(mobile.executeMethodMap).map(([name, spec]) => ({
      kind: 'mobileCommand', command: name.replace(/^mobile:\s*/, ''),
      required: spec.params?.required || [], optional: spec.params?.optional || [],
    }));
    const routes = Object.entries(endpoints.newMethodMap).flatMap(([path, methods]) => Object.entries(methods).map(([method, spec]) => ({
      kind: 'webdriverCommand', method, path: path.replace(/^\/session\/:sessionId/, ''),
      required: spec.payloadParams?.required || [], optional: spec.payloadParams?.optional || [],
    })));
    const terms = query.toLowerCase().replace(/^mobile:\s*/, '').split(/\s+/).filter(Boolean);
    const matches = [...commands, ...routes].filter(item => terms.every(term => JSON.stringify(item).toLowerCase().includes(term)));
    return { driver: pkg.name, version: pkg.version, verifiedOnDevice: false,
      ...(terms.length ? { matches: matches.slice(0, 20), total: matches.length } : { commands: commands.map(item => item.command), endpointCount: routes.length }),
      instructions: '名稱與參數來自安裝版驅動；參數型別與語意仍以官方文件及實際結果為準。查無結果可查官方 WebDriver 路徑，不代表整個 Appium 不支援。' };
  } catch {
    return { available: false, message: '無法讀取已安裝 Appium 驅動命令表；請確認 android:appium:setup 已完成。不得假稱已查得支援。' };
  }
}
