// Keep driver diagnostics bounded; never persist response bodies or stack traces.
export function driverMessage(message, body) {
  let text = String(message || '').split(/\n\s*(?:at |Stacktrace:)/)[0].slice(0, 8000);
  const values = [];
  const visit = value => {
    if (typeof value === 'string' && value) values.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(body);
  for (const value of values.sort((a, b) => b.length - a.length)) text = text.split(value).join('[已遮蔽]');
  return text.replace(/https?:\/\/\S+/gi, '[URL 已遮蔽]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [已遮蔽]')
    .replace(/((?:token|password|passwd|secret|authorization|api[_-]?key)\s*[:=]\s*)\S+/gi, '$1[已遮蔽]')
    .replace(/"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g, '[引號內容已遮蔽]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[Email 已遮蔽]')
    .slice(0, 1200);
}
