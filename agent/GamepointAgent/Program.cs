using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Net;
using System.Net.Http.Json;
using System.Runtime.InteropServices;
using StringBuilder = System.Text.StringBuilder;
using System.Text.Json;
using System.Text.Json.Serialization;
using Windows.Media.Core;
using Windows.Media.Playback;

namespace GamepointAgent;

internal static class Program
{
    private sealed class Config
    {
        public string ServerUrl { get; set; } = "";
        public string AgentKey { get; set; } = "";
        public string StationName { get; set; } = "";
        public int PollSeconds { get; set; } = 10;
        public int StationPort { get; set; } = 3987;
        public int[] AnnounceMinutesLeft { get; set; } = new[] { 10, 3, 1 };
        public string? GithubRepo { get; set; }
        public string? GithubToken { get; set; }
        public int UpdateCheckMinutes { get; set; } = 60;
    }

    private sealed class Status
    {
        public bool Locked { get; set; }
        [JsonPropertyName("remaining_seconds")]
        public int RemainingSeconds { get; set; }
        [JsonPropertyName("station_name")]
        public string StationName { get; set; } = "";
        [JsonPropertyName("user_name")]
        public string UserName { get; set; } = "";
        [JsonPropertyName("user_id")]
        public string? UserId { get; set; }
        [JsonPropertyName("user_points")]
        public int? UserPoints { get; set; }
        [JsonPropertyName("user_gfunds")]
        public int? UserGfunds { get; set; }
        [JsonPropertyName("user_avatar")]
        public string? UserAvatar { get; set; }
        [JsonPropertyName("user_time_credit")]
        public int? UserTimeCredit { get; set; }
        [JsonPropertyName("pending_command")]
        public string? PendingCommand { get; set; }
        [JsonPropertyName("remote_control")]
        public bool RemoteControl { get; set; }
    }

