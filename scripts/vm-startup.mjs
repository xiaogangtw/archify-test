export const readyMarker = '__ARCHIFY_VM_API_READY__';
export const healthProbe = `fetch('http://127.0.0.1:3001/api/health',{signal:AbortSignal.timeout(3000)}).then(async r=>{if(!r.ok||(await r.json()).status!=='ready')process.exit(1)}).catch(()=>process.exit(1))`;

// Probe inside the VM container before allowing clients to use the SSH forward.
// A listening SSH port alone says nothing about API readiness.
export function startupCommand(keepAlive = true) {
  return `set -eu
cd ~/archify-test
diagnose() {
  docker compose ps -a
  printf '%s\\n' 'VM API port mapping:'
  docker compose port control-api 3001 || true
  printf '%s\\n' 'VM host API response:'
  curl -fsS --max-time 3 http://127.0.0.1:3001/api/health || true
  docker compose logs --tail 80 control-api
}
if ! command -v curl >/dev/null 2>&1; then
  printf '%s\\n' 'Missing curl in Ubuntu VM. Install curl before starting Archify.'
  exit 1
fi
printf '%s\\n' 'Starting VM containers and checking health...'
if ! docker compose up -d --wait --wait-timeout 120 postgres control-api launcher; then
  diagnose
  exit 1
fi
printf '%s\\n' 'Containers ready. Checking VM host API port 3001...'
attempt=0
while ! curl -fsS --max-time 3 http://127.0.0.1:3001/api/health 2>/dev/null | grep -Eq '"status"[[:space:]]*:[[:space:]]*"ready"'; do
  state=$(docker compose ps -a --format '{{.State}}' control-api)
  case "$state" in restarting|exited|dead) diagnose; exit 1;; esac
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 10 ]; then
    printf '%s\\n' 'VM host cannot reach API port 3001. Startup stopped.'
    diagnose
    exit 1
  fi
  sleep 2
done
printf '%s\\n' '${readyMarker}'
${keepAlive ? 'exec sleep infinity' : ''}`;
}

// Send one plain ASCII command to Windows OpenSSH. The decoded script retains
// its own quoting instead of going through Windows command-line quoting twice.
export function sshStartupCommand(keepAlive = true) {
  const encoded = Buffer.from(startupCommand(keepAlive), 'utf8').toString('base64');
  return `printf %s ${encoded} | base64 -d | sh`;
}

export function waitForRemoteReady(child, { timeoutMs = 300000, write = text => process.stdout.write(text) } = {}) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => finish(new Error('VM 啟動逾時，後端未通過健康檢查；未啟動本機橋接。')), timeoutMs);
    function finish(error) {
      clearTimeout(timer);
      child.stdout.removeListener('data', data);
      child.removeListener('close', exited);
      child.removeListener('error', failed);
      if (error) reject(error); else resolve();
    }
    function data(chunk) {
      const text = chunk.toString();
      buffer = (buffer + text).slice(-4096);
      // Print bounded startup output, retaining diagnostics while hiding the marker.
      write(text.replaceAll(readyMarker, 'API 健康檢查通過'));
      if (buffer.split(/\r?\n/).some(line => line.trim() === readyMarker)) {
        // Keep Docker/SSH output visible after the startup handshake.
        child.stdout.on('data', chunk => write(chunk.toString()));
        finish();
      }
    }
    const exited = code => finish(new Error(`VM 啟動程序已結束（${code ?? 'signal'}），請查看上方容器錯誤。`));
    const failed = error => finish(error);
    child.stdout.on('data', data);
    child.once('close', exited);
    child.once('error', failed);
  });
}
