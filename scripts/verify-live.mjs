import { randomUUID } from 'node:crypto';
const base=process.env.CONTROL_API_URL || 'http://127.0.0.1:3001';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))throw new Error('Use local API or SSH tunnel');
async function call(path,body){const res=await fetch(`${base}/api${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Archify-Client':'web'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(70000)});const result=await res.json();if(!res.ok)throw new Error(`${path}: ${JSON.stringify(result)}`);return result;}
const bootstrap=await call('/bootstrap');
const project=bootstrap.documents.find(doc=>doc.key==='archify.testing.v1')?.value?.project;
if(project?.repositoryUrl)throw new Error('This verification requires the initial fixture project, without company repositories');
const original=bootstrap.scripts.find(script=>script.id==='archify-readonly-smoke');if(!original)throw new Error('Seed Smoke missing');
async function save(source,name){const id=randomUUID();const response=await fetch(`${base}/api/scripts/${id}`,{method:'PUT',headers:{'Content-Type':'application/json','X-Archify-Client':'web'},body:JSON.stringify({id,name,source,version:0,messages:[]})});if(!response.ok)throw new Error(await response.text());return response.json();}
async function execute(script,expected,cancel=false){
  const run=await call('/runs',{scriptId:script.id,scriptVersion:script.version,requestId:randomUUID()});
  if(cancel)await call(`/runs/${run.id}/cancel`,{});
  const deadline=Date.now()+100000;
  while(Date.now()<deadline){
    const detail=await call(`/runs/${run.id}`);
    if(!['queued','running'].includes(detail.status)){
      if(detail.status!==expected)throw new Error(`Expected ${expected}, got ${detail.status}: ${detail.message}`);
      if(detail.source!==script.source || detail.sourceHash.length!==64 || !detail.finishedAt)throw new Error('Incomplete immutable result');
      if(expected==='passed' && !detail.events.some(item=>item.event.type==='step-end'))throw new Error('Missing live step events');
      const reread=await call(`/runs/${run.id}`);if(reread.status!==expected)throw new Error('Result did not persist');
      console.log(`${expected}: ${detail.testVersion}`);return;
    }
    await new Promise(resolve=>setTimeout(resolve,500));
  }throw new Error('Runner did not finish within deadline');
}
await execute(original,'passed');
await execute(await save("import {test,expect} from '@playwright/test'; test('failure',async()=>{await test.step('assert failure',async()=>{expect(1).toBe(2);});});",'驗證用：斷言失敗'),'failed');
await execute(await save("import {test} from '@playwright/test'; test('draft',async()=>{test.fixme(true,'Not implemented');});",'驗證用：略過草稿'),'skipped');
await execute(await save("import {test} from '@playwright/test'; test('cancel',async()=>{await test.step('wait',async()=>{await new Promise(r=>setTimeout(r,15000));});});",'驗證用：取消'),'cancelled',true);
console.log('Live queue → isolated Runner → persisted results verified. Verification cases remain in the library as evidence.');
