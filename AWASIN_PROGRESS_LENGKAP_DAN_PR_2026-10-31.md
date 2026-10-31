# AWASIN — Progres Lengkap dan PR Pengembangan

**Tanggal rangkuman:** 31 Oktober 2026, Asia/Bangkok  
**Cakupan:** pekerjaan awal UI, Phase 1–6, integrasi cloud, perbaikan bug, clean code, pengujian, dan pekerjaan yang belum selesai.

## 1. Cara membaca laporan ini

Dokumen ini menyatukan percakapan dan laporan implementasi yang sudah ada, lalu mencocokkannya dengan kondisi repository saat penyusunan. Status terbaru di dokumen ini mengesampingkan status historis seperti “migrasi cloud belum diterapkan” atau “admin masih placeholder” pada laporan lama.

Pada 31 Oktober dilakukan pemeriksaan laporan, kode tertentu, struktur modul, launcher, dan Git. **Tidak dilakukan ulang seluruh tes, pengujian cloud, perubahan database, atau audit keamanan baru pada hari penyusunan dokumen ini.** Angka tes dan hasil cloud di bawah adalah hasil eksekusi sebelumnya yang tercatat, terutama 29–30 Oktober 2026.

Istilah status:

- **Diimplementasikan:** kode/alur tersedia; belum otomatis berarti seluruh skenario cloud atau produksi sudah teruji.
- **Terverifikasi lokal:** dibuktikan melalui unit/DOM/API mock, kompilasi, atau PostgreSQL lokal PGlite.
- **Terverifikasi cloud:** benar-benar diuji terhadap Supabase aktif pada cakupan yang disebutkan.
- **PR:** belum dikerjakan, belum diverifikasi, atau masih membutuhkan prasyarat.

## 2. Kesimpulan kondisi proyek

AWASIN sudah memiliki landing page, autentikasi, dashboard pengguna, workspace enam mode input, riwayat/detail, pengaturan akun, edukasi, Feedback, dan workspace administrator. Frontend dan FastAPI sudah terhubung ke Supabase untuk fitur akun serta penyimpanan yang diimplementasikan.

**Engine analisis keamanan belum tersedia.** Memasukkan URL, mengunggah file untuk preview lokal, atau membaca isi QR belum menghasilkan penilaian keamanan. Aplikasi tidak boleh mengarang skor risiko, hasil deteksi, atau laporan analisis selesai.

Phase 6 beserta tiga uji tulis cloud yang secara spesifik disetujui sudah diselesaikan. Namun, **seluruh aplikasi belum dinyatakan siap production**: pemulihan sandi email nyata, pengujian lifecycle browser penuh, backup/restore, deployment, dan sejumlah pengujian keamanan masih menjadi PR.

| Area | Status terbaru | Batas penting |
| --- | --- | --- |
| Landing dan identitas visual | Diimplementasikan, diuji lokal/browser pada cakupan terdokumentasi | Bukan audit seluruh perangkat/browser |
| Login/register/identitas | Diimplementasikan; signup/login dua akun uji nyata lulus | Registrasi saat ini tidak membuktikan kepemilikan email |
| Logout dan idle | Diimplementasikan; logout/revocation cloud dua akun lulus | Idle satu jam merupakan kebijakan browser |
| Dashboard pengguna | Diimplementasikan | Aktivitas nyata tergantung data pengguna |
| Enam mode pemeriksaan | Input/validasi/preview tersedia | Engine keamanan belum ada |
| QR | Decoder lokal tersedia | Isi QR bukan verdict keamanan; kamera belum tersedia |
| Riwayat/detail | API, UI, RLS, consent dan pengujian lokal tersedia; skema cloud aktif | Alur completed report nyata masih menunggu engine |
| Profil/preferensi/ekspor | Diimplementasikan; sebagian persistensi dan isolasi cloud teruji | Ekspor dibatasi dan tidak boleh menghasilkan data parsial diam-diam |
| Edukasi | Empat artikel asli tersedia melalui CMS cloud | Artikel uji tidak diterbitkan |
| Feedback | Pengiriman tamu/akun dan receipt cloud nyata teruji | Tidak ada email balasan atau SLA otomatis |
| Admin | Lima halaman dan API/RPC/RLS/audit diimplementasikan | Pengujian negatif akun user biasa terhadap semua endpoint Phase 6 di cloud belum lengkap |
| Deployment/operasional produksi | Belum dituntaskan | HTTPS, backup, recovery, abuse control dan monitoring perlu verifikasi |

## 3. Pekerjaan awal sebelum rangkaian phase

### Identitas visual dan landing page

