param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$cloudflaredPath = Join-Path $resolvedProjectRoot 'tools\cloudflared.exe'
$runtimeDirectory = Join-Path $resolvedProjectRoot 'runtime'
$pidPath = Join-Path $runtimeDirectory 'cloudflared.pid'

if (Test-Path -LiteralPath $pidPath -PathType Leaf) {
    $savedPid = 0
    if ([int]::TryParse((Get-Content -LiteralPath $pidPath -Raw).Trim(), [ref]$savedPid)) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$savedPid" -ErrorAction SilentlyContinue
        $isOwned = $null -ne $process -and $process.Name -eq 'cloudflared.exe'
        if ($isOwned -and $process.ExecutablePath) {
            $isOwned = $process.ExecutablePath.Equals($cloudflaredPath, [StringComparison]::OrdinalIgnoreCase)
        }
        if ($isOwned) {
            Stop-Process -Id $savedPid -Force
        }
    }
}

foreach ($stateName in @('cloudflared.pid', 'cloudflare_url.txt')) {
    $statePath = Join-Path $runtimeDirectory $stateName
    if (Test-Path -LiteralPath $statePath) {
        Remove-Item -LiteralPath $statePath -Force
    }
}
