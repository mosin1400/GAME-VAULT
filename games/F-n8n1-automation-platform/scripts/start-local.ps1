$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

& "$PSScriptRoot\check-local.ps1"
if (-not (Test-Path 'node_modules')) { & npm.cmd install }
& npm.cmd run build
& npm.cmd run start