- Logo berbasis elemen diganti dengan dua aset logo AWASIN dari pengguna untuk menyesuaikan transisi honeydew dan blood red.
- Logo dan teks AWASIN diberi kapsul liquid glass; ukuran logo, teks, padding, panjang kapsul, serta alignment disesuaikan melalui beberapa iterasi.
- Gaya glass diselaraskan dengan navigasi kanan agar identitas tidak bertabrakan dengan konten.
- Video landing yang sudah ada dipertahankan sesuai pilihan pengguna: `frontend/public/assets/video/hero.mp4`.

### Halaman akun dan dokumen legal

- Layout login/register diperbaiki: margin kiri, proporsi headline, ukuran form, serta kepadatan ruang.
- Input dan tombol memakai gaya liquid glass; label tombol utama ditengahkan dan panah yang diminta dihapus.
- Tombol kembali dibuat berupa ikon, dengan posisi dan jarak konsisten terhadap halaman Feedback.
- Pada lupa sandi, link kembali tambahan di bawah form dihapus; tombol back mengarah ke login.
- Garis dekorasi lingkaran dihilangkan; gradasi bulat/animasi diatur pada kiri atas dan kanan bawah.
- Ketentuan Penggunaan dan Kebijakan Privasi ditampilkan sebagai dialog, disesuaikan dengan fitur AWASIN yang benar-benar tersedia.
- Pengguna menyatakan belum memiliki identitas pengelola/kontak resmi. Dokumen tidak boleh mengarang kontak atau janji layanan yang belum tersedia.
- Dialog legal diperbaiki untuk aksesibilitas/fokus, kontras, dan kompatibilitas atribut dialog dengan analyzer yang digunakan.

### Audit struktur dan setup PC

- Struktur frontend/backend/database ditinjau, termasuk membedakan folder persiapan backend dari file yang benar-benar tidak terpakai.
- Atas permintaan pengguna, root `package-lock.json` dan `frontend/.qa/` dihapus. Pada pemeriksaan 31 Oktober keduanya memang tidak ada. Lockfile frontend tidak termasuk permintaan penghapusan tersebut.
- Konfigurasi development PC disiapkan untuk project Supabase yang sama. Nilai kredensial tidak dicantumkan di laporan ini.
- `start-dev.ps1` menyediakan satu perintah untuk menyalakan atau memakai ulang frontend/backend yang sehat.

## 4. Phase 1 — User Dashboard Foundation

- Dashboard pengguna memakai identitas yang diverifikasi FastAPI dan role database, bukan metadata role yang dapat diedit pengguna.
- Sapaan dan menu profil mengambil data akun nyata; tidak membuat identitas atau aktivitas palsu.
- Landing dan dashboard menggunakan komponen bersama untuk hero, pemeriksaan, edukasi, navbar, dan footer.
- Navigasi akun menyediakan Beranda, Periksa, Riwayat, Edukasi, Feedback, serta menu profil/pengaturan/logout.
- Menu mendukung keyboard, Escape, klik di luar, pengembalian fokus, dan penutupan saat navigasi.
- Pergantian akun membersihkan state lama agar data pengguna sebelumnya tidak ditampilkan ke akun berikutnya.

## 5. Phase 2 — Scan Workspace, History dan Analysis Detail

### Workspace input

Enam mode: **Link, Pesan, Website, QR Code, Gambar, Video**. Gambar/video adalah dua mode media yang berbagi fondasi, bukan dua engine yang sudah aktif.

- Link menerima HTTP(S), tanpa otomatis membuka situs tujuan.
- Website dapat menormalisasi domain tanpa mengunjunginya.
- Pesan menyediakan teks multiline dan penanganan input/screenshot lokal sesuai alur yang tersedia.
- Gambar JPG/PNG/WebP dibatasi maksimal 10 MB; preview dan pelepasan object URL ditangani.
- Video MP4/WebM dibatasi maksimal 50 MB; metadata/preview bersifat lokal.
- QR memeriksa signature, ukuran/resolusi, membatasi pemrosesan, dan memakai decoder lokal `jsqr` yang dimuat dinamis.
- Hasil QR ditampilkan sebagai teks; URL tidak dikunjungi otomatis. Respons async lama diabaikan jika file dihapus atau mode berganti.
- Pergantian mode membersihkan input; Periksa Lagi meneruskan mode tanpa menaruh pesan mentah atau URL sensitif ke query string.

**Batas:** belum ada upload scan untuk analisis server/provider, kamera QR, atau penilaian phishing/manipulasi media nyata. Mode tanpa engine menampilkan ketidaktersediaan layanan dengan jujur.

### Riwayat dan detail

