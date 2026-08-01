using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;

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
        [JsonPropertyName("pending_command")]
        public string? PendingCommand { get; set; }
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
    }

    private sealed class StartResponse
    {
        public string? Error { get; set; }
        [JsonPropertyName("remaining_seconds")]
        public int RemainingSeconds { get; set; }
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
        b.FlatStyle = FlatStyle.Flat;
        b.FlatAppearance.BorderSize = 0;
        b.ForeColor = Color.White;
        RoundButton(b, 12);
        b.Paint += (_, e) =>
        {
            using var brush = new System.Drawing.Drawing2D.LinearGradientBrush(
                b.ClientRectangle,
                Color.FromArgb(236, 72, 153),
                Color.FromArgb(147, 51, 234),
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

    private static Panel ModernInput(bool password, out TextBox box, int width = 340)
    {
        var panel = new Panel
        {
            BackColor = C(COLOR_INPUT),
            Size = new Size(width, 46)
        };
        panel.Region = RoundedRegion(panel, 12);
        var tb = new TextBox
        {
            BorderStyle = BorderStyle.None,
            BackColor = C(COLOR_INPUT),
            ForeColor = Color.White,
            Font = F(12),
            PasswordChar = password ? '•' : '\0',
            Location = new Point(14, 13),
            Size = new Size(width - 28, 20)
        };
        tb.GotFocus += (_, _) =>
        {
            panel.BackColor = C("#334155");
            tb.BackColor = C("#334155");
        };
        tb.LostFocus += (_, _) =>
        {
            panel.BackColor = C(COLOR_INPUT);
            tb.BackColor = C(COLOR_INPUT);
        };
        panel.Controls.Add(tb);
        box = tb;
        return panel;
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
        private LockForm? _lockForm;
        private CountdownForm? _countdownForm;
        private Status? _current;
        private DateTime _lockHeldUntil = DateTime.MinValue;

        public HttpClient Http => _http;
        public string StationName => _cfg.StationName;
        public LoginUser? CurrentPlayer { get; set; }

        public string? CurrentUserId => _current?.UserId;

        public int? CurrentPoints => _current?.UserPoints;

        public int? CurrentGfunds => _current?.UserGfunds;

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

            Load += async (_, _) =>
            {
                await PollAsync();
                _pollTimer.Start();
                _clockTimer.Start();
                StartLocalApi();
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
                ApplyStatus(st);
                if (!string.IsNullOrEmpty(st.PendingCommand))
                {
                    if (st.PendingCommand == "screenshot")
                    {
                        await CaptureAndUploadScreenshotAsync();
                        await AckCommandAsync();
                    }
                    else
                    {
                        await AckCommandAsync();
                        ExecuteCommand(st.PendingCommand);
                    }
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
                MessageBox.Show(
                    command == "restart"
                        ? "This PC will restart in 20 seconds."
                        : "This PC will shut down in 20 seconds.",
                    "Gamepoint Agent",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
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

                using var req = new HttpRequestMessage(HttpMethod.Post, "api/agent/screenshot")
                {
                    Content = JsonContent.Create(new { image = Convert.ToBase64String(ms.ToArray()) })
                };
                req.Headers.Add("x-agent-key", _cfg.AgentKey);
                using var resp = await _http.SendAsync(req);
                Dbg($"Screenshot uploaded: {(int)resp.StatusCode}");
            }
            catch (Exception ex)
            {
                Dbg($"Screenshot failed: {ex.Message}");
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
                    _countdownForm.SetBalances(st.UserPoints, st.UserGfunds);
                    _countdownForm.SetAvatar(st.UserAvatar);
                }
                else
                {
                    _countdownForm?.SetBalances();
                    _countdownForm?.Hide();
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
        private readonly Label _lblError;
        private readonly Label _lblStatus;
        private readonly Label _lblUser;
        private readonly PictureBox _avatar;
        private readonly Label _lblBalances;
        private readonly Label _lblResume;
        private readonly Button _btnResume;
        private readonly Button _btnPoints;
        private readonly Button _btnGfunds;
        private readonly FlowLayoutPanel _amountPanel;
        private readonly Label _lblTime;
        private readonly Label _lblStartError;
        private readonly Button _btnStart;

        private LoginUser? _user;
        private string _payment = "points";
        private int _selectedAmount;
        private NumericUpDown? _numCustom;
        private int _resumeSeconds;

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

            var titleGame = DarkLabel("GAME", 40, Color.White, true);
            var titlePoint = DarkLabel("POINT", 40, C(COLOR_PINK), true);
            var stationLine = DarkLabel($"{controller.StationName} — PC LOCKED", 14, C(COLOR_PINK), true);
            var hint = DarkLabel("Log in to start your session, or ask the cashier to open time", 10, Color.FromArgb(170, 170, 185));

            _card = new Panel
            {
                BackColor = C(COLOR_CARD),
                Size = new Size(380, 600),
                Anchor = AnchorStyles.None
            };
            _card.Region = RoundedRegion(_card, 16);

            // ---- LOGIN PANEL ----
            _loginPanel = new Panel { BackColor = C(COLOR_CARD), Size = new Size(340, 560) };
            var inputName = ModernInput(false, out _txtName);
            var inputPin = ModernInput(true, out _txtPin);
            var lblName = DarkLabel("Player Name", 10, Color.FromArgb(160, 160, 175));
            var lblPin = DarkLabel("PIN", 10, Color.FromArgb(160, 160, 175));
            var btnLogin = DarkButton("Login", COLOR_ACCENT);
            MakeGradientButton(btnLogin);
            _lblError = DarkLabel("", 10, C(COLOR_ERROR));
            _lblError.MaximumSize = new Size(320, 60);
            var btnAdminNote = DarkLabel("No account? Ask the cashier to create one", 9, Color.FromArgb(110, 110, 125));
            _lblStatus = DarkLabel("", 13, Color.White, true);
            _lblStatus.MaximumSize = new Size(320, 90);
            _lblStatus.Visible = false;

            btnLogin.Click += async (_, _) => await DoLoginAsync();

            _txtName.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; _ = DoLoginAsync(); } };
            _txtPin.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; _ = DoLoginAsync(); } };

            var loginY = 8;
            lblName.Location = new Point(0, loginY);
            loginY += 18;
            inputName.Location = new Point(0, loginY);
            loginY += 56;
            lblPin.Location = new Point(0, loginY);
            loginY += 18;
            inputPin.Location = new Point(0, loginY);
            loginY += 56;
            btnLogin.Location = new Point(0, loginY);
            btnLogin.Size = new Size(340, 46);
            loginY += 62;
            _lblError.Location = new Point(0, loginY);
            loginY += 52;
            _lblStatus.Location = new Point(0, loginY);
            btnAdminNote.Location = new Point(0, 510);

            _loginPanel.Controls.AddRange(new Control[] { lblName, inputName, lblPin, inputPin, btnLogin, _lblError, _lblStatus, btnAdminNote });

            // ---- PAYMENT PANEL ----
            _paymentPanel = new Panel { BackColor = C(COLOR_CARD), Size = new Size(340, 560) };
            _lblUser = DarkLabel("", 13, Color.White, true);
            _avatar = new PictureBox
            {
                Size = new Size(44, 44),
                SizeMode = PictureBoxSizeMode.StretchImage,
                BackColor = Color.Transparent,
                Visible = false
            };
            _lblBalances = DarkLabel("", 11, Color.FromArgb(160, 160, 175));
            _lblResume = DarkLabel("", 11, Color.FromArgb(160, 160, 175));
            _lblResume.Visible = false;
            _btnResume = DarkButton("Resume Session", COLOR_GREEN);
            MakeGradientButton(_btnResume);
            _btnResume.Visible = false;
            _btnResume.Click += async (_, _) => await DoResumeAsync();
            var lblPayWith = DarkLabel("Pay with:", 10, Color.FromArgb(160, 160, 175));
            _btnPoints = DarkButton("Gamepoints", COLOR_ACCENT);
            _btnGfunds = DarkButton("Gfunds", COLOR_INPUT);
            RoundButton(_btnPoints, 10);
            RoundButton(_btnGfunds, 10);
            _btnPoints.Click += (_, _) => SetPayment("points");
            _btnGfunds.Click += (_, _) => SetPayment("gfunds");
            var lblAmount = DarkLabel("Amount:", 10, Color.FromArgb(160, 160, 175));
            _amountPanel = new FlowLayoutPanel
            {
                FlowDirection = FlowDirection.LeftToRight,
                WrapContents = true,
                Size = new Size(340, 86),
                BackColor = Color.Transparent
            };
            _lblTime = DarkLabel("", 12, C(COLOR_GREEN), true);
            _btnStart = DarkButton("Start Session", COLOR_GREEN);
            MakeGradientButton(_btnStart);
            _btnStart.Click += async (_, _) => await DoStartAsync();
            _lblStartError = DarkLabel("", 10, C(COLOR_ERROR));
            _lblStartError.MaximumSize = new Size(320, 60);
            var btnLogout = DarkButton("Back", "#334155");
            RoundButton(btnLogout, 10);
            btnLogout.Click += (_, _) => ShowLogin();

            var payY = 8;
            _avatar.Location = new Point(0, payY);
            _lblUser.Location = new Point(56, payY + 13);
            payY += 56;
            _lblBalances.Location = new Point(0, payY);
            payY += 28;
            _lblResume.Location = new Point(0, payY);
            payY += 22;
            _btnResume.Location = new Point(0, payY);
            _btnResume.Size = new Size(340, 40);
            payY += 54;
            lblPayWith.Location = new Point(0, payY);
            payY += 22;
            _btnPoints.Location = new Point(0, payY);
            _btnPoints.Size = new Size(166, 40);
            _btnGfunds.Location = new Point(174, payY);
            _btnGfunds.Size = new Size(166, 40);
            payY += 52;
            lblAmount.Location = new Point(0, payY);
            payY += 22;
            _amountPanel.Location = new Point(0, payY);
            payY += 96;
            _lblTime.Location = new Point(0, payY);
            payY += 28;
            _btnStart.Location = new Point(0, payY);
            _btnStart.Size = new Size(340, 42);
            payY += 56;
            _lblStartError.Location = new Point(0, payY);
            btnLogout.Location = new Point(0, 510);
            btnLogout.Size = new Size(340, 36);

            _paymentPanel.Controls.AddRange(new Control[] { _avatar, _lblUser, _lblBalances, _lblResume, _btnResume, lblPayWith, _btnPoints, _btnGfunds, lblAmount, _amountPanel, _lblTime, _btnStart, _lblStartError, btnLogout });

            Controls.AddRange(new Control[] { titleGame, titlePoint, stationLine, hint, _card });
            _card.Controls.Add(_loginPanel);
            _card.Controls.Add(_paymentPanel);

            _loginPanel.Location = new Point(20, 20);
            _paymentPanel.Location = new Point(20, 20);
            _paymentPanel.Visible = false;

            Resize += (_, _) => CenterCard(titleGame, titlePoint, stationLine, hint);
            Dbg($"LockForm ctor done login={PanelState(_loginPanel)} pay={PanelState(_paymentPanel)} card={PanelState(_card)}");
        }

        private void CenterCard(Control titleGame, Control titlePoint, Control stationLine, Control hint)
        {
            var cx = Width / 2;
            var titleWidth = titleGame.Width + 4 + titlePoint.Width;
            var titleY = Math.Max(20, Height / 2 - 320);
            titleGame.Location = new Point(cx - titleWidth / 2, titleY);
            titlePoint.Location = new Point(titleGame.Right + 4, titleY);
            stationLine.Location = new Point(cx - stationLine.Width / 2, titleGame.Bottom + 10);
            hint.Location = new Point(cx - hint.Width / 2, stationLine.Bottom + 8);
            _card.Location = new Point(cx - _card.Width / 2, hint.Bottom + 20);
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
            _lblStatus.Visible = false;
            _lblError.Text = "";
            _lblStartError.Text = "";
            _txtName.Text = "";
            _txtPin.Text = "";
            _txtName.Focus();
            Dbg($"ShowLogin login={PanelState(_loginPanel)} pay={PanelState(_paymentPanel)} cardVisible={_card.Visible} cardLoc={_card.Location} formVisible={Visible}");
        }

        public void ResetForNewLock()
        {
            _user = null;
            _payment = "points";
            _selectedAmount = 0;
            _resumeSeconds = 0;
            _lblResume.Visible = false;
            _btnResume.Visible = false;
            _lblStartError.Text = "";
            _lblStatus.Text = "";
            _lblStatus.Visible = false;
            _avatar.Visible = false;
            ShowLogin();
            Dbg($"ResetForNewLock done login={PanelState(_loginPanel)} pay={PanelState(_paymentPanel)}");
        }

        public void ShowPlayerStatus(string text)
        {
            if (IsDisposed || !IsHandleCreated) return;
            _lblStatus.Text = text;
            _lblStatus.Visible = true;
            _lblStatus.BringToFront();
            _lblStartError.Text = "";
        }

        private void SetError(string msg)
        {
            _lblError.Text = msg;
            _lblStartError.Text = msg;
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
                };
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
                _numCustom.ValueChanged += (_, _) =>
                {
                    _selectedAmount = (int)_numCustom.Value;
                    _lblTime.Text = FmtMinutes(_selectedAmount * 4);
                    _lblStartError.Text = "";
                };
                _amountPanel.Controls.Add(_numCustom);
            }
        }

        private async Task DoLoginAsync()
        {
            var name = _txtName.Text.Trim();
            var pin = _txtPin.Text;
            if (name == "" || pin == "")
            {
                _lblError.Text = "Enter name and PIN";
                return;
            }

            _lblError.Text = "Logging in...";
            try
            {
                using var resp = await _controller.Http.PostAsJsonAsync("api/login", new { name, pin });
                var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
                if (json.TryGetProperty("error", out var err))
                {
                    _lblError.Text = err.GetString() ?? "Login failed";
                    return;
                }

                _user = json.Deserialize<LoginUser>(ApiJson);
                if (_user is null)
                {
                    _lblError.Text = "Invalid server response";
                    return;
                }
                _controller.CurrentPlayer = _user;
                _lblStatus.Visible = false;
                _lblUser.Text = $"Player: {_user.Name}";
                _lblBalances.Text = $"Gfunds ₱{_user.Gfunds}  •  Gamepoints {_user.Points - _user.ReservedPoints}";
                _ = LoadAvatarAsync(_controller.Http, _avatar, _user.AvatarUrl);

                _resumeSeconds = 0;
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
            }
        }

        private void ShowPayment()
        {
            if (_resumeSeconds > 0)
            {
                var mins = (int)Math.Ceiling(_resumeSeconds / 60.0);
                _lblResume.Text = $"Saved time: {FmtMinutes(mins)} left from your last session";
                _lblResume.Visible = true;
                _btnResume.Text = $"Resume Session — {FmtMinutes(mins)}";
                _btnResume.Visible = true;
            }
            else
            {
                _lblResume.Visible = false;
                _btnResume.Visible = false;
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
                var confirm = MessageBox.Show(
                    $"Starting a new session discards your saved {FmtMinutes(mins)}. Continue?",
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
            PaintDarkOverlay(this, e, 150);
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
        private readonly Button _btnChangePin;
        private readonly Button _btnLogout;
        private readonly Button _btnMin;
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
                Location = new Point(172, 78),
                Size = new Size(76, 30),
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
            _btnChangePin = new Button
            {
                Text = "Change PIN",
                FlatStyle = FlatStyle.Flat,
                BackColor = C("#334155"),
                ForeColor = Color.White,
                Font = F(9, FontStyle.Bold),
                Height = 30,
                Location = new Point(92, 78),
                Size = new Size(76, 30),
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
            Controls.Add(_btnChangePin);
            Controls.Add(_btnLogout);
            Controls.Add(_btnMin);

            var screen = Screen.PrimaryScreen?.WorkingArea ?? Screen.GetBounds(Point.Empty);
            Location = new Point(screen.Right - 276, screen.Bottom - 154);
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
                _btnChangePin.Visible = false;
                _btnLogout.Visible = false;
                _btnMin.Visible = false;
                _label.Font = F(12, FontStyle.Bold);
                _label.Location = new Point(8, 5);
                _label.Cursor = Cursors.Hand;
            }
            else
            {
                Size = new Size(260, 138);
                Region = RoundedRegion(this, 16);
                _station.Visible = true;
                _btnAddTime.Visible = _hasUser;
                _btnChangePin.Visible = _hasUser;
                _btnLogout.Visible = true;
                _btnMin.Visible = true;
                _label.Font = F(18, FontStyle.Bold);
                _label.Location = new Point(12, 24);
                _label.Cursor = Cursors.Default;
                BringToFront();
            }
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

        public void SetTime(int totalSeconds)
        {
            var h = totalSeconds / 3600;
            var m = (totalSeconds % 3600) / 60;
            _label.Text = h > 0 ? $"{h} hr {m} min" : $"{m} min";
        }

        public void SetBalances(int? gfunds, int? points)
        {
            _hasUser = gfunds is not null && points is not null;
            if (gfunds is null || points is null)
            {
                _balances.Visible = false;
                _btnAddTime.Visible = false;
                _btnChangePin.Visible = false;
                return;
            }
            _balances.Text = $"₱{gfunds} gfunds • {points} pts";
            _balances.Visible = true;
            if (!_minimized)
            {
                _btnAddTime.Visible = true;
                _btnChangePin.Visible = true;
            }
        }

        public void SetBalances()
        {
            _hasUser = false;
            _balances.Visible = false;
            _btnAddTime.Visible = false;
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
            var lblNew = DarkLabel("New PIN (4 digits)", 10, Color.FromArgb(160, 160, 175));
            var lblConfirm = DarkLabel("Confirm New PIN", 10, Color.FromArgb(160, 160, 175));
            _txtOld = PinBox();
            _txtNew = PinBox();
            _txtConfirm = PinBox();
            _lblError = DarkLabel("", 10, C(COLOR_ERROR));
            _lblError.MaximumSize = new Size(280, 50);
            var btnSave = DarkButton("Save", COLOR_ACCENT);
            MakeGradientButton(btnSave);
            btnSave.Click += async (_, _) => await SaveAsync();
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
            btnSave.Location = new Point(20, 322);
            btnSave.Size = new Size(180, 38);
            btnCancel.Location = new Point(210, 322);
            btnCancel.Size = new Size(90, 38);

            Controls.AddRange(new Control[] { title, lblOld, _txtOld, lblNew, _txtNew, lblConfirm, _txtConfirm, _lblError, btnSave, btnCancel });
        }

        private static TextBox PinBox()
        {
            return new TextBox
            {
                BackColor = C(COLOR_INPUT),
                ForeColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle,
                Font = F(12),
                Size = new Size(280, 36),
                PasswordChar = '•'
            };
        }

        private async Task SaveAsync()
        {
            var oldPin = _txtOld.Text;
            var newPin = _txtNew.Text;
            if (newPin.Length != 4 || !newPin.All(char.IsDigit))
            {
                _lblError.Text = "New PIN must be 4 digits";
                return;
            }
            if (newPin != _txtConfirm.Text)
            {
                _lblError.Text = "PINs do not match";
                return;
            }

            _lblError.Text = "Saving...";
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
        }
    }

    private sealed class AddTimeForm : Form
    {
        private readonly ControllerForm _controller;
        private readonly Button _btnPoints;
        private readonly Button _btnGfunds;
        private readonly FlowLayoutPanel _amountPanel;
        private readonly Label _lblTime;
        private readonly Label _lblError;
        private NumericUpDown? _numCustom;
        private string _payment = "points";
        private int _selectedAmount;

        public AddTimeForm(ControllerForm controller)
        {
            _controller = controller;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterParent;
            BackColor = C(COLOR_BG);
            Size = new Size(320, 390);
            TopMost = true;

            var title = DarkLabel("Add Time", 16, Color.White, true);
            var lblBalances = DarkLabel(
                $"₱{controller.CurrentGfunds ?? 0} gfunds • {controller.CurrentPoints ?? 0} pts",
                10,
                Color.FromArgb(170, 170, 185));
            var lblPayWith = DarkLabel("Pay with:", 10, Color.FromArgb(160, 160, 175));
            _btnPoints = DarkButton("Gamepoints", COLOR_ACCENT);
            _btnGfunds = DarkButton("Gfunds", COLOR_INPUT);
            RoundButton(_btnPoints, 10);
            RoundButton(_btnGfunds, 10);
            _btnPoints.Click += (_, _) => SetPayment("points");
            _btnGfunds.Click += (_, _) => SetPayment("gfunds");
            var lblAmount = DarkLabel("Amount:", 10, Color.FromArgb(160, 160, 175));
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
            var btnSave = DarkButton("Add Time", COLOR_ACCENT);
            MakeGradientButton(btnSave);
            btnSave.Click += async (_, _) => await ConfirmAsync();
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
            lblAmount.Location = new Point(20, 148);
            _amountPanel.Location = new Point(20, 168);
            _lblTime.Location = new Point(20, 262);
            _lblError.Location = new Point(20, 288);
            btnSave.Location = new Point(20, 336);
            btnSave.Size = new Size(180, 40);
            btnCancel.Location = new Point(210, 336);
            btnCancel.Size = new Size(90, 40);

            Controls.AddRange(new Control[] { title, lblBalances, lblPayWith, _btnPoints, _btnGfunds, lblAmount, _amountPanel, _lblTime, _lblError, btnSave, btnCancel });

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

            _amountPanel.Controls.Clear();
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
            if (_selectedAmount <= 0)
            {
                _lblError.Text = "Choose an amount first";
                return;
            }

            _lblError.Text = "Adding time...";
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
        }
    }
}
