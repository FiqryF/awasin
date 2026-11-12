# AWASIN

AWASIN adalah aplikasi web untuk memeriksa tautan yang meragukan dan membantu pengguna mengenali indikasi phishing, penipuan, serta penyamaran domain. Hasil pemeriksaan menampilkan penilaian, alasan, sumber bukti, dan langkah yang bisa diambil pengguna.

## Fitur

- **Link & Website Inspector** memeriksa struktur URL, mencocokkan domain dengan referensi yang dikenal, serta menampilkan hasil dari sumber keamanan yang tersedia. Pemeriksaan dapat dilakukan sebagai tamu melalui `/scan/link`.
- **Deteksi dan penjelasan AI** memakai NVIDIA Nemotron melalui OpenRouter untuk menilai domain dan ringkasan bukti, lalu Mistral untuk menjelaskan hasil dalam alasan bernomor. Layanan ini opsional dan berjalan setelah pengguna memberi persetujuan. Pemeriksaan tidak membuka isi halaman tujuan, sehingga hasilnya tidak menjamin keamanan situs.
- **Pembaca QR Code** membaca gambar dan menampilkan isi QR di perangkat pengguna. Untuk menganalisis URL yang terbaca, gunakan mode Link & Website.
- **Edukasi dan feedback** menyediakan artikel keamanan digital serta formulir untuk mengirim masukan atau melaporkan masalah.
- **Akun dan administrasi** mencakup registrasi, login, verifikasi email, pemulihan kata sandi, profil, pengaturan, dan tampilan riwayat. Admin dapat mengelola feedback, referensi domain, dan artikel serta melihat audit aktivitas.

Mode analisis **Pesan, AI Image, dan AI Video** sudah memiliki antarmuka dan validasi masukan. Mesin deteksinya masih dalam pengembangan. Hasil pemeriksaan Link & Website saat ini belum disimpan ke riwayat.

## Tech stack

| Bagian | Teknologi |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, Motion, jsQR |
| Backend | Python 3.12+, FastAPI, Uvicorn, Pydantic Settings, HTTPX |
| Akun dan data | Supabase Auth, PostgreSQL, Supabase Storage untuk avatar |
| Integrasi opsional | Google Safe Browsing atau Google Web Risk, VirusTotal, urlscan.io, Nemotron via OpenRouter, Mistral. Pemeriksaan tambahan juga memakai DNS dan RDAP. |
| Pengujian | Vitest dan pytest |

## Menjalankan secara lokal

Siapkan **Git**, **Python 3.12 atau lebih baru**, serta **Node.js 22.13+ pada seri 22 atau Node.js 24+** beserta npm. Perintah berikut menggunakan Windows PowerShell.

### 1. Pasang dependensi

Jika belum punya salinan repositori, jalankan `git clone https://github.com/FiqryF/awasin.git`. Buka folder `awasin`, lalu jalankan perintah berikut dari root repositori.

```powershell
Set-Location backend
if (!(Test-Path .\.venv\Scripts\python.exe)) { py -3.13 -m venv .venv }
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"

Set-Location ..\frontend
npm.cmd ci
Set-Location ..
```

Ganti `py -3.13` dengan `py -3.12` jika Python 3.12 yang terpasang. Jika instalasi gagal, selesaikan error tersebut sebelum menyalakan server.

### 2. Atur integrasi jika diperlukan

Halaman publik, health check, dan pemeriksaan dasar struktur tautan bisa dicoba dengan konfigurasi bawaan. Untuk memakai akun, database, atau layanan pihak ketiga, salin [template frontend](frontend/.env.example) dan [template backend](backend/.env.example) menjadi `.env` di folder masing-masing jika file tersebut belum ada.

- **Supabase** memakai project yang sama pada frontend dan backend. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` di frontend, serta `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY` di backend. Terapkan migrasi SQL dalam [`supabase/migrations/`](supabase/migrations/) secara berurutan pada project pengembangan.
- **Nemotron dan Mistral** memerlukan `AI_THREAT_DETECTOR_ENABLED=true`, `OPENROUTER_API_KEY`, `AWASIN_AI_ENABLED=true`, dan `MISTRAL_API_KEY` di backend. Isi `VITE_AI_THREAT_DETECTOR_PROVIDER=Nemotron` di frontend agar opsi deteksi muncul.
- **Pemeriksaan eksternal** dapat diaktifkan dengan key provider yang sesuai di `backend/.env.example`. Simpan key provider dan kredensial rahasia di backend. Variabel `VITE_*` dibundel ke browser.

### 3. Nyalakan frontend dan backend

Dari root repositori, jalankan:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-dev.ps1
```

Skrip menjalankan kedua layanan di latar belakang dan memakai ulang layanan yang sudah sehat. Setelah muncul pesan **AWASIN siap**, buka [web AWASIN](http://localhost:5173). Dokumentasi API tersedia di [Swagger UI](http://127.0.0.1:8000/docs) pada mode pengembangan.

Untuk memeriksa status backend, jalankan:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Backend yang aktif mengembalikan `status: ok`. Untuk mencoba AI setelah integrasinya aktif, buka **Link & Website**, masukkan tautan, centang **Izinkan pemeriksaan lengkap**, lalu pilih **Periksa Sekarang**. Petunjuk menjalankan dua terminal terpisah dan membaca log tersedia di [RUN_LOCAL.md](RUN_LOCAL.md).