- Tabel kanonis `scan_reports` menyimpan owner, mode, status, ringkasan, provenance engine, dan hasil terstruktur.
- Laporan selesai harus mempunyai provenance engine; browser tidak berhak menciptakan temuan/provenance sendiri.
- Penyimpanan memerlukan persetujuan eksplisit dan mengikuti preferensi retensi akun.
- Riwayat mendukung pencarian/filter server, urutan waktu, keyset pagination, detail, kosong, gagal/retry, dan konfirmasi hapus.
- Penghapusan memeriksa jumlah row yang benar-benar terhapus; kegagalan tidak disamarkan sebagai sukses.
- JWT caller, pemeriksaan owner dan RLS menahan akses lintas pengguna.
- Request tertunda dibatalkan/diabaikan setelah pergantian akun.

**PR:** pengujian cloud save/detail/delete/pagination/reference dengan completed report sah masih membutuhkan engine. Empty history dan fixture lokal tidak sama dengan bukti completed-report E2E.

## 6. Phase 3 — Account Settings, Security dan Privacy

### Profil

- Nama tampilan nyata dapat diperbarui, dengan trimming dan validasi panjang.
- Hanya field yang diizinkan dikirim; identitas global di-refresh agar menu/dashboard ikut berubah.
- Email read-only dan avatar berupa inisial. Upload avatar dan perubahan email belum diimplementasikan.

### Keamanan akun

- Kebijakan kata sandi bersama Register/Reset: 8–128 karakter dan konfirmasi sesuai.
- Perubahan kata sandi memverifikasi kredensial melalui client SDK nonpersistent terpisah, dengan kecocokan ID pengguna.
- Password tidak dimasukkan ke profil, URL, log, atau persistent storage form.
- Logout memakai alur SDK yang tersedia; tidak menjanjikan pencabutan seluruh perangkat.
- Product-level MFA/2FA tidak ditambahkan. Bootstrap administrator historis tidak diubah untuk membuat alur baru.

### Privasi dan preferensi

- Retensi `manual` mempertahankan pilihan simpan per laporan; `disabled` menolak simpan laporan baru, termasuk di RPC.
- Opt-out tidak otomatis menghapus data lama.
- Hapus riwayat tidak berarti menghapus profil, Feedback, atau akun.
- Ekspor JSON meliputi profil, preferensi, laporan tersimpan dan Feedback terkait akun; batas 500 laporan dan 500 masukan. Kelebihan batas/ketidaklengkapan menghasilkan kegagalan, bukan ekspor parsial yang diklaim lengkap.
- Preferensi animasi system/reduced diterapkan pada motion/video yang relevan.
- Mutasi tertunda ditolak jika akun aktif berubah.

**Belum tersedia:** penghapusan akun lengkap, perubahan email, avatar storage, dan prosedur retensi/hak data operasional yang lengkap.

## 7. Phase 4 — Integrasi UX dan Final Polish

- Route, judul halaman, error boundary/recovery, lazy loading, focus/announcer dan state bersama dirapikan.
- Pusat edukasi berisi empat artikel asli: phishing/link, pesan/OTP, keamanan QR, dan keaslian media, lengkap dengan sumber dan bacaan terkait.
- Feedback menyediakan empat kategori: Kesalahan Deteksi, Laporan Bug, Ide & Saran, dan Feedback Lainnya.
- Alur Feedback tiga tahap: pilih topik, ceritakan, tinjau ulang; validasi, persetujuan privasi, draft lokal, loading/gagal dan receipt nyata.
- Pengiriman sukses baru dinyatakan setelah backend/database mengonfirmasi; tidak membuat receipt palsu.
- Feedback kesalahan deteksi memakai referensi laporan, dengan pemeriksaan kepemilikan; bukan menyalin hasil mentah ke URL.
- Tampilan publik dan akun diperiksa pada viewport yang terdokumentasi. Ini bukan audit seluruh perangkat atau pembaca layar.

## 8. Perbaikan autentikasi, navigasi, loading dan popup

### Sesi dan logout

- Sesi lama bertahan karena persistSession/autoRefreshToken; ditambahkan kebijakan **60 menit tanpa aktivitas manusia**.
- Aktivitas pointer/klik/ketikan/scroll/sentuhan pada halaman terlihat memperbarui timestamp; token refresh dan request API tidak memperpanjang idle.
- Timestamp sesi nonrahasia disinkronkan antar-tab pada origin yang sama. Token tidak disimpan oleh monitor aktivitas tersebut.
- Reload, sleep/wake, respons lama, pergantian sesi dan race idle/logout ditangani.
- Request Supabase mendapat timeout aplikasi; kegagalan pencabutan remote dibedakan dari sesi lokal yang sudah dibersihkan.
- Logout manual kembali ke halaman publik sebelum login, disertai notifikasi hasil sebenarnya.

