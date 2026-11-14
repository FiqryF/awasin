# AWASIN

AWASIN adalah aplikasi web keamanan digital yang membantu pengguna menilai tautan, pesan, dan QR Code sebelum membukanya atau mengikuti instruksi di dalamnya. AWASIN menggabungkan pemeriksaan struktur, sumber reputasi, dan analisis AI untuk menunjukkan tingkat risiko, alasan, serta tindakan yang bisa diambil. Pemeriksaan dasar tersedia untuk tamu. Akun diperlukan untuk melihat riwayat pribadi dan menerima balasan atas feedback.

## Fitur utama

| Fitur | Masukan | Hasil |
| --- | --- | --- |
| Link & Website Inspector | URL HTTP(S) atau domain | Tingkat risiko, indikator, status sumber reputasi, dan saran tindakan |
| Message Analyzer | Teks pesan atau screenshot | Tingkat risiko, temuan dari isi pesan, status OCR jika memakai screenshot, hasil pemeriksaan tautan yang ditemukan, dan saran tindakan |
| QR Code Security Scanner | Gambar QR atau kamera | Isi QR. Tautan dapat diperiksa di Link & Website, sedangkan isi non-URL dapat diperiksa formatnya |

### Link & Website Inspector

Tersedia di `/scan/link`. Cocok untuk meninjau tautan dari pesan, iklan, dan unduhan yang sumbernya meragukan.

1. Pengguna memasukkan URL atau domain. Backend memvalidasi dan menormalkan alamat, mengenali domain terdaftar, lalu mencari indikator seperti domain yang mirip merek, karakter penyamaran, path terenkode, parameter redirect, dan ekstensi yang mengarah ke unduhan.
2. Dengan persetujuan pengguna, backend mencari bukti tambahan dari layanan yang aktif. Google Safe Browsing atau Google Web Risk memeriksa kecocokan daftar ancaman. VirusTotal dan urlscan.io menyediakan laporan yang sudah tercatat. DNS dan RDAP memberi konteks resolusi dan registrasi domain. VirusTotal AI (VTAI) dapat menambah temuan dari arsip jika akses tersedia.
3. Untuk tautan unduhan yang memenuhi syarat, AWASIN mencari URL yang sama dalam arsip publik urlscan.io. Jika arsip mencatat SHA-256 untuk file di URL itu, backend mencari laporan **VirusTotal File** berdasarkan hash tersebut. Proses ini memakai metadata yang sudah tercatat dan tidak mengunduh file dari URL yang diuji.
4. Mistral menerima alamat yang sudah disaring dan bukti dari backend. Validator memeriksa format respons serta rujukan bukti. Kecocokan daftar ancaman yang terkonfirmasi membatasi keputusan AI. Nemotron melalui OpenRouter dapat menggantikan Mistral saat penyedia tidak tersedia, terkena limit, kehabisan waktu, atau hasilnya ditolak validator. Jika analisis AI tidak menghasilkan keputusan valid, AWASIN menampilkan hasil pemeriksaan berbasis bukti.
5. Antarmuka menampilkan satu hasil akhir serta detail sumber dan saran. Untuk pengguna yang login dan mengaktifkan penyimpanan, ringkasan dapat masuk ke Riwayat. URL lengkap dengan query dan fragmen tidak disimpan di Riwayat.

**Teknologi** — FastAPI, Pydantic, HTTPX, `idna`, `tldextract` dengan Public Suffix List, data Unicode confusables, Mistral, Nemotron melalui OpenRouter, Google Safe Browsing atau Google Web Risk, VirusTotal, VTAI, urlscan.io, DNS, dan RDAP.

### Message Analyzer

Tersedia di `/scan/message`. Fitur ini menganalisis konteks pesan, misalnya permintaan OTP atau PIN, tekanan waktu, klaim hadiah, dan instruksi transfer atau membuka tautan.

