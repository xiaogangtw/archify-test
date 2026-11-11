import { readdir, lstat, readFile, open } from 'node:fs/promises';
import { child, noLinks } from './paths.mjs';
import { isReportFilename } from '../../test-project/framework/report-name.mjs';
import { readReportDocument, MAX_REPORT_BYTES } from '../../test-project/framework/report-document.mjs';

export async function listReports(config) {
  const rows = [];
  for (const group of ['', 'api', 'ui']) {
    const directory = child(config.projectRoot, config.reportDir + (group ? '/' + group : ''));
    await noLinks(directory);
    let names;
    try { names = await readdir(directory); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const existing = new Set(names);
    for (const name of names.filter(isReportFilename)) {
      // Legacy HTML/JSON pairs count once; old evidence volumes remain available.
      if (name.endsWith('.html') && existing.has(name.replace(/\.html$/, '.json'))) continue;
      const path = child(directory, name);
      await noLinks(path);
      const stat = await lstat(path);
      if (!stat.isFile()) continue;
      if (name.endsWith('.html')) {
        const handle = await open(path, 'r');
        try {
          const prefix = Buffer.alloc(4096);
          const { bytesRead } = await handle.read(prefix, 0, prefix.length, 0);
          if (!prefix.subarray(0, bytesRead).toString('utf8').includes('name="archify-report-format" content="single-file-v1"')) continue;
        } finally { await handle.close(); }
      }
      rows.push({ name: (group ? group + '/' : '') + name, ...(group ? { testType: group } : {}),
        size: stat.size, modifiedAt: stat.mtime.toISOString() });
    }
  }
  return rows.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.name.localeCompare(b.name));
}

export async function readReport(config, name) {
  if (!isReportFilename(name)) throw new Error('報告檔名不合法。');
  const path = child(config.projectRoot, config.reportDir + '/' + name);
  await noLinks(path);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.size > MAX_REPORT_BYTES) throw new Error('報告必須為512MB以內的Archify單檔HTML或舊版JSON；原檔已保留。');
  return readReportDocument(await readFile(path, 'utf8'));
}
