import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commandArgs, parseAnswer,runAgent } from '../../agents/adapter.mjs';
import {access} from 'node:fs/promises';
import limits from '../src/llmOutputLimits.json' with {type:'json'};
test('CLI commands keep prompts off command line and restrict tools',()=>{
  const codex=commandArgs('codex','/tmp/test');assert.ok(codex.includes('read-only'));assert.ok(codex.includes('--ignore-user-config'));assert.ok(codex.includes('shell_tool'));assert.ok(!codex.join(' ').includes('dangerously'));
  const claude=commandArgs('claude','/tmp/test');assert.equal(claude[claude.indexOf('--tools')+1],'');assert.ok(claude.includes('--strict-mcp-config'));
  const gemini=commandArgs('gemini','/tmp/test');assert.ok(gemini.includes('--admin-policy'));assert.ok(!gemini.includes('--yolo'));
  assert.throws(()=>commandArgs('bad','/tmp'),/Unknown/);
});
test('all three CLI result formats produce editable drafts, malformed output fails',()=>{
  const content=JSON.stringify({reply:'請檢查',source:'test source'});
  assert.equal(parseAnswer('codex','',content).source,'test source');
  assert.equal(parseAnswer('claude',JSON.stringify({result:content}),'').reply,'請檢查');
  assert.equal(parseAnswer('gemini',JSON.stringify({response:content}),'').reply,'請檢查');
  assert.throws(()=>parseAnswer('gemini',JSON.stringify({response:'not json'}),''));
});

test('all providers accept analysis replies larger than the former 20000-character limit',()=>{
 const reply='案例分析'.repeat(10000);assert.ok(reply.length>20000);
 const content=JSON.stringify({reply,source:null});
 assert.equal(parseAnswer('codex','',content).reply,reply);
 assert.equal(parseAnswer('claude',JSON.stringify({result:content}),'').reply,reply);
 assert.equal(parseAnswer('gemini',JSON.stringify({response:content}),'').reply,reply);
});

test('reply diagnostics distinguish size, missing fields, wrong types and incomplete JSON without source disclosure',()=>{
 assert.throws(()=>parseAnswer('codex','',JSON.stringify({reply:'x'.repeat(limits.replyCharacters+1)})),/MODEL_REPLY_LIMIT.*200001/);
 assert.throws(()=>parseAnswer('codex','',JSON.stringify({source:'private-source'})),/MODEL_REPLY_FORMAT.*undefined/);
 assert.throws(()=>parseAnswer('codex','',JSON.stringify({reply:[],source:null})),/MODEL_REPLY_FORMAT.*array/);
 assert.throws(()=>parseAnswer('codex','',JSON.stringify({reply:'ok',source:42})),/MODEL_SOURCE_FORMAT.*number/);
 assert.throws(()=>parseAnswer('codex','','{"reply":"private-source'),error=>error.message.startsWith('MODEL_REPLY_JSON:')&&!error.message.includes('private-source'));
 assert.throws(()=>parseAnswer('claude','private-source',''),error=>error.message.startsWith('CLI_ENVELOPE_JSON:')&&!error.message.includes('private-source'));
});

test('reported model comes only from outer CLI metadata, never generated model claims',()=>{
 const content=JSON.stringify({reply:'ok',source:null,model:'invented-by-model'});
 assert.equal(parseAnswer('codex','',content).reportedModel,undefined);
 assert.equal(parseAnswer('claude',JSON.stringify({result:content,modelUsage:{'claude-example':{inputTokens:1}}}),'').reportedModel,'claude-example');
 assert.equal(parseAnswer('gemini',JSON.stringify({response:content,stats:{models:{'gemini-example':{tokens:1}}}}),'').reportedModel,'gemini-example');
 assert.equal(parseAnswer('claude',JSON.stringify({result:content,modelUsage:{one:{},two:{}}}),'').reportedModel,undefined);
 assert.equal(parseAnswer('claude',JSON.stringify({result:content,model:'bad model; value'}),'').reportedModel,undefined);
});
test('Codex receives validated image files and removes them after the model call',async()=>{
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';
 const script=`const fs=require('node:fs');const args=process.argv;const image=args[args.indexOf('--image')+1];if(!fs.existsSync(image))process.exit(4);fs.writeFileSync(args[args.indexOf('--output-last-message')+1],JSON.stringify({reply:image,source:null}));process.stdin.resume();`;
 const result=await runAgent('codex','Observe screenshot',{executable:process.execPath,args:['-e',script,'--']},null,[png]);
 assert.match(result.reply,/screen-0\.png$/);await assert.rejects(access(result.reply));
 await assert.rejects(runAgent('codex','test',{executable:process.execPath,args:[]},null,['not-image']),/Invalid image/);
 await assert.rejects(runAgent('claude','test',{executable:process.execPath,args:[]},null,[png]),/does not support/);
});
