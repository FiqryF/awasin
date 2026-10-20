# AWASIN frontend

**Cek Dulu, Lebih Aman.** AWASIN merupakan platform web berbasis AI untuk membantu masyarakat memeriksa indikasi penipuan digital. Frontend memuat landing page responsif dengan form input lokal; belum ada kemampuan analisis keamanan yang berjalan.

## Stack dan prasyarat

- Node.js **22.13+ pada seri 22, atau 24+** (disarankan Node.js 24 LTS), npm. Batas ini mengikuti kompatibilitas Vite dan ESLint.
- React 19, TypeScript 5.9 dengan `strict`, Vite 7.
- Tailwind CSS 4 melalui `@tailwindcss/vite`, React Router 7, Lucide React.
- Motion for React (`motion/react`) untuk animasi; Inter Variable disajikan lokal dari `@fontsource-variable/inter` (tanpa request font ke layanan eksternal).
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

`build` menjalankan pemeriksaan TypeScript sebelum menghasilkan `dist/`. `check:routes` memverifikasi seluruh route dengan renderer React, judul, layout, anchor landing page, enam tab, validasi URL/pesan/file termasuk batas ukuran, dan transport service menggunakan mock fetch; tidak mengirim request ke backend. Pemeriksaan ini tidak menggantikan uji interaksi browser.

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
│   │   ├── layout/             # FloatingNavbar dan Footer
│   │   ├── motion/             # ScrollReveal, ShinyText, BackgroundVideo
│   │   └── ui/BrandMark.tsx
│   ├── features/               # Batas modul fitur; belum diimplementasikan
│   │   ├── scan/               # ScanPanel, ScanForm, ScanTypeSelector, ScanSidebar, upload, validasi
│   │   ├── link-inspector/
│   │   ├── message-analyzer/
│   │   ├── fake-website-detector/
│   │   ├── qr-scanner/
│   │   ├── media-analyzer/
│   │   ├── scan-history/
│   │   ├── education/
│   │   └── feedback/
│   ├── hooks/usePrefersReducedMotion.ts
│   ├── layouts/MainLayout.tsx
│   ├── lib/                    # Konfigurasi library mendatang
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── NotFoundPage.tsx
│   │   └── placeholders/PlaceholderPage.tsx
│   ├── routes/                 # Konfigurasi route dan AppRoutes
│   ├── sections/               # HeroSection, ScanSection, EducationSection
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

Implementasi mengikuti blueprint `AWASIN_UI_Reference_Adapted.html`: hero video editorial rata kiri, area scan hitam dua kolom 8/12 + 4/12, tiga side information cards, edukasi dengan banner artikel utama dan carousel empat topik bergambar (phishing, manipulasi psikologis, penipuan QR, keaslian media), dan footer hitam multikolom. Bukan HTML statis atau Tailwind CDN: seluruh halaman memakai komponen React, TypeScript strict, Tailwind lokal, dan Motion. Palet UI hanya Blood Red `#870002`, Honeydew `#F5FFE9`, dan Black `#000000`, dengan opacity/gradien dari ketiganya. Video asli ditampilkan melalui overlay merah/hitam sesuai referensi. Tidak ada statistik, testimoni, CSIRT, hotline, atau klaim hasil pemeriksaan buatan.

Navbar memakai simbol lingkaran dengan pusat merah, glass pill, blur, border, dan inset highlight. Subscription scroll Motion yang sama membaca batas section gelap terhadap titik tengah navbar: hero/scan/footer/placeholder memakai glass hitam dengan teks Honeydew; edukasi memakai Honeydew dengan teks hitam/merah. Target dicache dan dihitung ulang saat route atau viewport berubah. Saat scroll, skala sedikit mengecil dan glass lebih terdefinisi. Di bawah 1024 px, navbar menggunakan disclosure nonmodal dengan panel glass terpisah: tombol menu, navigasi Tab, Escape mengembalikan fokus ke tombol, klik luar dan navigasi menutup panel. Karena bukan modal, fokus tidak dikunci. Container desktop dibatasi 1280 px.

