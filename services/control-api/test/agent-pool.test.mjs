import {test} from 'node:test';import assert from 'node:assert/strict';import {runWorkerPool,workerCount} from '../../agents/pool.mjs';
test('bridge workers start concurrently with a bounded capacity',async()=>{
 assert.equal(workerCount(undefined),3);assert.equal(workerCount(100),4);assert.equal(workerCount(-1),3);
 let active=0;let peak=0;const ids=[];
 await runWorkerPool(3,async index=>{active++;peak=Math.max(peak,active);ids.push(index);await new Promise(resolve=>setTimeout(resolve,10));active--;});
 assert.equal(peak,3);assert.deepEqual(ids,[0,1,2]);assert.equal(active,0);
});
