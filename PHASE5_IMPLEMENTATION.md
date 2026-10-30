# AWASIN Phase 5 — Cloud Integration & Verification

Tanggal pemeriksaan: 25–29 Oktober 2026, Asia/Bangkok.

**Status saat ini: PARTIALLY COMPLETE — SECURITY VERIFICATION PENDING.**
Migrasi cloud 002–004 telah diterapkan dan diverifikasi. Uji akun tunggal nyata
(nama/preferensi, reload sesi, Feedback, riwayat kosong dan ekspor) sudah lulus;
nilai akun sudah dipulihkan. Koreksi lokal scope autentikasi telah diuji; setting
Auth, dua ordinary users, dan logout telah diuji cloud (51 checks). Recovery email
nyata dan browser E2E lifecycle penuh masih tertunda. Bagian A–K adalah
riwayat; bagian Final Continuation di akhir merupakan status terbaru.

## A. Environment summary

- Branch `main`. Working tree bersih pada awal audit, berbeda dari kondisi
  historis laporan Phase 1–4. Tidak ada reset, clean, commit, atau push.
- Laporan Phase 1–4 dibaca dari lampiran Downloads; bukan dianggap bukti keadaan
  cloud sekarang. Laporan tersebut tidak disalin ulang atau ditimpa.
- Project Supabase `awasin`, ref `nqruowgbxiopfhslznyb`, sesuai URL pada konfigurasi
  aplikasi dan dashboard yang dibuka pengguna. Pengguna mengonfirmasi aplikasi
  masih development. Dashboard memberi label branch utama `main / PRODUCTION`;
  ini target cloud utama yang harus tetap dijaga, bukan database test terisolasi.
- URL project dan publishable key frontend/backend: configured dan cocok.
  Key frontend memiliki format publishable; tidak ada nilai key ditulis di laporan.
- `.env` frontend/backend diabaikan Git. File yang diperiksa tidak menyediakan
  database connection/password, management token, atau service-role credentials.
  Runtime aplikasi memang memakai publishable key dan JWT pengguna, bukan admin key.
- `APP_ENV=development`, API frontend mengarah ke backend lokal. CORS dikonfigurasi
  untuk development; belum merupakan konfigurasi deployment publik.
- Akses verifikasi: HTTPS GET Data API/Auth dengan publishable key dan SELECT
  katalog melalui SQL Editor dashboard yang sudah login, sebagai pemilik database.
  Tidak mengambil token browser, password, atau secret key.
- Dashboard Overview menampilkan `No backups`. Tidak ada backup eksternal yang
  diverifikasi; jangan menganggap pemulihan data tersedia.

## B. Completion matrix

Verified lokal tidak berarti verified cloud. Status di bawah sengaja memisahkan keduanya.

| Task | Existing status | Action taken | Verification | Final status |
| --- | --- | --- | --- | --- |
| Repository, konfigurasi dan secret handling | Implemented | Audit tanpa perubahan konfigurasi | Git, pemeriksaan presence/match dan format key | COMPLETE & VERIFIED pada konfigurasi yang diperiksa |
| Fondasi identitas 001 | Objek ada, ledger tidak ada | Tidak menjalankan ulang 001 | SELECT tabel, RLS, policies, trigger, FK, ACL, definisi active_session | Objek utama VERIFIED; riwayat penerapan tidak tercatat; bukan klaim kesetaraan seluruh definisi 001 |
| Migrasi 002/history | SQL dan API ada; objek cloud belum ada | Review dan tes lokal saja | Katalog cloud tidak memiliki scan_reports/RPC terkait; PGlite lulus | PARTIALLY COMPLETE; cloud pending approval |
| Migrasi 003/preferences | SQL dan API ada; kolom cloud belum ada | Review dan tes lokal saja | Kolom profiles hanya id/display_name/created_at/updated_at | PARTIALLY COMPLETE; cloud pending approval |
| Migrasi 004/Feedback | SQL dan API ada; objek cloud belum ada | Review dan tes lokal saja | Katalog tidak memiliki feedback_submissions/submit_feedback | PARTIALLY COMPLETE; cloud pending approval |
| Register/login/email verification | Implemented | Cross-check kode dan tes existing | Mock SDK/backend; Auth settings cloud read-only | COMPLETE & VERIFIED lokal; transaksi akun cloud belum diverifikasi |
| Restore/refresh/protected routes/logout/idle | Implemented | Tidak diubah | Tes race, session expiry, logout dan loading | COMPLETE & VERIFIED lokal; belum E2E akun cloud |
| Profile/name/ownership | Implemented | Review API, policies dan grants | Backend mock; katalog cloud menunjukkan update hanya display_name | Verified lokal/katalog; persist-refresh cloud belum diverifikasi |
| Preferences/privacy/reduced motion | Implemented | Review tanpa menambah mode | Backend/frontend/PGlite | Verified lokal; persistence cloud blocked oleh 003 |
| JSON export | Implemented | Cross-check scope, ownership dan batas | Backend mock: saved reports/Feedback, maksimum 500 masing-masing, gagal jika tidak lengkap | Verified lokal; cloud blocked oleh skema 002–004 |
| Guest/account Feedback | Implemented | Review validation, receipt, consent, quota, idempotency | Backend/frontend mock dan PGlite RPC | Verified lokal; tidak mengirim dummy Feedback ke cloud |
| False-detection Feedback | Implemented | Review report ownership | Mock API dan PGlite menolak referensi lintas akun | Verified lokal; belum cloud |
| History list/filter/pagination/detail/save/delete | Implemented | Memakai tes existing | Mock API/UI dan PGlite ownership/consent/provenance/counts | Verified lokal; cloud blocked oleh 002–003 |
| RLS dua pengguna | Implemented | Katalog identitas dan tes A/B lokal | PGlite role authenticated/anon, revoked session dan privilege restriction | Verified lokal; NOT VERIFIED cloud — authorized ordinary test identities/sessions unavailable |
| Account deletion/analysis engine/admin dashboard | Belum tersedia atau di luar scope | Dipertahankan | Review batas fitur | Tidak diimplementasikan ulang |
| HTTPS hosting/SPA fallback/Auth redirect allowlist | Belum dibuktikan pada deployment | Review konfigurasi lokal/build guard | Build dengan HTTPS API placeholder sementara | Cloud deployment dan redirect allowlist NOT VERIFIED |

## C. Files changed in Phase 5

1. `PHASE5_IMPLEMENTATION.md`: laporan bukti, status dan approval plan ini.
2. `supabase/tests/phase5_cloud_audit.sql`: SELECT katalog yang dapat diulang,
   tanpa perubahan skema/data dan tanpa mengambil rincian identitas pengguna.

**Tidak ada application-code fix yang dibutuhkan berdasarkan bukti audit saat ini.**
Tidak ada dependency baru, redesign UI, perubahan autentikasi atau migrasi baru.
SQL audit bukan pengganti tes runtime RLS; ia dijalankan dengan akses owner.

## D. Database findings and proposed change

### Cloud evidence

SELECT katalog pada project target menghasilkan:

- `public.profiles`: RLS enabled dan forced; kolom `id`, `display_name`,
  `created_at`, `updated_at`.
- `public.user_roles`: RLS enabled dan forced.
- `awasin_private.admin_bootstrap`: ada dan RLS enabled; isinya tidak diambil.
- Policies: `profiles_read_self`, `profiles_update_self`, `roles_read_self`.
  Kebijakan profil/role dibatasi `auth.uid()` dan `active_session()`; UPDATE profil
  juga mempunyai WITH CHECK yang sama.
- FK profil/role mengacu `auth.users` dengan ON DELETE CASCADE.
- Grants ke authenticated: SELECT profil/role; UPDATE kolom `display_name` saja.
  Tidak ditemukan table grants untuk anon/PUBLIC pada dua tabel tersebut.
- Trigger `awasin_identity_created` pada auth.users dan `awasin_profile_updated`
  pada profiles ada. Definisi lengkap trigger functions/bootstrap belum dibandingkan.
- `active_session()` sesuai pemeriksaan sesi di migrasi lokal: SECURITY DEFINER,
  search_path kosong; memeriksa uid/session_id, email confirmed, nonanonymous,
  banned_until dan not_after. EXECUTE ACL hanya postgres/authenticated.