1. Pengguna menempelkan teks atau mengunggah screenshot. Untuk screenshot, backend membaca teks dengan Tesseract dan menampilkan status kualitas OCR. Jika teks tidak terbaca, pengguna dapat mencoba gambar lain atau menempelkan teks.
2. Backend menyaring data sensitif, mengekstrak indikator dan kutipan pendukung, serta mengenali hingga tiga tautan unik. Dengan persetujuan pengguna, tautan yang memenuhi syarat diperiksa melalui pemeriksaan struktur dan reputasi Link & Website. Tautan dari OCR yang kurang jelas atau terpotong diberi status ambigu.
3. Dengan izin AI, Mistral menilai konteks pesan yang sudah disaring beserta indikator, kutipan, dan hasil pemeriksaan tautan yang tersedia. Validator memeriksa struktur respons, rujukan indikator, dan kesesuaian kutipan dengan teks. Nemotron dapat mencoba jalur validasi yang sama jika Mistral gagal dan cadangan aktif.
4. Antarmuka menyajikan ringkasan risiko dan saran. Status OCR, kegagalan AI, dan bukti yang belum cukup ditampilkan sesuai hasil pemeriksaan. Pengguna yang login dapat memilih menyimpan ringkasan pemeriksaan. Teks asli dan screenshot tidak dimasukkan ke Riwayat.

**Teknologi** — FastAPI dan `python-multipart` untuk unggahan, Pillow untuk pengolahan gambar screenshot, Tesseract dengan data bahasa Indonesia (`ind`) dan Inggris (`eng`), `pytesseract`, Pydantic, Mistral, Nemotron melalui OpenRouter, serta pemeriksaan struktur dan reputasi Link & Website.

### QR Code Security Scanner

Tersedia di `/scan/qr`. Pengguna dapat melihat isi QR sebelum membuka tautan atau mengikuti tindakan di dalamnya.

1. Pengguna memilih gambar QR atau menyalakan kamera dan memberikan izin browser. Browser membaca QR di perangkat dan menampilkan isi yang terbaca sebagai teks.
2. Untuk QR berisi URL HTTP(S), pengguna dapat menekan tombol pemeriksaan. URL diteruskan ke alur Link & Website, sehingga tingkat risiko menggunakan bukti dan logika yang sama. Pengguna dapat mengizinkan pemeriksaan lengkap sebelum mengirim.
3. Untuk isi selain URL, pengguna dapat menyetujui pengiriman isi QR untuk klasifikasi format di backend. Jenis yang dikenali antara lain konfigurasi Wi-Fi, kartu kontak, email, nomor telepon, skema non-HTTP, dan teks biasa. Backend memproses isi tersebut sementara dengan aturan format.
4. Hasil format menjelaskan jenis isi dan tindakan yang perlu diperhatikan. Penilaian keamanan URL tersedia pada cabang Link & Website. Kamera dan unggahan QR dipakai untuk membaca kode, dan aplikasi tidak menjalankan tindakan QR secara otomatis.

**Teknologi** — `jsQR` dan Canvas API untuk membaca gambar, MediaDevices API untuk kamera, serta FastAPI dan aturan format Python untuk klasifikasi isi non-URL.

## Fitur pendukung

| Fitur | Fungsi | Teknologi |
| --- | --- | --- |
| Smart Analysis Report | Menampilkan ringkasan risiko dan tindakan yang disarankan. Temuan dan sumber dapat dibuka lewat **Lihat detail**. | React, TypeScript, dan respons analisis FastAPI |
| Scan History | Menyimpan ringkasan pemeriksaan per akun sesuai pilihan penyimpanan. Pengguna dapat mencari, menyaring, membuka detail laporan, dan menghapus riwayat. | FastAPI, Supabase Auth, PostgreSQL, dan Row Level Security (RLS) |
| Scam Education Center | Menyediakan artikel keamanan digital dengan sumber rujukan. Admin dapat membuat, mengedit, memublikasikan, dan mengarsipkan artikel. | React Router, artikel lokal, serta CMS berbasis FastAPI dan PostgreSQL |
| Feedback & False Detection Report | Menerima laporan kesalahan deteksi, bug, saran, dan masukan umum. Admin dapat meninjau dan membalas. Balasan tampil di **Pesan AWASIN** milik pengirim. | React, FastAPI, Supabase Auth, PostgreSQL, dan RLS |
| Penjelasan ringkas dan aksesibilitas | Menampilkan tindakan utama lebih dulu dengan rincian opsional. Pengguna dapat mengikuti preferensi gerakan perangkat atau mengurangi animasi dari pengaturan akun. | Elemen HTML `details`, CSS `prefers-reduced-motion`, dan Motion |
| Privacy & Data Control | Mencakup persetujuan pemeriksaan eksternal, sanitasi masukan, pengaturan penyimpanan, hapus riwayat, dan hapus akun dengan verifikasi ulang kata sandi. | FastAPI, Pydantic, Supabase Auth, PostgreSQL, RLS, dan Supabase Storage |
| Security Source Transparency | Menampilkan sumber yang digunakan beserta statusnya, termasuk kecocokan ancaman, hasil arsip, tidak ada kecocokan, pemeriksaan dilewati, atau layanan tidak tersedia. | Adapter provider Python, model Pydantic, dan rincian hasil di React |
| Akun dan profil | Menyediakan pendaftaran, login, pemulihan kata sandi, pengelolaan profil, dan foto profil. | Supabase Auth, Supabase JS, FastAPI, dan Supabase Storage |
| Pengumuman layanan | Admin menentukan waktu tayang. Pengumuman aktif tampil di beranda dan di kotak pesan akun pengguna. | React, animasi CSS, FastAPI, dan PostgreSQL |
| Panel admin | Mengelola feedback, artikel, dan pengumuman, serta menampilkan daftar pengguna dan grafik laporan kualitas deteksi. Grafik merangkum laporan pengguna dalam 30 hari terakhir. | React Router, FastAPI, peran admin yang diperiksa server, dan fungsi PostgreSQL |

