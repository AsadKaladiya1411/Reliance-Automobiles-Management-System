[CmdletBinding()]
param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "local-helpers.ps1")

$projectRoot = Get-RamsProjectRoot
& (Join-Path $PSScriptRoot "ensure-local-jwt-secret.ps1")
$port = Import-RamsEnvironment
$serverRoot = Join-Path $projectRoot "server"
$serverEntry = Join-Path $serverRoot "dist\server.js"
$frontendEntry = Join-Path $serverRoot "public\index.html"
$pidFile = Join-Path $projectRoot "server-local.pid"
$outputLog = Join-Path $projectRoot "server-local.out.log"
$errorLog = Join-Path $projectRoot "server-local.err.log"
$appUrl = "http://localhost:$port"

if (Test-RamsHealth -Port $port) {
  Write-Host "RAMS is already running at $appUrl"
  if (-not $NoBrowser) { Start-Process $appUrl }
  exit 0
}

if (-not (Test-Path -LiteralPath $serverEntry) -or -not (Test-Path -LiteralPath $frontendEntry)) {
  throw "RAMS local build is missing. Run installer\Setup RAMS.cmd first."
}

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) {
  throw "Node.js was not found. Install Node.js before starting RAMS."
}

$process = Start-Process -FilePath $node.Source -ArgumentList @("dist/server.js") -WorkingDirectory $serverRoot -WindowStyle Hidden -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog -PassThru
@{
  processId = $process.Id
  startedAtUtc = $process.StartTime.ToUniversalTime().ToString("O")
} | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding utf8

for ($attempt = 1; $attempt -le 30; $attempt++) {
  if (Test-RamsHealth -Port $port) {
    Write-Host "RAMS started successfully at $appUrl"
    if (-not $NoBrowser) { Start-Process $appUrl }
    exit 0
  }
  Start-Sleep -Seconds 1
}

if (-not $process.HasExited) {
  Stop-Process -Id $process.Id -Force
}
Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
throw "RAMS did not become ready. Check server-local.err.log for details."