- Jumlah agregat: dua auth.users, dua profiles, dua user_roles. Tidak mengambil
  email, UUID akun atau password. Ini bukan bukti dua akun tersebut adalah akun
  uji ordinary yang diotorisasi, maupun bukti join coverage setiap akun.
- `scan_reports`, `feedback_submissions`, tiga RPC publik terkait dan dua kolom
  preferensi belum ada. `supabase_migrations.schema_migrations` tidak ada.
- Overview: `No migrations`, `No backups`.

HTTPS read-only menguatkan hasil katalog: Auth settings 200, JWKS 200 dengan ES256;
query preferensi 400/42703; history/Feedback 404/PGRST205. Pembacaan role sebagai
anon ditolak 401/42501. Penolakan anon bukan bukti seluruh skenario RLS lulus.

**Kesimpulan:** fondasi 001 telah diterapkan setidaknya pada objek yang diperiksa,
tanpa ledger migrasi standar. Jangan mengulang 001 atau menjalankan db push secara
buta terhadap seluruh folder migrasi. 002–004 genuinely pending berdasarkan
objek nyata, bukan hanya nama file lokal. Tidak ada schema mutation dilakukan.

### Approval plan: 002 → 003 → 004

| Hal yang ditinjau | Rencana |
| --- | --- |
| Target | Project awasin/ref di atas, cloud utama yang dipakai development |
| Operasi 002 | Jalankan `202610230002_scan_history.sql` satu kali: tabel scan_reports, indexes/constraints/FK, RLS/policies, save_scan_report dan clear_scan_history |
| Operasi 003 | Jalankan `202610230003_account_preferences.sql` satu kali: profiles.history_retention default manual, profiles.animation default system, limited update grant, penggantian save_scan_report untuk opt-out |
| Operasi 004 | Jalankan `202610230004_feedback.sql` satu kali: feedback_submissions, index/FK/constraints, RLS dan submit_feedback RPC |
| Prerequisites/status | Identitas dan active_session ada; objek/kolom target belum ada. Recheck segera sebelum eksekusi bila ada perubahan eksternal |
| Dampak | Menyediakan persistence bagi API existing. Preferensi default diberikan pada profil existing; tidak mengubah nama, role, email, password atau bootstrap admin |
| Risiko | ALTER profiles mengambil lock; DDL/grants/RPC memengaruhi akses data. Deploy parsial dapat membuat sebagian fitur belum siap. Feedback guest RPC menjadi endpoint tulis publik sesuai validasi/kuota existing |
| Backup/recovery status | Tidak terverifikasi; dashboard No backups. Belum aman mengklaim restore tersedia. Sebelum eksekusi, verifikasi backup/export yang sesuai atau minta keputusan pemilik yang eksplisit menerima keterbatasan recovery |
| Verifikasi | Jalankan ulang katalog dan cek fungsi/grants/policies/constraints; query limit=0, lalu uji terotorisasi pada akun/data terisolasi. Jangan mengisi hasil scan palsu |
| Recovery | Setiap SQL memakai BEGIN/COMMIT; error sebelum COMMIT harus di-ROLLBACK. Jika salah satu migrasi sudah COMMIT, jangan mengulangnya; catat objek aktual dan lanjut hanya setelah diagnosis. Setelah fitur menerima data, gunakan forward correction atau restore backup yang telah diverifikasi; jangan DROP otomatis |

Tidak ada izin tersirat untuk menulis ledger, membuat akun, mereset Auth atau
menghapus data. Pencatatan baseline 001 pada ledger standar memerlukan keputusan
tersendiri setelah keseluruhan schema dibandingkan; audit ini tidak membuatnya.

## E. Integration tests and evidence

Pemeriksaan dijalankan selama audit Phase 5 pada working tree aplikasi yang sama.

| Check | Environment | Result |
| --- | --- | --- |
| `frontend: npm.cmd test` | Unit/DOM dan mocked integration | 191 passed, 20 files |
| `backend: .venv/Scripts/python.exe -m pytest -q` | ASGI + mocked Supabase HTTP | 89 passed |
| `npm.cmd run check:history-db` | PostgreSQL/PGlite terisolasi | Migrations 002–004, A/B ownership, consent, opt-out, revoked session, receipts, quotas dan references passed |
| `npm.cmd run lint` | Static local | Passed |
| `npm.cmd run build` | TypeScript/Vite local | Passed dengan override API HTTPS sementara |
| `npm.cmd run check:routes` | SSR, fixtures dan mocked transport | Passed |
| Auth settings/JWKS/Data API GET | Real Supabase cloud | Connectivity dan email confirmation config verified; schema gaps terkonfirmasi |
| SQL catalog SELECT via dashboard | Real Supabase cloud/manual UI | Objek, kolom, RLS, grants, policies, dependencies dan absennya ledger diperiksa |
| Login, register, password change, logout akun nyata | Real cloud/browser E2E | NOT VERIFIED pada Phase 5 |
| Profile/preferences write-refresh, Feedback receipt, history delete/export | Real cloud persistence | NOT VERIFIED; belum ada approval/data uji yang sesuai, dan skema pending |

Percobaan frontend pertama gagal memuat konfigurasi esbuild karena pembatasan
sandbox; setelah dijalankan dengan izin di luar sandbox, 191 tes lulus. Percobaan
HTTPS pertama juga dibatasi sandbox; akses hanya-baca berikutnya berhasil.
Satu query metadata kedua sempat gagal sintaks karena editor menyisipkan teks ke
query sebelumnya. Tidak ada DDL/DML dalam query itu; query bersih berikutnya lulus.

Warning existing: main JS chunk lebih dari 500 kB; Starlette/httpx TestClient
deprecation. Tidak ditutup-tutupi atau diperbaiki dengan perubahan di luar scope.
API HTTPS placeholder hanya override proses build, bukan endpoint deployment yang
telah diuji atau perubahan `.env`. Hasil build itu bukan paket siap deployment.

## F. Security verification

- Backend memverifikasi JWT signature/issuer/audience/expiry/claims, user confirmed
  dan role dari database; tidak mempercayai metadata role dari browser.
- Data requests diteruskan memakai JWT pengguna; API menambahkan owner filter dan
  memeriksa kepemilikan respons. RLS memberi batas tambahan di database.
- Kode dan tes menahan save tanpa consent/provenance, report forgery, opt-out bypass,
  linked Feedback lintas pemilik, escalation dan export data pemilik lain.
- Feedback memerlukan privacy acknowledgement/consent, validasi kategori, UUID
  receipt dari database, idempotency dan quota. Sukses tidak dibuat saat provider gagal.
- Logout/idle/cross-tab races dan invalid backend identity ditangani tes existing.
  Idle satu jam adalah kebijakan browser; bukan jaminan server menolak setiap token
  setelah satu jam tanpa aktivitas manusia.
- Tidak menonaktifkan RLS, membuka grants unrestricted, mengubah admin, mencatat
  raw credentials, membuat laporan analisis palsu atau memodifikasi data pengguna.
- Pemeriksaan katalog owner tidak membuktikan runtime RLS cloud dua ordinary users.
  Grant/policy history dan Feedback baru ada di SQL lokal sampai migrasi disetujui.
- Batas operasional existing tetap: throttle Feedback per-worker dan quota tamu
  bersama, tanpa klaim distributed abuse protection/CAPTCHA atau audit pentest.

## G. Blockers

1. Persetujuan penerapan 002–004 belum diberikan. Permintaan membuka dashboard
   mengizinkan audit, bukan otomatis mengizinkan perubahan skema.
2. Backup/recovery yang sesuai belum diverifikasi.
3. Runtime persistence cloud memerlukan skema tersebut dan pengujian yang disetujui.
   Dua akun terdaftar tidak berarti kredensial/sesi akun uji boleh dipakai.
4. Belum ada laporan analisis sah yang dikonfirmasi tersedia. Engine di luar scope;
   gunakan fixture lokal untuk alur eligible, jangan mengarang hasil cloud.
5. URL Auth allowlist, callback email aktual, hosting HTTPS, SPA fallback dan
   konfigurasi produksi belum diverifikasi melalui deployment nyata.

