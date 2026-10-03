using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace GamepointAgent;

/// <summary>
/// Hard lock enforcement for expired / no-time state (Java Edition).
/// Strategy per shop decision: minimize + block, never kill the game world.
/// - <see cref="LockEnforcement"/> minimizes configured game processes and
///   pins the lock form topmost via SetWindowPos.
/// - <see cref="KeyboardHook"/> swallows Alt+Tab / Win / Alt+F4 / Ctrl+Esc
///   while the lock screen is active. Ctrl+Alt+Del cannot be intercepted
///   by design (Windows security) — server still reports expired.
/// </summary>
internal static class LockEnforcement
{
    private const int SW_MINIMIZE = 6;
    private const int SW_FORCEMINIMIZE = 11;

    private static readonly IntPtr HWND_TOPMOST = new(-1);
    private const uint SWP_NOMOVE = 0x0002;
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_SHOWWINDOW = 0x0040;

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter,
        int x, int y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    /// <summary>Pin a form topmost without moving/resizing it.</summary>
    public static void ForceTopMost(Form form)
    {
        try
        {
            if (form.IsDisposed || !form.Visible) return;
            if (!form.IsHandleCreated) return;
            var h = form.Handle;
            SetWindowPos(h, HWND_TOPMOST, 0, 0, 0, 0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
        }
        catch { }
    }

    private static HashSet<uint> ResolvePids(string[]? names)
    {
        var pids = new HashSet<uint>();
        if (names is null || names.Length == 0) return pids;
        foreach (var raw in names)
        {
            if (string.IsNullOrWhiteSpace(raw)) continue;
            var name = raw.Trim();
            if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                name = name[..^4];
            try
            {
                foreach (var p in Process.GetProcessesByName(name))
                {
                    try { pids.Add((uint)p.Id); }
                    catch { }
                    finally { try { p.Dispose(); } catch { } }
                }
            }
            catch { }
        }
        return pids;
    }

    /// <summary>
    /// Minimize all visible top-level windows owned by the blocked (game)
    /// processes. Safe: never touches our own agent PID.
    /// </summary>
    public static int MinimizeBlockedProcesses(string[]? names)
    {
        var pids = ResolvePids(names);
        if (pids.Count == 0) return 0;
        var own = (uint)Environment.ProcessId;
        pids.Remove(own);
        if (pids.Count == 0) return 0;
        var count = 0;
        try
        {
            EnumWindows((hWnd, _) =>
            {
                try
                {
                    if (!IsWindowVisible(hWnd) || IsIconic(hWnd)) return true;
                    GetWindowThreadProcessId(hWnd, out var pid);
                    if (!pids.Contains(pid)) return true;
                    if (ShowWindow(hWnd, SW_FORCEMINIMIZE) || ShowWindow(hWnd, SW_MINIMIZE))
                        count++;
                }
                catch { }
                return true;
            }, IntPtr.Zero);
        }
        catch { }
        return count;
    }

    /// <summary>
    /// While locked: if the foreground window belongs to a blocked game
    /// process, minimize it, then re-pin the lock form on top.
    /// Regular apps (browser etc.) are left alone — the TopMost overlay
    /// plus keyboard hook already covers them — to avoid nuking staff tools.
    /// </summary>
    public static void ReclaimForeground(Form lockForm, string[]? blockedNames)
    {
        try
        {
            if (lockForm.IsDisposed || !lockForm.Visible) return;
            var fg = GetForegroundWindow();
            if (fg == IntPtr.Zero || fg == lockForm.Handle) { ForceTopMost(lockForm); return; }

            GetWindowThreadProcessId(fg, out var fgPid);
            if (fgPid == (uint)Environment.ProcessId) { ForceTopMost(lockForm); return; }

            var pids = ResolvePids(blockedNames);
            if (pids.Contains(fgPid))
            {
                try
                {
                    if (IsWindowVisible(fg) && !IsIconic(fg))
                    {
                        ShowWindow(fg, SW_FORCEMINIMIZE);
                        ShowWindow(fg, SW_MINIMIZE);
                    }
                }
                catch { }
            }

            ForceTopMost(lockForm);
            try
            {
                lockForm.Activate();
                lockForm.BringToFront();
                SetForegroundWindow(lockForm.Handle);
            }
            catch { }
        }
        catch { }
    }

    /// <summary>Optional hard stop (config killOnExpiry=true). Unused by default.</summary>
    public static void KillBlockedProcesses(string[]? names)
    {
        if (names is null) return;
        foreach (var raw in names)
        {
            if (string.IsNullOrWhiteSpace(raw)) continue;
            var name = raw.Trim();
            if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                name = name[..^4];
            try
            {
                foreach (var p in Process.GetProcessesByName(name))
                {
                    try
                    {
                        if (p.Id == Environment.ProcessId) continue;
                        p.Kill();
                    }
                    catch { }
                    finally { try { p.Dispose(); } catch { } }
                }
            }
            catch { }
        }
    }
}

/// <summary>
/// Low-level keyboard filter active only while the PC is locked.
/// Swallows: Win keys, Alt+Tab, Alt+Esc, Ctrl+Esc, Alt+F4.
/// Install/Uninstall must be called on the UI thread.
/// </summary>
internal sealed class KeyboardHook : IDisposable
{
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int VK_TAB = 0x09;
    private const int VK_ESCAPE = 0x1B;
    private const int VK_F4 = 0x73;
    private const int VK_LWIN = 0x5B;
    private const int VK_RWIN = 0x5C;
    private const int VK_CONTROL = 0x11;
    private const int LLKHF_ALTDOWN = 0x20;

    [StructLayout(LayoutKind.Sequential)]
    private struct KbdStruct
    {
        public uint vkCode;
        public uint scanCode;
        public uint flags;
        public uint time;
        public UIntPtr dwExtraInfo;
    }

    private delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string? lpModuleName);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);

    private static HookProc? _proc;
    private static IntPtr _hookId = IntPtr.Zero;
    private static bool _active;

    public static bool IsActive => _active && _hookId != IntPtr.Zero;

    private static IntPtr Callback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0 && _active)
        {
            var msg = wParam.ToInt32();
            if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN)
            {
                try
                {
                    var kb = Marshal.PtrToStructure<KbdStruct>(lParam);
                    var vk = (int)kb.vkCode;
                    var altDown = (kb.flags & LLKHF_ALTDOWN) != 0;
                    var ctrlDown = (GetAsyncKeyState(VK_CONTROL) & 0x8000) != 0;

                    if (vk == VK_LWIN || vk == VK_RWIN) return (IntPtr)1;
                    if (vk == VK_TAB && altDown) return (IntPtr)1;
                    if (vk == VK_ESCAPE && (altDown || ctrlDown)) return (IntPtr)1;
                    if (vk == VK_F4 && altDown) return (IntPtr)1;
                }
                catch { }
            }
        }
        return CallNextHookEx(_hookId, nCode, wParam, lParam);
    }

    public static void Install()
    {
        if (_hookId != IntPtr.Zero) { _active = true; return; }
        try
        {
            _proc = Callback; // keep alive in static field (GC safety)
            var hMod = GetModuleHandle(null);
            _hookId = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, hMod, 0);
            _active = _hookId != IntPtr.Zero;
        }
        catch { _active = false; }
    }

    public static void Uninstall()
    {
        _active = false;
        try
        {
            if (_hookId != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_hookId);
                _hookId = IntPtr.Zero;
            }
        }
        catch { _hookId = IntPtr.Zero; }
    }

    public void Dispose() { /* static lifetime; use Uninstall() explicitly */ }
}
