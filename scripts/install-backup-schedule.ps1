[CmdletBinding()]
param(
  [string]$BackupDirectory,
  [string]$DailyTime = "20:00"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "local-helpers.ps1")

$projectRoot = Get-RamsProjectRoot
if ([string]::IsNullOrWhiteSpace($BackupDirectory)) {
  $BackupDirectory = Join-Path $projectRoot "backups"
}
$resolvedBackupDirectory = [System.IO.Path]::GetFullPath($BackupDirectory)
$time = [DateTime]::ParseExact($DailyTime, "HH:mm", [System.Globalization.CultureInfo]::InvariantCulture)
$taskName = "RAMS Daily Database Backup"
$backupScript = Join-Path $PSScriptRoot "backup-database.ps1"
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$scheduleConfigFile = Join-Path $projectRoot "backup-schedule.json"

Write-Host "Testing a backup before installing the daily schedule..."
& $backupScript -OutputDirectory $resolvedBackupDirectory -Prefix "rams-scheduled-test"
if ($LASTEXITCODE -ne 0) {
  throw "Backup test failed. The scheduled task was not installed."
}

$actionArguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$backupScript`" -OutputDirectory `"$resolvedBackupDirectory`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $actionArguments
$trigger = New-ScheduledTaskTrigger -Daily -At $time
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Creates a compressed RAMS PostgreSQL backup every day." -Force | Out-Null
$taskInfo = Get-ScheduledTaskInfo -TaskName $taskName
@{
  taskName = $taskName
  backupDirectory = $resolvedBackupDirectory
  dailyTime = $DailyTime
  installedFor = $currentUser
  installedAtUtc = (Get-Date).ToUniversalTime().ToString("O")
} | ConvertTo-Json | Set-Content -LiteralPath $scheduleConfigFile -Encoding utf8

Write-Host "Daily RAMS backup schedule installed successfully."
Write-Host "Backup directory: $resolvedBackupDirectory"
Write-Host "Next run: $($taskInfo.NextRunTime)"
