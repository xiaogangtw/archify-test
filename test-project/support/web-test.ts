import { test as base, expect as baseExpect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { captureUi } from './ui-evidence.mjs';
import { instrumentBrowser, instrumentExpect } from './operation-evidence.mjs';
export const test=base.extend<{}, { browser: Browser }>({
 browser:[async({browser},use)=>{await use(instrumentBrowser(browser,()=>base.info(),(title,body)=>base.step(title,body)));},{scope:'worker'}],
});
export const expect=instrumentExpect(baseExpect,()=>base.info(),(title,body)=>base.step(title,body));
export { setUiRole, setUiReady, uiStep, uiWaitForResponse } from './operation-evidence.mjs';
export { captureUi };
