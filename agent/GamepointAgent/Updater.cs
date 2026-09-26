using System.Diagnostics;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;

[assembly: InternalsVisibleTo("GamepointAgent.Tests")]

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
        [JsonPropertyName("size")]
        public long? Size { get; set; }
        [JsonPropertyName("sha256")]
        public string? Sha256 { get; set; }
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
                    ProgramDbg($"Updater server check: current={current} latest={info.Version} available={info.UpdateAvailable} url={(info.DownloadUrl ?? "none")} size={(info.Size?.ToString() ?? "unknown")} sha256={(ShortSha(info.Sha256) ?? "none")}");
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
                        long? assetSize = null;
                        string? assetSha = null;
                        if (rel.TryGetProperty("assets", out var assets))
                        {
                            foreach (var a in assets.EnumerateArray())
                            {
                                if (a.GetProperty("name").GetString() == "GamepointAgent.exe")
                                {
                                    dl = a.GetProperty("browser_download_url").GetString();
                                    if (a.TryGetProperty("size", out var sizeEl) && sizeEl.TryGetInt64(out var sz))
                                        assetSize = sz;
                                    if (a.TryGetProperty("digest", out var digestEl))
                                        assetSha = ParseSha256Digest(digestEl.GetString());
                                    break;
                                }
                            }
                        }
                        if (dl == null) continue; // need exe asset
                        var available = IsNewer(ver, current);
                        ProgramDbg($"Updater GitHub check: current={current} latest={ver} available={available} size={(assetSize?.ToString() ?? "unknown")} sha256={(ShortSha(assetSha) ?? "none")}");
                        return new VersionInfo
                        {
                            Version = ver,
                            Tag = tag,
                            DownloadUrl = dl,
                            PublishedAt = rel.TryGetProperty("published_at", out var p) ? p.GetString() : null,
                            UpdateAvailable = available,
                            Current = current,
                            Size = assetSize,
                            Sha256 = assetSha
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
    /// Size/SHA/embedded-version are all verified before install; truncated
    /// downloads are retried, version mismatches are hard failures.
    /// </summary>
    public Task<bool> DownloadAndApplyAsync(
        string downloadUrl,
        string latestVersion,
        IWin32Window? owner,
        Action<string>? status = null,
        CancellationToken ct = default)
        => DownloadAndApplyAsync(
            new VersionInfo { Version = latestVersion, DownloadUrl = downloadUrl },
            owner, status, ct);

    public async Task<bool> DownloadAndApplyAsync(
        VersionInfo info,
        IWin32Window? owner,
        Action<string>? status = null,
        CancellationToken ct = default)
    {
        var downloadUrl = info.DownloadUrl ?? "";
        var latestVersion = info.Version ?? "";
        if (string.IsNullOrWhiteSpace(downloadUrl))
            throw new ArgumentException("Missing download URL.", nameof(info));
        var expectedSize = info.Size;
        var expectedSha256 = info.Sha256;
        var pid = Environment.ProcessId;
        status?.Invoke($"Downloading v{latestVersion}...");
        ProgramDbg($"[DOWNLOAD] start url={downloadUrl} expectedVersion={NormalizeVersion(latestVersion)} expectedSize={(expectedSize?.ToString() ?? "unknown")} expectedSha256={(ShortSha(expectedSha256) ?? "none")} current={CurrentVersion} pid={pid}");

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
        var newExe = Path.Combine(tmpDir, $"GamepointAgent_{NormalizeVersion(latestVersion)}.exe");
        var batPath = Path.Combine(tmpDir, "apply_update.bat");

        try
        {
            // Download + verify with retries — cafe networks drop mid-download,
            // leaving a truncated file whose version resource reads empty
            // (NoVersion). Those MUST be retried. Only a version mismatch
            // (right file, wrong version) is a hard failure.
            // Partial files are RESUMED via HTTP Range (not re-downloaded),
            // so an 84MB file missing 2KB completes on the next attempt.
            const int maxAttempts = 5;
            long received = 0;
            long? declared = null;
            string? receivedSha = null;
            string? embeddedVersion = null;
            Exception? lastRetryable = null;
            var verified = false;
            for (var attempt = 1; attempt <= maxAttempts; attempt++)
            {
                ct.ThrowIfCancellationRequested();
                if (attempt > 1)
                {
                    // Exponential backoff: 5s, 10s, 20s, 40s — flaky cafe
                    // networks need longer to recover between attempts.
                    var backoff = TimeSpan.FromSeconds(Math.Min(40, 5 * (1 << (attempt - 2))));
                    var existingBytes = SafeFileLength(newExe);
                    var resumeNote = existingBytes > 0 ? $" resuming from {existingBytes} bytes" : "";
                    status?.Invoke($"Retrying download ({attempt}/{maxAttempts})...");
                    ProgramDbg($"[DOWNLOAD] retry attempt={attempt}/{maxAttempts} url={downloadUrl} backoff={backoff.TotalSeconds}s{resumeNote}");
                    // Keep the partial file: DownloadOnceAsync resumes it via
                    // HTTP Range. Only corrupt content (SHA mismatch) is
                    // deleted, handled in the catch block below.
                    await Task.Delay(backoff, ct);
                }
                try
                {
                    ProgramDbg($"[DOWNLOAD] attempt={attempt}/{maxAttempts} url={downloadUrl} expectedVersion={NormalizeVersion(latestVersion)} expectedSize={(expectedSize?.ToString() ?? "unknown")} expectedSha256={(ShortSha(expectedSha256) ?? "none")}");
                    (received, declared) = await DownloadOnceAsync(downloadUrl, newExe, latestVersion, status, ct);
                    if (!declared.HasValue || declared.Value <= 0)
                        ProgramDbg($"[DOWNLOAD] attempt={attempt}/{maxAttempts} no Content-Length declared (received={received}) — relying on size/sha/version verification");
                    status?.Invoke($"Verifying v{latestVersion}... (attempt {attempt}/{maxAttempts})");
                    var verification = VerifyDownloadedFile(newExe, latestVersion, expectedSize ?? declared, expectedSha256);
                    receivedSha = verification.ReceivedSha256;
                    embeddedVersion = verification.EmbeddedVersion;
                    ProgramDbg($"[VERIFY] attempt={attempt}/{maxAttempts} received={verification.ReceivedBytes} expectedSize={((expectedSize ?? declared)?.ToString() ?? "unknown")} shaReceived={(ShortSha(verification.ReceivedSha256) ?? "none")} shaExpected={(ShortSha(expectedSha256) ?? "none")} embedded={verification.EmbeddedVersion ?? "none"} expectedVersion={NormalizeVersion(latestVersion)} ok={verification.Ok} retryable={verification.Retryable} error={verification.Error ?? "none"}");
                    if (verification.Ok)
                    {
                        verified = true;
                        lastRetryable = null;
                        received = verification.ReceivedBytes;
                        if (!string.IsNullOrWhiteSpace(verification.ReceivedSha256))
                            receivedSha = verification.ReceivedSha256;
                        break;
                    }
                    if (!verification.Retryable)
                        throw new NonRetryableUpdateException(verification.Error ?? "Version verification failed.");
                    throw new Exception(verification.Error);
                }
                catch (NonRetryableUpdateException)
                {
                    throw;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    lastRetryable = ex;
                    ProgramDbg($"[DOWNLOAD] attempt {attempt}/{maxAttempts} failed: {ex.Message}");
                    // Corrupt bytes (SHA mismatch / tiny error page) can never
                    // be fixed by resuming — restart fresh next attempt.
                    // Truncated streams (incomplete/size mismatch) keep the
                    // partial so the next attempt resumes via Range.
                    if (IsCorruptContent(ex.Message))
                    {
                        try { if (File.Exists(newExe)) File.Delete(newExe); } catch { }
                        ProgramDbg($"[DOWNLOAD] discarded corrupt partial, next attempt restarts from 0");
                    }
                }
            }
            if (!verified)
            {
                if (lastRetryable is not null)
                    throw new Exception($"Download failed after {maxAttempts} attempts: {lastRetryable.Message} See agent-debug.log ([DOWNLOAD]/[VERIFY]) for received/expected bytes and SHA.");
                throw new Exception($"Download verification failed after {maxAttempts} attempts. See agent-debug.log ([DOWNLOAD]/[VERIFY]) for details.");
            }
            ProgramDbg($"[VERIFY] FINAL OK version={embeddedVersion} bytes={received} sha256={(ShortSha(receivedSha) ?? "none")} path={newExe}");

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
        catch (NonRetryableUpdateException ex)
        {
            // Hard failure: right file, wrong version — retrying is pointless.
            ProgramDbg($"[VERIFY] HARD FAILURE (no retry): {ex.Message}");
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

    public enum VersionCheckKind { Ok, Unreadable, NoVersion }

    public sealed record VersionCheck(VersionCheckKind Kind, string? Version, string? Detail);

    /// <summary>
    /// Reads the embedded version of an exe from its version resource
    /// (ProductVersion first, then FileVersion). Distinguishes an unreadable
    /// file (locked/truncated — Unreadable) from a file with genuinely no
    /// version resource (NoVersion) so callers can report the true cause.
    /// </summary>
    public static VersionCheck CheckEmbeddedVersion(string exePath)
    {
        string? raw;
        try
        {
            var info = FileVersionInfo.GetVersionInfo(exePath);
            raw = !string.IsNullOrWhiteSpace(info.ProductVersion)
                ? info.ProductVersion
                : info.FileVersion;
        }
        catch (Exception ex)
        {
            return new VersionCheck(VersionCheckKind.Unreadable, null, ex.Message);
        }
        if (string.IsNullOrWhiteSpace(raw))
            return new VersionCheck(VersionCheckKind.NoVersion, null, "empty version resource");
        return new VersionCheck(VersionCheckKind.Ok, NormalizeVersion(raw), null);
    }

    public static string? ReadEmbeddedVersion(string exePath)
    {
        var check = CheckEmbeddedVersion(exePath);
        if (check.Kind != VersionCheckKind.Ok)
            ProgramDbg($"[VERIFY VERSION] could not read version resource: {check.Detail}");
        return check.Version;
    }

    /// <summary>
    /// Thrown for verification failures that must NOT be retried: the file
    /// downloaded fine but reports the wrong version (stale/mislabeled asset).
    /// Retrying the same URL would download the same wrong file.
    /// </summary>
    public sealed class NonRetryableUpdateException : Exception
    {
        public NonRetryableUpdateException(string message) : base(message) { }
    }

    /// <summary>
    /// Result of verifying a downloaded exe. Ok=true means size+sha+embedded
    /// version all pass and the file may replace the installation. Retryable
    /// distinguishes truncated/corrupt downloads (retry) from wrong-version
    /// assets (hard failure, Retryable=false).
    /// </summary>
    public sealed record DownloadVerification(
        bool Ok,
        bool Retryable,
        string? Error,
        string? EmbeddedVersion,
        long ReceivedBytes,
        string? ReceivedSha256);

    /// <summary>
    /// Verifies a downloaded exe against size, SHA-256, and embedded version.
    /// Pure (no network/UI) so it is unit-testable. Never throws for
    /// verification failures — encodes retryability in the result.
    /// </summary>
    public static DownloadVerification VerifyDownloadedFile(
        string path,
        string expectedVersion,
        long? expectedSize,
        string? expectedSha256)
    {
        long received;
        try
        {
            var fi = new FileInfo(path);
            if (!fi.Exists)
                return new DownloadVerification(false, true, "Downloaded file is missing after download — likely a truncated download. Will retry.", null, 0, null);
            received = fi.Length;
        }
        catch (Exception ex)
        {
            return new DownloadVerification(false, true, $"Cannot stat downloaded file ({ex.Message}) — likely disk/antivirus. Will retry.", null, 0, null);
        }

        string? receivedSha = null;
        if (!string.IsNullOrWhiteSpace(expectedSha256))
        {
            try
            {
                receivedSha = ComputeSha256(path);
            }
            catch (Exception ex)
            {
                return new DownloadVerification(false, true, $"Cannot hash downloaded file ({ex.Message}) — likely locked or truncated. Will retry.", null, received, null);
            }
            if (!string.Equals(receivedSha, expectedSha256.Trim(), StringComparison.OrdinalIgnoreCase))
                return new DownloadVerification(false, true, $"SHA-256 mismatch: received {ShortSha(receivedSha)} but expected {ShortSha(expectedSha256)} ({received} bytes) — likely a truncated download. Will retry.", null, received, receivedSha);
        }

        if (expectedSize.HasValue && expectedSize.Value > 0 && received != expectedSize.Value)
            return new DownloadVerification(false, true, $"Size mismatch: received {received} of {expectedSize.Value} bytes — network may have dropped. Will retry.", null, received, receivedSha ?? TryComputeSha256(path));

        var check = CheckEmbeddedVersion(path);
        if (check.Kind == VersionCheckKind.Unreadable)
            return new DownloadVerification(false, true, $"Cannot read the downloaded file ({check.Detail}) — it may be locked by antivirus/security or truncated. Will retry.", null, received, receivedSha ?? TryComputeSha256(path));
        if (check.Kind == VersionCheckKind.NoVersion || string.IsNullOrWhiteSpace(check.Version))
            return new DownloadVerification(false, true, $"Downloaded exe has no embedded version info (got {received} of {(expectedSize?.ToString() ?? "unknown")} bytes) — likely a truncated download. Will retry automatically.", null, received, receivedSha ?? TryComputeSha256(path));
        if (!VersionsMatch(check.Version, expectedVersion))
            return new DownloadVerification(false, false, $"Version mismatch: expected v{NormalizeVersion(expectedVersion)} but downloaded exe reports v{check.Version}. Not installing.", check.Version, received, receivedSha ?? TryComputeSha256(path));
        return new DownloadVerification(true, false, null, check.Version, received, receivedSha ?? TryComputeSha256(path));
    }

    /// <summary>Streams a file through SHA-256 (safe for 80MB+ exes).</summary>
    public static string ComputeSha256(string path)
    {
        using var sha = SHA256.Create();
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, false);
        var hash = sha.ComputeHash(stream);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string? TryComputeSha256(string path)
    {
        try { return ComputeSha256(path); } catch { return null; }
    }

    /// <summary>Parses a GitHub asset `digest` ("sha256:abc…") to bare hex.</summary>
    public static string? ParseSha256Digest(string? digest)
    {
        if (string.IsNullOrWhiteSpace(digest)) return null;
        var d = digest.Trim();
        if (d.StartsWith("sha256:", StringComparison.OrdinalIgnoreCase))
            d = d.Substring("sha256:".Length);
        d = d.Trim();
        return d.Length >= 16 ? d.ToLowerInvariant() : null;
    }

    private static string? ShortSha(string? sha)
    {
        if (string.IsNullOrWhiteSpace(sha)) return null;
        var s = sha.Trim();
        return s.Length > 12 ? s.Substring(0, 12) + "…" : s;
    }

    /// <summary>
    /// Single download attempt with Range-resume. If a previous attempt left
    /// a partial file, sends `Range: bytes=&lt;existing&gt;-` and appends the
    /// remainder instead of re-downloading from scratch. Servers that ignore
    /// Range (200 instead of 206) fall back to a full download. Throws on
    /// HTTP errors, tiny files (likely error pages), and truncated transfers
    /// (fewer bytes than Content-Length declares). The caller retries via
    /// the attempt loop above.
    /// </summary>
    private async Task<(long received, long? declared)> DownloadOnceAsync(
        string downloadUrl,
        string newExe,
        string latestVersion,
        Action<string>? status,
        CancellationToken ct)
    {
        var existing = SafeFileLength(newExe);

        using var dlReq = new HttpRequestMessage(HttpMethod.Get, downloadUrl);
        dlReq.Headers.Add("User-Agent", "GamepointAgent-Updater");
        if (!string.IsNullOrWhiteSpace(_githubToken) &&
            (downloadUrl.Contains("api.github.com") || downloadUrl.Contains("github.com")))
        {
            dlReq.Headers.Add("Authorization", $"Bearer {_githubToken}");
        }
        if (existing > 0)
            dlReq.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(existing, null);
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
        if (resp.StatusCode == System.Net.HttpStatusCode.RequestedRangeNotSatisfiable)
        {
            // Partial is already complete (or longer) per the server — let
            // verification decide; it compares against expected size/SHA.
            var fiDone = new FileInfo(newExe);
            ProgramDbg($"[DOWNLOAD] server reports range unsatisfiable, keeping {fiDone.Length} bytes for verification");
            return (fiDone.Length, fiDone.Length);
        }
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            throw new Exception($"Download HTTP {(int)resp.StatusCode}: {body.Substring(0, Math.Min(300, body.Length))}");
        }

        // 206 = server honors resume (Content-Length = remaining bytes);
        // 200 = server ignored Range, restream the whole file from scratch.
        var resumed = resp.StatusCode == System.Net.HttpStatusCode.PartialContent && existing > 0;
        if (!resumed && existing > 0)
        {
            ProgramDbg($"[DOWNLOAD] server ignored Range (HTTP {(int)resp.StatusCode}), restarting from 0");
            existing = 0;
        }

        var remaining = resp.Content.Headers.ContentLength;
        // Declared total = bytes already on disk + bytes this response carries.
        // For a fresh download existing=0 so declared == Content-Length.
        long? total = remaining.HasValue ? existing + remaining.Value : (long?)null;
        await using var netStream = await resp.Content.ReadAsStreamAsync(ct);
        await using var fileStream = new FileStream(newExe, resumed ? FileMode.Append : FileMode.Create, FileAccess.Write, FileShare.None, 81920, true);
        var buf = new byte[81920];
        long readTotal = existing;
        int n;
        var lastPct = -1;
        if (existing > 0 && total.HasValue && total.Value > 0)
            ProgramDbg($"[DOWNLOAD] resuming at {existing} of {total.Value} bytes ({existing * 100 / total.Value}%)");
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

        var fi = new FileInfo(newExe);
        if (!fi.Exists || fi.Length < 1_000_000)
            throw new Exception($"Downloaded file too small ({(fi.Exists ? fi.Length : 0)} bytes) — likely HTML error page.");
        if (total.HasValue && total.Value > 0 && fi.Length != total.Value)
            throw new Exception($"Incomplete download: received {fi.Length} of {total.Value} bytes — network may have dropped. Will retry.");
        return (fi.Length, total);
    }

    private static long SafeFileLength(string path)
    {
        try
        {
            var fi = new FileInfo(path);
            return fi.Exists ? fi.Length : 0;
        }
        catch { return 0; }
    }

    /// <summary>
    /// True when the failure means the bytes on disk are corrupt (wrong
    /// content), not merely short — resuming would append good bytes to bad
    /// ones, so the partial must be deleted and the next attempt restarts.
    /// </summary>
    internal static bool IsCorruptContent(string message)
    {
        return message.Contains("SHA-256 mismatch", StringComparison.OrdinalIgnoreCase)
            || message.Contains("too small", StringComparison.OrdinalIgnoreCase)
            || message.Contains("HTML error page", StringComparison.OrdinalIgnoreCase);
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
