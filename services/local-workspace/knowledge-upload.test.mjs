import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture, request } from './test-support.mjs';
import { createWorkspace } from './workspace.mjs';
import { createHandler } from './plugin.mjs';
import { prepareUploads, splitKnowledge, SOURCE_LIMIT, BATCH_LIMIT } from './knowledge-upload.mjs';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j/p0AAAAASUVORK5CYII=', 'base64');
async function finish(w, id) { for (let i = 0; i < 500; i++) { const job = await w.aiStatus(id); if (job.status !== 'running') return job; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('工作逾時'); }
function merge(prompt) { const data = JSON.parse(prompt.slice(prompt.indexOf('{"existing":'))); return { documents: data.incoming.map((row, index) => ({ title: row.name, content: row.content, category: 'notes', featureIds: [], replaces: [], keepId: null, inputIndices: [index] })), conflicts: [] }; }

test('來源每份 10 MB、每批 20 MB，UTF-8 拆段不遺漏；圖片驗證副檔名、檔頭與像素', () => {
  const full = 'x'.repeat(SOURCE_LIMIT);
  assert.equal(prepareUploads([{ name: '大文件.md', content: full }])[0].source.bytes, SOURCE_LIMIT);
  assert.equal(prepareUploads([{ name: 'a.md', content: full }, { name: 'b.md', content: full }]).reduce((sum, row) => sum + row.source.bytes, 0), BATCH_LIMIT);
  assert.throws(() => prepareUploads([{ name: 'a.md', content: full + 'x' }]), /10 MB/);
  assert.throws(() => prepareUploads([{ name: 'a.md', content: full }, { name: 'b.md', content: full }, { name: 'c.md', content: 'x' }]), /20 MB/);
  const text = ('會員🙂入口\n'.repeat(25000)) + '尾端';
  const parts = splitKnowledge(text); assert.equal(parts.join(''), text); assert.ok(parts.every(part => Buffer.byteLength(part) <= 96 * 1024));
  const image = prepareUploads([{ name: 'menu.png', base64: png.toString('base64') }])[0]; assert.equal(image.source.kind, 'image'); assert.equal(image.source.width, 1);
  assert.throws(() => prepareUploads([{ name: 'menu.jpg', base64: png.toString('base64') }]), /副檔名/);
  assert.throws(() => prepareUploads([{ name: 'menu.svg', content: '<svg/>' }]), /支援/);
  assert.throws(() => prepareUploads([{ name: '../menu.png', base64: png.toString('base64') }]), /路徑/);
  assert.throws(() => prepareUploads([{ name: 'menu.png', base64: '====' }]), /編碼/);
  const oversized = Buffer.from(png); oversized.writeUInt32BE(15000, 16);
  assert.throws(() => prepareUploads([{ name: 'large.png', base64: oversized.toString('base64') }]), /尺寸/);
  assert.throws(() => prepareUploads([{ name: 'bad.txt', base64: Buffer.from([255, 254]).toString('base64') }]), /UTF-8/);
});

test('大型文件逐段比對、不遺漏尾端，保存原始 UTF-8 來源及關聯，失敗不套用', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize();
    let calls = 0;
    let routed=0;
    const w = createWorkspace(f.config, { aiRunner: async (_config, prompt) => { calls++; assert.ok(Buffer.byteLength(prompt) < 760000); if(prompt.includes('你是知識候選檢索器')){routed++;return {ids:[],tooMany:false};}return merge(prompt); } });
    const content = ('會員資料欄位與驗證規則\n'.repeat(21000)) + '唯一尾端不得省略';
    const start = await w.analyzeKnowledgeAi([{ name: '完整規格.md', content }]); const job = await finish(w, start.id); assert.equal(job.status, 'completed', job.error); assert.ok(calls > 1);
    assert.ok(routed>0);
    const docs = (await w.knowledge()).documents;
    const pieces = await Promise.all(docs.map(row => w.knowledgeDocument(row.id)));
    assert.equal(pieces.map(row => row.content).join(''), content);
    const source = pieces[0].sources[0]; assert.deepEqual(await readFile(join(f.project, source.path)), Buffer.from(content));
    assert.equal(Buffer.from((await w.knowledgeSource(pieces[0].id, source.sha256)).base64, 'base64').toString(), content);
    const original = await readFile(join(f.project, 'knowledge/index.json'), 'utf8');
    const beforeRepeat=calls;
    const repeated=await finish(w,(await w.analyzeKnowledgeAi([{name:'完整規格副本.md',content}])).id);
    assert.equal(repeated.status,'completed',repeated.error);assert.equal(repeated.result.skipped.length,1);assert.equal(calls,beforeRepeat);
    assert.equal(await readFile(join(f.project,'knowledge/index.json'),'utf8'),original);
    let count = 0; const broken = createWorkspace(f.config, { aiRunner: async (_config, prompt) => { if (++count === 2) throw new Error('synthetic failure');if(prompt.includes('你是知識候選檢索器'))return {ids:[],tooMany:false};return merge(prompt); } });
    const next = await broken.analyzeKnowledgeAi([{ name: '第二版.md', content:content+'\n第二版新增規則' }]); assert.equal((await finish(broken, next.id)).status, 'failed');
    assert.equal(await readFile(join(f.project, 'knowledge/index.json'), 'utf8'), original);
  } finally { await f.dispose(); }
});

