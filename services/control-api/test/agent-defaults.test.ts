import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultAgents,upgradeBuiltinAgents} from '../src/agentDefaults.ts';
test('builtin prompt upgrade preserves model/custom agents and does not overwrite subsequent edits or resurrect deleted agents',()=>{
 const original=[{...defaultAgents[0],instructions:'old prompt',model:'custom-model',promptRevision:1},{id:'mine',name:'自訂',description:'自訂',instructions:'keep',model:'custom'}];
 const next=upgradeBuiltinAgents(original);assert.equal(next.length,2);assert.equal(next[0].model,'custom-model');assert.equal(next[0].instructions,defaultAgents[0].instructions);assert.equal(next[1].instructions,'keep');
 next[0].instructions='human edit';assert.equal(upgradeBuiltinAgents(next)[0].instructions,'human edit');
 assert.equal(upgradeBuiltinAgents([]).length,0);
});
