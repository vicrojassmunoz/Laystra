# Restore production laystra.db from a OneDrive backup copy.
# Stops the backend service, copies the file into the named volume, starts it
# again. Not automatic — run by hand after verifying the copy
# (`backup_db.ps1 -VerifyOnly`).
#
# Usage:
#   .\restore_db.ps1 -BackupFile "$env:OneDrive\Laystra-backups\laystra-2026-08-30.db"
#
# First restore drill: do NOT run this against production. Use
# `backup_db.ps1 -VerifyOnly` (integrity_check + workout count on a copy).

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

$ComposeDir = Split-Path -Parent $PSScriptRoot
$ContainerDb = "/data/laystra.db"

if (-not (Test-Path $BackupFile)) {
    throw "Backup file not found: $BackupFile"
}

Write-Host "This will REPLACE production $ContainerDb with:"
Write-Host "  $BackupFile"
$confirm = Read-Host "Type YES to continue"
if ($confirm -ne "YES") {
    Write-Host "Aborted."
    exit 1
}

Push-Location $ComposeDir
try {
    docker compose stop backend
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose stop backend failed"
    }

    docker compose cp $BackupFile "backend:${ContainerDb}"
    if ($LASTEXITCODE -ne 0) {
        docker compose start backend | Out-Null
        throw "docker compose cp into the volume failed; backend start was attempted"
    }

    docker compose start backend
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose start backend failed"
    }
}
finally {
    Pop-Location
}

Write-Host "Restore complete. Check https://laystra.vicrojas.com/health"
