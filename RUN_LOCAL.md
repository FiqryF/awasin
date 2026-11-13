# Menjalankan AWASIN di Windows PowerShell

Pemeriksaan 12 November 2026:

- Python 3.13.2 dan Node.js 22.13.0 tersedia; dependency frontend lengkap (`npm.cmd ls --depth=0`).
- `python-multipart` 0.0.33 sudah tersedia; error startup terbaru berasal dari `protobuf` yang belum terpasang.
- Instalasi ulang `.[dev]` memasang Protobuf 7.36.2 dan Pillow 13.0.0; `pip check` lulus.
- Skrip startup berhasil dijalankan dan dijalankan ulang untuk memakai layanan sehat.
- Frontend, modul Vite `/src/main.tsx`, API `/health`, dan `/docs` merespons HTTP 200.
- 41 tes foundation/Safe Browsing serta dua simulasi kegagalan proses startup lulus.
- Log frontend masih memuat konflik port dari percobaan duplikat; server yang sudah ada merespons dengan benar. Log bukan pemeriksaan status terkini.
- Password, `.env`, dan konfigurasi Supabase tidak diubah. Login serta provider AI belum diuji.

Prasyarat: Python 3.12+ dan Node.js ^22.13.0 atau >=24. Internet diperlukan
untuk mengunduh dependency dan memakai layanan eksternal.

## Persiapan dependency

```powershell
Set-Location 'C:\Users\FIQRY FIRMANSYAH\Documents\awasin'
Set-Location backend
if (!(Test-Path .venv\Scripts\python.exe)) { py -3.13 -m venv .venv }
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
if ($LASTEXITCODE -ne 0) { throw 'Instalasi backend gagal; periksa output pip.' }
.\.venv\Scripts\python.exe -m pip check
Set-Location ..\frontend
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Instalasi frontend gagal; periksa output npm.' }
Set-Location ..
```

Gunakan `py -3.12` jika hanya Python 3.12 tersedia. Pakai interpreter `.venv`
secara langsung agar dependency tidak terpasang ke Python yang berbeda.
Pertahankan file `.env` yang sudah ada dan konfigurasi Supabase.

## Menyalakan dan memeriksa

```powershell
Set-Location 'C:\Users\FIQRY FIRMANSYAH\Documents\awasin'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-dev.ps1
Invoke-RestMethod http://127.0.0.1:8000/health
```

Execution policy tersebut berlaku untuk proses PowerShell ini saja.
Buka frontend di http://localhost:5173 dan API docs di http://127.0.0.1:8000/docs.
Health yang berhasil berisi `status: ok` dan `service: awasin-backend`.
Health tidak memeriksa koneksi Supabase atau provider AI.
Skrip memakai ulang layanan sehat dan menjalankan layanan baru di latar belakang.
Menutup terminal pemanggil bukan perintah untuk menghentikan server.

## Jika startup gagal

```powershell
Get-Content .\backend\server.err.log -Tail 60
Get-Content .\backend\server.out.log -Tail 40
Get-Content .\frontend\server.err.log -Tail 60
Get-Content .\frontend\server.out.log -Tail 40
```

`No module named 'python_multipart'` menunjukkan paket `python-multipart` belum
tersedia di interpreter backend. `No module named 'google'` pada import
`google.protobuf` menunjukkan paket `protobuf` belum tersedia. Keduanya sudah
terdaftar di `backend/pyproject.toml`; ulangi instalasi editable di atas untuk
menyinkronkan seluruh dependency. Jangan memasang paket bernama `google`.

`Server belum siap` adalah batas tunggu readiness, bukan penyebab utama.
Periksa error import, kegagalan instalasi, dan konflik port di log.
Skrip kini melaporkan langsung jika proses yang baru dijalankan berhenti.
Jika port dipakai aplikasi lain, hentikan melalui terminal pemiliknya atau
Task Manager setelah memastikan prosesnya; skrip tidak mematikan proses lain.

Untuk melihat error langsung dan menghentikan server dengan Ctrl+C, jalankan
di dua terminal terpisah setelah memastikan port tersedia:

```powershell
# Terminal 1
Set-Location 'C:\Users\FIQRY FIRMANSYAH\Documents\awasin\backend'
.\.venv\Scripts\python.exe -m app
```

```powershell
# Terminal 2
Set-Location 'C:\Users\FIQRY FIRMANSYAH\Documents\awasin\frontend'
npm.cmd run dev -- --host localhost --port 5173 --strictPort
```
