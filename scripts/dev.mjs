import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const web = fileURLToPath(new URL('../apps/web/', import.meta.url));
const vite = join(dirname(createRequire(new URL('../apps/web/package.json', import.meta.url)).resolve('vite/package.json')), 'bin/vite.js');
const child = spawn(process.execPath, [vite, '--host', '127.0.0.1'], {
  cwd: web, stdio: 'inherit', windowsHide: true,
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
