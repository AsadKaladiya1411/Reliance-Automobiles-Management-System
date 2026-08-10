[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "local-helpers.ps1")

$projectRoot = Get-RamsProjectRoot
$port = Import-RamsEnvironment
$pidFile = Join-Path $projectRoot "server-local.pid"
$scheduleConfigFile = Join-Path $projectRoot "backup-schedule.json"
$taskName = "RAMS Daily Database Backup"
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
$taskInfo = if ($task) { Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction SilentlyContinue } else { $null }
$launcher = if (Test-Path -LiteralPath $pidFile) { Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json } else { $null }
$scheduleConfig = if (Test-Path -LiteralPath $scheduleConfigFile) { Get-Content -LiteralPath $scheduleConfigFile -Raw | ConvertFrom-Json } else { $null }

[PSCustomObject]@{
  Application = if (Test-RamsHealth -Port $port) { "Running" } else { "Stopped" }
  Url = "http://localhost:$port"
  LauncherPid = if ($launcher) { $launcher.processId } else { "-" }
  DailyBackup = if ($task) { $task.State } elseif ($scheduleConfig) { "Installed (restricted status visibility)" } else { "Not installed" }
  BackupDirectory = if ($scheduleConfig) { $scheduleConfig.backupDirectory } else { "-" }
  LastBackupRun = if ($taskInfo) { $taskInfo.LastRunTime } else { "-" }
  NextBackupRun = if ($taskInfo) { $taskInfo.NextRunTime } elseif ($scheduleConfig) { "Daily at $($scheduleConfig.dailyTime)" } else { "-" }
} | Format-List
