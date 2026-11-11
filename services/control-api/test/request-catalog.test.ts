import test from 'node:test';
import assert from 'node:assert/strict';
import {extractRequests,diffRequests,affectedCases,inferredScriptImpacts} from '../src/requestCatalog.ts';
import type {SavedApiCase} from '../src/apiContracts.ts';

test('catalog extracts fetch, axios config, imported clients, GraphQL and source evidence without executing source',()=>{
 const files=[{path:'repo/tsconfig.json',source:'{"compilerOptions":{"paths":{"@/*":["src/*"]}}}'},
  {path:'repo/src/client.ts',source:`import axios from 'axios'; export const client=axios.create({baseURL:'https://api.example.test/v1',headers:{'Content-Type':'application/json'}});`},
  {path:'repo/src/api.ts',source:`import {client} from '@/client';
   export async function getUsers(id:string){return fetch(\`/users/\${id}\`,{method:'POST',headers:{satoken:'do-not-export'},body:JSON.stringify({id})});}
   export const create=()=>client.post('/items',{name:'demo'});
   export const update=()=>axios({url:'/items/1',method:'patch',data:{enabled:true}});
   const q=\`query Items($id: ID!) { item(id:$id) { id name } }\`;
   globalThis.untrustedSourceExecuted=true;
  `}];
 const result=extractRequests(files);
 assert.equal((globalThis as any).untrustedSourceExecuted,undefined);
 const fetch=result.requests.find(item=>item.name.startsWith('getUsers'))!;
 assert.equal(fetch.method,'POST');assert.equal(fetch.endpoint,'/users/{{id}}');assert.ok(fetch.body.includes('{{id}}'));assert.ok(!JSON.stringify(fetch.headers).includes('do-not-export'));
 assert.equal(result.requests.find(item=>item.name.startsWith('create'))?.endpoint,'https://api.example.test/v1/items');
 assert.equal(result.requests.find(item=>item.name.startsWith('update'))?.method,'PATCH');
 const graphql=result.requests.find(item=>item.operationName==='Items')!;
 assert.equal(graphql.kind,'graphql');assert.match(graphql.parameterTypes,/\$id: ID!/);assert.ok(graphql.evidence[0].line>1);
});

test('aliases and GraphQL fragment imports preserve the document required by a request',()=>{
 const result=extractRequests([{path:'src/fragment.gql',source:'fragment Fields on Item { id }'},
  {path:'src/api.ts',source:"import fragment from './fragment.gql'; const query=gql`query List { items { ...Fields } } ${fragment}`;"}]);
 const request=result.requests.find(item=>item.operationName==='List')!;assert.ok(request.body.includes('fragment Fields'));
});

test('collection and URLSearchParams methods are not HTTP requests; root folder names do not change source identities',()=>{
 const source=`const cache=new Map();cache.get('id');cache.delete('key');const params=new URLSearchParams();params.get('mode');headers.delete('satoken');fetch('/items');`;
 const first=extractRequests([{path:'src/api.ts',source}]).requests;
 const next=extractRequests([{path:'new-version/src/api.ts',source},{path:'new-version/tsconfig.json',source:'{}'}]).requests;
 assert.equal(first.length,1);assert.equal(first[0].id,next[0].id);assert.equal(first[0].evidence[0].path,'src/api.ts');
});

test('version diff distinguishes unchanged definitions, parameter changes, additions, removals and implementation changes',()=>{
 const base=[{path:'src/api.ts',source:`export const query='query Item($id: ID!) { item(id:$id) { id } }'; export const gone=()=>fetch('/old');`}];
 const before=extractRequests(base).requests;assert.equal(diffRequests(before,extractRequests(base).requests).length,0);
 const after=extractRequests([{path:'src/api.ts',source:`export const query='query Item($id: Int!) { item(id:$id) { id } }'; export const newOne=()=>fetch('/new');`}]).requests;
 const changes=diffRequests(before,after);assert.ok(changes.some(item=>item.kind==='added'));assert.ok(changes.some(item=>item.kind==='removed'));
 const changed=changes.find(item=>item.name==='Item')!;assert.ok(changed.details.includes('參數型別變更'));assert.ok(changed.fields?.some(item=>item.before.includes('ID!')&&item.after.includes('Int!')));
 const comments=extractRequests([{path:'src/api.ts',source:base[0].source+'\n// implementation context changed'}]).requests;
 assert.ok(diffRequests(before,comments).every(item=>item.details.some(text=>text.includes('實作檔案'))));
});