    private sealed class LoginUser
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public int Points { get; set; }
        [JsonPropertyName("reserved_points")]
        public int ReservedPoints { get; set; }
        public int Gfunds { get; set; }
        [JsonPropertyName("avatar_url")]
        public string? AvatarUrl { get; set; }
        [JsonPropertyName("time_credit_minutes")]
        public int TimeCreditMinutes { get; set; }
    }

    private sealed class StartResponse
    {
        public string? Error { get; set; }
        [JsonPropertyName("remaining_seconds")]
        public int RemainingSeconds { get; set; }
    }

    private sealed class UserNameRow
    {
        public string Name { get; set; } = "";
    }

    private static readonly JsonSerializerOptions ApiJson = new(JsonSerializerDefaults.Web);

    private const string COLOR_BG = "#0b1220";
    private const string COLOR_CARD = "#0f1b2e";
    private const string COLOR_INPUT = "#1e293b";
    private const string COLOR_ACCENT = "#9333ea";
    private const string COLOR_GREEN = "#16a34a";
    private const string COLOR_ERROR = "#f87171";
    private const string COLOR_PINK = "#ec4899";

    private static Image? LoadBg()
    {
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "bg.png");
            return File.Exists(path) ? Image.FromFile(path) : null;
        }
        catch
        {
            return null;
        }
    }

    private static Region? RoundedRegion(Control c, int radius)
    {
        if (radius <= 0) return null;
        using var path = new System.Drawing.Drawing2D.GraphicsPath();
        var d = radius * 2;
        var r = new Rectangle(0, 0, c.Width, c.Height);
        path.AddArc(r.Left, r.Top, d, d, 180, 90);
        path.AddArc(r.Right - d, r.Top, d, d, 270, 90);
        path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        path.AddArc(r.Left, r.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return new Region(path);
    }

    private static void MakeGradientButton(Button b)
    {
        MakeGradientButton(b, Color.FromArgb(236, 72, 153), Color.FromArgb(147, 51, 234));
    }

    private static void MakeGradientButton(Button b, Color c1, Color c2)
    {
        b.FlatStyle = FlatStyle.Flat;
        b.FlatAppearance.BorderSize = 0;
        b.ForeColor = Color.White;
        RoundButton(b, 12);
        b.Paint += (_, e) =>
        {
            using var brush = new System.Drawing.Drawing2D.LinearGradientBrush(
                b.ClientRectangle,
                c1,
                c2,
                System.Drawing.Drawing2D.LinearGradientMode.Horizontal);
            e.Graphics.FillRectangle(brush, b.ClientRectangle);
            if (b.Enabled)
            {
                TextRenderer.DrawText(e.Graphics, b.Text, b.Font, b.ClientRectangle, Color.White,
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
            }
        };
        b.Invalidate();
    }

    private static void RoundButton(Button b, int radius)
    {
        void Apply()
        {
            if (b.Width <= 0 || b.Height <= 0) return;
            b.Region = RoundedRegion(b, Math.Max(4, Math.Min(radius, b.Height / 2)));
        }
        b.Resize += (_, _) => Apply();
        Apply();
    }

    private static Panel ModernInput(bool password, out TextBox box, int width = 302)
    {
        var panel = new Panel
        {
            BackColor = Color.Transparent,
            Size = new Size(width, 44)
        };
        var tb = new TextBox
        {
            BorderStyle = BorderStyle.None,
            BackColor = C(COLOR_INPUT),
            ForeColor = Color.White,
            Font = F(11.5f),
            PasswordChar = password ? '•' : '\0',
            Location = new Point(14, 12),
            Size = new Size(width - 28, 20)
        };
        bool focused = false;
        panel.Paint += (_, e) =>
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var path = new GraphicsPath();
            int r = 10;
            var rect = new Rectangle(0, 0, panel.Width - 1, panel.Height - 1);
            path.AddArc(rect.X, rect.Y, r * 2, r * 2, 180, 90);
            path.AddArc(rect.Right - r * 2, rect.Y, r * 2, r * 2, 270, 90);
            path.AddArc(rect.Right - r * 2, rect.Bottom - r * 2, r * 2, r * 2, 0, 90);
            path.AddArc(rect.X, rect.Bottom - r * 2, r * 2, r * 2, 90, 90);
            path.CloseFigure();
            using var fill = new SolidBrush(focused ? C("#223049") : C(COLOR_INPUT));
            e.Graphics.FillPath(fill, path);
            using var pen = new Pen(focused ? C(COLOR_PINK) : Color.FromArgb(50, 255, 255, 255), focused ? 1.5f : 1f);
            e.Graphics.DrawPath(pen, path);
        };
        tb.GotFocus += (_, _) =>
        {
            focused = true;
            tb.BackColor = C("#223049");
            panel.Invalidate();
        };
        tb.LostFocus += (_, _) =>
        {
            focused = false;
            tb.BackColor = C(COLOR_INPUT);
            panel.Invalidate();
        };
        panel.Region = RoundedRegion(panel, 10);
        panel.Controls.Add(tb);
        box = tb;
        if (password)
        {
            tb.Size = new Size(width - 62, 20);
            AttachShowToggle(tb);
        }
        return panel;
    }

    /// <summary>
    /// Adds a small eye button at the right edge of a password TextBox.
    /// Click toggles masking. Defaults to masked.
    /// </summary>
    private static Button AttachShowToggle(TextBox box, int rightMargin = 6)
    {
        var btn = new Button
        {
            Text = "👁",
            Font = new Font("Segoe UI Emoji", 11),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.Transparent,
            ForeColor = Color.FromArgb(148, 163, 184),
            Size = new Size(30, Math.Max(24, box.Height - 2)),
            Cursor = Cursors.Hand,
            TabStop = false,
            Tag = "show-toggle"
        };
        btn.FlatAppearance.BorderSize = 0;
        btn.FlatAppearance.MouseOverBackColor = Color.FromArgb(40, 255, 255, 255);
        btn.FlatAppearance.MouseDownBackColor = Color.Transparent;
        var tip = new ToolTip();
        tip.SetToolTip(btn, "Show");
        btn.Click += (_, _) => SetShowToggle(btn, box, box.PasswordChar != '\0', tip, true);
        var parent = box.Parent;
        if (parent is not null)
        {
            btn.Location = new Point(
                Math.Max(0, box.Right + 4),
                box.Top + Math.Max(0, (box.Height - btn.Height) / 2));
            btn.Anchor = AnchorStyles.Top | AnchorStyles.Right;
            parent.Controls.Add(btn);
            btn.BringToFront();
        }
        return btn;
    }

    private static void SetShowToggle(Button? btn, TextBox box, bool show, ToolTip? tip = null, bool keepFocus = true)
    {
        box.PasswordChar = show ? '\0' : '•';
        if (btn is not null)
        {
            btn.Text = show ? "🙈" : "👁";
            btn.ForeColor = show ? C(COLOR_PINK) : Color.FromArgb(148, 163, 184);
            if (tip is not null) tip.SetToolTip(btn, show ? "Hide" : "Show");
        }
        if (!keepFocus) return;
        try
        {
            if (box.CanFocus) box.Focus();
            box.SelectionStart = box.Text.Length;
        }
        catch { }
    }

    private static void PaintDarkOverlay(Control c, PaintEventArgs e, int alpha = 150)
    {
        using var brush = new SolidBrush(Color.FromArgb(alpha, 0, 0, 0));
        e.Graphics.FillRectangle(brush, c.ClientRectangle);
    }

    private static async Task LoadAvatarAsync(HttpClient http, PictureBox box, string? url)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(url))
            {
                box.Visible = false;
                return;
            }
            var fullUrl = url.StartsWith("http", StringComparison.OrdinalIgnoreCase)
                ? url
                : (http.BaseAddress?.ToString().TrimEnd('/') ?? "") + url;
            using var resp = await http.GetAsync(fullUrl);
            if (!resp.IsSuccessStatusCode)
            {
                box.Visible = false;
                return;
            }
            await using var stream = await resp.Content.ReadAsStreamAsync();
            using var img = Image.FromStream(stream);
            var size = box.Width;
            box.Image = new Bitmap(img, new Size(size, size));
            box.SizeMode = PictureBoxSizeMode.StretchImage;
            if (box.Width > 0 && box.Height > 0)
            {
                box.Region = RoundedRegion(box, box.Width / 2);
            }
            box.Visible = true;
        }
        catch
        {
            box.Visible = false;
        }
    }

    [STAThread]
    private static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        var configPath = Path.Combine(AppContext.BaseDirectory, "config.json");
        Config cfg;

        if (!File.Exists(configPath))
        {
            var template = JsonSerializer.Serialize(
                new Config { ServerUrl = "https://YOUR-APP-URL.com", AgentKey = "PASTE-KEY-HERE", StationName = "PC-1" },
                new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(configPath, template);
            MessageBox.Show(
                $"config.json was created next to the agent.\n\nEdit it with your server URL, the station's agent key, and the PC name, then start the agent again.",
                "Gamepoint Agent",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return;
        }

        try
        {
            cfg = JsonSerializer.Deserialize<Config>(File.ReadAllText(configPath)) ?? new Config();
        }
        catch
        {
            MessageBox.Show("config.json is invalid. Fix it or delete it to regenerate.", "Gamepoint Agent", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        if (string.IsNullOrWhiteSpace(cfg.ServerUrl) || string.IsNullOrWhiteSpace(cfg.AgentKey) || string.IsNullOrWhiteSpace(cfg.StationName))
        {
            MessageBox.Show("config.json is missing serverUrl, agentKey or stationName.", "Gamepoint Agent", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        // Normalize optional fields for old configs
        if (cfg.UpdateCheckMinutes <= 0) cfg.UpdateCheckMinutes = 60;
        cfg.GithubRepo ??= "markclarus1990/gamepoint";

        var controller = new ControllerForm(cfg);
        Application.Run(controller);
    }

    private static Color C(string hex) => ColorTranslator.FromHtml(hex);

    private static void Dbg(string msg)
    {
        try
        {
            File.AppendAllText(
                Path.Combine(AppContext.BaseDirectory, "agent-debug.log"),
                $"[{DateTime.Now:HH:mm:ss.fff}] {msg}{Environment.NewLine}");
        }
        catch
        {
        }
    }

    private static string PanelState(Control c) =>
        $"{(c.IsHandleCreated ? "h" : "n")}v={(c.Visible ? "1" : "0")}";

    private static Font F(float size, FontStyle style = FontStyle.Regular)
        => new("Segoe UI", size, style);

    private static string FmtMinutes(int totalMinutes)
    {
        var h = totalMinutes / 60;
        var m = totalMinutes % 60;
        return h > 0 ? $"{h} hr {m} min" : $"{m} min";
    }

    private static Button DarkButton(string text, string bg)
    {
        return new Button
        {
            Text = text,
            FlatStyle = FlatStyle.Flat,
            BackColor = C(bg),
            ForeColor = Color.White,
            Font = F(11, FontStyle.Bold),
            Height = 42,
            FlatAppearance = { BorderSize = 0 }
        };
    }

    private static Button QuickButton(string text)
    {
        var btn = new Button
        {
            Text = text,
            FlatStyle = FlatStyle.Flat,
            BackColor = C(COLOR_INPUT),
            ForeColor = Color.White,
            Font = F(10),
            Height = 34,
            FlatAppearance = { BorderSize = 1, BorderColor = C("#334155") }
        };
        RoundButton(btn, 17);
        return btn;
    }

    private static Label DarkLabel(string text, float size, Color color, bool bold = false)
    {
        return new Label
        {
            Text = text,
            AutoSize = true,
            ForeColor = color,
            BackColor = Color.Transparent,
            Font = F(size, bold ? FontStyle.Bold : FontStyle.Regular)
        };
    }

    private sealed class ControllerForm : Form
    {
        private readonly Config _cfg;
        private readonly HttpClient _http;
        private readonly System.Windows.Forms.Timer _pollTimer;
        private readonly System.Windows.Forms.Timer _clockTimer;
        private readonly System.Windows.Forms.Timer _keepOnTopTimer;
        private readonly System.Windows.Forms.Timer _updateTimer;
        private readonly Updater _updater;
        private Updater.VersionInfo? _pendingUpdate;
        private bool _updateInProgress;
        private DateTime _lastUpdateCheck = DateTime.MinValue;
        private LockForm? _lockForm;
        private CountdownForm? _countdownForm;
        private Status? _current;
        private DateTime _lockHeldUntil = DateTime.MinValue;
        private bool _remoteControl;
        private DateTime _lastControlShot = DateTime.MinValue;
        private const int RemotePollMs = 1000;
        private const int ControlShotThrottleMs = 1200;
        private string _soundsDir = "";
        private static readonly int[] FallbackAnnounceMinutes = new[] { 10, 3, 1 };
        private readonly MediaPlayer _announcer = new();

        public HttpClient Http => _http;
        public string StationName => _cfg.StationName;
        public LoginUser? CurrentPlayer { get; set; }

        public string? CurrentUserId => _current?.UserId;

        public int? CurrentPoints => _current?.UserPoints;

        public int? CurrentGfunds => _current?.UserGfunds;

        public int CurrentRemainingSeconds => _current?.RemainingSeconds ?? 0;

        public int? CurrentTimeCredit => _current?.UserTimeCredit;

        public ControllerForm(Config cfg)
        {
            _cfg = cfg;
            ShowInTaskbar = false;
            Opacity = 0;
            WindowState = FormWindowState.Minimized;

            _http = new HttpClient
            {
                BaseAddress = new Uri(_cfg.ServerUrl.TrimEnd('/') + "/"),
                Timeout = TimeSpan.FromSeconds(8)
            };
            _http.DefaultRequestHeaders.Add("x-agent-key", _cfg.AgentKey);

            _pollTimer = new System.Windows.Forms.Timer { Interval = Math.Max(5, _cfg.PollSeconds) * 1000 };
            _pollTimer.Tick += async (_, _) => await PollAsync();

            _clockTimer = new System.Windows.Forms.Timer { Interval = 1000 };
            _clockTimer.Tick += (_, _) =>
            {
                if (_current is null) return;
                if (!_current.Locked && _current.RemainingSeconds > 0)
                {
                    _current.RemainingSeconds -= 1;
                    _countdownForm?.SetTime(_current.RemainingSeconds);
                }
            };

            _keepOnTopTimer = new System.Windows.Forms.Timer { Interval = 1000 };
            _keepOnTopTimer.Tick += (_, _) => _lockForm?.ForceTop();

            var repo = string.IsNullOrWhiteSpace(_cfg.GithubRepo) ? "markclarus1990/gamepoint" : _cfg.GithubRepo!;
            _updater = new Updater(_http, _cfg.ServerUrl, repo, _cfg.GithubToken);
            var checkMinutes = Math.Max(5, _cfg.UpdateCheckMinutes);
            _updateTimer = new System.Windows.Forms.Timer { Interval = checkMinutes * 60 * 1000 };
            _updateTimer.Tick += async (_, _) => await CheckForUpdatesAsync(false);

            Load += async (_, _) =>
            {
                try
                {
                    var self = Environment.ProcessPath ?? AppContext.BaseDirectory;
                    var embedded = Updater.ReadEmbeddedVersion(self) ?? "none";
                    Dbg($"[START NEW AGENT] pid={Environment.ProcessId} path={self} runtime={Updater.CurrentVersion} embedded={embedded}");
                }
                catch { }
                await DownloadSoundsAsync();
                await PollAsync();
                _pollTimer.Start();
                _clockTimer.Start();
                StartLocalApi();
                _updateTimer.Start();
                // First check 15s after startup (don't block the initial lock screen)
                var firstCheck = new System.Windows.Forms.Timer { Interval = 15000 };
                firstCheck.Tick += async (_, _) =>
                {
                    firstCheck.Stop();
                    firstCheck.Dispose();
                    await CheckForUpdatesAsync(false);
                };
                firstCheck.Start();
            };
        }

        public async Task PollAsync()
        {
            _pollTimer.Stop();
            try
            {
                using var resp = await _http.GetAsync("api/agent/status");
                if (!resp.IsSuccessStatusCode) return;
                var st = await resp.Content.ReadFromJsonAsync<Status>();
                if (st is null) return;

                if (!string.IsNullOrEmpty(st.PendingCommand))
                {
                    try
                    {
                        if (st.PendingCommand == "screenshot")
                        {
                            await CaptureAndUploadScreenshotAsync();
                            await AckCommandAsync();
                        }
                        else if (st.PendingCommand == "activity")
                        {
                            await ReportActivityAsync();
                            await AckCommandAsync();
                        }
                        else if (st.PendingCommand == "update")
                        {
                            await AckCommandAsync();
                            Dbg("Remote update command received");
                            _ = Task.Run(async () =>
                            {
                                await Task.Delay(500);
                                await CheckForUpdatesAsync(false);
                                if (_pendingUpdate != null)
                                {
                                    if (IsHandleCreated) BeginInvoke(async () => await ApplyPendingUpdateAsync());
                                }
                            });
                        }
                        else
                        {
                            await AckCommandAsync();
                            ExecuteCommand(st.PendingCommand);
                        }
                    }
                    catch (Exception ex)
                    {
                        Dbg($"Command handling failed: {ex.Message}");
                    }
                }

                try
                {
                    ApplyStatus(st);
                }
                catch (Exception ex)
                {
                    Dbg($"ApplyStatus failed: {ex.Message}");
                }

                try
                {
                    if (st.RemoteControl != _remoteControl)
                    {
                        _remoteControl = st.RemoteControl;
                        _pollTimer.Interval = _remoteControl
                            ? RemotePollMs
                            : Math.Max(5, _cfg.PollSeconds) * 1000;
                        Dbg($"Remote control {(_remoteControl ? "ON" : "OFF")} — poll {_pollTimer.Interval}ms");
                    }
                    if (_remoteControl)
                    {
                        await HandleControlEventsAsync();
                    }
                }
                catch (Exception ex)
                {
                    Dbg($"Control handling failed: {ex.Message}");
                }
            }
            catch
            {
                // network/server unreachable — keep the previous state
            }
            finally
            {
                _pollTimer.Start();
            }
        }

        /// <summary>
        /// Owner for update dialogs. Must be a VISIBLE TopMost form — dialogs owned by
        /// the invisible ControllerForm open behind the fullscreen lock screen and look
        /// like "nothing happens" when Check is clicked.
        /// </summary>
        private Form UpdateDialogOwner()
        {
            try
            {
                if (_lockForm is not null && !_lockForm.IsDisposed && _lockForm.Visible)
                    return _lockForm;
                if (_countdownForm is not null && !_countdownForm.IsDisposed && _countdownForm.Visible)
                    return _countdownForm;
            }
            catch { }
            return this;
        }

        public async Task CheckForUpdatesAsync(bool manual, bool autoApply = true)
        {
            if (_updateInProgress) return;
            // throttle: at most once per 2 min unless manual
            if (!manual && DateTime.Now - _lastUpdateCheck < TimeSpan.FromMinutes(2)) return;
            _lastUpdateCheck = DateTime.Now;
            var dlgOwner = UpdateDialogOwner();
            try
            {
                Dbg($"Update check start (manual={manual}) current={Updater.CurrentVersion}");
                _lockForm?.SetUpdateStatus("Checking for updates...", false);
                _countdownForm?.SetUpdateStatus("Checking for updates...", false);
                var info = await _updater.CheckAsync();
                if (info == null)
                {
                    Dbg("Update check: no info");
                    if (manual)
                    {
                        MessageBox.Show(dlgOwner, $"No update info available.\nCurrent: v{Updater.CurrentVersion}\n\nCheck agent-debug.log for details.", "GamepointAgent", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                    _lockForm?.SetUpdateStatus("No update info — see log", false);
                    _countdownForm?.SetUpdateStatus("No update info", false);
                    return;
                }
                Dbg($"Update check: latest={info.Version} current={Updater.CurrentVersion} available={info.UpdateAvailable}");
                if (info.UpdateAvailable && !string.IsNullOrWhiteSpace(info.DownloadUrl))
                {
                    _pendingUpdate = info;
                    _lockForm?.SetUpdateStatus($"Update v{info.Version} available", true, info.Version, info.DownloadUrl);
                    _countdownForm?.SetUpdateStatus($"v{info.Version} available", true, info.Version, info.DownloadUrl);
                    Dbg($"Update available: v{info.Version}");
                    if (manual && autoApply)
                    {
                        // Jump straight to the install prompt so one click does check+update
                        await ApplyPendingUpdateAsync(dlgOwner);
                    }
                }
                else
                {
                    _pendingUpdate = null;
                    if (manual)
                    {
                        MessageBox.Show(dlgOwner, $"You're on the latest version.\nCurrent: v{Updater.CurrentVersion}\nLatest: v{info.Version}\n\nDeveloped by Mark Clarus", "GamepointAgent", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    }
                    _lockForm?.SetUpdateStatus($"v{Updater.CurrentVersion} • up to date", false);
                    _countdownForm?.SetUpdateStatus($"v{Updater.CurrentVersion}", false);
                }
            }
            catch (Exception ex)
            {
                Dbg($"Update check failed: {ex.Message}");
                if (manual)
                    MessageBox.Show(dlgOwner, $"Update check failed:\n{ex.Message}", "GamepointAgent", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                _lockForm?.SetUpdateStatus("Update check failed", false);
                _countdownForm?.SetUpdateStatus("Update check failed", false);
            }
        }

        public async Task ApplyPendingUpdateAsync(IWin32Window? owner = null)
        {
            if (_updateInProgress) return;
            var dlgOwner = (owner as Form) ?? UpdateDialogOwner();
            var info = _pendingUpdate;
            if (info == null || string.IsNullOrWhiteSpace(info.DownloadUrl))
            {
                // autoApply:false — this method shows the confirm itself; avoid double prompt
                await CheckForUpdatesAsync(true, autoApply: false);
                info = _pendingUpdate;
                if (info == null || string.IsNullOrWhiteSpace(info.DownloadUrl))
                    return;
                dlgOwner = UpdateDialogOwner();
            }
            // Guard before the modal so double-clicks can't stack two prompts
            _updateInProgress = true;
            var confirm = MessageBox.Show(dlgOwner,
                $"Install update v{info.Version}?\n\nCurrent: v{Updater.CurrentVersion}\nLatest: v{info.Version}\n\nThe agent will close and restart automatically.\nAny active session timer keeps running on the server.",
                "Update GamepointAgent",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question);
            if (confirm != DialogResult.Yes)
            {
                _updateInProgress = false;
                return;
            }
            _lockForm?.SetUpdateStatus($"Downloading v{info.Version}...", false);
            _countdownForm?.SetUpdateStatus($"Downloading v{info.Version}...", false);
            try
            {
                var ok = await _updater.DownloadAndApplyAsync(info, dlgOwner,
                    status =>
                    {
                        try
                        {
                            if (IsHandleCreated) BeginInvoke(() =>
                            {
                                _lockForm?.SetUpdateStatus(status, false);
                                _countdownForm?.SetUpdateStatus(status, false);
                            });
                        }
                        catch { }
                    });
                if (ok)
                {
                    // [STOP OLD AGENT] The lock screen vetoes closing (AllowClose=false),
                    // which would abort Application.Exit and leave the old exe running
                    // forever — especially on locked PCs. Release it before exiting so
                    // the swap script can replace the exe and start the new version.
                    try
                    {
                        if (_lockForm is not null && !_lockForm.IsDisposed)
                            _lockForm.AllowClose = true;
                    }
                    catch { }
                    Dbg($"[STOP OLD AGENT] update v{info.Version} staged — exiting pid={Environment.ProcessId} current={Updater.CurrentVersion}");
                    // Exit will let the batch file swap and restart
                    Application.Exit();
                }
                else
                {
                    _updateInProgress = false;
                }
            }
            catch (Exception ex)
            {
                Dbg($"Apply update failed: {ex.Message}");
                _updateInProgress = false;
                MessageBox.Show(dlgOwner, $"Update failed:\n{ex.Message}", "GamepointAgent", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private async Task AckCommandAsync()
        {
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, "api/agent/command-done");
                req.Headers.Add("x-agent-key", _cfg.AgentKey);
                using var resp = await _http.SendAsync(req);
                _ = resp;
            }
            catch
            {
                // will retry on the next poll
            }
        }

        private void ExecuteCommand(string command)
        {
            if (command != "shutdown" && command != "restart") return;
            Dbg($"Executing command: {command}");
            try
            {
                var psi = new ProcessStartInfo("shutdown", command == "restart" ? "/r /t 20" : "/s /t 20")
                {
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                Process.Start(psi);
                Dbg($"Command {command} scheduled (20s).");
            }
            catch (Exception ex)
            {
                Dbg($"Command {command} failed: {ex.Message}");
            }
            try
            {
                var msg = command == "restart"
                    ? "This PC will restart in 20 seconds."
                    : "This PC will shut down in 20 seconds.";
                var active = (Form?)ActiveForm ?? (Form?)_lockForm ?? _countdownForm;
                if (active is not null && !active.IsDisposed)
                {
                    var notice = new CommandNoticeForm(msg, active);
                    notice.Show(active);
                }
                else
                {
                    var notice = new CommandNoticeForm(msg, null);
                    notice.Show();
                }
            }
            catch
            {
            }
        }

        private async Task CaptureAndUploadScreenshotAsync()
        {
            try
            {
                var bounds = SystemInformation.VirtualScreen;
                using var bmp = new Bitmap(bounds.Width, bounds.Height);
                using (var g = Graphics.FromImage(bmp))
                {
                    g.CopyFromScreen(bounds.X, bounds.Y, 0, 0, bounds.Size);
                }

                using var scaled = Downscale(bmp, 1280);
                using var ms = new MemoryStream();
                var jpeg = ImageCodecInfo.GetImageEncoders()
                    .First(c => c.FormatID == ImageFormat.Jpeg.Guid);
                var enc = new EncoderParameters(1);
                enc.Param[0] = new EncoderParameter(Encoder.Quality, 55L);
                scaled.Save(ms, jpeg, enc);

                var activity = GetForegroundActivity();
                using var req = new HttpRequestMessage(HttpMethod.Post, "api/agent/screenshot")
                {
                    Content = JsonContent.Create(new
                    {
                        image = Convert.ToBase64String(ms.ToArray()),
                        window_title = activity?.Title,
                        process_name = activity?.Process,
                    })
                };
                req.Headers.Add("x-agent-key", _cfg.AgentKey);
                using var resp = await _http.SendAsync(req);
                Dbg($"Screenshot uploaded: {(int)resp.StatusCode} activity={activity?.Process ?? "none"}");
            }
            catch (Exception ex)
            {
                Dbg($"Screenshot failed: {ex.Message}");
            }
        }

        private sealed record ActivityInfo(string Title, string Process);

        private async Task ReportActivityAsync()
        {
            try
            {
                // Only report when a session is active — avoids spying on the lock screen.
                if (_current?.Locked != false) return;
                var activity = GetForegroundActivity();
                if (activity is null) return;
                using var req = new HttpRequestMessage(HttpMethod.Post, "api/agent/activity")
                {
                    Content = JsonContent.Create(new
                    {
                        window_title = activity.Title,
                        process_name = activity.Process,
                    })
                };
                req.Headers.Add("x-agent-key", _cfg.AgentKey);
                using var resp = await _http.SendAsync(req);
                Dbg($"Activity reported: {activity.Process} {(int)resp.StatusCode}");
            }
            catch (Exception ex)
            {
                Dbg($"Activity report failed: {ex.Message}");
            }
        }

        private static ActivityInfo? GetForegroundActivity()
        {
            try
            {
                var hWnd = GetForegroundWindow();
                if (hWnd == IntPtr.Zero) return null;
                var sb = new StringBuilder(512);
                GetWindowText(hWnd, sb, sb.Capacity);
                var title = sb.ToString().Trim();
                if (title.Length > 200) title = title.Substring(0, 200);
                GetWindowThreadProcessId(hWnd, out var pid);
                string process;
                try
                {
                    using var proc = Process.GetProcessById((int)pid);
                    process = (proc.ProcessName ?? "unknown").Trim();
                    if (!process.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                        process += ".exe";
                    if (process.Length > 120) process = process.Substring(0, 120);
                }
                catch
                {
                    process = "unknown";
                }
                if (string.IsNullOrWhiteSpace(title) && process == "unknown") return null;
                return new ActivityInfo(title, process);
            }
            catch
            {
                return null;
            }
        }

        private async Task HandleControlEventsAsync()
        {
            JsonElement[] events;
            using (var resp = await _http.GetAsync("api/agent/control"))
            {
                if (!resp.IsSuccessStatusCode) return;
                var doc = await resp.Content.ReadFromJsonAsync<JsonElement>();
                if (!doc.TryGetProperty("events", out var arr) ||
                    arr.ValueKind != JsonValueKind.Array)
                    return;
                events = arr.EnumerateArray().ToArray();
            }
            if (events.Length == 0) return;

            foreach (var ev in events)
            {
                try
                {
                    ApplyControlEvent(ev);
                }
                catch (Exception ex)
                {
                    Dbg($"Control event failed: {ex.Message}");
                }
            }

            if (DateTime.Now - _lastControlShot >
                TimeSpan.FromMilliseconds(ControlShotThrottleMs))
            {
                _lastControlShot = DateTime.Now;
                await CaptureAndUploadScreenshotAsync();
            }
        }

        private void ApplyControlEvent(JsonElement ev)
        {
            var type = ev.GetProperty("type").GetString();
            switch (type)
            {
                case "click":
                {
                    var (x, y) = ToScreen(
                        ev.GetProperty("x").GetInt32(),
                        ev.GetProperty("y").GetInt32());
                    var button = ev.TryGetProperty("button", out var b)
                        ? b.GetString()
                        : "left";
                    NativeInput.Click(x, y, button ?? "left");
                    break;
                }
                case "drag":
                {
                    var (x1, y1) = ToScreen(
                        ev.GetProperty("x1").GetInt32(),
                        ev.GetProperty("y1").GetInt32());
                    var (x2, y2) = ToScreen(
                        ev.GetProperty("x2").GetInt32(),
                        ev.GetProperty("y2").GetInt32());
                    NativeInput.Drag(x1, y1, x2, y2);
                    break;
                }
                case "scroll":
                    NativeInput.Scroll(ev.GetProperty("delta").GetInt32());
                    break;
                case "key":
                {
                    var key = ev.GetProperty("key").GetString() ?? "";
                    NativeInput.PressKey(key);
                    break;
                }
                case "text":
                {
                    var text = ev.GetProperty("text").GetString() ?? "";
                    NativeInput.TypeText(text);
                    break;
                }
            }
        }

        private static (int X, int Y) ToScreen(int imgX, int imgY)
        {
            var bounds = SystemInformation.VirtualScreen;
            if (bounds.Width <= 0) return (imgX, imgY);
            var scale = bounds.Width / 1280.0;
            return (
                bounds.X + (int)Math.Round(imgX * scale),
                bounds.Y + (int)Math.Round(imgY * scale));
        }

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);

        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        private static void KillChromePlayingYoutube()
        {
            var procs = Process.GetProcessesByName("chrome");
            if (procs.Length == 0) return;

            var pids = new HashSet<uint>(procs.Select(p => (uint)p.Id));
            var found = false;
            EnumWindows((hWnd, _) =>
            {
                GetWindowThreadProcessId(hWnd, out var pid);
                if (!pids.Contains(pid)) return true;
                var sb = new StringBuilder(512);
                GetWindowText(hWnd, sb, sb.Capacity);
                if (sb.ToString().IndexOf("youtube", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    found = true;
                    return false;
                }
                return true;
            }, IntPtr.Zero);

            if (!found) return;
            Dbg("YouTube detected in a Chrome window — killing chrome.exe");
            try
            {
                var psi = new ProcessStartInfo("taskkill", "/IM chrome.exe /F")
                {
                    CreateNoWindow = true,
                    UseShellExecute = false
                };
                using var p = Process.Start(psi);
                p?.WaitForExit(10000);
                Dbg("chrome.exe killed");
            }
            catch (Exception ex)
            {
                Dbg($"Failed to kill chrome.exe: {ex.Message}");
            }
        }

        private static class NativeInput
        {
            private const uint InputMouse = 0;
            private const uint InputKeyboard = 1;
            private const int MouseEventLeftDown = 0x0002;
            private const int MouseEventLeftUp = 0x0004;
            private const int MouseEventRightDown = 0x0008;
            private const int MouseEventRightUp = 0x0010;
            private const int MouseEventWheel = 0x0800;
            private const uint KeyEventKeyUp = 0x0002;
            private const uint KeyEventUnicode = 0x0004;

            [StructLayout(LayoutKind.Sequential)]
            private struct Input
            {
                public uint type;
                public InputUnion u;
            }

            [StructLayout(LayoutKind.Explicit)]
            private struct InputUnion
            {
                [FieldOffset(0)] public MouseInput mi;
                [FieldOffset(0)] public KeyboardInput ki;
            }

            [StructLayout(LayoutKind.Sequential)]
            private struct MouseInput
            {
                public int dx;
                public int dy;
                public uint mouseData;
                public uint dwFlags;
                public uint time;
                public IntPtr dwExtraInfo;
            }

            [StructLayout(LayoutKind.Sequential)]
            private struct KeyboardInput
            {
                public ushort wVk;
                public ushort wScan;
                public uint dwFlags;
                public uint time;
                public IntPtr dwExtraInfo;
            }

            [DllImport("user32.dll")]
            private static extern bool SetCursorPos(int x, int y);

            [DllImport("user32.dll", SetLastError = true)]
            private static extern uint SendInput(
                uint nInputs,
                Input[] pInputs,
                int cbSize);

            private static void SendMouse(uint flags, uint data = 0)
            {
                var input = new Input
                {
                    type = InputMouse,
                    u = new InputUnion
                    {
                        mi = new MouseInput { dwFlags = flags, mouseData = data }
                    }
                };
                SendInput(1, new[] { input }, Marshal.SizeOf<Input>());
            }

            private static void SendKey(ushort vk, ushort scan, uint flags)
            {
                var input = new Input
                {
                    type = InputKeyboard,
                    u = new InputUnion
                    {
                        ki = new KeyboardInput
                        {
                            wVk = vk,
                            wScan = scan,
                            dwFlags = flags
                        }
                    }
                };
                SendInput(1, new[] { input }, Marshal.SizeOf<Input>());
            }

            public static void Click(int x, int y, string button)
            {
                SetCursorPos(x, y);
                var down = button == "right"
                    ? MouseEventRightDown
                    : MouseEventLeftDown;
                var up = button == "right"
                    ? MouseEventRightUp
                    : MouseEventLeftUp;
                SendMouse((uint)down);
                Thread.Sleep(30);
                SendMouse((uint)up);
            }

            public static void Drag(int x1, int y1, int x2, int y2)
            {
                SetCursorPos(x1, y1);
                SendMouse(MouseEventLeftDown);
                Thread.Sleep(30);
                SetCursorPos(x2, y2);
                Thread.Sleep(30);
                SendMouse(MouseEventLeftUp);
            }

            public static void Scroll(int delta)
            {
                SendMouse(MouseEventWheel, (uint)(delta * 120));
            }

            public static void PressKey(string key)
            {
                var vk = VkForName(key);
                if (vk == 0) return;
                SendKey(vk, 0, 0);
                SendKey(vk, 0, KeyEventKeyUp);
            }

            public static void TypeText(string text)
            {
                foreach (var ch in text)
                {
                    SendKey(0, ch, KeyEventUnicode);
                    SendKey(0, ch, KeyEventUnicode | KeyEventKeyUp);
                }
            }

            private static ushort VkForName(string key)
            {
                switch (key.ToLowerInvariant())
                {
                    case "enter": return 0x0D;
                    case "esc":
                    case "escape": return 0x1B;
                    case "tab": return 0x09;
                    case "backspace": return 0x08;
                    case "space": return 0x20;
                    case "delete":
                    case "del": return 0x2E;
                    case "home": return 0x24;
                    case "end": return 0x23;
                    case "pageup": return 0x21;
                    case "pagedown": return 0x22;
                    case "arrowup":
                    case "up": return 0x26;
                    case "arrowdown":
                    case "down": return 0x28;
                    case "arrowleft":
                    case "left": return 0x25;
                    case "arrowright":
                    case "right": return 0x27;
                }
                if (key.Length == 1)
                {
                    var c = key[0];
                    if (c >= 'a' && c <= 'z') return (ushort)(c - 'a' + 0x41);
                    if (c >= 'A' && c <= 'Z') return (ushort)(c - 'A' + 0x41);
                    if (c >= '0' && c <= '9') return (ushort)(c - '0' + 0x30);
                }
                if (key.StartsWith("f", StringComparison.OrdinalIgnoreCase) &&
                    key.Length <= 3 &&
                    int.TryParse(key.Substring(1), out var fn) &&
                    fn >= 1 && fn <= 24)
                {
                    return (ushort)(0x6F + fn);
                }
                return 0;
            }
        }

        private static Bitmap Downscale(Bitmap src, int maxWidth)
        {
            if (src.Width <= maxWidth) return (Bitmap)src.Clone();
            var scale = (double)maxWidth / src.Width;
            var w = maxWidth;
            var h = Math.Max(1, (int)(src.Height * scale));
            var bmp = new Bitmap(w, h);
            using (var g = Graphics.FromImage(bmp))
            {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.DrawImage(src, 0, 0, w, h);
            }
            return bmp;
        }

        public void UnlockSession(int remainingSeconds, string userName)
        {
            _lockHeldUntil = DateTime.MinValue;
            Dbg($"UnlockSession remaining={remainingSeconds} user={userName}");
            ApplyStatus(new Status
            {
                Locked = false,
                RemainingSeconds = remainingSeconds,
                StationName = _cfg.StationName,
                UserName = userName
            });
        }

        public void LockNow()
        {
            _lockHeldUntil = DateTime.Now.AddSeconds(Math.Max(_cfg.PollSeconds * 2, 20) + 5);
            Dbg("LockNow called");
            ApplyStatus(new Status
            {
                Locked = true,
                RemainingSeconds = 0,
                StationName = _cfg.StationName,
                UserName = ""
            });
        }

        public int[] AnnounceMinutes =>
            _cfg.AnnounceMinutesLeft is { Length: > 0 }
                ? _cfg.AnnounceMinutesLeft
                : FallbackAnnounceMinutes;

        private async Task DownloadSoundsAsync()
        {
            _soundsDir = Path.Combine(Path.GetTempPath(), "GamepointAgentSounds");
            try
            {
                Directory.CreateDirectory(_soundsDir);
            }
            catch
            {
            }
            foreach (var minutes in AnnounceMinutes)
            {
                var file = SoundFileName(minutes);
                var local = Path.Combine(_soundsDir, file);
                if (File.Exists(local)) continue;
                try
                {
                    using var resp = await _http.GetAsync($"sounds/{file}");
                    if (resp.IsSuccessStatusCode)
                    {
                        var bytes = await resp.Content.ReadAsByteArrayAsync();
                        await File.WriteAllBytesAsync(local, bytes);
                        Dbg($"Sound downloaded: {file}");
                    }
                    else
                    {
                        Dbg($"Sound download {file}: HTTP {(int)resp.StatusCode}");
                    }
                }
                catch (Exception ex)
                {
                    Dbg($"Sound download {file} failed: {ex.Message}");
                }
            }
        }

        private static string SoundFileName(int minutes) => minutes switch
        {
            1 => "1minute.mp3",
            _ => $"{minutes}minutes.mp3"
        };

        public void PlayAnnouncement(int minutes)
        {
            var file = SoundFileName(minutes);
            var dir = _soundsDir;
            var http = _http;
            Task.Run(async () =>
            {
                var local = Path.Combine(dir, file);
                if (!File.Exists(local))
                {
                    try
                    {
                        Directory.CreateDirectory(dir);
                        using var resp = await http.GetAsync($"sounds/{file}");
                        if (resp.IsSuccessStatusCode)
                        {
                            var bytes = await resp.Content.ReadAsByteArrayAsync();
                            await File.WriteAllBytesAsync(local, bytes);
                            Dbg($"Announcement download: {file}");
                        }
                        else
                        {
                            Dbg($"Announcement download {file}: HTTP {(int)resp.StatusCode}");
                        }
                    }
                    catch (Exception ex)
                    {
                        Dbg($"Announcement download {file} failed: {ex.Message}");
                    }
                }
                if (!File.Exists(local))
                {
                    Dbg($"Announcement skipped: {file} not available");
                    return;
                }
try
                        {
                            if (!IsHandleCreated)
                            {
                                Dbg("Announcement skipped: UI not ready");
                                return;
                            }
                            BeginInvoke(() =>
                            {
                                try
                                {
                                    _announcer.Volume = 0.05;
                                    _announcer.Pause();
                                    _announcer.Source = MediaSource.CreateFromUri(new Uri(local));
                                    _announcer.Play();
                                    Dbg($"Announcement played: {minutes} min");
                                }
                                catch (Exception ex)
                                {
                                    Dbg($"Announcement play failed: {ex.Message}");
                                }
                            });
                        }
                catch (Exception ex)
                {
                    Dbg($"Announcement play failed: {ex.Message}");
                }
            });
        }

        public async Task<(bool ok, int remainingSeconds)> LogoutAsync()
        {
            try
            {
                using var resp = await _http.PostAsJsonAsync("api/sessions/logout", new { station_name = _cfg.StationName });
                if (!resp.IsSuccessStatusCode) return (false, 0);
                var data = await resp.Content.ReadFromJsonAsync<JsonElement>();
                var remaining = data.TryGetProperty("remaining_seconds", out var rs) ? rs.GetInt32() : 0;
                return (true, remaining);
            }
            catch
            {
                return (false, 0);
            }
        }

        public async Task ShowPlayerStatusAsync(int remainingSeconds)
        {
            if (CurrentPlayer is null || _lockForm is null || _lockForm.IsDisposed) return;

            var player = CurrentPlayer;
            var points = player.Points - player.ReservedPoints;
            var gfunds = player.Gfunds;

            try
            {
                using var resp = await _http.GetAsync($"api/user?id={Uri.EscapeDataString(player.Id)}");
                if (resp.IsSuccessStatusCode)
                {
                    var data = await resp.Content.ReadFromJsonAsync<JsonElement>();
                    if (data.TryGetProperty("user", out var u))
                    {
                        if (u.TryGetProperty("points", out var p))
                        {
                            var reserved = u.TryGetProperty("reserved_points", out var rp) ? rp.GetInt32() : 0;
                            points = p.GetInt32() - reserved;
                        }
                        if (u.TryGetProperty("gfunds", out var g))
                        {
                            gfunds = g.GetInt32();
                        }
                    }
                }
            }
            catch
            {
                // keep the values from login
            }

            var mins = Math.Max(1, (int)Math.Ceiling(remainingSeconds / 60.0));
            _lockForm.ShowPlayerStatus($"{player.Name} — {FmtMinutes(mins)} left • ₱{gfunds} gfunds • {points} pts");
        }

        private void ApplyStatus(Status st)
        {
            if (!st.Locked && DateTime.Now < _lockHeldUntil)
            {
                return;
            }

            var wasLocked = _current?.Locked ?? true;
            _current = st;
            var lf = _lockForm;
            Dbg($"ApplyStatus locked={st.Locked} wasLocked={wasLocked} lockForm={((lf is null ? "null" : PanelState(lf)))} countdown={( _countdownForm is null ? "null" : PanelState(_countdownForm))} loginPanel={(lf is null ? "n/a" : PanelState(lf.LoginPanel))} paymentPanel={(lf is null ? "n/a" : PanelState(lf.PaymentPanel))} loginCount={(lf is null ? -1 : lf.LoginPanel.Controls.Count)} payCount={(lf is null ? -1 : lf.PaymentPanel.Controls.Count)}");

            if (st.Locked)
            {
                if (!wasLocked)
                {
                    KillChromePlayingYoutube();
                }
                if (_lockForm is null || _lockForm.IsDisposed)
                {
                    _lockForm = new LockForm(this);
                    _lockForm.Show(this);
                }
                else
                {
                    if (!wasLocked)
                    {
                        _lockForm.ResetForNewLock();
                    }
                    _lockForm.Show(this);
                    _lockForm.ForceTop();
                }
                _countdownForm?.SetBalances();
                _countdownForm?.Hide();
                _keepOnTopTimer.Start();
            }
            else
            {
                _keepOnTopTimer.Stop();
                if (_lockForm is not null && !_lockForm.IsDisposed)
                {
                    _lockForm.AllowClose = true;
                    _lockForm.Hide();
                }

                if (st.RemainingSeconds > 0)
                {
                    if (_countdownForm is null || _countdownForm.IsDisposed)
                    {
                        _countdownForm = new CountdownForm(this);
                        _countdownForm.Show(this);
                    }
                    _countdownForm.Show();
                    _countdownForm.SetTime(st.RemainingSeconds);
                    _countdownForm.SetLabel(st.StationName, st.UserName);
                    _countdownForm.SetBalances(st.UserGfunds, st.UserPoints, st.UserTimeCredit);
                    _countdownForm.SetAvatar(st.UserAvatar);
                }
                else
                {
                    _countdownForm?.SetBalances();
                    _countdownForm?.Hide();
                }
                // Sync update banner for newly created forms
                if (_pendingUpdate != null && !string.IsNullOrWhiteSpace(_pendingUpdate.DownloadUrl))
                {
                    _lockForm?.SetUpdateStatus($"Update v{_pendingUpdate.Version} available", true, _pendingUpdate.Version, _pendingUpdate.DownloadUrl);
                    _countdownForm?.SetUpdateStatus($"v{_pendingUpdate.Version} available", true, _pendingUpdate.Version, _pendingUpdate.DownloadUrl);
                }
            }
        }

        private void StartLocalApi()
        {
            var port = _cfg.StationPort;
            Task.Run(() =>
            {
                try
                {
                    using var listener = new HttpListener();
                    listener.Prefixes.Add($"http://localhost:{port}/");
                    listener.Start();
                    while (true)
                    {
                        var ctx = listener.GetContext();
                        try
                        {
                            var origin = ctx.Request.Headers["Origin"];
                            if (!string.IsNullOrEmpty(origin))
                                ctx.Response.Headers.Add("Access-Control-Allow-Origin", origin);
                            ctx.Response.Headers.Add("Access-Control-Allow-Headers", "content-type");
                            ctx.Response.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS");

                            if (ctx.Request.HttpMethod == "OPTIONS")
                            {
                                ctx.Response.StatusCode = 204;
                                ctx.Response.Close();
                                continue;
                            }

                            if (ctx.Request.Url?.AbsolutePath.Trim('/') == "station")
                            {
                                var body = JsonSerializer.Serialize(new { station_name = _cfg.StationName });
                                var bytes = System.Text.Encoding.UTF8.GetBytes(body);
                                ctx.Response.ContentType = "application/json";
                                ctx.Response.ContentLength64 = bytes.Length;
                                ctx.Response.OutputStream.Write(bytes);
                            }
                            else
                            {
                                ctx.Response.StatusCode = 404;
                            }
                        }
                        catch
                        {
                            // client hung up
                        }
                        finally
                        {
                            try { ctx.Response.Close(); } catch { }
                        }
                    }
                }
                catch
                {
                    // cannot bind localhost (port in use / ACL) — station auto-detect disabled
                }
            });
        }
    }

    private sealed class LockForm : Form
    {
        private readonly ControllerForm _controller;
        private readonly Panel _card;
        private readonly Panel _loginPanel;
        private readonly Panel _paymentPanel;

        public Panel LoginPanel => _loginPanel;
        public Panel PaymentPanel => _paymentPanel;
        private readonly TextBox _txtName;
        private readonly TextBox _txtPin;
        private readonly Panel _inputName;
        private readonly Panel _inputPin;
        private readonly Button? _btnShowPin;
        private readonly Label _lblHeaderPlayer;
        private readonly Label _lblHeaderPin;
        private readonly Label _lblError;
        private readonly Panel _pnlStatus;
        private readonly Label _lblStatusHeader;
        private readonly Label _lblStatus;
        private readonly Label _btnAdminNote;
        private readonly Button _btnLogin;

        private readonly Label _lblUser;
        private readonly PictureBox _avatar;
        private readonly Label _lblBalances;
        private readonly Label _lblResume;
        private readonly Button _btnResume;
        private readonly Label _lblCredit;
        private readonly Button _btnCredit;
        private readonly Label _lblPayWith;
        private readonly Button _btnPoints;
        private readonly Button _btnGfunds;
        private readonly Label _lblAmount;
        private readonly FlowLayoutPanel _amountPanel;
        private readonly Label _lblTime;
        private readonly Label _lblStartError;
        private readonly Button _btnStart;
        private readonly Button _btnLogout;
        private readonly Label _lblUpdate;
        private readonly Button _btnUpdate;
        private readonly Button _btnCheckUpdate;

        private LoginUser? _user;
        private string _payment = "points";
        private int _selectedAmount;
        private NumericUpDown? _numCustom;
        private int _resumeSeconds;
        private int _creditMinutes;

        public bool AllowClose { get; set; }

        public LockForm(ControllerForm controller)
        {
            _controller = controller;
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Maximized;
            TopMost = true;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            BackColor = C(COLOR_BG);
            var bg = LoadBg();
            if (bg is not null)
            {
                BackgroundImage = bg;
                BackgroundImageLayout = ImageLayout.Stretch;
            }
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);

            var titleGame = DarkLabel("GAME", 42, Color.White, true);
            var titlePoint = DarkLabel("POINT", 42, C(COLOR_PINK), true);
            var stationLine = DarkLabel($"{controller.StationName}  •  PC LOCKED", 11.5f, C("#ec4899"), true);
            var hint = DarkLabel("Log in to start your session, or ask the cashier to open time", 10.5f, Color.FromArgb(203, 213, 225));

            _card = new Panel
            {
                BackColor = Color.Transparent,
                Size = new Size(350, 400),
                Anchor = AnchorStyles.None
            };
            _card.Region = RoundedRegion(_card, 16);
            _card.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using var path = new GraphicsPath();
                int r = 16;
                var rect = new Rectangle(0, 0, _card.Width - 1, _card.Height - 1);
                path.AddArc(rect.X, rect.Y, r * 2, r * 2, 180, 90);
                path.AddArc(rect.Right - r * 2, rect.Y, r * 2, r * 2, 270, 90);
                path.AddArc(rect.Right - r * 2, rect.Bottom - r * 2, r * 2, r * 2, 0, 90);
                path.AddArc(rect.X, rect.Bottom - r * 2, r * 2, r * 2, 90, 90);
                path.CloseFigure();
                using var brush = new SolidBrush(Color.FromArgb(215, 15, 23, 42));
                e.Graphics.FillPath(brush, path);
                using var pen = new Pen(Color.FromArgb(45, 255, 255, 255), 1);
                e.Graphics.DrawPath(pen, path);
            };

            // ---- LOGIN PANEL ---- (302px width inside 350px card with 24px margins)
            _loginPanel = new Panel { BackColor = Color.Transparent, Size = new Size(302, 350) };

            _pnlStatus = new Panel
            {
                BackColor = Color.Transparent,
                Size = new Size(302, 58),
                Visible = false
            };
            _pnlStatus.Paint += (s, e) =>
            {
                e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
                using var path = new GraphicsPath();
                int r = 10;
                var rect = new Rectangle(0, 0, _pnlStatus.Width - 1, _pnlStatus.Height - 1);
                path.AddArc(rect.X, rect.Y, r * 2, r * 2, 180, 90);
                path.AddArc(rect.Right - r * 2, rect.Y, r * 2, r * 2, 270, 90);
                path.AddArc(rect.Right - r * 2, rect.Bottom - r * 2, r * 2, r * 2, 0, 90);
                path.AddArc(rect.X, rect.Bottom - r * 2, r * 2, r * 2, 90, 90);
                path.CloseFigure();
                using var brush = new SolidBrush(Color.FromArgb(220, 6, 78, 59));
                e.Graphics.FillPath(brush, path);
                using var pen = new Pen(Color.FromArgb(16, 185, 129), 1.2f);
                e.Graphics.DrawPath(pen, path);
            };
            _lblStatusHeader = DarkLabel("✓  SESSION SAVED", 8.5f, Color.FromArgb(52, 211, 153), true);
            _lblStatus = DarkLabel("", 9f, Color.FromArgb(236, 253, 245), false);
            _lblStatus.MaximumSize = new Size(280, 0);
            _lblStatusHeader.Location = new Point(12, 8);
            _lblStatus.Location = new Point(12, 26);
            _pnlStatus.Controls.AddRange(new Control[] { _lblStatusHeader, _lblStatus });

            _lblHeaderPlayer = DarkLabel("PLAYER NAME", 8.5f, Color.FromArgb(148, 163, 184), true);
            _inputName = ModernInput(false, out _txtName, 302);
            _lblHeaderPin = DarkLabel("PIN", 8.5f, Color.FromArgb(148, 163, 184), true);
            _inputPin = ModernInput(true, out _txtPin, 302);
            _btnShowPin = _inputPin.Controls.OfType<Button>().FirstOrDefault(b => (b.Tag as string) == "show-toggle");

            _btnLogin = DarkButton("Login", COLOR_ACCENT);
            MakeGradientButton(_btnLogin);
            _btnLogin.Cursor = Cursors.Hand;
            _btnLogin.Font = F(11.5f, FontStyle.Bold);

            _lblError = DarkLabel("", 9.5f, C(COLOR_ERROR));
            _lblError.MaximumSize = new Size(302, 50);

            _btnAdminNote = DarkLabel("No account? Ask the cashier to create one", 9f, Color.FromArgb(148, 163, 184));
            _btnAdminNote.AutoSize = true;

            _btnLogin.Click += async (_, _) => await DoLoginAsync();
            _txtName.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; _ = DoLoginAsync(); } };
            _txtPin.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; _ = DoLoginAsync(); } };
            _txtName.TextChanged += (_, _) => { if (_pnlStatus.Visible) { _pnlStatus.Visible = false; LayoutLoginPanel(); } };
            _txtPin.TextChanged += (_, _) => { if (_pnlStatus.Visible) { _pnlStatus.Visible = false; LayoutLoginPanel(); } };

            _loginPanel.Controls.AddRange(new Control[] { _pnlStatus, _lblHeaderPlayer, _inputName, _lblHeaderPin, _inputPin, _btnLogin, _lblError, _btnAdminNote });
            LayoutLoginPanel();

            // ---- PAYMENT PANEL ---- (302px width, transparent)
            _paymentPanel = new Panel { BackColor = Color.Transparent, Size = new Size(302, 520), AutoScroll = true };
            _lblUser = DarkLabel("", 13, Color.White, true);
            _lblUser.MaximumSize = new Size(240, 0);
            _avatar = new PictureBox
            {
                Size = new Size(44, 44),
                SizeMode = PictureBoxSizeMode.StretchImage,
                BackColor = Color.Transparent,
                Visible = false
            };
            _lblBalances = DarkLabel("", 10.5f, Color.FromArgb(160, 160, 175));
            _lblBalances.MaximumSize = new Size(302, 0);
            _lblResume = DarkLabel("", 10.5f, Color.FromArgb(160, 160, 175));
            _lblResume.MaximumSize = new Size(302, 0);
            _lblResume.Visible = false;
            _btnResume = DarkButton("Resume Session", COLOR_GREEN);
            MakeGradientButton(_btnResume);
            _btnResume.Visible = false;
            _btnResume.Click += async (_, _) => await DoResumeAsync();
            _lblCredit = DarkLabel("", 10.5f, Color.FromArgb(160, 160, 175));
            _lblCredit.MaximumSize = new Size(302, 0);
            _lblCredit.Visible = false;
            _btnCredit = DarkButton("Continue with Shared Time", COLOR_GREEN);
            MakeGradientButton(_btnCredit, Color.FromArgb(13, 148, 136), Color.FromArgb(5, 150, 105));
            _btnCredit.Visible = false;
            _btnCredit.Click += async (_, _) => await DoContinueCreditAsync();
            _lblPayWith = DarkLabel("Pay with:", 9.5f, Color.FromArgb(160, 160, 175), true);
            _btnPoints = DarkButton("Gamepoints", COLOR_ACCENT);
            _btnGfunds = DarkButton("Gfunds", COLOR_INPUT);
            RoundButton(_btnPoints, 10);
            RoundButton(_btnGfunds, 10);
            _btnPoints.Click += (_, _) => SetPayment("points");
            _btnGfunds.Click += (_, _) => SetPayment("gfunds");
            _lblAmount = DarkLabel("Amount:", 9.5f, Color.FromArgb(160, 160, 175), true);
            _amountPanel = new FlowLayoutPanel
            {
                FlowDirection = FlowDirection.LeftToRight,
                WrapContents = true,
                Size = new Size(302, 86),
                AutoSize = true,
                AutoSizeMode = AutoSizeMode.GrowAndShrink,
                MaximumSize = new Size(302, 120),
                BackColor = Color.Transparent
            };
            _lblTime = DarkLabel("", 12, C(COLOR_GREEN), true);
            _btnStart = DarkButton("Start Session", COLOR_GREEN);
            MakeGradientButton(_btnStart);
            _btnStart.Click += async (_, _) => await DoStartAsync();
            _lblStartError = DarkLabel("", 10, C(COLOR_ERROR));
            _lblStartError.MaximumSize = new Size(302, 60);
            _btnLogout = DarkButton("Back", "#334155");
            RoundButton(_btnLogout, 10);
            _btnLogout.Click += (_, _) => ShowLogin();

            _btnResume.Size = new Size(302, 38);
            _btnCredit.Size = new Size(302, 38);
            _btnPoints.Size = new Size(147, 38);
            _btnGfunds.Size = new Size(147, 38);
            _btnStart.Size = new Size(302, 42);
            _btnLogout.Size = new Size(302, 34);

            _paymentPanel.Controls.AddRange(new Control[] { _avatar, _lblUser, _lblBalances, _lblResume, _btnResume, _lblCredit, _btnCredit, _lblPayWith, _btnPoints, _btnGfunds, _lblAmount, _amountPanel, _lblTime, _btnStart, _lblStartError, _btnLogout });
            LayoutPaymentPanel();

            _lblUpdate = DarkLabel($"v{Updater.CurrentVersion}", 8.5f, Color.FromArgb(148, 163, 184), true);
            _lblUpdate.AutoSize = true;
            _lblUpdate.Cursor = Cursors.Hand;
            _lblUpdate.Click += async (_, _) => await _controller.CheckForUpdatesAsync(true);
            _btnUpdate = DarkButton("Update Now", COLOR_GREEN);
            MakeGradientButton(_btnUpdate, Color.FromArgb(22, 163, 74), Color.FromArgb(5, 150, 105));
            _btnUpdate.Size = new Size(110, 28);
            _btnUpdate.Font = F(8, FontStyle.Bold);
            _btnUpdate.Visible = false;
            _btnUpdate.Click += async (_, _) => await _controller.ApplyPendingUpdateAsync(this);
            _btnCheckUpdate = DarkButton("Check for Update", "#1e293b");
            RoundButton(_btnCheckUpdate, 8);
            _btnCheckUpdate.Size = new Size(120, 28);
            _btnCheckUpdate.Font = F(7.5f, FontStyle.Bold);
            _btnCheckUpdate.FlatAppearance.BorderSize = 1;
            _btnCheckUpdate.FlatAppearance.BorderColor = C("#334155");
            _btnCheckUpdate.Click += async (_, _) => await _controller.CheckForUpdatesAsync(true);

            Controls.AddRange(new Control[] { titleGame, titlePoint, stationLine, hint, _card, _lblUpdate, _btnUpdate, _btnCheckUpdate });
            _card.Controls.Add(_loginPanel);
            _card.Controls.Add(_paymentPanel);

            _loginPanel.Location = new Point(24, 24);
            _paymentPanel.Location = new Point(24, 24);
            _paymentPanel.Visible = false;

            Resize += (_, _) => CenterCard(titleGame, titlePoint, stationLine, hint);
            Dbg($"LockForm ctor done login={PanelState(_loginPanel)} pay={PanelState(_paymentPanel)} card={PanelState(_card)}");
        }

        public void SetUpdateStatus(string? text, bool hasUpdate, string? version = null, string? url = null)
        {
            if (IsDisposed || !IsHandleCreated) return;
            try
            {
                BeginInvoke(() =>
                {
                    if (!string.IsNullOrEmpty(text))
                        _lblUpdate.Text = text;
                    else
                        _lblUpdate.Text = $"v{Updater.CurrentVersion}";
                    _btnUpdate.Visible = hasUpdate;
                    if (hasUpdate && !string.IsNullOrEmpty(version))
                        _btnUpdate.Text = $"Update to v{version}";
                    _btnCheckUpdate.Visible = true;
                    if (Controls.Count >= 4)
                        CenterCard(Controls[0], Controls[1], Controls[2], Controls[3]);
                });
            }
            catch { }
        }

        private void CenterCard(Control titleGame, Control titlePoint, Control stationLine, Control hint)
        {
            const int LEFT_MARGIN = 80;
            int cardX = LEFT_MARGIN;

            int headerHeight = titleGame.Height + 10 + stationLine.Height + 6 + hint.Height;
            int totalBlockHeight = headerHeight + 22 + _card.Height;
            int blockStartY = Math.Max(28, (Height - totalBlockHeight) / 2);

            titleGame.Location = new Point(cardX, blockStartY);
            titlePoint.Location = new Point(titleGame.Right + 6, blockStartY);
            stationLine.Location = new Point(cardX, titleGame.Bottom + 10);
            hint.Location = new Point(cardX, stationLine.Bottom + 6);

            int cardY = hint.Bottom + 22;
            _card.Location = new Point(cardX, cardY);
            _card.Invalidate();

            // Update banner at bottom-left
            try
            {
                var lblUpd = _lblUpdate;
                var btnChk = _btnCheckUpdate;
                var btnUpd = _btnUpdate;
                if (lblUpd != null)
                {
                    int footerY = Height - 44;
                    lblUpd.Location = new Point(cardX, footerY + 5);
                    if (btnChk != null)
                        btnChk.Location = new Point(lblUpd.Right + 12, footerY);
                    if (btnUpd != null && btnUpd.Visible && btnChk != null)
                        btnUpd.Location = new Point(btnChk.Right + 8, footerY);
                }
            }
            catch { }
        }

        private void LayoutLoginPanel()
        {
            if (_loginPanel is null) return;
            _loginPanel.SuspendLayout();
            int y = 0;

            if (_pnlStatus.Visible)
            {
                _pnlStatus.Location = new Point(0, y);
                _pnlStatus.Size = new Size(302, 58);
                y += 66;
            }

            _lblHeaderPlayer.Location = new Point(0, y);
            y += 18;
            _inputName.Location = new Point(0, y);
            y += 50;

            _lblHeaderPin.Location = new Point(0, y);
            y += 18;
            _inputPin.Location = new Point(0, y);
            y += 52;

            _btnLogin.Location = new Point(0, y);
            _btnLogin.Size = new Size(302, 44);
            y += 50;

            if (!string.IsNullOrEmpty(_lblError.Text))
            {
                _lblError.Location = new Point(0, y);
                _lblError.Visible = true;
                y += Math.Max(20, _lblError.PreferredSize.Height) + 8;
            }
            else
            {
                _lblError.Visible = false;
                y += 4;
            }

            _btnAdminNote.Location = new Point(0, y + 6);
            y += _btnAdminNote.Height + 10;

            _loginPanel.Size = new Size(302, y);
            _card.Size = new Size(350, y + 48);
            _card.Region = RoundedRegion(_card, 16);
            _loginPanel.ResumeLayout(false);
            _loginPanel.PerformLayout();

            if (Controls.Count >= 4)
                CenterCard(Controls[0], Controls[1], Controls[2], Controls[3]);
        }

        private void LayoutPaymentPanel()
        {
            if (_paymentPanel is null || _lblPayWith is null || _lblAmount is null || _btnLogout is null) return;
            _paymentPanel.SuspendLayout();
            int y = 0;
            _avatar.Location = new Point(0, y);
            _lblUser.Location = new Point(56, y + 12);
            y += 52;
            _lblBalances.Location = new Point(0, y);
            y += _lblBalances.Height + 10;

            if (_lblResume.Visible)
            {
                _lblResume.Location = new Point(0, y);
                y += _lblResume.Height + 4;
            }
            if (_btnResume.Visible)
            {
                _btnResume.Location = new Point(0, y);
                _btnResume.Size = new Size(302, 38);
                y += 46;
            }
            if (_lblCredit.Visible)
            {
                _lblCredit.Location = new Point(0, y);
                y += _lblCredit.Height + 4;
            }
            if (_btnCredit.Visible)
            {
                _btnCredit.Location = new Point(0, y);
                _btnCredit.Size = new Size(302, 38);
                y += 46;
            }

            _lblPayWith.Location = new Point(0, y);
            y += _lblPayWith.Height + 6;
            _btnPoints.Location = new Point(0, y);
            _btnPoints.Size = new Size(147, 38);
            _btnGfunds.Location = new Point(155, y);
            _btnGfunds.Size = new Size(147, 38);
            y += 46;

            _lblAmount.Location = new Point(0, y);
            y += _lblAmount.Height + 6;
            _amountPanel.Location = new Point(0, y);
            _amountPanel.MaximumSize = new Size(302, 120);
            int amountH = _amountPanel.PreferredSize.Height;
            if (amountH < 34) amountH = 34;
            if (amountH > 120) amountH = 120;
            y += amountH + 6;

            _lblTime.Location = new Point(0, y);
            y += string.IsNullOrEmpty(_lblTime.Text) ? 8 : 26;
            _btnStart.Location = new Point(0, y);
            _btnStart.Size = new Size(302, 42);
            y += 50;

            _lblStartError.Location = new Point(0, y);
            if (!string.IsNullOrEmpty(_lblStartError.Text))
                y += Math.Max(16, _lblStartError.PreferredSize.Height) + 6;
            else
                y += 4;
            _btnLogout.Location = new Point(0, y);
            _btnLogout.Size = new Size(302, 34);
            y += 42;

            _paymentPanel.Size = new Size(302, y);
            _card.Size = new Size(350, y + 48);
            _card.Region = RoundedRegion(_card, 16);
            _paymentPanel.ResumeLayout(false);
            _paymentPanel.PerformLayout();

            if (Controls.Count >= 4)
                CenterCard(Controls[0], Controls[1], Controls[2], Controls[3]);
        }

        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            var titleGame = Controls[0];
            var titlePoint = Controls[1];
            var stationLine = Controls[2];
            var hint = Controls[3];
            CenterCard(titleGame, titlePoint, stationLine, hint);
            Activate();
            ForceTop();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (!AllowClose) e.Cancel = true;
            base.OnFormClosing(e);
        }

        public void ForceTop()
        {
            if (IsDisposed || !Visible) return;
            Activate();
            BringToFront();
        }

        private void ShowLogin()
        {
            _loginPanel.Visible = true;
            _paymentPanel.Visible = false;
            _loginPanel.BringToFront();
            foreach (Control c in _loginPanel.Controls)
            {
                c.Visible = true;
            }
            _pnlStatus.Visible = !string.IsNullOrEmpty(_lblStatus.Text);
            _lblError.Text = "";
            _lblStartError.Text = "";
            _txtName.Text = "";
            _txtPin.Text = "";
            SetShowToggle(_btnShowPin, _txtPin, false, null, false);
            _txtName.Focus();
            LayoutLoginPanel();
            Dbg($"ShowLogin login={PanelState(_loginPanel)} pay={PanelState(_paymentPanel)} cardVisible={_card.Visible} cardLoc={_card.Location} formVisible={Visible}");
        }

        public void ResetForNewLock()
        {
            _user = null;
            _payment = "points";
            _selectedAmount = 0;
            _resumeSeconds = 0;
            _creditMinutes = 0;
            _lblResume.Visible = false;
            _btnResume.Visible = false;
            _lblCredit.Visible = false;
            _btnCredit.Visible = false;
            _lblStartError.Text = "";
            _lblStatus.Text = "";
            _pnlStatus.Visible = false;
            _avatar.Visible = false;
            ShowLogin();
            Dbg($"ResetForNewLock done login={PanelState(_loginPanel)} pay={PanelState(_paymentPanel)}");
        }

        public void ShowPlayerStatus(string text)
        {
            if (IsDisposed || !IsHandleCreated) return;
            _lblStatus.Text = text;
            _pnlStatus.Visible = true;
            _pnlStatus.BringToFront();
            _lblStartError.Text = "";
            LayoutLoginPanel();
        }

        private void SetError(string msg)
        {
            _lblError.Text = msg;
            _lblStartError.Text = msg;
            LayoutLoginPanel();
        }

        private void SetPayment(string payment)
        {
            _payment = payment;
            _selectedAmount = 0;
            _lblTime.Text = "";
            _lblStartError.Text = "";
            _btnPoints.BackColor = payment == "points" ? C(COLOR_ACCENT) : C(COLOR_INPUT);
            _btnGfunds.BackColor = payment == "gfunds" ? C(COLOR_GREEN) : C(COLOR_INPUT);

            _amountPanel.Controls.Clear();
            var amounts = payment == "points" ? new[] { 20, 40, 60, 100 } : new[] { 10, 20, 50 };
            foreach (var a in amounts)
            {
                var btn = QuickButton(payment == "points" ? $"{a} pts" : $"₱{a}");
                btn.Tag = a;
                btn.Click += (sender, _) =>
                {
                    if (sender is not Button b || b.Tag is not int amount) return;
                    _selectedAmount = amount;
                    _lblTime.Text = payment == "points"
                        ? FmtMinutes((int)(amount / 20.0 * 8))
                        : FmtMinutes(amount * 4);
                    _lblStartError.Text = "";
                    LayoutPaymentPanel();
                };
                _amountPanel.Controls.Add(btn);
            }

            if (payment == "gfunds")
            {
                var customBtn = QuickButton("Custom");
                customBtn.Click += (_, _) =>
                {
                    _selectedAmount = (int)_numCustom!.Value;
                    _lblTime.Text = FmtMinutes(_selectedAmount * 4);
                    _lblStartError.Text = "";
                    LayoutPaymentPanel();
                };
                _amountPanel.Controls.Add(customBtn);

                _numCustom = new NumericUpDown
                {
                    Minimum = 1,
                    Maximum = 100000,
                    Value = 100,
                    Width = 140,
                    Height = 34,
                    BackColor = C(COLOR_INPUT),
                    ForeColor = Color.White,
                    Font = F(11.5f),
                    BorderStyle = BorderStyle.FixedSingle
                };
                _numCustom.ValueChanged += (_, _) =>
                {
                    _selectedAmount = (int)_numCustom.Value;
                    _lblTime.Text = FmtMinutes(_selectedAmount * 4);
                    _lblStartError.Text = "";
                    LayoutPaymentPanel();
                };
                _amountPanel.Controls.Add(_numCustom);
            }
            if (_paymentPanel.Visible)
                LayoutPaymentPanel();
        }

        private async Task DoLoginAsync()
        {
            var name = _txtName.Text.Trim();
            var pin = _txtPin.Text;
            if (name == "" || pin == "")
            {
                _lblError.Text = "Enter name and PIN";
                LayoutLoginPanel();
                return;
            }

            _lblError.Text = "Logging in...";
            LayoutLoginPanel();
            try
            {
                using var resp = await _controller.Http.PostAsJsonAsync("api/login", new { name, pin });
                var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
                if (json.TryGetProperty("error", out var err))
                {
                    _lblError.Text = err.GetString() ?? "Login failed";
                    LayoutLoginPanel();
                    return;
                }

                _user = json.Deserialize<LoginUser>(ApiJson);
                if (_user is null)
                {
                    _lblError.Text = "Invalid server response";
                    LayoutLoginPanel();
                    return;
                }
                _controller.CurrentPlayer = _user;
                _pnlStatus.Visible = false;
                _lblUser.Text = $"Player: {_user.Name}";
                var creditText = _user.TimeCreditMinutes > 0
                    ? $"  •  {FmtMinutes(_user.TimeCreditMinutes)} shared time"
                    : "";
                _lblBalances.Text = $"Gfunds ₱{_user.Gfunds}  •  Gamepoints {_user.Points - _user.ReservedPoints}{creditText}";
                _ = LoadAvatarAsync(_controller.Http, _avatar, _user.AvatarUrl);

                _resumeSeconds = 0;
                _creditMinutes = _user.TimeCreditMinutes;
                try
                {
                    using var resumeResp = await _controller.Http.GetAsync($"api/sessions/resume?user_id={Uri.EscapeDataString(_user.Id)}");
                    var resumeJson = await resumeResp.Content.ReadFromJsonAsync<JsonElement>();
                    if (resumeJson.TryGetProperty("resume_seconds", out var rs))
                    {
                        _resumeSeconds = rs.GetInt32();
                    }
                }
                catch
                {
                    // no saved time — fall through to the payment panel
                }

                _txtName.Text = "";
                _txtPin.Text = "";
                ShowPayment();
            }
            catch
            {
                _lblError.Text = "Cannot reach the server";
                LayoutLoginPanel();
            }
        }

        private void ShowPayment()
        {
            // Resume now merges any stranded shared time server-side, so when
            // both exist we present a single combined Resume option instead of
            // forcing the player to pick one and lose the other.
            var hasResume = _resumeSeconds > 0;
            var hasCredit = _creditMinutes > 0;
            var resumeIncludesCredit = hasResume && hasCredit;

            _lblResume.Visible = hasResume;
            _btnResume.Visible = hasResume;
            _lblCredit.Visible = hasCredit;
            _btnCredit.Visible = hasCredit && !hasResume;

            if (hasResume)
            {
                var mins = (int)Math.Ceiling(_resumeSeconds / 60.0);
                if (resumeIncludesCredit)
                {
                    var totalMins = mins + _creditMinutes;
                    _lblResume.Text = $"Saved time: {FmtMinutes(mins)} + {FmtMinutes(_creditMinutes)} shared time = {FmtMinutes(totalMins)} total";
                    _btnResume.Text = $"Resume Session — {FmtMinutes(totalMins)} (incl. shared)";
                    _lblCredit.Text = $"Shared time: {FmtMinutes(_creditMinutes)} will be added automatically when you resume";
                }
                else
                {
                    _lblResume.Text = $"Saved time: {FmtMinutes(mins)} left from your last session";
                    _btnResume.Text = $"Resume Session — {FmtMinutes(mins)}";
                }
            }
            if (hasCredit && !hasResume)
            {
                _lblCredit.Text = $"Shared time: {FmtMinutes(_creditMinutes)} received from another player";
                _btnCredit.Text = $"Continue with Shared Time — {FmtMinutes(_creditMinutes)}";
            }

            SetPayment("points");
            _loginPanel.Visible = false;
            _paymentPanel.Visible = true;
            _paymentPanel.BringToFront();
            foreach (Control c in _paymentPanel.Controls)
            {
                c.Visible = true;
            }
            _lblResume.Visible = _resumeSeconds > 0;
            _btnResume.Visible = _resumeSeconds > 0;
            _lblCredit.Visible = _creditMinutes > 0;
            _btnCredit.Visible = _creditMinutes > 0 && _resumeSeconds <= 0;
            LayoutPaymentPanel();
            Activate();
            Dbg($"ShowPayment login={PanelState(_loginPanel)} pay={PanelState(_paymentPanel)} user={( _user is null ? "null" : _user.Name )}");
        }

        private async Task DoResumeAsync()
        {
            if (_user is null || _resumeSeconds <= 0)
            {
                return;
            }

            _btnResume.Enabled = false;
            _lblStartError.Text = "Resuming...";
            try
            {
                using var resp = await _controller.Http.PostAsJsonAsync("api/sessions/resume", new { user_id = _user.Id, station_name = _controller.StationName });
                var data = await resp.Content.ReadFromJsonAsync<JsonElement>();
                if (data.TryGetProperty("error", out var err))
                {
                    _lblStartError.Text = err.GetString() ?? "Resume failed";
                    return;
                }
                var remaining = data.TryGetProperty("remaining_seconds", out var rs) ? rs.GetInt32() : _resumeSeconds;
                // Resume merges stranded shared time server-side — clear local
                // copies so a later Add Time dialog doesn't offer stale credit.
                _resumeSeconds = 0;
                _creditMinutes = 0;
                _loginPanel.Visible = false;
                _paymentPanel.Visible = false;
                _controller.UnlockSession(remaining, _user.Name);
                Activate();
            }
            catch
            {
                _lblStartError.Text = "Cannot reach the server";
            }
            finally
            {
                _btnResume.Enabled = true;
            }
        }

        private async Task DoContinueCreditAsync()
        {
            if (_user is null || _creditMinutes <= 0)
            {
                return;
            }

            _btnCredit.Enabled = false;
            _lblStartError.Text = "Starting...";
            try
            {
                using var resp = await _controller.Http.PostAsJsonAsync("api/sessions/start", new
                {
                    user_id = _user.Id,
                    station_name = _controller.StationName,
                    payment = "credit"
                });
                var data = await resp.Content.ReadFromJsonAsync<StartResponse>();
                if (!string.IsNullOrEmpty(data?.Error))
                {
                    _lblStartError.Text = data.Error;
                    return;
                }
                _loginPanel.Visible = false;
                _paymentPanel.Visible = false;
                _resumeSeconds = 0;
                _creditMinutes = 0;
                _controller.UnlockSession(data?.RemainingSeconds ?? 0, _user.Name);
                _lblStartError.Text = "";
                Activate();
            }
            catch
            {
                _lblStartError.Text = "Cannot reach the server";
            }
            finally
            {
                _btnCredit.Enabled = true;
            }
        }

        private async Task DoStartAsync()
        {
            if (_user is null || _selectedAmount <= 0)
            {
                _lblStartError.Text = "Choose an amount first";
                return;
            }

            if (_resumeSeconds > 0)
            {
                var mins = (int)Math.Ceiling(_resumeSeconds / 60.0);
                var extra = _creditMinutes > 0
                    ? $" Your {FmtMinutes(_creditMinutes)} shared time will still be included."
                    : "";
                var confirm = MessageBox.Show(
                    $"Starting a new session discards your saved {FmtMinutes(mins)}.{extra} Continue?",
                    "Start Session",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question);
                if (confirm != DialogResult.Yes)
                {
                    return;
                }
            }

            _btnStart.Enabled = false;
            _lblStartError.Text = "Starting...";
            try
            {
                using var resp = await _controller.Http.PostAsJsonAsync("api/sessions/start", new
                {
                    user_id = _user.Id,
                    station_name = _controller.StationName,
                    payment = _payment,
                    points = _payment == "points" ? _selectedAmount : (int?)null,
                    gfunds = _payment == "gfunds" ? _selectedAmount : (int?)null
                });
                var data = await resp.Content.ReadFromJsonAsync<StartResponse>();
                if (!string.IsNullOrEmpty(data?.Error))
                {
                    _lblStartError.Text = data.Error;
                    return;
                }

                _controller.UnlockSession(data?.RemainingSeconds ?? 0, _user.Name);
                // New purchases merge stranded shared time server-side and a new
                // start discards paused time — clear local copies on success.
                _resumeSeconds = 0;
                _creditMinutes = 0;
                _lblStartError.Text = "";
            }
            catch
            {
                _lblStartError.Text = "Cannot reach the server";
            }
            finally
            {
                _btnStart.Enabled = true;
            }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            PaintDarkOverlay(this, e, 90);
        }
    }

    private sealed class CountdownForm : Form
    {
        private readonly ControllerForm _controller;
        private readonly Label _label;
        private readonly Label _station;
        private readonly Label _balances;
        private readonly PictureBox _avatar;
        private readonly Button _btnAddTime;
        private readonly Button _btnShareTime;
        private readonly Button _btnChangePin;
        private readonly Button _btnLogout;
        private readonly Button _btnMin;
        private readonly Label _lblUpdate;
        private readonly Button _btnUpdate;
        private readonly Button _btnCheckUpdate;
        private bool _minimized;
        private bool _hasUser;
        private bool _dragging;
        private Point _dragOffset;

        public CountdownForm(ControllerForm controller)
        {
            _controller = controller;
            FormBorderStyle = FormBorderStyle.None;
            TopMost = true;
            ShowInTaskbar = false;
            BackColor = C("#14161f");
            var bg = LoadBg();
            if (bg is not null)
            {
                BackgroundImage = bg;
                BackgroundImageLayout = ImageLayout.Stretch;
            }
            StartPosition = FormStartPosition.Manual;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);

            _station = new Label
            {
                AutoSize = true,
                ForeColor = Color.FromArgb(200, 200, 215),
                BackColor = Color.Transparent,
                Font = F(9, FontStyle.Bold),
                Location = new Point(36, 6)
            };
            _avatar = new PictureBox
            {
                Size = new Size(18, 18),
                SizeMode = PictureBoxSizeMode.StretchImage,
                BackColor = Color.Transparent,
                Visible = false,
                Location = new Point(12, 4)
            };
            _label = new Label
            {
                AutoSize = true,
                ForeColor = Color.White,
                BackColor = Color.Transparent,
                Font = F(18, FontStyle.Bold),
                Location = new Point(12, 24)
            };
            _balances = new Label
            {
                AutoSize = true,
                ForeColor = C(COLOR_PINK),
                BackColor = Color.Transparent,
                Font = F(9, FontStyle.Bold),
                Location = new Point(12, 52)
            };
            _btnLogout = new Button
            {
                Text = "Logout",
                FlatStyle = FlatStyle.Flat,
                BackColor = C("#7f1d1d"),
                ForeColor = Color.White,
                Font = F(9, FontStyle.Bold),
                Height = 30,
                Location = new Point(116, 112),
                Size = new Size(72, 30),
                FlatAppearance = { BorderSize = 0 }
            };
            _btnLogout.Click += async (_, _) => await LogoutAsync();
            _btnAddTime = new Button
            {
                Text = "Add Time",
                FlatStyle = FlatStyle.Flat,
                BackColor = C(COLOR_ACCENT),
                ForeColor = Color.White,
                Font = F(9, FontStyle.Bold),
                Height = 30,
                Location = new Point(12, 78),
                Size = new Size(76, 30),
                FlatAppearance = { BorderSize = 0 },
                Visible = false
            };
            MakeGradientButton(_btnAddTime);
            _btnAddTime.Click += (_, _) =>
            {
                if (string.IsNullOrEmpty(_controller.CurrentUserId)) return;
                using var dlg = new AddTimeForm(_controller);
                if (dlg.ShowDialog(this) == DialogResult.OK)
                {
                    _ = _controller.PollAsync();
                }
            };
            _btnShareTime = new Button
            {
                Text = "Share Time",
                FlatStyle = FlatStyle.Flat,
                BackColor = C("#0d9488"),
                ForeColor = Color.White,
                Font = F(9, FontStyle.Bold),
                Height = 30,
                Location = new Point(92, 78),
                Size = new Size(76, 30),
                FlatAppearance = { BorderSize = 0 },
                Visible = false
            };
            MakeGradientButton(_btnShareTime, Color.FromArgb(13, 148, 136), Color.FromArgb(5, 150, 105));
            _btnShareTime.Click += (_, _) =>
            {
                if (string.IsNullOrEmpty(_controller.CurrentUserId)) return;
                using var dlg = new ShareTimeForm(_controller);
                if (dlg.ShowDialog(this) == DialogResult.OK)
                {
                    _ = _controller.PollAsync();
                }
            };
            _btnChangePin = new Button
            {
                Text = "Change Password",
                FlatStyle = FlatStyle.Flat,
                BackColor = C("#334155"),
                ForeColor = Color.White,
                Font = F(8, FontStyle.Bold),
                Height = 30,
                Location = new Point(12, 112),
                Size = new Size(96, 30),
                FlatAppearance = { BorderSize = 0 },
                Visible = false
            };
            _btnChangePin.Click += (_, _) =>
            {
                var userId = _controller.CurrentUserId;
                if (string.IsNullOrEmpty(userId)) return;
                using var dlg = new ChangePinForm(_controller.Http, userId);
                dlg.ShowDialog(this);
            };
            _btnMin = new Button
            {
                Text = "–",
                FlatStyle = FlatStyle.Flat,
                BackColor = C("#1e293b"),
                ForeColor = Color.White,
                Font = F(10, FontStyle.Bold),
                Location = new Point(232, 6),
                Size = new Size(22, 20),
                FlatAppearance = { BorderSize = 0 }
            };
            _btnMin.Click += (_, _) => SetMinimized(true);

            _lblUpdate = new Label
            {
                AutoSize = false,
                ForeColor = Color.FromArgb(150, 160, 175),
                BackColor = Color.Transparent,
                Font = F(7),
                Location = new Point(12, 148),
                Size = new Size(110, 14),
                Text = $"v{Updater.CurrentVersion}",
                TextAlign = ContentAlignment.MiddleLeft,
                Cursor = Cursors.Hand
            };
            _lblUpdate.Click += async (_, _) => await _controller.CheckForUpdatesAsync(true);
            _btnUpdate = new Button
            {
                Text = "Update Now",
                FlatStyle = FlatStyle.Flat,
                BackColor = C(COLOR_GREEN),
                ForeColor = Color.White,
                Font = F(7, FontStyle.Bold),
                Size = new Size(78, 22),
                Location = new Point(124, 144),
                FlatAppearance = { BorderSize = 0 },
                Visible = false
            };
            MakeGradientButton(_btnUpdate, Color.FromArgb(22, 163, 74), Color.FromArgb(5, 150, 105));
            _btnUpdate.Click += async (_, _) => await _controller.ApplyPendingUpdateAsync(this);
            _btnCheckUpdate = new Button
            {
                Text = "Check",
                FlatStyle = FlatStyle.Flat,
                BackColor = C("#334155"),
                ForeColor = Color.White,
                Font = F(7),
                Size = new Size(44, 22),
                Location = new Point(204, 144),
                FlatAppearance = { BorderSize = 0 }
            };
            RoundButton(_btnCheckUpdate, 6);
            _btnCheckUpdate.Click += async (_, _) => await _controller.CheckForUpdatesAsync(true);
            _lblUpdate.MouseDown += OnDragStart;
            _btnUpdate.MouseDown += OnDragStart;
            _btnCheckUpdate.MouseDown += OnDragStart;

            MouseDown += OnDragStart;
            MouseMove += OnDragMove;
            MouseUp += (_, _) => EndDrag();
            _station.MouseDown += OnDragStart;
            _label.MouseDown += OnDragStart;
            _balances.MouseDown += OnDragStart;
            _avatar.MouseDown += OnDragStart;

            Controls.Add(_station);
            Controls.Add(_avatar);
            Controls.Add(_label);
            Controls.Add(_balances);
            Controls.Add(_btnAddTime);
            Controls.Add(_btnShareTime);
            Controls.Add(_btnChangePin);
            Controls.Add(_btnLogout);
            Controls.Add(_btnMin);
            Controls.Add(_lblUpdate);
            Controls.Add(_btnUpdate);
            Controls.Add(_btnCheckUpdate);

            var screen = Screen.PrimaryScreen?.WorkingArea ?? Screen.GetBounds(Point.Empty);
            Location = new Point(screen.Right - 276, screen.Bottom - 170);
            ApplyLayout();
        }

        private void OnDragStart(object? sender, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            if (_minimized)
            {
                SetMinimized(false);
                return;
            }
            // Never steal mouse capture from clickable controls: setting Capture
            // on the form during a Button/Label press prevents Click from firing.
            if (sender is Button || sender == _lblUpdate) return;
            _dragging = true;
            _dragOffset = new Point(Cursor.Position.X - Location.X, Cursor.Position.Y - Location.Y);
            Capture = true;
        }

        private void OnDragMove(object? sender, MouseEventArgs e)
        {
            if (!_dragging) return;
            var screen = Screen.PrimaryScreen?.WorkingArea ?? Screen.GetBounds(Point.Empty);
            var x = Math.Clamp(Cursor.Position.X - _dragOffset.X, screen.Left, screen.Right - Width);
            var y = Math.Clamp(Cursor.Position.Y - _dragOffset.Y, screen.Top, screen.Bottom - Height);
            Location = new Point(x, y);
        }

        private void EndDrag()
        {
            _dragging = false;
            Capture = false;
        }

        private void SetMinimized(bool minimized)
        {
            _minimized = minimized;
            ApplyLayout();
        }

        private void ApplyLayout()
        {
            if (_minimized)
            {
                Size = new Size(120, 30);
                Region = RoundedRegion(this, 8);
                _station.Visible = false;
                _balances.Visible = false;
                _btnAddTime.Visible = false;
                _btnShareTime.Visible = false;
                _btnChangePin.Visible = false;
                _btnLogout.Visible = false;
                _btnMin.Visible = false;
                _lblUpdate.Visible = false;
                _btnUpdate.Visible = false;
                _btnCheckUpdate.Visible = false;
                _label.Font = F(12, FontStyle.Bold);
                _label.Location = new Point(8, 5);
                _label.Cursor = Cursors.Hand;
            }
            else
            {
                Size = new Size(260, 172);
                Region = RoundedRegion(this, 16);
                _station.Visible = true;
                _btnAddTime.Visible = _hasUser;
                _btnShareTime.Visible = _hasUser;
                _btnChangePin.Visible = _hasUser;
                _btnLogout.Visible = true;
                _btnMin.Visible = true;
                _lblUpdate.Visible = true;
                // _btnUpdate visibility managed by SetUpdateStatus; keep as-is unless no update yet
                _btnCheckUpdate.Visible = true;
                _label.Font = F(18, FontStyle.Bold);
                _label.Location = new Point(12, 24);
                _label.Cursor = Cursors.Default;
                BringToFront();
            }
        }

        public void SetUpdateStatus(string? text, bool hasUpdate, string? version = null, string? url = null)
        {
            if (IsDisposed || !IsHandleCreated) return;
            try
            {
                BeginInvoke(() =>
                {
                    if (!string.IsNullOrEmpty(text))
                        _lblUpdate.Text = text;
                    else
                        _lblUpdate.Text = $"v{Updater.CurrentVersion}";
                    // Only show Update button when hasUpdate, keep Check always in expanded mode
                    if (!_minimized)
                    {
                        _btnUpdate.Visible = hasUpdate;
                        if (hasUpdate && !string.IsNullOrEmpty(version))
                            _btnUpdate.Text = $"Update v{version}";
                        _btnCheckUpdate.Visible = true;
                    }
                });
            }
            catch { }
        }

        private async Task LogoutAsync()
        {
            var res = MessageBox.Show(
                "End this session? Any remaining time is saved and resumes when you log in again.",
                "Logout",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question);
            if (res != DialogResult.Yes) return;

            _btnLogout.Enabled = false;
            try
            {
                var (ok, remaining) = await _controller.LogoutAsync();
                if (ok)
                {
                    _controller.LockNow();
                    await _controller.ShowPlayerStatusAsync(remaining);
                }
                else
                {
                    MessageBox.Show("Logout failed. Check the server connection.", "Logout", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            }
            catch
            {
                MessageBox.Show("Logout failed. Check the server connection.", "Logout", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            finally
            {
                _btnLogout.Enabled = true;
            }
        }

        public void SetLabel(string station, string user)
        {
            _station.Text = $"{station} • {user}";
        }

        private readonly HashSet<int> _announced = new();
        private int _lastSeconds = -1;

        public void SetTime(int totalSeconds)
        {
            var h = totalSeconds / 3600;
            var m = (totalSeconds % 3600) / 60;
            var s = totalSeconds % 60;
            _label.Text = h > 0 ? $"{h} hr {m} min {s} sec" : m > 0 ? $"{m} min {s} sec" : $"{s} sec";

            if (totalSeconds > _lastSeconds + 30)
            {
                _announced.Clear();
            }
            foreach (var threshold in _controller.AnnounceMinutes)
            {
                var limit = threshold * 60;
                var fired =
                    (totalSeconds <= limit && _lastSeconds > limit) ||
                    (totalSeconds == limit && _lastSeconds < 0);
                if (fired && _announced.Add(threshold))
                {
                    _controller.PlayAnnouncement(threshold);
                }
            }
            _lastSeconds = totalSeconds;
        }

        public void SetBalances(int? gfunds, int? points, int? timeCredit = null)
        {
            _hasUser = gfunds is not null && points is not null;
            if (gfunds is null || points is null)
            {
                _balances.Visible = false;
                _btnAddTime.Visible = false;
                _btnShareTime.Visible = false;
                _btnChangePin.Visible = false;
                return;
            }
            var credit = timeCredit ?? 0;
            _balances.Text = $"₱{gfunds} gfunds • {points} pts" + (credit > 0 ? $" • {credit} free min" : "");
            _balances.Visible = true;
            if (!_minimized)
            {
                _btnAddTime.Visible = true;
                _btnShareTime.Visible = true;
                _btnChangePin.Visible = true;
            }
        }

        public void SetBalances()
        {
            _hasUser = false;
            _balances.Visible = false;
            _btnAddTime.Visible = false;
            _btnShareTime.Visible = false;
            _btnChangePin.Visible = false;
        }

        public void SetAvatar(string? avatarUrl)
        {
            _ = LoadAvatarAsync(_controller.Http, _avatar, avatarUrl);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            PaintDarkOverlay(this, e, 165);
        }
    }

    private sealed class ChangePinForm : Form
    {
        private readonly HttpClient _http;
        private readonly string _userId;
        private readonly TextBox _txtOld;
        private readonly TextBox _txtNew;
        private readonly TextBox _txtConfirm;
        private readonly Label _lblError;
        private readonly Button _btnSave;

        public ChangePinForm(HttpClient http, string userId)
        {
            _http = http;
            _userId = userId;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterParent;
            BackColor = C(COLOR_BG);
            Size = new Size(320, 372);
            TopMost = true;

            var title = DarkLabel("Change PIN", 16, Color.White, true);
            var lblOld = DarkLabel("Current PIN", 10, Color.FromArgb(160, 160, 175));
            var lblNew = DarkLabel("New PIN (4-24 characters)", 10, Color.FromArgb(160, 160, 175));
            var lblConfirm = DarkLabel("Confirm New PIN", 10, Color.FromArgb(160, 160, 175));
            _txtOld = PinBox();
            _txtNew = PinBox();
            _txtConfirm = PinBox();
            _lblError = DarkLabel("", 10, C(COLOR_ERROR));
            _lblError.MaximumSize = new Size(280, 50);
            _btnSave = DarkButton("Save", COLOR_ACCENT);
            MakeGradientButton(_btnSave);
            _btnSave.Click += async (_, _) => await SaveAsync();
            var btnCancel = DarkButton("Cancel", "#334155");
            RoundButton(btnCancel, 10);
            btnCancel.Click += (_, _) => Close();
            _txtConfirm.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; _ = SaveAsync(); } };

            title.Location = new Point(20, 16);
            lblOld.Location = new Point(20, 60);
            _txtOld.Location = new Point(20, 80);
            lblNew.Location = new Point(20, 132);
            _txtNew.Location = new Point(20, 152);
            lblConfirm.Location = new Point(20, 204);
            _txtConfirm.Location = new Point(20, 224);
            _lblError.Location = new Point(20, 268);
            _btnSave.Location = new Point(20, 322);
            _btnSave.Size = new Size(180, 38);
            btnCancel.Location = new Point(210, 322);
            btnCancel.Size = new Size(90, 38);

            Controls.AddRange(new Control[] { title, lblOld, _txtOld, lblNew, _txtNew, lblConfirm, _txtConfirm, _lblError, _btnSave, btnCancel });
            AttachShowToggle(_txtOld);
            AttachShowToggle(_txtNew);
            AttachShowToggle(_txtConfirm);
        }

        private static TextBox PinBox()
        {
            return new TextBox
            {
                BackColor = C(COLOR_INPUT),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Font = F(12),
                Size = new Size(244, 36),
                MaxLength = 24,
                PasswordChar = '•'
            };
        }

        private async Task SaveAsync()
        {
            var oldPin = _txtOld.Text;
            var newPin = _txtNew.Text;
            if (newPin.Length < 4 || newPin.Length > 24)
            {
                _lblError.Text = "New PIN must be 4-24 characters";
                return;
            }
            if (newPin != _txtConfirm.Text)
            {
                _lblError.Text = "PINs do not match";
                return;
            }

            _lblError.Text = "Saving...";
            _btnSave.Enabled = false;
            try
            {
                using var resp = await _http.PostAsJsonAsync("api/change-password", new { user_id = _userId, oldPin, newPin });
                var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
                if (json.TryGetProperty("error", out var err))
                {
                    _lblError.Text = err.GetString() ?? "Change failed";
                    return;
                }
                DialogResult = DialogResult.OK;
                Close();
            }
            catch
            {
                _lblError.Text = "Cannot reach the server";
            }
            finally
            {
                _btnSave.Enabled = true;
            }
        }
    }

    private sealed class AddTimeForm : Form
    {
        private readonly ControllerForm _controller;
        private readonly Button _btnPoints;
        private readonly Button _btnGfunds;
        private readonly Button _btnShared;
        private readonly FlowLayoutPanel _amountPanel;
        private readonly Label _lblAmount;
        private readonly Label _lblTime;
        private readonly Label _lblError;
        private readonly Button _btnSave;
        private NumericUpDown? _numCustom;
        private string _payment = "points";
        private int _selectedAmount;
        private int _sharedMinutes;

        public AddTimeForm(ControllerForm controller)
        {
            _controller = controller;
            _sharedMinutes = controller.CurrentTimeCredit ?? 0;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterParent;
            BackColor = C(COLOR_BG);
            Size = new Size(320, 430);
            TopMost = true;

            var title = DarkLabel("Add Time", 16, Color.White, true);
            var sharedSuffix = _sharedMinutes > 0 ? $" • {_sharedMinutes} free min" : "";
            var lblBalances = DarkLabel(
                $"₱{controller.CurrentGfunds ?? 0} gfunds • {controller.CurrentPoints ?? 0} pts{sharedSuffix}",
                10,
                Color.FromArgb(170, 170, 185));
            var lblPayWith = DarkLabel("Pay with:", 10, Color.FromArgb(160, 160, 175));
            _btnPoints = DarkButton("Gamepoints", COLOR_ACCENT);
            _btnGfunds = DarkButton("Gfunds", COLOR_INPUT);
            _btnShared = DarkButton(
                _sharedMinutes > 0 ? $"Shared Time ({FmtMinutes(_sharedMinutes)})" : "Shared Time",
                COLOR_INPUT);
            RoundButton(_btnPoints, 10);
            RoundButton(_btnGfunds, 10);
            RoundButton(_btnShared, 10);
            _btnPoints.Click += (_, _) => SetPayment("points");
            _btnGfunds.Click += (_, _) => SetPayment("gfunds");
            _btnShared.Click += (_, _) => SetPayment("shared");
            _btnShared.Visible = _sharedMinutes > 0;
            _lblAmount = DarkLabel("Amount:", 10, Color.FromArgb(160, 160, 175));
            _amountPanel = new FlowLayoutPanel
            {
                FlowDirection = FlowDirection.LeftToRight,
                WrapContents = true,
                Size = new Size(280, 86),
                BackColor = Color.Transparent
            };
            _lblTime = DarkLabel("", 12, C(COLOR_GREEN), true);
            _lblError = DarkLabel("", 10, C(COLOR_ERROR));
            _lblError.MaximumSize = new Size(280, 40);
            _btnSave = DarkButton("Add Time", COLOR_ACCENT);
            MakeGradientButton(_btnSave);
            _btnSave.Click += async (_, _) => await ConfirmAsync();
            var btnCancel = DarkButton("Cancel", "#334155");
            RoundButton(btnCancel, 10);
            btnCancel.Click += (_, _) => Close();

            title.Location = new Point(20, 14);
            lblBalances.Location = new Point(20, 48);
            lblPayWith.Location = new Point(20, 80);
            _btnPoints.Location = new Point(20, 100);
            _btnPoints.Size = new Size(136, 36);
            _btnGfunds.Location = new Point(164, 100);
            _btnGfunds.Size = new Size(136, 36);
            _btnShared.Location = new Point(20, 142);
            _btnShared.Size = new Size(280, 36);
            _lblAmount.Location = new Point(20, 188);
            _amountPanel.Location = new Point(20, 208);
            _lblTime.Location = new Point(20, 302);
            _lblError.Location = new Point(20, 328);
            _btnSave.Location = new Point(20, 376);
            _btnSave.Size = new Size(180, 40);
            btnCancel.Location = new Point(210, 376);
            btnCancel.Size = new Size(90, 40);

            Controls.AddRange(new Control[] { title, lblBalances, lblPayWith, _btnPoints, _btnGfunds, _btnShared, _lblAmount, _amountPanel, _lblTime, _lblError, _btnSave, btnCancel });

            SetPayment("points");
        }

        private void SetPayment(string payment)
        {
            _payment = payment;
            _selectedAmount = 0;
            _lblTime.Text = "";
            _lblError.Text = "";
            _btnPoints.BackColor = payment == "points" ? C(COLOR_ACCENT) : C(COLOR_INPUT);
            _btnGfunds.BackColor = payment == "gfunds" ? C(COLOR_GREEN) : C(COLOR_INPUT);
            _btnShared.BackColor = payment == "shared" ? C("#0d9488") : C(COLOR_INPUT);

            _amountPanel.Controls.Clear();
            if (payment == "shared")
            {
                _sharedMinutes = _controller.CurrentTimeCredit ?? _sharedMinutes;
                _lblAmount.Text = "Shared time:";
                _lblTime.Text = _sharedMinutes > 0
                    ? $"{FmtMinutes(_sharedMinutes)} shared time — adds all at once"
                    : "No shared time available";
                _btnSave.Text = "Add Shared Time";
                return;
            }

            _lblAmount.Text = "Amount:";
            _btnSave.Text = "Add Time";
            var amounts = payment == "points" ? new[] { 20, 40, 60, 100 } : new[] { 10, 20, 50 };
            foreach (var a in amounts)
            {
                var btn = QuickButton(payment == "points" ? $"{a} pts" : $"₱{a}");
                btn.Tag = a;
                btn.Click += (sender, _) =>
                {
                    if (sender is not Button b || b.Tag is not int amount) return;
                    SelectAmount(amount);
                };
                _amountPanel.Controls.Add(btn);
            }

            if (payment == "gfunds")
            {
                var customBtn = QuickButton("Custom");
                customBtn.Click += (_, _) => SelectAmount((int)_numCustom!.Value);
                _amountPanel.Controls.Add(customBtn);

                _numCustom = new NumericUpDown
                {
                    Minimum = 1,
                    Maximum = 100000,
                    Value = 100,
                    Width = 160,
                    Height = 34,
                    BackColor = C(COLOR_INPUT),
                    ForeColor = Color.White,
                    Font = F(12),
                    BorderStyle = BorderStyle.FixedSingle
                };
                _numCustom.ValueChanged += (_, _) => SelectAmount((int)_numCustom.Value);
                _amountPanel.Controls.Add(_numCustom);
            }
        }

        private void SelectAmount(int amount)
        {
            _selectedAmount = amount;
            _lblTime.Text = _payment == "points"
                ? FmtMinutes((int)(amount / 20.0 * 8))
                : FmtMinutes(amount * 4);
            _lblError.Text = "";
        }

        private async Task ConfirmAsync()
        {
            var userId = _controller.CurrentUserId;
            if (string.IsNullOrEmpty(userId))
            {
                _lblError.Text = "No player signed in";
                return;
            }
            if (_payment == "shared")
            {
                var credit = _controller.CurrentTimeCredit ?? _sharedMinutes;
                if (credit <= 0)
                {
                    _lblError.Text = "No shared time available";
                    return;
                }

                _lblError.Text = "Adding shared time...";
                _btnSave.Enabled = false;
                try
                {
                    using var creditResp = await _controller.Http.PostAsJsonAsync("api/sessions/add-time", new
                    {
                        user_id = userId,
                        station_name = _controller.StationName,
                        payment = "credit"
                    });
                    var creditJson = await creditResp.Content.ReadFromJsonAsync<JsonElement>();
                    if (creditJson.TryGetProperty("error", out var creditErr))
                    {
                        _lblError.Text = creditErr.GetString() ?? "Failed to add time";
                        return;
                    }
                    DialogResult = DialogResult.OK;
                    Close();
                }
                catch
                {
                    _lblError.Text = "Cannot reach the server";
                }
                finally
                {
                    _btnSave.Enabled = true;
                }
                return;
            }
            if (_selectedAmount <= 0)
            {
                _lblError.Text = "Choose an amount first";
                return;
            }

            _lblError.Text = "Adding time...";
            _btnSave.Enabled = false;
            try
            {
                using var resp = await _controller.Http.PostAsJsonAsync("api/sessions/add-time", new
                {
                    user_id = userId,
                    station_name = _controller.StationName,
                    payment = _payment,
                    points = _payment == "points" ? _selectedAmount : (int?)null,
                    gfunds = _payment == "gfunds" ? _selectedAmount : (int?)null
                });
                var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
                if (json.TryGetProperty("error", out var err))
                {
                    _lblError.Text = err.GetString() ?? "Failed to add time";
                    return;
                }
                DialogResult = DialogResult.OK;
                Close();
            }
            catch
            {
                _lblError.Text = "Cannot reach the server";
            }
            finally
            {
                _btnSave.Enabled = true;
            }
        }
    }

    private sealed class ShareTimeForm : Form
    {
        private readonly ControllerForm _controller;
        private readonly ComboBox _cmbTarget;
        private readonly FlowLayoutPanel _minutesPanel;
        private readonly Label _lblPreview;
        private readonly Label _lblError;
        private readonly Button _btnShare;
        private NumericUpDown? _numCustom;
        private int _selectedMinutes;
        private string _targetName = "";

        public ShareTimeForm(ControllerForm controller)
        {
            _controller = controller;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterParent;
            BackColor = C(COLOR_BG);
            Size = new Size(320, 430);
            TopMost = true;

            var remainingMinutes = controller.CurrentRemainingSeconds / 60;
            var title = DarkLabel("Share Time", 16, Color.White, true);
            var lblRemaining = DarkLabel(
                $"You have {FmtMinutes(Math.Max(0, remainingMinutes))} left",
                11,
                C(COLOR_GREEN),
                true);
            var lblTarget = DarkLabel("Share with player:", 10, Color.FromArgb(160, 160, 175));
            _cmbTarget = new ComboBox
            {
                BackColor = C(COLOR_INPUT),
                ForeColor = Color.White,
                Font = F(12),
                FlatStyle = FlatStyle.Flat,
                DropDownStyle = ComboBoxStyle.DropDown,
                Size = new Size(280, 30),
                AutoCompleteMode = AutoCompleteMode.SuggestAppend,
                AutoCompleteSource = AutoCompleteSource.ListItems
            };
            var lblMinutes = DarkLabel("Minutes to share:", 10, Color.FromArgb(160, 160, 175));
            _minutesPanel = new FlowLayoutPanel
            {
                FlowDirection = FlowDirection.LeftToRight,
                WrapContents = true,
                Size = new Size(280, 86),
                BackColor = Color.Transparent
            };
            _lblPreview = DarkLabel("", 12, Color.White, true);
            _lblError = DarkLabel("", 10, C(COLOR_ERROR));
            _lblError.MaximumSize = new Size(280, 40);
            _btnShare = DarkButton("Share", COLOR_ACCENT);
            MakeGradientButton(_btnShare, Color.FromArgb(13, 148, 136), Color.FromArgb(5, 150, 105));
            _btnShare.Click += async (_, _) => await ConfirmAsync();
            var btnCancel = DarkButton("Cancel", "#334155");
            RoundButton(btnCancel, 10);
            btnCancel.Click += (_, _) => Close();
            _cmbTarget.KeyDown += (_, e) =>
            {
                if (e.KeyCode == Keys.Enter)
                {
                    e.SuppressKeyPress = true;
                    _ = ConfirmAsync();
                }
            };
            _cmbTarget.TextChanged += (_, _) => UpdatePreview();

            title.Location = new Point(20, 14);
            lblRemaining.Location = new Point(20, 48);
            lblTarget.Location = new Point(20, 82);
            _cmbTarget.Location = new Point(20, 102);
            lblMinutes.Location = new Point(20, 148);
            _minutesPanel.Location = new Point(20, 168);
            _lblPreview.Location = new Point(20, 262);
            _lblError.Location = new Point(20, 288);
            _btnShare.Location = new Point(20, 336);
            _btnShare.Size = new Size(180, 40);
            btnCancel.Location = new Point(210, 336);
            btnCancel.Size = new Size(90, 40);

            Controls.AddRange(new Control[] { title, lblRemaining, lblTarget, _cmbTarget, lblMinutes, _minutesPanel, _lblPreview, _lblError, _btnShare, btnCancel });

            Load += async (_, _) => await LoadUsersAsync();
            BuildMinutesPanel();
        }

        private void UpdatePreview()
        {
            _targetName = _cmbTarget.Text.Trim();
            if (_selectedMinutes <= 0)
            {
                _lblPreview.Text = "";
                return;
            }
            _lblPreview.Text = _targetName.Length > 0
                ? $"{FmtMinutes(_selectedMinutes)} → {_targetName}"
                : FmtMinutes(_selectedMinutes);
            _lblError.Text = "";
        }

        private async Task LoadUsersAsync()
        {
            try
            {
                using var resp = await _controller.Http.GetAsync("api/users");
                if (!resp.IsSuccessStatusCode) return;
                var users = await resp.Content.ReadFromJsonAsync<List<UserNameRow>>();
                if (users is null) return;
                var giver = _controller.CurrentPlayer?.Name;
                var names = users
                    .Select(u => u.Name)
                    .Where(n => !string.IsNullOrWhiteSpace(n))
                    .Where(n => string.IsNullOrEmpty(giver) || !n.Equals(giver, StringComparison.OrdinalIgnoreCase))
                    .OrderBy(n => n, StringComparer.OrdinalIgnoreCase)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();
                _cmbTarget.BeginUpdate();
                _cmbTarget.Items.AddRange(names);
                _cmbTarget.EndUpdate();
            }
            catch
            {
            }
        }

        private void BuildMinutesPanel()
        {
            _selectedMinutes = 0;
            _lblPreview.Text = "";
            _lblError.Text = "";
            var maxMinutes = Math.Max(1, _controller.CurrentRemainingSeconds / 60);

            _minutesPanel.Controls.Clear();
            foreach (var m in new[] { 15, 30, 60, 120 })
            {
                var btn = QuickButton($"{m} min");
                btn.Tag = m;
                btn.Enabled = m <= maxMinutes;
                btn.Click += (sender, _) =>
                {
                    if (sender is not Button b || b.Tag is not int min) return;
                    SelectMinutes(min);
                };
                _minutesPanel.Controls.Add(btn);
            }

            _numCustom = new NumericUpDown
            {
                Minimum = 1,
                Maximum = Math.Max(1, maxMinutes),
                Value = Math.Min(15, maxMinutes),
                Width = 160,
                Height = 34,
                BackColor = C(COLOR_INPUT),
                ForeColor = Color.White,
                Font = F(12),
                BorderStyle = BorderStyle.FixedSingle
            };
            _numCustom.ValueChanged += (_, _) => SelectMinutes((int)_numCustom.Value);
            _minutesPanel.Controls.Add(_numCustom);
        }

        private void SelectMinutes(int minutes)
        {
            _selectedMinutes = minutes;
            UpdatePreview();
        }

        private async Task ConfirmAsync()
        {
            var userId = _controller.CurrentUserId;
            _targetName = _cmbTarget.Text.Trim();
            if (string.IsNullOrEmpty(userId))
            {
                _lblError.Text = "No player signed in";
                return;
            }
            if (_targetName.Length == 0)
            {
                _lblError.Text = "Enter the player's name";
                return;
            }
            if (_selectedMinutes <= 0)
            {
                _lblError.Text = "Choose how many minutes to share";
                return;
            }

            _lblError.Text = "Sharing...";
            _btnShare.Enabled = false;
            try
            {
                using var resp = await _controller.Http.PostAsJsonAsync("api/sessions/share", new
                {
                    source_user_id = userId,
                    source_station = _controller.StationName,
                    target_name = _targetName,
                    minutes = _selectedMinutes
                });
                var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
                if (json.TryGetProperty("error", out var err))
                {
                    _lblError.Text = err.GetString() ?? "Failed to share time";
                    return;
                }
                DialogResult = DialogResult.OK;
                Close();
            }
            catch
            {
                _lblError.Text = "Cannot reach the server";
            }
            finally
            {
                _btnShare.Enabled = true;
            }
        }
    }

    private sealed class CommandNoticeForm : Form
    {
        public CommandNoticeForm(string message, Form? owner)
        {
            FormBorderStyle = FormBorderStyle.None;
            BackColor = C(COLOR_BG);
            Size = new Size(380, 110);
            TopMost = true;
            ShowInTaskbar = false;
            StartPosition = owner is null
                ? FormStartPosition.CenterScreen
                : FormStartPosition.CenterParent;

            var lbl = DarkLabel(message, 13, Color.White, true);
            lbl.MaximumSize = new Size(340, 60);
            lbl.Location = new Point(20, 16);
            var btnOk = DarkButton("OK", "#334155");
            RoundButton(btnOk, 10);
            btnOk.Size = new Size(120, 34);
            btnOk.Location = new Point(130, 62);
            btnOk.Click += (_, _) => Close();

            Region = RoundedRegion(this, 14);
            Controls.Add(lbl);
            Controls.Add(btnOk);

            var autoClose = new System.Windows.Forms.Timer { Interval = 15000 };
            autoClose.Tick += (_, _) =>
            {
                autoClose.Stop();
                Close();
            };
            Load += (_, _) => autoClose.Start();
            if (owner is not null)
            {
                Owner = owner;
            }
        }
    }
}
