$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFiles = @(
    (Join-Path $root ".docmind-runner.pids.json"),
    (Join-Path $root ".docmind-patched-run.pids.json")
)

$found = $false
foreach ($pidFile in $pidFiles) {
    if (-not (Test-Path $pidFile)) {
        continue
    }

    $found = $true
    $data = Get-Content $pidFile -Raw | ConvertFrom-Json
    foreach ($procId in @($data.backendPid, $data.frontendPid)) {
        if ($procId) {
            try {
                Stop-Process -Id $procId -Force -ErrorAction Stop
                Write-Host "Stopped PID $procId"
            } catch {
                Write-Host "PID $procId already stopped"
            }
        }
    }

    Remove-Item $pidFile -ErrorAction SilentlyContinue
}

if (-not $found) {
    Write-Host "No runner PID file found. Nothing to stop."
    exit 0
}

Write-Host "DocMind services stopped."