## H. Next steps

1. Review approval plan dan putuskan backup/recovery, lalu setujui atau tolak
   penerapan tepat 002 → 003 → 004 pada project target.
2. Setelah approval, recheck state dan terapkan hanya operasi yang masih pending;
   verifikasi objek/perizinan sesudah setiap langkah. Jangan rerun 001.
3. Dengan approval terpisah untuk data uji, lakukan profile/preferences persistence,
   Feedback guest/account dan ownership menggunakan ordinary test sessions.
   Jangan meminta pengguna membagikan password/OTP di chat.
4. Verifikasi dua ordinary users pada satu project yang sama untuk read/update/
   delete/export/reference isolation. Jangan memakai sesi akun sama sebagai dua user.
5. Lengkapi callback/redirect/deployment checklist dan update laporan dengan bukti
   aktual. Jangan menandai full cloud verification selesai sebelum pengujian itu ada.

Skill yang dipakai: ponytail (reuse/perubahan minimal), verification-before-completion
(bukti sebelum klaim), systematic-debugging (menelusuri kegagalan cloud), dan
computer-use (audit dashboard). Tidak ada subagent atau dependency tambahan.

## I. Continuation — preflight dan recovery preparation (historis sebelum approval)

Tanggal: 25 Oktober 2026, Asia/Bangkok. Mengikuti brief continuation, pekerjaan
tidak dimulai ulang. Baseline tes di bagian E dipertahankan sebagai hasil audit
sebelumnya, bukan diklaim sebagai pengujian baru dalam continuation ini.

### Target dan drift cross-check

- Konfigurasi frontend/backend masih cocok dengan project yang diharapkan,
  `nqruowgbxiopfhslznyb`; publishable key tetap cocok. Tidak mencetak nilainya.
- Dashboard URL yang diperiksa menunjuk project tersebut, branch `main / PRODUCTION`.
  Status pemakaian aplikasi development berasal dari konfirmasi pemilik.
- Query katalog bagian pertama `phase5_cloud_audit.sql` dijalankan ulang dan
  mengembalikan enam hasil: tabel identitas sama, RLS tetap enabled/forced pada
  profil/role, empat kolom profil awal saja, empat fungsi private, policies dan
  trigger identitas tetap ada, serta ledger standar tetap absent.
- Halaman Migrations masih menawarkan first migration, bukan daftar migrasi yang
  telah tercatat. Tidak melakukan baseline atau db push.
- Migrasi 002–004 tetap pending: tidak ada tabel, kolom, atau RPC target yang
  ditemukan. Tidak ada partial-object drift baru pada objek target audit ini.
- Definisi empat fungsi private, constraints/index identitas, ACL fungsi/schema
  dan trigger sekarang dibaca langsung dari katalog. Bootstrap tetap executable
  hanya oleh postgres, provision/touch juga tidak diekspos ke browser, dan schema
  private hanya memberi USAGE kepada authenticated. Tidak memanggil bootstrap.

### Backup/recovery yang benar-benar tersedia

Halaman `Database > Backups > Scheduled backups` diperiksa langsung. Dashboard
menyatakan **Free Plan does not include project backups** dan menawarkan upgrade.
Tidak ada backup yang dapat diunduh/di-restore dari daftar backup terjadwal ini.
Tidak membeli paket, mengaktifkan layanan berbayar atau mengubah pengaturan.

Koneksi database langsung untuk pg_dump/restore tidak dikonfigurasi dalam environment
aplikasi yang diperiksa. Tidak meminta pengguna menempelkan password database atau
management token ke chat. Backup eksternal/PITR yang sesuai belum dibuktikan;
kemampuan melakukan full restore tetap **NOT VERIFIED**.

Ekspor metadata terbatas telah disimpan ke:

`frontend/.phase5.local/preflight-metadata-2026-10-25.json`

`git check-ignore` mengonfirmasi file tersebut tidak ikut Git, dengan aturan
existing `*.local`; tidak menambah aturan ignore baru. Isinya enam hasil audit
skema dan enam hasil recovery metadata dari SELECT cloud: definisi fungsi,
constraints, indexes, function ACL, trigger definitions dan private schema ACL.
Tidak ada isi baris pengguna, password, token, profil, role akun atau bootstrap.

**Batas penting:** ini snapshot teks metadata dari hasil UI, bukan full schema dump,
bukan executable restore SQL, dan bukan backup data/Auth yang dapat dipulihkan.
Ia membantu membandingkan struktur sebelum/sesudah perubahan, tetapi tidak bisa
memulihkan akun, password, sesi, nama profil, role akun, MFA atau data yang hilang.
Tidak ada uji restore ke database lain; tidak diklaim recovery lengkap tersedia.

Ketiga migrasi existing memiliki BEGIN/COMMIT. Atomicity berlaku per migrasi,
bukan otomatis untuk seluruh rangkaian tiga file. Jika gagal sebelum commit,
rollback transaksi tersebut dan periksa katalog. Jika migrasi sebelumnya sudah
commit, jangan mengulang atau membatalkannya dengan DROP otomatis. Gunakan diagnosis
dan forward correction; pemulihan data tetap membutuhkan backup yang sesuai.

Dashboard menampilkan banner investigasi technical issue layanan. Tidak disimpulkan
project rusak karena SELECT berhasil. Sebelum eksekusi yang disetujui, periksa
kembali keterjangkauan/status target dan hentikan jika operasi gagal; jangan retry buta.

### Rencana operasi spesifik untuk approval

Target: hanya `awasin / nqruowgbxiopfhslznyb / main`, bukan project baru.

1. **002:** membuat scan_reports, FK/constraints/indexes, owner RLS, grants terbatas,
   save_scan_report dan clear_scan_history. Tidak membuat hasil analisis contoh.
2. **003:** menambah history_retention/animation beserta defaults pada profiles,
   grant UPDATE dua kolom tersebut, dan mengganti save_scan_report agar menghormati
   opt-out. Nama, role, Auth dan konfigurasi admin tidak diubah.
3. **004:** membuat feedback_submissions, FK/constraints/index/RLS, grant SELECT
   kolom terbatas dan submit_feedback RPC dengan consent/idempotency/quota.
   Guest mendapat EXECUTE RPC tervalidasi, bukan direct table write unrestricted.

Risiko yang harus diterima sebelum approval: belum ada full backup terverifikasi;
ALTER profiles mengambil lock; setiap file commit terpisah; guest RPC mengaktifkan
jalur penerimaan Feedback publik sesuai pembatas existing. Tidak menghapus tabel,
user, sesi, password, role, atau konfigurasi admin. Migrasi 001 dilewati.

SHA-256 file yang ditinjau (recheck jika file berubah sebelum eksekusi):

| Migration | SHA-256 |
| --- | --- |
| 002 | `73C00492BB5BA6C8887EF9D9611361EC07E0C996FB93D9685DD615F2DD3E1219` |
| 003 | `F9DB6E5313A70D10F7A96ABAD9E748421B2F2F305BAEC505BC3222E7ED13C122` |
| 004 | `FDD0D85F5CAC698DC826E25F5B9D6AD7A68524B05215F8B4F589E4FA2E597528` |

Setelah approval khusus, lakukan recheck singkat lalu eksekusi satu per satu,
verifikasi hasil commit/objek/grants/RLS sebelum lanjut, tanpa konfirmasi berulang
untuk langkah rutin dalam operasi yang sudah disetujui. Uji tulis akun/Feedback
memerlukan konteks data uji yang diotorisasi; tidak otomatis memakai dua akun
existing yang belum dikonfirmasi disposable atau menghapus sesi pemilik.

### Migration results saat continuation dihentikan pada approval gate

| Migration | Previous state | Action | Verified cloud state |
| --- | --- | --- | --- |
| 001 | Fondasi identitas existing | Skipped; katalog/definisi/ACL cross-check saja | Fondasi tetap ada; ledger absent; Auth/admin tidak diubah |
| 002 | Absent | Belum dijalankan; menunggu approval spesifik | Tabel/RPC tetap absent |
| 003 | Absent | Belum dijalankan; menunggu approval spesifik | Kolom preferensi tetap absent |
| 004 | Absent | Belum dijalankan; menunggu approval spesifik | Tabel/RPC tetap absent |

