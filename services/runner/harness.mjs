import { createServer } from 'node:http';
import { mkdir, writeFile, symlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
let raw='';
for await(const chunk of process.stdin){raw+=chunk;if(raw.length>250000)throw new Error('Script too large');}
const input=JSON.parse(raw);
if(typeof input.source!=='string')throw new Error('Missing source');
const server=createServer((req,res)=>{
  if(req.method!=='GET'){res.writeHead(405);return res.end();}
  if(req.url==='/health'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({status:'ok'}));}
  if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<main>Archify Smoke</main>');}
  res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(8080,'127.0.0.1',resolve));
await mkdir('/tmp/job',{recursive:true});
await symlink('/opt/runner/node_modules','/tmp/job/node_modules');
await writeFile('/tmp/job/smoke.spec.ts',input.source);
await writeFile('/tmp/job/playwright.config.mjs',`export default {testDir:'.',workers:1,retries:0,timeout:20000,globalTimeout:30000,forbidOnly:true,outputDir:'/tmp/artifacts',reporter:[['/opt/runner/reporter.cjs']],use:{baseURL:'http://127.0.0.1:8080',trace:'off',screenshot:'off',video:'off'}};`);
const child=spawn(process.execPath,['/opt/runner/node_modules/@playwright/test/cli.js','test','--config=/tmp/job/playwright.config.mjs'],{cwd:'/tmp/job',env:{PATH:process.env.PATH,HOME:'/tmp',ARCHIFY_BASE_URL:'http://127.0.0.1:8080'},stdio:['ignore','inherit','inherit']});
child.on('exit',code=>{server.close();process.exitCode=code || 0;});
