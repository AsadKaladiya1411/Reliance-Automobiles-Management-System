[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "local-helpers.ps1")

$projectRoot = Get-RamsProjectRoot
& (Join-Path $PSScriptRoot "ensure-local-jwt-secret.ps1")
$null = Import-RamsEnvironment
$clientDist = Join-Path $projectRoot "client\dist"
$serverPublic = Join-Path $projectRoot "server\public"
$serverPublicFullPath = [System.IO.Path]::GetFullPath($serverPublic)
$projectRootFullPath = [System.IO.Path]::GetFullPath($projectRoot) + [System.IO.Path]::DirectorySeparatorChar

if (-not $serverPublicFullPath.StartsWith($projectRootFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to update a public directory outside the RAMS project."
}

Write-Host "Building RAMS for local production use..."
& npm.cmd run prisma:generate
if ($LASTEXITCODE -ne 0) {
  throw "RAMS database client generation failed with exit code $LASTEXITCODE."
}

& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
  throw "RAMS production build failed with exit code $LASTEXITCODE."
}

if (-not (Test-Path -LiteralPath (Join-Path $clientDist "index.html"))) {
  throw "Frontend build output is missing."
}

if (Test-Path -LiteralPath $serverPublic) {
  Remove-Item -LiteralPath $serverPublic -Recurse -Force
}
New-Item -ItemType Directory -Path $serverPublic -Force | Out-Null
Copy-Item -Path (Join-Path $clientDist "*") -Destination $serverPublic -Recurse -Force

Write-Host "Creating a pre-migration safety backup..."
& (Join-Path $PSScriptRoot "backup-database.ps1") -Prefix "rams-pre-migration"

Write-Host "Applying pending database migrations..."
Push-Location (Join-Path $projectRoot "server")
try {
  & npm.cmd run prisma:deploy
  if ($LASTEXITCODE -ne 0) {
    throw "Database migration check failed with exit code $LASTEXITCODE."
  }
} finally {
  Pop-Location
}

Write-Host "RAMS local production package is ready."
Write-Host "Next: run installer\Start RAMS.cmd"
