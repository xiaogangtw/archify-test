import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureSources, scanCalls, askLLM } from '../src/integrations.ts';
import { scriptSchema, snapshotSteps, publicRun } from '../src/model.ts';
test('script validation and run output preserve immutable version/hash',()=>{
  assert.equal(scriptSchema.safeParse({id:'a',name:'',source:'',version:0,messages:[]}).success,false);
  assert.deepEqual(snapshotSteps("await test.step('health', async()=>{});"),['health']);
  const run=publicRun({id:'r',script_id:'s',script_version:2,test_version:'TEST',snapshot:{source:'old source',sourceHash:'abc',steps:['health']},status:'failed',message:'HTTP 500',completed:0});
  assert.equal(run.source,'old source');assert.equal(run.scriptVersion,2);assert.equal(run.status,'failed');assert.equal(run.sourceHash,'abc');
});
test('scanner reports evidence and does not invent fetch HTTP method',()=>{
  const calls=scanCalls([{path:'src/api.ts',hash:'sha',source:"fetch('/health');\naxios.post('/create');\nclient.dynamic(id)"}]);
  assert.equal(calls.length,2);assert.equal(calls[0].method,'UNKNOWN');assert.equal(calls[0].line,1);assert.equal(calls[1].method,'POST');assert.equal(calls[1].sourceHash,'sha');
});
test('Git snapshot reads only frontend contents at SHA; checks all three QA refs; mismatch fails closed',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'archify-git-test-'));const originalFetch=globalThis.fetch;const originalConfig=process.env.ARCHIFY_CONFIG;
  const sha='a'.repeat(40); const seen:string[]=[]; let mismatch=false;
  try {
    await writeFile(join(dir,'token'),'test-token');
    const repositories=['frontend','bff','backend'].map(role=>({role,url:`https://gitlab.example.test/team/${role}.git`,projectId:role,qaTag:'qa-test',tokenFile:join(dir,'token')}));
    const config=join(dir,'config.json');await writeFile(config,JSON.stringify({host:'https://gitlab.example.test',repositories}));process.env.ARCHIFY_CONFIG=config;
    globalThis.fetch=(async(input,init)=>{
      const url=String(input);seen.push(url);assert.equal((init?.headers as any)['PRIVATE-TOKEN'],'test-token');assert.equal(init?.redirect,'error');
      if(url.includes('/branches/'))return Response.json({commit:{id:sha}});
      if(url.includes('/tags/'))return Response.json({commit:{id:mismatch?'b'.repeat(40):sha}});
      if(url.includes('/tree?')){assert.ok(url.includes(`/frontend/`));assert.ok(url.includes(`ref=${sha}`));return Response.json([{type:'blob',path:'src/api.ts'}]);}
      if(url.includes('/files/'))return Response.json({content:Buffer.from("fetch('/health')").toString('base64')});
      throw new Error('Unexpected Git request');
    }) as typeof fetch;
    const project={repositoryUrl:repositories[0].url,bffRepositoryUrl:repositories[1].url,backendRepositoryUrl:repositories[2].url};
    const snapshot=await captureSources(project);assert.equal(snapshot.repositories.length,3);assert.equal(snapshot.files.length,1);assert.equal(snapshot.files[0].hash.length,64);assert.equal(snapshot.deploymentVerified,false);
    assert.equal(seen.some(url=>/\/(bff|backend)\/.*(files|tree)/.test(url)),false);
    mismatch=true;await assert.rejects(captureSources(project),/QA tag/);
    await assert.rejects(captureSources({...project,repositoryUrl:'https://evil.test/repo'}),/not allowed/);
  } finally {globalThis.fetch=originalFetch;if(originalConfig===undefined)delete process.env.ARCHIFY_CONFIG;else process.env.ARCHIFY_CONFIG=originalConfig;await rm(dir,{recursive:true,force:true});}
});
test('LLM source sharing requires explicit server opt-in and parses draft separately',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'archify-llm-test-'));const originalFetch=globalThis.fetch;const originalConfig=process.env.ARCHIFY_CONFIG;
  try {
    await writeFile(join(dir,'key'),'fake-key');const path=join(dir,'config');
    await writeFile(path,JSON.stringify({host:'https://gitlab.example.test',repositories:[],llm:{baseUrl:'https://llm.example.test/v1/',model:'test',keyFile:join(dir,'key'),allowSourceCode:false}}));process.env.ARCHIFY_CONFIG=path;
    await assert.rejects(askLLM([{role:'user',content:'explain'}],{source:'private'},true),/disabled/);
    globalThis.fetch=(async(_url,init)=>{const body=JSON.parse(String(init?.body));assert.equal(body.model,'test');assert.match(body.messages[0].content,/untrusted/);return Response.json({choices:[{message:{content:JSON.stringify({reply:'draft only',source:"test('smoke',()=>{})"})}}]});}) as typeof fetch;
    const answer=await askLLM([{role:'user',content:'draft'}],{runs:[]});assert.equal(answer.reply,'draft only');assert.ok(answer.source);
    globalThis.fetch=(async(_url,init)=>{const body=JSON.parse(String(init?.body));assert.match(body.messages[0].content,/Agent instruction: WORKFLOW_POLICY/);assert.match(body.messages[1].content,/UNTRUSTED_SOURCE/);assert.ok(!body.messages[0].content.includes('UNTRUSTED_SOURCE'));return Response.json({choices:[{message:{content:JSON.stringify({reply:'structured plan'})}}]});}) as typeof fetch;
    assert.equal((await askLLM([],{source:'UNTRUSTED_SOURCE'},false,null,false,'WORKFLOW_POLICY')).reply,'structured plan');
    const context={source:{part:1,files:[{source:'x'.repeat(120000)+'DEPENDENCY_END'}]}};
    globalThis.fetch=(async(_url,init)=>{const body=JSON.parse(String(init?.body));assert.ok(body.messages[1].content.endsWith('DEPENDENCY_END"}]}}'));return Response.json({choices:[{message:{content:JSON.stringify({reply:'complete evidence'})}}]});}) as typeof fetch;
    assert.equal((await askLLM([],context,false,null,true)).reply,'complete evidence');
    await assert.rejects(askLLM([],{source:'x'.repeat(220000)},false,null,true),/not truncated/);
    const longReply='分析'.repeat(15000);
    globalThis.fetch=(async()=>Response.json({choices:[{message:{content:JSON.stringify({reply:longReply,source:null})}}]})) as typeof fetch;
    assert.equal((await askLLM([],{runs:[]})).reply,longReply);
  } finally {globalThis.fetch=originalFetch;if(originalConfig===undefined)delete process.env.ARCHIFY_CONFIG;else process.env.ARCHIFY_CONFIG=originalConfig;await rm(dir,{recursive:true,force:true});}
});
test('readonly Git import accepts 10000 source files and rejects the next file without truncating',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'archify-git-limit-'));const originalFetch=globalThis.fetch;const originalConfig=process.env.ARCHIFY_CONFIG;
  const sha='c'.repeat(40);let count=10000;let downloaded=0;
  try {
    await writeFile(join(dir,'token'),'test-token');
    const repositories=['frontend','bff','backend'].map(role=>({role,url:`https://gitlab.example.test/team/${role}.git`,projectId:role,qaTag:'qa-test',tokenFile:join(dir,'token')}));
    const config=join(dir,'config.json');await writeFile(config,JSON.stringify({host:'https://gitlab.example.test',repositories}));process.env.ARCHIFY_CONFIG=config;
    globalThis.fetch=(async(input,init)=>{
      const url=new URL(String(input));assert.ok(!init?.method || init.method==='GET');
      if(url.pathname.includes('/branches/') || url.pathname.includes('/tags/'))return Response.json({commit:{id:sha}});
      if(url.pathname.endsWith('/tree')) {const start=(Number(url.searchParams.get('page'))-1)*100;return Response.json(Array.from({length:Math.max(0,Math.min(100,count-start))},(_,index)=>({type:'blob',path:`src/file-${start+index}.ts`})) );}
      if(url.pathname.includes('/files/')){downloaded++;assert.equal(url.searchParams.get('ref'),sha);assert.ok(url.pathname.includes('/frontend/'));return Response.json({content:Buffer.from('export {};').toString('base64')});}
      throw new Error('Unexpected request');
    }) as typeof fetch;
    const project={repositoryUrl:repositories[0].url,bffRepositoryUrl:repositories[1].url,backendRepositoryUrl:repositories[2].url};
    const snapshot=await captureSources(project);assert.equal(snapshot.files.length,10000);assert.equal(downloaded,10000);
    count=10001;downloaded=0;await assert.rejects(captureSources(project),/exceeds 10000 files/);assert.equal(downloaded,10000);
  }finally {globalThis.fetch=originalFetch;if(originalConfig===undefined)delete process.env.ARCHIFY_CONFIG;else process.env.ARCHIFY_CONFIG=originalConfig;await rm(dir,{recursive:true,force:true});}
});