**Batas:** idle di browser bukan server-side inactivity enforcement untuk semua token. Jika browser berhenti berjalan, pemeriksaan dilakukan ketika kembali aktif. Storage yang diblokir membatasi persistensi timestamp.

### Ketidaksesuaian status login

- Root sebelumnya bisa menampilkan hero tamu sementara header sudah mengikuti akun login. Root kini menunggu identitas terverifikasi dan menuju tujuan role yang sesuai.
- Login menggunakan refresh AuthProvider yang sama agar tidak berlomba dengan pemeriksaan identitas terpisah.
- Request identitas untuk token sama dibagikan; generation guard menahan respons usang setelah logout.
- Penolakan token baru akibat issued-at sedikit mendahului jam backend direproduksi dalam tes. Toleransi lima detik diterapkan hanya pada issued-at; signature, expiry, issuer, audience, role dan sesi tetap diperiksa.

### Navigasi dan refresh

- Indikator aktif navbar yang semula berbeda antara Beranda/Periksa dan Edukasi/Riwayat disatukan.
- Pendekatan shared-layout yang masih tidak stabil kemudian diganti **satu indikator tetap** yang mengukur serta menganimasikan posisi/ukuran link aktif.
- Tema route dalam dan observasi konten lazy diperbaiki agar logo/header tidak salah warna saat refresh Edukasi.
- Full refresh pada beranda/dashboard menghapus hash section lama dan kembali ke hero; route lain tidak dipaksa ke home.
- Reduced motion tetap dihormati.

### Notifikasi dan loading

- Login/logout memakai pemberitahuan berbasis hasil autentikasi, bukan popup sukses sebelum operasi selesai.
- Notifikasi diletakkan di tengah dengan icon/status, animasi masuk/keluar dan progress durasi tampil; preferensi reduced motion ditangani.
- Session loading menampilkan animasi saat verifikasi sehingga refresh tidak hanya memperlihatkan area kosong/header/footer.
- Kontras CSS dan promise bertingkat pada motion notifikasi dirapikan.

## 9. Phase 5 — Supabase Cloud Integration dan Verification

### Perubahan cloud yang sudah diselesaikan

- Project: `awasin`, ref `nqruowgbxiopfhslznyb`. Aplikasi masih development, tetapi dashboard memberi label **main / PRODUCTION**. Label ini tidak berarti database boleh dianggap disposable.
- Objek identitas 001 yang sudah ada diaudit; migrasi tersebut tidak dijalankan ulang.
- Migrasi 002/history, 003/preferences dan 004/Feedback diterapkan setelah persetujuan target yang tepat.
- Profil/preferensi sementara, Feedback tamu/akun, receipt, ekspor dan kondisi riwayat kosong diuji pada cakupan yang tercatat; nilai uji sementara dipulihkan.
- Pengguna menyetujui penonaktifan Confirm email pada branch exact tersebut. Signup sekarang langsung memperoleh sesi; kepemilikan inbox **tidak dibuktikan**.
- Registrasi diperbaiki agar menuntut sesi dan identitas backend yang cocok; tidak menganggap respons tanpa sesi sebagai keberhasilan login.
- Route verifikasi email lama dipertahankan sebagai compatibility redirect, bukan gate wajib baru.

### Dua akun uji dan keamanan

- Dua ordinary test users dibuat melalui alur SDK/action yang diizinkan, dengan password acak yang tidak dicatat di laporan.
- **51 pemeriksaan integrasi cloud yang tersedia lulus**, termasuk own/cross-user profile dan preferensi, Feedback privat/ekspor, penolakan admin, metadata role escalation, restore/login/logout/revocation pada cakupannya.
- Contact email pada Feedback tamu tidak membuat Feedback tersebut menjadi milik akun yang mendaftar dengan email sama.
- JWT lama dan refresh token sesi uji yang sudah dicabut diperiksa; akun uji di-logout.
- Akun/data uji dipertahankan sesuai izin; tidak ada klaim cleanup deletion.

### PR Phase 5 yang tetap berlaku

- Forgot/reset password dengan inbox nyata yang dikuasai pengguna belum diuji E2E.
- Full browser reload/cross-tab/idle satu jam/sleep-wake belum diulang lengkap terhadap akun cloud.
- Completed report nyata belum tersedia karena engine belum ada.
- Deployment HTTPS, redirect production, SPA fallback dan full backup/restore belum terbukti.

