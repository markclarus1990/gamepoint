using System.Drawing.Drawing2D;
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
    }

    private sealed class LoginUser
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public int Points { get; set; }
        [JsonPropertyName("reserved_points")]
        public int ReservedPoints { get; set; }
        public int Gfunds { get; set; }
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

    private static Font F(float size, FontStyle style = FontStyle.Regular)
        => new("Segoe UI", size, style);

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
        return new Button
        {
            Text = text,
            FlatStyle = FlatStyle.Flat,
            BackColor = C(COLOR_INPUT),
            ForeColor = Color.White,
            Font = F(10),
            Height = 34,
            FlatAppearance = { BorderSize = 1, BorderColor = C("#334155") }
        };
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

    private static TextBox DarkTextBox(bool password = false)
    {
        return new TextBox
        {
            BackColor = C(COLOR_INPUT),
            ForeColor = Color.White,
            BorderStyle = BorderStyle.FixedSingle,
            Font = F(12),
            Height = 36,
            PasswordChar = password ? '•' : '\0'
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

        public HttpClient Http => _http;
        public string StationName => _cfg.StationName;

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

        private async Task PollAsync()
        {
            _pollTimer.Stop();
            try
            {
                using var resp = await _http.GetAsync("api/agent/status");
                if (!resp.IsSuccessStatusCode) return;
                var st = await resp.Content.ReadFromJsonAsync<Status>();
                if (st is null) return;
                ApplyStatus(st);
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

        public void UnlockSession(int remainingSeconds, string userName)
        {
            _current = new Status
            {
                Locked = false,
                RemainingSeconds = remainingSeconds,
                StationName = _cfg.StationName,
                UserName = userName
            };
            ApplyStatus(_current);
        }

        public void LockNow()
        {
            _current = new Status
            {
                Locked = true,
                RemainingSeconds = 0,
                StationName = _cfg.StationName,
                UserName = ""
            };
            ApplyStatus(_current);
        }

        public async Task<bool> LogoutAsync()
        {
            try
            {
                using var resp = await _http.PostAsJsonAsync("api/sessions/logout", new { station_name = _cfg.StationName });
                return resp.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        private void ApplyStatus(Status st)
        {
            var wasLocked = _current?.Locked ?? true;
            _current = st;

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
                }
                else
                {
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
        private readonly TextBox _txtName;
        private readonly TextBox _txtPin;
        private readonly Label _lblError;
        private readonly Label _lblUser;
        private readonly Label _lblBalances;
        private readonly Button _btnPoints;
        private readonly Button _btnGfunds;
        private readonly FlowLayoutPanel _amountPanel;
        private readonly Label _lblTime;
        private readonly Label _lblStartError;
        private readonly Button _btnStart;

        private LoginUser? _user;
        private string _payment = "points";
        private int _selectedAmount;

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
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);

            var title = DarkLabel("GAMEPOINT", 40, C(COLOR_ACCENT), true);
            var stationLine = DarkLabel($"{controller.StationName} — PC LOCKED", 14, Color.FromArgb(200, 200, 210));
            var hint = DarkLabel("Log in to start your session, or ask the cashier to open time", 10, Color.FromArgb(130, 130, 145));

            _card = new Panel
            {
                BackColor = C(COLOR_CARD),
                Size = new Size(380, 560),
                Anchor = AnchorStyles.None
            };

            // ---- LOGIN PANEL ----
            _loginPanel = new Panel { BackColor = C(COLOR_CARD), Size = new Size(340, 520) };
            _txtName = DarkTextBox();
            _txtPin = DarkTextBox(true);
            var lblName = DarkLabel("Player Name", 10, Color.FromArgb(160, 160, 175));
            var lblPin = DarkLabel("PIN", 10, Color.FromArgb(160, 160, 175));
            var btnLogin = DarkButton("Login", COLOR_ACCENT);
            _lblError = DarkLabel("", 10, C(COLOR_ERROR));
            _lblError.MaximumSize = new Size(320, 60);
            var btnAdminNote = DarkLabel("No account? Ask the cashier to create one", 9, Color.FromArgb(110, 110, 125));

            btnLogin.Click += async (_, _) => await DoLoginAsync();

            _txtName.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; _ = DoLoginAsync(); } };
            _txtPin.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; _ = DoLoginAsync(); } };

            var loginY = 8;
            lblName.Location = new Point(0, loginY);
            _txtName.Location = new Point(0, loginY + 20);
            _txtName.Size = new Size(340, 36);
            loginY += 66;
            lblPin.Location = new Point(0, loginY);
            _txtPin.Location = new Point(0, loginY + 20);
            _txtPin.Size = new Size(340, 36);
            loginY += 66;
            btnLogin.Location = new Point(0, loginY);
            btnLogin.Size = new Size(340, 42);
            loginY += 56;
            _lblError.Location = new Point(0, loginY);
            btnAdminNote.Location = new Point(0, 470);

            _loginPanel.Controls.AddRange(new Control[] { lblName, _txtName, lblPin, _txtPin, btnLogin, _lblError, btnAdminNote });

            // ---- PAYMENT PANEL ----
            _paymentPanel = new Panel { BackColor = C(COLOR_CARD), Size = new Size(340, 520) };
            _lblUser = DarkLabel("", 13, Color.White, true);
            _lblBalances = DarkLabel("", 11, Color.FromArgb(160, 160, 175));
            var lblPayWith = DarkLabel("Pay with:", 10, Color.FromArgb(160, 160, 175));
            _btnPoints = DarkButton("Gamepoints", COLOR_ACCENT);
            _btnGfunds = DarkButton("Gfunds", COLOR_INPUT);
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
            _btnStart.Click += async (_, _) => await DoStartAsync();
            _lblStartError = DarkLabel("", 10, C(COLOR_ERROR));
            _lblStartError.MaximumSize = new Size(320, 60);
            var btnLogout = DarkButton("Back", "#334155");
            btnLogout.Click += (_, _) => ShowLogin();

            var payY = 8;
            _lblUser.Location = new Point(0, payY);
            payY += 28;
            _lblBalances.Location = new Point(0, payY);
            payY += 30;
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
            btnLogout.Location = new Point(0, 470);
            btnLogout.Size = new Size(340, 36);

            _paymentPanel.Controls.AddRange(new Control[] { _lblUser, _lblBalances, lblPayWith, _btnPoints, _btnGfunds, lblAmount, _amountPanel, _lblTime, _btnStart, _lblStartError, btnLogout });

            Controls.AddRange(new Control[] { title, stationLine, hint, _card });
            _card.Controls.Add(_loginPanel);
            _card.Controls.Add(_paymentPanel);

            _loginPanel.Location = new Point(20, 20);
            _paymentPanel.Location = new Point(20, 20);
            _paymentPanel.Visible = false;

            Resize += (_, _) => CenterCard(title, stationLine, hint);
        }

        private void CenterCard(Control title, Control stationLine, Control hint)
        {
            var cx = Width / 2;
            title.Location = new Point(cx - title.Width / 2, Math.Max(20, Height / 2 - 320));
            stationLine.Location = new Point(cx - stationLine.Width / 2, title.Bottom + 10);
            hint.Location = new Point(cx - hint.Width / 2, stationLine.Bottom + 8);
            _card.Location = new Point(cx - _card.Width / 2, hint.Bottom + 20);
        }

        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            var title = Controls[0];
            var stationLine = Controls[1];
            var hint = Controls[2];
            CenterCard(title, stationLine, hint);
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
            _lblError.Text = "";
            _txtName.Focus();
        }

        public void ResetForNewLock()
        {
            _user = null;
            _payment = "points";
            _selectedAmount = 0;
            _lblStartError.Text = "";
            ShowLogin();
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
                        ? $"{amount / 20.0 * 8} mins"
                        : $"{amount * 4} mins";
                    _lblStartError.Text = "";
                };
                _amountPanel.Controls.Add(btn);
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
                _lblUser.Text = $"Player: {_user.Name}";
                _lblBalances.Text = $"Gfunds ₱{_user.Gfunds}  •  Gamepoints {_user.Points - _user.ReservedPoints}";

                _lblError.Text = "Checking saved time...";
                var resumeSeconds = 0;
                try
                {
                    using var resumeResp = await _controller.Http.GetAsync($"api/sessions/resume?user_id={Uri.EscapeDataString(_user.Id)}");
                    var resumeJson = await resumeResp.Content.ReadFromJsonAsync<JsonElement>();
                    if (resumeJson.TryGetProperty("resume_seconds", out var rs))
                    {
                        resumeSeconds = rs.GetInt32();
                    }
                }
                catch
                {
                    // fall through to the payment panel
                }

                if (resumeSeconds > 0)
                {
                    _lblError.Text = "Resuming session...";
                    try
                    {
                        using var resumeResp = await _controller.Http.PostAsJsonAsync("api/sessions/resume", new { user_id = _user.Id, station_name = _controller.StationName });
                        var resumeData = await resumeResp.Content.ReadFromJsonAsync<JsonElement>();
                        if (resumeData.TryGetProperty("error", out var resumeErr))
                        {
                            _lblError.Text = resumeErr.GetString() ?? "Resume failed";
                            ShowPayment();
                            return;
                        }
                        var remaining = resumeData.TryGetProperty("remaining_seconds", out var rs2) ? rs2.GetInt32() : resumeSeconds;
                        _loginPanel.Visible = false;
                        _paymentPanel.Visible = false;
                        _controller.UnlockSession(remaining, _user.Name);
                        Activate();
                        return;
                    }
                    catch
                    {
                        _lblError.Text = "Cannot reach the server";
                        ShowPayment();
                        return;
                    }
                }

                ShowPayment();
            }
            catch
            {
                _lblError.Text = "Cannot reach the server";
            }
        }

        private void ShowPayment()
        {
            SetPayment("points");
            _loginPanel.Visible = false;
            _paymentPanel.Visible = true;
            Activate();
        }

        private async Task DoStartAsync()
        {
            if (_user is null || _selectedAmount <= 0)
            {
                _lblStartError.Text = "Choose an amount first";
                return;
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
            // painted by child controls
        }
    }

    private sealed class CountdownForm : Form
    {
        private readonly ControllerForm _controller;
        private readonly Label _label;
        private readonly Label _station;
        private readonly Button _btnLogout;

        public CountdownForm(ControllerForm controller)
        {
            _controller = controller;
            FormBorderStyle = FormBorderStyle.None;
            TopMost = true;
            ShowInTaskbar = false;
            BackColor = C("#14161f");
            StartPosition = FormStartPosition.Manual;
            Size = new Size(260, 116);
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);

            _station = new Label
            {
                AutoSize = true,
                ForeColor = Color.FromArgb(140, 140, 155),
                BackColor = Color.Transparent,
                Font = F(9),
                Location = new Point(12, 6)
            };
            _label = new Label
            {
                AutoSize = true,
                ForeColor = Color.White,
                BackColor = Color.Transparent,
                Font = F(18, FontStyle.Bold),
                Location = new Point(12, 24)
            };
            _btnLogout = new Button
            {
                Text = "Logout",
                FlatStyle = FlatStyle.Flat,
                BackColor = C("#7f1d1d"),
                ForeColor = Color.White,
                Font = F(9, FontStyle.Bold),
                Height = 30,
                Location = new Point(12, 76),
                Size = new Size(236, 30),
                FlatAppearance = { BorderSize = 0 }
            };
            _btnLogout.Click += async (_, _) => await LogoutAsync();
            Controls.Add(_station);
            Controls.Add(_label);
            Controls.Add(_btnLogout);

            var screen = Screen.PrimaryScreen?.WorkingArea ?? Screen.GetBounds(Point.Empty);
            Location = new Point(screen.Right - Width - 16, screen.Bottom - Height - 16);
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
                if (await _controller.LogoutAsync())
                {
                    _controller.LockNow();
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
            var s = totalSeconds % 60;
            _label.Text = h > 0 ? $"{h}:{m:D2}:{s:D2}" : $"{m:D2}:{s:D2}";
        }
    }
}