test('impact tracing identifies linked script steps and flows without crossing project boundaries',()=>{
 const cases=[{id:'case',projectId:'p',requestId:'request',name:'Case',scriptLinks:[{scriptId:'script',step:'登入後查詢'}]}] as SavedApiCase[];
 const changes=[{requestId:'request',name:'Request',kind:'changed' as const,details:['參數變更']}];
 const impacts=affectedCases(changes,cases,[{id:'script',name:'登入流程',version:4}],[{id:'flow',projectId:'p',name:'Smoke',steps:[{caseId:'case',snapshot:{name:'查詢'}}]},{id:'other',projectId:'q',steps:[{caseId:'case'}]}]);
 assert.equal(impacts.length,1);assert.equal(impacts[0].scripts[0].step,'登入後查詢');assert.equal(impacts[0].scripts[0].version,4);assert.equal(impacts[0].flows.length,1);
 const flowImpacts=affectedCases(changes,cases,[{id:'api-flow',name:'API 流程',version:1,apiFlow:{projectId:'p',cases:[{id:'case',version:2}]}},{id:'other-flow',name:'其他專案',apiFlow:{projectId:'q',cases:[{id:'case'}]}}],[]);assert.ok(flowImpacts[0].scripts.some(item=>item.id==='api-flow'));assert.ok(!flowImpacts[0].scripts.some(item=>item.id==='other-flow'));
});

test('script inference locates a named step, ignores comments and labels evidence as potential impact',()=>{
 const definition=extractRequests([{path:'src/query.ts',source:`const query='query Item { item { id } }';`}]).requests[0];
 const changes=[{requestId:definition.id,name:'Item',kind:'changed' as const,details:['請求變更']}];
 const impacts=inferredScriptImpacts('p',changes,[definition],[{id:'script',name:'Smoke',version:1,source:`test.step('取得商品',async()=>{await request.post('/graphql',{data:{operationName:'Item'}})});`},{id:'comment',source:`// query Item { item { id } }`}],[]);
 assert.equal(impacts.length,1);assert.equal(impacts[0].scripts[0].step,'取得商品');assert.equal(impacts[0].inferred,true);
});

test('frontend usages trace imported wrappers and list different parameters for the same GraphQL root field',()=>{
 const result=extractRequests([
  {path:'src/api.ts',source:`const short='query Short($id: ID!) { item(id:$id) { id } }';const full='query Full($id: ID!, $limit: Int) { item(id:$id,limit:$limit) { id name } }';export async function findShort(variables:any){return graphQLClient.post('/graphql',{query:short,variables});}export const findFull=(variables:any)=>graphQLClient.post('/graphql',{query:full,variables});`},
  {path:'src/barrel.ts',source:`export {findShort,findFull} from './api';`},
  {path:'src/index.ts',source:`export * from './barrel';`},
  {path:'src/page.ts',source:`import {findShort as load,findFull} from './index';import * as All from './barrel';export async function PageA(){return load({id:'one'});}export async function PageB(){return findFull({id:'two',limit:3});}export function PageC(){return All.findShort({id:'three'});}`}
 ]);
 const short=result.requests.find(item=>item.operationName==='Short')!;const full=result.requests.find(item=>item.operationName==='Full')!;
 assert.equal(short.family,full.family);assert.ok(short.sourceRequest?.body.includes('query Short'));assert.ok(full.sourceRequest?.body.includes('name'));
 const one=short.usages?.find(item=>item.caller==='PageA')!;const two=full.usages?.find(item=>item.caller==='PageB')!;
 assert.deepEqual(Object.keys(one.parameters),['id']);assert.deepEqual(Object.keys(two.parameters),['id','limit']);assert.equal(two.parameters.limit,'3');assert.equal(one.path,'src/page.ts');assert.equal(one.scope,'caller');assert.ok(short.usages?.some(item=>item.scope==='transport'&&item.notes.length));
 assert.equal(short.usages?.find(item=>item.caller==='PageC')?.parameters.id,'three');
});

