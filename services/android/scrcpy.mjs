import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { createConnection } from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import manifest from './scrcpy-manifest.json' with {type:'json'};
import { controlPacket, ScrcpyVideoParser } from './scrcpy-protocol.mjs';

const binary = fileURLToPath(new URL('../../.local/scrcpy/scrcpy-server-v3.3.3', import.meta.url));
let preparation;
export function prepareScrcpy() {
  if (!preparation) preparation = prepareArtifact().catch(error => { preparation = undefined; throw error; });
  return preparation;
}
async function prepareArtifact() {
  await mkdir(fileURLToPath(new URL('../../.local/scrcpy', import.meta.url)), { recursive: true });
  let content; try { content = await readFile(binary); } catch { /* First run downloads the pinned artifact. */ }
  if (content && createHash('sha256').update(content).digest('hex') === manifest.sha256) return binary;
  const response = await fetch(manifest.url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error('無法下載 Scrcpy，請檢查執行主機的網路。');
  content = Buffer.from(await response.arrayBuffer());
  if (content.length > 5000000 || createHash('sha256').update(content).digest('hex') !== manifest.sha256) throw new Error('Scrcpy 校驗失敗，拒絕執行。');
  const temp = binary + '.tmp'; await writeFile(temp, content, { mode: 0o600 }); await rename(temp, binary); return binary;
}
async function socket(port) {
  return new Promise((resolve, reject) => {
    const stream = createConnection({ host: '127.0.0.1', port });
    const timeout = setTimeout(() => { stream.destroy(); reject(new Error('Scrcpy 連線逾時。')); }, 2000);
    stream.once('connect', () => { clearTimeout(timeout); stream.setNoDelay(true); stream.pause(); resolve(stream); });
    stream.once('error', error => { clearTimeout(timeout); reject(error); });
  });
}
export async function openScrcpy({ adb, execute, serial, onMetadata, onPacket, onClose }) {
  if (!/^emulator-\d+$/.test(serial)) throw new Error('無效模擬器。');
  const server = await prepareScrcpy();
  const scid = (randomBytes(4).readUInt32BE() & 0x7fffffff).toString(16).padStart(8, '0');
  const devicePath = `/data/local/tmp/archify-scrcpy-server-v3.3.3-${scid}.jar`;
  let process, video, control, port, closed = false;
  const active = new Map();
  const close = () => {
    if (closed) return; closed = true;
    if (control && !control.destroyed) for (const event of active.values()) control.write(controlPacket({ ...event, action: 1 }));
    active.clear(); video?.destroy(); control?.end(); process?.kill();
    if (port) void execute(adb, ['-s', serial, 'forward', '--remove', `tcp:${port}`]).catch(() => {});
    onClose?.();
  };
  try {
    await execute(adb, ['-s', serial, 'push', server, devicePath]);
    port = Number((await execute(adb, ['-s', serial, 'forward', 'tcp:0', `localabstract:scrcpy_${scid}`])).trim());
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('無效 ADB 轉送連接埠。');
    process = spawn(adb, ['-s', serial, 'shell', `CLASSPATH=${devicePath}`, 'app_process', '/', 'com.genymobile.scrcpy.Server', manifest.version,
      `scid=${scid}`, 'tunnel_forward=true', 'audio=false', 'control=true', 'video_codec=h264', 'max_size=1024', 'max_fps=30', 'video_bit_rate=3000000',
      'clipboard_autosync=false', 'log_level=warn'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let errorText = '';
    process.stdout.on('data', chunk => { errorText = (errorText + chunk.toString()).slice(-2000); });
    process.stderr.on('data', chunk => { errorText = (errorText + chunk.toString()).slice(-2000); });
    process.on('error', close); process.on('exit', close);
    // The forward may accept TCP before the Android socket exists. Wait for the
    // server's dummy byte before opening its second (control) connection.
    for (let attempt = 0; attempt < 50 && !closed; attempt++) {
      try {
        const candidate = await socket(port);
        const valid = await new Promise(resolve => {
          const timer = setTimeout(() => resolve(false), 500);
          candidate.once('readable', () => { clearTimeout(timer); resolve(candidate.read(1)?.[0] === 0); });
          candidate.once('end', () => { clearTimeout(timer); resolve(false); });
          candidate.once('error', () => { clearTimeout(timer); resolve(false); });
        });
        if (valid) { video = candidate; break; } candidate.destroy();
      } catch { /* Server is still starting. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!video || closed) throw new Error(errorText.includes('unauthorized') ? 'ADB 尚未授權。' : 'Scrcpy 伺服器未能啟動。');
    control = await socket(port); control.on('error', close); control.on('close', close); control.resume();
    const parser = new ScrcpyVideoParser(onMetadata, onPacket);
    // The dummy byte was consumed above; reinsert it for the parser's header.
    parser.feed(Buffer.from([0]));
    video.on('data', chunk => { try { parser.feed(chunk); } catch { close(); } });
    video.on('error', close); video.on('end', close); video.resume();
    return {
      close,
      send(event) {
        if (closed || control.destroyed || control.writableLength > 65536) throw new Error('Scrcpy 控制連線已中斷或壅塞。');
        const packet = controlPacket(event);
        if (event.type === 'touch') { if (event.action === 1) active.delete(event.pointerId); else active.set(event.pointerId, event); }
        control.write(packet);
      },
    };
  } catch (error) { close(); throw error; }
}
