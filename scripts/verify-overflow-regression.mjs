import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('..',import.meta.url));
const dir=join(root,'.local/overflow-regression');await mkdir(dir,{recursive:true});
// Deliberately invalid layouts exercise the validator, not application styling.
const fixtures=[
 {name:'scroll-clipped',status:0,body:'<div style="width:200px;height:50px;overflow:auto"><div style="height:40px"></div><button style="width:100px;height:40px">Scrolled row</button></div><button style="width:100px;height:40px;margin-top:4px">Next pane</button>'},
 {name:'real-overlap',status:1,pattern:/\[B overlap\]/,body:'<button style="width:100px;height:40px">First</button><button style="position:relative;left:-45px;width:100px;height:40px">Second</button>'},
 {name:'fixed-escapes-scroll-clip',status:1,pattern:/\[B overlap\]/,body:'<div style="width:100px;height:20px;overflow:hidden"><button style="position:fixed;top:80px;left:20px;width:100px;height:40px">Fixed first</button></div><button style="position:fixed;top:100px;left:60px;width:100px;height:40px">Fixed second</button>'},
 {name:'real-text-clipping',status:1,pattern:/\[A clipped\]/,body:'<div style="width:80px;white-space:nowrap;overflow:hidden">This text is silently cut off without an ellipsis.</div>'},
];
for(const fixture of fixtures){
 const path=join(dir,fixture.name+'.html');await writeFile(path,'<!doctype html><meta charset="UTF-8"><title>Overflow regression</title>'+fixture.body);
 const result=spawnSync(process.execPath,[...process.execArgv,join(root,'scripts/verify_overflow.mjs'),path],{cwd:root,env:{...process.env,DS_REQUIRE_BROWSER:'1'},encoding:'utf8',timeout:60000});
 assert.equal(result.status,fixture.status,result.stdout+'\n'+result.stderr);
 if(fixture.pattern)assert.match(result.stdout,fixture.pattern);
 console.log('PASS: '+fixture.name);
}
