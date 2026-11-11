import { createConnection } from 'node:net';

// NAT can accept TCP while the guest is frozen. Require an actual SSH banner.
export function readSshBanner(timeoutMs = 5000) {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port: 2222 });
    let buffer = '', settled = false;
    const finish = ready => { if (settled) return; settled = true; socket.destroy(); resolve(ready); };
    socket.setTimeout(timeoutMs);
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      if (buffer.length > 4096) return finish(false);
      if (buffer.split(/\r?\n/).some(line => /^SSH-(2\.0|1\.99)-\S+/.test(line))) finish(true);
    });
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
    socket.once('end', () => finish(false));
  });
}

export async function waitForSsh({ timeoutMs = 90000, probe = readSshBanner, pause = ms => new Promise(resolve => setTimeout(resolve, ms)), onWait = () => {} } = {}) {
  const deadline = Date.now() + timeoutMs;
  let notified = false;
  while (Date.now() < deadline) {
    if (await probe(Math.min(5000, deadline - Date.now()))) return;
    if (!notified) { onWait(); notified = true; }
    const remaining = deadline - Date.now();
    if (remaining > 0) await pause(Math.min(2000, remaining));
  }
  throw new Error('VM 的 2222 轉送埠沒有回傳 SSH 招呼訊息；尚未進入登入或啟動後端。請查看 Ubuntu VM 是否停頓，不必重新 pair 或建置。');
}
