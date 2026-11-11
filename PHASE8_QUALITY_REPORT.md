# AWASIN — Phase 8E Quality

5 November 2026. Tidak ada redesign atau speculative code splitting.

## Accessibility: defect dan perbaikan

Browser guest menunjukkan submit Login kosong mengumumkan error tetapi fokus
tetap pada tombol Masuk. `LoginPage.tsx` sekarang memfokuskan input pertama yang
invalid. Regresi di `auth.test.tsx` FAIL sebelum fix, kemudian **41/41 PASS**.
Error tetap dihubungkan melalui aria-invalid/aria-describedby dan role alert;
tidak memanggil Auth untuk form kosong. Verifikasi ulang browser pada 8F.

## Browser responsive / guards yang benar-benar dijalankan

- IAB guest terpisah: `/dashboard`, `/settings`, `/history` dan lima route Admin
  semuanya redirect ke `/login` dengan heading Login aktual.
- Login/Education/Feedback masing-masing pada requested viewport 375, 768, 1440:
  **9 kasus**, satu h1, scrollWidth sama clientWidth. Halaman panjang menggunakan
  scrollbar 15 px, sehingga content width 360/753/1425; ini bukan salah viewport.
- Pengukuran pertama sempat membaca transisi sebelum halaman stabil (h1=0), maka
  tidak dipakai. Pengukuran final menunggu heading spesifik halaman dan snapshot.
  Satu nama heading awal salah whitespace; diperbaiki berdasarkan DOM aktual.
- Viewport override sudah reset. Tidak mengirim Feedback, signup atau recovery.
- Native Fiqry/read-only dan batas hasil lanjut dicatat pada 8F. Firefox, physical
  device dan screen reader NOT RUN. Tidak menyatakan full WCAG compliance.

## Reliability

Existing suite mencakup provider unavailable, bounded fetch/abort, safe error
messages, pending session, stale async responses, route boundaries, retry dan
partial-save reporting. Perubahan Phase 8 memperluas actual-byte body cap serta
menolak stale/aborted export. Jangan menganggap mock outage sebagai outage cloud
yang benar-benar disimulasikan. Tidak mematikan provider atau jaringan pemilik.

## Performance / dependencies

Baseline Phase 7 main ~792 kB; historical sourcemap source-byte contributors ada
di PHASE7_IMPLEMENTATION.md (bukan ukuran minified contribution). Root Auth/
Preferences/Motion memang dipakai shell, route chunks/jsQR sudah lazy. Tidak
menambah library atau mengubah warning threshold. Build terbaru dicatat pada 8F.
Network waterfall/CPU/cold-warm/throttling belum terukur; browser DOM proxy tidak
dianggap profiler. Optimization memerlukan baseline runtime yang sesuai dahulu.

`npm.cmd audit --omit=dev --json` pada 5 November: **0 runtime vulnerabilities
reported** oleh registry. Ini snapshot advisory database, bukan jaminan bebas
kerentanan atau audit lengkap backend/build toolchain. Batas lainnya ada pada 8F.

Contrast Settings dan semantic meter/output fixes dari Phase 7 dipertahankan.
Tidak melakukan cloud avatar/Feedback/CMS/Registry writes baru.

## Kelanjutan tes sesi cepat

Atas pilihan pengguna, pengamatan idle lanjutan satu jam dihentikan dan subset
existing dijalankan ulang dengan waktu virtual:
`npm test -- tests/session-activity.test.ts tests/auth.test.tsx tests/dashboard.test.tsx`
**65 PASS / 3 files, 5.27 detik, exit 0**. Menguji idle/wake/shared storage,
refresh token, protected route dan isolasi account state memakai jsdom/mocked SDK.
Timeout produksi tetap satu jam. Tidak ada tes baru atau perubahan source-code
untuk alternatif ini. Live idle F1 sebelumnya tetap INCONCLUSIVE; bukan PASS.

## Kelanjutan regresi dan audit dependensi

7 suite frontend Auth, Dashboard, Session Loading, Admin, History API, Settings
API dan Feedback API lulus **104 tes**. Backend lulus **131 tes** dalam 21,75 detik
dengan satu warning deprecation Starlette/httpx. Percobaan backend dalam sandbox
tertahan pada socket loopback asyncio, sehingga tes diselesaikan dengan akses
loopback di luar sandbox. Fixture dan mock transport dipertahankan. B16 selesai
untuk skenario lokal error aman, offline, retry, race dan respons rusak.

Audit registry npm penuh mencatat 10 laporan moderat, 0 high dan 0 critical.
Seluruh laporan tersebut berasal dari advisory [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
pada `minimatch` 10.2.6 dalam rantai ESLint dan typescript-eslint. Lockfile
menandai paket ini sebagai dependensi dev. Perbaikan upstream menurut advisory
mulai 11.0.1, di luar rentang mayor yang dipakai ESLint saat ini. Perbaikan
otomatis npm mengusulkan perubahan mayor ESLint dan penurunan versi
typescript-eslint.

Kelanjutan 11 November menutup B26 melalui override terbatas
`minimatch@10` ke versi patched `11.0.1`. Lockfile memperbarui minimatch dan satu
dependensi transitifnya. Install memakai `--ignore-scripts`. Audit npm penuh
menghasilkan 0 advisory. ESLint API sebelum/sesudah memeriksa 149 file yang sama,
masing-masing 0 error dan warning. `npm test` lulus 241 tes dalam 22 file.
TypeScript/Vite build lulus. Ukuran bundle utama tetap 792.93 kB (gzip 243.85 kB).
Override lint melintasi satu versi mayor transitif. Uji cakupan file, lint, build
dan regresi memeriksa kompatibilitas pemakaian proyek ini. Tinjau penghapusan
override ketika ESLint dan typescript-eslint upstream memakai minimatch patched.

Audit browser 11 November pada Settings F1 membuktikan tautan lewati navigasi
memperlihatkan fokus keyboard, dialog Hapus riwayat memiliki judul serta kontrol
batal/konfirmasi, dan Escape menutup dialog kembali ke Settings. Tidak ada
penghapusan yang dijalankan. Trace DevTools pada viewport mobile 412×922 mencatat
LCP 1.52 detik dan CLS 0.35. Trace development memakai CPU/network tanpa throttle.
Insight tidak dapat menentukan elemen pemicu layout shift. Perubahan emulasi dan
restore scroll perlu dieliminasi pada pemeriksaan ulang sebelum memilih fix.
B14 tetap terbuka. Viewport emulasi dipulihkan sesudah pengukuran.
