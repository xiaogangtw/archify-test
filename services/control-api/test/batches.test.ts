import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { batchSchema } from '../src/model.ts';
test('batch requests require saved versions and unique cases, preserving selection order',()=>{
  const scripts=[{scriptId:'second',scriptVersion:3},{scriptId:'first',scriptVersion:1}];
  assert.deepEqual(batchSchema.parse({requestId:randomUUID(),scripts}).scripts,scripts);
  assert.equal(batchSchema.safeParse({requestId:randomUUID(),scripts:[]}).success,false);
  assert.equal(batchSchema.safeParse({requestId:randomUUID(),scripts:[scripts[0],scripts[0]]}).success,false);
  assert.equal(batchSchema.safeParse({requestId:randomUUID(),scripts:[{scriptId:'draft',scriptVersion:0}]}).success,false);
  assert.equal(batchSchema.safeParse({requestId:randomUUID(),scripts:Array.from({length:51},(_,i)=>({scriptId:String(i),scriptVersion:1}))}).success,false);
});

test('manual commit references are optional, validate full SHAs and preserve each role',()=>{
 const base={requestId:randomUUID(),scripts:[{scriptId:'case',scriptVersion:1}]};
 const manualCommits={frontend:'a'.repeat(40),bff:'B'.repeat(40),backend:'c'.repeat(40)};
 assert.deepEqual(batchSchema.parse({...base,manualCommits}).manualCommits,manualCommits);
 assert.equal(batchSchema.parse(base).manualCommits,undefined);
 assert.deepEqual(batchSchema.parse({...base,manualCommits:{frontend:manualCommits.frontend}}).manualCommits,{frontend:manualCommits.frontend});
 for(const value of ['abc1234','release','g'.repeat(40),'a'.repeat(41)])assert.equal(batchSchema.safeParse({...base,manualCommits:{frontend:value}}).success,false);
});
