# Hot backup of production laystra.db from the Docker Compose `backend`
# service into OneDrive. Talks to Compose by service name so the same flow
# can move to cron on Linux later.
#
# Usage:
#   .\backup_db.ps1                # backup + prune copies older than 14 days
#   .\backup_db.ps1 -VerifyOnly    # integrity-check the latest copy (no write)
#   .\backup_db.ps1 -RegisterTask  # one-shot: daily Task Scheduler at 03:00
#
# Requires: Docker Desktop up, compose stack running, $env:OneDrive set.
# Integrity checks run inside the container (stdlib sqlite3) so host Python
# is not required.

[CmdletBinding()]
param(
    [switch]$VerifyOnly,
    [switch]$RegisterTask
)

$ErrorActionPreference = "Stop"

$ComposeDir = Split-Path -Parent $PSScriptRoot
$ScriptPath = $PSCommandPath
$DestDir = Join-Path $env:OneDrive "Laystra-backups"
$RetentionDays = 14
$TaskName = "LaystraBackup"
$ContainerBackup = "/tmp/laystra-backup.db"
$ContainerDb = "/data/laystra.db"

# sqlite3 stdlib; no app imports. Printed as two lines: integrity_check, workout count.
$CheckPy = "import sqlite3,sys; p=sys.argv[1]; c=sqlite3.connect(p); print(c.execute('PRAGMA integrity_check').fetchone()[0]); print(c.execute('SELECT COUNT(*) FROM workouts').fetchone()[0]); c.close()"
$BackupPy = "import sqlite3; src=sqlite3.connect('$ContainerDb'); dst=sqlite3.connect('$ContainerBackup'); src.backup(dst); dst.close(); src.close(); c=sqlite3.connect('$ContainerBackup'); print(c.execute('PRAGMA integrity_check').fetchone()[0]); print(c.execute('SELECT COUNT(*) FROM workouts').fetchone()[0]); c.close()"

if ($RegisterTask) {
    if (-not (Test-Path $ScriptPath)) {
        throw "Cannot register: script path not found ($ScriptPath)"
    }
    $tr = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`""
    & schtasks.exe /Create /TN $TaskName /TR $tr /SC DAILY /ST 03:00 /F
    if ($LASTEXITCODE -ne 0) {
        throw "schtasks failed with exit code $LASTEXITCODE"
    }
    Write-Host "Registered daily task '$TaskName' at 03:00."
    Write-Host "Run: schtasks /Query /TN $TaskName /V /FO LIST"
    exit 0
}

if (-not $env:OneDrive) {
    throw "env var OneDrive is not set. Is OneDrive installed and signed in?"
}

New-Item -ItemType Directory -Force -Path $DestDir | Out-Null

function Assert-CheckOutput {
    param(
        [Parameter(Mandatory = $true)]$Raw,
        [Parameter(Mandatory = $true)][string]$Label
    )
    $lines = @($Raw | ForEach-Object { "$_" } | Where-Object { $_.Trim() -ne "" })
    if ($LASTEXITCODE -ne 0) {
        throw "integrity check command failed for $Label"
    }
    if ($lines.Count -lt 2 -or $lines[0].Trim() -ne "ok") {
        throw "integrity_check of $Label was '$($lines[0])', expected 'ok'"
    }
    Write-Host "integrity_check=ok  workouts=$($lines[1].Trim())  $Label"
}

Push-Location $ComposeDir
try {
    if ($VerifyOnly) {
        $latest = Get-ChildItem $DestDir -Filter "laystra-*.db" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if (-not $latest) {
            throw "No backups found in $DestDir"
        }
        docker compose cp $latest.FullName "backend:/tmp/laystra-verify.db"
        if ($LASTEXITCODE -ne 0) {
            throw "docker compose cp of $($latest.FullName) into the container failed"
        }
        $out = docker compose exec -T backend python -c $CheckPy /tmp/laystra-verify.db
        Assert-CheckOutput -Raw $out -Label $latest.FullName
        exit 0
    }

    $stamp = Get-Date -Format "yyyy-MM-dd"
    $destFile = Join-Path $DestDir "laystra-$stamp.db"

    $out = docker compose exec -T backend python -c $BackupPy
    Assert-CheckOutput -Raw $out -Label "container $ContainerBackup"

    docker compose cp "backend:${ContainerBackup}" $destFile
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose cp out to $destFile failed"
    }
}
finally {
    Pop-Location
}

$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem $DestDir -Filter "laystra-*.db" |
    Where-Object { $_.LastWriteTime -lt $cutoff -and $_.FullName -ne $destFile } |
    ForEach-Object {
        Write-Host "Pruning $($_.Name)"
        Remove-Item $_.FullName
    }

Write-Host "Backup written to $destFile"
