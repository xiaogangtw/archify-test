import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {writeFile,readFile,lstat} from 'node:fs/promises';
import {runCodexJson} from './ai-jobs.mjs';
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