test('same-name documents with different selections in one file are retained as separate frontend variants',()=>{
 const result=extractRequests([{path:'src/api.ts',source:`const short='query Card($id: ID!) { card(id:$id) { id } }';const full='query Card($id: ID!, $locale: String) { card(id:$id,locale:$locale) { id name } }';`}]);
 assert.equal(result.requests.length,2);assert.notEqual(result.requests[0].id,result.requests[1].id);assert.equal(result.requests[0].family,result.requests[1].family);assert.ok(result.requests[1].parameterTypes.includes('locale'));
});

test('object wrapper arguments retain GraphQL input nesting for different frontend parameter sets',()=>{
 const result=extractRequests([{path:'src/api.ts',source:`const query='query Item($input: ItemInput!) { item(input:$input) { id } }';export function find(input:any){return graphQLClient.post('/graphql',{query,variables:{input}});}`},{path:'src/page.ts',source:`import {find} from './api';export function PageA(){return find({id:'one'});}export function PageB(){return find({id:'two',limit:3});}`}]);
 const item=result.requests[0];assert.deepEqual(item.usages?.find(value=>value.caller==='PageA')?.variables,{input:{id:'one'}});assert.deepEqual(item.usages?.find(value=>value.caller==='PageB')?.variables,{input:{id:'two',limit:3}});
});

test('login variables follow multiple wrapper layers and retain constants beside dynamic scopeId',()=>{
 const result=extractRequests([
  {path:'src/api.ts',source:`const query='mutation LoginWithToken($request: TokenLoginInput!) { loginWithToken(request:$request) { token } }';export function login(request:any){return graphQLClient.post('/graphql',{query,variables:{request}});}`},
  {path:'src/auth.ts',source:`import {login} from './api';export function lineLogin(scopeId:string){return login({scopeId,thirdChannel:'Line',useNonMobile:true});}`},
  {path:'src/page.ts',source:`import {lineLogin} from './auth';export function enter(lineId:string){return lineLogin(lineId);}`}
 ]);
 const item=result.requests.find(value=>value.kind==='graphql')!;
 assert.deepEqual(item.usages?.find(value=>value.caller==='enter')?.variables,{request:{scopeId:'{{lineId}}',thirdChannel:'Line',useNonMobile:true}});
});

test('caller bindings apply nullish defaults, preserve false and zero, and include known conditional spreads',()=>{
 const result=extractRequests([
  {path:'src/config.ts',source:`export const config={channel:import.meta.env.VITE_CHANNEL || 'Line'};`},
  {path:'src/api.ts',source:`import {config} from './config';const query='mutation Login($request: LoginInput!) { login(request:$request) }';export function login(input:any){const body={query,variables:{request:{scopeId:input.scopeId,channel:input.channel ?? config.channel,enabled:input.enabled ?? true,count:input.count ?? 9,label:input.label || 'default',...(input.mobile && {mobile:input.mobile})}}};return client.post('/graphql',body);}`},
  {path:'src/page.ts',source:`import {login} from './api';export function normal(id:string){return login({scopeId:id});}export function override(){return login({scopeId:'id',channel:'Other',enabled:false,count:0,label:'',mobile:'test'});}`}
 ]);
 const item=result.requests.find(value=>value.kind==='graphql')!;
 assert.deepEqual(item.usages?.find(value=>value.caller==='normal')?.variables,{request:{scopeId:'{{id}}',channel:'Line',enabled:true,count:9,label:'default'}});
 assert.deepEqual(item.usages?.find(value=>value.caller==='override')?.variables,{request:{scopeId:'id',channel:'Other',enabled:false,count:0,label:'default',mobile:'test'}});
});
