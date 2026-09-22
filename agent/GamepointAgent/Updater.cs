using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace GamepointAgent;

/// <summary>
/// Self-update helper for GamepointAgent.
/// - Checks the server's /api/agent/version endpoint (which proxies GitHub Releases).
/// - Falls back to querying GitHub directly if the server has no release.
/// - Downloads the new exe to a temp file and swaps it via a batch script
///   (can't overwrite a running exe on Windows).
/// </summary>
internal sealed class Updater
{
    public sealed class VersionInfo
    {
        [JsonPropertyName("version")]
        public string Version { get; set; } = "";
        [JsonPropertyName("tag")]
        public string Tag { get; set; } = "";
        [JsonPropertyName("downloadUrl")]
        public string? DownloadUrl { get; set; }
        [JsonPropertyName("publishedAt")]
        public string? PublishedAt { get; set; }
        [JsonPropertyName("updateAvailable")]
        public bool UpdateAvailable { get; set; }
        [JsonPropertyName("current")]
        public string? Current { get; set; }
    }

    private readonly HttpClient _http;
    private readonly string _serverUrl;
    private readonly string? _githubRepo; // e.g. "markclarus1990/gamepoint"
    private readonly string? _githubToken;

    public Updater(HttpClient http, string serverUrl, string? githubRepo = null, string? githubToken = null)
    {
        _http = http;
        _serverUrl = serverUrl.TrimEnd('/');
        _githubRepo = githubRepo;
        _githubToken = githubToken;
    }

    public static string CurrentVersion
    {
        get
        {
            // Prefer assembly FileVersion / InformationalVersion; fallback to hardcoded.
            var asm = Assembly.GetExecutingAssembly();
            var info = asm.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
            if (!string.IsNullOrWhiteSpace(info))
            {
                // Strip git hash suffix like "1.0.42+abc123"
                var plus = info.IndexOf('+');
                if (plus > 0) info = info.Substring(0, plus);
                return info.Trim();
            }
            var ver = asm.GetName().Version?.ToString();
            if (!string.IsNullOrWhiteSpace(ver)) return ver!.TrimEnd('.', '0').TrimEnd('.');
            return "0.0.0";
        }
    }

    public static bool IsNewer(string latest, string current)
    {
        int[] Parse(string v) =>
            v.Trim().TrimStart('v').Replace("agent-v", "").Split('.')
                .Select(s => int.TryParse(new string(s.TakeWhile(char.IsDigit).ToArray()), out var n) ? n : 0)
                .ToArray();
        var a = Parse(latest);
        var b = Parse(current);
        var len = Math.Max(a.Length, b.Length);
        for (int i = 0; i < len; i++)
        {
            var av = i < a.Length ? a[i] : 0;
            var bv = i < b.Length ? b[i] : 0;
            if (av > bv) return true;
            if (av < bv) return false;
        }
        return false;
    }

