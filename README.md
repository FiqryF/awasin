# AWASIN

AWASIN adalah aplikasi web untuk memeriksa tautan yang meragukan dan membantu pengguna mengenali indikasi phishing, penipuan, serta penyamaran domain. Hasil pemeriksaan menampilkan penilaian, alasan, sumber bukti, dan langkah yang bisa diambil pengguna.

## Fitur

- **Link & Website Inspector** memeriksa struktur URL, mencocokkan domain dengan referensi yang dikenal, serta menampilkan hasil dari sumber keamanan yang tersedia. Pemeriksaan dapat dilakukan sebagai tamu melalui `/scan/link`.
- **Analisis URL dengan Mistral** menetapkan risiko dari URL yang sudah disaring dan bukti struktur, identitas, serta reputasi. Backend memvalidasi rujukan bukti dan menyediakan hasil cadangan. Pengguna dapat memilih pemeriksaan lokal tanpa AI. Pemeriksaan tidak membuka isi halaman tujuan.
- **Pembaca QR Code** membaca gambar unggahan atau kamera secara lokal, lalu menampilkan isi QR tanpa membukanya otomatis. URL diperiksa melalui alur Link & Website setelah pengguna memilih pemeriksaan. Payload non-URL dapat dikirim ke backend hanya setelah persetujuan eksplisit; analisis format tidak menyimpan atau meneruskan payload ke provider eksternal dan tidak menetapkan verdict aman/berbahaya.
- **Edukasi dan feedback** menyediakan artikel keamanan digital serta formulir untuk mengirim masukan atau melaporkan masalah.
- **Akun dan administrasi** mencakup registrasi, login, verifikasi email, pemulihan kata sandi, profil, pengaturan, dan tampilan riwayat. Admin dapat mengelola feedback, referensi domain, dan artikel serta melihat audit aktivitas.

Mode analisis **Pesan, AI Image, dan AI Video** sudah memiliki antarmuka dan validasi masukan. Mesin deteksinya masih dalam pengembangan. Hasil pemeriksaan Link & Website saat ini belum disimpan ke riwayat.

### Status pengerjaan fitur QR Code

Fitur QR Code sudah mencakup alur pembacaan dan pemeriksaan payload berikut:

- Gambar QR dapat dibaca dari unggahan atau kamera di browser. Kamera hanya dimulai setelah pengguna menekan tombol dan memberikan izin.
- Isi QR ditampilkan sebagai teks dan tidak dibuka atau dijalankan otomatis.
- QR berisi URL HTTP(S) dapat diperiksa melalui alur Link & Website setelah pengguna memilih pemeriksaan.
- Payload non-URL, seperti konfigurasi Wi-Fi, kartu kontak, email, telepon, skema non-HTTP, dan teks biasa, dapat diperiksa formatnya oleh backend setelah pengguna memberikan persetujuan eksplisit.
- Analisis payload non-URL menggunakan aturan format AWASIN. Payload tidak disimpan atau diteruskan ke provider eksternal, dan hasilnya tidak menyimpulkan bahwa isi QR aman atau berbahaya. Karena payload dapat memuat kata sandi atau data pribadi, pengguna perlu meninjau isi QR sebelum menyetujui pengirimannya.
- Antarmuka utama tetap mengikuti tampilan yang sudah ada. Tambahan persetujuan dan tombol analisis ditampilkan untuk payload non-URL; tombol tidak aktif sebelum persetujuan diberikan.

**Status:** implementasi dan validasi alur QR selesai untuk cakupan di atas. Tes yang dijalankan: 47 tes backend analisis dan 57 tes frontend terkait QR lulus, serta build frontend berhasil. Hasil klasifikasi format bukan pengganti pemeriksaan keamanan menyeluruh.

## Tech stack

| Bagian | Teknologi |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, Motion, jsQR |
| Backend | Python 3.12+, FastAPI, Uvicorn, Pydantic Settings, HTTPX |
| Akun dan data | Supabase Auth, PostgreSQL, Supabase Storage untuk avatar |
| Integrasi opsional | Mistral, Google Safe Browsing atau Google Web Risk, VirusTotal, urlscan.io, DNS, dan RDAP. |
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
- **Mistral** memerlukan `AWASIN_AI_ENABLED=true` dan `MISTRAL_API_KEY` di backend. Pengguna memberi izin di formulir sebelum domain dan path yang disaring dikirim. Query dan fragmen dihapus. Jika Mistral tidak tersedia, hasil pemeriksaan bukti tetap ditampilkan.
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
