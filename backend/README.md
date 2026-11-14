# AWASIN Backend — Foundation & Identity

## Status implementasi Phase 1–4

Lihat [laporan progres lengkap](../AWASIN_PROGRESS_PHASE_1_4.md) untuk status,
endpoint, migrasi, keamanan dan hasil pengujian terkini. Konfigurasi identitas/admin
yang sudah ada dipertahankan; role admin tetap diverifikasi dari database tanpa
menambahkan syarat MFA baru. API kini meliputi profil, preferensi, riwayat, ekspor
dan penerimaan Feedback. CORS mengizinkan GET/PATCH/POST/DELETE dari origin terdaftar.
Migrasi 002–004 diuji di PostgreSQL lokal; penerapan serta pengujian integrasi ke
Supabase aktif belum dilakukan dalam rangkaian phase ini. Health tetap publik
tanpa konfigurasi Supabase. Dokumen fondasi di bawah sebagian bersifat historis.

Fondasi API proses AWASIN. Implementasi ini menyediakan konfigurasi, routing,
health check, dokumentasi OpenAPI, CORS, logging, dan penanganan error.
Engine analisis keamanan belum tersedia. Operasi data memerlukan konfigurasi
Supabase serta migrasi yang sesuai dan tidak menghasilkan sukses palsu bila gagal.

## Riwayat Link Inspector

Dengan migrasi `scan_reports` yang sudah terpasang, atur `SUPABASE_HISTORY_SECRET_KEY`
ke secret key `sb_secret_…` dari proyek Supabase yang sama, hanya pada environment backend.
Muat ulang backend setelah mengaturnya. Ringkasan dan domain terdaftar disimpan
untuk akun yang masuk jika pengaturan penyimpanan aktif. Pembacaan dan penghapusan
riwayat tetap memakai sesi pengguna. Jika kunci belum tersedia atau penulisan gagal,
Link Inspector tetap menampilkan hasil dan status penyimpanan.

## Teknologi dan struktur

### Message Analyzer

Endpoint teks tetap `POST /api/v1/analysis` dengan `mode: "message"`. Untuk screenshot JPG, PNG, atau WebP, kirim multipart ke `POST /api/v1/analysis/media/message`. Batas pesan 10.000 karakter, unggahan 10 MB, dan gambar 20 megapiksel. OCR berjalan lokal di backend dengan satu proses OCR aktif per worker. Hasil OCR yang sudah disaring bisa dikoreksi di mode teks.

