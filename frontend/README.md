# AWASIN frontend

Status terbaru Dashboard, Scan, History, Settings, Edukasi dan Feedback tersedia pada
[laporan progres Phase 1–4](../AWASIN_PROGRESS_PHASE_1_4.md). Bagian integrasi akun
di bawah mencatat fondasi sebelumnya; migrasi fitur baru 002–004 masih perlu
diterapkan ke Supabase dan diverifikasi pada lingkungan uji yang sesuai.

## Notifikasi autentikasi — 25 Oktober 2026

Login dari formulir baru menampilkan `Berhasil masuk` sesudah SDK menerima kredensial
dan `AuthProvider.refresh()` mengembalikan identitas yang diverifikasi backend.
Restore sesi, refresh halaman, dan refresh token tidak mengulang notifikasi login.

Logout manual dari menu akun, Settings, dan halaman akun/admin memakai `useLogout`.
Setelah signOut, helper memastikan sesi SDK kosong dan state akun sudah bersih.
Jika sesi masih aktif, hanya pesan kegagalan yang ditampilkan. Jika SDK membersihkan
sesi browser tetapi pencabutan remote gagal, notifikasi memberi peringatan yang
membedakan kedua hasil tersebut.

Provider notifikasi berada di luar subtree preferensi yang berganti saat identitas
berubah. Provider juga menyelesaikan navigasi ke `/` dan scroll ke atas. Guard halaman
terlindungi menunggu commit navigasi tersebut supaya event SIGNED_OUT tidak menyisipkan
redirect ke `/login`. Kebijakan idle dan alur reset password tetap terpisah.

Popup berada di tengah layar desktop/mobile, berbentuk kartu status dengan ikon
konfirmasi yang digambar, hierarki teks terpusat, dan latar diredupkan. Lifetime
popup sukses mengikuti penyelesaian animasi Motion: masuk 280 ms, indikator waktu
2,6 detik, dan keluar 180 ms (sekitar 3,06 detik total), bukan timer penutup terpisah.
Indikator dijeda saat hover/fokus atau tab tersembunyi dan dapat ditutup manual
dengan animasi keluar. Reduced motion memakai fade singkat dengan waktu baca yang
tetap cukup; pengaturan CSS reduced motion tidak mempercepat indikator menjadi nol.
Peringatan/kegagalan menunggu pengguna menutupnya. Pesan diumumkan melalui live region
yang tetap terpasang, tanpa mengambil fokus. Tampilan mengikuti glass AWASIN dan
menyesuaikan desktop/mobile serta reduced motion. Tidak ada dependency tambahan.

Tes `auth-notifications.test.tsx` mencakup verifikasi login tertunda/gagal, restore
sesi, logout yang memicu unmount lebih dulu, sesi yang masih aktif, kegagalan jaringan,
retry, peringatan pencabutan remote, dan dismissal/fokus popup. Verifikasi memakai SDK
mock; tampilan browser diperiksa dengan fixture sementara tanpa kredensial pengguna.

Saat aplikasi memulihkan sesi, `AuthSessionGate` menampilkan `SessionLoading` layar
penuh sebelum navbar, footer dan halaman dipasang. Ini menggantikan banner status
dengan ruang konten kosong. Indikator juga dipakai untuk fallback halaman lazy dan
verifikasi route terlindungi. Teks status mengikuti proses yang sedang berjalan;
tidak ada persentase atau waktu tunggu minimum buatan. Error yang sudah selesai
diverifikasi tidak disembunyikan di balik loader. Pemeriksaan background atas akun
yang sudah terverifikasi tetap mempertahankan konten yang sedang digunakan.

Verifikasi pembaruan: 188 tes, lint, build dan check:routes lulus. Fixture browser
mengonfirmasi pusat popup sama dengan pusat viewport pada desktop dan mobile,
serta tampilan loading tanpa navbar/footer. Fixture sementara sudah dihapus.

