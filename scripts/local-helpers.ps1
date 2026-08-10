function Get-RamsProjectRoot {
  return Split-Path -Parent $PSScriptRoot
}

function Import-RamsEnvironment {
  $projectRoot = Get-RamsProjectRoot
  $environmentFile = Join-Path $projectRoot ".env"

  if (-not (Test-Path -LiteralPath $environmentFile)) {
    throw "RAMS environment file was not found: $environmentFile"
  }

  foreach ($line in Get-Content -LiteralPath $environmentFile) {
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      continue
    }

    $name = $Matches[1]
    $value = $Matches[2].Trim().Trim('"').Trim("'")
    [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
  }

  $port = if ($env:PORT) { $env:PORT } else { "5000" }
  $env:NODE_ENV = "production"
  $env:HOST = "127.0.0.1"
  $env:CLIENT_URL = "http://localhost:$port"
  $env:VITE_API_BASE_URL = "/api"
  return $port
}

function Test-RamsHealth {
  param([Parameter(Mandatory = $true)][string]$Port)

  try {
    $response = Invoke-RestMethod -Uri "http://localhost:$Port/api/health" -Method Get -TimeoutSec 3
    return $response.success -eq $true -and $response.data.database -eq "connected"
  } catch {
    return $false
  }
}
