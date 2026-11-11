import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { checkUiEvidence } from './check-ui-evidence.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../package.json', import.meta.url));
const mode = process.argv[2];
if(!['flow','test','api','web','android','ui'].includes(mode))throw new Error('測試模式不合法。');
const targets=mode==='ui'?['web']:['api','web','android'].includes(mode)?[mode]:[];
if (['web', 'ui'].includes(mode)) checkUiEvidence(root);
const child = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test', ...(mode==='flow'?['--list']:[]), ...targets.map(target=>'--project='+target), ...process.argv.slice(3)], {
  cwd: root, stdio: 'inherit', windowsHide: true, env: { ...process.env, ARCHIFY_REPORT_MODE:mode==='flow'?'flow':'execution',...(targets.length===1?{ARCHIFY_TEST_TARGET:targets[0]}:{}) },
});
child.on('error', () => { process.exitCode = 1; }); child.on('exit', code => { process.exitCode = code ?? 1; });
