import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sourceAnalysisParts,selectApiSources} from '../src/apiAnalysis.ts';
import {apiCaseStatus,missingDetails} from '../src/apiCaseModel.ts';
import {parseAnswer} from '../../agents/adapter.mjs';
const {parseApiCases}=await import(new URL('../../../apps/web/src/features/testing/apiCaseModel.ts',import.meta.url).href);
test('analysis parts preserve every source character with path and line evidence',()=>{
 const source=('query Example { id }\n').repeat(5000);const parts=sourceAnalysisParts([{path:'src/operations.graphql',source},{path:'src/button.css',source:'ignore'}]);
 assert.ok(parts.length>1);assert.equal(parts.flat().map(file=>file.source).join(''),source);assert.equal(parts[0][0].startLine,1);assert.equal(parts[1][0].path,'src/operations.graphql');assert.equal(parts[1][0].continued,true);
});
test('API case reply validation rejects malformed cases and keeps GraphQL evidence and missing data',()=>{
 assert.throws(()=>parseApiCases('not json'));assert.throws(()=>parseApiCases('[{"name":"fake"}]'));
 const result=parseApiCases(JSON.stringify([{name:'AcceptAllRequests',method:'POST',endpoint:'',operationName:'AcceptAllRequests',requestBody:'{}',variables:'{}',authReference:'',preconditions:'需有邀請資料',assertions:'檢查 GraphQL errors',missing:'網址與認證未知',evidence:'src/api.ts:12'}]));
 assert.equal(result[0].endpoint,'');assert.equal(result[0].operationName,'AcceptAllRequests');assert.ok(result[0].missing);assert.equal(result[0].evidence,'src/api.ts:12');
});

test('a batch of 27 full API cases survives CLI parsing and case validation without truncation',()=>{
 const cases=Array.from({length:27},(_,index)=>({name:`Operation ${index}`,method:'POST',endpoint:'/graphql',operationName:`Operation${index}`,requestBody:JSON.stringify({query:'mutation Example { result }',example:'x'.repeat(900)}),variables:'{}',authReference:'test-session',preconditions:'測試資料待確認',assertions:'建議檢查 GraphQL errors',missing:'【測試設定】測試帳號',evidence:`src/operation${index}.ts:1`}));
 const reply=JSON.stringify(cases);assert.ok(reply.length>20000);
 const answer=parseAnswer('codex','',JSON.stringify({reply,source:null}));
 assert.equal(parseApiCases(answer.reply).length,27);assert.equal(answer.reply,reply);
});
test('API selection follows aliases, reexports, client, constants and types without uploading unrelated UI',()=>{
 const files=[
 {path:'repo/tsconfig.json',source:JSON.stringify({compilerOptions:{baseUrl:'.',paths:{'@/*':['src/*']}}})},
 {path:'repo/src/api/accept.ts',source:`import {client} from '@/services';\nimport {BODY,Unused} from '../constants';\nimport type {Reply} from '../types';\nexport async function accept(){return client.post<Reply>('/graphql',BODY);}\nexport const irrelevant='DO_NOT_SEND';`},
 {path:'repo/src/services/index.ts',source:`export {client} from './client';`},
 {path:'repo/src/services/client.ts',source:`import axios from 'axios';\nimport {BASE} from '../env';\nexport const client=axios.create({baseURL:BASE});\nclient.interceptors.response.use(x=>x);`},
 {path:'repo/src/constants.ts',source:`export const BODY={query:'mutation AcceptAllRequests { acceptAllRequests }',operationName:'AcceptAllRequests'};\nexport const Unused='UNUSED_CONSTANT';`},
 {path:'repo/src/env.ts',source:`export const BASE='/api';\nexport const COLOR='DO_NOT_SEND_COLOR';`},
 {path:'repo/src/types.ts',source:`export interface Reply {data:{acceptAllRequests:number}}\nexport interface Unrelated {color:string}`},
 {path:'repo/src/components/BigPage.tsx',source:`export function BigPage(){return <p>DO_NOT_SEND_PAGE</p>}`},
 {path:'repo/src/components/Comments.ts',source:`// fetch('/not-real')\nexport const message='fetch is described here';`},
 ];
 const selection=selectApiSources(files);const text=selection.snippets.map(item=>item.source).join('\n');
 for(const expected of ['client.post<Reply>','baseURL:BASE',"BASE='/api'",'interface Reply','mutation AcceptAllRequests','interceptors.response'])assert.ok(text.includes(expected),expected);
 for(const ignored of ['DO_NOT_SEND_PAGE','DO_NOT_SEND_COLOR',"export const Unused=",'interface Unrelated',"fetch('/not-real')"])assert.ok(!text.includes(ignored),ignored);
 assert.equal(selection.unresolved.length,0);assert.ok(selection.selectedCharacters<selection.totalCharacters);
 const parts=sourceAnalysisParts(files);assert.equal(parts.length,1);assert.ok(parts[0].some(item=>item.path.endsWith('accept.ts')) && parts[0].some(item=>item.path.endsWith('env.ts')));
});
test('missing aliases are reported and no API evidence does not fall back to whole project',()=>{
 const selection=selectApiSources([{path:'src/api.ts',source:`import {client} from '@/missing/client'; export const call=()=>client.post('/x');`}]);
 assert.ok(selection.unresolved.some(item=>item.includes('@/missing/client')));
 assert.equal(sourceAnalysisParts([{path:'src/Page.tsx',source:'export const Page=()=> <h1>hello</h1>'}]).length,0);
});

