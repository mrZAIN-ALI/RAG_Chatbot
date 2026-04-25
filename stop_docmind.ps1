$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeDir = Join-Path $root ".runtime"
$pidFiles = @(
    (Join-Path $runtimeDir "docmind-runner.pids.json"),
    (Join-Path $runtimeDir "docmind-patched-run.pids.json"),
    (Join-Path $root ".docmind-runner.pids.json"),
    (Join-Path $root ".docmind-patched-run.pids.json")
)

function Get-DescendantProcessIds {
    param(
        [int]$ProcessId,
        [object[]]$Processes
    )

    $children = @($Processes | Where-Object { $_.ParentProcessId -eq $ProcessId })
    foreach ($child in $children) {
        Get-DescendantProcessIds -ProcessId $child.ProcessId -Processes $Processes
        $child.ProcessId
    }
}

function Stop-ProcessTree {
    param([int]$ProcessId)

    $processes = @(Get-CimInstance Win32_Process)
    $descendantIds = @(Get-DescendantProcessIds -ProcessId $ProcessId -Processes $processes | Select-Object -Unique)
    $processIds = @($descendantIds + $ProcessId) | Where-Object { $_ }

    foreach ($procId in $processIds) {
        try {
            Stop-Process -Id $procId -Force -ErrorAction Stop
            Write-Host "Stopped PID $procId"
        } catch {
            Write-Host "PID $procId already stopped"
        }
    }
}

$escapedRoot = [regex]::Escape($root)

$found = $false
foreach ($pidFile in $pidFiles) {
    if (-not (Test-Path $pidFile)) {
        continue
    }

    $found = $true
    $data = Get-Content $pidFile -Raw | ConvertFrom-Json
    foreach ($procId in @($data.backendPid, $data.frontendPid)) {
        if ($procId) {
            Stop-ProcessTree -ProcessId $procId
        }
    }

    Remove-Item $pidFile -ErrorAction SilentlyContinue
}

Get-CimInstance Win32_Process |
    Where-Object {
        $_.CommandLine -and
        $_.CommandLine -match $escapedRoot -and
        (
            $_.CommandLine -match "uvicorn api\.main:app" -or
            $_.CommandLine -match "next\\dist\\bin\\next" -or
            $_.CommandLine -match "next\\dist\\server\\lib\\start-server\.js"
        )
    } |
    ForEach-Object {
        Stop-ProcessTree -ProcessId $_.ProcessId
        $found = $true
    }

if (-not $found) {
    Write-Host "No runner PID file found. Nothing to stop."
    exit 0
}

Write-Host "DocMind services stopped."
