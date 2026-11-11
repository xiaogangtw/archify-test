import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {listReports,readReport} from './reports.mjs';
import {renderHtml} from '../../test-project/framework/journey-report.mjs';

test('全部歷史超過100與1000份仍可讀，新單檔與舊JSON相容，舊HTML不重複列出',async()=>{
 const root=await mkdtemp(join(tmpdir(),'archify-report-history-'));
 const config={projectRoot:root,reportDir:'reports'};
 try{
  await mkdir(join(root,'reports/ui'),{recursive:true});
  const value={schemaVersion:1,kind:'execution',project:'合成歷史',runId:'abcdef12-3456',createdAt:'2026-11-10T00:00:00Z',cases:[]};
  await Promise.all(Array.from({length:1105},(_,i)=>writeFile(join(root,'reports/ui/report-old-'+String(i).padStart(4,'0')+'.json'),JSON.stringify(value))));
  await writeFile(join(root,'reports/ui/report-old-0000.html'),'<html>舊離線副本</html>');
  await writeFile(join(root,'reports/ui/report-new.html'),renderHtml(value));
  const rows=await listReports(config);
  assert.equal(rows.length,1106);
  assert.ok(rows.some(r=>r.name==='ui/report-old-0000.json'));
  assert.ok(rows.some(r=>r.name==='ui/report-old-1104.json'));
  assert.ok(!rows.some(r=>r.name==='ui/report-old-0000.html'));
  assert.deepEqual(await readReport(config,'ui/report-new.html'),value);
  assert.deepEqual(await readReport(config,'ui/report-old-0000.json'),value);
  await assert.rejects(()=>readReport(config,'../.env'),/檔名/);
  await writeFile(join(root,'reports/ui/report-invalid.html'),'<script>throw new Error("DO_NOT_EXECUTE")</script>');
  assert.equal((await listReports(config)).length,1106);
  await assert.rejects(()=>readReport(config,'ui/report-invalid.html'),/同名JSON/);
 }finally{
  assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(root.includes('archify-report-history-'));
  await rm(root,{recursive:true,force:true});
 }
});
