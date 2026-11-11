import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {renderHtml} from '../test-project/framework/html.mjs';
const require=createRequire(import.meta.url),{chromium}=require('../.local/gate-deps/node_modules/playwright');
assert.equal(process.env.DS_REQUIRE_BROWSER,'1');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setContent('<html lang="zh-Hant"><body><h1>合成畫面證據</h1><p>僅驗證報告版型，不是業務結果。</p></body></html>');const png=(await page.screenshot()).toString('base64');
const report={kind:'execution',testType:'ui',project:'合成 UI 情境報告',createdAt:'2026-11-08T12:00:00+08:00',runId:'synthetic',cases:[{id:'fixture',source:'tests/ui/Synthetic.spec.ts',name:'查看名片',status:'passed',purpose:'合成報告格式驗證',steps:[{name:'開啟名片',expected:'顯示指定姓名與內容',status:'passed'}],screenshots:[{caption:'查看名片後的畫面',data:png}],cleanup:{status:'passed'}}]};
await page.setContent(renderHtml(report));await page.getByRole('button',{name:'放大：查看名片後的畫面'}).click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').isVisible(),false);
await page.getByRole('button',{name:'放大：查看名片後的畫面'}).click();await page.getByRole('button',{name:'關閉',exact:true}).click();assert.equal(await page.getByRole('dialog').isVisible(),false);
for(const width of [390,1024,1280,1440,1920]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);}
await page.setViewportSize({width:1440,height:1000});if(process.env.ARCHIFY_GATE_REVIEW==='1')console.log('REVIEW_IMAGE:'+(await page.screenshot({type:'jpeg',quality:50})).toString('base64'));
report.cases[0].screenshots=[];report.cases[0].purpose='<script>window.bad=true</script>';await page.setContent(renderHtml(report));assert.equal(await page.locator('.evidence').count(),0);assert.equal(await page.locator('img').count(),0);assert.equal(await page.evaluate(()=>window.bad),undefined);await page.getByText('本份報告未包含截圖',{exact:false}).waitFor();assert.deepEqual(errors,[]);
console.log('PASS standalone HTML: scenario summary, evidence zoom/close/Escape, responsive overflow, no-image text mode, HTML escaping. Synthetic data only.');
}finally{await browser.close();}
