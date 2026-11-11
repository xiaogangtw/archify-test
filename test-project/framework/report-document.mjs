export const REPORT_DOCUMENT_ID = 'archify-report-data';
export const MAX_REPORT_BYTES = 512 * 1024 * 1024;

export function encodeReport(report) {
  return JSON.stringify(report).replace(/[<>&\u2028\u2029]/g, char =>
    '\\u' + char.charCodeAt(0).toString(16).padStart(4, '0'));
}

// Extract data only. Never execute an imported report's HTML or scripts.
export function readReportDocument(source) {
  if (source.trimStart().startsWith('{')) return JSON.parse(source);
  const match = source.match(/<script id="archify-report-data" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('HTML未包含Archify單檔報告資料；舊版請讀取同名JSON。');
  const report = JSON.parse(match[1]);
  if (report?.schemaVersion !== 1 || !Array.isArray(report.cases)) throw new Error('報告資料格式不相容。');
  return report;
}
