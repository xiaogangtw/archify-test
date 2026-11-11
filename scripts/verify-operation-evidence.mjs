import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
export let preview;
const root = resolve('test-project');
await mkdir('.local', { recursive: true });
const temp = await mkdtemp(resolve('.local/operation-evidence-'));
try {
  await mkdir(join(temp, 'tests/ui'), { recursive: true });
  await mkdir(join(temp,'test-cases'),{recursive:true});
  await writeFile(join(temp,'test-cases/catalog.json'),JSON.stringify({schemaVersion:1,features:[],cases:[
    {id:'SYN-UI',script:'tests/ui/evidence.spec.ts',purpose:'驗證共用操作證據',preconditions:'使用合成頁面與兩個角色',expected:'每次操作與斷言保留實際圖文證據',steps:[]},
    {id:'SYN-OTHER',script:'tests/ui/evidence.spec.ts',purpose:'不得錯配',expected:'不得錯配',steps:[]},
  ]}));
  await writeFile(join(temp, 'archify.config.json'), JSON.stringify({ project: '逐操作合成驗證', reportDir: 'reports' }));
  await writeFile(join(temp, 'package.json'), '{"type":"module"}');
  await writeFile(join(temp, 'playwright.config.ts'), `import {defineConfig} from ${JSON.stringify(pathToFileURL(join(root, 'node_modules/@playwright/test/index.mjs')).href)};
export default defineConfig({testDir:'./tests',workers:1,retries:0,timeout:30000,reporter:[['list'],[${JSON.stringify(join(root, 'support/archify-reporter.mjs'))}]],use:{channel:'chrome',viewport:{width:390,height:844},actionTimeout:500,trace:'off',screenshot:'off',video:'off'}});`);
  await writeFile(join(temp, 'tests/ui/evidence.spec.ts'), `import {test,expect,setUiRole,setUiReady,uiStep,uiWaitForResponse} from ${JSON.stringify(join(root, 'support/web-test.ts').replaceAll('\\', '/'))};
test('逐操作、多角色、鏈式 Locator 與斷言',{annotation:[{type:'archify-case',description:'SYN-UI'}]},async({page,browser})=>{
 setUiRole(page,'角色A');
 await page.setContent('<label>名稱<input aria-label="名稱"></label><button onclick="this.textContent=&#39;已送出&#39;">送出</button>');
 await page.getByRole('textbox',{name:'名稱'}).fill('不寫入標題的輸入值');
 await expect(page.getByRole('textbox',{name:'名稱'}),'名稱已填寫').toHaveValue('不寫入標題的輸入值');
 await page.getByRole('button',{name:'送出'}).first().click();
 await expect(page.getByRole('button'),'顯示送出結果').toHaveText('已送出');
 const context=await browser.newContext();const other=await context.newPage();setUiRole(other,'角色B');
 await other.setContent('<p>另一個角色</p>');await expect(other.getByText('另一個角色')).toBeVisible();
 await context.close();
 for(let i=0;i<4;i++) await page.getByRole('textbox',{name:'名稱'}).fill('額外操作'+i);
 await page.getByRole('textbox',{name:'名稱'}).focus();await page.keyboard.press('End');await page.mouse.wheel(0,50);
 await uiStep(page,'純數值驗證也保留畫面',async()=>{expect(2).toBe(2);});
 await page.setContent('<iframe srcdoc="&lt;input aria-label=&quot;內嵌欄位&quot;&gt;"></iframe><a href="about:blank" target="_blank">彈出</a>');
 const frameInput=page.frameLocator('iframe').getByRole('textbox',{name:'內嵌欄位'});await frameInput.fill('框內文字');await expect.soft(frameInput,'內嵌欄位正確').toHaveValue('框內文字');
 const popupPromise=page.waitForEvent('popup');await page.getByRole('link',{name:'彈出'}).click();const popup=await popupPromise;setUiRole(popup,'彈出角色');await popup.setContent('<p>彈出內容</p>');await expect(popup.getByText('彈出內容')).toBeVisible();await popup.close();
 await page.setContent('<input type="password" value="secret"><input placeholder="驗證碼" value="123456">');
});
test('失敗操作仍留圖',async({page})=>{await page.setContent('<p>找不到按鈕</p>');await page.getByRole('button',{name:'不存在'}).click();});
test('證據失敗不可當通過',async({page})=>{await page.setContent('<p>頁面將關閉</p>');await page.close();try{await expect(page.getByText('頁面將關閉')).toBeVisible({timeout:100});}catch{}});
test('白畫面不得標記就緒',async({page})=>{setUiReady(page,null,120);await page.setContent('<html><body></body></html>');});
test('回應逾時要有原因與當下圖',async({page})=>{await page.setContent('<p>本頁沒有發出登入請求</p>');await test.step('前置：等待合成登入',()=>uiWaitForResponse(page,'SyntheticLogin',async()=>{},120));});
test('先監聽再觸發能收到指定回應',async({page})=>{
 await page.route('http://synthetic.local/**',route=>route.request().method()==='POST'?route.fulfill({json:{ok:true}}):route.fulfill({contentType:'text/html',body:'<button>合成頁面已就緒</button>'}));
 await page.goto('http://synthetic.local/');
 const response=await uiWaitForResponse(page,'SyntheticOperation',()=>page.evaluate(()=>fetch('/synthetic-endpoint',{method:'POST',body:JSON.stringify({operationName:'SyntheticOperation'})})));
 expect(response.status()).toBe(200);
});
test('延遲呈現需等到畫面就緒',async({page})=>{setUiReady(page,'#ready',1000);await page.setContent('<div id="waiting"></div><script>setTimeout(()=>{document.getElementById("waiting").innerHTML="<p id=ready>畫面已就緒</p>"},200)</script>');await expect(page.getByText('畫面已就緒')).toBeVisible();});
test.skip('略過不留圖',async({page})=>{await page.setContent('<p>不執行</p>');});`);
  const cli = join(root, 'node_modules/@playwright/test/cli.js');
  const run = spawnSync(process.execPath, [cli, 'test', '--config', join(temp, 'playwright.config.ts')], { encoding: 'utf8', env: { ...process.env, ARCHIFY_SCREENSHOTS: '1', ARCHIFY_REPORT_MODE: 'execution' } });
  console.log(run.stdout); console.log(run.stderr);
  assert.equal(run.status, 1, '合成案例含預期失敗');
  const directory=join(temp,'reports/ui');
  const files=(await readdir(directory)).filter(name=>name.endsWith('.json'));
  const reports=await Promise.all(files.map(async name=>JSON.parse(await readFile(join(directory,name),'utf8'))));
  const {build}=createRequire(resolve('apps/web/package.json'))('esbuild');
  const bundled=await build({entryPoints:['apps/web/src/features/reader/report.ts'],bundle:true,write:false,format:'esm',platform:'node'});
  const {parseReport}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  for(const report of reports)assert.doesNotThrow(()=>parseReport(JSON.stringify(report)));
  const {chromium}=createRequire(join(root,'package.json'))('@playwright/test');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:900}});
    await page.goto(pathToFileURL(join(directory,files[0].replace('.json','.html'))).href);
    assert.ok(await page.locator('.shot img').count());
    assert.ok(await page.locator('.shot img').evaluateAll(async images=>{
      await Promise.all(images.map(async image=>{image.loading='eager';await image.decode();}));
      return images.every(image=>image.complete&&image.naturalWidth>0);
    }));
    assert.equal(await page.getByRole('navigation',{name:'證據分卷'}).getByRole('link').count(),files.length);
    await page.locator('.shot').first().click();
    assert.equal(await page.locator('#zoom').evaluate(node=>node.open),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#zoom').evaluate(node=>node.open),false);
    await page.locator('.evidence').first().scrollIntoViewIfNeeded();
    preview=await page.screenshot({type:'png'});
  }finally{await browser.close();}
  const cases=reports.flatMap(report=>report.cases);
  const success=cases.find(row=>row.name.startsWith('逐操作'));
  const images=cases.filter(row=>row.name.startsWith('逐操作')).flatMap(row=>row.screenshots||[]);
  assert.equal(success?.status,'passed');
  assert.equal(success.expected,'每次操作與斷言保留實際圖文證據');
  assert.equal(success.preconditions,'使用合成頁面與兩個角色');
  assert.ok(images.length>=11, '每次操作及畫面斷言留圖');
  assert.ok(images.some(image=>image.caption.includes('角色B')));
  assert.ok(!images.some(image=>image.caption.includes('不寫入標題的輸入值')));
  assert.ok(images.some(image=>image.caption.includes('彈出角色')));
  const maskBrowser=await chromium.launch({channel:'chrome',headless:true});
  try{const page=await maskBrowser.newPage();const pixel=await page.evaluate(data=>new Promise(resolve=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);resolve(Array.from(ctx.getImageData(10,10,1,1).data));};image.src='data:image/png;base64,'+data;}),images.at(-1).data);assert.deepEqual(pixel,[255,0,255,255]);}finally{await maskBrowser.close();}
  assert.ok(cases.find(row=>row.name==='失敗操作仍留圖').screenshots.some(image=>image.caption.includes('失敗當下')));
  assert.ok(!cases.find(row=>row.name==='略過不留圖').screenshots?.length);
  assert.equal(cases.find(row=>row.name==='證據失敗不可當通過').status,'failed');
  const blank=cases.find(row=>row.name==='白畫面不得標記就緒');
  assert.equal(blank.status,'failed');assert.ok(blank.steps.some(step=>step.diagnostic?.code==='UI_NOT_READY'));
  assert.ok(blank.screenshots[0].caption.includes('失敗當下'));
  const responseTimeout=cases.find(row=>row.name==='回應逾時要有原因與當下圖');
  assert.ok(responseTimeout.steps.some(step=>step.diagnostic?.code==='RESPONSE_TIMEOUT'&&step.diagnostic.operation==='SyntheticLogin'));
  assert.equal(responseTimeout.steps.find(step=>step.name==='前置：等待合成登入').diagnostic.code,'RESPONSE_TIMEOUT');
  assert.ok(responseTimeout.screenshots.some(image=>image.diagnostic?.code==='RESPONSE_TIMEOUT'));
  assert.equal(cases.find(row=>row.name==='延遲呈現需等到畫面就緒').status,'passed');
  assert.equal(cases.find(row=>row.name==='先監聽再觸發能收到指定回應').status,'passed');
  const off=spawnSync(process.execPath,[cli,'test','--config',join(temp,'playwright.config.ts'),'--grep','逐操作'],{encoding:'utf8',env:{...process.env,ARCHIFY_SCREENSHOTS:'0',ARCHIFY_REPORT_MODE:'execution'}});
  assert.equal(off.status,0,off.stdout+off.stderr);
  const newFiles=(await readdir(directory)).filter(name=>name.endsWith('.json')&&!files.includes(name));
  assert.ok(newFiles.length);
  for(const name of newFiles){const report=JSON.parse(await readFile(join(directory,name),'utf8'));assert.ok(report.cases.every(row=>!row.screenshots?.length));}
  const evidenceFailure=spawnSync(process.execPath,[cli,'test','--config',join(temp,'playwright.config.ts'),'--grep','證據失敗'],{encoding:'utf8',env:{...process.env,ARCHIFY_SCREENSHOTS:'1',ARCHIFY_REPORT_MODE:'execution'}});
  assert.equal(evidenceFailure.status,1,'被腳本 catch 的截圖失敗也必須使整輪失敗');
  if(process.env.EVIDENCE_PREVIEW==='1')console.log('PREVIEW:'+preview.toString('base64'));
  console.log('PASS：逐操作、多角色、Locator／斷言、失敗及略過合成瀏覽器驗證');
} finally { await rm(temp,{recursive:true,force:true}); }
