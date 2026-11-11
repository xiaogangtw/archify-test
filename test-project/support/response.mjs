const sensitive = /token|password|passwd|secret|authorization|cookie|api.?key|private.?key|^message$|^stack$|^stacktrace$/i;
export function redactResponse(value) {
  if (Array.isArray(value)) return value.map(redactResponse);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitive.test(key) ? '[REDACTED]' : redactResponse(item)]));
  return value;
}
/** 不記錄 URL、Header 或原始例外；只附加已遮蔽 JSON。 */
export async function showResponse(response, testInfo) {
  const body = await response.json().then(redactResponse).catch(() => '[非 JSON 回應，未保存原文]');
  const preview = { status: response.status(), body };
  const text = JSON.stringify(preview, null, 2);
  console.log('HTTP response\n' + text);
  await testInfo.attach('archify-response', { body: Buffer.from(text), contentType: 'application/json' });
}
