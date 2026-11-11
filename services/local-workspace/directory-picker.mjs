import { spawn } from 'node:child_process';

const pickerScript = `
Add-Type -ReferencedAssemblies System.Windows.Forms,System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

public static class ArchifyDirectoryPicker {
  [ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
  private class FileOpenDialogRCW {}

  [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IFileDialog {
    [PreserveSig] int Show(IntPtr parent);
    void SetFileTypes(uint cFileTypes, IntPtr rgFilterSpec);
    void SetFileTypeIndex(uint iFileType);
    void GetFileTypeIndex(out uint piFileType);
    void Advise(IntPtr pfde, out uint pdwCookie);
    void Unadvise(uint dwCookie);
    void SetOptions(uint fos);
    void GetOptions(out uint pfos);
    void SetDefaultFolder(IShellItem psi);
    void SetFolder(IShellItem psi);
    void GetFolder(out IShellItem ppsi);
    void GetCurrentSelection(out IShellItem ppsi);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string pszName);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string pszText);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
    void GetResult(out IShellItem ppsi);
    void AddPlace(IShellItem psi, int fdap);
    void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
    void Close(int hr);
    void SetClientGuid(ref Guid guid);
    void ClearClientData();
    void SetFilter(IntPtr pFilter);
  }

  [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  private interface IShellItem {
    void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
    void GetParent(out IShellItem ppsi);
    void GetDisplayName(uint sigdnName, out IntPtr ppszName);
    void GetAttributes(uint sfgaoMask, out uint psfgaoAttribs);
    void Compare(IShellItem psi, uint hint, out int piOrder);
  }

  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  private static extern int SHCreateItemFromParsingName(string pszPath, IntPtr pbc, ref Guid riid, out IShellItem ppv);

  [DllImport("user32.dll")]
  private static extern bool SetForegroundWindow(IntPtr hWnd);

  public static string Pick(string title, string initial, bool allowCreate) {
    Console.OutputEncoding = new UTF8Encoding(false);
    var area = Screen.PrimaryScreen != null ? Screen.PrimaryScreen.WorkingArea : new Rectangle(0, 0, 1280, 720);
    var owner = new Form {
      FormBorderStyle = FormBorderStyle.None,
      ShowInTaskbar = false,
      StartPosition = FormStartPosition.Manual,
      Location = new Point(area.Left + area.Width / 2, area.Top + area.Height / 2),
      Size = new Size(1, 1),
      Opacity = 0,
      TopMost = true
    };
    try {
      owner.Show();
      owner.Activate();
      SetForegroundWindow(owner.Handle);
      try {
        var dialog = (IFileDialog)new FileOpenDialogRCW();
        try {
          uint opts;
          dialog.GetOptions(out opts);
          dialog.SetOptions(opts | 0x20u | 0x40u | 0x800u | 0x08u);
          dialog.SetTitle(title);
          if (!string.IsNullOrEmpty(initial) && Directory.Exists(initial)) {
            var iid = typeof(IShellItem).GUID;
            IShellItem folder;
            if (SHCreateItemFromParsingName(initial, IntPtr.Zero, ref iid, out folder) == 0 && folder != null) {
              dialog.SetFolder(folder);
              Marshal.ReleaseComObject(folder);
            }
          }
          int hr = dialog.Show(owner.Handle);
          if (hr == 0) {
            IShellItem item;
            dialog.GetResult(out item);
            if (item != null) {
              try {
                IntPtr ptr;
                item.GetDisplayName(0x80058000u, out ptr);
                if (ptr != IntPtr.Zero) {
                  try { return Marshal.PtrToStringUni(ptr) ?? ""; }
                  finally { Marshal.FreeCoTaskMem(ptr); }
                }
              } finally { Marshal.ReleaseComObject(item); }
            }
          }
          if (hr == unchecked((int)0x800704C7)) return "";
        } finally {
          Marshal.ReleaseComObject(dialog);
        }
      } catch {
        // Fallback to legacy WinForms dialog only if IFileDialog COM fails.
      }
      var fallback = new FolderBrowserDialog {
        Description = title,
        ShowNewFolderButton = allowCreate
      };
      if (!string.IsNullOrEmpty(initial) && Directory.Exists(initial)) fallback.SelectedPath = initial;
      try { return fallback.ShowDialog(owner) == DialogResult.OK ? fallback.SelectedPath : ""; }
      finally { fallback.Dispose(); }
    } finally {
      owner.Dispose();
    }
  }
}
'@
$selected = [ArchifyDirectoryPicker]::Pick($env:ARCHIFY_PICK_LABEL, $env:ARCHIFY_PICK_INITIAL, $env:ARCHIFY_PICK_KIND -eq 'project')
if ($selected) { [Console]::Write($selected) }
`;

const encodedScript = Buffer.from(pickerScript, 'utf16le').toString('base64');

// Native picker is only opened by an authenticated, explicit user action.
export async function pickDirectory(kind, initial = '', { signal } = {}) {
  if (!['source', 'project'].includes(kind)) throw new Error('資料夾用途不合法。');
  if (process.platform !== 'win32') throw new Error('此系統請直接貼上資料夾完整路徑。');
  if (signal?.aborted) return { path: '', cancelled: true };

  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-NonInteractive', '-EncodedCommand', encodedScript], {
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ARCHIFY_PICK_LABEL: kind === 'source' ? '選擇前端專案' : '選擇建立腳本的位置',
        ARCHIFY_PICK_KIND: kind,
        ARCHIFY_PICK_INITIAL: initial,
      },
    });

    const chunks = [];
    let bytes = 0;
    let settled = false;
    let aborted = false;

    const killChild = () => {
      if (!child.killed) {
        try { child.kill(); } catch {}
      }
    };

    const onAbort = () => {
      aborted = true;
      killChild();
      finish(null, { path: '', cancelled: true });
    };

    const timer = setTimeout(() => {
      killChild();
      finish(new Error('資料夾選擇器無法開啟或已逾時，請直接貼上完整路徑。'));
    }, 300000);

    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (err) reject(err);
      else resolve(value);
    };

    signal?.addEventListener('abort', onAbort, { once: true });

    child.stdout.on('data', chunk => {
      bytes += chunk.length;
      if (bytes <= 16384) chunks.push(chunk);
    });
    child.stderr.on('data', () => {});
    child.once('error', () => finish(new Error('資料夾選擇器無法開啟或已逾時，請直接貼上完整路徑。')));
    child.once('close', code => {
      if (aborted || signal?.aborted) return finish(null, { path: '', cancelled: true });
      if (code !== 0) return finish(new Error('資料夾選擇器無法開啟或已逾時，請直接貼上完整路徑。'));
      const path = Buffer.concat(chunks).toString('utf8').trim();
      finish(null, { path, cancelled: !path });
    });
  });
}
