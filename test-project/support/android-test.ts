import { test as base, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createAndroidSession } from './android-client.mjs';
import type { AndroidSession } from './android-client.mjs';
import { reportOptions } from './report-options.mjs';
import { captureUi } from './ui-evidence.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export const test=base.extend<{android:AndroidSession}>({
 android:async({},use,testInfo)=>{
  const android=await createAndroidSession({serial:reportOptions(root).androidSerial,base:process.env.APPIUM_URL||'http://127.0.0.1:4723',appPackage:process.env.ANDROID_APP_PACKAGE||''});
  try{await use(android);if(testInfo.status!=='skipped'&&!testInfo.attachments.some(item=>item.name.startsWith('archify-screenshot:')))await captureUi(()=>android.screenshot(),testInfo);}finally{await android.close();}
 },
});
export {expect,captureUi};
