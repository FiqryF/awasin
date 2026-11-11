# AWASIN — Phase 8A Audit

Tanggal: 5 November 2026, Asia/Bangkok. Baseline `main`, HEAD
`69766069ae1b2ec3714733f7b2aa484a626fbf95`; working tree awal bersih.
Tidak ditemukan AGENTS.md di inventory repo. Phase 7 berstatus VERIFICATION
PENDING; Phase 8 tidak mengubahnya menjadi fully verified.

## Bukti yang dipertahankan

Checkpoint final pada `PHASE7_FINAL_VERIFICATION.md` mengatasi status historis:
A4 33 PASS + 4 cleanup; hash/nonce/overwrite/isolasi avatar dan revoked JWT
terbukti di cloud. Browser ordinary utama telah melalui draft/discard/Save/
refresh/replacement/delete dan cleanup nol objek. D/E/F serta audit cloud lulus.
Migrasi 001–007 sudah diterapkan. Tidak ada kebutuhan mengulang tulisan tersebut.

## Audit awal

| Area | Implemented | Bukti dan kekurangan |
| --- | --- | --- |
| Auth/session | JWT signature/issuer/audience/expiry, online user + database role, idle 1 jam | Suite lokal dan A4 cloud; matriks browser login/switch/multi-tab/idle belum lengkap |
| Recovery | PKCE/OTP, callback URL dibersihkan, password setup terikat user | Tes lokal tersedia; inbox deliverable belum ditunjuk |
| API | CORS allowlist, no-store, safe errors, pagination/validation, Feedback throttle | Feedback saja memiliki batas body sebelum JSON; route JSON lain perlu pemeriksaan batas |
| RLS/RPC | Owner + active_session, Admin grants sempit, private Storage | PGlite dan bukti cloud Phase 5–7; ledger standar terakhir dilaporkan tidak ada |
| Data lifecycle | History deletion, manual opt-in/opt-out, export API | Export belum memiliki pemanggil UI; deletion akun disabled; PRD lifecycle tidak ditemukan |
| Backup | Bukti lama dashboard tidak memiliki backup | Belum ada snapshot/isolated restore yang terverifikasi |
| Engines | Scan validation dan contracts, provenance, consent | Lima engine/processing belum ada; Phase 9–10 |
| Quality | Error boundaries, safe fallbacks, motion, keyboard/dialog tests | Main JS sekitar 792 kB; runtime perf, mobile Auth, screen reader belum lengkap |

## Skill dan metode

Catalog sesi diperiksa sekali: ponytail (reuse/perubahan minimum),
systematic-debugging (reproduksi sebelum fix), verification-before-completion
(hasil aktual), computer-use (browser), impeccable bila ada defect UI nyata.
Instruksi skill yang sudah dibaca pada chat ini digunakan ulang. Tidak memasang
skill/dependensi baru atau memakai subagent. Output tool dibatasi ke bukti relevan.

## Keputusan checkpoint

8A selesai sebagai konsolidasi awal; backlog menjadi sumber pelacakan.
8B dilanjutkan dengan tes aman; pengguna menyiapkan dua sesi ordinary uji,
identitas/tab masih ditunggu. Tidak ada izin membuat/reset akun baru. Inspeksi
8C–8E tidak memerlukan tulisan cloud. Gate final tetap menunggu bukti 8F.

Kelanjutan: dua sesi teridentifikasi dan matriks B01 selesai, B09 ekspor browser
selesai. B02 idle awal belum konklusif, baseline baru terekam untuk pemeriksaan
sesudah 11:58 lokal. Audit provider baca-saja dilanjutkan P1 minimum sandi 6→8
setelah persetujuan spesifik pengguna; persist/reopen verified. Tidak ada migrasi
diulang, akun dibuat/reset atau cloud data akun dimutasi. Gate tetap NOT READY;
status terkini dan dependency pada readiness report/backlog.
