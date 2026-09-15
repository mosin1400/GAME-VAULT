param([string]$OutputDirectory = "backups")
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
if (-not (Test-Path '.env')) { throw ".env is missing" }

Get-Content '.env' | ForEach-Object {
  if ($_ -match '^\s*DATABASE_URL=(.*)$') { $databaseUrl = $Matches[1].Trim() }
}
if (-not $databaseUrl) { throw "DATABASE_URL is missing from .env" }

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$file = Join-Path $OutputDirectory "flowforge-$stamp.sql"
& pg_dump $databaseUrl --file=$file --format=custom
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
Write-Host "Backup created: $file"
