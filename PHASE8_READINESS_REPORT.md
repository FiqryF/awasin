# AWASIN — Phase 8F Readiness

Tanggal: 5 November 2026, Asia/Bangkok. Branch `main`, baseline HEAD
`69766069ae1b2ec3714733f7b2aa484a626fbf95`; perubahan Phase 8 belum committed.

## Keputusan: NOT READY

Ini keputusan **gate penuh Phase 8**, bukan klaim terdapat exploit critical yang
telah dibuktikan. Gap mandatory security verification browser/session yang masih
terbuka adalah B02 idle/wake/expiry. B01 login lifecycle dan pergantian identitas
sudah ditutup dengan browser aktual. Tests lokal dan A4 API tidak menggantikan
bukti browser idle/expiry. Belum ada acceptance eksplisit untuk memilih READY WITH ACCEPTED
LIMITATIONS. Production readiness tidak dinyatakan.

## Bukti final

| Kategori | Hasil / lokasi |
| --- | --- |
| Implemented | Body cap API write; export UI owner-bound; invalid-login focus fix |
| Verified locally | 241 frontend tests; lint; TypeScript/Vite build; 24 routes; History/Admin PGlite PASS |
| Verified HTTP lokal | Fresh instance 8001: health 200, oversized profile/Feedback 413, CORS + no-store benar |
| Verified cloud read-only | 31 anonymous HTTP checks PASS; 4 originals public, 2 test articles withdrawn, private tables/APIs denied |
| Verified cloud reused | Phase 7 A4 33 PASS/cleanup, revoked JWT 401/relogin; D/E/F/audit existing PASS |
| Verified browser guest | 8 protected routes redirect Login; 9 responsive views 375/768/1440; error focus login-email/aria-invalid true |
| Dependencies | npm runtime 0 advisory; PyPI runtime metadata 26 clear/0 blocked; snapshot, bukan jaminan |
| Backend full regression | 131 PASS sesudah perbaikan fixture Content-Type; dua warning existing |
| Authenticated browser | B restore/navigation/new-tab/logout/protected rejection, relogin dan switch F1→Firmansyah→F1 antartab PASS; F1 dipulihkan, tab QA ditutup. A asli tetap dashboard pada AX read-only. Idle/expiry masih pending |
| Export browser | F1 download JSON selesai 443 byte; format v2, identitas sesuai, field rahasia absent; bukti lokal git-ignored |
| Provider dashboard | Signup/login 30/5 menit/IP; P1 minimum sandi 6→8 disetujui, tersimpan dan panel dibuka ulang verified. CAPTCHA/leaked-password off; toggle lain tidak diubah |
| Session virtual-time rerun | 3 files / 65 PASS, 5.27 detik; idle satu jam virtual, wake/input, storage events antartab, AuthProvider redirect dan refresh tanpa revival. SDK mocked/jsdom; bukan live idle proof |
| Kelanjutan B06 dan B16 | History/Admin PGlite PASS. 104 frontend dan 131 backend PASS untuk regresi sesi, akses dan kegagalan API. B06 dan B16 ditutup sesuai cakupan Phase 8 |
| Audit npm penuh, 11 November | B26 selesai. Override minimatch@10 ke 11.0.1, audit 0 advisory. ESLint 149 file sama dan bersih, 241 tes serta build PASS |

Command lengkap dan defect history pada `PHASE8_IMPLEMENTATION.md`, audit Auth,
Security, Privacy, Quality; backlog pada `AWASIN_MASTER_BACKLOG.md`.

## Blocked / dependency yang belum diterima

| ID | Dampak / prasyarat | Closure target |
| --- | --- | --- |
| B02 | Live F1 INCONCLUSIVE; pengguna memilih alternatif virtual (65 PASS) dan membatalkan wait. Idle/wake/provider scheduling browser nyata tetap belum terverifikasi | 8 sebelum gate penuh |
| B03 | Tidak ada inbox deliverable untuk recovery/reset lengkap; jangan memakai .invalid sebagai bukti delivery | 8/11, acceptance eksplisit bila nonblocking untuk Phase 9 |
| B05 | Setting provider dibaca, minimum8 diperbaiki melalui P1 berizin; CAPTCHA off, enforcement abuse test belum tersedia | 8/11 sebelum public launch |
| B07 | Ledger historis absent; reconciliasi hanya rencana, tidak db push/reset/history fabrication | 8 read-only / 11 approved reconciliation |
| B08 | Tidak ada actual backup restore proof; local schema bukan backup produksi | 11 sebelum produksi; isolated restore approval |
| B10 | Rancangan penghapusan akun tersedia di laporan privasi. Retensi, perlakuan Feedback dan prosedur Admin menunggu keputusan | 8 design / 11 implementation berizin |
| B14/B15 | Runtime profiling, reader/Firefox, mobile authenticated coverage belum lengkap | 8/11 sesuai scope |

## Deferred / outside scope

Kontrak job/orchestration/provenance issuance/source policy ke Phase 9. Lima
engine dan real analysis integration ke Phase 10. Deployment/gateway/TLS/CSP/
distributed rate limit/monitoring/backup recovery drills serta whole-system
sign-off ke Phase 11. Item tersebut tetap traceable dan tidak berubah menjadi
DONE. Automated Domain Collection tetap excluded.

## Jalan penutupan gate

Pemeriksaan kelanjutan 5 November menemukan jendela uji F1 sudah tidak terbuka.
Tes idle browser memerlukan sesi uji aktif atau keputusan cakupan yang eksplisit.
Backlog setelah remediasi B26 pada 11 November mencatat 8 selesai, 9 item terkait Phase 8 masih terbuka dan
9 khusus fase berikutnya.

Selesaikan B02 melalui sesi uji terisolasi atau handoff login sah tanpa
mengekstrak password/token. Catat outcome per scenario. Recovery/provider/backup
memerlukan dependency masing-masing; risiko tidak diturunkan otomatis. Bila owner
ingin menerima limitasi noncritical untuk controlled Phase 9, persetujuan harus
menyebut ID, risiko, owner dan target closure; laporan belum mencatat penerimaan itu.

Cloud configuration write terbatas P1 minimum sandi 6→8 sudah berizin dan verified.
Tidak ada perubahan password/role/data akun owner, engine palsu, deploy,
commit atau push. Rekomendasi desain Phase 9 dapat dipelajari, tetapi gate ini
tidak mengotorisasi kelanjutan implementasi engine atau produksi.
