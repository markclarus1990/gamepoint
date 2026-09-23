using System.Diagnostics;
using Xunit;

namespace GamepointAgent.Tests;

/// <summary>
/// Covers the updater verification contract:
/// valid EXE passes; truncated/incomplete/size/sha failures are RETRYABLE;
/// wrong embedded version is a HARD failure; only size+sha+version all
/// passing allows install. Uses small temp files plus a real versioned
/// system binary — never the 84MB release EXE.
/// </summary>
public sealed class UpdaterVerifyTests
{
    /// <summary>A real PE with a version resource (CoreLib always has one).</summary>
    private static string VersionedFile()
        => typeof(object).Assembly.Location;

    private static string TempPath()
        => Path.Combine(Path.GetTempPath(), $"gp-test-{Guid.NewGuid():N}.bin");

    [Fact]
    public void ValidExe_VersionDetected()
    {
        var check = Updater.CheckEmbeddedVersion(VersionedFile());
        Assert.Equal(Updater.VersionCheckKind.Ok, check.Kind);
        Assert.False(string.IsNullOrWhiteSpace(check.Version));
    }

    [Fact]
    public void TruncatedExe_NoVersion()
    {
        var p = TempPath();
        try
        {
            // Random bytes: valid file on disk, but no version resource —
            // exactly what FileVersionInfo returns for a truncated download.
            var rnd = new Random(42);
            var buf = new byte[4096];
            rnd.NextBytes(buf);
            buf[0] = (byte)'M'; buf[1] = (byte)'Z'; // fake DOS header
            File.WriteAllBytes(p, buf);
            var check = Updater.CheckEmbeddedVersion(p);
            Assert.Equal(Updater.VersionCheckKind.NoVersion, check.Kind);
            Assert.Null(check.Version);
        }
        finally { try { File.Delete(p); } catch { } }
    }

    [Fact]
    public void IncompleteDownload_MissingFile_Retryable()
    {
        var missing = Path.Combine(Path.GetTempPath(), $"gp-missing-{Guid.NewGuid():N}.exe");
        var r = Updater.VerifyDownloadedFile(missing, "1.0.0", expectedSize: 100, expectedSha256: null);
        Assert.False(r.Ok);
        Assert.True(r.Retryable);
    }

    [Fact]
    public void SizeMismatch_Retryable()
    {
        var p = TempPath();
        try
        {
            File.WriteAllBytes(p, new byte[2048]);
            var actual = new FileInfo(p).Length;
            var r = Updater.VerifyDownloadedFile(p, "1.0.0", expectedSize: actual + 1, expectedSha256: null);
            Assert.False(r.Ok);
            Assert.True(r.Retryable);
            Assert.Contains("Size mismatch", r.Error);
        }
        finally { try { File.Delete(p); } catch { } }
    }

    [Fact]
    public void ShaMismatch_Retryable()
    {
        var p = TempPath();
        try
        {
            File.WriteAllBytes(p, new byte[2048]);
            var r = Updater.VerifyDownloadedFile(p, "1.0.0", expectedSize: null, expectedSha256: new string('0', 64));
            Assert.False(r.Ok);
            Assert.True(r.Retryable);
            Assert.Contains("SHA-256 mismatch", r.Error);
            Assert.NotNull(r.ReceivedSha256);
        }
        finally { try { File.Delete(p); } catch { } }
    }

    [Fact]
    public void TruncatedDownload_NoVersion_Retryable_NotHardFailure()
    {
        var p = TempPath();
        try
        {
            var buf = new byte[2048];
            new Random(7).NextBytes(buf);
            File.WriteAllBytes(p, buf);
            var size = new FileInfo(p).Length;
            var sha = Updater.ComputeSha256(p);
            // Size AND sha are correct, but there is no version resource:
            // must retry (truncated), not hard-fail.
            var r = Updater.VerifyDownloadedFile(p, "1.0.0", expectedSize: size, expectedSha256: sha);
            Assert.False(r.Ok);
            Assert.True(r.Retryable);
            Assert.Contains("no embedded version info", r.Error, StringComparison.OrdinalIgnoreCase);
        }
        finally { try { File.Delete(p); } catch { } }
    }

