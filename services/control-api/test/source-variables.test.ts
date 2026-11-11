import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceVariables} from '../src/requestSourceVariables.ts';
import type {RequestDefinition,RequestUsage} from '../src/apiContracts.ts';
const usage=(scopeId:string,thirdChannel='Line'):RequestUsage=>({path:'login.ts',line:1,caller:'login',scope:'caller',parameters:{},variables:{request:{scopeId,thirdChannel,useNonMobile:true}},notes:[]});
const item=(usages:RequestUsage[])=>({variables:'{}',usages} as RequestDefinition);
test('frontend variables preserve nested fixed strings and booleans beside dynamic fields',()=>{
 const source=item([usage('{{lineId}}')]);
 assert.deepEqual(sourceVariables(source),{request:{scopeId:'{{lineId}}',thirdChannel:'Line',useNonMobile:true}});
 assert.deepEqual(sourceVariables(source,source.usages![0]),sourceVariables(source));
});
test('different frontend callers keep common fields without choosing conflicting values',()=>{
 const source=item([usage('{{lineId}}'),usage('{{otherId}}')]);
 assert.deepEqual(sourceVariables(source),{request:{scopeId:'{{request.scopeId}}',thirdChannel:'Line',useNonMobile:true}});
 assert.equal((sourceVariables(item([usage('one'),usage('two','Other')])).request as any).thirdChannel,'{{request.thirdChannel}}');
});
test('source secrets stay references and missing source never invents inputs',()=>{
 const source=item([{...usage('id'),variables:{request:{token:'秘密參照',useNonMobile:false}}}]);
 assert.deepEqual(sourceVariables(source),{request:{token:'{{request.token}}',useNonMobile:false}});
 assert.deepEqual(sourceVariables(item([])),{});
});