## Tech stack

| Lapisan | Teknologi |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router 7, Tailwind CSS 4, CSS, Motion, dan Lucide |
| Backend | Python 3.12+, FastAPI, Uvicorn, Pydantic Settings, HTTPX, dan PyJWT |
| Data dan autentikasi | Supabase Auth, PostgreSQL, Row Level Security, Supabase Storage, dan migrasi SQL |
| Analisis | Mistral, Nemotron melalui OpenRouter, Tesseract, jsQR, serta integrasi sumber reputasi |
| Pengujian dan pemeriksaan kode | pytest, Vitest, jsdom, PGlite, dan ESLint |

Alur aplikasi secara umum berjalan dari React di browser ke API FastAPI. Backend memakai Supabase untuk fitur akun dan penyimpanan serta menghubungi layanan AI atau reputasi sesuai konfigurasi dan persetujuan. Pembacaan QR dilakukan langsung di browser.

## Menjalankan secara lokal di Windows

### 1. Siapkan repositori dan dependensi

Pasang Git, Python 3.12 atau lebih baru, serta Node.js 22.13+ pada seri 22 atau Node.js 24+ beserta npm. Jika repositori sudah tersedia, buka foldernya dan langsung jalankan langkah pemasangan dependensi.

```powershell
git clone https://github.com/FiqryF/awasin.git
Set-Location awasin
```

Dari root repositori:

```powershell
Set-Location backend
if (!(Test-Path .\.venv\Scripts\python.exe)) { py -3.13 -m venv .venv }
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m pip check

Set-Location ..\frontend
npm.cmd ci
Set-Location ..
```

Gunakan `py -3.12` bila Python 3.12 yang terpasang. Pasang dependensi melalui interpreter `.venv` agar tersedia untuk proses backend.

### 2. Konfigurasikan fitur tambahan sesuai kebutuhan

Halaman publik, analisis struktur URL, dan pembacaan QR lokal dapat dicoba dengan konfigurasi bawaan. Untuk fitur yang membutuhkan konfigurasi, buat file `.env` dari template jika belum ada.

```powershell
if (!(Test-Path .\frontend\.env)) { Copy-Item .\frontend\.env.example .\frontend\.env }
if (!(Test-Path .\backend\.env)) { Copy-Item .\backend\.env.example .\backend\.env }
```