Anchor `/#beranda`, `/#periksa`, `/#edukasi` bekerja dari Home maupun route lain. Scroll margin menghindari header; skip link, label input, pesan error, live status, dan fokus judul disediakan. Selector mendukung Left/Right, Home/End, dan roving tab index. Di bawah 640 px selector memiliki dua kolom; mulai 640 px tiga kolom. Scan/sidebar bertumpuk di bawah 1024 px. Edukasi menampilkan banner bergambar dengan overlay Honeydew dan teks di kiri, lalu carousel empat artikel di bawahnya. Desktop menampilkan tiga kartu sekaligus, tablet dua, dan mobile satu dengan petunjuk kartu berikutnya. Carousel memakai scroll snap, tombol sebelumnya/berikutnya dengan state disabled, fokus keyboard, serta swipe native; reduced motion menonaktifkan smooth scroll. Foto ilustrasi disimpan lokal di public/assets/education/ dengan sumber tercatat dalam SOURCES.md. Footer multikolom pada desktop, satu kolom pada mobile. Link feedback mengarah ke placeholder yang ada; kebijakan privasi belum aktif dan ditandai dalam pengembangan.

Motion memakai reveal sekali per elemen (350–450 ms), stagger selector 60 ms, stagger artikel 80 ms, transisi panel 200 ms, dan reveal hero berurutan. `ShinyText` menerima `children`, `className`, dan `duration` (default 3 detik) untuk shine Honeydew yang bergerak lembut. Warna teks dasar tetap tersedia jika background clipping tidak didukung. Indikator scroll bergerak tiga kali, lalu berhenti. Form tidak dianimasikan ulang saat mengetik.

`MotionConfig reducedMotion="user"`, hook reaktif `usePrefersReducedMotion` (`useSyncExternalStore`), serta media query CSS menghentikan shine, reveal dekoratif, smooth scrolling, dan video saat reduced motion aktif. Preferensi yang berubah ketika halaman terbuka langsung diterapkan. Konten selalu tersedia.

## Hero video dan fallback

Sumber video persis seperti yang diberikan pada brief, tanpa diunduh ke repository:

```text
https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_105406_16f4600d-7a92-4292-b96e-b19156c7830a.mp4
```

Video dekoratif memakai `autoPlay`, `muted`, `loop`, `playsInline`, `preload="metadata"`, `aria-hidden`, dan tidak memiliki controls. Pemutaran dijeda saat dokumen tidak terlihat; penolakan `play()` ditangani. Latar hitam, overlay merah/hitam, judul, dan CTA tetap lengkap tanpa video. Saat reduced motion aktif, elemen video tidak dirender sehingga tidak memulai request media. Font tetap lokal; video ini adalah satu-satunya aset eksternal yang sengaja dimuat. Input scan tidak pernah dikirim ke sumber video.

Ketersediaan jaringan, codec, dan kebijakan autoplay browser dapat membatasi pemutaran. Video telah terlihat di hero React saat pemeriksaan browser. Penolakan promise `play()` tidak lagi memanggil `pause()` yang dapat membatalkan percobaan pemutaran berikutnya selama siklus StrictMode. Fallback tetap tersedia, dan perubahan reduced motion dapat menghentikan media tanpa memuat ulang halaman.

## Form pemeriksaan lokal

- **Link/Website:** URL HTTP(S) lengkap; situs tidak dibuka. Validasi sintaks bukan deteksi risiko.
- **Pesan:** teks 10–10.000 karakter, screenshot opsional; screenshot saja juga diterima.
- **QR Code/Gambar:** JPG, PNG, WebP hingga 10 MB.
- **Video:** MP4 atau WebM hingga 50 MB; hanya nama dan ukuran file ditampilkan.
- Validasi file memeriksa MIME, ukuran nonkosong, dan batas ukuran; bukan inspeksi isi file atau verifikasi keaslian media.
- Gambar memakai object URL lokal untuk preview dan URL dilepas ketika file berubah atau komponen dilepas. Preview gagal memiliki fallback.
- Berganti mode menghapus input mode sebelumnya. Refresh atau meninggalkan Home juga menghapus state input; tidak ada localStorage, unggahan, maupun request analisis.
- Submit valid menampilkan: **“Fitur pemeriksaan sedang dalam pengembangan. Analisis keamanan belum tersedia.”** Tidak ada skor, hasil deteksi, atau loading analisis buatan.
- Empat tindakan edukasi menuju placeholder `/education`. Footer menautkan materi edukasi, feedback, dan login; kebijakan privasi ditampilkan sebagai teks noninteraktif, tanpa alamat kontak buatan.

## Batasan tahap ini

- Belum ada analisis URL/pesan/website/QR/media, kamera, pengiriman file ke server, atau API AI.
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
