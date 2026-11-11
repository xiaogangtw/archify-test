// CLI: node build-report.mjs <report-directory>
// results.json: {title,date,environment,method,summary,limitations:[],cleanup:[],
// cases:[{id,title,status,expected,actual,steps:[],screenshots:[{file,caption,role}]}]}
import { readFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { renderHtml } from '../../../framework/html.mjs';
import { MAX_REPORT_BYTES } from '../../../framework/report-document.mjs';

const labels = { PASS: '通過', FAIL: '未通過', BLOCKED: '受阻', NOT_RUN: '未執行' };
const md = value => String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|');
export async function buildReport(directory) {
  const root = await realpath(resolve(directory));
  const data = JSON.parse(await readFile(resolve(root, 'results.json'), 'utf8'));
  assert(data.title && Array.isArray(data.cases) && data.cases.length, '缺少報告標題或案例');
  const images = new Map();
  for (const item of data.cases) {
    assert(labels[item.status], `無效結果：${item.status}`);
    for (const shot of item.screenshots ?? []) {
      const path = resolve(root, shot.file);
      assert(path.startsWith(root + sep), '截圖不得超出報告資料夾');
      assert(!(await lstat(path)).isSymbolicLink(), '截圖不接受符號連結');
      assert((await realpath(path)).startsWith(root + sep), '截圖不得透過連結離開報告資料夾');
      const bytes = await readFile(path);
      assert(bytes.length >= 24 && bytes.length <= 2 * 1024 * 1024, '截圖大小不合法');
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', '證據需為 PNG');
      assert.equal(bytes.readUInt32BE(16), 390, '證據寬度需為 390');
      assert.equal(bytes.readUInt32BE(20), 844, '證據高度需為 844');
      images.set(shot.file, `data:image/png;base64,${bytes.toString('base64')}`);
    }
  }
  const notes = [...(data.limitations ?? []), ...(data.cleanup ?? [])];
  const mdLines = [`# ${data.title}`, '', `**日期：${data.date}｜手機視窗：390 × 844｜Playwright**`, '',
    data.summary, '', `環境：${data.environment}`, '', `方式：${data.method}`, '',
    '| 案例 | 結果 |', '|---|---|', ...data.cases.map(c => `| ${md(c.title)} | ${labels[c.status]} |`), ''];
  for (const c of data.cases) {
    mdLines.push(`## ${c.id}｜${c.title}`, '', `**結果：${labels[c.status]}**`, '', `**預期：** ${c.expected}`, '', `**實際：** ${c.actual}`, '',
      ...(c.steps ?? []).map((s, i) => `${i+1}. ${s}`), '');
    for (const shot of c.screenshots ?? []) {
      mdLines.push(`### ${shot.caption}`, '', `視角：${shot.role}`, '', `![${shot.caption}](${shot.file})`, '');
    }
  }
  mdLines.push('## 測試範圍與清理', '', ...notes.map(n => `- ${n}`), '');
  const states={PASS:'passed',FAIL:'failed',BLOCKED:'skipped',NOT_RUN:'skipped'};
  const html=renderHtml({schemaVersion:1,kind:'execution',testType:'ui',project:data.title,runId:randomUUID(),createdAt:new Date(data.startedAt||Date.now()).toISOString(),cases:data.cases.map(c=>({
    id:c.id,name:c.title,status:states[c.status],target:'web',purpose:data.summary+'；原圖文狀態：'+labels[c.status],expected:c.expected,actual:c.actual,source:'results.json',sourceHash:createHash('sha256').update(JSON.stringify(data)).digest('hex'),
    steps:(c.steps?.length?c.steps:['此舊格式沒有逐步紀錄']).map(name=>({name,expected:c.expected,actual:c.actual,status:states[c.status]})),screenshots:(c.screenshots||[]).map(image=>({caption:image.caption,role:image.role,data:images.get(image.file).replace('data:image/png;base64,','')}))
  }))});
  const date = new Date(data.startedAt || Date.now());
  assert(Number.isFinite(date.getTime()), 'startedAt 必須是有效日期');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hourCycle: 'h23' }).formatToParts(date).map(item => [item.type, item.value]));
  const basename = 'report-' + parts.year + '-' + parts.month + '-' + parts.day + '_' + parts.hour + '-' + parts.minute + '-' + parts.second + '-' + parts.fractionalSecond + '-' + randomUUID().slice(0, 8);
  const files = { html: basename + '.html' };
  assert(Buffer.byteLength(html) <= MAX_REPORT_BYTES, '單檔報告超過512MB，未丟棄證據');
  await writeFile(resolve(root, files.html), html, { flag: 'wx' });
  return { cases: data.cases.length, images: images.size, files };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await buildReport(process.argv[2] ?? process.cwd())));
}