Penyempurnaan animasi diuji dengan kontrol completion terpisah untuk fase masuk,
countdown, dan keluar. Tes memverifikasi pause fokus/visibility serta callback lama
yang tidak boleh menutup pesan baru. Browser desktop/mobile memverifikasi desain
dan siklus otomatis sampai elemen dilepas sesudah animasi; fixture sudah dihapus.
Verifikasi akhir penyempurnaan: 191 tes, lint, build dan check:routes lulus.

## Phase 2 — integrasi akun

Form akun memakai SDK Supabase, session provider, proteksi route, profil,
dashboard minimum, dan pemulihan lewat kode email. Login admin maupun pengguna
cukup email/password, tanpa syarat MFA. Migrasi remote dan konfigurasi Auth sudah
diterapkan; bootstrap admin pertama berhasil. Role tetap dibaca dari database.
Setelah persetujuan pemilik proyek, TOTP dan batas durasi sesi AAL1 di Supabase
sudah dinonaktifkan; faktor authenticator lama dihapus. Verifikasi email saat
aktivasi/pemulihan dan reautentikasi untuk mengganti password tetap terpisah dari login.
Lihat [laporan progres dan aktivasi](../AWASIN_PROGRESS_PHASE_1_4.md)
untuk setup Windows, environment, migrasi/RLS, provisioning admin, batas keamanan,
dan status pengujian. Jalankan `npm run test` untuk test auth dengan provider mocked.

Untuk menjalankan web dan backend sekaligus dari root repository pada Windows:

```powershell
.\start-dev.ps1
```

Perintah memeriksa kedua layanan, memakai ulang server yang sudah sehat, dan
menjalankan layanan yang belum tersedia di latar belakang. Buka http://localhost:5173.
Dependensi dan `.env` perlu disiapkan terlebih dahulu sesuai panduan. Script tidak
menginstal dependensi, mengubah Auth, atau menghentikan proses lain.

Bagian berikut mendokumentasikan tahap frontend sebelumnya: pernyataan belum ada
auth/backend dan route belum diproteksi di bawah ini sudah digantikan implementasi
Phase 2. Engine analisis belum tersedia. Pengiriman Feedback sudah diimplementasikan,
tetapi persistensi cloud memerlukan migrasi 004 dan verifikasi integrasi.

**Cek Dulu, Lebih Aman.** AWASIN merupakan platform web berbasis AI untuk membantu masyarakat memeriksa indikasi penipuan digital. Frontend memuat landing page responsif dengan form input lokal; belum ada kemampuan analisis keamanan yang berjalan.

## Stack dan prasyarat

- Node.js **22.13+ pada seri 22, atau 24+** (disarankan Node.js 24 LTS), npm. Batas ini mengikuti kompatibilitas Vite dan ESLint.
- React 19, TypeScript 5.9 dengan `strict`, Vite 7.
- Tailwind CSS 4 melalui `@tailwindcss/vite`, React Router 7, Lucide React.
- Motion for React (`motion/react`) untuk animasi; Inter Variable disajikan lokal dari `@fontsource-variable/inter` (tanpa request font ke layanan eksternal).
- ESLint 10, typescript-eslint, plugin React Hooks dan React Refresh.

Landing page, artikel edukasi, validasi scan dan pembaca QR lokal dapat digunakan
tanpa akun. Login, profil, preferensi, riwayat, ekspor dan pengiriman Feedback
memerlukan layanan/konfigurasi yang sesuai; lihat laporan progres di atas.

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

Home, Feedback, Edukasi/artikel, Dashboard, Scan, Riwayat/detail, Settings dan 404
memakai halaman aktual. Dashboard, Riwayat, Settings dan route admin dilindungi
oleh verifikasi identitas. Halaman admin yang belum dibangun tetap berupa placeholder.
Hosting produksi perlu mengarahkan URL SPA yang tidak cocok dengan file statis
ke `index.html` agar refresh pada nested route bekerja.

## Fondasi tampilan dan aksesibilitas

