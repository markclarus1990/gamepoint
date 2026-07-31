param(
  [string]$Output = ".\dist"
)

$ErrorActionPreference = "Stop"

dotnet publish ".\GamepointAgent\GamepointAgent.csproj" `
  -c Release `
  -r win-x64 `
  --self-contained true `
  -p:PublishSingleFile=true `
  -o $Output

if (-not (Test-Path "$Output\config.json")) {
  Copy-Item ".\config.sample.json" "$Output\config.json"
}

Write-Host ""
Write-Host "Agent built: $Output\GamepointAgent.exe"
Write-Host "1. Copy GamepointAgent.exe + config.json to each cafe PC."
Write-Host "2. Edit config.json with your server URL, agent key and PC name."
Write-Host "3. Run install-agent.ps1 on that PC to auto-start it at login."