| Jika ingin memakai | Pengaturan |
| --- | --- |
| Login, riwayat, feedback, dan admin | Gunakan satu project Supabase pengembangan untuk frontend dan backend. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` di frontend serta `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY` di backend. Terapkan file SQL dalam [supabase/migrations](supabase/migrations/) secara berurutan. Siapkan peran admin untuk mengakses panel. |
| Penyimpanan ringkasan dari hasil scan dan penghapusan akun | Isi `SUPABASE_HISTORY_SECRET_KEY` khusus di backend dengan Supabase secret key dari project yang sama. |
| Artikel yang dikelola admin muncul di halaman Edukasi | Aktifkan `VITE_EDUCATION_SOURCE=cms` setelah memeriksa bahwa data awal artikel pada project Supabase sudah sesuai. Default memakai artikel lokal. |
| Analisis Mistral | Atur `AWASIN_AI_ENABLED=true` dan isi `MISTRAL_API_KEY` di backend. `MISTRAL_MODEL` dapat diatur sesuai template. |
| Cadangan Nemotron | Aktifkan analisis AI dan atur `AI_THREAT_DETECTOR_ENABLED=true`, `OPENROUTER_API_KEY`, dan `OPENROUTER_DETECTOR_MODEL` di backend. Adapter menerima model gratis dengan akhiran `:free`. |
| Sumber reputasi eksternal | Isi kunci provider yang dipakai. Lihat `GOOGLE_SAFE_BROWSING_API_KEY`, `WEB_RISK_ENABLED`, `WEB_RISK_API_KEY`, `VIRUSTOTAL_API_KEY`, `URLSCAN_API_KEY`, serta `VTAI_ENABLED` dan `VTAI_AGENT_TOKEN` di [template backend](backend/.env.example). Persetujuan pengguna dan kelayakan alamat tetap menentukan pemeriksaan mana yang dijalankan. |
| OCR screenshot pesan | Pasang executable Tesseract OCR dan data bahasa `ind` serta `eng`. Tambahkan Tesseract ke PATH atau isi `TESSERACT_CMD` dengan lokasi executable. Isi `TESSERACT_DATA_DIR` jika data bahasa ada di lokasi khusus. |

Simpan kredensial rahasia di backend. Variabel `VITE_*` dapat dibaca dari browser. Lihat juga [template frontend](frontend/.env.example) untuk pengaturan URL API dan sumber edukasi.

### 3. Nyalakan aplikasi

Dari root repositori:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-dev.ps1
```

Skrip menjalankan kedua layanan di latar belakang dan memakai ulang proses yang sudah sehat. Setelah pesan **AWASIN siap** muncul, buka [AWASIN](http://localhost:5173). [Dokumentasi API](http://127.0.0.1:8000/docs) tersedia pada mode pengembangan.

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Backend yang siap mengembalikan `status` bernilai `ok`. Untuk memeriksa integrasi AI atau reputasi, lakukan pemeriksaan dari formulir dan lihat status provider pada detail hasil. Jika baru mengubah `.env`, mulai ulang layanan terkait agar konfigurasinya dibaca kembali. Langkah menjalankan lewat dua terminal, memeriksa log, dan menangani konflik port ada di [RUN_LOCAL.md](RUN_LOCAL.md).

### 4. Jalankan tes

Dari root repositori:

```powershell
Set-Location backend
.\.venv\Scripts\python.exe -m pytest
Set-Location ..\frontend
npm.cmd test
npm.cmd run lint
Set-Location ..
```

## Cara membaca batas hasil pemeriksaan

- Hasil tanpa kecocokan berarti sumber yang berhasil diperiksa tidak menemukan laporan yang cocok. Ketersediaan sumber, cakupan arsip, dan umur bukti memengaruhi hasil.
- Tautan unduhan dapat tetap tanpa laporan file ketika arsip tidak memiliki URL yang sama atau tidak menyediakan SHA-256. AWASIN tidak membuka halaman tujuan atau mengunduh file untuk mengisi kekosongan tersebut.
- Screenshot yang kabur atau terpotong bisa menghilangkan konteks. Jika hasil OCR meragukan, coba tempel teks asli.
- Gunakan saran di laporan dan verifikasi lewat kanal resmi sebelum memasukkan data sensitif, mengirim uang, atau menjalankan unduhan.

## Pengembangan selanjutnya

| Rencana | Tujuan | Alur yang direncanakan |
| --- | --- | --- |
| AI Image Detector | Membantu mengenali indikasi gambar hasil generasi AI atau manipulasi visual. | Validasi unggahan, proses gambar, jalankan analisis visual, lalu tampilkan indikator dan keterbatasan hasil. Evaluasi dengan contoh gambar asli, hasil generasi, dan gambar yang sudah dikompresi. |
| AI Video Detector | Membantu mengenali indikasi manipulasi video, termasuk potensi deepfake. | Validasi format dan durasi, ambil sampel frame atau segmen, lalu analisis konsistensi dan tampilkan bagian yang perlu diperiksa. Evaluasi pada video asli dan video manipulasi dengan variasi kualitas. |

Kedua detektor media masih dalam rencana pengembangan. OCR screenshot sudah tersedia di Message Analyzer untuk membaca teks pada gambar.
