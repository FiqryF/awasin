# AWASIN frontend

**Cek Dulu, Lebih Aman.** AWASIN merupakan platform web berbasis AI untuk membantu masyarakat memeriksa indikasi penipuan digital. Repository ini baru menyiapkan fondasi frontend; belum ada kemampuan analisis yang berjalan.

## Stack dan prasyarat

- Node.js **22.13+ pada seri 22, atau 24+** (disarankan Node.js 24 LTS), npm. Batas ini mengikuti kompatibilitas Vite dan ESLint.
- React 19, TypeScript 5.9 dengan `strict`, Vite 7.
- Tailwind CSS 4 melalui `@tailwindcss/vite`, React Router 7, Lucide React.
- ESLint 10, typescript-eslint, plugin React Hooks dan React Refresh.

Tidak membutuhkan backend, database, Supabase, API key, atau akun.

## Menjalankan

Jalankan dari direktori `frontend`:

```sh
npm install
npm run dev
```

Buka alamat yang dicetak Vite (default `http://localhost:5173`). Untuk instalasi ulang yang mengikuti lockfile gunakan `npm ci`.

```sh
npm run lint
npm run build
npm run check:routes
npm run preview
```

`build` menjalankan pemeriksaan TypeScript sebelum menghasilkan `dist/`. `check:routes` memverifikasi seluruh route dengan renderer React, judul, layout, navigasi fitur, dan transport service menggunakan mock fetch; tidak mengirim request ke backend. Pemeriksaan ini tidak menggantikan uji interaksi browser.

## Environment

Salin `.env.example` menjadi `.env` bila ingin mengubah konfigurasi lokal:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Nilai yang sama digunakan sebagai fallback jika `.env` belum dibuat. Restart Vite setelah mengubah environment. Semua variabel `VITE_*` terlihat oleh browser: jangan menyimpan API key, token rahasia, atau kredensial di sana.

## Struktur

```text
frontend/
├── public/                     # Aset statis mendatang
├── scripts/check-routes.mjs     # Smoke check route dan transport
├── src/
│   ├── assets/                 # Aset impor mendatang
│   ├── components/
│   │   ├── common/RouteAnnouncer.tsx
│   │   ├── layout/             # Header dan Footer
│   │   └── ui/                 # Primitif UI jika dibutuhkan
│   ├── features/               # Batas modul fitur; belum diimplementasikan
│   │   ├── link-inspector/
│   │   ├── message-analyzer/
│   │   ├── fake-website-detector/
│   │   ├── qr-scanner/
│   │   ├── media-analyzer/
│   │   ├── scan-history/
│   │   ├── education/
│   │   └── feedback/
│   ├── hooks/                  # Hook bersama ketika diperlukan
│   ├── layouts/MainLayout.tsx
│   ├── lib/                    # Konfigurasi library mendatang
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── NotFoundPage.tsx
│   │   └── placeholders/PlaceholderPage.tsx
│   ├── routes/                 # Konfigurasi route dan AppRoutes
│   ├── services/api.ts         # Transport fetch opt-in
│   ├── types/                  # Tipe lintas fitur ketika diperlukan
│   ├── utils/                  # Utilitas bersama ketika diperlukan
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── .env.example
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

Folder cadangan sengaja belum berisi implementasi atau file kosong. Git tidak melacak folder kosong; buat kembali folder sesuai kebutuhan ketika mulai mengerjakan modul. Layout, halaman, konfigurasi navigasi, dan transport memiliki tanggung jawab terpisah. Tambahkan kode spesifik fitur di `features/<nama-fitur>/`, bukan dalam komponen bersama.

## Route

| Akses yang direncanakan | Path | Halaman |
| --- | --- | --- |
| Public | `/` | Home |
| Public | `/scan/link` | Link Inspector |
| Public | `/scan/message` | Message Analyzer |
| Public | `/scan/website` | Fake Website Detector |
| Public | `/scan/qr` | QR Security Scanner |
| Public | `/scan/media` | AI Media Authenticity Analyzer |
| Public | `/education` | Scam Education Center |
| Public | `/feedback` | Feedback |
| Public | `/login` | Login |
| Public | `/register` | Register |
| Public | `/forgot-password` | Forgot Password |
| User (nanti) | `/history` | Scan History |
| User (nanti) | `/settings` | Pengaturan akun |
| Admin (nanti) | `/admin` | Administrator |
| Admin (nanti) | `/admin/domains` | Domain resmi |
| Admin (nanti) | `/admin/articles` | Artikel edukasi |
| Admin (nanti) | `/admin/feedback` | Moderasi feedback |
| Semua | `*` | Halaman tidak ditemukan |

Semua route selain Home dan 404 memakai placeholder bersama. Label akses hanya mendokumentasikan rencana: **belum ada autentikasi atau proteksi route**, termasuk admin. Tidak ada status login buatan. Hosting produksi perlu mengarahkan URL SPA yang tidak cocok dengan file statis ke `index.html` agar refresh pada nested route bekerja.

## Fondasi tampilan dan aksesibilitas

Home memuat navigasi lima jenis pemeriksaan, navbar dan footer sederhana. Tampilan menggunakan teks gelap, aksen hijau, tanpa animasi dan aset eksternal. Layout fleksibel, tautan keyboard, focus indicator, skip link, judul halaman, dan pemindahan fokus setelah navigasi disediakan. Identitas visual ini masih kerangka awal, bukan landing page final.

## Batasan tahap ini

- Belum ada analisis URL/pesan/website/QR/media, kamera, upload, atau API AI.
- Belum ada backend, database, Supabase, login, atau pengiriman feedback.
- Riwayat, laporan, edukasi, aksesibilitas lanjutan, kontrol privasi, serta transparansi sumber belum diimplementasikan.
- Tidak ada penyimpanan hasil pemeriksaan atau data pengguna.
- `apiRequest<T>` hanya helper `fetch` dengan status error HTTP dan penanganan 204. Tipe generik bukan validasi runtime. Import service tidak memicu request.

## Pengembangan berikutnya: FastAPI

1. Sepakati kontrak endpoint, skema input/output, status analisis, serta format error dengan tim backend FastAPI.
2. Tambahkan service khusus tiap fitur yang memakai `apiRequest`, validasi respons saat kontrak sudah disepakati, dan state loading/error di UI.
3. Konfigurasi `VITE_API_BASE_URL` dan CORS di FastAPI. Kunci AI tetap di backend.
4. Integrasikan Supabase Auth pada tahap terpisah sebelum menambahkan proteksi User/Admin. Otorisasi wajib ditegakkan kembali di backend.
5. Implementasikan fitur secara bertahap dengan persetujuan alur privasi, retensi, dan riwayat opsional.

Jangan menganggap placeholder sebagai kontrol keamanan atau pemeriksaan penipuan yang sudah berfungsi.
