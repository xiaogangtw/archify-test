import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFlow} from './flow-contract.mjs';
import {createAppium} from './appium.mjs';
const check={name:'確認前景',action:'assertAppForeground'};
const flow=steps=>({appPackage:'com.example.app',steps:[...steps,check]});
function fixture({visibleAfter=0,failGesture=false,ambiguous=false}={}) {
 const calls=[];let swipes=0;
 const app=createAppium({status:async()=>({devices:['emulator-5554','emulator-5556'].map(serial=>({serial,booted:true}))})},{fetch:async(url,options={})=>{
  const body=options.body&&JSON.parse(options.body);calls.push({url,body,method:options.method});
  if(body?.script==='mobile: swipeGesture') {swipes++;if(failGesture)return new Response(JSON.stringify({value:{error:'unknown error'}}),{status:500});}
  let value={};
  if(url.endsWith('/status'))value={ready:true};
  if(url.endsWith('/session'))value={sessionId:'s'+calls.filter(c=>c.url.endsWith('/session')).length};
  if(url.endsWith('/window/rect'))value={x:0,y:0,width:1000,height:2000};
  if(url.endsWith('/elements'))value=ambiguous?[{'element-6066-11e4-a52e-4f735466cecf':'a'},{'element-6066-11e4-a52e-4f735466cecf':'b'}]:[{'element-6066-11e4-a52e-4f735466cecf':'e'}];
  if(url.endsWith('/displayed'))value=swipes>=visibleAfter;
  if(url.endsWith('/current_package'))value='com.example.app';
  return new Response(JSON.stringify({value}));
 }});
 return {app,calls,swipes:()=>swipes};
}
test('gesture definitions parse numbers and reject invalid bounds, directions, budgets and assertion-free flows',()=>{
 const swipe={name:'滑動',action:'swipe',direction:'up',percent:0.6,area:{left:0.1,top:0.2,width:0.8,height:0.6}};
 assert.equal(parseFlow(`export const flow=${JSON.stringify(flow([swipe]))} as const`).steps[0].percent,0.6);
 for(const invalid of [{direction:'diagonal'},{percent:0},{percent:1.1},{area:{left:0.9,top:0,width:0.5,height:1}},{using:'id',value:'x'}])assert.throws(()=>parseFlow(`export const flow=${JSON.stringify(flow([{...swipe,...invalid}]))}`));
 for(const maxSwipes of [0,11,1.5])assert.throws(()=>parseFlow(`export const flow=${JSON.stringify(flow([{name:'尋找',action:'scrollUntilVisible',direction:'up',using:'id',value:'x',maxSwipes}]))}`));
 assert.throws(()=>parseFlow(`export const flow=${JSON.stringify({appPackage:'com.example.app',steps:[swipe]})}`));
});
test('all swipe directions send native gestures using screen-relative area',async()=>{
 for(const direction of ['up','down','left','right']) {
  const f=fixture();const result=await f.app.run('emulator-5554',flow([{name:'滑動',action:'swipe',direction,percent:0.6,area:{left:0.1,top:0.2,width:0.8,height:0.6}}]));
  assert.equal(result.status,'passed');
  assert.deepEqual(f.calls.find(c=>c.body?.script==='mobile: swipeGesture').body.args,[{left:100,top:400,width:800,height:1200,direction,percent:0.6}]);
 }
});
test('automatic search stops when visible, skips gestures if already visible, and fails at its limit',async()=>{
 for(const [visibleAfter,maxSwipes,expected,swipes] of [[0,2,'passed',0],[2,3,'passed',2],[9,1,'failed',1]]) {
  const f=fixture({visibleAfter});const result=await f.app.run('emulator-5554',flow([{name:'尋找目標',action:'scrollUntilVisible',direction:'up',using:'id',value:'target',maxSwipes}]));
  assert.equal(result.status,expected);assert.equal(f.swipes(),swipes);
  if(expected==='failed'){assert.match(result.message,/滑動上限/);assert.equal(result.steps[1].status,'pending');}
  assert.equal(f.calls.some(c=>c.method==='DELETE'),true);assert.equal(f.app.busy('emulator-5554'),false);
 }
});
test('gesture failure and ambiguous targets fail without continuing or leaking sessions',async()=>{
 for(const options of [{failGesture:true,visibleAfter:2},{ambiguous:true}]) {
  const f=fixture(options);const result=await f.app.run('emulator-5554',flow([{name:'尋找目標',action:'scrollUntilVisible',direction:'up',using:'id',value:'target',maxSwipes:1}]));
  assert.equal(result.status,'failed');assert.equal(result.steps[1].status,'pending');
  assert.equal(f.calls.some(c=>c.method==='DELETE'),true);assert.equal(f.app.busy('emulator-5554'),false);
 }
});
test('dual-phone gestures route to the selected actor session',async()=>{
 const f=fixture();const result=await f.app.run({sender:'emulator-5554',receiver:'emulator-5556'},{appPackage:'com.example.app',actors:['sender','receiver'],steps:[{name:'接收者滑動',actor:'receiver',action:'swipe',direction:'left'},{...check,actor:'sender'},{...check,actor:'receiver'}]});
 assert.equal(result.status,'passed');assert.match(f.calls.find(c=>c.body?.script==='mobile: swipeGesture').url,/session\/s2\//);
 assert.equal(f.calls.filter(c=>c.method==='DELETE').length,2);
});
