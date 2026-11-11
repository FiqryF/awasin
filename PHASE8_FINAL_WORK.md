# AWASIN — Rekap Phase 8

11 November 2026 · Cakupan pengembangan lokal dan verifikasi cloud yang sudah disetujui.

Perbaikan terakhir menyelesaikan pergeseran halaman Pengaturan saat dimuat. Regresi lokal lulus. Verifikasi produksi, riwayat dari engine nyata, serta uji Firefox dan pembaca layar masih terbuka.

## Perubahan terakhir

- **B05 — Batas percobaan autentikasi.** Login dan pendaftaran menampilkan pesan yang jelas saat provider membatasi percobaan. Pesan pemulihan tetap netral agar tidak mengungkap keberadaan akun. Regresi mencakup respons pembatasan dan alur autentikasi yang sudah ada.
- **B14 — Pergeseran halaman Pengaturan.** Loader layar penuh memakai posisi tetap sehingga area konten kosong saat modul halaman dimuat. Footer sempat berada dalam viewport lalu terdorong oleh konten. CSS sekarang menyediakan ruang setinggi viewport selama loader aktif di area konten. Probe sementara sudah dilepas.
- **B15 — Pemeriksaan Pengaturan di browser.** Sesi F1 diuji di Brave pada lebar 958 dan 393 px. Pada lebar 393 px, halaman Privasi & Data tidak memiliki gulir horizontal dan tautan kembali ke beranda memiliki nama aksesibel. Bukti sebelumnya mencakup fokus error formulir, Escape dan pengembalian fokus dialog, serta tes reduced motion.

### Pengukuran Pengaturan

Reload lokal pada halaman Privasi & Data menggunakan sesi uji F1.

| Lebar | Kondisi | CLS | LCP |
| --- | --- | ---: | ---: |
| 958 px | Sebelum perubahan | 0,3500 | 396 ms |
| 958 px | Sesudah perubahan | 0,0002 | 1.300 ms |
| 393 px | Sesudah perubahan | 0,0005 | 896 ms |

Sampel ini menunjukkan pergeseran footer hilang. LCP bervariasi antarreload. Build masih memperingatkan ukuran chunk utama 793,14 kB (243,94 kB gzip). Profiling bundle dan pengukuran berulang pada build produksi masih terbuka.

## Status pekerjaan Phase 8

| ID | Pekerjaan dan bukti | Status |
| --- | --- | --- |
| B01 | Login, logout, login ulang, pergantian identitas dan navigasi antartab diuji dengan sesi browser aktual. | Terverifikasi |
| B02 | Setelah satu jam idle, sesi F1 menampilkan pesan keluar otomatis dan akses langsung ke Pengaturan dialihkan ke login. Tes waktu virtual dan bukti penolakan token yang dicabut tersedia. | Terverifikasi |
| B03 | Pengguna menerima kode pemulihan, mengganti sandi, lalu berhasil masuk dengan sandi baru. | Terverifikasi |
| B04 | Batas body 256 KiB untuk write API dan 32 KiB untuk Feedback. Permintaan melebihi batas mengembalikan HTTP 413 pada pengujian lokal. | Terverifikasi |
| B05 | Login dan signup tercatat 30 percobaan per 5 menit per IP. Minimum sandi provider dinaikkan dari 6 ke 8 sesuai persetujuan dan diverifikasi kembali. | Cakupan dev selesai. CAPTCHA dan uji anti-abuse terisolasi masih terbuka sebelum peluncuran publik. |
| B06 | Pemeriksaan RLS, akses owner/Admin, dan regresi History/Admin lokal lulus. Bukti cloud baca-saja dan skenario Phase 7 dipakai kembali. | Terverifikasi pada cakupan tes |
| B07 | Audit katalog cloud baca-saja dan PGlite mencocokkan 7 dari 7 checkpoint migrasi 001–007. Ledger cloud standar belum tersedia. Migrasi yang sudah diterapkan tidak dijalankan ulang. | Audit selesai. Rekonsiliasi ledger menunggu backup dan pembandingan skema sebelum migrasi cloud berikutnya. |
| B08 | Dashboard Supabase Free menunjukkan backup terjadwal tidak tersedia. Backup dan restore sintetis PGlite lulus untuk kesetaraan baris, RLS, dan hash berkas avatar uji. | Simulasi lokal selesai. Restore snapshot cloud dan berkas Storage memerlukan lokasi simpan berizin dan target restore terisolasi. |
| B09 | Ekspor dari sesi F1 menghasilkan JSON v2 sebesar 443 byte, identitas sesuai, tanpa kolom rahasia. Cakupan akun berisi data diuji di backend. | Terverifikasi |
| B10 | Desain penghapusan disetujui. Tes sintetis mencakup cascade, isolasi akun, dan retry metadata Storage. | Desain dan tes lokal selesai. Endpoint penghapusan aktual, pembersihan berkas Storage, dan masa retensi audit/backup masuk Phase 11. |
| B11 | Regresi History untuk persetujuan simpan, opt-out, hapus, dan batas akses lulus pada cakupan lokal. | E2E menunggu laporan dengan provenance dari engine Phase 10. |
| B12 | Bukti avatar Phase 7 A4 mencakup 33 pemeriksaan lulus dan pembersihan avatar uji. | Terverifikasi sebelumnya |
| B13 | Skenario cloud Feedback, CMS, dan Registry (D/E/F) serta audit Phase 7 sudah diverifikasi. | Terverifikasi sebelumnya |
| B14 | Pergeseran footer diperbaiki dan diukur ulang di Brave. | Perbaikan CLS selesai. Evaluasi ukuran bundle masih terbuka. |
| B15 | Pemeriksaan Chromium, mobile, fokus, keyboard, dan reduced motion tersedia. | Firefox dan pembaca layar aktual masih terbuka. |
| B16 | Regresi untuk API tidak tersedia, timeout, race, identitas lama, dan pesan error aman lulus. | Terverifikasi pada cakupan tes |
| B17–B25 | Deployment dan final gate masuk Phase 11, kontrak analisis masuk Phase 9, dan lima engine masuk Phase 10. | Fase berikutnya |
| B26 | Override minimatch ke 11.0.1. Audit npm penuh pada pemeriksaan sebelumnya melaporkan nol advisory dan lint tetap mencakup 149 file. | Terverifikasi sebelumnya |

## Verifikasi akhir

- Frontend `npm test` lulus, 250 tes di 22 file.
- Frontend `npm run lint` dan `npm run build` lulus. Build menggunakan URL API placeholder melalui environment proses lokal.
- Frontend `npm run check:history-db` lulus pada PGlite.
- Backend `python -m pytest -q` lulus, 131 tes. Dua warning terkait deprecation TestClient dan cache pytest. Tes dijalankan di luar sandbox karena TestClient memerlukan socket loopback lokal.

Pengerjaan dilakukan di workspace. Tidak ada commit, push, atau deployment.
