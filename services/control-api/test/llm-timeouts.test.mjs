import test from 'node:test';
import assert from 'node:assert/strict';
import {runAgent} from '../../agents/adapter.mjs';
import limits from '../src/llmTimeouts.json' with {type:'json'};

test('outer waits cover ten minutes of model work plus result delivery and queue time',()=>{
 assert.equal(limits.cliMs,10*60*1000);
 assert.ok(limits.leaseSeconds*1000>=limits.cliMs+30000);
 assert.ok(limits.serverMs>=limits.leaseSeconds*1000+60000);
 assert.ok(limits.browserMs>=limits.serverMs+30000);
});

test('CLI enforces the ten-minute budget and reports timeout independently of authentication',async()=>{
 const original=globalThis.setTimeout;const budgets=[];
 try{
  globalThis.setTimeout=(callback,ms,...args)=>{budgets.push(ms);return original(callback,1,...args);};
  await assert.rejects(runAgent('codex','test input',{
   executable:process.execPath,args:['-e','process.stdin.resume();setInterval(()=>{},1000);','--'],
  }),error=>error.message.includes('CLI_TIMEOUT')&&error.message.includes('10 分鐘')&&!error.message.includes('CLI_AUTH'));
  assert.deepEqual(budgets,[10*60*1000]);
 }finally{globalThis.setTimeout=original;}
});
