# AWASIN — Phase 8B Auth & Session Security

5 November 2026. Baseline dan batas izin: `PHASE8_AUDIT.md`.

## Implemented / inspected

- `auth/client.ts`: PKCE, URL detection off, timed fetch, publishable key only;
  reauthentication client tidak menimpa sesi aplikasi.
- `auth/actions.ts`: generic login/recovery responses, local logout dengan notice
  bila revokasi remote belum terkonfirmasi. Tidak ada credential logging.
- `callback.ts`: code/token_hash dibersihkan dari URL, jenis/path dibatasi,
  callback gagal/hash-token ditolak, satu exchange untuk remount StrictMode.
- `passwordSetup.ts`: marker UI 15 menit terikat user dan provider getUser;
  marker bukan authorization. Reset password owner tidak dilakukan.
- `AuthProvider.tsx` / `sessionActivity.ts`: owner/generation guards, expiry idle
  satu jam, fokus/wake/storage sync, background check tidak membongkar form.
- Backend `IdentityService`: signed ES256/RS256 allowlist; iss/aud/exp/sub/session
  divalidasi, online user + database role/profile; JWKS cache bounded dan lock.

## Verified locally

`npm.cmd test -- tests/auth.test.tsx tests/callback.test.tsx
tests/password-setup.test.tsx tests/session-activity.test.ts
tests/session-loading.test.tsx tests/settings-api.test.ts`: **75 PASS / 6 files**.
Mencakup mock network failure, stale identity, guards, recovery invalid/expired,
marker, navigation dan clock-based idle. Bukan bukti browser/cloud baru.

## Verified cloud (reused)

Phase 7 A4 ordinary signup/login, revoked JWT ke FastAPI 401, fresh relogin,
avatar ownership dan session cleanup PASS. Tidak diulang; tidak memakai ulang
kredensial QA retained. Mandatory email confirmation/product MFA tidak ditambahkan.

## Verified browser E2E / blocked

### Kelanjutan dua profil Brave — 5 November 2026

Pengguna menyediakan dua akun login existing pada profil Brave berbeda:
Fiqry Firmansyah (A) dan Fiqry F1 (B). Tidak membuat/reset akun atau membaca
password/token. Kedua dashboard memperlihatkan nama berbeda yang sesuai.
Pada B: refresh, Settings read-only, Back ke dashboard, Forward ke Settings dan
tab dashboard baru semuanya mempertahankan identitas Fiqry F1. Ini PASS aktual
browser untuk restore/navigation/new-tab, bukan same-profile account switching.
Nama tampilan tidak diedit dan tidak ada avatar/History/Feedback dimutasi.

Kelanjutan setelah pengguna mengaktifkan jendela F1: logout melalui menu akun
berhasil. Tab dashboard aktif kembali ke beranda publik; tab Settings lain pada
profil yang sama otomatis menuju `/login`. Navigasi langsung ke `/settings`
setelah logout juga kembali ke `/login`. Logout, sinkronisasi logout antartab,
dan protected-route rejection setelah logout: PASS browser aktual. Observasi AX
pertama segera setelah klik masih menampilkan state lama; screenshot berikutnya
memastikan logout selesai. Fresh relogin/same-profile switching masih menunggu
login manual pengguna. Jendela A tidak dioperasikan selama tes ini.

Scope lanjutan yang diminta pengguna: logout lokal B, verifikasi kedua tab B tidak
lagi membuka protected UI, periksa A tetap login pada profil terpisah, lalu handoff
login manual (tanpa password/token dikirim ke agent). Bila beralih identitas pada
profil B, hanya melalui login manual yang sah; tidak memakai impersonation,
reset password, manipulasi localStorage/JWT, role change atau akun baru. Akhir
yang diinginkan: identitas awal dipulihkan lewat login manual, tab QA tambahan
ditutup, data akun tidak berubah. Idle/expiry memerlukan waktu nyata atau metode
uji terisolasi yang diakui; tidak mengubah jam/proteksi sesi owner.

