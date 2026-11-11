export interface AndroidElement { text():Promise<string>; click():Promise<void>; displayed():Promise<boolean>; attribute(name:string):Promise<string|null> }
export interface AndroidSession {serial:string; find(using:'id'|'accessibility id'|'xpath'|'-android uiautomator',value:string):Promise<AndroidElement>;source():Promise<string>;openNotifications():Promise<void>;activate(packageName?:string):Promise<void>;screenshot():Promise<Buffer>;close():Promise<void>}
export function createAndroidSession(options:{serial:string;appPackage?:string;base?:string}):Promise<AndroidSession>;