    [Fact]
    public void WrongEmbeddedVersion_HardFailure_NoRetry()
    {
        var file = VersionedFile();
        var size = new FileInfo(file).Length;
        var sha = Updater.ComputeSha256(file);
        var r = Updater.VerifyDownloadedFile(file, "0.0.0-definitely-wrong", expectedSize: size, expectedSha256: sha);
        Assert.False(r.Ok);
        Assert.False(r.Retryable);
        Assert.Contains("Version mismatch", r.Error);
        Assert.NotNull(r.EmbeddedVersion);
    }

    [Fact]
    public void ValidSizeShaAndVersion_InstallAllowed()
    {
        var file = VersionedFile();
        var embedded = Updater.CheckEmbeddedVersion(file);
        Assert.Equal(Updater.VersionCheckKind.Ok, embedded.Kind);
        Assert.NotNull(embedded.Version);
        var size = new FileInfo(file).Length;
        var sha = Updater.ComputeSha256(file);
        var r = Updater.VerifyDownloadedFile(file, embedded.Version!, expectedSize: size, expectedSha256: sha);
        Assert.True(r.Ok);
        Assert.False(r.Retryable);
        Assert.Null(r.Error);
        Assert.Equal(embedded.Version, r.EmbeddedVersion);
    }

    [Fact]
    public void VerifySkipsShaAndSize_WhenUnknown()
    {
        // Older server responses may omit size/sha (null): version check alone decides.
        var file = VersionedFile();
        var embedded = Updater.CheckEmbeddedVersion(file);
        Assert.Equal(Updater.VersionCheckKind.Ok, embedded.Kind);
        var r = Updater.VerifyDownloadedFile(file, embedded.Version!, expectedSize: null, expectedSha256: null);
        Assert.True(r.Ok);
    }

    [Theory]
    [InlineData("v1.0.13", "1.0.13")]
    [InlineData("agent-v1.0.13", "1.0.13")]
    [InlineData("1.0.10+3dc97b33f05fd832940988def09ee1d0e2f759d1", "1.0.10")]
    [InlineData("  1.0.9  ", "1.0.9")]
    public void NormalizeVersion_StripsPrefixesAndBuildMetadata(string raw, string expected)
    {
        Assert.Equal(expected, Updater.NormalizeVersion(raw));
    }

    [Fact]
    public void VersionsMatch_IgnoresPrefixAndBuildMetadata()
    {
        Assert.True(Updater.VersionsMatch("1.0.10+abc123", "v1.0.10"));
        Assert.True(Updater.VersionsMatch("1.0.10", "agent-v1.0.10"));
        Assert.False(Updater.VersionsMatch("1.0.10", "1.0.11"));
    }

    [Theory]
    [InlineData("sha256:ABCDEF1234567890", "abcdef1234567890")]
    [InlineData("abcdef1234567890", "abcdef1234567890")]
    [InlineData(null, null)]
    [InlineData("", null)]
    [InlineData("short", null)]
    public void ParseSha256Digest_HandlesGitHubFormat(string? digest, string? expected)
    {
        Assert.Equal(expected, Updater.ParseSha256Digest(digest));
    }

    [Fact]
    public void ComputeSha256_IsStableLowercaseHex()
    {
        var p = TempPath();
        try
        {
            File.WriteAllBytes(p, "gamepoint"u8.ToArray());
            var a = Updater.ComputeSha256(p);
            var b = Updater.ComputeSha256(p);
            Assert.Equal(a, b);
            Assert.Matches("^[0-9a-f]{64}$", a);
        }
        finally { try { File.Delete(p); } catch { } }
    }
}