### Live tests, security, perubahan dan blockers

- **Verified pada continuation:** target environment consistency; cloud catalog
  preflight; metadata SELECT; backup plan availability; ledger UI; pembatasan ACL
  fungsi private, schema dan trigger/constraints identitas yang diekspor.
- **Belum diuji ulang/live:** transaksi Auth, profile persistence, preferences,
  Feedback receipt, authenticated empty history/export, dan runtime ownership dua
  ordinary users. Tidak memanipulasi akun existing atau mengarang hasil tes.
- **CLOUD CROSS-USER RLS: NOT VERIFIED.** Belum ada dua approved ordinary test
  sessions. Jumlah akun dalam audit sebelumnya bukan otorisasi memakainya.
- Saved completed report persistence di cloud tetap bergantung pada hasil sah
  dari engine; engine tidak dikembangkan dan tidak ada fake verdict yang dimasukkan.
- File report ini diperbarui; skrip audit existing ditambah satu SELECT metadata
  recovery yang sebelumnya belum ada. Snapshot lokal ignored disimpan. Tidak
  membuat laporan Phase 5 pesaing, migrasi baru, dependency atau application-code fix.
- Regresi aplikasi tidak diulang sebelum approval karena belum ada perubahan
  application code/schema. Jalankan pemeriksaan existing yang relevan setelah
  eksekusi/perbaikan, dengan membedakan hasil lokal/mock/PGlite/cloud.
- Brief continuation bagian 4 secara eksplisit menyatakan prompt bukan blanket
  approval dan meminta acknowledgement keterbatasan recovery serta approval operasi
  spesifik, bahkan jika backup tersedia. Karena belum diterima, schema execution
  berhenti di gate ini; tidak ada cloud DDL/DML yang dijalankan.

**Status pada akhir preflight ini: BLOCKED — CLOUD EXECUTION NOT AUTHORIZED.**
Langkah berikutnya adalah persetujuan eksplisit untuk 002 → 003 → 004 pada target
di atas beserta pengakuan full backup belum terverifikasi, atau penyediaan backup
yang sesuai sebelum persetujuan tersebut. Ini bukan klaim Phase 5 cloud selesai.

## J. Eksekusi cloud yang disetujui dan hasil verifikasi terbaru

Tanggal: 25 Oktober 2026, Asia/Bangkok. Setelah rencana spesifik dan keterbatasan
backup disampaikan, pengguna menjawab **“yapp lanjutkan saya setujui”**. Persetujuan
tersebut digunakan untuk tepat migrasi 002 → 003 → 004 pada project/branch yang
ditinjau. Tidak dianggap izin membuat akun, mengubah profil pemilik untuk QA,
melakukan password reset, menghapus data atau mengarang laporan analisis.

### A. Migration results

Final preflight melalui SELECT cloud sebelum DDL: kedua tabel target absent,
jumlah kolom preferensi nol, tiga RPC target belum ada, ledger absent. Jumlah Auth
users/profiles/user_roles masing-masing dua. Fingerprint agregat nama profil,
role dan bootstrap disimpan lokal tanpa mengekspor isi akun.

| Migration | Previous state | Action | Verified cloud state |
| --- | --- | --- | --- |
| 001 | Fondasi identitas existing tanpa ledger standar | Skipped | Identitas tetap ada; jumlah akun/profil/role dan fingerprint nama/role/bootstrap tidak berubah |
| 002 | Absent | SQL existing ber-SHA-256 di bagian I dieksekusi sekali, BEGIN/COMMIT | Success; scan_reports, tiga indexes termasuk PK, constraints/FK, RLS forced, dua owner policies, save_scan_report dan clear_scan_history tersedia |
| 003 | Absent | SQL existing dieksekusi sekali, BEGIN/COMMIT | Success; dua kolom NOT NULL/default dan CHECK tersedia, grant kolom terbatas, save_scan_report memeriksa history_retention=manual |
| 004 | Absent | SQL existing dieksekusi sekali, BEGIN/COMMIT | Success; feedback_submissions, tiga indexes termasuk PK/unique key, constraints/FK, forced RLS, policy dan submit_feedback tersedia |

Setiap transaksi menampilkan `Success. No rows returned`; katalog/perizinan
diperiksa setelah migrasi terkait sebelum lanjut. SQL dimasukkan dari file yang
hash-nya dicocokkan dengan rencana approval. Peringatan SQL Editor pada 002
ditinjau sebelum konfirmasi: skrip mendefinisikan fungsi hapus, tidak memanggilnya
atau menghapus data existing. Tidak ada migrasi gagal atau retry migrasi.

Kondisi akhir:

- Tabel scan_reports dan feedback_submissions ada; dua kolom preferensi ada;
  tiga RPC publik terkait ada.
- Kedua profil existing mendapat default `history_retention=manual` dan
  `animation=system`. Nama, role, dan bootstrap mempunyai fingerprint sama
  dengan sebelum migrasi. Jumlah users/profiles/roles tetap 2/2/2.
- Jumlah scan_reports=0 dan feedback_submissions=0 setelah semua probe negatif.
  Tidak ada fake completed analysis atau Feedback valid yang disisipkan.
- Ledger `supabase_migrations.schema_migrations` **tetap absent**. Migrasi diterapkan
  manual melalui SQL Editor, bukan CLI ledger. Jangan menyimpulkan belum diterapkan
  dari layar Migrations/ledger kosong dan jangan menjalankan ulang atau db push buta.
  Rekonsiliasi ledger/baseline adalah operasi terpisah yang belum dilakukan.
- Keterbatasan backup tetap berlaku. Snapshot metadata tidak berubah menjadi
  full backup hanya karena migrasi berhasil.

### B. Real integration tests

| Area | Environment / operasi nyata | Result |
| --- | --- | --- |
| Frontend process | HTTP GET http://localhost:5173/ | 200, Vite entry tersedia |
| Backend process | HTTP GET /health pada proses lokal | 200 |
| CORS | OPTIONS /api/v1/history, Origin localhost:5173 dan Authorization | 200 dengan allowed origin yang tepat |
| Protected API | GET /api/v1/auth/me, /history, /account/preferences, /account/export tanpa token | Semua 401 |
| Private cloud tables | Supabase REST GET profiles dengan kolom preferensi, scan_reports, feedback_submissions; limit=0, publishable key tanpa sesi | Semua 401/42501; tidak lagi undefined-column atau table-not-found |
| Feedback consent boundary | POST RPC submit_feedback dengan consent=false | Ditolak 401/42501 sebelum INSERT |
| Feedback category boundary | POST RPC submit_feedback dengan kategori invalid, consent=true | Ditolak 400/22023 sebelum INSERT; membuktikan RPC terjangkau oleh guest |
| FastAPI validation | POST /api/v1/feedback tanpa consent / kategori invalid | 422 / 422 |
| Invalid presented Auth | POST /api/v1/feedback dengan Bearer invalid | 401; tidak dialihkan menjadi guest submission |
| Profile/preferences persistence | Belum memakai approved test identity | NOT VERIFIED melalui operasi akun nyata |
| Feedback valid/receipt/idempotency | Menunggu konteks data uji yang disetujui | NOT VERIFIED melalui submission valid cloud |
| History authenticated empty state/export | Tidak ada approved authenticated test session yang digunakan | NOT VERIFIED melalui API terautentikasi; tabel kosong dibuktikan SELECT owner |
| Login/restore/refresh/logout | Kredensial/OTP tidak diminta atau dipakai | NOT VERIFIED ulang sebagai browser/account E2E dalam eksekusi ini |
| Cross-user ownership | Belum ada dua approved ordinary test sessions | CLOUD CROSS-USER RLS: NOT VERIFIED |

Percobaan HTTP ke 127.0.0.1:5173 ditolak; alamat launcher yang benar,
localhost:5173, merespons 200. Tidak menganggap ini bug aplikasi atau mengubah bind
server tanpa kebutuhan. Tab lama in-app browser berada di halaman error dan tidak
dapat diakses melalui Browser Use URL policy; tidak diklaim fresh browser E2E lulus.
Verifikasi dashboard SQL dilakukan melalui Brave, sementara HTTP probe di atas
memakai proses backend nyata dan endpoint cloud nyata, tanpa transport mock.

