import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import llmTimeouts from '../control-api/src/llmTimeouts.json' with {type:'json'};
import outputLimits from '../control-api/src/llmOutputLimits.json' with {type:'json'};
import {parseModelReply} from '../control-api/src/llmReply.mjs';
import {reportedModel} from '../control-api/src/modelTelemetry.mjs';
const execFileAsync=promisify(execFile);
export const schema={type:'object',properties:{reply:{type:'string'},source:{type:['string','null']}},required:['reply','source'],additionalProperties:false};
export function commandArgs(provider,dir){
  if(provider==='codex')return ['exec','--ignore-user-config','--ignore-rules','--ephemeral','--skip-git-repo-check','--sandbox','read-only','--disable','shell_tool','--disable','multi_agent','-c','web_search="disabled"','--output-schema',join(dir,'schema.json'),'--output-last-message',join(dir,'reply.json'),'-'];
  if(provider==='claude')return ['-p','--output-format','json','--tools','','--strict-mcp-config','--mcp-config',join(dir,'mcp.json'),'--setting-sources','','--no-session-persistence'];
  if(provider==='gemini')return ['--prompt','Use only the stdin context. Return requested JSON.','--output-format','json','--admin-policy',join(dir,'deny.toml')];
  throw new Error('Unknown provider');
}
export function parseAnswer(provider,stdout,file){
  let content=file;let actual;
  if(provider!=='codex'){
    let envelope;
    try{envelope=JSON.parse(stdout);}
    catch{throw new Error('CLI_ENVELOPE_JSON: CLI 回應不是完整有效的 JSON。');}
    content=envelope?.[provider==='claude'?'result':'response'];actual=reportedModel(envelope);
  }
  return {...parseModelReply(content),...(actual?{reportedModel:actual}:{})};
}
export function npmCliEntry(provider,launcher){
  const root=join(launcher,'..','node_modules');
  const entries={codex:['@openai','codex','bin','codex.js'],claude:['@anthropic-ai','claude-code','cli.js'],gemini:['@google','gemini-cli','dist','index.js']};
  if(!entries[provider])throw new Error('Unknown provider');
  return join(root,...entries[provider]);
}
export async function locate(provider){
  try {
    // Fixed executable names; never resolve a command supplied by the browser.
    const {stdout}=await execFileAsync(process.platform==='win32'?'where.exe':'which',[provider],{timeout:5000,windowsHide:true});
    const path=stdout.trim().split(/\r?\n/).find(path=>process.platform!=='win32' || /\.exe$/i.test(path));
    if(path && isAbsolute(path))return {executable:path,args:[]};
    // npm launchers are .cmd on Windows. Resolve their fixed JS entry and invoke Node directly.
    if(process.platform==='win32') {
      const launcher=stdout.trim().split(/\r?\n/).find(path=>/\.cmd$/i.test(path));
      if(launcher){
        const entry=npmCliEntry(provider,launcher);
        await readFile(entry);return {executable:process.execPath,args:[entry]};
      }
    }
  }catch{}return null;
}
export async function runAgent(provider,prompt,located,model=null,images=[]){
  if(!Array.isArray(images)||images.length>1||images.some(image=>typeof image!=='string'||image.length>1500000||!(/^[A-Za-z0-9+/]+={0,2}$/).test(image)||Buffer.from(image,'base64').subarray(0,8).toString('hex')!=='89504e470d0a1a0a'))throw new Error('Invalid image input');
  if(images.length&&provider!=='codex')throw new Error('This CLI bridge does not support image input');
  if(provider==='gemini') {
    const policyRoot=process.platform==='win32'?join(process.env.ProgramData || 'C:\\ProgramData','gemini-cli','policies'):'/etc/gemini-cli/policies';
    const policies=await readdir(policyRoot).catch(()=>[]);
    if(policies.some(name=>name.endsWith('.toml')))throw new Error('Gemini system policies exist; supplemental deny policy cannot be guaranteed');
  }
  const dir=await mkdtemp(join(tmpdir(),'archify-agent-'));
  try {
    await writeFile(join(dir,'schema.json'),JSON.stringify(schema));await writeFile(join(dir,'mcp.json'),'{"mcpServers":{}}');
    await writeFile(join(dir,'deny.toml'),'[[rule]]\ntoolName = "*"\ndecision = "deny"\npriority = 999\n\n[[rule]]\ntoolName = "*"\nmcpName = "*"\ndecision = "deny"\npriority = 999\n');
    await mkdir(join(dir,'.gemini'));await writeFile(join(dir,'.gemini/settings.json'),JSON.stringify({hooks:{enabled:false},mcpServers:{},security:{folderTrust:{enabled:true}},tools:{exclude:['run_shell_command','write_file','replace','read_file','read_many_files','list_directory','glob','grep_search','google_web_search','web_fetch','save_memory','delegate_to_agent','activate_skill']}}));
    const options=commandArgs(provider,dir);
    for(const [index,image] of images.entries()){const path=join(dir,`screen-${index}.png`);await writeFile(path,Buffer.from(image,'base64'));options.splice(options.length-1,0,'--image',path);}
    if(model){if(!/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,119}$/.test(model))throw new Error('Invalid model identifier');options.unshift('--model',model);}
    const args=[...located.args,...options];
    const child=spawn(located.executable,args,{cwd:dir,shell:false,windowsHide:true,env:{...process.env,CLAUDECODE:undefined}});
    let stdout='';let stderr='';let failure='';
    child.stdout.on('data',chunk=>{stdout+=chunk;if(Buffer.byteLength(stdout)>outputLimits.cliOutputBytes){failure='output';child.kill();}});
    child.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-16000);});
    child.stdin.on('error',()=>{});child.stdin.end(prompt);
    const timeout=setTimeout(()=>{failure='timeout';child.kill();},llmTimeouts.cliMs);
    const code=await new Promise(resolve=>{child.on('error',()=>resolve(-1));child.on('close',resolve);});clearTimeout(timeout);
    if(failure || code!==0)throw new Error(cliFailure(failure,stderr,code));
    const file=provider==='codex'?await readFile(join(dir,'reply.json'),'utf8'):'';
    return parseAnswer(provider,stdout,file);
  }finally{await rm(dir,{recursive:true,force:true});}
}

