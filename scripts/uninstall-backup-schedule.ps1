[CmdletBinding()]
param([switch]$ConfirmRemoval)

$ErrorActionPreference = "Stop"
$taskName = "RAMS Daily Database Backup"
$projectRoot = Split-Path -Parent $PSScriptRoot
$scheduleConfigFile = Join-Path $projectRoot "backup-schedule.json"

if (-not $ConfirmRemoval) {
  throw "Schedule removal was not confirmed. Re-run with -ConfirmRemoval."
}

$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (-not $task) {
  Remove-Item -LiteralPath $scheduleConfigFile -Force -ErrorAction SilentlyContinue
  Write-Host "RAMS daily backup schedule is not installed."
  exit 0
}

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Remove-Item -LiteralPath $scheduleConfigFile -Force -ErrorAction SilentlyContinue
Write-Host "RAMS daily backup schedule removed. Existing backup files were kept."
