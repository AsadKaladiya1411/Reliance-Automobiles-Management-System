[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,

  [Parameter(Mandatory = $true)]
  [switch]$ConfirmRestore
)

$ErrorActionPreference = "Stop"

function Resolve-PostgresTool {
  param([Parameter(Mandatory = $true)][string]$ToolName)

  $command = Get-Command $ToolName -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $postgresRoot = "C:\Program Files\PostgreSQL"
  if (Test-Path -LiteralPath $postgresRoot) {
    $candidate = Get-ChildItem -LiteralPath $postgresRoot -Directory |
      Sort-Object Name -Descending |
      ForEach-Object { Join-Path $_.FullName "bin\$ToolName.exe" } |
      Where-Object { Test-Path -LiteralPath $_ } |
      Select-Object -First 1

    if ($candidate) {
      return $candidate
    }
  }

  throw "$ToolName was not found. Install PostgreSQL command-line tools before restoring a database backup."
}

function Read-DatabaseUrl {
  param([Parameter(Mandatory = $true)][string]$EnvironmentFile)

  if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
    throw "Environment file was not found: $EnvironmentFile"
  }

  $line = Get-Content -LiteralPath $EnvironmentFile |
    Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } |
    Select-Object -First 1

  if (-not $line) {
    throw "DATABASE_URL is missing from $EnvironmentFile"
  }

  $value = ($line -replace '^\s*DATABASE_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
  $urlParts = $value -split '\?', 2
  if ($urlParts.Count -eq 1) {
    return $value
  }

  $cliParameters = $urlParts[1] -split '&' | Where-Object { $_ -notmatch '^schema=' }
  return $urlParts[0] + $(if ($cliParameters.Count -gt 0) { "?" + ($cliParameters -join '&') } else { "" })
}

if (-not $ConfirmRestore) {
  throw "Restore was not confirmed. Re-run with -ConfirmRestore after verifying the selected backup file."
}

$resolvedBackupFile = [System.IO.Path]::GetFullPath($BackupFile)
if (-not (Test-Path -LiteralPath $resolvedBackupFile -PathType Leaf)) {
  throw "Backup file was not found: $resolvedBackupFile"
}

if ([System.IO.Path]::GetExtension($resolvedBackupFile) -ne ".dump") {
  throw "Only RAMS .dump backup files can be restored."
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $projectRoot ".env"
$databaseUrl = Read-DatabaseUrl -EnvironmentFile $environmentFile
$pgRestore = Resolve-PostgresTool -ToolName "pg_restore"
$safetyDirectory = Join-Path $projectRoot "backups"

Write-Host "Creating an automatic pre-restore safety backup..."
& (Join-Path $PSScriptRoot "backup-database.ps1") -OutputDirectory $safetyDirectory -Prefix "pre-restore"
if ($LASTEXITCODE -ne 0) {
  throw "Safety backup failed. Restore has been cancelled without changing the database."
}

Write-Host "Restoring RAMS database from: $resolvedBackupFile"
& $pgRestore "--dbname=$databaseUrl" --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error $resolvedBackupFile

if ($LASTEXITCODE -ne 0) {
  throw "Database restore failed with exit code $LASTEXITCODE. The restore transaction was rolled back."
}

Write-Host "Database restore completed successfully. Restart the RAMS server before signing in."
