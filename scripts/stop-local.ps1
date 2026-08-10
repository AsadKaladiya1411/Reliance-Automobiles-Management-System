[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "local-helpers.ps1")

$projectRoot = Get-RamsProjectRoot
$pidFile = Join-Path $projectRoot "server-local.pid"

if (-not (Test-Path -LiteralPath $pidFile)) {
  Write-Host "RAMS is not running from the local launcher."
  exit 0
}

$launcher = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
$processId = [int]$launcher.processId
$expectedStartTime = [DateTime]::Parse($launcher.startedAtUtc).ToUniversalTime()
$process = Get-Process -Id $processId -ErrorAction SilentlyContinue

if (-not $process) {
  Remove-Item -LiteralPath $pidFile -Force
  Write-Host "RAMS process was already stopped."
  exit 0
}

if ($process.ProcessName -ne "node" -or [Math]::Abs(($process.StartTime.ToUniversalTime() - $expectedStartTime).TotalSeconds) -gt 2) {
  throw "PID $processId does not belong to the RAMS local server. It was not stopped."
}

Stop-Process -Id $processId
Remove-Item -LiteralPath $pidFile -Force
Write-Host "RAMS stopped successfully."
