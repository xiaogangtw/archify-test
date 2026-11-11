import type { TestInfo } from '@playwright/test';
export function captureUi(screen:()=>Promise<Buffer>,testInfo:TestInfo,caption?:string):Promise<boolean>;
