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

# Auto-detect version from git tag or csproj if not supplied
if (-not $Version) {
  $tag = ""
  try { $tag = (git -C $scriptDir describe --tags --abbrev=0 2>$null) } catch {}
  if ($tag -match "agent-v(.+)") { $Version = $Matches[1] }
  elseif ($tag -match "v(.+)") { $Version = $Matches[1] }
}
if (-not $Version) {
  try {
    $csproj = Get-Content $csprojPath -Raw
    if ($csproj -match "<Version>([^<]+)</Version>") { $Version = $Matches[1] }
  } catch {}
}
if (-not $Version) { $Version = "1.0.0" }

Write-Host "Building GamepointAgent v$Version -> $Output"

dotnet publish $csprojPath `
  -c Release `
  -r win-x64 `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:Version=$Version `
  -p:AssemblyVersion=$Version `
  -p:FileVersion=$Version `
  -o $Output

if (-not (Test-Path "$Output\config.json")) {
  Copy-Item $configSample "$Output\config.json"
}
Set-Content -Path "$Output\VERSION" -Value $Version -NoNewline

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