Karena batas tersebut, laporan Phase 5 tetap menyebut **security verification pending**, meskipun aktivasi cloud dan 51 pemeriksaan yang tersedia sudah selesai.

## 10. Phase 6 — Admin Dashboard dan Management System

### Modul yang tersedia

1. **Ringkasan:** agregat nyata Feedback, registry, artikel terbit dan aktivitas audit; tidak ada statistik deteksi palsu.
2. **Feedback:** pencarian/filter/pagination server, detail asli, status new/in_review/resolved, catatan internal dan optimistic version.
3. **Registry:** organisasi, kandidat domain manual, bukti HTTPS/deskripsi, keputusan reviewer, dan status pending_review/verified/rejected/archived.
4. **CMS Edukasi:** structured editor, preview, draft/publish/archive, sumber rujukan, gambar lokal dan slug existing yang tidak dapat diubah.
5. **Audit:** event baca-saja dengan actor database dan metadata status/version yang aman.

### Arsitektur dan batas keamanan

- Menggunakan autentikasi/role yang sudah ada. Frontend guard bukan satu-satunya kontrol.
- FastAPI memeriksa administrator; RPC PostgreSQL memeriksa ulang role serta sesi aktif.
- Request memakai JWT pengguna dan publishable key. Tidak menaruh service-role key pada browser.
- Mutasi, pemeriksaan versi dan audit berada dalam satu transaksi; actor berasal dari auth.uid(), bukan input browser.
- Lima tabel baru memakai forced RLS; application roles tidak mendapat direct write grants.
- Private handling notes dipisahkan agar tidak bocor melalui hak baca Feedback existing.
- Domain dinormalisasi memakai IDNA dan offline Public Suffix List. IP, suffix-only, URL/path dan format yang tidak sah ditolak; homograph tidak disamakan diam-diam.
- Mengubah domain/bukti membatalkan verifikasi sebelumnya. Hubungan organisasi yang diverifikasi bukan jaminan keamanan website.
- Tidak ada pengumpulan domain otomatis, crawler, DNS discovery atau engine yang dibangun di phase ini.
- Artikel berbentuk teks terstruktur, bukan HTML executable. Endpoint publik selalu meminta published content dengan akses anonymous, termasuk saat browser login admin.

### Migrasi dan transisi artikel

- 005 `202610290005_admin_workspace.sql` dan 006 `202610290006_education_seed.sql` disetujui dan diterapkan ke main / PRODUCTION pada 29 Oktober.
- Tabel: feedback_handling, registry_organizations, registry_domains, education_articles, admin_audit_events.
- Empat artikel cloud dibandingkan secara mendalam dengan objek sumber asli, termasuk Unicode. Seluruh isi cocok.
- CMS lokal diaktifkan setelah kesetaraan terbukti. Ketika CMS gagal, UI tidak menghidupkan kembali konten lokal yang sudah ditarik dari publik.
- Empat event seed dinyatakan sebagai import, bukan tanggal publikasi historis yang dibuat-buat.
- Metadata/fingerprint yang diperiksa membuktikan data profil, role dan Feedback asli tetap sama sebelum/sesudah operasi terkontrol.

### Tiga uji tulis cloud yang sudah selesai

| Uji | Keadaan akhir terverifikasi |
| --- | --- |
| Feedback receipt dbe26222-98eb-474e-b419-dcc45bc5506b | Sempat in_review dengan catatan uji; dikembalikan ke new, catatan kosong, version 3; isi asli tidak berubah |
| Organisasi UJI PHASE 6 - QA 20261029 dan kandidat phase6-20261029.example.com | Organisasi tersimpan; kandidat dibuat pending lalu archived; verified_at null; tidak pernah diverifikasi |
| Artikel uji slug uji-phase6-20261029 | Dibuat draft, diedit, dibaca ulang/preview lalu archived, version 3; tidak pernah published; URL publik 404 |

ID organisasi: fd20341b-6d8a-4ca5-8ff5-5b70cb084325. ID kandidat: 5ef49ec6-c0fa-49fa-8822-54ed8ad75e24. ID draf: a6ec3806-bff2-4adc-a35f-bc05ef9c0964.

Audit akhir menunjukkan **12 event**, termasuk **8 tindakan uji** yang seluruh actornya memiliki role administrator. Event publikasi artikel uji berjumlah nol; artikel publik asli tetap empat. Seluruh test record/audit dipertahankan sesuai persetujuan.

### Bug yang diperbaiki saat QA admin

