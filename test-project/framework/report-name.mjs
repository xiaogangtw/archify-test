export function reportBasename(kind, createdAt, runId) {
  if (!['execution', 'flow'].includes(kind) || !/^[a-f0-9-]{8,}$/i.test(runId)) throw new Error('報告種類或識別不合法');
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime())) throw new Error('報告日期不合法');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3, hourCycle: 'h23',
  }).formatToParts(date).map(item => [item.type, item.value]));
  return `${kind === 'flow' ? 'flow' : 'report'}-${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}-${parts.second}-${parts.fractionalSecond}-${runId.slice(0, 8)}`;
}
export const isReportFilename = name => typeof name === 'string' && /^(?:(?:api|ui)\/)?(report|flow)-[a-zA-Z0-9_-]+\.(?:json|html)$/.test(name);
