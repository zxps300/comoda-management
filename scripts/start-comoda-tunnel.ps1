param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,

    [Parameter(Mandatory = $true)]
    [ValidateRange(1, 65535)]
    [int]$BackendPort
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$cloudflaredPath = Join-Path $resolvedProjectRoot 'tools\cloudflared.exe'
$runtimeDirectory = Join-Path $resolvedProjectRoot 'runtime'
$pidPath = Join-Path $runtimeDirectory 'cloudflared.pid'
$urlPath = Join-Path $runtimeDirectory 'cloudflare_url.txt'
$logPath = Join-Path $runtimeDirectory 'cloudflared.log'
$stdoutPath = Join-Path $runtimeDirectory 'cloudflared.stdout.log'
$stderrPath = Join-Path $runtimeDirectory 'cloudflared.stderr.log'

if (-not (Test-Path -LiteralPath $cloudflaredPath -PathType Leaf)) {
    throw "cloudflared is not installed at $cloudflaredPath"
}

New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null

function Get-OwnedTunnelProcess {
    if (-not (Test-Path -LiteralPath $pidPath -PathType Leaf)) {
        return $null
    }

    $savedPid = 0
    if (-not [int]::TryParse((Get-Content -LiteralPath $pidPath -Raw).Trim(), [ref]$savedPid)) {
        return $null
    }

    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$savedPid" -ErrorAction SilentlyContinue
    if ($null -eq $process -or $process.Name -ne 'cloudflared.exe') {
        return $null
    }

    if ($process.ExecutablePath -and -not $process.ExecutablePath.Equals($cloudflaredPath, [StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }

    return $process
}

function Find-TunnelUrl {
    $combined = ''
    foreach ($candidatePath in @($logPath, $stdoutPath, $stderrPath)) {
        if (Test-Path -LiteralPath $candidatePath -PathType Leaf) {
            $combined += "`n" + (Get-Content -LiteralPath $candidatePath -Raw -ErrorAction SilentlyContinue)
        }
    }

    $match = [regex]::Match($combined, 'https://(?!api\.)[a-zA-Z0-9-]+\.trycloudflare\.com')
    if ($match.Success) {
        return $match.Value.ToLowerInvariant()
    }

    return $null
}

$existingProcess = Get-OwnedTunnelProcess
if ($null -ne $existingProcess) {
    $existingUrl = Find-TunnelUrl
    if ($existingUrl) {
        $temporaryUrlPath = $urlPath + '.tmp'
        [IO.File]::WriteAllText($temporaryUrlPath, $existingUrl)
        Move-Item -LiteralPath $temporaryUrlPath -Destination $urlPath -Force
        # Emit through PowerShell's success stream so callers can capture the
        # URL even when this script runs in a hidden Scheduled Task.
        Write-Output $existingUrl
        return
    }
}

$backendHealthy = $false
for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    $healthStatus = & curl.exe --silent --show-error --output NUL --write-out '%{http_code}' --max-time 2 "http://127.0.0.1:$BackendPort/up" 2>$null
    if ($LASTEXITCODE -eq 0 -and $healthStatus -match '^\d{3}$' -and [int]$healthStatus -ge 200 -and [int]$healthStatus -lt 400) {
        $backendHealthy = $true
        break
    }
    Start-Sleep -Milliseconds 500
}

if (-not $backendHealthy) {
    throw "The Comoda backend is not responding on port $BackendPort."
}

foreach ($stalePath in @($pidPath, $urlPath, $logPath, $stdoutPath, $stderrPath)) {
    if (Test-Path -LiteralPath $stalePath) {
        Remove-Item -LiteralPath $stalePath -Force
    }
}

$quotedLogPath = '"' + $logPath + '"'
$tunnelArguments = @(
    'tunnel',
    '--protocol', 'http2',
    '--url', "http://127.0.0.1:$BackendPort",
    '--loglevel', 'info',
    '--logfile', $quotedLogPath
)

$startParameters = @{
    FilePath = $cloudflaredPath
    ArgumentList = $tunnelArguments
    WindowStyle = 'Hidden'
    PassThru = $true
    RedirectStandardOutput = $stdoutPath
    RedirectStandardError = $stderrPath
}
$tunnelProcess = Start-Process @startParameters

[IO.File]::WriteAllText($pidPath, [string]$tunnelProcess.Id)

for ($attempt = 0; $attempt -lt 90; $attempt += 1) {
    if ($tunnelProcess.HasExited) {
        throw "cloudflared exited before creating a public address. Check $logPath"
    }

    $publicUrl = Find-TunnelUrl
    if ($publicUrl) {
        $temporaryUrlPath = $urlPath + '.tmp'
        [IO.File]::WriteAllText($temporaryUrlPath, $publicUrl)
        Move-Item -LiteralPath $temporaryUrlPath -Destination $urlPath -Force
        Write-Output $publicUrl
        return
    }

    Start-Sleep -Milliseconds 500
}

if (-not $tunnelProcess.HasExited) {
    Stop-Process -Id $tunnelProcess.Id -Force
}
Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
throw "Timed out while waiting for Cloudflare to create a public address. Check $logPath"
