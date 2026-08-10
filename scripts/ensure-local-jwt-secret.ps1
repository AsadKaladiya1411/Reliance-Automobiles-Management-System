[CmdletBinding()]
param([switch]$ForceRotate)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$environmentFile = Join-Path $projectRoot ".env"

if (-not (Test-Path -LiteralPath $environmentFile)) {
  throw "RAMS environment file was not found: $environmentFile"
}

$content = [System.IO.File]::ReadAllText($environmentFile)
$match = [regex]::Match($content, '(?m)^JWT_SECRET\s*=\s*(.*)$')
$currentSecret = if ($match.Success) { $match.Groups[1].Value.Trim().Trim('"').Trim("'") } else { "" }
$knownUnsafeSecrets = @(
  "development-only-change-before-production",
  "change-this-before-production",
  "replace-with-a-long-random-secret"
)
$needsRotation = $ForceRotate -or $currentSecret.Length -lt 32 -or $knownUnsafeSecrets -contains $currentSecret.ToLowerInvariant()

if (-not $needsRotation) {
  Write-Host "RAMS JWT signing secret is already configured securely."
  exit 0
}

$bytes = New-Object byte[] 48
$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $generator.GetBytes($bytes)
} finally {
  $generator.Dispose()
}

$newSecret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
$replacement = "JWT_SECRET=$newSecret"

if ($match.Success) {
  $secretLinePattern = New-Object System.Text.RegularExpressions.Regex('(?m)^JWT_SECRET\s*=\s*.*$')
  $updated = $secretLinePattern.Replace($content, $replacement, 1)
} else {
  $separator = if ($content.Length -gt 0 -and -not $content.EndsWith([Environment]::NewLine)) { [Environment]::NewLine } else { "" }
  $updated = "$content$separator$replacement$([Environment]::NewLine)"
}

$temporaryFile = Join-Path $projectRoot ".env.$([Guid]::NewGuid().ToString('N')).tmp"
try {
  [System.IO.File]::WriteAllText($temporaryFile, $updated, (New-Object System.Text.UTF8Encoding($false)))
  [System.IO.File]::Copy($temporaryFile, $environmentFile, $true)
} finally {
  if (Test-Path -LiteralPath $temporaryFile) {
    [System.IO.File]::Delete($temporaryFile)
  }
}
Write-Host "RAMS JWT signing secret was generated securely. Existing login sessions will require sign-in again after restart."