export function cliFailure(reason,stderr,code){
  if(reason==='timeout')return `CLI_TIMEOUT: 模型分析超過 ${llmTimeouts.cliMs/60000} 分鐘上限，工作已停止；這不代表登入失敗。`;
  if(reason==='output')return 'CLI_OUTPUT_LIMIT: 模型輸出超過上限，請縮小分析範圍。';
  if(/unauthorized|not logged in|login required|authentication|token.*(?:expired|revoked)|401/i.test(stderr))return 'CLI_AUTH: 官方 CLI 登入失效，請在橋接所在電腦重新登入。';
  if(/429|rate.limit|quota|usage.limit/i.test(stderr))return 'CLI_RATE_LIMIT: 模型供應商額度或頻率限制，請稍後重試。';
  if(/unexpected argument|unknown option|unrecognized.*(?:argument|option)|unknown.*flag/i.test(stderr))return 'CLI_ARGUMENT: CLI 版本不支援目前參數，請確認官方工具版本。';
  if(/model.*(?:not found|not supported|does not exist|unavailable)/i.test(stderr))return 'CLI_MODEL: 所選模型不可用，請檢查模型連線設定。';
  if(/network|connection|dns|tls|certificate|timed out|failed to fetch/i.test(stderr))return 'CLI_NETWORK: CLI 無法連上模型服務，請檢查網路與代理設定。';
  return 'CLI_EXIT: 官方 CLI 非正常結束（exit '+String(code)+'）；請在橋接電腦檢查 CLI 版本、登入與網路。';
}
