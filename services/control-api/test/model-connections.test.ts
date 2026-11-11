import {test} from 'node:test';import assert from 'node:assert/strict';
import {connectionsSchema,resolveConnection,legacyConnections,connectionFingerprint,connectionHealth} from '../src/modelConnections.ts';
const first={id:'one',name:'API model',provider:'codex' as const,agentId:'api-analyst',model:'model-one',enabled:true};
const second={...first,id:'two',name:'Debug model',agentId:'debug',provider:'claude' as const,model:'model-two'};
const agent={id:'api-analyst',instructions:'facts only',model:'使用預設模型'};
test('connection routing selects explicit profile, isolates roles and refuses ambiguous/disabled profiles',()=>{
 assert.equal(resolveConnection([first,second],'two','debug').model,'model-two');assert.equal(resolveConnection([first,second],undefined,'api-analyst').id,'one');
 assert.throws(()=>resolveConnection([first,second],'two','api-analyst'),/其他 Agent/);
 assert.throws(()=>resolveConnection([first,{...first,id:'three'}],undefined,'api-analyst'),/多個/);
 assert.throws(()=>resolveConnection([{...first,enabled:false}],'one'),/找不到/);
 assert.equal(legacyConnections({provider:'codex',agentId:'debug'})[0].agentId,'debug');
});
test('model profiles reject secrets/unexpected fields, duplicate IDs and invalid model identifiers',()=>{
 assert.equal(connectionsSchema.safeParse([first,second]).success,true);
 assert.equal(connectionsSchema.safeParse([first,{...first}]).success,false);
 assert.equal(connectionsSchema.safeParse([{...first,apiKey:'secret'}]).success,false);
 assert.equal(connectionsSchema.safeParse([{...first,model:'model; shell'}]).success,false);
});
test('green state requires recent actual model success for the exact configuration and a fresh bridge',()=>{
 const now=Date.now();const check={fingerprint:connectionFingerprint(first,agent),status:'passed',checked_at:new Date(now).toISOString(),started_at:new Date(now).toISOString()};
 assert.equal(connectionHealth(first,agent,true,true,null,now).state,'unknown');
 assert.equal(connectionHealth(first,agent,true,true,check,now).state,'passed');
 assert.equal(connectionHealth(first,agent,false,true,check,now).state,'failed');
 assert.equal(connectionHealth(first,agent,true,false,check,now).state,'failed');
 assert.equal(connectionHealth({...first,model:'changed'},agent,true,true,check,now).state,'unknown');
 assert.equal(connectionHealth(first,{...agent,instructions:'changed'},true,true,check,now).state,'unknown');
 assert.equal(connectionHealth(first,agent,true,true,check,now+16*60*1000).state,'unknown');
 assert.equal(connectionHealth({...first,enabled:false},agent,true,true,check,now).state,'disabled');
 assert.equal(connectionHealth(first,agent,true,true,{...check,status:'checking'},now).state,'checking');
});

test('agents inherit the global transport, overrides win without role loss, and invalid overrides never fall back',async()=>{
 const {resolveAgentConnection}=await import('../src/modelConnections.ts');
 const profiles=[{...first,globalDefault:true},second];const roles=[{id:'planner',instructions:'plan only'},{id:'api-analyst',instructions:'API only'},{id:'debug',instructions:'debug only',modelProvider:'claude',modelConnectionId:'two'}];
 assert.equal(resolveAgentConnection(profiles,roles,'planner').id,'one');assert.equal(resolveAgentConnection(profiles,roles,'api-analyst').id,'one');assert.equal(resolveAgentConnection(profiles,roles,'debug').id,'two');assert.equal(roles[0].instructions,'plan only');
 assert.throws(()=>resolveAgentConnection([{...first,globalDefault:true},{...second,enabled:false}],roles,'debug'),/不可用/);
 assert.throws(()=>resolveAgentConnection([first],roles,'debug'),/不可用/);assert.throws(()=>resolveAgentConnection(profiles,roles,'debug','one'),/已變更/);
 assert.throws(()=>resolveAgentConnection(profiles,[{id:'planner',modelProvider:'gemini'}],'planner'),/未設定/);
 assert.equal(resolveAgentConnection([first],roles,'planner').id,'one','a single legacy connection is a usable implicit global default');
 assert.throws(()=>resolveAgentConnection([first,second],roles,'planner'),/全域/);
 assert.equal(connectionFingerprint({...first,globalDefault:true},roles[0]),connectionFingerprint({...first,globalDefault:false},roles[0]),'changing default selection does not invalidate an already pinned transport');
 assert.equal(resolveAgentConnection([{...first,globalDefault:false},{...second,globalDefault:true}],roles,'planner','one').id,'one','a queued analysis may retain its pinned connection');
 assert.equal(connectionsSchema.safeParse([{...first,globalDefault:true},{...second,globalDefault:true}]).success,false);assert.equal(connectionsSchema.safeParse([{...first,globalDefault:true,enabled:false}]).success,false);
});
