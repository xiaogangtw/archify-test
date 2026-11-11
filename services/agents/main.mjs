import { runWorkerPool, workerCount } from './pool.mjs';
import { readFile } from 'node:fs/promises';
import { locate, runAgent } from './adapter.mjs';
import {createCodexSessions} from './codex-session.mjs';
import llmTimeouts from '../control-api/src/llmTimeouts.json' with {type:'json'};
import outputLimits from '../control-api/src/llmOutputLimits.json' with {type:'json'};
const base=process.env.CONTROL_API_URL || 'http://127.0.0.1:3001';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw new Error('Agents bridge requires loopback or SSH tunnel');
const token=(await readFile(process.env.WORKER_TOKEN_FILE || '.local/worker-token','utf8')).trim();
const concurrency=workerCount(process.env.AGENT_CONCURRENCY);
const sessions=createCodexSessions();
console.log(`模型分析時間上限：${llmTimeouts.cliMs/60000} 分鐘（橋接設定）。`);
console.log(`模型回覆容量：${outputLimits.replyCharacters} 字元（橋接設定）。`);
async function call(path,body){const response=await fetch(`${base}${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error(`Control API ${response.status}`);return response.json();}
let stop=false;let commands={};process.on('SIGINT',()=>{stop=true;sessions.close();});process.on('SIGTERM',()=>{stop=true;sessions.close();});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function heartbeat(){
  while(!stop){
    try {
      const next={};for(const name of ['codex','claude','gemini'])next[name]=await locate(name);
      commands=next;
      await call('/internal/agents/status',{androidAgentNative:true,providers:Object.entries(commands).map(([id,command])=>({id,installed:!!command}))});
      const ids=sessions.taskIds();if(ids.length){const {active}=await call('/internal/agents/android-tasks',{ids});sessions.retain(active);}
    }catch(error){console.error(error.message);}
    await pause(5000);
  }
}
async function worker(){
  while(!stop){
    try {
      if(!Object.values(commands).some(Boolean)){await pause(1000);continue;}
      const job=await call('/internal/llm/claim',{});
      if(!job){await pause(1000);continue;}
      try {
        if(!commands[job.provider])throw new Error('Official CLI is not installed on bridge host');
        const result=job.provider==='codex'&&job.agentMeta?await sessions.run(job.agentMeta,job.prompt,commands.codex,job.model,job.images||[]):await runAgent(job.provider,job.prompt,commands[job.provider],job.model,job.images||[]);
        await call(`/internal/llm/${job.id}/result`,{leaseToken:job.leaseToken,result});
      }catch(error){await call(`/internal/llm/${job.id}/result`,{leaseToken:job.leaseToken,error:error.message});}
    }catch(error){console.error(error.message);await pause(3000);}
  }
}
await Promise.all([heartbeat(),runWorkerPool(concurrency,worker)]);
