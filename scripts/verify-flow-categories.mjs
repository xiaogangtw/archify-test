import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fixture } from '../services/local-workspace/test-support.mjs';
import { createHandler } from '../services/local-workspace/plugin.mjs';
import { scriptEvidence, caseEvidence } from '../test-project/support/script-evidence.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('../.local/gate-deps/node_modules/playwright');
assert.equal(process.env.DS_REQUIRE_BROWSER, '1');
const f = await fixture();
await f.workspace.initialize();await f.enableUi(); const analysis = await f.workspace.scan();
await f.workspace.generate({ scanId: analysis.scanId, ids: analysis.requests.map(item => item.id) });
const generated = join(f.project, 'tests/api/GetCard.spec.ts');
await writeFile(generated, (await readFile(generated, 'utf8')).replace('async () => {}', 'async () => { await test.step("讀取名片", async () => {}); await test.step("確認結果", async () => {}); }'));
await f.workspace.importKnowledge([{ name: '名片規則.md', content: '# 名片\n登入後可讀取自己的名片。', category: 'business', featureIds: ['F-CARD'] }]);
const handler = createHandler(f.workspace, 'catalog-ui');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
page.setDefaultTimeout(10000);
const assets = await readdir('apps/web/dist/assets');
const css = await readFile('apps/web/dist/assets/' + assets.find(name => name.endsWith('.css')), 'utf8');
const js = await readFile('apps/web/dist/assets/' + assets.find(name => name.endsWith('.js')), 'utf8');
const html = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>互動地圖驗證</title><style>' + css + '</style><body><div id="root"></div><script>' + js.replaceAll('</script', '<\\/script') + '</script></body></html>';
const errors = []; page.on('pageerror', error => errors.push(error.message));
await page.route('http://127.0.0.1:5191/**', async route => {
  const request = route.request(), url = new URL(request.url());
  if (!url.pathname.startsWith('/local-api/')) return route.fulfill({ status: 200, contentType: 'text/html', body: html });
  const req = Readable.from(request.postData() ? [request.postData()] : []);
  req.url = url.pathname; req.method = request.method(); req.socket = { remoteAddress: '127.0.0.1' }; req.headers = { ...request.headers(), host: url.host };
  let status = 200, body;
  await handler(req, { set statusCode(value) { status = value; }, setHeader() {}, end(value) { body = value; } });
  await route.fulfill({ status, contentType: 'application/json', body });
});
async function axe() {
  await page.addScriptTag({ path: require.resolve('../.local/gate-deps/node_modules/axe-core/axe.min.js') });
  const violations = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations);
  assert.deepEqual(violations.map(item => ({ id: item.id, nodes: item.nodes.map(n => n.target) })), []);
}

const row = (id, kind, target, script) => ({ id, featureId: 'F-CARD', title: id, kind, ...(target ? { target } : {}), ...(script ? { script } : {}), purpose: '分類驗證', preconditions: '無', data: '', expected: '分類正確', cleanup: '不需清理', steps: [{action:'驗證分類',expected:'分類正確'}], knowledgeIds: [], questions: [] });
const cases = [row('API-SINGLE','api','api','tests/api/a.spec.ts'),row('API-FLOW','flow','api','tests/flows/a.spec.ts'),row('WEB','flow','web'),row('MOBILE','flow','mobile'),row('MIXED','flow','mixed'),row('LEGACY-API','api'),row('LEGACY-WEB','flow',null,'tests/web/a.spec.ts'),row('LEGACY-FLOW','flow',null,'tests/flows/b.spec.ts'),row('UNKNOWN','flow'),row('EXPLICIT','flow','api','tests/ui/old.spec.ts')];
await writeFile(join(f.project,'test-cases/catalog.json'), JSON.stringify({schemaVersion:1,features:[{id:'F-CARD',name:'分類測試',sources:[]}],cases}));
try {
  // Fresh initialization must deliver classification instructions to external AI.
  assert.match(await readFile(join(f.project,'skills/plan-test-cases/SKILL.md'),'utf8'), /kind: flow 不等於畫面流程/);
  assert.match(await readFile(join(f.project,'test-cases/README.md'),'utf8'), /多支 API 串接/);
  await page.goto('http://127.0.0.1:5191/?view=flows');
  const table = page.getByRole('table',{name:'測試流程案例'});
  await table.waitFor();
  const titles = async () => table.locator('tbody tr th').evaluateAll(nodes=>nodes.map(n=>n.firstChild.textContent));
  assert.deepEqual(await titles(),['API-SINGLE','API-FLOW','LEGACY-API','LEGACY-FLOW','EXPLICIT']);
  await page.getByRole('button',{name:'畫面流程',exact:true}).click();
  assert.deepEqual(await titles(),['WEB','MOBILE','MIXED','LEGACY-WEB']);
  await page.getByRole('button',{name:'待分類',exact:true}).focus(); await page.keyboard.press('Enter');
  assert.deepEqual(await titles(),['UNKNOWN']);
  await page.getByRole('button',{name:'API 流程',exact:true}).click();
  await page.getByRole('button',{name:'重新讀取',exact:true}).click();
  await page.getByRole('button',{name:'重新讀取',exact:true}).waitFor();
  assert.deepEqual(await titles(),['API-SINGLE','API-FLOW','LEGACY-API','LEGACY-FLOW','EXPLICIT']);
  await axe();
  for(const width of [390,1024,1280,1440,1920]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'overflow '+width);}
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'200% zoom overflow');
  await page.evaluate(()=>{document.documentElement.style.fontSize='';});
  for(const button of await page.getByRole('button').all()){if(!await button.isVisible())continue;const box=await button.boundingBox();assert.ok(box.height>=32 && box.width>=24,await button.innerText());}
  const source=await readFile('apps/web/src/features/workspace/FlowWorkspace.tsx','utf8');assert.ok(!/\bstyle\s*=|<select\b|\p{Extended_Pictographic}|#[a-f\d]{3,8}\b/iu.test(source));
  assert.deepEqual(errors,[]);
  if(process.env.ARCHIFY_GATE_REVIEW==='1') console.log('REVIEW_IMAGE:'+(await page.screenshot({type:'jpeg',quality:65})).toString('base64'));
  console.log('PASS flow categories: explicit targets, API composition, legacy paths, unknown category, keyboard, reload, initialization AI instructions, axe, target size, responsive overflow; product requests 0.');
} finally {await browser.close(); await f.dispose();}