Implementasi mengikuti blueprint `AWASIN_UI_Reference_Adapted.html`: hero video editorial rata kiri, area scan hitam dua kolom 8/12 + 4/12, tiga side information cards, edukasi dengan banner artikel utama dan carousel empat topik bergambar (phishing, manipulasi psikologis, penipuan QR, keaslian media), dan footer hitam multikolom. Bukan HTML statis atau Tailwind CDN: seluruh halaman memakai komponen React, TypeScript strict, Tailwind lokal, dan Motion. Palet UI hanya Blood Red `#870002`, Honeydew `#F5FFE9`, dan Black `#000000`, dengan opacity/gradien dari ketiganya. Video asli ditampilkan melalui overlay merah/hitam sesuai referensi. Tidak ada statistik, testimoni, CSIRT, hotline, atau klaim hasil pemeriksaan buatan.

Navbar memakai simbol lingkaran dengan pusat merah, glass pill, blur, border, dan inset highlight. Subscription scroll Motion yang sama membaca batas section gelap terhadap titik tengah navbar: hero/scan/footer/placeholder memakai glass hitam dengan teks Honeydew; edukasi memakai Honeydew dengan teks hitam/merah. Target dicache dan dihitung ulang saat route atau viewport berubah. Saat scroll, skala sedikit mengecil dan glass lebih terdefinisi. Di bawah 1024 px, navbar menggunakan disclosure nonmodal dengan panel glass terpisah: tombol menu, navigasi Tab, Escape mengembalikan fokus ke tombol, klik luar dan navigasi menutup panel. Karena bukan modal, fokus tidak dikunci. Container desktop dibatasi 1280 px.

Anchor `/#beranda`, `/#periksa`, `/#edukasi` bekerja dari Home maupun route lain. Scroll margin menghindari header; skip link, label input, pesan error, live status, dan fokus judul disediakan. Selector mendukung Left/Right, Home/End, dan roving tab index. Di bawah 640 px selector memiliki dua kolom; mulai 640 px tiga kolom. Scan/sidebar bertumpuk di bawah 1024 px. Edukasi menampilkan banner bergambar dengan overlay Honeydew dan teks di kiri, lalu carousel empat artikel di bawahnya. Desktop menampilkan tiga kartu sekaligus, tablet dua, dan mobile satu dengan petunjuk kartu berikutnya. Carousel memakai scroll snap, tombol sebelumnya/berikutnya dengan state disabled, fokus keyboard, serta swipe native; reduced motion menonaktifkan smooth scroll. Foto ilustrasi disimpan lokal di public/assets/education/ dengan sumber tercatat dalam SOURCES.md. Footer multikolom pada desktop, satu kolom pada mobile. Link feedback mengarah ke form tiga langkah; kebijakan privasi belum aktif dan ditandai dalam pengembangan.

Motion memakai reveal sekali per elemen (350–450 ms), stagger selector 60 ms, stagger artikel 80 ms, transisi panel 200 ms, dan reveal hero berurutan. `ShinyText` menerima `children`, `className`, dan `duration` (default 3 detik) untuk shine Honeydew yang bergerak lembut. Warna teks dasar tetap tersedia jika background clipping tidak didukung. Indikator scroll bergerak tiga kali, lalu berhenti. Form tidak dianimasikan ulang saat mengetik.

`MotionConfig reducedMotion="user"`, hook reaktif `usePrefersReducedMotion` (`useSyncExternalStore`), serta media query CSS menghentikan shine, reveal dekoratif, smooth scrolling, dan video saat reduced motion aktif. Preferensi yang berubah ketika halaman terbuka langsung diterapkan. Konten selalu tersedia.

## Hero video dan fallback

Video hero menggunakan file lokal yang diberikan pengguna (`13381565_1920_1080_30fps.mp4`), disalin tanpa perubahan ke:

```text
public/assets/video/hero.mp4
```

