param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$workerDirectory = Join-Path $resolvedProjectRoot 'cloudflare\qr-router'
$backendDirectory = Join-Path $resolvedProjectRoot 'backend'
$templatePath = Join-Path $workerDirectory 'wrangler.template.jsonc'
$configPath = Join-Path $workerDirectory 'wrangler.jsonc'
$temporarySecretsPath = Join-Path ([IO.Path]::GetTempPath()) ("comoda-worker-secrets-{0}.json" -f [Guid]::NewGuid())

if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
    throw "Worker template not found at $templatePath"
}

Push-Location $workerDirectory
try {
    if (-not (Test-Path -LiteralPath (Join-Path $workerDirectory 'node_modules\wrangler\bin\wrangler.js') -PathType Leaf)) {
        npm install
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not install the Cloudflare deployment tool.'
        }
    }

    $whoAmI = npx wrangler whoami 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0 -or $whoAmI -match 'not authenticated') {
        throw 'Cloudflare sign-in is required. Run npx wrangler login in cloudflare\qr-router, then run this setup again.'
    }

    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
        Copy-Item -LiteralPath $templatePath -Destination $configPath
    }

    $configText = Get-Content -LiteralPath $configPath -Raw
    if ($configText -notmatch '"binding"\s*:\s*"ROUTES"') {
        npx wrangler kv namespace create COMODA_QR_ROUTES --binding ROUTES --update-config --config $configPath
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not create the QR routing storage.'
        }
    }

    Push-Location $backendDirectory
    try {
        $tableSecret = (& php artisan comoda:qr:configure --show-table-secret).Trim()
        $updateToken = (& php artisan comoda:qr:configure --show-update-token).Trim()
    } finally {
        Pop-Location
    }

    if ($tableSecret -notmatch '^[A-Za-z0-9_-]{43}$' -or $updateToken -notmatch '^[A-Za-z0-9_-]{43}$') {
        throw 'Could not create the private QR configuration.'
    }

    $secretPayload = [ordered]@{
        TABLE_LINK_SECRET = $tableSecret
        UPDATE_TOKEN = $updateToken
    } | ConvertTo-Json -Compress
    [IO.File]::WriteAllText($temporarySecretsPath, $secretPayload)

    $deployOutput = npx wrangler deploy --config $configPath --secrets-file $temporarySecretsPath 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        $deployError = $deployOutput.Trim()
        if ($deployError -eq '') {
            $deployError = 'Cloudflare Worker deployment failed.'
        }
        throw $deployError
    }

    $urlMatch = [regex]::Match($deployOutput, 'https://[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+\.workers\.dev')
    if (-not $urlMatch.Success) {
        throw 'The Worker was deployed, but its permanent workers.dev address was not detected.'
    }

    $workerUrl = $urlMatch.Value.ToLowerInvariant()
    Push-Location $backendDirectory
    try {
        & php artisan comoda:qr:configure "--base-url=$workerUrl"
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not save the permanent QR address in Comoda.'
        }

        $currentOriginPath = Join-Path $resolvedProjectRoot 'runtime\cloudflare_url.txt'
        if (Test-Path -LiteralPath $currentOriginPath -PathType Leaf) {
            $currentOrigin = (Get-Content -LiteralPath $currentOriginPath -Raw).Trim()
            & php artisan comoda:qr:publish $currentOrigin
        }
    } finally {
        Pop-Location
    }

    Write-Output "Permanent QR ready: $workerUrl"
} finally {
    if (Test-Path -LiteralPath $temporarySecretsPath) {
        Remove-Item -LiteralPath $temporarySecretsPath -Force
    }
    Pop-Location
}
