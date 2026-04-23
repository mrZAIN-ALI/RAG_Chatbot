param(
    [int]$PreferredBackendPort = 8000,
    [int]$PreferredFrontendPort = 3000,
    [int]$StatusIntervalSeconds = 30,
    [switch]$Monitor
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendDir = Join-Path $root "docmind-web"
$pythonExe = Join-Path $root ".venv\Scripts\python.exe"
$pidFile = Join-Path $root ".docmind-runner.pids.json"
$backendLog = Join-Path $root ".docmind-backend.log"
$frontendLog = Join-Path $root ".docmind-frontend.log"
$backendErrLog = Join-Path $root ".docmind-backend.err.log"
$frontendErrLog = Join-Path $root ".docmind-frontend.err.log"
$envFile = Join-Path $root ".env"

function Write-Flag {
    param(
        [string]$Name,
        [bool]$Ok,
        [string]$Detail
    )

    $status = if ($Ok) { "PASS" } else { "FAIL" }
    $color = if ($Ok) { "Green" } else { "Red" }
    Write-Host ("[{0}] {1} - {2}" -f $status, $Name, $Detail) -ForegroundColor $color
}

function Test-PortAvailable {
    param([int]$Port)

    $listeners = @()
    try {
        foreach ($address in @([System.Net.IPAddress]::Loopback, [System.Net.IPAddress]::IPv6Loopback)) {
            $listener = [System.Net.Sockets.TcpListener]::new($address, $Port)
            $listener.Start()
            $listeners += $listener
        }
        return $true
    } catch {
        return $false
    } finally {
        foreach ($listener in $listeners) {
            $listener.Stop()
        }
    }
}

function Get-FreePort {
    param([int]$Preferred)

    if (Test-PortAvailable -Port $Preferred) {
        return $Preferred
    }

    for ($p = $Preferred + 1; $p -lt $Preferred + 300; $p++) {
        if (Test-PortAvailable -Port $p) {
            return $p
        }
    }

    throw "Could not find an available port near $Preferred"
}

function Test-UrlOk {
    param([string]$Url)

    try {
        $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        return $true
    } catch {
        return $false
    }
}

function Wait-Url {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 60
    )

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        if (Test-UrlOk -Url $Url) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    }

    return $false
}

function Stop-OldRunnerProcesses {
    if (-not (Test-Path $pidFile)) {
        return
    }

    try {
        $data = Get-Content $pidFile -Raw | ConvertFrom-Json
        foreach ($procId in @($data.backendPid, $data.frontendPid)) {
            if ($procId) {
                try {
                    Stop-Process -Id $procId -Force -ErrorAction Stop
                    Write-Host "Stopped previous runner process PID=$procId" -ForegroundColor Yellow
                } catch {
                    # Ignore if already gone.
                }
            }
        }
    } catch {
        # Ignore corrupt file.
    }

    Remove-Item $pidFile -ErrorAction SilentlyContinue
}

if (-not (Test-Path $frontendDir)) {
    throw "Frontend directory not found: $frontendDir"
}

if (-not (Test-Path $pythonExe)) {
    throw "Python venv executable not found: $pythonExe"
}

function Stop-StaleDocMindProcesses {
    $escapedRoot = [regex]::Escape($root)
    $escapedFrontend = [regex]::Escape($frontendDir)

    Get-CimInstance Win32_Process |
        Where-Object {
            ($_.CommandLine -match "uvicorn api\.main:app" -and $_.CommandLine -match $escapedRoot) -or
            ($_.CommandLine -match "next\\dist\\server\\lib\\start-server\.js" -and $_.CommandLine -match $escapedFrontend)
        } |
        ForEach-Object {
            try {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop
                Write-Host "Stopped stale DocMind process PID=$($_.ProcessId)" -ForegroundColor Yellow
            } catch {
                # Ignore if already gone.
            }
        }
}

if (-not (Test-Path $envFile)) {
    throw "Configuration file not found: $envFile. Copy .env.example to .env and fill in real keys."
}

Stop-OldRunnerProcesses
Stop-StaleDocMindProcesses
Remove-Item $backendLog, $frontendLog -ErrorAction SilentlyContinue
Remove-Item $backendErrLog, $frontendErrLog -ErrorAction SilentlyContinue

$backendPort = Get-FreePort -Preferred $PreferredBackendPort
$frontendPort = Get-FreePort -Preferred $PreferredFrontendPort
$apiBase = "http://127.0.0.1:$backendPort"
$frontendUrl = "http://127.0.0.1:$frontendPort"

Write-Host ("=" * 68)
Write-Host "DocMind Unified Launcher" -ForegroundColor Cyan
Write-Host "Root: $root"
Write-Host "Backend port:  $backendPort"
Write-Host "Frontend port: $frontendPort"
Write-Host "API base:      $apiBase"
Write-Host ("=" * 68)

