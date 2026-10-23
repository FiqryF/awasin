$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$backendPath = Join-Path $projectRoot 'backend'
$frontendPath = Join-Path $projectRoot 'frontend'
$pythonPath = Join-Path $backendPath '.venv\Scripts\python.exe'
if (!(Test-Path -LiteralPath $pythonPath)) { throw 'Backend belum disiapkan. Ikuti backend/README.md untuk membuat .venv dan menginstal dependensi.' }
if (!(Test-Path -LiteralPath (Join-Path $frontendPath 'node_modules'))) { throw 'Jalankan npm.cmd ci dari folder frontend terlebih dahulu.' }

function Test-AwasinUrl([string]$Url, [string]$Expected) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
        return $response.StatusCode -eq 200 -and $response.Content.Contains($Expected)
    } catch { return $false }
}

# Reuse healthy instances. Never terminate processes owned by another terminal.
if (!(Test-AwasinUrl 'http://127.0.0.1:8000/health' 'awasin-backend')) {
    if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 8000 dipakai layanan lain atau backend tidak sehat. Periksa backend/server.err.log.' }
    Start-Process -FilePath $pythonPath -ArgumentList '-m','app' -WorkingDirectory $backendPath -RedirectStandardOutput (Join-Path $backendPath 'server.out.log') -RedirectStandardError (Join-Path $backendPath 'server.err.log') -WindowStyle Hidden
}
if (!(Test-AwasinUrl 'http://localhost:5173' 'AWASIN')) {
    if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 5173 dipakai layanan lain atau frontend tidak sehat. Periksa frontend/server.err.log.' }
    Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\cmd.exe') -ArgumentList '/d','/c','npm.cmd run dev -- --host localhost --port 5173 --strictPort' -WorkingDirectory $frontendPath -RedirectStandardOutput (Join-Path $frontendPath 'server.out.log') -RedirectStandardError (Join-Path $frontendPath 'server.err.log') -WindowStyle Hidden
}
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if ((Test-AwasinUrl 'http://127.0.0.1:8000/health' 'awasin-backend') -and (Test-AwasinUrl 'http://localhost:5173' 'AWASIN')) {
        Write-Output 'AWASIN siap: http://localhost:5173 (frontend dan backend berjalan di latar belakang).'
        exit 0
    }
    Start-Sleep -Seconds 1
}
throw 'Server belum siap. Periksa backend/server.err.log dan frontend/server.err.log; jangan reset password.'