- Editor yang ditumpuk di layar sempit kini menerima fokus pada heading dan mengembalikan fokus ketika ditutup.
- Dialog konfirmasi menghilang karena StrictMode menjalankan ulang effect: cleanup dialog.close() memicu onClose yang mengosongkan state parent. Penutupan teardown dipisahkan dari pembatalan pengguna. Reproduksi gagal sebelum fix, lalu lulus; arsip domain/artikel nyata juga berhasil.
- Clipboard SQL pernah mengubah Unicode pada komentar. Seed menggunakan transport ASCII dengan escape Unicode dan diverifikasi pada objek cloud yang sudah didekode; bukan menganggap jumlah row sebagai bukti kesetaraan isi.

## 11. Clean code dan temuan SonarQube

Perbaikan dilakukan bertahap terhadap screenshot yang dikirim, termasuk batch 49 temuan, temuan skrip/history/auth, serta batch terakhir **30 temuan pada 30 Oktober**.

Kategori perbaikan:

- Regex berisiko backtracking, kompleksitas fungsi, nested ternary/template dan kondisi satu baris ambigu.
- Kontras teks/CSS, selector ganda, specificity dan penggunaan important.
- Props/context readonly, import ganda, context value stabil dan optional chaining.
- Event handler elemen non-interaktif, elemen status/group semantik, aksesibilitas dialog dan type tombol eksplisit.
- Deprecated event type, penamaan catch, replaceAll, Error construction dan code point Unicode.
- Pengujian async/migrasi diurutkan melalui helper sequential; role database bersama tidak dijalankan paralel secara sembarangan.
- Key berbasis indeks pada editor artikel diganti ID lokal stabil; ID dibuang sebelum mengirim payload ke backend.

Tes regresi terakhir membuktikan node input bagian/sumber tetap sama saat item sebelumnya dihapus, serta payload artikel tidak berisi ID editor. Generator Unicode juga dibuktikan menghasilkan isi identik dengan seed yang telah diterapkan tanpa menulis ulang migrasi.

**Batas klaim:** ESLint/build bukan pengganti seluruh analisis SonarQube IDE. Tidak ada klaim audit seluruh rule Sonar dan seluruh file selamanya bebas temuan; temuan baru tetap perlu ditelusuri berdasarkan analisis terbaru.

## 12. Bukti pengujian terbaru yang tercatat

| Pemeriksaan | Hasil terakhir tercatat | Batas cakupan |
| --- | --- | --- |
| Full frontend suite | **212 tes / 21 file lulus**, 30 Oktober | Unit/DOM/mocked integration, bukan seluruh cloud E2E |
| Backend pytest | **123 tes lulus**, 30 Oktober | ASGI/unit dengan provider HTTP mock pada cakupan terkait |
| ESLint | Lulus setelah perbaikan terakhir | Rule ESLint yang terpasang |
| TypeScript + Vite build | Lulus setelah perbaikan terakhir | API HTTPS placeholder khusus proses; bukan deployment endpoint |
| check:routes | 24 route dan pemeriksaan kontrak/validasi lulus | Fixture SSR dan mocked transport |
| check:admin-db | Lulus setelah refactor skrip | PostgreSQL PGlite terisolasi, tidak menulis cloud |
| check:history-db | Lulus pada verifikasi Phase 6 | RLS/ownership/consent/preferensi/revocation/ingestion lokal |
| Phase 5 cloud | 51 pemeriksaan yang tersedia lulus | Dua ordinary users, role, Feedback/export/logout dan skenario yang disebutkan |
| Phase 6 public cloud | 7 pemeriksaan read-only lulus setelah uji tulis | Empat objek artikel asli dan penolakan anonim ke private table/RPC |
| Phase 6 final SQL | 10 row bukti | Pemulihan Feedback, status kandidat/draf, actor audit dan fingerprint |

Warning yang masih tercatat: bundle JavaScript utama lebih dari 500 kB dan deprecation Starlette/httpx TestClient. Warning tidak disembunyikan dengan menaikkan ambang atau menambah dependency tanpa alasan.

## 13. PR saat ini, berdasarkan prioritas

### P0 — sebelum menyebut aplikasi siap production

