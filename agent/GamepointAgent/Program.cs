using System.Drawing.Drawing2D;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

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
        public int RemainingSeconds { get; set; }
        public string StationName { get; set; } = "";
        public string UserName { get; set; } = "";
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

        private void ApplyStatus(Status st)
        {
            _current = st;

            if (st.Locked)
            {
                if (_lockForm is null || _lockForm.IsDisposed)
                {
                    _lockForm = new LockForm(_cfg.StationName);
                    _lockForm.Show(this);
                }
                else
                {
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
                        _countdownForm = new CountdownForm();
                        _countdownForm.Show(this);
                    }
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
        private readonly string _stationName;
        private Font _bigFont = null!;
        private Font _midFont = null!;

        public bool AllowClose { get; set; }

        public LockForm(string stationName)
        {
            _stationName = stationName;
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Maximized;
            TopMost = true;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            BackColor = Color.Black;
            KeyPreview = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
        }

        protected override void OnLoad(EventArgs e)
        {
            base.OnLoad(e);
            _bigFont = new Font("Segoe UI", 64, FontStyle.Bold);
            _midFont = new Font("Segoe UI", 22, FontStyle.Regular);
            Activate();
            ForceTop();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (!AllowClose) e.Cancel = true;
            base.OnFormClosing(e);
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            e.Handled = true;
            e.SuppressKeyPress = true;
            base.OnKeyDown(e);
        }

        public void ForceTop()
        {
            if (IsDisposed || !Visible) return;
            Activate();
            BringToFront();
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Color.Black);

            using var logoBrush = new LinearGradientBrush(
                new Point(0, 0), new Point(Width, 0), Color.FromArgb(147, 51, 234), Color.FromArgb(236, 72, 153));
            using var whiteBrush = new SolidBrush(Color.White);
            using var grayBrush = new SolidBrush(Color.FromArgb(160, 160, 170));

            var logo = "GAMEPOINT";
            var logoSize = g.MeasureString(logo, _bigFont);
            g.DrawString(logo, _bigFont, logoBrush,
                (Width - logoSize.Width) / 2f, Height / 2f - 120f);

            var sub = $"{_stationName} — PC LOCKED";
            var subSize = g.MeasureString(sub, _midFont);
            g.DrawString(sub, _midFont, whiteBrush,
                (Width - subSize.Width) / 2f, Height / 2f + 20f);

            var msg = "Go to the counter to load your account";
            var msgSize = g.MeasureString(msg, _midFont);
            g.DrawString(msg, _midFont, grayBrush,
                (Width - msgSize.Width) / 2f, Height / 2f + 80f);
        }
    }

    private sealed class CountdownForm : Form
    {
        private readonly Label _label;
        private readonly Label _station;

        public CountdownForm()
        {
            FormBorderStyle = FormBorderStyle.None;
            TopMost = true;
            ShowInTaskbar = false;
            BackColor = Color.FromArgb(20, 22, 32);
            StartPosition = FormStartPosition.Manual;
            Size = new Size(230, 64);
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);

            _station = new Label
            {
                AutoSize = true,
                ForeColor = Color.FromArgb(140, 140, 155),
                BackColor = Color.Transparent,
                Font = new Font("Segoe UI", 9),
                Location = new Point(12, 6)
            };
            _label = new Label
            {
                AutoSize = true,
                ForeColor = Color.White,
                BackColor = Color.Transparent,
                Font = new Font("Segoe UI", 18, FontStyle.Bold),
                Location = new Point(12, 22)
            };
            Controls.Add(_station);
            Controls.Add(_label);

            var screen = Screen.PrimaryScreen?.WorkingArea ?? Screen.GetBounds(Point.Empty);
            Location = new Point(screen.Right - Width - 16, screen.Bottom - Height - 16);
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
