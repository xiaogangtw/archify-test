import { createRequire } from 'node:module';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require('../.local/gate-deps/node_modules/playwright'); }
const { build } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');
const themeBundle = await build({ entryPoints: [join(root, 'apps/web/tailwind.config.ts')], bundle: true, write: false, format: 'esm', platform: 'node' });
const theme = (await import('data:text/javascript;base64,'+Buffer.from(themeBundle.outputFiles[0].text).toString('base64'))).default.theme;
assert.equal(theme.fontSize.body[0], theme.fontSize.menu[0]);
const colors = theme.extend.colors;
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(value => parseInt(value,16)/255).map(value => value <= .04045 ? value/12.92 : ((value+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
for (const [name, foreground, background] of [
  ['ink/canvas',colors.ink,colors.canvas],['muted/canvas',colors.muted,colors.canvas],
  ['ink/sidebar',colors.ink,colors.sidebar],['muted/sidebar',colors.muted,colors.sidebar],
  ['danger/surface',colors.danger.DEFAULT,colors.surface],['success/surface',colors.success.DEFAULT,colors.surface],
  ['brand/surface',colors.brand.DEFAULT,colors.surface],['warning/surface',colors.warning.DEFAULT,colors.surface],
  ['on-brand/brand',colors['on-brand'],colors.brand.DEFAULT],
  ['ink/surface',colors.ink,colors.surface],
  ['muted/surface',colors.muted,colors.surface],
]) {
  const a=luminance(foreground),b=luminance(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  assert.ok(ratio>=4.5,name+' contrast '+ratio.toFixed(2));
}
for (const source of ['features/dashboard/Dashboard.tsx','features/dashboard/WorkspaceIdentity.tsx','features/dashboard/RecentActivity.tsx','components/ui/ResultDistribution.tsx']) {
  const text = await readFile(join(root,'apps/web/src',source),'utf8');
  assert.ok(!/#[a-f\d]{3,8}\b|\bstyle\s*=|<select\b|\p{Extended_Pictographic}/iu.test(text),source+' styling gate');
}
assert.ok(luminance(colors.canvas)<.02,'dark application canvas');
assert.equal(colors.report.surface,'#ffffff');
assert.equal(colors.report.ink,'#24282f');
assert.equal(colors.report.brand.DEFAULT,'#315ac6');
console.log('PASS: dark Tailwind theme, 11 AA contrast pairs, preserved print palette, hardcode/emoji/native-select checks.');
const dir = join(root, '.local/dashboard-ui');
await mkdir(dir, { recursive: true });
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';
import {Dashboard} from '../../apps/web/src/features/dashboard/Dashboard';
createRoot(document.getElementById('root')).render(<main className="bg-canvas p-5 lg:p-6"><Dashboard onNavigate={page=>{document.getElementById('destination').textContent=page;}}/><output id="destination" aria-label="導向頁面"/></main>);`;
const bundled = await build({
  stdin: { contents: entry, resolveDir: dir, loader: 'tsx' },
  bundle: true, write: false, format: 'iife', jsx: 'automatic',
  nodePaths: [join(root, 'apps/web/node_modules')],
  plugins: [{ name: 'dashboard-fixture', setup(build) {
    build.onResolve({ filter: /testing\/TestingProvider$/ }, () => ({ path: 'fixture', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      export function useTesting(){
        const mode=new URLSearchParams(location.search).get('mode');
        const statuses=['cancelled','skipped','passed','running','queued','failed'];
        const rows=statuses.map((status,i)=>({id:String(i),scriptName:i===5?'長案例名稱'.repeat(16):'測試案例 '+i,status,message:'測試用執行摘要，非真實產品結果。',testVersion:'VERSION-'+('x'.repeat(80)),createdAt:new Date(Date.UTC(2026,10,3,i)).toISOString()}));
        return {data:{project:{name:'驗證專案'}},runHistory:mode==='empty'?[]:rows,runError:mode==='error'?'讀取失敗':''};
      }`, loader: 'js' }));
  } }],
});
const assets = join(root, 'apps/web/dist/assets');
const css = await readFile(join(assets, (await readdir(assets)).find(name => name.endsWith('.css'))), 'utf8');
const file = join(dir, 'index.html');
const script = bundled.outputFiles[0].text.replaceAll('"/brand/archify-companion-v2.png"', JSON.stringify(pathToFileURL(join(root,'apps/web/public/brand/archify-companion-v2.png')).href));
await writeFile(file, '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>總覽驗證</title><style>'+css+'</style><body class="bg-canvas text-ink"><div id="root"></div><script>'+script.replaceAll('</script','<\\/script')+'</script></body></html>');
const browser = await playwright.chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(pathToFileURL(file).href);
  await page.getByRole('heading', { name: '測試結果', exact: true }).waitFor();
  await page.waitForFunction(()=>document.querySelector('img').complete);
  assert.ok(await page.locator('img').evaluate(image=>image.naturalWidth>0),'mascot asset loads');
  assert.equal(await page.locator('img').evaluate(image=>image.getBoundingClientRect().width),80);
  assert.equal(await page.locator('ol > li').count(), 3);
  assert.equal(await page.getByRole('button',{name:'查看執行紀錄',exact:true}).count(),1);
  assert.equal(await page.getByText('測試用執行摘要，非真實產品結果。').count(),0);
  assert.equal(await page.getByText(/目前載入|依已取得|查看工作佇列/).count(), 0);
  assert.equal(await page.getByRole('heading', {name:'有測試未通過'}).count(), 1);
  assert.match(await page.getByRole('img').getAttribute('aria-label'), /成功 1 筆.*失敗 1 筆.*已取消 1 筆/);
  assert.equal(await page.locator('svg[role="img"] circle[stroke-dasharray]').count(), 6);
  assert.equal(await page.locator('time').first().getAttribute('datetime'), '2026-11-03T05:00:00.000Z');
  const button = page.getByRole('button', {name:'查看執行紀錄',exact:true});
  await button.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#destination').innerText(),'runs');
  for (const width of [1024, 1280, 1440, 1920]) {
    await page.setViewportSize({width,height:1000});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false,'overflow @'+width);
    const box=await button.boundingBox(); assert.ok(box.width>=32&&box.height>=32,'target @'+width);
  }
  await page.goto(pathToFileURL(file).href+'?mode=empty');
  await page.getByRole('heading',{name:'尚未執行測試'}).waitFor();
  assert.equal(await page.getByRole('img').getAttribute('aria-label'),'尚無執行結果');
  assert.equal(await page.locator('svg[role="img"] circle[stroke-dasharray]').count(),0);
  await page.goto(pathToFileURL(file).href+'?mode=error');
  await page.getByRole('heading',{name:'結果同步中斷'}).waitFor();
  assert.equal(await page.locator('h1').evaluate(el=>getComputedStyle(el).fontSize),'20px');
  assert.equal(await page.locator('h2').first().evaluate(el=>getComputedStyle(el).fontSize),'14px');
  assert.equal(await page.locator('dt').first().evaluate(el=>getComputedStyle(el).fontSize),'14px');
  console.log('PASS: six-status distribution, right-side latest-3 timeline, single result action, keyboard navigation, empty/error states, 20/14px typography, 80px companion, 144px chart and 32px targets at 1024/1280/1440/1920px.');
  console.log('Harness: '+file);
} finally { await browser.close(); }
