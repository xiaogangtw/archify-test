import { defineConfig } from '@playwright/test';
import {fileURLToPath} from 'node:url';
import {loadProjectEnv,reportOptions} from './support/report-options.mjs';
const root=fileURLToPath(new URL('./',import.meta.url));loadProjectEnv(root);
const settings=reportOptions(root);process.env.ARCHIFY_SCREENSHOTS=settings.screenshots?'1':'0';
if(!process.env.ANDROID_UDID&&settings.androidSerial)process.env.ANDROID_UDID=settings.androidSerial;
// Pinned Playwright 1.64.1: omit automatic page snapshots from failure context.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', fullyParallel: false, workers: 1, retries: 0,
  timeout: 60000, outputDir: './reports/artifacts', preserveOutput: 'never',
  reporter: [['./support/archify-reporter.mjs']],
  globalSetup: './support/check-ui-evidence.mjs',
  use: { trace: 'off', screenshot: 'off', video: 'off' },
  projects:[
    {name:'api',testIgnore:['**/ui/**','**/web/**','**/mobile/**']},
    {name:'web',testMatch:['**/ui/**/*.spec.ts','**/web/**/*.spec.ts'],use:{browserName:'chromium',channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',actionTimeout:15000,navigationTimeout:30000,baseURL:process.env.WEB_BASE_URL||undefined}},
    {name:'android',timeout:180000,testMatch:'**/mobile/**/*.spec.ts'},
  ],
});
