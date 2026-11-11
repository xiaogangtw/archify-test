import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { androidFlowPrompt } from '../src/androidFlowAuthoring.ts';
import { parseFlow } from '../../android/flow-contract.mjs';
import {flowReferenceCatalog} from '../../../apps/web/src/features/testing/flowReferenceCatalog.ts';
test('Android authoring uses the actual Appium contract instead of Playwright analysis instructions', async()=>{
  const prompt=androidFlowPrompt([{role:'user',content:'開啟 LINE'}]);
  assert.match(prompt,/mobile: activateApp/);assert.match(prompt,/assertAppForeground/);assert.match(prompt,/jp\.naver\.line\.android/);
  assert.match(prompt,/不要求首頁定位器/);assert.match(prompt,/不得宣稱已儲存、執行、登入或通過/);
  assert.match(prompt,/scrollUntilVisible/);assert.match(prompt,/maxSwipes/);assert.match(prompt,/手指滑動方向/);
  assert.match(prompt,/滑動不等於驗證成功/);
  assert.match(prompt,/可以撰寫草稿，但不可宣稱現在能執行/);
  assert.match(androidFlowPrompt([],true),/執行器已回報支援條件流程/);
  const frontend=await readFile(new URL('../../../apps/web/src/features/testing/appiumFlow.ts',import.meta.url),'utf8');
  for(const source of [...frontend.matchAll(/= `(export const flow[\s\S]*?)`;/g)].map(match=>match[1])) assert.ok(parseFlow(source));
});

test('shared case context excludes source, conversations, execution data and unsaved/self references',()=>{
  const cases:any[]=[{id:'shared',name:'登入',version:2,caseType:'flow',source:'private source',messages:[{content:'private conversation'}],secret:'private secret',run:{token:'private token'}},{id:'draft',name:'草稿',version:0,caseType:'flow'},{id:'self',name:'自己',version:1,caseType:'flow'},{id:'api',name:'API',version:1,caseType:'test'}];
  assert.deepEqual(flowReferenceCatalog(cases,'self'),[{scriptId:'shared',scriptVersion:2,name:'登入'}]);
  assert.ok(!JSON.stringify(flowReferenceCatalog(cases,'self')).includes('private'));
  assert.equal(flowReferenceCatalog(Array.from({length:120},(_,i)=>({...cases[0],id:'shared-'+i})),'self').length,100);
});

test('deployment images include conditional-flow authoring and dependency files',async()=>{
  const apiImage=await readFile(new URL('../Dockerfile',import.meta.url),'utf8');
  const webImage=await readFile(new URL('../../../deploy/web/Dockerfile',import.meta.url),'utf8');
  assert.match(apiImage,/COPY services\/android\/flow-guide\.json/);
  assert.match(apiImage,/COPY services\/android\/flow-dependencies\.mjs/);
  assert.match(apiImage,/COPY services\/android\/appium-commands\.mjs services\/android\/appium-commands\.mjs/);
  assert.match(apiImage,/COPY services\/android\/appium-knowledge\.mjs services\/android\/appium-knowledge\.mjs/);
  assert.match(apiImage,/import\('\.\/services\/control-api\/src\/androidFlowAuthoring\.ts'\)/);
  assert.match(webImage,/COPY services\/android\/flow-guide\.json/);
});
