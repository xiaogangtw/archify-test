import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const root = resolve(process.argv[2]);
const backup = resolve(root, 'legacy/framework-upgrades/ui-progress-' + Date.now());
function save(part, content) {
  const target = resolve(root, part), previous = readFileSync(target, 'utf8');
  if (previous === content) return;
  const old = resolve(backup, part); mkdirSync(dirname(old), { recursive: true });
  copyFileSync(target, old); writeFileSync(target, content);
  console.log('已更新：' + part);
}
for (const part of ['support/archify-reporter.mjs', 'support/commands.mjs']) save(part, readFileSync(new URL('../test-project/' + part, import.meta.url), 'utf8'));
let part = 'playwright.config.ts';
const config = readFileSync(resolve(root, part), 'utf8');
save(part, config.includes('actionTimeout:15000') ? config : config.replace("channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',", "channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',actionTimeout:15000,navigationTimeout:30000,"));
console.log('備份：' + backup);
