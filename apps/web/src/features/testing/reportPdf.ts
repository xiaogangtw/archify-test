import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import theme from '../../../tailwind.config';
import { stepEvidence, reportTitle, displayTime, executionSummary, outcomeLabels, type QualityReport } from './executionReportModel';

const palette = theme.theme.extend.colors.report;
// CSS px convert to PDF points at 72/96; report sizes stay in shared tokens.
const reportType = theme.theme.extend.fontSize;
const fontSize = { body: parseFloat(reportType['report-body'][0]) * 16 * 72 / 96, heading: parseFloat(reportType['report-heading'][0]) * 16 * 72 / 96 };
const paper = { width: 595, height: 842, margin: 48, bottom: 72, top: 76 };
const tones = { ink: palette.ink, muted: palette.muted, brand: palette.brand.DEFAULT, line: palette.line, surface: palette.surface, canvas: palette.canvas,
  passed: palette.success.DEFAULT, failed: palette.danger.DEFAULT, skipped: palette.warning.DEFAULT, cancelled: palette.muted, queued: palette.muted, running: palette.brand.DEFAULT };
const pdfColor = (hex: string) => rgb(...[1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255) as [number, number, number]);
let fontFiles: Promise<Uint8Array[]> | undefined;
const assetBase = (import.meta as ImportMeta & { env: { BASE_URL: string } }).env.BASE_URL;
function loadFonts() {
  return fontFiles ||= Promise.all(['Inter-Regular.ttf', 'Inter-Medium.ttf', 'NotoSansTC-Regular.ttf', 'NotoSansTC-Medium.ttf'].map(async name => {
    const response = await fetch(`${assetBase}fonts/${name}`, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error('報告字型載入失敗，請確認前端字型檔已部署後重試。');
    return new Uint8Array(await response.arrayBuffer());
  })).catch(error => { fontFiles = undefined; throw error; });
}

export async function createReportPdf(report: QualityReport): Promise<Blob> {
  if (!report.ready) throw new Error('執行結束後即可下載報告。');
  const bytes = await loadFonts();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle('執行品質報告 - ' + reportTitle(report));
  doc.setAuthor('Archify Test'); doc.setCreator('Archify Test'); doc.setLanguage('zh-TW');
  const fonts = await Promise.all(bytes.map(value => doc.embedFont(value, { subset: false, features: { liga: false } })));
  const glyphs = fonts.map(font => new Set(font.getCharacterSet()));
  const fontFor = (char: string, medium: boolean) => {
    const index = char.codePointAt(0)! <= 0x024f ? (medium ? 1 : 0) : (medium ? 3 : 2);
    if (!glyphs[index].has(char.codePointAt(0)!)) throw new Error('報告字型不支援字元 U+' + char.codePointAt(0)!.toString(16).toUpperCase() + '，請調整內容或補充字型。');
    return fonts[index];
  };
  const widthCache = new Map<string, number>();
  function charWidth(char: string, size: number, medium: boolean) {
    const key = `${size}:${medium}:${char}`;
    if (!widthCache.has(key)) widthCache.set(key, fontFor(char, medium).widthOfTextAtSize(char, size));
    return widthCache.get(key)!;
  }
  function wrap(value: string, width: number, size: number, medium = false) {
    const lines: string[] = []; let line = '', used = 0;
    const tokens = String(value).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').match(/[A-Za-z0-9._:/@?=&%#-]+|[^\n]|\n/gu) || [];
    for (const token of tokens) {
      if (token === '\n') { lines.push(line); line = ''; used = 0; continue; }
      const tokenWidth = Array.from(token).reduce((sum, char) => sum + charWidth(char, size, medium), 0);
      if (line && used + tokenWidth > width) { lines.push(line); line = ''; used = 0; }
      for (const char of token) {
        const next = charWidth(char, size, medium);
        if (line && used + next > width) { lines.push(line); line = ''; used = 0; }
        line += char; used += next;
      }
    }
    lines.push(line); return lines;
  }
  let page: PDFPage, y = paper.top;
  function drawLine(value: string, x: number, top: number, size: number, medium = false, tone = tones.ink) {
    let run = '', current: PDFFont | undefined;
    const flush = () => { if (!run || !current) return; page.drawText(run, { x, y: paper.height - top - size, font: current, size, color: pdfColor(tone) }); x += current.widthOfTextAtSize(run, size); run = ''; };
    for (const char of value) { const font = fontFor(char, medium); if (current !== font) { flush(); current = font; } run += char; }
    flush();
  }
  function newPage() {
    page = doc.addPage([paper.width, paper.height]); y = paper.top;
    drawLine('Archify Test / 品質報告', paper.margin, 28, fontSize.body, true, tones.brand);
    page.drawLine({ start: { x: paper.margin, y: paper.height - 58 }, end: { x: paper.width - paper.margin, y: paper.height - 58 }, thickness: 0.5, color: pdfColor(tones.line) });
  }
  function room(height: number) { if (y + height > paper.height - paper.bottom) newPage(); }
  function text(value: string, size = fontSize.body, medium = false, tone = tones.ink) {
    for (const line of wrap(value, paper.width - paper.margin * 2, size, medium)) { room(size * 1.5); drawLine(line, paper.margin, y, size, medium, tone); y += size * 1.5; }
  }
  function heading(value: string) { room(fontSize.heading * 1.5 + 20 + (fontSize.heading * 1.5 + 16) * 2); y += 12; text(value, fontSize.heading, true); y += 8; }
  function table(headers: string[], rows: string[][], widths: number[]) {
    const size = fontSize.body, lineHeight = fontSize.heading * 1.5, inset = 8;
    function row(lines: string[][], header: boolean, start: number, count: number) {
      const height = count * lineHeight + inset * 2;
      if (header) page.drawRectangle({ x: paper.margin, y: paper.height - y - height, width: widths.reduce((sum, value) => sum + value, 0), height, color: pdfColor(tones.canvas) });
      let x = paper.margin;
      lines.forEach((cell, index) => { cell.slice(start, start + count).forEach((line, offset) => drawLine(line, x + inset, y + inset + offset * lineHeight, size, header)); x += widths[index]; });
      y += height;
      page.drawLine({ start: { x: paper.margin, y: paper.height - y }, end: { x: paper.width - paper.margin, y: paper.height - y }, thickness: 0.5, color: pdfColor(tones.line) });
    }
    const headerLines = headers.map((value, index) => wrap(value, widths[index] - inset * 2, size, true));
    const headerHeight = Math.max(...headerLines.map(lines => lines.length)) * lineHeight + inset * 2;
    const header = () => row(headerLines, true, 0, Math.max(...headerLines.map(lines => lines.length)));
    room(headerHeight + lineHeight + inset * 2); header();
    for (const values of rows) {
      const lines = values.map((value, index) => wrap(value, widths[index] - inset * 2, size));
      const count = Math.max(...lines.map(cell => cell.length)); let start = 0;
      if (count * lineHeight + inset * 2 <= paper.height - paper.bottom - paper.top - headerHeight && y + count * lineHeight + inset * 2 > paper.height - paper.bottom) { newPage(); header(); }
      while (start < count) {
        const available = Math.floor((paper.height - paper.bottom - y - inset * 2) / lineHeight);
        if (available < 1) { newPage(); header(); continue; }
        const take = Math.min(count - start, available); row(lines, false, start, take); start += take;
        if (start < count) { newPage(); header(); }
      }
    }
    y += 12;
  }
  newPage(); text('執行品質報告', fontSize.heading, true); y += 12;
  text(reportTitle(report), fontSize.heading, true);
  text('測試版本：' + report.testVersion, fontSize.body, false, tones.muted);
  text('執行時間：' + displayTime(report.createdAt), fontSize.body, false, tones.muted);
  heading('結果摘要');
  table(['結果', '案例數'], Object.entries(report.counts).filter(([, count]) => count > 0).map(([status, count]) => [outcomeLabels[status as keyof typeof outcomeLabels], String(count)]), [349, 150]);
  text('總計 ' + report.total + ' 個已保存的案例執行紀錄。', fontSize.body, false, tones.muted);
  text('略過與取消不計為成功；沒有推估程式碼覆蓋率。', fontSize.body, false, tones.muted);
  text('本報告僅含執行紀錄，未附畫面截圖。', fontSize.body, false, tones.muted);
  heading('案例總覽');
  table(['案例', '結果', '腳本版本'], report.records.map((record, index) => [`${index + 1}. ${record.scriptName || record.scriptId}`, outcomeLabels[record.status], String(record.scriptVersion)]), [289, 110, 100]);
  for (const [index, record] of report.records.entries()) {
    newPage(); text(`${index + 1}. ${record.scriptName || record.scriptId}`, fontSize.heading, true);
    text(`${outcomeLabels[record.status]} / 腳本第 ${record.scriptVersion} 版`, fontSize.body, true, tones[record.status]);
    text('執行環境：' + (record.environment === 'isolated-fixture' ? '隔離測試環境' : record.environment) + (record.deploymentVerified ? '' : '（未核對實際部署版本）'));
    text('開始：' + displayTime(record.startedAt)); text('結束：' + displayTime(record.finishedAt));
    text('執行 ID：' + record.id, fontSize.body, false, tones.muted);
    if (record.message) { heading('執行摘要'); text(executionSummary(record.message)); }
    heading('步驟與結果');
    const events = (record.events || []).filter(item => ['step-end', 'error'].includes(item.event.type));
    if (!events.length) text('沒有步驟紀錄。', fontSize.body, false, tones.muted);
    else table(['步驟', '結果', '說明'], events.map((item, stepIndex) => [`${stepIndex + 1}. ${item.event.title || '執行錯誤'}`, outcomeLabels[item.event.status as keyof typeof outcomeLabels] || '未確認', [stepEvidence(item.event),item.event.message].filter(Boolean).join('\n')]), [199, 100, 200]);
    heading('版本與來源');
    text('來源快照：' + (record.sourceSnapshotId || record.importedSnapshotId || '未記錄'), fontSize.body, false, tones.muted);
    if (record.sourceHash) text('腳本 SHA256：' + record.sourceHash, fontSize.body, false, tones.muted);
    if (record.sourceContentHash) text('來源內容指紋：' + record.sourceContentHash, fontSize.body, false, tones.muted);
    const commits = record.manualCommits || report.manualCommits;
    if (commits && Object.values(commits).some(Boolean)) {
      heading('手動填入的 Git commit（未核對部署）');
      for (const [role, label] of [['frontend', '前端'], ['bff', '中間層'], ['backend', '後端']] as const) if (commits[role]) text(label + '：' + commits[role], fontSize.body, false, tones.muted);
    }
    for (const repo of record.repositories) {
      text(({ frontend: '前端', bff: 'BFF', backend: '後端' })[repo.role] + ' / ' + repo.commitSha);
      text('QA tag：' + (repo.qaTag || '未記錄') + ' / ' + (repo.tagMatchesRelease ? '與 release 相同' : '與 release 不同'), fontSize.body, false, tones.muted);
    }
  }
  const pages = doc.getPages();
  pages.forEach((item, index) => { page = item; drawLine(`Archify Test / ${index + 1} / ${pages.length}`, paper.margin, paper.height - 40, fontSize.body, false, tones.muted); });
  const result = await doc.save();
  return new Blob([result.buffer as ArrayBuffer], { type: 'application/pdf' });
}
export async function downloadReportPdf(report: QualityReport) {
  const blob = await createReportPdf(report), url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = (reportTitle(report) + '-' + report.testVersion).replace(/[^\p{L}\p{N}._-]/gu, '_') + '.pdf'; link.className = 'hidden'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