Tidak ada token sesi dicuri/diekstrak dari storage browser. Akun existing tidak
otomatis dipakai sebagai disposable test accounts. Pertanyaan persetujuan untuk
memakai akun pemilik sementara dan Feedback berlabel UJI PHASE 5 telah diajukan;
hingga laporan ini diperbarui, belum ada jawaban dan operasi tersebut belum dilakukan.
Tidak menghapus record/sesi untuk membuat tes lulus.

### C. Security results

- scan_reports: RLS enabled dan forced; SELECT/DELETE hanya authenticated,
  INSERT/UPDATE tidak diberikan; anon SELECT ditolak. Dua policy mengharuskan
  owner_id=auth.uid() dan active_session; DELETE juga mensyaratkan saved_at nonnull.
- save_scan_report dan clear_scan_history: authenticated EXECUTE=true,
  anon EXECUTE=false. Definisi SECURITY DEFINER/search_path kosong, consent,
  ownership dan active session diverifikasi. Save setelah 003 juga memeriksa
  provenance hasil completed dan history_retention=manual.
- profiles: grant UPDATE authenticated terbatas pada display_name,
  history_retention dan animation; constraint values/defaults diperiksa di katalog.
  Tidak ada grant update role/admin baru.
- feedback_submissions: forced RLS dan policy owner+active_session. anon tidak
  memiliki SELECT kolom; authenticated hanya mendapat SELECT kolom yang ditentukan,
  tidak submission_key. Tidak ada INSERT/UPDATE/DELETE langsung untuk authenticated;
  anon INSERT juga false.
- submit_feedback ACL tepat postgres/anon/authenticated. Definisi yang dibaca
  dari cloud mencakup consent, validasi kategori/field, pemilik saved report,
  active session, advisory lock, idempotency, dan quota PT429.
- Probe tanpa consent dan kategori invalid dibuktikan ditolak di cloud, bukan hanya
  tes mock. Count tabel sesudahnya tetap nol. Tidak mengklaim ini membuktikan valid
  submission, runtime opt-out dengan eligible report, atau seluruh isolasi antar-akun.
- Password/Auth config, private bootstrap dan role akun tidak diubah. Tidak
  menonaktifkan RLS atau memberikan service-role/secret key ke frontend.

### D. Regression checks setelah aktivasi cloud

| Check | Environment | Fresh result |
| --- | --- | --- |
| npm.cmd test | Unit/DOM/mocked integration | 191 passed / 20 files |
| .venv/Scripts/python.exe -m pytest -q | ASGI / mocked Supabase HTTP | 89 passed |
| npm.cmd run lint | Static local | Passed |
| npm.cmd run build | TypeScript / Vite local | Passed |
| npm.cmd run check:routes | SSR / mocked transport | Passed |
| npm.cmd run check:history-db | PostgreSQL/PGlite isolated | Passed |

Build memakai override HTTPS API sementara seperti baseline, bukan perubahan env
atau bukti deployment. Warning chunk utama 729,60 kB tetap ada; backend memberi
upstream Starlette/httpx deprecation yang sama. Tidak menaikkan threshold,
menonaktifkan tes, atau menambah dependency untuk menyembunyikannya.

### E. Files changed and evidence

Tidak ada application-code change atau bug fix spekulatif. Penyebab gap yang
terkonfirmasi adalah migrasi cloud belum aktif; gap skema itu diselesaikan dengan
SQL existing, tanpa rebuild fitur dan tanpa mengubah file migrasinya.

- `PHASE5_IMPLEMENTATION.md`: report existing ini diperbarui dengan approval,
  hasil eksekusi, bukti cloud, regresi dan batas verifikasi.
- `supabase/tests/phase5_cloud_audit.sql`: tetap skrip audit existing yang sudah
  diperluas untuk metadata recovery pada preflight; bukan migrasi baru.
- Bukti lokal di `frontend/.phase5.local/`, diabaikan Git: baseline eksekusi,
  verifikasi 002/003/004, final integrity, cloud/backend probes dan query SELECT
  yang benar-benar dijalankan. File ini bukan full backup atau pengganti report.

Tidak commit/push, reset, deploy UI, menjalankan 001, membuat akun baru atau
mengubah kredensial. Tidak ada skema/data fixture lokal yang dikirim ke cloud.

### F. Remaining blockers and final status (historis sebelum izin uji akun)

**PARTIALLY COMPLETE — SPECIFIC ITEMS PENDING.**

Cloud schema activation dan pemeriksaan katalog/grants/negative probes sudah
selesai. Yang benar-benar masih perlu dilakukan:

1. Tentukan dan otorisasi test identity/context untuk write-read-refresh profil/
   preferensi serta Feedback valid/idempotency. Tanpa jawaban, operasi tidak dilakukan.
2. Login/restore/refresh/logout browser dan authenticated history empty-state/export
   dengan sesi uji nyata, tanpa membagikan password/token/OTP di chat.
3. Dua approved ordinary users untuk pengujian cloud ownership A/B. Hasil tes
   PGlite dua akun tetap bukti lokal, bukan pengganti pengujian cloud.
4. Eligible completed-report persistence menunggu hasil engine sah; gunakan fixture
   lokal untuk jalur itu sampai tersedia, tanpa membuat verdict palsu di cloud.
5. Verifikasi callback allowlist/email flow/deployment HTTPS/SPA fallback saat
   lingkungan deployment dan akses yang relevan tersedia. Jangan klaim Phase 6
   readiness penuh sebelum batas integrasi yang masih tertunda diputuskan.

Persetujuan migrasi yang sudah diterima tidak perlu diminta ulang untuk migrasi
yang telah sukses. Jangan menjalankan ulang SQL untuk mengejar ledger kosong.

## K. Live integration dengan akun pemilik dan Feedback uji

Pengerjaan berlanjut sampai 26 Oktober 2026, Asia/Bangkok. Pengguna memilih
**“Gunakan akun saya dan izinkan Feedback uji”**, kemudian login sendiri di Brave
dan mengonfirmasi **“sudah login”**. Ini memberi konteks uji yang sebelumnya
belum tersedia; tidak membuat akun baru atau meminta password/OTP/token di chat.

### A. Authorization and restoration

- Izin mencakup perubahan nama/preferensi sementara lalu dipulihkan, serta
  Feedback berlabel UJI PHASE 5. Password dan penghapusan data tetap di luar izin.
- Sebelum sesi akun tersedia, satu Feedback tamu berlabel jelas dikirim melalui
  form asli. Setelah login, satu Feedback terkait akun dikirim melalui alur yang sama.
- Nama asli dicatat pada snapshot lokal ignored sebelum perubahan. Nama sementara
  dengan penanda UJI PHASE 5 berhasil disimpan; setelah full reload nama sementara
  tetap muncul, membuktikan persistence di luar state form.
- Computer Use sempat menghentikan turn ketika tidak dapat memastikan URL saat
  refresh. Nama belum sempat dipulihkan pada turn itu; kondisi ini disampaikan
  secara eksplisit. Pada continuation berikutnya pemulihan nama diprioritaskan,
  disimpan melalui aplikasi dan dikonfirmasi berhasil.
- Preferensi animation diuji dari system → reduced, berhasil disimpan dan tetap
  reduced setelah full reload, lalu dikembalikan ke system.
- Preferensi history_retention diuji dari manual → disabled, berhasil disimpan
  dan tetap disabled setelah full reload, lalu dikembalikan ke manual.
- Export JSON dari endpoint nyata serta SELECT cloud mengonfirmasi nama asli,
  animation=system dan history_retention=manual sudah pulih. Fingerprint agregat
  nama profil, role dan bootstrap kembali sama dengan baseline sebelum migrasi.
- Browser ditinggalkan di `/dashboard` dengan sapaan nama asli dan sesi pengguna
  tetap aktif. Tidak melakukan logout paksa, password change atau delete session.

### B. Live verification matrix

