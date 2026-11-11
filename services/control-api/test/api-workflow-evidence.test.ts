import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowEvidence} from '../src/apiWorkflowEvidence.ts';
import {importSchema} from '../src/requestTransport.ts';
import {validateWorkflowPlan,workflowInstruction} from '../src/apiWorkflow.ts';
import {editableRequestSchema} from '../src/requestTransport.ts';

test('workflow evidence follows aliases, type imports, callers and consumed response fields with exact source lines',()=>{
 const files=[{path:'tsconfig.json',source:'{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}'},{path:'src/api/login.ts',source:'import type {TokenLoginInput} from "@/types"; export function login(input:TokenLoginInput){return client.post("/graphql",input)}'},{path:'src/types.ts',source:'export type TokenLoginInput={scopeId:string};'},{path:'src/auth.ts',source:'import {login} from "@/api/login"; export async function enter(){const result=await login({scopeId:"test"});store(result.data.loginWithToken.token);}'},{path:'src/unrelated.ts',source:'export const notRelated=true;'}];
 const schema=importSchema('input TokenLoginInput { scopeId: ID! device: DeviceInput } input DeviceInput { name: String } type Query { ok: Boolean } type Mutation { loginWithToken(input:TokenLoginInput!): String }');
 const request:any={name:'Login',operationName:'Login',evidence:[{path:'src/api/login.ts',line:1}],usages:[],body:'{"query":"mutation Login($input:TokenLoginInput!) { loginWithToken(input:$input) }"}'};
 const evidence=workflowEvidence(files,[request],schema);
 assert.deepEqual(new Set(evidence.sources.map(item=>item.path)),new Set(['src/api/login.ts','src/types.ts','src/auth.ts']));
 assert.ok(evidence.sources.some(item=>item.source.includes('loginWithToken.token')));assert.ok(evidence.sources.every(item=>item.startLine===1));
 assert.ok(evidence.schema.inputTypes.some(item=>item.includes('scopeId: ID!')));assert.ok(evidence.schema.inputTypes.some(item=>item.includes('input DeviceInput')));
 assert.match(workflowInstruction,/pendingChecks/);assert.match(workflowInstruction,/沒有密碼欄位/);
});

test('unknown error contract can be saved as a pending negative draft but can never be executed',()=>{
 const request=editableRequestSchema.parse({environmentId:'dev',method:'POST',endpoint:'{{BASE_URL}}',body:'{"query":"query Item { item }"}',operationName:'Item',expectedGraphqlErrors:true});
 const source:any={requests:[{id:'r',method:'POST',endpoint:request.endpoint,kind:'graphql',body:request.body,operationName:'Item'}]};
 const step={requestId:'r',name:'缺少輸入欄位',scenario:'negative',request,save:'always',execute:false,pendingChecks:['待取得錯誤代碼並設定斷言']};
 assert.equal(validateWorkflowPlan({reply:'建立草稿',steps:[step]},source,'dev',['r']).steps.length,1);
 assert.throws(()=>validateWorkflowPlan({reply:'執行',steps:[{...step,execute:true}]},source,'dev',['r']),/草稿不能執行/);
 assert.throws(()=>validateWorkflowPlan({reply:'建立',steps:[{...step,pendingChecks:[]}]},source,'dev',['r']),/缺少錯誤斷言/);
});
