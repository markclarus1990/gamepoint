param(
  [string]$Output = ".\dist",
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"

# Resolve paths relative to this script (works from any cwd)
$scriptDir = $PSScriptRoot
if (-not $scriptDir) { $scriptDir = "." }
$csprojPath = Join-Path $scriptDir "GamepointAgent\GamepointAgent.csproj"
$configSample = Join-Path $scriptDir "config.sample.json"

# Resolve Output relative to script dir if it's a relative path like ".\dist"
if (-not [System.IO.Path]::IsPathRooted($Output)) {
  $Output = Join-Path $scriptDir $Output
}

# Auto-detect version from git tag if not supplied.
# NOTE: the .csproj intentionally contains NO <Version> — the version comes
# exclusively from here (local) or build-agent.yml (CI) via -p:Version etc.
if (-not $Version) {
  $tag = ""
  try { $tag = (git -C $scriptDir describe --tags --match "agent-v*" --abbrev=0 2>$null) } catch {}
  if ($tag -match "agent-v(.+)") { $Version = $Matches[1] }
}
if (-not $Version) {
  try {
    $vfile = Join-Path $scriptDir "dist\VERSION"
    if (Test-Path $vfile) { $Version = (Get-Content $vfile -Raw).Trim() }
  } catch {}
}
if (-not $Version) { $Version = "1.0.0" }

Write-Host "Building GamepointAgent v$Version -> $Output"

# Clean previous outputs (non-incremental) so a stale EXE can never be
# packaged — but preserve config.json which holds per-machine settings.
foreach ($stale in @("GamepointAgent.exe", "GamepointAgent.pdb", "VERSION")) {
  $p = Join-Path $Output $stale
  try { if (Test-Path $p) { Remove-Item $p -Force; Write-Host "Cleaned stale $stale" } } catch {}
}

# NOTE: all four version props must be passed explicitly — the agent reads
# InformationalVersion at runtime (Updater.CurrentVersion) and the exe's
# FileVersion/ProductVersion are verified by the updater before install.
dotnet publish $csprojPath `
  -c Release `
  -r win-x64 `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:Version=$Version `
  -p:AssemblyVersion=$Version `
  -p:FileVersion=$Version `
  -p:InformationalVersion=$Version `
  -o $Output

if (-not (Test-Path "$Output\config.json")) {
  Copy-Item $configSample "$Output\config.json"
}
Set-Content -Path "$Output\VERSION" -Value $Version -NoNewline

# Verify the built EXE actually carries the expected version — fail fast
# instead of publishing an asset the updater would (correctly) refuse.
function Normalize-AgentVersion([string]$v) {
  $s = $v.Trim().TrimStart('v')
  if ($s.StartsWith("agent-v", [StringComparison]::OrdinalIgnoreCase)) { $s = $s.Substring("agent-v".Length) }
  $plus = $s.IndexOf('+')
  if ($plus -ge 0) { $s = $s.Substring(0, $plus) }
  return $s.Trim()
}
$exeInfo = (Get-Item "$Output\GamepointAgent.exe").VersionInfo
$embedded = if ($exeInfo.ProductVersion) { $exeInfo.ProductVersion } else { $exeInfo.FileVersion }
$embeddedNorm = Normalize-AgentVersion ($embedded | Out-String)
$expectedNorm = Normalize-AgentVersion $Version
if ([string]::IsNullOrWhiteSpace($embedded)) {
  throw "Build verification FAILED: GamepointAgent.exe has no embedded version info (expected v$expectedNorm). Refusing to package."
}
if ($embeddedNorm -ne $expectedNorm) {
  throw "Build verification FAILED: embedded v$embeddedNorm != expected v$expectedNorm. Refusing to package."
}
$exeHash = (Get-FileHash "$Output\GamepointAgent.exe" -Algorithm SHA256).Hash.ToLower()
$exeSize = (Get-Item "$Output\GamepointAgent.exe").Length
Write-Host "Verified embedded version: $embedded (normalized $embeddedNorm)"
Write-Host "  Size:   $exeSize bytes"
Write-Host "  SHA256: $exeHash"

Write-Host ""
Write-Host "Agent built: $Output\GamepointAgent.exe (v$Version)"
Write-Host "  VERSION file: $Output\VERSION"
Write-Host ""
Write-Host "Manual install (legacy):"
Write-Host "  1. Copy GamepointAgent.exe + config.json to each cafe PC."
Write-Host "  2. Edit config.json with your server URL, agent key and PC name."
Write-Host "  3. Run install-agent.ps1 on that PC to auto-start it at login."
Write-Host ""
Write-Host "Auto-update (recommended):"
Write-Host "  - Push to GitHub (main) -> Actions builds & creates Release agent-v*"
Write-Host "  - On each PC the agent shows 'Update' banner; click to self-update."
Write-Host "  - Admin can also push 'update' command from Stations page."
Write-Host "  - Or run:  git tag agent-v$Version; git push origin agent-v$Version"
