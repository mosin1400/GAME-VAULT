param([Parameter(Mandatory=$true)][string]$BackupFile)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot
if (-not (Test-Path $BackupFile)) { throw "Backup file not found: $BackupFile" }

Get-Content '.env' | ForEach-Object {
  if ($_ -match '^\s*DATABASE_URL=(.*)$') { $databaseUrl = $Matches[1].Trim() }
}
if (-not $databaseUrl) { throw "DATABASE_URL is missing from .env" }
$confirmation = Read-Host "This replaces database data. Type RESTORE to continue"
if ($confirmation -cne 'RESTORE') { throw "Restore cancelled" }
& pg_restore --clean --if-exists --dbname=$databaseUrl $BackupFile
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }
Write-Host "Restore completed."