- Pasang dependency Python dengan `python -m pip install -e ".[dev]"`.
- Windows: pasang Tesseract 5 dari distribusi yang ditautkan dalam [panduan Tesseract](https://tesseract-ocr.github.io/tessdoc/Installation.html), lalu pastikan `eng.traineddata` dan `ind.traineddata` tersedia. `TESSERACT_CMD` menerima path ke executable, dan `TESSERACT_DATA_DIR` menerima path folder model jika berada di luar lokasi default. Periksa dengan `tesseract --list-langs` atau jalankan executable secara langsung.
- Debian/Ubuntu: instal `tesseract-ocr tesseract-ocr-eng tesseract-ocr-ind` melalui package manager. Repo belum punya manifest deployment backend. Tambahkan binary dan kedua model ke image atau runtime hosting. Tanpa keduanya, API teks tetap tersedia dan OCR mengembalikan status terkontrol.
- Mistral menerima teks yang disaring hanya setelah `message_ai_consent`. Penyaringan tidak menjamin seluruh data pribadi terhapus. Google hanya memeriksa hingga tiga URL publik yang berbeda setelah `message_link_consent`. URL dengan query, path sensitif, atau pembacaan OCR ambigu tidak diteruskan.
- Riwayat memerlukan `history_consent`, akun aktif, penyimpanan yang diizinkan, dan konfigurasi Supabase backend yang sama dengan Link Inspector. Riwayat hanya menyimpan ringkasan dan risiko.

Python **3.12+**, FastAPI/Pydantic, Pydantic Settings, Uvicorn, pytest dan HTTPX.
Dependency dikelola melalui `pyproject.toml`; instalasi editable memasang metadata
versi aplikasi yang juga digunakan oleh OpenAPI dan health response.

```text
backend/
├── app/
│   ├── __init__.py
│   ├── __main__.py             # CLI Uvicorn menggunakan HOST/PORT
│   ├── main.py                 # Application factory dan middleware
│   ├── api/v1/router.py        # Komposisi router API versi satu
│   ├── core/
│   │   ├── config.py           # Settings dan validasi environment
│   │   ├── exceptions.py       # Kontrak error JSON
│   │   └── logging.py          # Logging terpusat tanpa body/nilai error
│   └── modules/health/
│       ├── router.py
│       └── schemas.py
├── tests/
│   ├── conftest.py
│   └── test_foundation.py
├── .env.example
├── .gitignore
└── pyproject.toml
```

Modular monolith dengan batas HTTP, konfigurasi operasional, dan modul health.
Lifespan kini mengelola HTTP client Supabase dan pembatas permintaan Feedback.
Modul identity, history dan feedback melengkapi fondasi health di atas. Struktur
diagram tersebut mencatat tahap awal; lihat laporan progres untuk komponen terkini.

## Setup Windows (PowerShell)

Dari root repository:

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade "pip>=26.2,<27"
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
if (!(Test-Path .env)) { Copy-Item .env.example .env }
.\.venv\Scripts\python.exe -m app
```

Gunakan `py -3.12` jika Python 3.12 yang terpasang. Aktivasi virtual environment
tidak wajib; perintah di atas tidak memerlukan perubahan execution policy.
Untuk proyek yang sudah memiliki `.venv`, lewati pembuatannya dan jalankan kembali
`.\.venv\Scripts\python.exe -m pip install -e ".[dev]"` setelah dependency berubah.
Panduan menjalankan kedua layanan dan membaca error: [RUN_LOCAL.md](../RUN_LOCAL.md).

## Setup Ubuntu (Bash)

Pastikan Python 3.12+ serta modul `venv` tersedia melalui pengelola sistem Anda.
Dari root repository:

```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade 'pip>=26.2,<27'
.venv/bin/python -m pip install -e '.[dev]'
cp .env.example .env
.venv/bin/python -m app
```

Semua perintah server dan test dijalankan dari `backend/`. Tidak diperlukan
Supabase URL, database password, JWT secret, atau service-role key.

## Environment

`.env` bersifat opsional untuk default development. Pydantic Settings membaca
environment proses sebelum `.env`; jangan commit `.env`. Jangan meletakkan
rahasia backend dalam variabel frontend `VITE_*`.

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `APP_NAME` | `AWASIN API` | Judul OpenAPI |
| `APP_ENV` | `development` | `development`, `test`, `staging`, `production` |
| `APP_DEBUG` | `false` | Hanya diizinkan pada development/test; tidak membuka traceback HTTP |
| `API_V1_PREFIX` | `/api/v1` | Path prefix tanpa trailing slash |
| `HOST` | `127.0.0.1` | Bind address untuk `python -m app` |
| `PORT` | `8000` | Port 1–65535 |
| `CORS_ORIGINS` | dua origin lokal port 5173 | Daftar HTTP(S) origin dipisahkan koma |
| `LOG_LEVEL` | `INFO` | DEBUG/INFO/WARNING/ERROR/CRITICAL |

Port 5173 mengikuti development frontend Vite yang didokumentasikan. Jika Vite
memilih port lain karena bentrok, sesuaikan daftar origin secara eksplisit.
Origin tidak boleh wildcard, memiliki kredensial, path, query atau fragment.
Trailing slash/default port dinormalisasi dan duplikasi dihapus. Daftar Python
kosong dapat digunakan saat menyusun Settings untuk menolak semua origin.

Production/staging harus menetapkan `APP_ENV` secara eksplisit, `APP_DEBUG=false`,
dan origin deployment yang sesuai. `/docs`, `/redoc` dan `/openapi.json` otomatis
nonaktif pada kedua environment tersebut. Kesalahan konfigurasi menolak startup.

## Endpoint Phase 1

| Method | Path | Fungsi |
| --- | --- | --- |
| GET | `/health` | Liveness proses, untuk probe tanpa prefix versi |
| GET | `/api/v1/health` | Liveness yang sama dalam router versi satu |
| GET | `/docs` | Swagger UI, development/test |
| GET | `/redoc` | ReDoc, development/test |
| GET | `/openapi.json` | Schema OpenAPI, development/test |

Kedua health path menggunakan router/handler dan schema yang sama. Health hanya
menunjukkan proses merespons, **bukan** kesehatan database, provider, atau seluruh
fitur AWASIN. Prefix versi dapat dikonfigurasi tanpa mengubah `/health`.

```json
{"status":"ok","service":"awasin-backend","version":"0.1.0"}
```

Versi berasal dari metadata `pyproject.toml` yang diinstal, tanpa duplikasi konstanta.
Buka `http://127.0.0.1:8000/docs` setelah server berjalan. Halaman dokumentasi
bawaan FastAPI memuat aset UI dari CDN; health, OpenAPI JSON dan automated tests
tidak memerlukan layanan eksternal.

## Error dan logging

HTTP error (termasuk 404/405), validasi 422, dan exception 500 memiliki bentuk:

```json
{"error":{"code":"internal_error","message":"Internal server error"}}
```

Pesan HTTP berasal dari status standar; detail exception dan input yang ditolak
tidak dikembalikan. Header HTTP relevan tetap dipertahankan. Error response
500 juga melewati CORS. Respons penolakan preflight CORS dikelola middleware
Starlette dan bukan kontrak JSON endpoint.

Logger `awasin` memakai timestamp, level, nama logger, dan pesan. Error tak
terduga mencatat jenis exception serta nama fungsi/nomor baris, tanpa exception
message, local variables, request body, query string atau token. Access log
Uvicorn dimatikan oleh CLI bawaan untuk menghindari pencatatan URL sensitif.
Formatter `uvicorn.error` juga menyamarkan detail exception yang diteruskan ASGI.
Jika menjalankan Uvicorn langsung, gunakan `--no-access-log`:

```text
python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 --no-access-log
```

Log level diambil dari `LOG_LEVEL`; `APP_DEBUG` tidak pernah mengaktifkan halaman
traceback. Log platform/hosting di luar proses ini perlu diatur terpisah.

## Automated tests

Windows:

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m pip check
```

Ubuntu:

```bash
.venv/bin/python -m pytest
.venv/bin/python -m pip check
```

Test menggunakan ASGI TestClient, tanpa koneksi database/provider. Cakupan:
inisialisasi, kedua health path/schema/versi, OpenAPI development, dokumentasi
production nonaktif, konfigurasi environment/prefix/origin, CORS allowed/denied,
validasi 422, HTTP 401/404/405, error 500 dan CORS-nya, redaksi log, serta startup
tanpa environment Supabase/database/JWT. Route pemicu error hanya dipasang di test.
Pada kombinasi Starlette 1.9.0 dan HTTPX 0.28.1 yang diuji, TestClient memberi
peringatan deprecation agar beralih ke HTTPX2. Test tetap lulus; tidak ditambahkan
dependency baru hanya untuk menghilangkan peringatan ini.

## VirusTotal AI untuk Link Inspector

Set `VTAI_AGENT_TOKEN` sebagai secret di environment backend. Pada development,
AWASIN juga dapat membaca token yang sudah ada di `~/.config/vtai/token`.
Gunakan `VTAI_ENABLED=false` untuk menonaktifkan lookup.

Dengan persetujuan pemeriksaan tambahan, backend mencari laporan historis untuk
URL publik yang lolos penyaringan privasi. Hasil termasuk cakupan mesin, tanggal,
dan statistik yang diteruskan sebagai bukti ke analis. AWASIN membaca laporan
yang tersedia melalui endpoint lookup. URL dengan query atau path sensitif dilewati.

## Batasan dan tahap berikutnya

- CORS mengizinkan GET/PATCH/POST/DELETE dan Authorization untuk origin terdaftar,
  tanpa cookie credentials. CORS bukan pengganti autentikasi atau pembatas client non-browser.
- JWT, identitas/role, ownership, preferensi, riwayat dan Feedback sudah diimplementasikan.
  Upload ke server, storage media dan engine scan belum ada; tidak ada hasil buatan.
  Pembatas Feedback per worker dan kuota RPC tersedia, tetapi deployment multiworker
  memerlukan strategi pembatas terdistribusi/trusted gateway yang sesuai.
- Tidak ada konfigurasi deployment, TLS termination atau database readiness probe.
- Dependency memiliki batas versi di pyproject; belum ada lockfile Python lintas
  platform. Instalasi baru dapat memilih patch/minor yang berbeda.
- Frontend menggunakan kontrak API akun, history dan Feedback. Penerapan migrasi
  002–004 serta verifikasi dua akun pada Supabase aktif masih perlu dilakukan.
- Retensi Feedback, prosedur penghapusan akun dan keamanan upload/engine perlu
  diputuskan sebelum fitur terkait diaktifkan untuk produksi. Jangan memasukkan
  service-role key ke browser. Phase 4 tidak mengubah konfigurasi Supabase aktif.
