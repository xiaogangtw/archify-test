import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
const base=process.env.CONTROL_API_URL || 'http://127.0.0.1:3001';
if(!/^http:\/\/(127\.0\.0\.1|localhost|control-api):\d+$/.test(base))throw new Error('Launcher only supports loopback Control API');
const token=(await readFile(process.env.WORKER_TOKEN_FILE || '.local/worker-token','utf8')).trim();
const image=process.env.RUNNER_IMAGE || 'archify-runner:local';
if(!/^[a-z0-9][a-z0-9._/:@-]+$/.test(image))throw new Error('Invalid runner image');
async function call(path,body){
  const response=await fetch(`${base}${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error(`Control API ${response.status}`);
  return response.json();
}
function docker(args){return spawn('docker',args,{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});}
async function remove(name){await new Promise(resolve=>{const child=docker(['rm','-f',name]);child.on('error',resolve);child.on('close',resolve);});}
async function execute(job){
  const name=`archify-job-${job.id}`;let sequence=0;let final=null;let canceled=false;let timedOut=false;let stream=Promise.resolve();let outputBytes=0;let transportFailed=false;
  const emit=event=>{stream=stream.then(()=>call(`/internal/runs/${job.id}/events`,{leaseToken:job.leaseToken,sequence:++sequence,event})).catch(()=>{transportFailed=true;});};
  const child=docker(['run','--rm','--name',name,'--label','archify.runner=true','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','1000:1000','--pids-limit','128','--memory','512m','--cpus','1','--ulimit','nofile=1024:1024','--tmpfs','/tmp:rw,nosuid,nodev,size=128m,uid=1000,gid=1000,mode=1700','--log-driver','none','-i',image]);
  child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({source:job.source}));
  child.stdout.on('data',chunk=>{outputBytes+=chunk.length;if(outputBytes>1000000){timedOut=true;void remove(name);}});
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{
    if(outputBytes>1000000)return;
    if(!line.startsWith('ARCHIFY_EVENT '))return;
    try{const event=JSON.parse(line.slice(14));if(event.type==='result'){final=event;return;}
      if(['step-start','step-end','error'].includes(event.type))emit({type:event.type,title:String(event.title || '').slice(0,500),status:['passed','failed','skipped','cancelled'].includes(event.status)?event.status:undefined,message:String(event.message || '').slice(0,10000)});
    }catch{/* Malformed script output cannot control the launcher. */}
  });
  // Never forward arbitrary stdout/stderr, which can contain application secrets.
  child.stderr.on('data',()=>{});
  const deadline=setTimeout(()=>{timedOut=true;void remove(name);},60000);
  let heartbeatBusy=false;
  const heartbeat=setInterval(async()=>{if(heartbeatBusy)return;heartbeatBusy=true;try{const result=await call(`/internal/runs/${job.id}/heartbeat`,{leaseToken:job.leaseToken});if(result.cancel){canceled=true;await remove(name);}}catch{transportFailed=true;await remove(name);}finally{heartbeatBusy=false;}},10000);
  const code=await new Promise(resolve=>{child.on('error',()=>resolve(-1));child.on('close',resolve);});
  clearTimeout(deadline);clearInterval(heartbeat);await remove(name);await stream;
  const status=canceled?'cancelled':timedOut || transportFailed || code!==0?'failed':final?.status==='passed'?'passed':final?.status==='skipped'?'skipped':'failed';
  await call(`/internal/runs/${job.id}/events`,{leaseToken:job.leaseToken,sequence:++sequence,event:{type:'result',status,message:canceled?'已取消':timedOut?'Runner timeout or output limit':transportFailed?'Runner lost Control API connection':code!==0?'Runner exited unsuccessfully':String(final?.message || 'Runner returned no result').slice(0,10000)}});
}
let stopping=false;process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
while(!stopping){try{const job=await call('/internal/claim',{});if(job)await execute(job);else await new Promise(resolve=>setTimeout(resolve,1500));}catch(error){console.error(error.message);await new Promise(resolve=>setTimeout(resolve,5000));}}