| PR | Mengapa perlu | Bukti selesai yang diharapkan |
| --- | --- | --- |
| Backup dan restore penuh | Dashboard sebelumnya tidak menyediakan project backups; snapshot metadata bukan backup data/Auth | Backup yang sesuai cakupan dan uji restore terisolasi berhasil |
| Deployment HTTPS nyata | Build selama ini memakai placeholder proses untuk memeriksa kompilasi | Frontend/API ter-host, CORS/origin benar, TLS/SPA fallback/deep-link refresh diuji |
| Auth redirect/recovery production | URL development tidak membuktikan callback hosting nyata | Site URL dan allowlist production tepat; alur callback selesai pada URL nyata |
| Recovery email E2E | Forgot/reset password belum dibuktikan lewat inbox nyata | Pengguna mengoperasikan mailbox uji; link/kode valid, invalid/expired dan callback diuji tanpa berbagi rahasia di chat |
| Penolakan akses user biasa terhadap modul admin baru | Phase 5 admin denial dan lokal Phase 6 tidak menggantikan semua endpoint/RPC admin baru di cloud | Akun user biasa nyata ditolak baca/mutasi catatan internal, registry, draft dan audit; tidak ada escalation |
| Browser auth lifecycle penuh | Tes mock/SDK bukan seluruh pengalaman browser | Login, reload, tab baru, pergantian akun, logout, sleep-wake dan idle 60 menit diuji pada browser sasaran |
| Abuse control operasional | Throttle per-worker dan kuota tamu bersama belum perlindungan terdistribusi | Kebijakan gateway/rate limiting/CAPTCHA bila diperlukan, trusted proxy handling dan monitoring diuji |

Registrasi saat ini auto-confirm sesuai keputusan pemilik. Tinjau konsekuensi keamanan dan abuse sebelum peluncuran; **jangan mengubah setting cloud lagi tanpa keputusan yang jelas**. “Ada sesi” bukan bukti inbox milik pengguna.

### P1 — fungsi produk inti yang belum dibangun

1. **Engine analisis:** definisikan kontrak/provider nyata untuk link, pesan, website, QR context, gambar/video; error/timeout/provenance dan batas klaim hasil.
2. **Backend input/media:** bila nanti menambah upload/fetch, implementasikan validasi server, batas biaya/ukuran, redaksi data, storage/retensi dan proteksi SSRF sebelum mengunjungi URL pengguna.
3. **Completed-report cloud E2E:** setelah ada hasil sah, uji save/consent/opt-out/detail/filter/pagination/delete/export serta referensi Feedback lintas akun.
4. **Registry/CMS live review lebih luas:** publish/unpublish dan verify/reset sudah diuji lokal; belum sengaja diuji dengan menerbitkan artikel palsu atau memverifikasi domain yang tidak sah di cloud. Rencanakan data/evidence yang layak dan izin scope spesifik bila dibutuhkan.

### P2 — fitur dan operasi yang belum tersedia

- Penghapusan akun lengkap, termasuk reautentikasi, data terkait dan aturan retensi/audit.
- Perubahan email dan upload avatar.
- Kamera QR serta upload bukti Feedback bila memang menjadi kebutuhan produk.
- Identitas pengelola, kontak privasi resmi, kebijakan retensi dan prosedur permintaan hak data.
- Notifikasi petugas, email balasan, mekanisme tindak lanjut dan SLA Feedback jika dibutuhkan; dashboard admin saja belum menyediakan semuanya.
- Rekonsiliasi migration ledger setelah membandingkan skema aktual; jangan db push/repair ledger secara buta.
- Monitoring, penanganan insiden, rotasi kredensial, log aman dan rencana pemulihan operasional.
- Optimasi bundle berdasarkan pengukuran; QA aksesibilitas, pembaca layar, jaringan lambat, browser/perangkat lain dan uji beban/pentest terpisah.

## 14. Hal yang sudah beres dan tidak perlu diulang

- Bukan lagi PR: aktivasi migrasi cloud 002–004, penerapan 005–006, pembuatan workspace admin, peralihan empat artikel ke CMS, serta tiga uji tulis Phase 6 yang disetujui.
- Jangan mengulang migrasi 001–006 hanya karena laporan historis menulis pending.
- Jangan bootstrap admin baru, mengedit role, mengganti password pemilik atau mereset Auth untuk sekadar memperbaiki error UI.
- Jangan menghapus data/akun uji cloud tanpa izin; saat ini record dan audit sengaja dipertahankan.
- Jangan memakai hasil fixture sebagai laporan keamanan nyata atau menambah statistik buatan.
- Folder yang tampak lama tidak otomatis aman dihapus: periksa import, route, tes dan rencana backend lebih dulu.

## 15. Menjalankan web di PC

Lokasi repo: `C:\Users\User\Documents\awasin`.

```powershell
cd C:\Users\User\Documents\awasin
.\start-dev.ps1
```

Buka `http://localhost:5173`. Launcher memeriksa layanan, memakai ulang proses sehat, dan menyalakan frontend/backend yang belum berjalan. Jika berhasil, tidak perlu menjalankan npm run dev dan backend lagi secara manual. Supabase yang dipakai adalah cloud; launcher bukan installer atau migrator database.

Alternatif menjalankan secara terpisah:

