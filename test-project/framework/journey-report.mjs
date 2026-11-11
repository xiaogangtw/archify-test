import theme from './report-theme.mjs';
import { reportActual } from './case-narrative.mjs';
import { encodeReport, REPORT_DOCUMENT_ID } from './report-document.mjs';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const labels = { 'not-run': '未執行', passed: '通過', failed: '未通過', skipped: '略過' };
const label = status => labels[status] || '未提供';
const text = (value, fallback) => typeof value === 'string' && value && value !== '依測試檔中的斷言' ? value : fallback;
const imageOk = image => typeof image.data === 'string' && image.data.length <= 2800000 && /^iVBOR[A-Za-z0-9+/=]+$/.test(image.data);
const sequence = image => Number(image.caption?.match(/^([0-9]+)\./)?.[1] ?? Number.MAX_SAFE_INTEGER);
function diagnostic(value) {
  return value ? '<p class="diagnostic"><b>診斷：</b>' + esc(value.code) + ' · ' + esc(value.message)
    + (value.operation ? ' · ' + esc(value.operation) : '')
    + (value.timeoutMs !== undefined ? ' · 等待上限 ' + esc(value.timeoutMs) + ' ms' : '') + '</p>' : '';
}
export function renderHtml(report, { embedded = false } = {}) {
  const cases = report.cases || [];
  const variables = Object.entries(theme).map(([key, value]) => '--' + key + ':' + (typeof value === 'string' ? value : value.DEFAULT)).join(';');
  const counts = Object.keys(labels).map(status => ({ status, count: cases.filter(row => row.status === status).length })).filter(row => row.count);
  const state = report.kind === 'flow' ? '流程預覽 · 尚未執行' : report.runStatus === 'running' ? '執行中 · 已完成案例將更新於此檔案' : report.runStatus === 'interrupted' ? '執行已中斷 · 結果不完整' : '本次執行結果';
  const orderedShots = cases.map(item => (item.screenshots || []).filter(imageOk).slice().sort((a, b) => sequence(a) - sequence(b)));
  const anyShots = orderedShots.some(shots => shots.length);
  const cards = cases.map((item, index) => {
    const steps = item.steps || [];
    const shots = orderedShots[index];
    const failed = steps.filter(step => step.status === 'failed');
    const detailed = failed.filter(step => step.actual && !/^(步驟失敗；|畫面或資料斷言|此操作已完成)/.test(step.actual));
    const actual = item.actual && !/^(本次測試執行完成|畫面或資料斷言|步驟失敗；|測試失敗，)/.test(item.actual) ? item.actual : detailed.at(-1)?.actual || text(item.actual, report.kind === 'flow' ? '尚未執行。' : '此報告未保存具體結果。');
    const scenario = (item.scenarioSteps || []).map(step => '<li>' + esc(step.action) + '</li>').join('');
    const resultText = reportActual(item);
    const journey = shots.map((image, shotIndex) => {
      const step = steps.find(step => image.caption.startsWith(step.name + '｜'));
      const role = image.role || image.caption.match(/^\d+\.\s*([^｜]+)｜/)?.[1] || '角色未記錄';
      const action = image.caption.replace(/^\d+\.\s*[^｜]+｜/, '').replace(/｜(?:完成後|失敗當下)$/, '');
      const expected = image.expected || step?.expected;
      const result = image.actual || step?.actual;
      const meaningfulResult = result && !/^(此操作已完成|此圖為|此步驟已結束)/.test(result);
      return '<figure><figcaption><b>' + esc(role) + '</b><span>' + esc(action) + '</span></figcaption>'
        + (expected && !/^完成.{0,100}且操作後畫面具備可見內容/.test(expected) ? '<p class="shot-expect">' + esc(expected) + '</p>' : '')
        + (meaningfulResult ? '<p class="shot-result">' + esc(result) + '</p>' : '')
        + diagnostic(image.diagnostic || step?.diagnostic)
        + '<button class="shot" type="button" data-case="' + index + '" data-shot="' + shotIndex + '" aria-label="放大：' + esc(image.caption) + '"><img '
        + (embedded ? 'src="data:image/png;base64,' + image.data + '" ' : '')
        + 'alt="' + esc(image.caption) + '" loading="lazy" width="390" height="844"></button></figure>';
    }).join('');
    const logs = steps.map(step => '<li><b>' + esc(step.name) + '</b> · ' + label(step.status)
      + '<p>預期：' + esc(text(step.expected, '未保存當步預期。')) + '</p>'
      + '<p>實際：' + esc(text(step.actual, step.error || '僅保存步驟狀態。')) + '</p>' + diagnostic(step.diagnostic) + '</li>').join('');
    const failures = failed.length ? '<details class="failures"><summary>失敗位置 · ' + failed.length + ' 個步驟</summary><ul>'
      + failed.map(step => '<li><b>' + esc(step.name) + '</b><p>' + esc(step.actual || step.error || '未保存原因。') + '</p>' + diagnostic(step.diagnostic) + '</li>').join('') + '</ul></details>' : '';
    return '<section id="case-' + index + '"><div class="section-title"><h2>' + esc(item.caseId || item.id) + '｜' + esc(item.name) + '</h2><span class="badge ' + esc(item.status) + '">' + label(item.status) + '</span></div>'
      + (scenario ? '<div class="outcome"><h3>情境與操作</h3><ol>' + scenario + '</ol></div>' : '')
      + '<div class="outcome"><p><b>預期：</b>' + esc(text(item.expected, '未保存案例整體預期。')) + '</p><p><b>實際：</b>' + esc(resultText) + '</p></div>'
      + failures + (shots.length ? '<div class="journey">' + journey + '</div>' : '<p class="muted">本案例沒有可用畫面證據。</p>')
      + '<details><summary>完整步驟紀錄 · ' + steps.length + ' 步</summary><ol>' + logs + '</ol></details>'
      + ((item.responses || []).length ? '<details><summary>API 回應與診斷 · ' + item.responses.length + ' 筆</summary>' + item.responses.map(response => '<h3>HTTP ' + esc(response.status) + '</h3><pre>' + esc(JSON.stringify(response.body, null, 2)) + '</pre>').join('') + '</details>' : '')
      + (item.cleanup ? '<p class="cleanup"><b>清理：</b>' + label(item.cleanup.status) + ' ' + esc(item.cleanup.error) + '</p>' : '')
      + '<details><summary>來源與執行識別</summary><p>' + esc(item.source) + '</p><p>SHA-256：' + esc(item.sourceHash) + '</p><p>' + esc(report.runId) + '</p></details></section>';
  }).join('');
  const payload = embedded ? '' : '<script id="' + REPORT_DOCUMENT_ID + '" type="application/json">' + encodeReport(report) + '</script>';
  const runtime = !embedded || anyShots ? '<script type="text/javascript">(()=>{const data=document.getElementById("' + REPORT_DOCUMENT_ID + '");const report=data?JSON.parse(data.textContent):null;const ordered=report?report.cases.map(c=>(c.screenshots||[]).filter(s=>typeof s.data==="string"&&s.data.length<=2800000&&/^iVBOR[A-Za-z0-9+/=]+$/.test(s.data)).sort((a,b)=>Number(a.caption.match(/^(\d+)\./)?.[1]||Number.MAX_SAFE_INTEGER)-Number(b.caption.match(/^(\d+)\./)?.[1]||Number.MAX_SAFE_INTEGER))):null;function load(b){const img=b.querySelector("img");if(!img.getAttribute("src")&&ordered){const s=ordered[Number(b.dataset.case)][Number(b.dataset.shot)];img.src="data:image/png;base64,"+s.data;}}const buttons=[...document.querySelectorAll(".shot")];if("IntersectionObserver"in window){const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){load(e.target);observer.unobserve(e.target);}}),{rootMargin:"800px"});buttons.forEach(b=>observer.observe(b));}else buttons.forEach(load);window.addEventListener("beforeprint",()=>buttons.forEach(load));const d=document.getElementById("zoom");buttons.forEach(b=>b.addEventListener("click",()=>{load(b);const img=b.querySelector("img");document.getElementById("full").src=img.src;document.getElementById("full").alt=img.alt;document.getElementById("zoom-caption").textContent=img.alt;d.showModal();}));document.getElementById("close")?.addEventListener("click",()=>d.close());d?.addEventListener("click",e=>{if(e.target===d)d.close();});})();</script>' : '';
  return '<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="archify-report-format" content="single-file-v1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>' + esc(report.project) + '｜測試報告</title><style>'
    + ':root{color-scheme:light;' + variables + '}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--canvas);color:var(--ink);font:400 16px/1.75 "Microsoft JhengHei","Noto Sans TC",sans-serif;overflow-wrap:anywhere}header{background:var(--navy);color:var(--headerInk);padding:40px max(24px,calc((100vw - 1160px)/2))}header p{color:var(--headerMuted);margin:0 0 16px}h1{font-size:32px;line-height:1.4;margin:0 0 12px}h2{font-size:24px;line-height:1.5;margin:0}h3{font-size:16px}p{margin:8px 0}.pills{display:flex;gap:8px;flex-wrap:wrap}.pills span{padding:4px 12px;border:1px solid var(--headerLine);border-radius:24px;font-size:14px;font-variant-numeric:tabular-nums}main{max-width:1210px;margin:auto;padding:28px}nav,section,aside{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:24px;margin-bottom:28px}nav{display:flex;flex-wrap:wrap;gap:8px 20px}a{color:var(--brand);text-underline-offset:3px;min-height:32px;display:inline-flex;align-items:center}.section-title{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.badge{font-size:14px;font-weight:700;padding:3px 12px;border-radius:24px}.passed{background:var(--passedBg);color:var(--success)}.failed{background:var(--failedBg);color:var(--danger)}.skipped,.not-run{background:var(--warningBg);color:var(--warning)}.outcome{margin:16px 0 24px;max-width:75ch}.journey{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;margin-top:24px}figure{margin:0;padding:14px;background:var(--figure);border:1px solid var(--line);border-radius:16px;min-width:0;content-visibility:auto;contain-intrinsic-size:auto 760px}figcaption{font-size:14px;min-height:58px;margin-bottom:12px}figcaption b,figcaption span{display:block}figcaption span,.muted,aside{color:var(--muted)}figure p,.diagnostic{font-size:14px}.shot{display:block;width:100%;max-width:312px;margin:auto;padding:0;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:white;cursor:zoom-in}.shot img{display:block;width:100%;height:auto;aspect-ratio:390/844}.shot:hover{border-color:var(--brand)}button{font:inherit;min-height:32px}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid var(--brand);outline-offset:3px}details{margin-top:16px}summary{cursor:pointer;min-height:32px;color:var(--brand)}details li{margin:16px 0}details p,pre{font-size:14px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--figure);padding:16px;border-radius:8px}.failures{color:var(--danger)}.cleanup{margin-top:20px}dialog{border:0;border-radius:16px;padding:16px;max-width:96vw;max-height:96vh;background:var(--surface);color:var(--ink)}dialog::backdrop{background:#061b30df}.zoom-head{display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:12px}dialog img{display:block;max-width:86vw;max-height:80vh;width:auto;height:auto;margin:auto}dialog button{background:var(--navy);color:var(--headerInk);border:0;border-radius:8px;padding:8px 16px;cursor:pointer}::selection{background:var(--navy);color:white}@media(max-width:900px){.journey{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:570px){header{padding:28px 18px}h1{font-size:24px}main{padding:16px}section,nav,aside{padding:16px}h2{font-size:20px}.journey{grid-template-columns:1fr}figcaption{min-height:0}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{header{print-color-adjust:exact}.journey{grid-template-columns:repeat(3,minmax(0,1fr))}figure{break-inside:avoid;content-visibility:visible}details{display:none}dialog{display:none}}'
    + '</style></head><body><header><h1>' + esc(report.project) + '｜測試報告</h1><p>' + esc(state) + '</p><div class="pills"><span>' + esc(new Date(report.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })) + '</span>' + counts.map(row => '<span>' + label(row.status) + ' ' + row.count + '</span>').join('') + '</div></header><main><nav aria-label="測試情境">'
    + cases.map((item, index) => '<a href="#case-' + index + '">' + esc(item.caseId || item.id) + ' ' + esc(item.name) + ' · ' + label(item.status) + '</a>').join('') + '</nav>' + cards
    + '<aside><h2>測試範圍與清理</h2><p>圖片與結果屬於本次執行。沒有保存的資料明示未提供；截圖可點擊放大。</p><p>完整操作與回應可展開查看，未完成清理會在對應案例標示。</p></aside></main>'
    + (anyShots ? '<dialog id="zoom" aria-labelledby="zoom-caption"><div class="zoom-head"><strong id="zoom-caption"></strong><button id="close" type="button">關閉 ×</button></div><img id="full" alt=""></dialog>' : '') + payload + runtime + '</body></html>';
}