Kelanjutan final browser: pengguna login manual sebagai Fiqry Firmansyah pada
profil B. Settings memperlihatkan nama baru, tab dashboard lain ikut menampilkan
Fiqry Firmansyah; setelah refresh identitas tetap benar. Logout sesi ini berhasil
dan Settings kembali ke login. Pengguna kemudian login manual kembali sebagai
Fiqry F1: Settings dan dashboard tab lain kembali F1, avatar memakai inisial,
tanpa avatar akun sebelumnya. Tab QA tambahan ditutup; dua tab awal pengguna
(pengaturan profil Brave dan Settings AWASIN) tetap terbuka. Login ulang,
pergantian identitas dua arah dan sinkronisasi antartab PASS aktual. Kontrol sempat
terhenti saat refresh karena ketidakpastian URL; kelanjutan membaca hasil refresh
yang benar sebelum logout. Tidak ada edit profil/avatar/data. Isolasi sesi A asli
setelah logout B kemudian diperiksa melalui AX read-only: profil Brave Fiqry
masih berada pada dashboard Fiqry Firmansyah. Ini bukti isolasi state UI antarpofil,
bukan fresh server authorization request. Idle/wake dan expiry browser masih pending.

### Batas checkpoint awal

Pengguna menunjuk sesi Fiqry. Hanya navigasi/read-only/restore aman; tidak ada izin
reset password, ubah profil/avatar atau pencabutan global sesi owner. Akun kedua
tidak ditunjuk. Browser switch-account dan fresh login tanpa kredensial/handoff
tetap BLOCKED. Inbox recovery belum ditunjuk; delivery dan reset lengkap BLOCKED.
Hasil browser aktual ditambahkan setelah pemeriksaan 8F, bukan diasumsikan lulus.

## Abuse safeguards dan batas

Feedback limiter lokal 5 request/10 menit per worker dan throttle RPC database
tersedia. Signup/login/recovery langsung ke provider; limiter FastAPI tidak
melindungi endpoint Auth Supabase. Kelanjutan dashboard baca-saja memverifikasi
signup/login 30/5 menit/IP, refresh 150/5 menit, verification 30/5 menit dan email
30/jam. CAPTCHA off, provider minimum password 6 (frontend 8), leaked-password
off (Pro), secure password change/require-current-password off. Rincian kontrol
dan proposal P1 pada security audit/provider plan. Proxy trust/enforcement abuse
test tetap belum terbukti; jangan melemahkan controls untuk tes.

Mismatch minimum sandi provider 6 versus frontend 8 kemudian diperbaiki lewat P1
yang disetujui pengguna: Save sukses dan reopen panel memperlihatkan minimum 8,
Save disabled. Tidak ada password akun yang diubah. B01 selesai pada kelanjutan browser; keterbatasan B02/B03
tetap terbuka, bukan DONE atau defer accepted.

Pengamatan idle F1 dimulai konservatif 5 November 2026 pukul 09:55 Asia/Bangkok
(02:55 UTC), setelah pengujian ekspor selesai. Deadline minimal 10:55 lokal;
belum dicatat PASS sebelum observasi browser sesudah deadline. Tidak mengubah
timeout produksi satu jam, marker aktivitas, token atau jam sistem. Pengguna
diminta membiarkan jendela F1 tanpa interaksi; penggunaan aplikasi lain diperbolehkan.

Observasi sesudah deadline: clock UTC 03:55:53 memastikan waktu satu jam telah
lewat; jendela F1 diminimalkan dan pengguna memulihkannya. Setelah Raise dan
screenshot, Settings F1 masih terbuka. Pengguna menyatakan seluruh profil tidak
digunakan selama periode tersebut. Hasil ini **INCONCLUSIVE, bukan PASS**:
timestamp awal marker belum direkam. Diagnostik read-only pada DevTools Application
dengan filter persis `awasin.session-activity` menunjukkan `at=1793851031399`
(03:57:11.399 UTC / 10:57:11.399 lokal), `ended=false`, dan pembacaan berikutnya
tidak berubah. Penanda saat wake ini belum membuktikan kapan/kenapa aktivitas
berubah. Tidak ada token/kredensial dibaca, marker dimutasi, timeout dipendekkan,
atau jam diubah. Konsol menolak paste karena proteksi browser; proteksi tidak
dilewati dan diagnostik dilanjutkan melalui panel Application baca-saja.

