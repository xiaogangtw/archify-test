import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createCodexSessions,sessionCommandArgs} from '../../agents/codex-session.mjs';

function server(actions,seen,{noTool=false}={}){
 return (_exe,args,options)=>{
  seen.push({spawn:args,options});const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{child.emit('close',0);};
  let buffer='',n=0,turn='turn-1';const emit=value=>child.stdout.write(JSON.stringify(value)+'\n');
  const next=()=>queueMicrotask(()=>emit({id:'tool-'+(++n),method:'item/tool/call',params:{tool:'android_action',threadId:'thread-1',turnId:turn,callId:'c'+n,arguments:actions.shift()}}));
  child.stdin.on('data',chunk=>{buffer+=chunk;while(buffer.includes('\n')){const end=buffer.indexOf('\n'),line=buffer.slice(0,end);buffer=buffer.slice(end+1);const m=JSON.parse(line);seen.push(m);
   if(m.method==='initialize')emit({id:m.id,result:{userAgent:'fixture'}});
   if(m.method==='thread/start'||m.method==='thread/resume')emit({id:m.id,result:{thread:{id:'thread-1'},model:'server-reported-model'}});
   if(m.method==='turn/start'){emit({id:m.id,result:{turn:{id:turn,status:'inProgress'}}});if(noTool)queueMicrotask(()=>emit({method:'turn/completed',params:{threadId:'thread-1',turn:{id:turn,status:'completed'}}}));else next();}
   if(typeof m.id==='string'&&m.id.startsWith('tool-')&&m.result&&actions.length)next();
   if(m.method==='turn/interrupt'){emit({id:m.id,result:{}});emit({method:'turn/completed',params:{threadId:'thread-1',turn:{id:turn,status:'interrupted'}}});}
  }});return child;
 };
}
const meta={taskId:'task-a',sessionKey:'owner/task-a/model',toolSchema:{type:'object',properties:{kind:{type:'string'}},required:['kind']},evidence:'actual observation'};
const located={executable:'codex',args:[]};
test('persistent Codex native tools receive actual results and images in the same turn',async()=>{
 const root=await mkdtemp(join(tmpdir(),'archify-session-test-')),seen=[];
 const sessions=createCodexSessions({root,spawn:server([{kind:'observe'},{kind:'longPress',locator:{kind:'text',value:'DemoAccount'}},{kind:'finish',result:'answer',summary:'menu observed'}],seen)});
 try{
  const first=await sessions.run(meta,'contract',located);assert.equal(JSON.parse(first.source).kind,'observe');assert.equal(first.reportedModel,'server-reported-model');
  assert.equal(JSON.parse((await sessions.run({...meta,evidence:'fresh XML'},'contract',located,null,['png-data'])).source).kind,'longPress');
  assert.equal(JSON.parse((await sessions.run(meta,'contract',located)).source).kind,'finish');
  assert.equal(seen.filter(item=>item.spawn).length,1);assert.equal(seen.filter(item=>item.method==='turn/start').length,1);
  const result=seen.find(item=>item.id==='tool-1'&&item.result);assert.equal(result.result.contentItems[0].text,'fresh XML');assert.equal(result.result.contentItems[1].imageUrl,'data:image/png;base64,png-data');
  const start=seen.find(item=>item.method==='thread/start');assert.equal(start.params.sandbox,'read-only');assert.equal(start.params.dynamicTools[0].name,'android_action');assert.equal(start.params.allowProviderModelFallback,false);
  assert.ok(sessionCommandArgs().includes('shell_tool'));assert.ok(seen.some(item=>item.method==='turn/interrupt'));
 }finally{sessions.close();await rm(root,{recursive:true,force:true});}
});
test('a stopped native session cannot deliver a pending phone action, and resumes its saved thread',async()=>{
 const root=await mkdtemp(join(tmpdir(),'archify-session-test-')),seen=[];
 let sessions=createCodexSessions({root,spawn:server([{kind:'observe'}],seen)});
 try{
  await sessions.run(meta,'contract',located);assert.deepEqual(sessions.taskIds(),['task-a']);sessions.retain([]);assert.deepEqual(sessions.taskIds(),[]);sessions.close();
  sessions=createCodexSessions({root,spawn:server([{kind:'finish',result:'answer',summary:'resumed'}],seen)});
  await sessions.run(meta,'contract',located);assert.equal(seen.filter(item=>item.method==='thread/resume').length,1);
 }finally{sessions.close();await rm(root,{recursive:true,force:true});}
});
test('ordinary model prose cannot impersonate an executed native action',async()=>{
 const root=await mkdtemp(join(tmpdir(),'archify-session-test-')),sessions=createCodexSessions({root,spawn:server([],[],{noTool:true})});
 try{await assert.rejects(sessions.run(meta,'contract',located),/CODEX_ACTION_REQUIRED/);}finally{sessions.close();await rm(root,{recursive:true,force:true});}
});

for(const restart of [false,true])test(`changed tool contract starts a fresh native thread (${restart?'saved':'live'} session)`,async()=>{
 const root=await mkdtemp(join(tmpdir(),'archify-session-test-')),seen=[];
 const spawn=(...args)=>server([{kind:'observe'}],seen)(...args);
 let sessions=createCodexSessions({root,spawn});
 try{
  await sessions.run(meta,'old contract',located);
  if(restart){sessions.close();sessions=createCodexSessions({root,spawn:server([{kind:'observe'}],seen)});}
  const updated={...meta,toolSchema:{...meta.toolSchema,properties:{kind:{enum:['observe','editorAction']},editorAction:{enum:['search']}}}};
  await sessions.run(updated,'updated contract; observe before continuing',located);
  const starts=seen.filter(item=>item.method==='thread/start');
  assert.equal(starts.length,2);
  assert.equal(seen.filter(item=>item.method==='thread/resume').length,0);
  assert.deepEqual(starts[1].params.dynamicTools[0].inputSchema,updated.toolSchema);
  assert.equal(seen.filter(item=>item.id==='tool-1'&&item.result).length,0,'never replay a pending action from the stale contract');
 }finally{sessions.close();await rm(root,{recursive:true,force:true});}
});
