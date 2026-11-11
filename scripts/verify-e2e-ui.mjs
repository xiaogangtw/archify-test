import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('..',import.meta.url)),require=createRequire(import.meta.url);
const {build}=createRequire(new URL('../apps/web/package.json',import.meta.url))('esbuild');
const {chromium}=require('playwright'),dir=join(root,'.local/e2e-ui');await mkdir(dir,{recursive:true});
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {E2EWorkspace} from '../../apps/web/src/features/testing/E2EWorkspace';createRoot(document.getElementById('root')).render(<main className="bg-canvas p-4 font-sans text-ink"><h1 className="mb-4 text-title font-bold">E2E 自動化測試</h1><E2EWorkspace projectId={new URLSearchParams(location.search).get('project')||'test'}/></main>);`;
const bundle=await build({stdin:{contents:entry,resolveDir:dir,loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',nodePaths:[join(root,'apps/web/node_modules')]});
const assets=join(root,'apps/web/dist/assets'),css=await readFile(join(assets,(await readdir(assets)).find(n=>n.endsWith('.css'))),'utf8');
await writeFile(join(dir,'index.html'),'<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>E2E verification</title><style>'+css+'</style><body><div id="root"></div><script>'+bundle.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></body></html>');
const editorHtml=(await readFile(join(dir,'index.html'),'utf8')).replace('</body>', `<script>const t=setInterval(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='使用名片交換範本');if(b){clearInterval(t);b.click();}},10);</script></body>`);await writeFile(join(dir,'editor.html'),editorHtml);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH});
try{const page=await browser.newPage({viewport:{width:1280,height:1000}});const url=pathToFileURL(join(dir,'index.html')).href;await page.goto(url);await page.evaluate(()=>localStorage.clear());await page.reload();
await page.getByRole('button',{name:'使用名片交換範本'}).click();assert.equal(await page.getByRole('button',{name:'開始執行'}).isDisabled(),true);
await page.getByRole('button',{name:'儲存流程'}).click();await page.getByRole('alert').waitFor();await page.getByLabel('Android 套件名稱').fill('com.archify.cards');
await page.getByRole('button',{name:'上移步驟 2',exact:true}).click();assert.match(await page.getByLabel('步驟 1 操作',{exact:true}).inputValue(),/B 帳號/);
await page.getByRole('button',{name:'儲存流程'}).click();await page.getByRole('status').waitFor();await page.reload();await page.getByRole('button',{name:'編輯 雙帳號名片交換'}).click();assert.equal(await page.getByLabel('Android 套件名稱').inputValue(),'com.archify.cards');
await page.getByRole('button',{name:'新增角色'}).click();await page.getByRole('button',{name:'移除角色 3',exact:true}).click();assert.equal(await page.getByRole('button',{name:'移除角色 1',exact:true}).isDisabled(),true);
await page.getByRole('button',{name:'新增步驟'}).click();await page.getByRole('button',{name:'移除步驟 6',exact:true}).click();
for(const width of [320,390,1280]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
await page.setViewportSize({width:1280,height:1000});await page.screenshot();
await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.tagName!=='BODY'),true);
await page.goto(url+'?project=other');await page.getByText('建立第一個端到端流程',{exact:true}).waitFor();
console.log('PASS template, validation, role protection, step ordering, persistence, project isolation, responsive overflow and keyboard focus. Screenshot captured in memory only.');
}finally{await browser.close();}


