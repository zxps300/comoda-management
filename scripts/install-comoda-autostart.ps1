param(
    [string]$TaskName = 'Comoda Restaurant Online'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$supervisorPath = Join-Path $resolvedProjectRoot 'scripts\comoda-supervisor.ps1'
if (-not (Test-Path -LiteralPath $supervisorPath -PathType Leaf)) {
    throw "Supervisor not found at $supervisorPath"
}

$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$supervisorPath`" -Mode online"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $resolvedProjectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settingsParameters = @{
    AllowStartIfOnBatteries = $true
    DontStopIfGoingOnBatteries = $true
    StartWhenAvailable = $true
    MultipleInstances = 'IgnoreNew'
    RestartCount = 99
    RestartInterval = (New-TimeSpan -Minutes 1)
    ExecutionTimeLimit = [TimeSpan]::Zero
}
$settings = New-ScheduledTaskSettingsSet @settingsParameters
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$registerParameters = @{
    TaskName = $TaskName
    Action = $action
    Trigger = $trigger
    Settings = $settings
    Principal = $principal
    Description = 'Starts Comoda, MySQL, and permanent QR internet access after Windows sign-in.'
    Force = $true
}
Register-ScheduledTask @registerParameters | Out-Null

Write-Output "Automatic startup enabled: $TaskName"