| Area | Actual action and evidence | Result / limit |
| --- | --- | --- |
| Login | Pengguna login sendiri; dashboard akun dan protected settings terbuka | Login account path observed; credential entry tidak diotomasi |
| Session restore | Beberapa full reload pada settings dan navigasi langsung history/dashboard | Sesi/identitas terverifikasi pulih tanpa login ulang |
| Profile persistence | Simpan nama uji melalui form → reload → nama uji tetap ada → simpan nama asli | PASSED; UI, ekspor dan SELECT cloud mengonfirmasi restoration |
| Animation preference | system → reduced → full reload → reduced → system | PASSED; restored |
| History retention preference | manual → disabled → full reload → disabled → manual | PASSED; restored |
| Guest Feedback | Form kategori other, teks berlabel uji, no contact/report/file, explicit consent → kirim | Receipt nyata; SELECT mengonfirmasi owner null dan consent true |
| Account Feedback | Form other saat login, teks berlabel uji dan explicit account linkage/consent → kirim | Receipt nyata; SELECT owner cocok dengan identitas ekspor |
| Guest idempotency | Dua retry payload/key yang sama melalui FastAPI nyata; key dibaca hanya dari record uji yang diotorisasi | Keduanya 200 dengan receipt sama; total Feedback tetap dua |
| Account export | Tombol Unduh data JSON → actual backend download → parse file lokal | Format v2, nama/default prefs pulih, saved_reports kosong, tepat satu Feedback akun, guest receipt tidak ada |
| Export secret handling | Pemeriksaan file unduhan | Tidak ada access_token/refresh_token/password_hash; file ignored Git |
| History empty state | Protected `/history` dengan sesi nyata | Empty state berhasil, tanpa fallback data palsu |
| Search on empty history | Isi kata kunci UJI PHASE 5 | Empty state tetap tertangani; bukan bukti pagination dataset nonempty |
| Missing detail | Buka UUID report yang tidak ada | UI menampilkan laporan tidak ditemukan/tidak dapat diakses; tidak menghasilkan analisis buatan |
| Full cross-user isolation | Tidak ada ordinary test user kedua yang diotorisasi | CLOUD CROSS-USER RLS: NOT VERIFIED |

Aktivitas ini memakai UI existing → FastAPI existing → Supabase cloud existing.
Token tetap dikelola SDK/browser aplikasi; tidak mengekstrak Authorization header,
session storage, password manager atau refresh token untuk melewati alur aplikasi.
SELECT owner digunakan untuk memeriksa hasil, bukan menyamar sebagai dua pengguna
atau menulis data akun melalui role postgres.

### C. Receipt matching and idempotency evidence

| Context | Label | Receipt |
| --- | --- | --- |
| Guest | UJI PHASE 5 GUEST 20261025-01 | `4b36d40a-4f4b-4a40-9021-1f1360385dd5` |
| Account | UJI PHASE 5 ACCOUNT 20261026-01 | `1c9556e6-5ffa-4fe9-aa7a-2626d6bdca31` |

Label guest memuat tanggal rangkaian uji dimulai; pengujian berlanjut melewati
pergantian hari. Kedua receipt dicocokkan dengan SELECT pada id dan label yang
tepat. Record akun memiliki owner yang cocok dengan profil ekspor; record guest
tidak mempunyai owner, contact_email atau report_id. Consent true pada keduanya.

Untuk menguji retry, hanya submission_key record guest uji tersebut dibaca melalui
akses owner yang sudah tersedia. Payload yang persis sama dikirim dua kali ke
`POST /api/v1/feedback` sebagai guest, tanpa token akun. Keduanya merespons 200
dan receipt yang sama. SELECT sesudah retry mengonfirmasi **history=0, feedback=2**.
Tidak ada duplikasi atau tambahan completed-report fixtures.

**Kedua Feedback uji sengaja tetap disimpan.** Pengguna mengizinkan Feedback uji
tetapi tidak penghapusan data; tidak melakukan cleanup dengan DELETE, menghapus
riwayat atau menghapus akun. Record tersebut jelas berlabel uji dan menyatakan
tidak memerlukan tindak lanjut. Jika pemilik menginginkan cleanup kelak, gunakan
prosedur terpisah yang ditinjau dan dibatasi tepat dua id/label tersebut.

### D. Export artifact and private evidence

Unduhan ekspor sebenarnya disimpan melalui dialog browser ke:

`frontend/.phase5.local/account-export-20261026.json`

File mengandung data akun pribadi, tetapi bukan credentials. `git check-ignore`
mengonfirmasi ia diabaikan Git. Isinya diperiksa tanpa mencetak email/UUID profil
ke report: format_version=2, nama asli, dua preferensi awal, saved_reports=[],
dan tepat satu feedback dengan id receipt akun di atas. Receipt guest tidak ada.
Ini membuktikan scope ekspor akun terhadap guest data yang tersedia; belum
membuktikan seluruh skenario isolasi dua pengguna authenticated yang berbeda.

Bukti privat lain pada direktori ignored yang sama mencakup:

- `owner-ui-restore.json`, `account-preferences-ui.json`;
- `guest-feedback-ui.json`, `account-feedback-ui.json`;
- `account-export-verification.json`, `history-ui-verification.json`;
- `owner-cloud-evidence.json`, `guest-idempotency-verification.json`;
- `final-owner-verification.json`.

Jangan memasukkan isi ekspor pribadi/snapshot tersebut ke Git. Report ini menyimpan
kesimpulan dan receipt uji, bukan credentials atau full export akun.

### E. Code, regression and remaining scope

**Tidak ada defect aplikasi baru yang terkonfirmasi dalam live checks ini.**
Tidak mengubah komponen, API, desain, dependency atau file migrasi. Penyebab gap
integrasi sebelumnya tetap skema cloud yang belum diterapkan; migrasi existing
telah menyelesaikan gap tersebut. Pada continuation ini hanya report existing
yang diperbarui, beserta evidence lokal ignored dan dua record Feedback uji yang
secara eksplisit diizinkan.

Hasil regresi setelah aktivasi migrasi pada bagian J tetap berlaku: 191 frontend,
89 backend, lint/build/routes dan PGlite lulus. Tidak mengulang seluruh suite
setelah live QA karena tidak ada application-code/schema fix atau kegagalan baru
yang membenarkan pengulangan. Keberhasilan UI/cloud di bagian K merupakan bukti
tambahan yang berbeda dari mocked tests tersebut.

**Final status: PARTIALLY COMPLETE — SPECIFIC ITEMS PENDING.**

Aktivasi skema dan live integration akun tunggal sudah terbukti pada cakupan
di atas. Yang belum dapat diberi label passed:

1. Dua approved ordinary users untuk profile/preferences/history/report/reference/
   export isolation dan privilege escalation pada cloud. Tidak membuat akun atau
   menganggap akun kedua existing boleh digunakan tanpa izin.
2. Eligible completed-report save/opt-out/delete dan pagination dengan laporan sah.
   Engine belum tersedia; tidak membuat verdict palsu. Local/PGlite fixtures dan
   definisi RLS/RPC tetap bukti pada tingkat masing-masing, bukan live eligible save.
3. Live logout/revocation dalam QA ini tidak dijalankan; sesi pengguna sengaja
   dipertahankan. Login dan restore nyata diamati, token refresh/revocation/idle
   tetap memiliki tes lokal tetapi belum simulasi lifecycle penuh di cloud.
4. Registration/email callback/recovery provider flow, target deployment HTTPS,
   SPA fallback dan Auth redirect allowlist belum diverifikasi sebagai deployment E2E.
5. Full backup/restore masih belum terverifikasi dan ledger standar masih absent;
   jangan rerun 001–004 atau db push tanpa rekonsiliasi objek/ledger yang ditinjau.

Tidak ada alasan dari hasil ini untuk membangun ulang fitur Phase 1–4 atau mulai
Admin Dashboard/engine di luar izin. Keputusan kesiapan Phase 6 harus mempertimbangkan
daftar batas nyata tersebut, bukan klaim seluruh cloud authorization sudah diuji.

## Phase 5 Final Continuation — Authentication Scope Alignment & Cloud Security Verification

Pemeriksaan lanjutan: **29 Oktober 2026, Asia/Bangkok**. Bagian ini menggantikan
kesimpulan scope autentikasi pada bagian historis sebelumnya; bukti lama tetap
berlaku hanya pada cakupan dan tanggal yang dinyatakan.

### A. Authentication Scope