test('every independent batch includes shared client dependencies',()=>{
 const files=[{path:'src/client.ts',source:`export const client={post:(path:string)=>path};`},
  ...Array.from({length:7},(_,index)=>({path:`src/api${index}.ts`,source:`import {client} from './client'; export function call${index}(){const note=${JSON.stringify('x'.repeat(10000))}; return client.post('/api/${index}');}`}))];
 const parts=sourceAnalysisParts(files);assert.ok(parts.length>1);
 for(const part of parts)if(part.some(item=>item.source.includes('client.post(')))assert.ok(part.some(item=>item.path==='src/client.ts'),'each request batch needs its own client');
});

test('root aliases and inherited aliases resolve with JS extension substitution and GraphQL assets',()=>{
 const files=[
  {path:'tsconfig.json',source:JSON.stringify({extends:'./config/tsconfig.base.json'})},
  {path:'config/tsconfig.base.json',source:JSON.stringify({compilerOptions:{baseUrl:'..',paths:{'@/*':['app/*']}}})},
  {path:'app/api.ts',source:`import {client} from '@/client.js'; import document from '@/query.graphql'; export const run=()=>client.post('/graphql',document);`},
  {path:'app/client.ts',source:`export const client={post:(...args:unknown[])=>args};`},
  {path:'app/query.graphql',source:'query Report { report { id } }'},
 ];
 const selection=selectApiSources(files);
 assert.deepEqual(selection.unresolved,[]);
 const part=sourceAnalysisParts(files).find(part=>part.some(item=>item.path==='app/api.ts'))!;
 assert.ok(part.some(item=>item.path==='app/client.ts'));assert.ok(part.some(item=>item.path==='app/query.graphql'));
});

test('oversized dependency closures fail explicitly instead of sending incomplete requests',()=>{
 const files=[{path:'src/api.ts',source:`import {client} from './client'; export const call=()=>client.post('/x',${JSON.stringify('x'.repeat(170000))});`},
  {path:'src/client.ts',source:'export const client={post:(...args:unknown[])=>args};'}];
 assert.throws(()=>sourceAnalysisParts(files),/未拆散依賴/);
});

test('larger dependency closures stay together rather than losing the client after a size boundary',()=>{
 const files=[{path:'src/api.ts',source:`import {client} from './client'; import {A,B,C} from './payload'; export const call=()=>client.post('/x',[A,B,C]);`},
  {path:'src/client.ts',source:'export const client={post:(...args:unknown[])=>args};'},
  {path:'src/payload.ts',source:['A','B','C'].map(name=>`export const ${name}=${JSON.stringify(name.repeat(35000))};`).join('\n')}];
 const parts=sourceAnalysisParts(files);const part=parts.find(part=>part.some(item=>item.path==='src/api.ts'))!;
 assert.ok(JSON.stringify(part).length>100000);
 assert.ok(part.some(item=>item.path==='src/client.ts'));
 for(const name of ['A','B','C'])assert.ok(part.some(item=>item.source.includes(`export const ${name}=`)));
});

test('unavailable config inheritance is reported without accessing host files',()=>{
 const selection=selectApiSources([{path:'tsconfig.json',source:'{"extends":"./missing.json"}'},{path:'app/api.ts',source:`import {client} from '@/client'; client.post('/x');`}]);
 assert.ok(selection.unresolved.some(item=>item.includes('missing.json')));
 assert.ok(selection.unresolved.some(item=>item.includes('@/client')));
});

test('missing descriptions distinguish source issues, settings and behavior without marking drafts validated',()=>{
 for(const value of ['', '無', 'None.', '不需認證']){assert.equal(missingDetails(value),'');assert.equal(apiCaseStatus(value),'草稿，待驗證');}
 assert.equal(apiCaseStatus('缺 @/services/graphql/mutations/reportFrontendError 實作、alias 設定'),'來源待解析');
 assert.equal(apiCaseStatus('【測試設定】提供 staging 網址'),'待補測試設定');
 assert.equal(apiCaseStatus('【行為確認】remoteReport 是否啟用'),'待確認呼叫行為');
 assert.equal(apiCaseStatus('不需認證，但缺測試網址'),'待確認，展開查看原因');
});
