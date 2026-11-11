import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../../scripts/android-host-process.ps1', import.meta.url));
// Windows host control is independent of Android shell, ADB, and guest boot.
export function createHostControl(execute) {
  async function command(root, args, timeout = 5000) {
    return execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', script, '-SdkRoot', root, ...args], false, timeout);
  }
  async function list(root) {
    const rows = JSON.parse(await command(root, ['-Action', 'list']));
    if (!Array.isArray(rows) || rows.some(row => !Number.isInteger(row.pid) || row.pid <= 0 || typeof row.createdAt !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(row.avd) || !/^emulator-\d+$/.test(row.serial))) throw new Error('無法驗證模擬器程序清單。');
    return rows;
  }
  return { list,
    async stop(root, serial, avd) {
      const deadline = Date.now() + 10000;
      const remaining = () => {
        const value = deadline - Date.now();
        if (value <= 0) throw new Error('主機關機驗證逾時，未標記為已關機。');
        return Math.min(5000, value);
      };
      const rows = (await list(root)).filter(row => row.serial === serial);
      if (!rows.length) return;
      if (rows.length > 2 || rows.some(row => row.avd !== avd)) throw new Error('無法確認手機程序身分，未強制停止；請由主機管理者檢查。');
      // Kill the verified guest process before its launcher. Recheck each PID's
      // creation time, executable, AVD and port immediately before termination.
      for (const row of rows.sort((a, b) => Number(a.launcher) - Number(b.launcher))) await command(root, ['-Action', 'stop', '-TargetId', String(row.pid), '-CreatedAt', row.createdAt, '-Avd', avd, '-Port', serial.slice(9)], remaining());
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = JSON.parse(await command(root, ['-Action', 'list'], remaining()));
        if (!Array.isArray(current)) throw new Error('無法驗證模擬器程序清單。');
        if (!current.some(row => row.serial === serial)) return;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      throw new Error('手機程序尚未結束，未標記為已關機。');
    },
  };
}
