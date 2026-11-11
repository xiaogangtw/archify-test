import { readFile, writeFile, mkdir, rename, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const defaultRoot = fileURLToPath(new URL('../../.local/android-devices', import.meta.url));
export const profileAvd = id => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new Error('無效固定手機識別碼。');
  return `Archify_Device_${id.replaceAll('-', '')}`;
};
export function createProfileCatalog(root = defaultRoot) {
  const file = join(root, 'catalog.json');
  let sequence = Promise.resolve();
  async function list() {
    let data;
    try { data = JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return []; throw new Error('固定手機紀錄無法讀取，請保留資料並檢查執行主機。'); }
    if (!Array.isArray(data) || data.some(row => profileAvd(row.id) !== row.avd)) throw new Error('固定手機紀錄格式錯誤。');
    return data;
  }
  function add(row) {
    const job = sequence.then(async () => {
      const rows = await list();
      if (rows.some(value => value.id === row.id)) return;
      await mkdir(root, { recursive: true });
      const temp = file + '.tmp';
      await writeFile(temp, JSON.stringify([...rows, row]), { mode: 0o600 }); await rename(temp, file);
    });
    sequence = job.catch(() => {}); return job;
  }
  return { list, add, path: id => join(root, profileAvd(id), 'avd') };
}
export async function prepareProfile(tools, id, catalog, env = process.env) {
  const avd = profileAvd(id), path = catalog.path(id);
  if ((await catalog.list()).some(row => row.id === id)) { await access(join(path, 'config.ini')); return { profileId: id, avd }; }
  const classpath = join(tools.root, 'cmdline-tools', 'latest', 'lib', 'avdmanager-classpath.jar');
  await access(classpath);
  await mkdir(dirname(path), { recursive: true });
  // A prior interrupted creation can be adopted only at this UUID's dedicated
  // directory. Never use --force or copy an existing account's user-data image.
  let existing = false; try { await access(join(path, 'config.ini')); existing = true; } catch {}
  if (!existing) {
    const java = env.JAVA_HOME ? join(env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java';
    await new Promise((resolve, reject) => {
      const child = spawn(java, [`-Dcom.android.sdkmanager.toolsdir=${join(tools.root, 'cmdline-tools', 'latest')}`, '-classpath', classpath, 'com.android.sdklib.tool.AvdManagerCli', 'create', 'avd', '--name', avd, '--path', path, '--package', 'system-images;android-35;google_apis_playstore;x86_64', '--device', 'pixel_6'], { windowsHide: true, env: { ...env, ANDROID_HOME: tools.root, ANDROID_SDK_ROOT: tools.root }, stdio: ['pipe', 'ignore', 'ignore'] });
      const timer = setTimeout(() => { child.kill(); reject(new Error('建立手機逾時，可從固定手機清單重試；現有資料未清除。')); }, 20000);
      child.on('error', () => { clearTimeout(timer); reject(new Error('建立手機需要 Java 與 Android SDK Command-line Tools。')); });
      child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('建立手機失敗，請確認已安裝 Android 35 Google Play 系統映像。')); });
      child.stdin.on('error', () => {}); child.stdin.end('no\n');
    });
  }
  const configFile = join(path, 'config.ini');
  const config = await readFile(configFile, 'utf8');
  await writeFile(configFile, config.replace(/^PlayStore\.enabled=.*$/m, 'PlayStore.enabled=yes').replace(/^hw\.gpu\.enabled=.*$/m, 'hw.gpu.enabled=yes'), { mode: 0o600 });
  await catalog.add({ id, avd }); return { profileId: id, avd };
}
