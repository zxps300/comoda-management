param(
    [ValidateSet('local', 'online')]
    [string]$Mode = 'online',

    [ValidateRange(1, 65535)]
    [int]$BackendPort = 8001,

    [ValidateRange(1, 65535)]
    [int]$FrontendPort = 5174,

    [switch]$NoMonitor
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$backendDirectory = Join-Path $resolvedProjectRoot 'backend'
$frontendDirectory = Join-Path $resolvedProjectRoot 'frontend'
$runtimeDirectory = Join-Path $resolvedProjectRoot 'runtime'
$supervisorLog = Join-Path $runtimeDirectory 'supervisor.log'
$heartbeatPath = Join-Path $runtimeDirectory 'supervisor-heartbeat.txt'
$backendPidPath = Join-Path $runtimeDirectory 'backend.pid'
$frontendPidPath = Join-Path $runtimeDirectory 'frontend.pid'

New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null

$createdNew = $false
$supervisorMutex = [Threading.Mutex]::new($true, 'Local\ComodaRestaurantSupervisor', [ref]$createdNew)
if (-not $createdNew) {
    exit 0
}

function Write-SupervisorLog([string]$Message) {
    $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -LiteralPath $supervisorLog -Value $line
    if (-not $NoMonitor) {
        Write-Host $line
    }
}

function Write-SupervisorHeartbeat {
    $temporaryPath = $heartbeatPath + '.tmp'
    [IO.File]::WriteAllText($temporaryPath, [DateTime]::UtcNow.ToString('o'))
    Move-Item -LiteralPath $temporaryPath -Destination $heartbeatPath -Force
}

function Get-ListenerProcess([int]$Port) {
    $pattern = '^\s*TCP\s+\S+:' + $Port + '\s+\S+\s+LISTENING\s+(\d+)\s*$'
    foreach ($line in (& netstat.exe -ano -p TCP)) {
        if ($line -match $pattern) {
            return Get-CimInstance Win32_Process -Filter "ProcessId=$($Matches[1])" -ErrorAction SilentlyContinue
        }
    }

    return $null
}

function Test-WorkspaceListener([int]$Port) {
    $process = Get-ListenerProcess $Port
    if ($null -eq $process) {
        return $false
    }

    $commandLine = [string]$process.CommandLine
    if ($commandLine.IndexOf($resolvedProjectRoot, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw "Port $Port belongs to a different program: $($process.ExecutablePath)"
    }

    return $true
}

function Get-HttpStatus([string]$Url, [int]$TimeoutSeconds = 2) {
    $statusText = & curl.exe --silent --show-error --output NUL --write-out '%{http_code}' --max-time $TimeoutSeconds $Url 2>$null
    if ($LASTEXITCODE -eq 0 -and $statusText -match '^\d{3}$') {
        return [int]$statusText
    }

    return 0
}

function Wait-ForHttp([string]$Url, [int]$Attempts = 40, [int]$RequestTimeoutSeconds = 2) {
    for ($attempt = 0; $attempt -lt $Attempts; $attempt += 1) {
        $statusCode = Get-HttpStatus $Url $RequestTimeoutSeconds
        if ($statusCode -ge 200 -and $statusCode -lt 500) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Ensure-MySql {
    if ($null -ne (Get-ListenerProcess 3306)) {
        return
    }

    $mysqlExecutable = 'C:\xampp\mysql\bin\mysqld.exe'
    $mysqlConfig = 'C:\xampp\mysql\bin\my.ini'
    if (-not (Test-Path -LiteralPath $mysqlExecutable -PathType Leaf) -or -not (Test-Path -LiteralPath $mysqlConfig -PathType Leaf)) {
        throw 'MySQL is not running and the XAMPP MySQL installation was not found.'
    }

    Write-SupervisorLog 'Starting the local database.'
    $mysqlArguments = @('--defaults-file="C:\xampp\mysql\bin\my.ini"', '--standalone')
    Start-Process -FilePath $mysqlExecutable -ArgumentList $mysqlArguments -WindowStyle Hidden | Out-Null

    for ($attempt = 0; $attempt -lt 120; $attempt += 1) {
        if ($null -ne (Get-ListenerProcess 3306)) {
            return
        }
        Start-Sleep -Milliseconds 500
    }

    throw 'MySQL did not start within 60 seconds.'
}

function Invoke-Migrations {
    Write-SupervisorLog 'Checking database migrations.'
    $parameters = @{
        FilePath = 'php.exe'
        ArgumentList = @('artisan', 'migrate', '--force', '--no-interaction')
        WorkingDirectory = $backendDirectory
        WindowStyle = 'Hidden'
        Wait = $true
        PassThru = $true
    }
    $migration = Start-Process @parameters
    if ($migration.ExitCode -ne 0) {
        throw 'Database migration failed. See the Laravel log for details.'
    }
}

function Ensure-Backend {
    if (Test-WorkspaceListener $BackendPort) {
        return
    }

    Write-SupervisorLog "Starting the backend on port $BackendPort."
    $parameters = @{
        FilePath = 'php.exe'
        ArgumentList = @('artisan', 'serve', '--host=127.0.0.1', "--port=$BackendPort", '--no-reload')
        WorkingDirectory = $backendDirectory
        WindowStyle = 'Hidden'
        PassThru = $true
        RedirectStandardOutput = (Join-Path $runtimeDirectory 'backend.stdout.log')
        RedirectStandardError = (Join-Path $runtimeDirectory 'backend.stderr.log')
    }
    $process = Start-Process @parameters
    [IO.File]::WriteAllText($backendPidPath, [string]$process.Id)

    if (-not (Wait-ForHttp "http://127.0.0.1:$BackendPort/up")) {
        throw "The backend did not become ready on port $BackendPort."
    }
}

function Ensure-Frontend {
    if (Test-WorkspaceListener $FrontendPort) {
        return
    }

    Write-SupervisorLog "Starting the management screen on port $FrontendPort."
    $parameters = @{
        FilePath = 'npm.cmd'
        ArgumentList = @('run', 'dev', '--', '--host', '127.0.0.1', '--port', [string]$FrontendPort, '--strictPort')
        WorkingDirectory = $frontendDirectory
        WindowStyle = 'Hidden'
        PassThru = $true
        RedirectStandardOutput = (Join-Path $runtimeDirectory 'frontend.stdout.log')
        RedirectStandardError = (Join-Path $runtimeDirectory 'frontend.stderr.log')
    }
    $process = Start-Process @parameters
    [IO.File]::WriteAllText($frontendPidPath, [string]$process.Id)

    if (-not (Wait-ForHttp "http://127.0.0.1:$FrontendPort")) {
        throw "The management screen did not become ready on port $FrontendPort."
    }
}

function Test-PermanentMenu {
    $baseUrlPath = Join-Path $backendDirectory 'storage\app\private\comoda-qr-base-url.txt'
    if (-not (Test-Path -LiteralPath $baseUrlPath -PathType Leaf)) {
        return $false
    }

    $baseUrl = (Get-Content -LiteralPath $baseUrlPath -Raw).Trim()
    if ($baseUrl -notmatch '^https://[a-zA-Z0-9.-]+\.workers\.dev/?$') {
        return $false
    }

    try {
        $response = Invoke-WebRequest -Uri ($baseUrl.TrimEnd('/') + '/menu') -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 8 -ErrorAction Stop
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
    } catch {
        if ($null -ne $_.Exception.Response -and $null -ne $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            return $statusCode -in @(301, 302, 307, 308)
        }
        return $false
    }
}

function Test-CurrentTunnel {
    $urlPath = Join-Path $runtimeDirectory 'cloudflare_url.txt'
    if (-not (Test-Path -LiteralPath $urlPath -PathType Leaf)) {
        return $false
    }

    $origin = (Get-Content -LiteralPath $urlPath -Raw).Trim()
    if ($origin -notmatch '^https://[a-zA-Z0-9-]+\.trycloudflare\.com/?$') {
        return $false
    }

    $statusCode = Get-HttpStatus ($origin.TrimEnd('/') + '/up') 20
    return $statusCode -ge 200 -and $statusCode -lt 400
}

function Publish-PermanentOrigin([string]$Origin) {
    for ($attempt = 0; $attempt -lt 6; $attempt += 1) {
        $parameters = @{
            FilePath = 'php.exe'
            ArgumentList = @('artisan', 'comoda:qr:publish', $Origin)
            WorkingDirectory = $backendDirectory
            WindowStyle = 'Hidden'
            Wait = $true
            PassThru = $true
        }
        $publish = Start-Process @parameters
        if ($publish.ExitCode -eq 0) {
            return $true
        }
        Start-Sleep -Seconds 3
    }

    return $false
}

function Ensure-OnlineConnection {
    $origin = & (Join-Path $PSScriptRoot 'start-comoda-tunnel.ps1') -ProjectRoot $resolvedProjectRoot -BackendPort $BackendPort
    if (-not $origin) {
        throw 'Cloudflare did not return a public connection.'
    }

    $origin = ([string]$origin).Trim()
    # Let the Worker validate the origin. This avoids false failures while a
    # newly-created trycloudflare hostname is still propagating in local DNS.
    if (-not (Publish-PermanentOrigin $origin)) {
        Write-SupervisorLog 'The saved tunnel is no longer accepted by Cloudflare; replacing it.'
        & (Join-Path $PSScriptRoot 'stop-comoda-tunnel.ps1') -ProjectRoot $resolvedProjectRoot
        $origin = & (Join-Path $PSScriptRoot 'start-comoda-tunnel.ps1') -ProjectRoot $resolvedProjectRoot -BackendPort $BackendPort
        if (-not $origin) {
            throw 'Cloudflare did not return a public connection.'
        }
        $origin = ([string]$origin).Trim()
        if (-not (Publish-PermanentOrigin $origin)) {
            throw 'The new tunnel could not be published to the permanent QR address.'
        }
    }

    Write-SupervisorLog 'The permanent QR address is connected.'
}

try {
    Ensure-MySql
    Invoke-Migrations
    Ensure-Backend
    Ensure-Frontend
    $tunnelRetryCount = 0
    $nextTunnelRetryAt = [DateTime]::UtcNow
    if ($Mode -eq 'online') {
        try {
            Ensure-OnlineConnection
        } catch {
            $tunnelRetryCount = 1
            $nextTunnelRetryAt = [DateTime]::UtcNow.AddSeconds(60)
            Write-SupervisorLog ("Internet startup is waiting for Cloudflare; retrying in 60 seconds. " + $_.Exception.Message)
        }
    }

    Write-SupervisorLog 'Comoda startup completed.'
    if ($NoMonitor) {
        exit 0
    }

    Write-SupervisorHeartbeat
    $tunnelFailureCount = 0
    while ($true) {
        Start-Sleep -Seconds 5
        try {
            Ensure-Backend
            Ensure-Frontend
            if ($Mode -eq 'online') {
                $tunnelPidPath = Join-Path $runtimeDirectory 'cloudflared.pid'
                $tunnelAlive = $false
                if (Test-Path -LiteralPath $tunnelPidPath -PathType Leaf) {
                    $savedTunnelPid = 0
                    if ([int]::TryParse((Get-Content -LiteralPath $tunnelPidPath -Raw).Trim(), [ref]$savedTunnelPid)) {
                        $tunnelProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$savedTunnelPid" -ErrorAction SilentlyContinue
                        $tunnelAlive = $null -ne $tunnelProcess -and $tunnelProcess.Name -eq 'cloudflared.exe'
                    }
                }
                $tunnelProcessAlive = $tunnelAlive
                if ($tunnelAlive) {
                    $tunnelFailureCount = 0
                    $tunnelRetryCount = 0
                    $nextTunnelRetryAt = [DateTime]::UtcNow
                } elseif (-not $tunnelProcessAlive) {
                    $tunnelFailureCount = 3
                } else {
                    $tunnelFailureCount += 1
                    Write-SupervisorLog "Internet health check failed ($tunnelFailureCount/3); waiting before reconnecting."
                }
                if ($tunnelFailureCount -ge 3) {
                    if ($tunnelProcessAlive) {
                        Write-SupervisorLog 'Internet connection stopped; preparing to reconnect.'
                        & (Join-Path $PSScriptRoot 'stop-comoda-tunnel.ps1') -ProjectRoot $resolvedProjectRoot
                        $nextTunnelRetryAt = [DateTime]::UtcNow
                    }

                    if ([DateTime]::UtcNow -ge $nextTunnelRetryAt) {
                        try {
                            Write-SupervisorLog 'Reconnecting the permanent QR address.'
                            Ensure-OnlineConnection
                            $tunnelFailureCount = 0
                            $tunnelRetryCount = 0
                            $nextTunnelRetryAt = [DateTime]::UtcNow
                        } catch {
                            $tunnelRetryCount += 1
                            $exponent = [Math]::Min($tunnelRetryCount - 1, 4)
                            $retryDelaySeconds = [int][Math]::Min(900, 60 * [Math]::Pow(2, $exponent))
                            $nextTunnelRetryAt = [DateTime]::UtcNow.AddSeconds($retryDelaySeconds)
                            Write-SupervisorLog ("Internet reconnect failed; retrying in $retryDelaySeconds seconds. " + $_.Exception.Message)
                        }
                    }
                }
            }
        } catch {
            Write-SupervisorLog ("Recovery attempt failed: " + $_.Exception.Message)
        }
        Write-SupervisorHeartbeat
    }
} catch {
    Write-SupervisorLog ("Startup failed: " + $_.Exception.Message)
    exit 1
} finally {
    if (Test-Path -LiteralPath $heartbeatPath -PathType Leaf) {
        Remove-Item -LiteralPath $heartbeatPath -Force -ErrorAction SilentlyContinue
    }
    if ($null -ne $supervisorMutex) {
        $supervisorMutex.ReleaseMutex()
        $supervisorMutex.Dispose()
    }
}