```powershell
# Terminal backend
cd C:\Users\User\Documents\awasin\backend
.\.venv\Scripts\python.exe -m app

# Terminal frontend
cd C:\Users\User\Documents\awasin\frontend
npm.cmd run dev
```

Prasyarat: dependency frontend, virtualenv backend, dan konfigurasi `.env` lokal yang cocok. Jangan memasukkan service-role/secret key atau password database ke `VITE_*`. Setelah perubahan konfigurasi/backend, restart layanan yang relevan. Error fitur bukan alasan menjalankan ulang migrasi.

## 16. Peta sumber untuk melanjutkan

| Lokasi | Tanggung jawab |
| --- | --- |
| frontend/src/features/auth/ | Provider, aksi autentikasi, activity monitor, notifikasi, guard |
| frontend/src/features/scan/ | Workspace dan validasi input |
| frontend/src/features/history/ | Data laporan/riwayat dan aksi simpan/hapus |
| frontend/src/features/settings/ | Transport/preferensi akun |
| frontend/src/features/feedback/ | Model dan tahap Feedback |
| frontend/src/features/education/ | Artikel asli dan adapter CMS |
| frontend/src/features/legal/ | Dialog dan isi dokumen legal |
| frontend/src/features/admin/ | Lima halaman admin, editor, API dan styling |
| frontend/src/routes/, layouts/, components/ | Routing, shell serta UI bersama |
| backend/app/modules/identity/ | JWT/identitas, profil, role dan layanan akun terkait |
| backend/app/modules/history/, feedback/, admin/ | API dan transport data masing-masing fitur |
| supabase/migrations/ | SQL forward yang harus dicocokkan dengan penerapan cloud |
| frontend/tests/, backend/tests/ | Regresi aplikasi |
| frontend/scripts/check-history-db.mjs, check-admin-db.mjs | Pengujian PostgreSQL lokal terisolasi |

Route utama: `/`, `/dashboard`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/settings`, `/history`, `/history/:id`, `/feedback`, `/education`, `/education/:slug`, serta route `/scan/*` yang tersedia. Admin: `/admin/dashboard`, `/admin/feedback`, `/admin/domains`, `/admin/articles`, `/admin/audit`.

API meliputi identitas/profil, riwayat, Feedback, akun/preferensi/ekspor, administrasi, dan edukasi publik. Gunakan router serta OpenAPI aktual sebagai kontrak, bukan menebak endpoint dari nama tombol.

## 17. Kondisi repository saat penyusunan

- Branch: `main`.
- Commit terakhir yang diamati: `a1e91c0` — `feat: Implement admin workspace and education articles migration`.
- `git status --porcelain` kosong pada pemeriksaan 31 Oktober, sebelum pembuatan laporan ini. Catatan “working tree masih uncommitted” pada laporan historis bukan status repository saat ini.
- Penyusunan laporan ini tidak membuat commit/push, tidak mengubah cloud, dan tidak menghapus data.
- Laporan tidak memuat password, OTP, access/refresh token, secret/service-role key atau isi `.env`.

## 18. Rujukan dan instruksi handoff

Sumber utama:

- `C:\Users\User\Downloads\AWASIN_PROGRESS_PHASE_1_4.md` — sejarah Phase 1–4 dan audit UI/auth/navigasi awal.
- `C:\Users\User\Documents\awasin\PHASE5_IMPLEMENTATION.md` — baca bagian Final Continuation/Final Status untuk status cloud terbaru di phase tersebut; bagian awal adalah sejarah.
- `C:\Users\User\Documents\awasin\PHASE6_CLOUD_PLAN.md` — scope dan persetujuan cloud yang telah dieksekusi.
- `C:\Users\User\Documents\awasin\PHASE6_IMPLEMENTATION.md` — implementasi, bukti cloud, maintenance dan batas Phase 6.

Untuk sesi berikutnya:

1. Baca ringkasan serta PR dokumen ini, lalu periksa status repo dan laporan phase terkait saja.
2. Tentukan apakah tugas berikutnya menutup verifikasi keamanan/deployment atau memulai engine; jangan menganggap keduanya sudah selesai.
3. Gunakan skill yang relevan, baca file terarah, batasi output tool dan hindari membaca ulang seluruh riwayat.
4. Pertahankan kerja pengguna; perubahan cloud mengikuti scope izin yang tepat dan target project/branch yang terbukti.
5. Setelah bug diperbaiki, laporkan singkat: **apa yang berubah, penyebabnya, hasil tes, serta batas yang masih ada**.

Dokumen ini adalah catatan progres dan daftar pekerjaan, bukan sertifikasi keamanan atau jaminan kesiapan produksi.
