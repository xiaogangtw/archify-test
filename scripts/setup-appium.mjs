import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../.local/appium', import.meta.url));
await mkdir(root, { recursive: true });
await writeFile(new URL('../.local/appium/package.json', import.meta.url), JSON.stringify({ private: true, dependencies: { appium: '3.9.0', 'appium-uiautomator2-driver': '8.7.2' } }, null, 2));
if (!process.env.npm_execpath) throw new Error('請透過 npm run android:appium:setup 執行。');
const child = spawn(process.execPath, [process.env.npm_execpath, 'install', '--prefix', root], { stdio: 'inherit', windowsHide: true });
child.on('error', () => { process.exitCode = 1; }); child.on('exit', code => { process.exitCode = code === 0 ? 0 : 1; if (code === 0) console.log('Appium 與 UiAutomator2 已安裝；下次啟動 Android worker 會自動啟動本機服務。'); });
