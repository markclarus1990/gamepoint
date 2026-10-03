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
    private const uint WM_SYSKEYDOWN = 0x0104;
    private const uint WM_SYSKEYUP = 0x0105;
    private const int VK_RETURN = 0x0D;

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
    private static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

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
    /// Uses ShowWindowAsync first (works even when the game thread is stuck
    /// in an exclusive-fullscreen pump), falling back to ShowWindow.
    /// </summary>
    public static int MinimizeBlockedProcesses(string[]? names)
    {
        var wins = FindBlockedWindows(names);
        if (wins.Count == 0) return 0;
        var count = 0;
        foreach (var hWnd in wins)
        {
            if (MinimizeWindow(hWnd)) count++;
        }
        return count;
    }

    private static bool MinimizeWindow(IntPtr hWnd)
    {
        try
        {
            if (!IsWindowVisible(hWnd) || IsIconic(hWnd)) return false;
            // Async first: posts to the window even if its thread is busy.
            // Repeat FORCEMINIMIZE then MINIMIZE — fullscreen GL windows
            // often swallow the first request.
            var ok = false;
            try { ok |= ShowWindowAsync(hWnd, SW_FORCEMINIMIZE); } catch { }
            try { ok |= ShowWindow(hWnd, SW_FORCEMINIMIZE); } catch { }
            try { ok |= ShowWindow(hWnd, SW_MINIMIZE); } catch { }
            return ok;
        }
        catch { return false; }
    }

    private static List<IntPtr> FindBlockedWindows(string[]? names)
    {
        var wins = new List<IntPtr>();
        var pids = ResolvePids(names);
        if (pids.Count == 0) return wins;
        var own = (uint)Environment.ProcessId;
        pids.Remove(own);
        if (pids.Count == 0) return wins;
        try
        {
            EnumWindows((hWnd, _) =>
            {
                try
                {
                    if (!IsWindowVisible(hWnd) || IsIconic(hWnd)) return true;
                    GetWindowThreadProcessId(hWnd, out var pid);
                    if (!pids.Contains(pid)) return true;
                    wins.Add(hWnd);
                }
                catch { }
                return true;
            }, IntPtr.Zero);
        }
        catch { }
        return wins;
    }

    /// <summary>
    /// Best-effort exclusive-fullscreen exit: posts Alt+Enter to each game
    /// window (targeted PostMessage only — no global key injection, no world
    /// impact). Most LWJGL/GLFW Minecraft builds toggle windowed on Alt+Enter,
    /// letting the lock surface. Harmless if the game ignores it.
    /// </summary>
    public static void NudgeFullscreenToWindowed(string[]? names)
    {
        var wins = FindBlockedWindows(names);
        foreach (var hWnd in wins)
        {
            try
            {
                // lParam bit 29 = Alt context. KEYDOWN then KEYUP for Enter.
                PostMessage(hWnd, WM_SYSKEYDOWN, (IntPtr)VK_RETURN, (IntPtr)(1 << 29));
                PostMessage(hWnd, WM_SYSKEYUP, (IntPtr)VK_RETURN, (IntPtr)((1 << 29) | (1 << 30) | (1 << 31)));
            }
            catch { }
        }
    }

    /// <summary>
    /// Fresh-lock burst helper: minimize whatever foreign window is on top
    /// (game, browser, launcher — anything not ours), so the login is
    /// guaranteed visible. Skips the Windows taskbar/desktop shell.
    /// Only used during the first seconds of a lock, then game-only.
    /// </summary>
    public static bool MinimizeForeignForeground(Form lockForm)
    {
        try
        {
            if (lockForm.IsDisposed || !lockForm.Visible) return false;
            var fg = GetForegroundWindow();
            if (fg == IntPtr.Zero || fg == lockForm.Handle) return false;
            GetWindowThreadProcessId(fg, out var fgPid);
            if (fgPid == (uint)Environment.ProcessId) return false;
            var cls = new System.Text.StringBuilder(256);
            try { GetClassName(fg, cls, cls.Capacity); } catch { }
            var clsName = cls.ToString();
            if (clsName == "Shell_TrayWnd" || clsName == "Progman" || clsName == "WorkerW")
                return false;
            if (!IsWindowVisible(fg) || IsIconic(fg)) return false;
            return MinimizeWindow(fg);
        }
        catch { return false; }
    }

    /// <summary>One-line "process.exe|window title" of the foreground window for agent-debug.log.</summary>
    public static string DescribeForeground()
    {
        try
        {
            var fg = GetForegroundWindow();
            if (fg == IntPtr.Zero) return "none";
            GetWindowThreadProcessId(fg, out var pid);
            string proc = $"pid={pid}";
            try
            {
                using var p = Process.GetProcessById((int)pid);
                proc = (p.ProcessName ?? "unknown") + ".exe";
            }
            catch { }
            var sb = new System.Text.StringBuilder(200);
            try { GetWindowText(fg, sb, sb.Capacity); } catch { }
            var title = sb.ToString().Trim();
            if (title.Length > 80) title = title.Substring(0, 80);
            return $"{proc}|{title}";
        }
        catch { return "unknown"; }
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
                        MinimizeWindow(fg);
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
    private const int LLKHF_INJECTED = 0x10;

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
                    // Let synthetic input through (agent's own SendInput,
                    // remote-control, on-screen keyboard, fullscreen helpers).
                    // Only physical Alt+Tab/Win presses are swallowed.
                    if ((kb.flags & LLKHF_INJECTED) != 0)
                        return CallNextHookEx(_hookId, nCode, wParam, lParam);
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