    /// <summary>
    /// Ask the server for the latest version. Falls back to GitHub if server has none.
    /// </summary>
    public async Task<VersionInfo?> CheckAsync(CancellationToken ct = default)
    {
        var current = CurrentVersion;

        // 1. Try server proxy — it already handles GitHub auth / caching
        try
        {
            var url = $"{_serverUrl}/api/agent/version?current={Uri.EscapeDataString(current)}";
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            // Reuse the agent key already on _http; clone headers if needed
            using var resp = await _http.SendAsync(req, ct);
            if (resp.IsSuccessStatusCode)
            {
                var json = await resp.Content.ReadAsStringAsync(ct);
                var info = JsonSerializer.Deserialize<VersionInfo>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (info != null && !string.IsNullOrWhiteSpace(info.Version))
                {
                    // Trust server's updateAvailable, but recompute in case server omitted current comparison
                    if (!info.UpdateAvailable && IsNewer(info.Version, current) && !string.IsNullOrEmpty(info.DownloadUrl))
                        info.UpdateAvailable = true;
                    ProgramDbg($"Updater server check: current={current} latest={info.Version} available={info.UpdateAvailable} url={(info.DownloadUrl ?? "none")}");
                    // If server has a download URL and confirms update, return it
                    if (info.DownloadUrl != null || info.UpdateAvailable)
                        return info;
                    // Server has version but no asset — fall through to direct GitHub
                }
            }
            else
            {
                ProgramDbg($"Updater server check HTTP {(int)resp.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            ProgramDbg($"Updater server check failed: {ex.Message}");
        }

        // 2. Direct GitHub fallback (useful during dev or if server not yet deployed)
        if (!string.IsNullOrWhiteSpace(_githubRepo))
        {
            try
            {
                var ghUrl = $"https://api.github.com/repos/{_githubRepo}/releases?per_page=10";
                using var req = new HttpRequestMessage(HttpMethod.Get, ghUrl);
                req.Headers.Add("User-Agent", "GamepointAgent-Updater");
                req.Headers.Add("Accept", "application/vnd.github+json");
                if (!string.IsNullOrWhiteSpace(_githubToken))
                    req.Headers.Add("Authorization", $"Bearer {_githubToken}");
                using var ghResp = await new HttpClient { Timeout = TimeSpan.FromSeconds(10) }.SendAsync(req, ct);
                if (ghResp.IsSuccessStatusCode)
                {
                    var json = await ghResp.Content.ReadAsStringAsync(ct);
                    using var doc = JsonDocument.Parse(json);
                    foreach (var rel in doc.RootElement.EnumerateArray())
                    {
                        var tag = rel.GetProperty("tag_name").GetString() ?? "";
                        var ver = tag.Replace("agent-v", "").TrimStart('v');
                        if (string.IsNullOrWhiteSpace(ver)) continue;
                        string? dl = null;
                        if (rel.TryGetProperty("assets", out var assets))
                        {
                            foreach (var a in assets.EnumerateArray())
                            {
                                if (a.GetProperty("name").GetString() == "GamepointAgent.exe")
                                {
                                    dl = a.GetProperty("browser_download_url").GetString();
                                    break;
                                }
                            }
                        }
                        if (dl == null) continue; // need exe asset
                        var available = IsNewer(ver, current);
                        ProgramDbg($"Updater GitHub check: current={current} latest={ver} available={available}");
                        return new VersionInfo
                        {
                            Version = ver,
                            Tag = tag,
                            DownloadUrl = dl,
                            PublishedAt = rel.TryGetProperty("published_at", out var p) ? p.GetString() : null,
                            UpdateAvailable = available,
                            Current = current
                        };
                    }
                }
            }
            catch (Exception ex)
            {
                ProgramDbg($"Updater GitHub direct check failed: {ex.Message}");
            }
        }

        return null;
    }

    /// <summary>
    /// Download the exe and perform the self-replace dance.
    /// Shows progress via the optional callback.
    /// Returns true if the update was launched (app should exit).
    /// </summary>
    public async Task<bool> DownloadAndApplyAsync(
        string downloadUrl,
        string latestVersion,
        IWin32Window? owner,
        Action<string>? status = null,
        CancellationToken ct = default)
    {
        var pid = Environment.ProcessId;
        status?.Invoke($"Downloading v{latestVersion}...");
        ProgramDbg($"[DOWNLOAD] start url={downloadUrl} expected={latestVersion} current={CurrentVersion} pid={pid}");

        var exePath = Environment.ProcessPath;
        if (string.IsNullOrWhiteSpace(exePath) || !File.Exists(exePath))
        {
            exePath = Path.Combine(AppContext.BaseDirectory, "GamepointAgent.exe");
        }
        exePath = Path.GetFullPath(exePath);
        var dir = Path.GetDirectoryName(exePath) ?? AppContext.BaseDirectory;

        // Temp download location — keep on same volume as target for fast move
        var tmpDir = Path.Combine(Path.GetTempPath(), "GamepointAgentUpdate");
        try { Directory.CreateDirectory(tmpDir); } catch { }
        var newExe = Path.Combine(tmpDir, $"GamepointAgent_{latestVersion}.exe");
        var batPath = Path.Combine(tmpDir, "apply_update.bat");

        try
        {
            // Clean previous attempt
            if (File.Exists(newExe)) File.Delete(newExe);

            using var dlReq = new HttpRequestMessage(HttpMethod.Get, downloadUrl);
            dlReq.Headers.Add("User-Agent", "GamepointAgent-Updater");
            if (!string.IsNullOrWhiteSpace(_githubToken) &&
                (downloadUrl.Contains("api.github.com") || downloadUrl.Contains("github.com")))
            {
                dlReq.Headers.Add("Authorization", $"Bearer {_githubToken}");
            }
            // For GitHub release asset browser_download_url from private repo, the URL redirects
            // and already contains an auth token query — no header needed. But adding it is harmless.

            using var dlClient = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
            // Copy agent key header if present on main http
            if (_http.DefaultRequestHeaders.Contains("x-agent-key"))
            {
                var vals = _http.DefaultRequestHeaders.GetValues("x-agent-key");
                dlReq.Headers.Add("x-agent-key", vals);
            }

            using var resp = await dlClient.SendAsync(dlReq, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync(ct);
                throw new Exception($"Download HTTP {(int)resp.StatusCode}: {body.Substring(0, Math.Min(300, body.Length))}");
            }

            var total = resp.Content.Headers.ContentLength;
            await using var netStream = await resp.Content.ReadAsStreamAsync(ct);
            await using var fileStream = new FileStream(newExe, FileMode.Create, FileAccess.Write, FileShare.None, 81920, true);
            var buf = new byte[81920];
            long readTotal = 0;
            int n;
            var lastPct = -1;
            while ((n = await netStream.ReadAsync(buf, 0, buf.Length, ct)) > 0)
            {
                await fileStream.WriteAsync(buf, 0, n, ct);
                readTotal += n;
                if (total.HasValue && total.Value > 0)
                {
                    var pct = (int)(readTotal * 100 / total.Value);
                    if (pct != lastPct && pct % 10 == 0)
                    {
                        lastPct = pct;
                        status?.Invoke($"Downloading v{latestVersion}... {pct}%");
                    }
                }
            }

            // Sanity checks
            var fi = new FileInfo(newExe);
            if (!fi.Exists || fi.Length < 1_000_000)
                throw new Exception($"Downloaded file too small ({fi.Length} bytes) — likely HTML error page.");
            ProgramDbg($"[DOWNLOAD] complete bytes={fi.Length} path={newExe}");

            // VERIFY VERSION — read the embedded version of the downloaded exe
            // before it ever replaces the running one. A mismatch means the
            // release asset is stale/mislabeled; swapping it would leave the
            // agent reporting the wrong version forever.
            status?.Invoke($"Verifying v{latestVersion}...");
            var detected = ReadEmbeddedVersion(newExe);
            ProgramDbg($"[VERIFY VERSION] expected={NormalizeVersion(latestVersion)} detected={detected ?? "none"} path={newExe}");
            if (string.IsNullOrWhiteSpace(detected))
                throw new Exception("Downloaded exe has no embedded version info — refusing to install.");
            if (!VersionsMatch(detected, latestVersion))
                throw new Exception($"Version mismatch: expected v{NormalizeVersion(latestVersion)} but downloaded exe reports v{detected}. Not installing.");
            ProgramDbg($"[VERIFY VERSION] OK v{detected}");

            status?.Invoke("Preparing update...");

            // Write batch script that waits for this PID to exit, then swaps files and restarts.
            // Uses PowerShell-style robust wait to avoid tasklist locale issues.
            var bat = $"""
                @echo off
                setlocal EnableDelayedExpansion
                set "TARGET={exePath}"
                set "NEWEXE={newExe}"
                set "PID={pid}"
                echo [GamepointAgent] Waiting for process %PID% to exit...
                :wait
                tasklist /FI "PID eq %PID%" 2>nul | findstr /R /C:"%PID%" >nul
                if not errorlevel 1 (
                  timeout /t 1 /nobreak >nul
                  goto wait
                )
                echo [GamepointAgent] Installing v{latestVersion}...
                copy /Y "%NEWEXE%" "%TARGET%" >nul
                if errorlevel 1 (
                  echo [GamepointAgent] Copy failed — retrying with longer wait...
                  timeout /t 2 /nobreak >nul
                  copy /Y "%NEWEXE%" "%TARGET%" >nul
                  if errorlevel 1 (
                    echo [GamepointAgent] Update failed. Old version still in place.
                    echo [GamepointAgent] Press any key to exit.
                    pause >nul
                    exit /b 1
                  )
                )
                echo [GamepointAgent] Starting new version...
                start "" "%TARGET%"
                REM Clean up
                del "%NEWEXE%" 2>nul
                (goto) 2>nul ^& del "%~f0" 2>nul
                """;
            await File.WriteAllTextAsync(batPath, bat, ct);
            ProgramDbg($"[REPLACE EXE] swap script staged path={batPath} target={exePath} waitingPid={pid}");

            status?.Invoke($"Launching v{latestVersion}...");

            var psi = new ProcessStartInfo
            {
                FileName = batPath,
                UseShellExecute = true,
                CreateNoWindow = false,
                WindowStyle = ProcessWindowStyle.Normal,
            };
            Process.Start(psi);

            // Small delay so the bat has time to start before we exit
            await Task.Delay(500, ct);

            ProgramDbg($"[STOP OLD AGENT] exiting pid={pid} current={CurrentVersion} — swap script takes over");
            ProgramDbg($"[START NEW AGENT] pending target={exePath} expected={NormalizeVersion(latestVersion)} — verify footer shows v{latestVersion} after restart");
            return true;
        }
        catch (OperationCanceledException)
        {
            status?.Invoke("Update cancelled");
            return false;
        }
        catch (Exception ex)
        {
            ProgramDbg($"Updater apply failed: {ex}");
            try
            {
                if (owner != null)
                    MessageBox.Show(owner, $"Update failed:\n{ex.Message}", "GamepointAgent Update", MessageBoxButtons.OK, MessageBoxIcon.Error);
                else
                    MessageBox.Show($"Update failed:\n{ex.Message}", "GamepointAgent Update", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            catch { }
            status?.Invoke($"Update failed: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Reads the embedded version of an exe from its version resource
    /// (ProductVersion first, then FileVersion). Returns normalized "x.y.z"
    /// or null when the file has no usable version info.
    /// </summary>
    public static string? ReadEmbeddedVersion(string exePath)
    {
        try
        {
            var info = FileVersionInfo.GetVersionInfo(exePath);
            var raw = !string.IsNullOrWhiteSpace(info.ProductVersion)
                ? info.ProductVersion
                : info.FileVersion;
            if (string.IsNullOrWhiteSpace(raw)) return null;
            return NormalizeVersion(raw);
        }
        catch (Exception ex)
        {
            ProgramDbg($"[VERIFY VERSION] could not read version resource: {ex.Message}");
            return null;
        }
    }

    public static string NormalizeVersion(string v)
    {
        var s = v.Trim().TrimStart('v');
        if (s.StartsWith("agent-v", StringComparison.OrdinalIgnoreCase))
            s = s.Substring("agent-v".Length);
        var plus = s.IndexOf('+');
        if (plus >= 0) s = s.Substring(0, plus);
        return s.Trim();
    }

    public static bool VersionsMatch(string a, string b) =>
        string.Equals(NormalizeVersion(a), NormalizeVersion(b), StringComparison.OrdinalIgnoreCase);

    private static void ProgramDbg(string msg)
    {
        try
        {
            File.AppendAllText(
                Path.Combine(AppContext.BaseDirectory, "agent-debug.log"),
                $"[{DateTime.Now:HH:mm:ss.fff}] [Updater] {msg}{Environment.NewLine}");
        }
        catch { }
    }
}
