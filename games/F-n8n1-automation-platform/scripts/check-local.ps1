$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "Checking FlowForge local prerequisites..."
$node = & node --version
if ([version]($node.TrimStart('v')) -lt [version]'20.0.0') { throw "Node.js 20+ is required. Found $node" }
if (-not (Test-Path '.env')) { throw ".env is missing. Copy .env.example to .env and configure it first." }

$envValues = Get-Content '.env' | Where-Object { $_ -match '^\s*[^#][^=]*=' }
if (-not ($envValues -match '^\s*DATABASE_URL=')) { throw "DATABASE_URL is missing from .env" }

Write-Host "Node.js: $node"
Write-Host "Configuration: OK"
Write-Host "PostgreSQL reachability is checked by the application health endpoint."