Mandatory registration email verification dan product MFA/2FA **dihapus secara
sengaja melalui keputusan pemilik produk**, bukan fitur tertunda. Email/password
signup, login, validasi sesi/identitas backend, role database, JWT, ownership/RLS,
Forgot Password dan Reset Password tetap dibutuhkan. Auto-confirm provider tidak
membuktikan kepemilikan kotak masuk email.

### B. Existing Implementation Audit

| Component | Existing Behavior | Required Action | Final Result |
| --- | --- | --- | --- |
| Signup action | Sesi signup langsung di-signOut dan dianggap salah konfigurasi; tanpa sesi justru menghasilkan notice sukses | Terima sesi provider yang konsisten; tolak respons gagal/null session secara generik | Fixed; unit regression membuktikan perilaku lama gagal dan perbaikan lulus |
| Register page | Selalu menuju `/verify-email` | Periksa identitas backend melalui refresh existing, lalu tujuan sesuai role database | Fixed; test sukses dan gagal verifikasi backend |
| VerifyEmail route | Gate wajib konfirmasi email | Pertahankan URL lama sebagai redirect kompatibilitas | `/verify-email` menuju `/login`, tanpa UI verifikasi |
| Login | Error menyuruh verifikasi akun | Perjelas email/password, pertahankan validasi provider/backend | Copy diperbaiki; validasi tetap |
| Settings profile | Mengklaim email telah diverifikasi | Bedakan autentikasi sesi dari kepemilikan email | Copy dan regression diperbaiki |
| Recovery | PKCE/recovery OTP; URL dibersihkan; marker pemulihan terbatas; validasi provider | Pertahankan; perjelas pesan kode pemulihan | Mekanisme tetap; copy diperjelas |
| FastAPI identity | Signature/issuer/audience/expiry/UUID/session/user/role DB diperiksa; provider timestamp konfirmasi dibutuhkan | Uji compatibility auto-confirm sebelum mengubah | Tidak diubah; dua signup baru berhasil melalui backend cloud integration |
| PostgreSQL active_session | auth.uid + session_id + live auth.sessions + user enabled/nonanonymous + timestamp konfirmasi | Uji runtime auto-confirm; jangan rerun migrasi | Tidak diubah; dua signup dapat membaca row sendiri, JWT setelah logout tidak dapat |
| Product MFA | Tidak ada enrollment/challenge; `/auth/mfa` redirect settings; aal1/aal2 diterima | Pertahankan; jangan menambah gate | Sudah sesuai scope produk; audit kode |
| Historical first-admin bootstrap | Fungsi owner-only, satu kali, memiliki TOTP precondition | Jangan mengubah provisioning administrator tanpa scope/approval terpisah | Dipertahankan; bukan gate runtime pengguna/admin |

### C. Confirmation Compatibility

Read-only Auth `/auth/v1/settings` pada target exact project mengembalikan 200,
email enabled, signup enabled, anonymous disabled, **mailer_autoconfirm=false**
sebelum perubahan. Setelah persetujuan target **main / PRODUCTION** dan save UI,
GET yang sama mengembalikan 200 dan **mailer_autoconfirm=true**; email/signup tetap
aktif dan anonymous tetap nonaktif. Alur produk baru sudah aktif pada target ini.

Frontend kini tidak memasang `emailRedirectTo` signup dan tidak menandatangani
pengguna keluar saat provider memberi sesi signup langsung. Respons signup gagal,
duplikat, sesi hilang, identitas tidak konsisten, atau anonymous tidak menghasilkan
klaim sukses. Dashboard memerlukan identitas backend dengan id yang sesuai.