Baseline berikutnya sudah terukur: marker di atas harus expired paling awal
04:57:11.399 UTC / 11:57:11.399 lokal jika tidak ada aktivitas baru. Periksa setelah
11:58 lokal, rekam marker/notice/route, lalu tutup panel diagnostik. Bila aktivitas
berubah, jangan mengklaim satu jam idle tanpa bukti penyebabnya. B02 tetap PARTIAL;
belum ada root cause terkonfirmasi yang membenarkan perubahan kode.

### Alternatif waktu virtual — dieksekusi atas pilihan pengguna

Pengguna tidak memiliki waktu untuk pengamatan satu jam berikutnya dan memilih
tes waktu virtual. Pengamatan lanjutan sampai 11:58 dibatalkan; baseline tersebut
tidak menjadi bukti kelulusan live idle. Panel DevTools sementara ditutup dan
Settings F1 dipulihkan. Tidak ada perubahan timeout produksi, jam sistem, token,
marker aktivitas atau data akun untuk mempercepat tes.

Command aktual dari `frontend`:
`npm test -- tests/session-activity.test.ts tests/auth.test.tsx tests/dashboard.test.tsx`
Hasil: **3 files / 65 tests PASS**, exit 0, Vitest duration **5.27 detik**.
Ini subset tes existing, bukan tambahan 65 ke total regresi sebelumnya.

Coverage waktu virtual: tepat satu jam idle; aktivitas sah memperpanjang deadline;
focus/visibility tidak memperpanjang; input pertama setelah sleep memeriksa waktu
sebelum mencatat aktivitas; restore sesi expired; shared activity/ended antartab;
token refresh menit ke-59 tetap menuju Login pada menit ke-60 dan hanya satu
logout lokal; refresh berikutnya tidak menghidupkan protected UI; sesi SDK baru
tidak ikut dicabut oleh tab lama yang expired. Integrasi AuthProvider/ProtectedRoute
menggunakan mocked Supabase SDK; event storage/visibility disimulasikan pada
jsdom. Hasil ini membuktikan logika lokal, bukan penjelasan pasti observasi F1
sebelumnya atau live browser scheduling/provider behavior. B02 tetap PARTIAL.
Pilihan metode tes bukan persetujuan otomatis untuk menerima risiko/gate Phase 8.

## Paket recovery R2, 11 November

Pengguna menunjuk akun existing Fiqry Firmansyah untuk recovery dan mengizinkan
perubahan password saat tes. Target akun yang dikenal dari sesi sebelumnya
`fiqryyw@gmail.com` pada proyek AWASIN. Gunakan browser uji terpisah dari sesi F1
agar pengamatan idle F1 tetap terisolasi. Operasi yang diizinkan mencakup satu
permintaan email pemulihan, pengguna membuka inbox dan menyelesaikan kode serta
pengisian password baru sendiri, kemudian login ulang untuk verifikasi akun.
Kredensial dan kode pemulihan ditangani pengguna. Password baru akan menjadi
kredensial aktif akun setelah penyimpanan berhasil. Verifikasi hasil melalui UI
akun, lalu logout sesi uji recovery. Sesi lain mengikuti kebijakan provider.
Profil, avatar, History, Feedback dan role tidak termasuk operasi paket R2.
Hasil paket dicatat setelah tiap tahap benar-benar diamati.

Pengamatan B02 pada 11 November memakai sesi F1 existing. Penanda aktivitas dibaca
melalui Application dengan filter persis kunci aktivitas. Baseline `at` bernilai
1794362158916, yaitu 01:55:58.916 UTC (08:55:58.916 WIB), `ended=false`.
Deadline satu jam 02:55:58.916 UTC (09:55:58.916 WIB). Pengguna diminta membiarkan
tab AWASIN F1 tanpa interaksi. Pengamatan sesudah deadline diperlukan sebelum
menyatakan hasil. Diagnostik membaca timestamp dan ended saja.