Video dekoratif memakai `autoPlay`, `muted`, `loop`, `playsInline`, `preload="metadata"`, `aria-hidden`, dan tidak memiliki controls. Pemutaran dijeda saat dokumen tidak terlihat; penolakan `play()` ditangani. Latar hitam, overlay merah/hitam, judul, dan CTA tetap lengkap tanpa video. Saat reduced motion aktif, elemen video tidak dirender sehingga tidak memulai request media. URL video mengikuti `import.meta.env.BASE_URL` agar mendukung deployment pada subpath. Video disajikan dari origin aplikasi dan ikut disalin ke build Vite.

Ketersediaan jaringan, codec, dan kebijakan autoplay browser dapat membatasi pemutaran. Penolakan promise `play()` tidak memanggil `pause()` yang dapat membatalkan percobaan pemutaran berikutnya selama siklus StrictMode. Fallback tetap tersedia, dan perubahan reduced motion dapat menghentikan media tanpa memuat ulang halaman.

## Video edukasi

Background edukasi memakai file pengguna `12742138_1920_1080_30fps.mp4`, disalin ke `public/assets/video/education.mp4`. Komponen `BackgroundVideo` digunakan bersama hero dengan sumber dan class CSS terpisah. Video dekoratif berjalan tanpa suara dan berulang, memakai grayscale serta multiply di atas Honeydew agar pola tetap terlihat. Mask memudarkan tepi menuju batas bagian. Posisi absolut mempertahankan ukuran banner dan carousel; foto kartu artikel tetap digunakan. Saat reduced motion aktif atau video gagal dimuat, latar Honeydew tetap tersedia.

## Halaman Feedback

`/feedback` kini menggunakan layout editorial dua kolom dengan tiga langkah: pilih topik, ceritakan, dan tinjau ulang. Empat kategori memiliki field kontekstual, validasi panjang/opsi/email, dan persetujuan privasi wajib. Email dan screenshot JPG/PNG/WebP (maksimal 10 MB) bersifat opsional. Pratinjau memakai object URL lokal yang dibersihkan saat komponen dilepas; tidak ada unggahan, penyimpanan browser, atau request API.

Pilihan topik tampil sebagai empat tombol merah liquid glass (satu kolom vertikal di desktop maupun mobile). Form detail dan review berada dalam satu panel kaca merah; input memakai permukaan merah yang lebih tenang. Isian dikelompokkan dengan fieldset `Isi laporan` dan `Kontak & lampiran`, diikuti persetujuan privasi serta tombol navigasi. Navbar situs disembunyikan khusus pada `/feedback`. Bar atas tetap menyediakan tautan `Kembali ke beranda` dan informasi langkah. Field menampilkan batas karakter sebelum validasi.

Isian dan lampiran dipertahankan selama navigasi antarlangkah. Draf hilang saat halaman dimuat ulang atau pengguna meninggalkan route. Tombol `Kirim Feedback` sengaja dinonaktifkan dengan penjelasan bahwa pengiriman belum tersedia. Tidak ada loading buatan, sukses palsu, atau nomor laporan rekaan.

Entry dari hasil analisis dapat menggunakan React Router state, misalnya `navigate('/feedback', { state: { feedbackCategory: 'detection', scanReference: realScanReference } })`. Gunakan referensi asli yang tersedia dari hasil analisis; jangan memasukkan konten hasil scan atau informasi sensitif ke query parameter. Tanpa referensi, kolom tetap kosong. Kategori lain yang didukung: `bug`, `idea`, dan `other`.

Logika field, tipe data, dan validasi berada di `src/features/feedback/feedbackModel.ts`; komponen detail/review terpisah dari pengatur langkah `FeedbackPage`. Integrasi FastAPI berikutnya perlu menambahkan service memakai transport `src/services/api.ts` setelah kontrak endpoint ditetapkan. Hanya setelah service nyata dipasang, aktifkan pengiriman, status loading yang mencegah submit berulang, retry tanpa menghapus draf, serta status sukses berdasarkan respons server. Referensi laporan hanya ditampilkan bila disediakan server.

Pengujian `npm run check:routes` mencakup route Feedback, form empat kategori, ID elemen unik, field wajib, batas panjang, opsi yang valid, email, persetujuan privasi, dan parsing entry state.

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