Kontrak provider menjelaskan Confirm email disabled mengembalikan user + session
dan mengonfirmasi status email secara otomatis. Karena itu pemeriksaan timestamp
existing pada login, backend dan `active_session()` berpotensi kompatibel tanpa
migrasi. **Runtime AWASIN kini terbukti:** dua signup baru menggunakan action
registrasi existing menghasilkan sesi, `email_confirmed_at` terisi otomatis,
`GET /auth/me` memberi identity user yang sesuai, dan RLS memberi profil milik
sendiri. Tidak ada browser mailbox confirmation. Pemeriksaan existing kompatibel;
tidak perlu dihapus atau dimigrasi. Timestamp bukan bukti inbox ownership.
Referensi resmi: [Supabase signup](https://supabase.com/docs/reference/javascript/auth-signup).

Tidak menghapus pemeriksaan sesi, JWT, recovery, role, ownership, atau account state
untuk sekadar membuat tes lulus. Tidak ada migration 005 yang dibuat secara spekulatif.

### D. Two-User Cloud Authorization

Pemilik menyetujui dua akun development uji dengan email non-deliverable dan
password acak yang tidak dicetak/disimpan dalam laporan. Dua akun dibuat melalui
`createAuthActions.register` existing + Supabase SDK dengan storage memory-only;
bukan admin-create-user atau manipulasi auth.users. Password/token hanya di memori
selama proses QA, tidak diambil dari browser. Kedua akun uji di-logout setelah QA.

| Label | Test account ID | Account Feedback receipt |
| --- | --- | --- |
| A | `5ca3fc0e-30f5-4c56-a33f-8965a6542569` | `1ee2caa2-9f94-41c7-a651-04279baed01a` |
| B | `3dc6ca5b-d7fa-4ab0-86d1-19055c548e8f` | `0d7e62f6-dc94-4704-b2ec-5a26743e7323` |

Alamat uji memakai domain reserved `example.com`. Guest Feedback sebelum signup A
memakai contact email identik, receipt `dbe26222-98eb-474e-b419-dcc45bc5506b`.
Tiga record berlabel **UJI PHASE 5** dan dua akun tetap ada sesuai izin; tidak
melakukan cleanup penghapusan atau mengubah dua Feedback existing bagian K.

| Scenario | Evidence sekarang | Cloud final-continuation status |
| --- | --- | --- |
| Self/cross-user profiles dan preferences | Real FastAPI + Supabase REST/RLS, kedua arah A/B | PASS own profile/preferences; cross-user select kosong, PATCH nama/preferences zero rows; nama tetap sama dan preferences dipulihkan |
| History list dan export | Real FastAPI/REST/RLS untuk dua akun | PASS empty history dan ekspor tetap identity sendiri walau owner_id query diisi akun lain; kedua akun belum punya laporan |
| Completed history detail/delete/save/reference | Local backend/frontend/PGlite; cloud tidak ada legitimate engine reports | PENDING engine; empty foreign-row select bukan bukti denial record completed yang benar-benar ada |
| Private Feedback | Real Feedback receipts + REST/RLS + account export | PASS masing-masing hanya mengekspor satu Feedback sendiri; akun lain tidak dapat SELECT Feedback privat |
| Guest contact-email bukan ownership | Guest dibuat sebelum A mendaftar dengan email identik | PASS guest receipt tidak masuk ekspor A/B setelah signup |
| Admin API/metadata role escalation | Real FastAPI + REST ACL + user metadata update | PASS kedua ordinary users mendapat 403 admin; direct role PATCH 403; metadata role=admin tidak memberi akses admin |

Tidak memakai token pemilik sebagai dua pengguna; tidak menulis fake completed
reports; tidak mengubah atau menghapus dua Feedback uji existing.

### E. Auth Lifecycle Results

| Lifecycle | Local evidence | Live cloud/browser evidence pada continuation ini |
| --- | --- | --- |
| Register | Immediate session, invalid input, generic provider failure, null/mismatched/anonymous identity; backend-confirmed navigation | PASS dua signup action/SDK baru + backend/RLS; bukan browser form E2E |
| Login | Provider failure, generic errors, backend identity, destination role | PASS password relogin kedua akun uji + identitas backend yang sesuai; pemilik tidak digunakan |
| Restore/refresh/idle | Existing race/shared refresh/protected state/session activity regression lulus | PASS SDK setSession mengembalikan user yang sesuai; full browser reload/cross-tab/one-hour idle belum diulang live |
| Logout/revocation | Existing local state cleanup/provider-error semantics dan local database revoked-session regression lulus | PASS kedua akun: local getSession null; JWT lama (belum expired) mendapat 401 /auth/me; REST profil kosong/denied; revoked refresh token gagal; relogin identity benar |
| Forgot Password | Provider recovery redirect dan respons generik lulus mock | Email nyata belum dikirim |
| Reset Password | Invalid/expired/cross-browser PKCE, OTP, StrictMode, setup marker, provider password failures lulus | Memerlukan approved deliverable test mailbox/user-operated recovery; tidak reset password pemilik |

### F. Files Changed

- `frontend/src/features/auth/actions.ts`: immediate signup session, generic failure,
  hapus mandatory email redirect/signout; perjelas login failure.
- `frontend/src/pages/auth/RegisterPage.tsx`: backend identity refresh/matching id
  sebelum navigasi dashboard, tanpa gate email.
- `frontend/src/pages/auth/VerifyEmailPage.tsx`: compatibility redirect.
- `frontend/src/pages/SettingsPage.tsx`: hilangkan klaim inbox ownership.
- `frontend/src/pages/auth/ResetPasswordPage.tsx`: pesan menjelaskan kode recovery.
- `frontend/tests/auth.test.tsx`: ubah ekspektasi scope lama dan tambah regressions
  signup/gate/backend-navigation.
- `frontend/tests/settings.test.tsx`: regression copy email ownership.
- `frontend/scripts/check-routes.mjs`: daftar halaman auth yang menghasilkan h1 tidak
  lagi memuat route yang sekarang redirect; redirect dibuktikan di auth test.
- `PHASE5_IMPLEMENTATION.md`: laporan existing ini diperbarui, bukan laporan tandingan.

Tidak ada dependency, desain/CSS, backend, atau migrasi applied yang diubah.
`supabase/tests/phase5_cloud_audit.sql` tetap file audit read-only existing.

### G. Cloud Changes

Pemilik telah menyetujui disable Confirm email pada project development exact ref
`nqruowgbxiopfhslznyb` dan pembuatan dua ordinary test users. Dashboard yang aktif
berhasil dibaca pada exact ref itu, dengan branch **main / PRODUCTION**, Healthy,
No migrations, No backups. Label dashboard ini tetap target utama meski aplikasi
belum diluncurkan. Tidak menganggapnya database disposable.

Automatic approval review sempat menolak toggle karena izin development dianggap
belum jelas mencakup branch main / PRODUCTION. Aksi tidak dijalankan selama blocker.
Pemilik kemudian **secara eksplisit menyetujui branch main / PRODUCTION exact ref**;
toggle dan Save changes lewat dashboard yang sama berhasil, tanpa workaround
endpoint/management credential. Auth settings GET membuktikan hasilnya.

Cloud mutation yang dilakukan: Confirm email disabled; dua ordinary users uji,
tiga Feedback uji; preference masing-masing test user sementara lalu dipulihkan;
metadata `role` akun B sementara untuk uji privilege lalu dinullkan; sesi akun uji
dibuat/logout/relogin/logout. Tidak mengubah akun/role/bootstrap/session pemilik.

Audit read-only URL Configuration: Site URL `http://localhost:5173`; exact redirect
allowlist `http://localhost:5173/reset-password` dan legacy `/verify-email`.
Tidak ada wildcard yang terlihat; tidak menambah/menghapus URL. Rate Limits:
signup/signin 30 per 5 menit per IP, refresh 150 per 5 menit, OTP verification
30 per 5 menit; UI email rate 30/h dan interval 60 detik. Nilai ini dicatat dari
dashboard, bukan uji beban atau bukti actual email deliverability.
Local config: development, debug false, matching publishable keys, loopback HTTP
API, CORS explicit localhost/127.0.0.1:5173, JWT ES256; tidak ada nilai key dicetak.

Migrasi 001–004 tidak dijalankan ulang, tidak ada db push, role/bootstrap pemilik
tidak diubah, ledger tidak direkonsiliasi, tidak ada cleanup destruktif.

### H. Test Results

Executed 29 Oktober 2026, Windows, existing installed dependencies:

| Command | Evidence type | Result |
| --- | --- | --- |
| `npm.cmd test -- tests/auth.test.tsx` sebelum fix | Mocked regression/red | 11 gagal, 29 lulus: reproduced immediate signup rejection, fake no-session success, obsolete gate |
| Focused auth/settings/callback/password-setup tests setelah fix | Unit/mocked integration | 66 lulus dalam 4 file |
| `npm.cmd test` setelah fix | Unit/mocked integration | **199 lulus, 20 file**, exit 0 |
| `npm.cmd run lint` | Static lint | Exit 0 |
| `npm.cmd run build` | TypeScript/Vite local build | Exit 0; process-only HTTPS API placeholder, tidak mengubah env deployment |
| `npm.cmd run check:routes` | Local SSR/contract | Exit 0; 23 halaman + validasi scan/email/feedback/transport |
| `npm.cmd run check:history-db` | Local PostgreSQL/PGlite | Exit 0; migrations 002–004, RLS/revoked session/consent/ownership/RPC |
| Backend `.venv/Scripts/python.exe -m pytest -q` | Unit/mocked integration | **89 lulus**, exit 0 |
| `node .phase5.local/final-cloud-check.mjs` | Real cloud SDK/FastAPI/REST/RLS | **51 checks lulus, 0 gagal**, exit 0; dua identity baru, autoconfirm/backend compatibility/ownership/export/admin/logout |

Warnings existing: Vite main chunk 729.31 kB (>500 kB) dan Starlette/httpx
deprecation. Bukan kegagalan verifikasi. Build sukses bukan deployment HTTPS nyata.
Tidak menjalankan ulang semua suite tanpa perubahan/failure baru yang relevan.
Cloud QA harness dan evidence tersimpan di `.phase5.local/`, dikonfirmasi Git-ignored.
Evidence `final-cloud-evidence.json` hanya menyimpan hasil, label/account IDs, email
uji reserved dan receipts; tidak ada password/JWT/refresh token/raw exports. Script
QA bukan entrypoint aplikasi dan tidak otomatis berjalan bersama launcher.

### I. Remaining Risks

1. **Development blockers:** recovery email delivery/reset dengan mailbox uji
   deliverable belum terbukti. Dua akun uji sengaja tidak punya inbox. Full browser
   E2E signup/login/logout/reload/cross-tab/idle belum diuji pada continuation ini.
   Browser sebelumnya sempat gagal memastikan URL; dashboard Supabase kini dapat
   dibaca setelah pengguna mengaktifkannya. Tidak mengambil token browser.
2. **Phase 6 prerequisites:** pertahankan role database, batas privacy dan regression
   A/B yang sudah lulus; tutup gap recovery/browser lifecycle, rancang admin scope
   terpisah. Historical owner-only first-admin bootstrap tidak diubah. Penghapusan
   akun/data uji memerlukan izin terpisah; tidak mengklaim test cleanup deletion.
3. **Engine-dependent limitations:** belum ada legitimate completed analysis report
   untuk save/delete/detail/pagination/cross-user false-detection reference cloud.
   Local fixtures tidak disamakan dengan bukti cloud. Tidak membuat verdict palsu.
4. **Production launch requirements:** verifikasi deployment HTTPS/SPA fallback,
   Site URL dan recovery allowlist produksi (development telah diaudit), email delivery/recovery mailbox,
   password policy/rate limits/CAPTCHA/abuse monitoring sesuai risiko auto-confirm,
   CORS explicit origin, secret handling, full backup/restore, dan plan rekonsiliasi
   migration ledger sebelum deployment workflow. No backups/No migrations masih
   teramati di dashboard. Tidak mengubah billing/provider/hosting tanpa scope.

### J. Final Status

**PARTIALLY COMPLETE — SECURITY VERIFICATION PENDING.**

Koreksi scope autentikasi lokal selesai, Confirm email cloud disabled sesuai izin
branch exact, runtime auto-confirm/backend/RLS kompatibel tanpa migrasi baru, dan
51 available cloud integration checks dua-user/role/export/logout telah lulus.
Security verification belum penuh karena live recovery memakai inbox yang dapat
diakses dan browser E2E lifecycle belum dijalankan; engine-dependent cloud report
checks tetap dibatasi secara eksplisit. Tidak ada commit/push, pemilik tidak
di-logout/reset, dan data existing dipertahankan.
