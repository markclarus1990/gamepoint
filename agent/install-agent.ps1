$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "dist"
$target = Join-Path $env:LOCALAPPDATA "GamepointAgent"
$exe = Join-Path $source "GamepointAgent.exe"
$cfg = Join-Path $source "config.json"

if (-not (Test-Path $exe)) {
  Write-Host "GamepointAgent.exe not found in $source - run build-agent.ps1 first." -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item $exe $target -Force
if (Test-Path $cfg) { Copy-Item $cfg $target -Force }

$shortcutPath = Join-Path ([Environment]::GetFolderPath("Startup")) "GamepointAgent.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $target "GamepointAgent.exe"
$shortcut.WorkingDirectory = $target
$shortcut.Save()

Write-Host "Installed to $target"
Write-Host "Startup shortcut created: $shortcutPath"
Write-Host ""
Write-Host "Agent will auto-start when the PC logs in."
Write-Host "IMPORTANT: edit $target\config.json with your server URL, agent key and PC name."