$backendScript = @"
Set-Location -LiteralPath '$root'
& '$pythonExe' -m uvicorn api.main:app --host 127.0.0.1 --port $backendPort --reload
"@

$frontendScript = @"
Set-Location -LiteralPath '$frontendDir'
`$env:NEXT_PUBLIC_API_BASE = '$apiBase'
`$env:PORT = '$frontendPort'
npm run dev
"@

$backendEncoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($backendScript))
$frontendEncoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($frontendScript))

$backendProc = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $backendEncoded -PassThru -WindowStyle Hidden -RedirectStandardOutput $backendLog -RedirectStandardError $backendErrLog
$frontendProc = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $frontendEncoded -PassThru -WindowStyle Hidden -RedirectStandardOutput $frontendLog -RedirectStandardError $frontendErrLog

@{
    backendPid = $backendProc.Id
    frontendPid = $frontendProc.Id
    backendPort = $backendPort
    frontendPort = $frontendPort
    apiBase = $apiBase
} | ConvertTo-Json | Set-Content $pidFile

$backendHealthy = Wait-Url -Url "$apiBase/health" -TimeoutSeconds 90
$frontendHealthy = Wait-Url -Url $frontendUrl -TimeoutSeconds 120
$backendEffectiveRunning = (-not $backendProc.HasExited) -or $backendHealthy
$frontendEffectiveRunning = (-not $frontendProc.HasExited) -or $frontendHealthy

Write-Host ""
Write-Flag -Name "Backend process" -Ok $backendEffectiveRunning -Detail ("PID {0}" -f $backendProc.Id)
Write-Flag -Name "Backend health" -Ok $backendHealthy -Detail "$apiBase/health"
Write-Flag -Name "Frontend process" -Ok $frontendEffectiveRunning -Detail ("PID {0}" -f $frontendProc.Id)
Write-Flag -Name "Frontend HTTP" -Ok $frontendHealthy -Detail $frontendUrl
Write-Flag -Name "Frontend -> Backend API base" -Ok $true -Detail $apiBase

$allOk = $backendHealthy -and $frontendHealthy
Write-Host ""
if ($allOk) {
    Write-Host "All systems are up. Open: $frontendUrl" -ForegroundColor Green
} else {
    Write-Host "One or more checks failed. See logs:" -ForegroundColor Red
    Write-Host "- $backendLog"
    Write-Host "- $backendErrLog"
    Write-Host "- $frontendLog"
    Write-Host "- $frontendErrLog"
}

Write-Host ""
if (-not $Monitor) {
    Write-Host "Services are running in the background. Use .\stop_docmind.ps1 to stop them." -ForegroundColor Cyan
    exit 0
}

Write-Host "Live status monitor running. Press Ctrl+C to stop both services." -ForegroundColor Cyan

try {
    while ($true) {
        Start-Sleep -Seconds $StatusIntervalSeconds

        $backendRunning = -not $backendProc.HasExited
        $frontendRunning = -not $frontendProc.HasExited
        $backendOk = Test-UrlOk -Url "$apiBase/health"
        $frontendOk = Test-UrlOk -Url $frontendUrl
        $backendEffective = $backendRunning -or $backendOk
        $frontendEffective = $frontendRunning -or $frontendOk

        Write-Host ""
        Write-Host ("[{0}] Status" -f (Get-Date -Format "HH:mm:ss")) -ForegroundColor DarkCyan
        Write-Flag -Name "Backend process" -Ok $backendEffective -Detail ("PID {0}" -f $backendProc.Id)
        Write-Flag -Name "Backend connected" -Ok $backendOk -Detail "$apiBase/health"
        Write-Flag -Name "Frontend process" -Ok $frontendEffective -Detail ("PID {0}" -f $frontendProc.Id)
        Write-Flag -Name "Frontend connected" -Ok $frontendOk -Detail $frontendUrl
        Write-Flag -Name "Frontend/Backend bridge" -Ok ($backendOk -and $frontendOk) -Detail "NEXT_PUBLIC_API_BASE=$apiBase"

        if (-not $backendEffective -or -not $frontendEffective) {
            Write-Host "A process exited. Check logs:" -ForegroundColor Yellow
            Write-Host "- $backendLog"
            Write-Host "- $backendErrLog"
            Write-Host "- $frontendLog"
            Write-Host "- $frontendErrLog"
            break
        }
    }
} finally {
    Write-Host ""
    Write-Host "Stopping runner-managed processes..." -ForegroundColor Yellow
    foreach ($procId in @($backendProc.Id, $frontendProc.Id)) {
        try {
            Stop-Process -Id $procId -Force -ErrorAction Stop
        } catch {
            # Ignore if already stopped.
        }
    }
    Remove-Item $pidFile -ErrorAction SilentlyContinue
    Write-Host "Stopped." -ForegroundColor Yellow
}
