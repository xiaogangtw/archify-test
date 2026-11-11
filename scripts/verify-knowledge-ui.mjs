import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile, lstat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { fixture } from '../services/local-workspace/test-support.mjs';
import { createHandler } from '../services/local-workspace/plugin.mjs';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('../.local/gate-deps/node_modules/playwright')); }
assert.equal(process.env.DS_REQUIRE_BROWSER, '1');
const f = await fixture();
const { createWorkspace } = await import('../services/local-workspace/workspace.mjs');
let sourcePickCalls = 0;
const workspace = createWorkspace(f.config, { aiRunner: async (_config, prompt) => { const data=JSON.parse(prompt.slice(prompt.indexOf('{"existing":'))); return {documents:data.incoming.map(doc=>({title:doc.name,content:doc.content,category:'business',featureIds:[],keepId:null,replaces:[],inputIndices:[doc.index]})),conflicts:[]}; }, gitRunner: async (_file,args,options)=>{assert.equal(options.shell,false);await writeFile(join(args.at(-1),'api.ts'),'// synthetic clone only');}, pickDirectory: async kind => { if (kind === 'source') { sourcePickCalls++; return sourcePickCalls === 1 ? { path: '', cancelled: true } : { path: f.source, cancelled: false }; } return { path: f.project, cancelled: false }; } });
const handler = createHandler(workspace, 'ui-session');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const assets = await readdir('apps/web/dist/assets');
const css = await readFile('apps/web/dist/assets/' + assets.find(name => name.endsWith('.css')), 'utf8');
const js = await readFile('apps/web/dist/assets/' + assets.find(name => name.endsWith('.js')), 'utf8');
const html = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Archify 本機分析驗證</title><style>'+css+'</style><body><div id="root"></div><script>'+js.replaceAll('</script', '<\\/script')+'</script></body></html>';
const errors = [];
page.on('pageerror', error => errors.push(error.message));
// Route only the transport: run the actual middleware, scanner and file service against temporary folders.
await page.route('http://127.0.0.1:5189/**', async route => {
  const request = route.request(), url = new URL(request.url());
  if (!url.pathname.startsWith('/local-api/')) return route.fulfill({ status: 200, contentType: 'text/html', body: html });
  const req = Readable.from(request.postData() ? [request.postData()] : []);
  req.url = url.pathname; req.method = request.method(); req.socket = { remoteAddress: '127.0.0.1' };
  req.headers = { ...request.headers(), host: url.host };
  let status = 200, contents;
  const res = { set statusCode(value) { status = value; }, setHeader() {}, end(value) { contents = value; } };
  await handler(req, res);
  await route.fulfill({ status, contentType: 'application/json', body: contents });
});
try {
  await page.goto('http://127.0.0.1:5189/?view=reports');
  const dialog = page.locator('main');
  await dialog.getByRole('heading', { name: '前端架構分析' }).waitFor();
  if(process.env.ARCHIFY_REVIEW_STEP==='1')console.log('REVIEW_IMAGE:'+(await page.screenshot({type:'jpeg',quality:50})).toString('base64'));
  await dialog.getByRole('button',{name:'Git 下載 從儲存庫下載',exact:true}).click();await dialog.getByLabel('Git 網址',{exact:true}).fill('https://example.test/frontend.git');await dialog.getByLabel('下載資料夾',{exact:true}).fill(join(f.root,'cloned-source'));await dialog.getByRole('button',{name:'下載並繼續',exact:true}).click();await dialog.getByRole('heading',{name:'測試專案放置位置',exact:true}).waitFor();await page.reload();await dialog.getByRole('heading',{name:'前端架構分析',exact:true}).waitFor();
  assert.equal(await page.getByRole('navigation',{name:'主要功能'}).count(),0);await page.keyboard.press('Escape');
  await dialog.getByRole('button',{name:'Git 下載 從儲存庫下載',exact:true}).click();
  assert.equal(sourcePickCalls, 0);
  await dialog.getByRole('button',{name:'本機資料夾 讀取電腦中的程式碼',exact:true}).click();
  assert.equal(sourcePickCalls, 1);
  assert.equal(await dialog.getByLabel('前端專案路徑').inputValue(), f.source);
  await dialog.getByLabel('前端專案路徑').fill('');
  await dialog.getByRole('button',{name:'本機資料夾 讀取電腦中的程式碼',exact:true}).click();
  assert.equal(sourcePickCalls, 2);
  assert.equal(await dialog.getByLabel('前端專案路徑').inputValue(), f.source);
  assert.equal(await dialog.getByRole('button', { name: '選擇前端專案', exact: true }).count(), 0);
  await dialog.getByRole('button', { name: '下一步', exact: true }).click();
  await dialog.getByRole('heading', { name: '測試專案放置位置' }).waitFor();
  if(process.env.ARCHIFY_REVIEW_STEP==='2')console.log('REVIEW_IMAGE:'+(await page.screenshot({type:'jpeg',quality:50})).toString('base64'));
  await dialog.getByLabel('獨立測試專案路徑').fill(f.source);
  await dialog.getByRole('button', { name: '下一步', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: '互相包含' }).waitFor();
  await dialog.getByRole('button', { name: '選擇測試資料夾', exact: true }).click();
  await dialog.getByRole('button', { name: '下一步', exact: true }).click();
  await dialog.getByRole('heading', { name: '上傳 PRD、業務流程文件' }).waitFor();
  if(process.env.ARCHIFY_REVIEW_STEP==='3')console.log('REVIEW_IMAGE:'+(await page.screenshot({type:'jpeg',quality:50})).toString('base64'));
  await page.addScriptTag({ path: require.resolve('../.local/gate-deps/node_modules/axe-core/axe.min.js') });
  async function gates(scope = page) {
    if (!await page.evaluate(() => !!window.axe)) await page.addScriptTag({ path: require.resolve('../.local/gate-deps/node_modules/axe-core/axe.min.js') });
    const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations);
    assert.deepEqual(violations.map(row => row.id), [], 'axe');
    for (const width of [390, 1024, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('main,body,dialog')].some(el => el.scrollWidth > el.clientWidth + 1)), false, 'overflow '+width);
    }
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.evaluate(() => document.documentElement.style.zoom = '2');
    assert.equal(await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1), false, '200% zoom');
    await page.evaluate(() => document.documentElement.style.zoom = '1');
    for (const button of await scope.locator('button:enabled').all()) {
      if (!await button.isVisible()) continue;
      const box = await button.boundingBox(); assert.ok(box.height >= 32 && box.width >= 24, 'targets');
      await page.keyboard.press('Tab'); await button.focus(); assert.notEqual(await button.evaluate(el => getComputedStyle(el).boxShadow), 'none', await button.textContent());
    }
    assert.equal(await page.locator('select').count(), 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('button').evaluateAll(elements => elements.every(el => getComputedStyle(el).animationName === 'none' && getComputedStyle(el).transitionDuration === '0s')), true);
  }
  await gates(dialog);
  assert.equal(await dialog.getByRole('button',{name:'完成設定',exact:true}).isDisabled(),true);assert.equal(await dialog.locator('textarea').count(),0);assert.equal(await dialog.getByRole('button',{name:'上傳文件',exact:true}).count(),1);
  await dialog.getByLabel('匯入知識文件').setInputFiles([{ name: '業務規則.md', mimeType: 'text/markdown', buffer: Buffer.from('# 測試規則\n卡片只能由擁有者讀取。') }, { name: '參考.txt', mimeType: 'text/plain', buffer: Buffer.from('<script>window.injected=true</script>') }, {name:'登入流程.md',mimeType:'text/markdown',buffer:Buffer.from('有效登入必須回傳會員識別碼。')}]);
  await dialog.getByText('已匯入 3 份知識', { exact: true }).waitFor();
  assert.equal(await dialog.getByRole('region', { name: 'AI 分析狀態' }).count(), 0);
  assert.equal(await dialog.getByText('正在整理知識…').count(), 0);
  await page.reload();await dialog.getByRole('heading',{name:'上傳 PRD、業務流程文件',exact:true}).waitFor();assert.equal(await page.getByRole('navigation',{name:'主要功能'}).count(),0);await dialog.getByRole('button',{name:'完成設定',exact:true}).click();await page.getByRole('heading',{name:'API測試腳本',exact:true}).waitFor();await page.getByRole('button',{name:'專案知識',exact:true}).click();
  await page.getByRole('heading', { name: '已匯入知識（3）' }).waitFor();
  await page.getByRole('button', { name: '參考.txt', exact: true }).click();
  await page.getByLabel('知識內容', { exact: true }).getByText('<script>window.injected=true</script>', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.injected), undefined, 'content is text');
  await gates();
  await page.getByRole('searchbox', { name: '搜尋知識' }).fill('登入');
  assert.equal(await page.getByRole('button', { name: '業務規則.md', exact: true }).count(), 0);
  await page.getByRole('searchbox', { name: '搜尋知識' }).fill('');
  await page.getByRole('button', { name: '封存 參考.txt', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByRole('button', { name: '封存 參考.txt', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '確認封存', exact: true }).click();
  await page.getByRole('heading', { name: '已匯入知識（2）' }).waitFor();
  await page.reload();
  await page.getByRole('button', { name: '專案知識', exact: true }).click();
  await page.getByRole('heading', { name: '已匯入知識（2）' }).waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0, 'first-run completion persisted');
  await page.getByRole('button', { name: '工作區設定', exact: true }).click();
  await page.getByRole('button',{name:'返回工作區',exact:true}).click();
  assert.equal(await page.getByRole('button', { name: '工作區設定', exact: true }).evaluate(el => el === document.activeElement), true, 'focus returns');
  assert.equal((await f.workspace.knowledge()).documents.length, 2);
  assert.match(await readFile(join(f.project, 'AGENTS.md'), 'utf8'), /knowledge\/README.md/);
  assert.deepEqual(errors, []);
  for (const name of ['WorkspaceDialog.tsx', 'SetupWizard.tsx', 'KnowledgeImport.tsx', 'KnowledgeWorkspace.tsx']) {
    const text = await readFile('apps/web/src/features/workspace/'+name, 'utf8');
    assert.ok(!/\bstyle\s*=|<select\b|\p{Extended_Pictographic}|#[a-f\d]{3,8}\b/iu.test(text), 'UI source gates');
  }
  console.log('PASS onboarding/knowledge: real setup/file persistence, injected native picker adapter, path errors, automatic upload/classification, safe preview, archive/cancel, restart, full-page gate/restore, keyboard, axe, targets, reduced motion, 390/1024/1280/1440/1920 overflow and zoom. No product API or model calls.');
} finally { await browser.close(); await f.dispose(); }

