# AWASIN — Phase 8C API/RLS/Database

5 November 2026. Scope: code, local regression, approved read-only requests.

## Inventory dan trust boundaries

| Routes | Authorization / validation |
| --- | --- |
| `/health`, `/api/v1/health` | Public; versi/service saja |
| `/auth/me`, `/profiles/me` | Verified user; update hanya display_name |
| `/account/preferences`, `/account/export` | Verified own user; export count exact, max 500 reports + 500 Feedback, fail incomplete |
| `/history`, `/history/{id}` | Verified owner; UUID/filter/cursor/limit bounded; consent/opt-out dan provenance pada RPC |
| `/feedback` | Guest/user; consent, allowlist, body cap, per-worker throttle + DB throttle; invalid bearer tidak menjadi guest |
| `/education`, `/education/{slug}` | Public published-only, nonpublished 404 |
| Lima modul `/admin/*` dan identity | Database-derived Admin role, JWT-bound RPC, optimistic version, audit atomic |

Tidak menerima user role dari editable metadata. `IdentityService.request` memakai
publishable key + JWT pengguna; tidak ada service-role dalam frontend/backend flow
ini. No redirects/trust_env pada provider HTTP. CORS explicit origins, no cookies,
docs off production, safe error envelopes/no-store tersedia. API inventory penuh
juga diperiksa oleh test OpenAPI `test_foundation.py`.

## Defect terkonfirmasi dan fix

Baseline middleware hanya membatasi POST Feedback 32 KiB. Empat request JSON
>256 KiB ke profile/preferences/history/Admin mencapai downstream dan menghasilkan
401, bukan penolakan ukuran. Risiko: parsing/buffering body besar sebelum model
validation, bukan bukti bypass authentication. Empat regresi baru FAIL sebelum fix.

Middleware existing dipindah menjadi `app/core/body_limit.py` / RequestBodyLimit:
API write methods dibatasi **256 KiB actual bytes**, Feedback tetap **32 KiB**,
termasuk chunked tanpa Content-Length. Prefix boundary eksplisit; CORS tetap outer.
Tidak menyentuh SQL, proxy atau cloud. Frontend error 413 dipisahkan dari batas
export agar oversized write tidak disebut kegagalan export.

Focused command: `.venv\Scripts\python.exe -m pytest -q
tests/test_request_limits.py tests/test_feedback.py tests/test_admin.py`:
**63 PASS**, 2 warning dependency/cache existing. Regression mencakup 4 endpoint,
chunked stop-reading, no-store/CORS, normal request dan Feedback cap. Ini hasil
lokal; bukan load-test internet atau mitigasi semua DoS. Edge concurrency/header/
slowloris/timeouts dan distributed throttling tetap membutuhkan deployment gate.

## RLS/RPC

Inspeksi migrasi: owner `auth.uid()` + active_session; read/write grants sempit;
SECURITY DEFINER search_path kosong, public revoke; Admin check juga pada RPC;
private notes/registry/audit Admin-only; public CMS published-only; avatar private
canonical path. Strong live A4/D/E/F evidence Phase 7 digunakan ulang. Regresi
PGlite final dicatat pada 8F; tidak menerapkan ulang migrasi cloud.

Kelanjutan 5 November menjalankan `npm run check:history-db` dan
`npm run check:admin-db` pada PGlite terisolasi. Keduanya lulus, termasuk penolakan
lintas akun, sesi dicabut, hak Guest/User/Admin, grant RPC, audit dan publikasi CMS.
Gabungan bukti lokal ini, 31 pemeriksaan cloud anonymous dan A4/D/E/F historis
memenuhi cakupan regresi B06. B06 ditutup untuk Phase 8.

## Ledger reconciliation — rencana saja

Audit historis: standard `supabase_migrations.schema_migrations` absent. Pemeriksaan
baru bila dashboard tersedia hanya SELECT `to_regclass`/catalog/schema, tidak
membaca kredensial. Belum ada izin membuat ledger. Rencana aman: inventory objek
dan definisi aktual/grants/policies, cocokkan 001–007 dengan hash file dan record
persetujuan; tinjau drift per objek; snapshot dahulu; uji reconciliation pada
clone; owner approve exact history-only changes. Jangan menganggap kesamaan
nama objek sebagai bukti byte-identical SQL atau menjalankan db push/reset.

Audit SELECT aktual 11 November pada Supabase SQL Editor mengonfirmasi ledger
`supabase_migrations.schema_migrations` absent. Sembilan tabel fondasi memiliki
RLS aktif dan FORCE RLS. Fungsi private `active_session` tersedia satu definisi.
Bucket `account-avatars` private dengan limit 2097152 byte. Terdapat empat policy
Storage objects. Query berisi SELECT atas katalog dan konfigurasi. Editor membuat
draft query baru dengan unsaved edits. Tidak ada tombol Save query atau operasi
DDL/DML yang dijalankan. Hasil ini melengkapi inspeksi baca-saja B07. Rekonsiliasi
historis tetap memerlukan review drift per objek, backup, clone dan persetujuan
exact history-only changes sebelum migrasi berikutnya.

## Backup / restore

Backup cloud yang dapat digunakan belum terbukti. Lokal `.sql` adalah skema,
bukan snapshot data persistent. Tidak ada restore test atas data user. Rencana:
pilih scope DB/Auth/Storage, encrypted export serta key ownership/retention,
proyek terisolasi untuk restore, cocokkan schema/count/FK/RLS/policies/object hashes,
uji Auth identity mapping tanpa mengekspos secret, ukur RPO/RTO dan cleanup clone
dengan izin. Tidak restore ke main. B08 tetap BLOCKED/high production gate.

## Batas bukti

### Kelanjutan audit provider baca-saja

Dashboard proyek awasin/main, 5 November: email sending 30/hour; signup/login
30/5 menit/IP; refresh 150/5 menit; token verification 30/5 menit; minimum interval
email per user 60 detik (dashboard menyebut hanya berlaku dengan Custom SMTP).
Signup aktif, manual linking/anonymous sign-in/email confirmation nonaktif.
Email provider dan secure email change aktif. Minimum password provider **6**,
berbeda dari frontend shared policy **8–128**; secure password change serta
require-current-password nonaktif. OTP 3600 detik/panjang 8. CAPTCHA nonaktif;
leaked-password protection nonaktif dan dashboard menyebut fitur Pro ke atas.
Tidak ada Save, toggle, credential access, signup, password reset atau load test.

Paket P1 konkret pada `PHASE8_PROVIDER_HARDENING_PLAN.md` hanya mengusulkan
minimum provider 6→8 agar sesuai frontend. Pengguna kemudian menyetujui P1 saja;
Save berhasil dengan notice “Successfully updated settings”. Panel Email dibuka
ulang: minimum tersimpan 8, Save disabled, OTP tetap 3600/panjang 8. P1 selesai;
tidak ada signup/reset password atau perubahan akun, maupun toggle lain.
Kontrol lain membutuhkan keputusan/integrasi masing-masing; tidak otomatis
diaktifkan karena dapat mengubah alur login/recovery atau memerlukan layanan baru.

Lokal != cloud != browser. Provider configuration kini dibaca aktual; enforcement
abuse/load tests, live negative write tests tambahan dan restore baru tidak diklaim lulus. Semua follow-up tetap di
master backlog; tidak ada scan unrelated infrastructure.
