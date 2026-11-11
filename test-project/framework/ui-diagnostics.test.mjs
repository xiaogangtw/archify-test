import test from 'node:test';
import assert from 'node:assert/strict';
import {safeDiagnostic,uiFailure} from '../support/ui-diagnostics.mjs';
import {renderHtml} from './html.mjs';
import {buildReport} from '../skills/playwright-test-report/scripts/build-report.mjs';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('診斷保留分類及操作、不保存原始錯誤或不明欄位',()=>{
 const error=new Error('satoken=secret-value https://secret.example');
 assert.ok(!JSON.stringify(safeDiagnostic(error)).includes('secret'));
 const result=safeDiagnostic(uiFailure('RESPONSE_TIMEOUT',{operation:'SyntheticLogin',timeoutMs:30000,token:'secret-value'}),{pageErrors:1});
 assert.equal(result.operation,'SyntheticLogin');assert.equal(result.pageErrors,1);assert.equal(result.token,undefined);
});
test('技能原工具轉接相同圖文產生器，保留預期及實際',async()=>{
 const root=await mkdtemp(join(tmpdir(),'archify-skill-report-'));
 try{
  await writeFile(join(root,'results.json'),JSON.stringify({title:'技能範本合成',summary:'非產品驗收',environment:'合成',method:'mock',cases:[{id:'one',title:'案例',status:'PASS',expected:'預期資料',actual:'實際資料',steps:['一步'],screenshots:[]}]}));
  const result=await buildReport(root);const html=await readFile(join(root,result.files.html),'utf8');
  assert.match(html,/--navy:#102e50/);assert.match(html,/預期資料/);assert.match(html,/實際資料/);assert.match(html,/完整步驟紀錄/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('使用者圖文版型與 HTML escaping 共用在內嵌及離線產生器',()=>{
 const report={project:'合成報告',createdAt:'2026-11-09T00:00:00Z',kind:'execution',cases:[{id:'one',name:'<script>unsafe()</script>',purpose:'合成',expected:'具體預期',actual:'具體實際',status:'failed',steps:[{name:'等待',status:'failed',expected:'收到回應',actual:'逾時',diagnostic:{code:'RESPONSE_TIMEOUT',message:'等待回應逾時',operation:'SyntheticLogin'}}]}]};
 for(const embedded of [true,false]){const html=renderHtml(report,{embedded});assert.match(html,/--navy:#102e50/);assert.match(html,/具體預期/);assert.match(html,/具體實際/);assert.match(html,/SyntheticLogin/);assert.ok(!html.includes('<script>unsafe()'));
 }
});