test('圖片附加給模型、用途不明不當作預期，保存原圖／文字／問題，可還原且原圖不刪除', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize();
    let attachments = 0;
    const w = createWorkspace(f.config, { aiRunner: async (_config, prompt, options) => {
      if (options.images?.length) { attachments++; assert.deepEqual(options.images[0].bytes, png); assert.match(prompt, /用途未指定/); return { content: '上方顯示 MEMBER，按鈕位於下方。', uncertainties: ['點擊動作與樣式基準尚未提供'] }; }
      return merge(prompt);
    } });
    const handler = createHandler(w, 'test-session');
    const start = await request(handler, '/local-api/ai-knowledge-start', { documents: [{ name: 'RichMenu.png', base64: png.toString('base64') }] }); assert.equal(start.status, 200);
    const job = await finish(w, start.body.id); assert.equal(job.status, 'completed', job.error); assert.equal(attachments, 1);
    assert.ok(job.result.conflicts.includes('點擊動作與樣式基準尚未提供'));
    const doc = await w.knowledgeDocument((await w.knowledge()).documents[0].id); assert.match(doc.content, /不直接當作預期樣式/);
    const repeated=await finish(w,(await w.analyzeKnowledgeAi([{name:'RichMenu副本.png',base64:png.toString('base64')}])).id);
    assert.equal(repeated.status,'completed',repeated.error);assert.equal(repeated.result.skipped.length,1);assert.equal(attachments,1);
    const source = doc.sources[0];
    assert.equal((await request(handler, '/local-api/knowledge-source', { id: doc.id, sha256: source.sha256 }, { headers: { 'x-archify-session': 'bad' } })).status, 403);
    const opened = await request(handler, '/local-api/knowledge-source', { id: doc.id, sha256: source.sha256 }); assert.equal(opened.body.mediaType, 'image/png'); assert.equal(opened.body.base64, png.toString('base64'));
    const modified=Buffer.from(png);modified[modified.length-1]^=1;await writeFile(join(f.project,source.path),modified);
    await assert.rejects(()=>w.knowledgeSource(doc.id,source.sha256),/指紋/);await writeFile(join(f.project,source.path),png);
    await assert.rejects(() => w.knowledgeSource(doc.id, '../outside'), /識別碼/);
    assert.match(await readFile(join(f.project, 'knowledge/README.md'), 'utf8'), /sources\//);
    await w.restoreKnowledgeAi(); assert.equal((await w.knowledge()).documents.length, 0); assert.ok((await lstat(join(f.project, source.path))).isFile());
  } finally { await f.dispose(); }
});

test('大型來源分析到一半取消，不更新有效知識或寫入原始資產',async()=>{
 const f=await fixture();try{
  await f.workspace.initialize();await f.workspace.importKnowledge([{name:'既有.md',content:'原始業務規則'}]);
  const original=await readFile(join(f.project,'knowledge/index.json'),'utf8');let calls=0;
  const w=createWorkspace(f.config,{aiRunner:async(_config,prompt,{signal})=>{if(++calls===2)return new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true});});return merge(prompt);}});
  const start=await w.analyzeKnowledgeAi([{name:'大文件.md',content:'規格內容\n'.repeat(25000)}]);
  for(let i=0;i<100&&calls<2;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(calls,2);
  await w.cancelAi(start.id);assert.equal((await finish(w,start.id)).status,'cancelled');
  assert.equal(await readFile(join(f.project,'knowledge/index.json'),'utf8'),original);await assert.rejects(()=>lstat(join(f.project,'knowledge/sources')),{code:'ENOENT'});
 }finally{await f.dispose();}
});

test('HTML 原檔完整保留但僅抽純文字分析，JSON 以 byte 計量且 UTF-8 跨 chunk 不損壞', async () => {
  const f = await fixture();
  try {
    await f.workspace.initialize();
    const raw = '<h1>會員入口</h1><script>DO_NOT_EXECUTE()</script><p>文字規格</p>';
    const w = createWorkspace(f.config, { aiRunner: async (_config, prompt) => { const result = merge(prompt); assert.ok(!result.documents[0].content.includes('DO_NOT_EXECUTE')); return result; } });
    const job = await finish(w, (await w.analyzeKnowledgeAi([{ name: '原始.html', base64: Buffer.from(raw).toString('base64') }])).id); assert.equal(job.status, 'completed', job.error);
    const row = (await w.knowledge()).documents[0]; assert.equal((await readFile(join(f.project, row.sources[0].path))).toString(), raw);
    const handler = createHandler(w, 'test-session'); assert.equal((await request(handler, '/local-api/ai-knowledge-start', {}, { headers: { 'content-length': String(49 * 1024 * 1024) } })).status, 413);
    // Exercise the handler with actual byte-split Unicode, not Readable's string conversion.
    const { Readable } = await import('node:stream'); const data = Buffer.from(JSON.stringify({ documents: [{ name: '跨段.md', content: '會員中文' }] }));
    const offset = data.indexOf(Buffer.from('會')) + 1, req = Readable.from([data.subarray(0, offset), data.subarray(offset)]); Object.assign(req, { url: '/local-api/ai-knowledge-start', method: 'POST', socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost', origin: 'http://localhost', 'content-type': 'application/json', 'x-archify-session': 'test-session' } });
    let body; await handler(req, { setHeader() {}, end(value) { body = JSON.parse(value); } }); const state = await finish(w, body.id); assert.equal(state.status, 'completed', state.error);
    const latest = (await w.knowledge()).documents.at(-1); assert.equal((await w.knowledgeDocument(latest.id)).content, '會員中文');
  } finally { await f.dispose(); }
});
