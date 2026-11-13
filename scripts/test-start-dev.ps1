# Run: powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-start-dev.ps1
# Simulate failed child processes without launching or stopping real servers.
$ErrorActionPreference = 'Stop'
function Test-Path { return $true }
function Invoke-WebRequest { throw 'Simulated unavailable service' }
function Get-NetTCPConnection { return $null }
function Start-Process {
    param($WorkingDirectory)
    return [pscustomobject]@{ HasExited = ($WorkingDirectory -like "*\$failedService") }
}
function Start-Sleep { throw 'Failure was not detected immediately' }

foreach ($failedService in @('backend', 'frontend')) {
    $expected = if ($failedService -eq 'backend') { 'Backend berhenti.*' } else { 'Frontend berhenti.*' }
    $message = ''
    try { & (Join-Path $PSScriptRoot '..\start-dev.ps1') }
    catch { $message = $_.Exception.Message }
    if ($message -notlike $expected) { throw "Unexpected result for ${failedService}: $message" }
    Write-Output "PASS: $failedService failure detected immediately"
}
