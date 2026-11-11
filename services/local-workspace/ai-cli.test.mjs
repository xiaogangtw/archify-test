import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {writeFile,readFile,lstat} from 'node:fs/promises';
import {runCodexJson,runAiJson,parseCodexOutput,inspectCodexCli,inspectAiCli,testCodexCli} from './ai-jobs.mjs';
test('CLI 以非 shell、唯讀、stdin 與 JSON schema 呼叫，不把秘密環境或原始輸出交給網站',async()=>{
 const secret='SYNTHETIC_BFF_SECRET';process.env.SATOKEN=secret;
 let invocation,prompt='',stages=[];
 try{
 const result=await runCodexJson({},'合成任務',{onProgress:text=>stages.push(text),spawnProcess:(file,args,options)=>{
  invocation={file,args,options};const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new Writable({write(chunk,_enc,cb){prompt+=chunk;cb();},final(cb){setImmediate(async()=>{child.stdout.write(JSON.stringify({type:'turn.started'})+'\n');child.stderr.write(secret);const output=args[args.indexOf('--output-last-message')+1];await writeFile(output,JSON.stringify({resultJson:JSON.stringify({ok:true})}));child.emit('close',0);});cb();}});return child;
 }});
 assert.deepEqual(result,{ok:true});assert.equal(invocation.options.shell,false);assert.equal(invocation.options.windowsHide,true);assert.ok(invocation.args.includes('read-only'));assert.ok(invocation.args.includes('--ignore-user-config'));assert.ok(invocation.args.includes('--output-schema'));assert.ok(invocation.args.includes('features.shell_tool=false'));assert.ok(!Object.values(invocation.options.env).includes(secret));assert.ok(prompt.includes('禁止呼叫工具'));assert.ok(!stages.join('').includes(secret));
 }finally{delete process.env.SATOKEN;}
});

test('CLI 圖片只寫入本次暫存附件，完成後移除，不接受副檔名路徑',async()=>{
 const bytes=Buffer.from('synthetic-image-fixture');let attachment;
 const result=await runCodexJson({},'合成圖片任務',{images:[{bytes,extension:'png'}],spawnProcess:(_file,args)=>{
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new Writable({write(_chunk,_enc,cb){cb();},final(cb){setImmediate(async()=>{attachment=args[args.indexOf('--image')+1];assert.deepEqual(await readFile(attachment),bytes);await writeFile(args[args.indexOf('--output-last-message')+1],JSON.stringify({resultJson:'{"ok":true}'}));child.emit('close',0);});cb();}});return child;
 }});
 assert.equal(result.ok,true);await assert.rejects(()=>lstat(attachment),{code:'ENOENT'});
 await assert.rejects(()=>runCodexJson({},'fixture',{images:[{bytes,extension:'../png'}]}),/附件不合法/);
});

test('直接結構化 schema、Markdown 圍欄容錯與 CLI 偵測／連線測試正常運作',async()=>{
 const schema={type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false};
 let schemaFile;
 const direct=await runCodexJson({},'結構化任務',{schema,spawnProcess:(_file,args)=>{
  schemaFile=args[args.indexOf('--output-schema')+1];
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
  child.stdin=new Writable({write(_c,_e,cb){cb();},final(cb){setImmediate(async()=>{
   const written=JSON.parse(await readFile(schemaFile,'utf8'));
   assert.deepEqual(written,schema);
   await writeFile(args[args.indexOf('--output-last-message')+1],'```json\n{"ok":true}\n```');
   child.emit('close',0);
  });cb();}});return child;
 }});
 assert.equal(direct.ok,true);
 assert.deepEqual(parseCodexOutput(JSON.stringify({resultJson:'```json\n{"features":[]}\n```'}),true),{features:[]});
 assert.throws(()=>parseCodexOutput('   ',false),/未產生分析結果/);
 const tested=await testCodexCli({aiModel:'synthetic-model'},{runner:async(cfg,_p,opts)=>{assert.equal(cfg.aiModel,'synthetic-model');assert.ok(opts.schema);return {ok:true};}});
 assert.equal(tested.ok,true);
 const inspected=await inspectCodexCli({},{spawnProcess:(_file,args)=>{
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
  setImmediate(()=>{
   if(args.includes('--version'))child.stdout.write('codex-cli 0.164.0\n');
   else child.stdout.write('Logged in\n');
   child.emit('close',0);
  });
  return child;
 }});
 assert.equal(typeof inspected.installed,'boolean');

 // Claude Code & Gemini CLI isolation and image boundary
 process.env.CLAUDECODE='1';
 try{
  let claudeInv;
  const claudeOut=await runAiJson({aiProvider:'claude',aiModel:'sonnet'},'分析',{spawnProcess:(file,args,opts)=>{
   claudeInv={file,args,opts};
   const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
   child.stdin=new Writable({write(_c,_e,cb){cb();},final(cb){setImmediate(()=>{child.stdout.write(JSON.stringify({type:'result',result:'{"ok":true}'}));child.emit('close',0);});cb();}});
   return child;
  }});
  assert.equal(claudeOut.ok,true);
  assert.ok(claudeInv.args.includes('--strict-mcp-config'));
  assert.ok(claudeInv.args.includes('--model')&&claudeInv.args.includes('sonnet'));
  assert.equal(claudeInv.opts.env.CLAUDECODE,undefined);
 }finally{delete process.env.CLAUDECODE;}

 let geminiInv;
 const geminiOut=await runAiJson({aiProvider:'gemini',aiModel:'gemini-2.5-pro'},'分析',{spawnProcess:(file,args,opts)=>{
  geminiInv={file,args,opts};
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
  child.stdin=new Writable({write(_c,_e,cb){cb();},final(cb){setImmediate(()=>{child.stdout.write(JSON.stringify({response:'```json\n{"ok":true}\n```'}));child.emit('close',0);});cb();}});
  return child;
 }});
 assert.equal(geminiOut.ok,true);
 assert.ok(geminiInv.args.includes('--admin-policy'));
 await assert.rejects(()=>runAiJson({aiProvider:'claude'},'圖片',{images:[{bytes:Buffer.from('x'),extension:'png'}]}),/僅支援 Codex/);
 const allInspect=await inspectAiCli({aiProvider:'claude'},{spawnProcess:()=>{
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
  setImmediate(()=>{child.stdout.write('1.0.0\n');child.emit('close',0);});
  return child;
 }});
 assert.ok(allInspect.providers.codex&&allInspect.providers.claude&&allInspect.providers.gemini);
 assert.ok(allInspect.providers.claude.models.some(m=>m.value==='sonnet'));
});
