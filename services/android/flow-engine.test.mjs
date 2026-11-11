import test from 'node:test';
import assert from 'node:assert/strict';
import { executeFlow } from './flow-engine.mjs';
import { flowSchema, parseFlow } from './flow-contract.mjs';

const foreground = { name: '確認前景', action: 'assertAppForeground', timeoutMs: 0 };
const visible = value => ({ kind: 'visible', using: 'id', value });
const click = value => ({ name: '點擊 ' + value, action: 'click', using: 'id', value, timeoutMs: 0 });

test('scroll search shares one timeout across swipes and preserves failure path',async()=>{
 const f=fixture({},path=>path.endsWith('/window/rect')?{width:400,height:800}:undefined);
 const result=await f.run({steps:[{name:'尋找完善資料',action:'scrollUntilVisible',using:'id',value:'missing',direction:'up',maxSwipes:10,timeoutMs:2500},foreground]});
 assert.equal(result.status,'failed');assert.match(result.message,/尋找完善資料.*時間上限/);
 assert.equal(result.trace[0].durationMs,2500);
 assert.equal(f.calls.filter(c=>c.body?.script==='mobile: swipeGesture').length,2);
 assert.equal(result.steps[1].status,'pending');
});

test('long press and double click replay using element gestures, with result assertions required',async()=>{
 const f=fixture({account:{},delete:{}});
 const result=await f.run({steps:[{name:'長按帳號',action:'longPress',using:'id',value:'account',durationMs:1000},{name:'連點',action:'doubleClick',using:'id',value:'account'},{name:'確認刪除選項',action:'assertVisible',using:'id',value:'delete'}]});
 assert.equal(result.status,'passed');const gestures=f.calls.filter(call=>call.body?.script);assert.equal(gestures[0].body.script,'mobile: longClickGesture');assert.deepEqual(gestures[0].body.args,[{elementId:'account:0',duration:1000}]);assert.equal(gestures[1].body.script,'mobile: doubleClickGesture');
 assert.throws(()=>flowSchema.parse({appPackage:'com.example.app',steps:[{name:'不合法長按',action:'longPress',using:'id',value:'account',durationMs:10000},foreground]}));
 const points=fixture({},path=>path.endsWith('/window/rect')?{width:400,height:800}:undefined);
 assert.equal((await points.run({steps:[{name:'座標長按',action:'longPressPoint',x:.5,y:.25},foreground]})).status,'passed');assert.deepEqual(points.calls.find(call=>call.body?.script==='mobile: longClickGesture').body.args,[{x:200,y:200,duration:800}]);
});
function fixture(nodes = {}, hook) {
  let clock = 0;
  const calls = [];
  const execute = async (path, body) => {
    calls.push({path,body});
    const custom = await hook?.(path, body, calls);
    if (custom !== undefined) return custom;
    if (path.endsWith('/current_package')) return 'com.example.app';
    if (path.endsWith('/attribute/checked')) return nodes.checked?.checked ? 'true' : 'false';
    if (path.endsWith('/elements')) {
      const node = nodes[body.value];
      return Array.from({length: node?.count ?? (node ? 1 : 0)}, (_,i) => ({'element-6066-11e4-a52e-4f735466cecf': body.value + ':' + i}));
    }
    const match = path.match(/\/element\/([^/]+)\/(\w+)$/);
    if (match) {
      const key = decodeURIComponent(match[1]).replace(/:\d+$/, ''), node = nodes[key] || {};
      if (match[2] === 'displayed') return node.visible !== false;
      if (match[2] === 'enabled') return node.enabled !== false;
      if (match[2] === 'selected') return node.selected === true;
      if (match[2] === 'text') return node.text || '';
    }
    return null;
  };
  return {calls, run: input => executeFlow(flowSchema.parse({appPackage:'com.example.app',...input}), {execute, routeFor: role => '/session/' + role, now: () => clock, sleep: async ms => {clock += ms;}})};
}
test('if chooses exactly one branch, optional absence is skipped, routines inherit actor and record path',async()=>{
  const f=fixture({notice:{},close:{}});
  const result=await f.run({routines:{dismiss:[click('close')]},steps:[{name:'公告分支',action:'if',condition:visible('notice'),then:[{name:'關閉公告',action:'call',routine:'dismiss'}],else:[click('missing')]},{name:'可選',action:'optional',condition:visible('absent'),steps:[click('missing')]},foreground]});
  assert.equal(result.status,'passed');
  assert.equal(f.calls.filter(c=>c.path.endsWith('/click')).length,1);
  assert.ok(result.trace.some(t=>t.path.includes('.then.1.call.1')));
  assert.equal(result.trace.find(t=>t.name==='可選').status,'skipped');
  const other=fixture({fallback:{}});
  assert.equal((await other.run({steps:[{name:'另一條路',action:'if',condition:visible('none'),then:[click('missing')],else:[click('fallback')]},foreground]})).status,'passed');
});
test('wait for either expected screen before branching; neither screen times out without selecting a branch',async()=>{
  const verify=visible('verification'), camera=visible('camera');
  const steps=[{name:'等待其中一個畫面',action:'waitFor',timeoutMs:400,condition:{kind:'any',conditions:[verify,camera]}},
    {name:'依畫面選路',action:'if',condition:verify,then:[click('allow')],else:[click('camera')]},foreground];
  for(const [nodes,target] of [[{verification:{},allow:{}},'allow'],[{camera:{}},'camera']]){
    const f=fixture(nodes);const result=await f.run({steps});
    assert.equal(result.status,'passed');assert.ok(f.calls.some(c=>c.path.includes('/element/'+target+'%3A0/click')));
  }
  const f=fixture(), result=await f.run({steps});
  assert.equal(result.status,'failed');assert.match(result.message,/等待條件逾時/);
  assert.equal(f.calls.some(c=>c.path.endsWith('/click')),false);
  const all=fixture({one:{},two:{}});
  assert.equal((await all.run({steps:[{name:'同時顯示',action:'assert',condition:{kind:'all',conditions:[visible('one'),visible('two')]}}]})).status,'passed');
});
test('unexecuted assertions and setup-only assertions can never produce a pass',async()=>{
  const f=fixture();
  const result=await f.run({before:[foreground],steps:[{name:'沒走到檢查',action:'if',condition:visible('none'),then:[foreground]}],after:[foreground]});
  assert.equal(result.status,'failed');assert.match(result.message,/實際路徑未完成必要斷言/);
  assert.throws(()=>flowSchema.parse({appPackage:'com.example.app',before:[foreground],steps:[{name:'返回',action:'back'}]}));
});
test('optional steps do not swallow mutation errors, or retry a click',async()=>{
  const f=fixture({button:{}},path=>{if(path.endsWith('/click'))throw Object.assign(new Error('driver secret response'),{webdriver:'unknown error'});});
  const result=await f.run({steps:[{name:'可選操作',action:'optional',condition:visible('button'),steps:[click('button')]},foreground],after:[{name:'返回',action:'back'}]});
  assert.equal(result.status,'failed');assert.equal(result.steps[1].status,'pending');
  assert.equal(f.calls.filter(c=>c.path.endsWith('/click')).length,1);
  assert.ok(result.trace.some(t=>t.phase==='after'&&t.status==='passed'));
  assert.ok(!JSON.stringify(result).includes('driver secret'));
});
test('smart wait polls state and refreshes element references without replaying mutation',async()=>{
  let polls=0;
  const f=fixture({button:{}},path=>path.endsWith('/displayed')?++polls>=3:undefined);
  const result=await f.run({steps:[{...click('button'),timeoutMs:1000},foreground]});
  assert.equal(result.status,'passed');assert.ok(polls>=3);
  assert.equal(f.calls.filter(c=>c.path.endsWith('/click')).length,1);
  assert.equal(result.trace[0].durationMs,400);
});
test('waitFor timeout fails; absent, count, enabled, selected and contains assertions work',async()=>{
  const f=fixture({checked:{selected:true,checked:true,text:'會員 123'},disabled:{enabled:false},rows:{count:3}});
  const steps=[{name:'不存在',action:'assertAbsent',using:'id',value:'none'}, {name:'數量',action:'assertCount',using:'id',value:'rows',count:3}, {name:'可操作',action:'assertEnabled',using:'id',value:'checked'}, {name:'勾選',action:'assertSelected',using:'id',value:'checked'}, {name:'文字包含',action:'assertText',using:'id',value:'checked',text:'123',match:'contains'}];
  assert.equal((await f.run({steps})).status,'passed');
  assert.equal((await f.run({steps:[{name:'勾選狀態',action:'assertChecked',using:'id',value:'checked'},{name:'停用狀態',action:'assertEnabled',using:'id',value:'disabled',expected:false}]})).status,'passed');
  const result=await f.run({steps:[{name:'等待',action:'waitFor',condition:visible('none'),timeoutMs:400},foreground]});
  assert.equal(result.status,'failed');assert.match(result.message,/等待條件逾時/);
});
test('variables can be generated, captured and interpolated; values do not leak into evidence',async()=>{
  const f=fixture({input:{},label:{text:'private captured text'}});
  const result=await f.run({variables:{greeting:'hello'},steps:[{name:'唯一值',action:'generate',variable:'unique',prefix:'test-'},{name:'讀取',action:'readText',using:'id',value:'label',variable:'captured'},{name:'輸入',action:'type',using:'id',value:'input',text:'{{greeting}} {{captured}} {{unique}}',clear:true},{name:'驗證變數',action:'assert',condition:{kind:'variable',variable:'captured',equals:'private captured text'}}]});
  assert.equal(result.status,'passed');
  const typed=f.calls.find(c=>c.path.endsWith('/value')).body.text;
  assert.match(typed,/hello private captured text test-/);
  assert.equal(f.calls.filter(c=>c.path.endsWith('/value')).length,1);
  assert.ok(f.calls.find(c=>c.path.endsWith('/clear')));
  assert.ok(!JSON.stringify(result).includes('private captured text'));
});
test('undefined variables fail before a write, and reserved names or executable expressions are rejected',async()=>{
  assert.equal(parseFlow('export const flow={appPackage:"com.example.app",variables:{delta:-5},steps:[{name:"前景",action:"assertAppForeground"}]}').variables.delta,-5);
  const f=fixture({input:{}});
  const result=await f.run({steps:[{name:'輸入',action:'type',using:'id',value:'input',text:'{{missing}}'},foreground]});
  assert.equal(result.status,'failed');assert.equal(f.calls.filter(c=>c.path.endsWith('/value')).length,0);
  for(const variable of ['runId','timestamp','constructor','__proto__'])assert.throws(()=>flowSchema.parse({appPackage:'com.example.app',steps:[{name:'保留名稱',action:'set',variable,value:'x'},foreground]}));
  assert.throws(()=>parseFlow('export const flow={appPackage:"com.example.app",steps:process.exit()}'));
});
test('repeat and while are bounded; an unsatisfied loop exit is a failure',async()=>{
  const good=fixture();
  const result=await good.run({variables:{keep:true},steps:[{name:'重複',action:'repeat',times:2,steps:[{name:'返回',action:'back'}]},{name:'直到完成',action:'while',condition:{kind:'variable',variable:'keep',equals:true},maxIterations:3,steps:[{name:'完成',action:'set',variable:'keep',value:false}]},foreground]});
  assert.equal(result.status,'passed');assert.equal(good.calls.filter(c=>c.path.endsWith('/back')).length,2);
  const bad=await fixture().run({variables:{keep:true},steps:[{name:'無法退出',action:'while',condition:{kind:'variable',variable:'keep',equals:true},maxIterations:2,steps:[{name:'返回',action:'back'}]},foreground]});
  assert.equal(bad.status,'failed');assert.match(bad.message,/迴圈上限/);
});
test('cleanup runs after setup or main failure, continues other cleanup, and can turn a pass into failure',async()=>{
  for(const setupFailure of [true,false]) {
    const f=fixture();
    const result=await f.run({before:setupFailure?[{name:'前置檢查',action:'assertVisible',using:'id',value:'missing',timeoutMs:0}]:[],steps:[{...foreground,name:'主測試'}],after:[{name:'清理一',action:'assertVisible',using:'id',value:'none',timeoutMs:0},{name:'清理二',action:'back'}]});
    assert.equal(result.status,'failed');assert.match(result.message,/清理步驟失敗/);
    assert.ok(result.trace.some(t=>t.name==='清理二'&&t.status==='passed'));
    if(setupFailure)assert.equal(result.steps[0].status,'pending');
  }
});
test('dual-phone nested branches inherit actors but require actual assertions on both devices',async()=>{
  const f=fixture();
  const result=await f.run({actors:['sender','receiver'],steps:[{name:'接收者',actor:'receiver',action:'repeat',times:1,steps:[foreground]},{...foreground,actor:'sender'}]});
  assert.equal(result.status,'passed');assert.ok(f.calls.some(c=>c.path.startsWith('/session/receiver/')));
  assert.ok(f.calls.some(c=>c.path.startsWith('/session/sender/')));
});
test('invalid cyclic/missing routines, excessive nesting, invalid timeouts and actor mismatches are rejected',()=>{
  for(const change of [
    {routines:{a:[{name:'循環',action:'call',routine:'a'}]},steps:[{name:'呼叫',action:'call',routine:'a'},foreground]},
    {steps:[{name:'不存在',action:'call',routine:'missing'},foreground]},
    {steps:[{...foreground,timeoutMs:30001}]},
    {steps:[{...foreground,actor:'sender'}]},
  ])assert.throws(()=>flowSchema.parse({appPackage:'com.example.app',...change}));
  let nested=foreground;for(let i=0;i<9;i++)nested={name:'巢狀',action:'repeat',times:1,steps:[nested]};
  assert.throws(()=>flowSchema.parse({appPackage:'com.example.app',steps:[nested]}));
});
test('action budget prevents routine expansion from running indefinitely and still attempts bounded cleanup',async()=>{
  const f=fixture();
  const repeated={name:'重複',action:'repeat',times:10,steps:[{name:'再重複',action:'repeat',times:10,steps:[{name:'再次',action:'repeat',times:10,steps:[{name:'返回',action:'back'}]}]}]};
  const result=await f.run({steps:[repeated,repeated,repeated,foreground],after:[{name:'清理',action:'back'}]});
  assert.equal(result.status,'failed');assert.match(result.message,/上限/);
  assert.ok(result.trace.some(t=>t.name==='清理'&&t.status==='passed'));assert.ok(result.trace.length<=3300);
});

test('larger sections validate and execute beyond the former limits', async () => {
  const steps = [...Array.from({length:299},()=>({name:'返回',action:'back'})),foreground];
  assert.equal(flowSchema.parse({appPackage:'com.example.app',steps}).steps.length,300);
  assert.throws(()=>flowSchema.parse({appPackage:'com.example.app',steps:[...steps,foreground]}));
  const result=await fixture().run({steps:[{name:'重複',action:'repeat',times:2,steps},foreground]});
  assert.equal(result.status,'passed');
  assert.ok(result.trace.length>300);
});

test('main time budget permits longer runs, rejects expiry, and reserves independent cleanup time', async () => {
  for (const elapsed of [5*60*1000,30*60*1000]) {
    let clock=0;
    const result=await executeFlow({appPackage:'com.example.app',steps:[{name:'返回',action:'back'},foreground],after:[{name:'清理',action:'back'}]}, {
      now:()=>clock, routeFor:()=>'/session/test',
      execute:async path=>{if(path.endsWith('/back'))clock+=elapsed;return 'com.example.app';},
    });
    assert.equal(result.status,elapsed<30*60*1000?'passed':'failed');
    assert.ok(result.trace.some(step=>step.name==='清理'&&step.status==='passed'));
  }
});
