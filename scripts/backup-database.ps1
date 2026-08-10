[CmdletBinding()]
param(
  [string]$OutputDirectory,
  [string]$Prefix = "rams"
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

  throw "$ToolName was not found. Install PostgreSQL command-line tools before creating a database backup."
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

$projectRoot = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $projectRoot ".env"
$databaseUrl = Read-DatabaseUrl -EnvironmentFile $environmentFile
$pgDump = Resolve-PostgresTool -ToolName "pg_dump"
$pgRestore = Resolve-PostgresTool -ToolName "pg_restore"

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $projectRoot "backups"
}

$resolvedOutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $resolvedOutputDirectory -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safePrefix = $Prefix -replace '[^a-zA-Z0-9_-]', '-'
$backupPath = Join-Path $resolvedOutputDirectory "$safePrefix-$timestamp.dump"

Write-Host "Creating RAMS database backup..."
& $pgDump "--dbname=$databaseUrl" --format=custom --compress=9 --no-owner --no-privileges "--file=$backupPath"

if ($LASTEXITCODE -ne 0) {
  if (Test-Path -LiteralPath $backupPath) {
    Remove-Item -LiteralPath $backupPath -Force
  }
  throw "Database backup failed with exit code $LASTEXITCODE."
}

$backupFile = Get-Item -LiteralPath $backupPath
if ($backupFile.Length -le 0) {
  Remove-Item -LiteralPath $backupPath -Force
  throw "Database backup was empty and has been removed."
}

& $pgRestore --list $backupPath | Out-Null
if ($LASTEXITCODE -ne 0) {
  Remove-Item -LiteralPath $backupPath -Force
  throw "Database backup validation failed and the invalid file was removed."
}

Write-Host "Backup completed successfully."
Write-Host "File: $($backupFile.FullName)"
Write-Host "Size: $([Math]::Round($backupFile.Length / 1MB, 2)) MB"
