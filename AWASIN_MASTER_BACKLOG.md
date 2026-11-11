# AWASIN — Master Backlog

Checkpoint awal Phase 8, 5 November 2026. Status DONE memerlukan implementasi dan
bukti yang sesuai; PARTIAL bukan approval defer. Tidak ada limitasi yang dianggap
diterima hanya karena dipindah target. Pemilik keputusan produk/risiko: pemilik
AWASIN; implementasi/verifikasi: pengembang. Detail bukti pada laporan Phase 8.

| ID | Origin Phase | Module | Description | Severity | Status | Evidence | Dependencies | Target Phase | Closure criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B01 | 5/7 | Auth | Browser login/logout/relogin/switch/back-forward/multi-tab | High gate | DONE | A4 API; B restore/navigation/new-tab/logout/protected rejection; switching F1→Firmansyah→F1 dan login ulang antartab PASS; A asli tetap dashboard pada AX; tab QA ditutup | Idle/expiry dipisahkan pada B02; AX A bukan fresh server request | 8 | Matriks browser dan tidak ada identity/avatar bleed |
| B02 | 5/7 | Session | Idle, wake, expired session browser | High gate | PARTIAL | Tes virtual 65 PASS, revoked JWT cloud PASS. Baseline F1 aktual 11 November 01:55:58.916 UTC, ended=false | Periksa sesudah 02:55:58.916 UTC, dengan baseline dan marker akhir dicocokkan | 8 | UI ditutup dan server menolak ketika relevan |
| B03 | 5/7 | Recovery | Email delivery dan reset lengkap | Medium | PARTIAL | Callback/OTP lokal. Pengguna menunjuk akun Fiqry Firmansyah pada 11 November. Paket R2 tercatat di audit Auth | Pengguna membuka inbox dan mengisi password baru, lalu verifikasi login ulang | 8/11 | Delivery, callback, reset dan relogin terbukti pada akun yang ditunjuk |
| B04 | 1/8 | API | Batas body sebelum JSON di route selain Feedback | Medium | DONE | 4 red tests; generalized cap; focused 63 PASS + actual HTTP 413 | Regression final | 8 | Implementasi dan bukti lokal/HTTP tersedia; bukan full DoS mitigation |
| B05 | 5/8 | Auth abuse | Provider rate limit/signup/recovery anti-abuse | High production | PARTIAL | Dashboard actual: login/signup 30/5min/IP; P1 disetujui, minimum provider 6→8 tersimpan/reopen verified; CAPTCHA off; leaked-password off (Pro) | Keputusan/integrasi CAPTCHA/password controls; isolated abuse test + gateway | 8/11 | Setting diverifikasi; abuse/load test di lingkungan terisolasi |
| B06 | 5/6/7 | RLS | Owner/Admin boundaries seluruh tabel dan RPC | High | DONE | History/Admin PGlite lulus ulang, cloud anonymous 31/31 dan bukti A4/D/E/F sebelumnya | Jalankan regresi relevan saat kebijakan berubah | 8 | Tes relevan lulus dengan cakupan cloud dan lokal terdokumentasi |
| B07 | 5 | Migrations | Standard ledger hilang | Medium | PARTIAL | SELECT aktual 11 November mengonfirmasi ledger absent, 9 tabel FORCE RLS, active_session dan avatar private tersedia. Rencana rekonsiliasi tercatat | Backup, review drift/clone dan approval history-only changes sebelum migrasi baru | 8/11 | Audit baca-saja dan rencana selesai. Rekonsiliasi dilakukan melalui prosedur berizin |
| B08 | 5 | Recovery ops | Backup dan isolated restore | High production | BLOCKED | Backup historis tidak terverifikasi | Snapshot berizin, encrypted storage, isolated project | 8/11 | Restore snapshot aktual diuji, RPO/RTO dan runbook tercatat |
| B09 | 5 | Privacy | User export: API ada, akses UI belum ada | Medium | DONE | UI owner recheck/abort; 26 focused tests PASS; browser F1 download selesai 443 byte, format v2, identity cocok, field rahasia absent; file git-ignored | Populated data/count limits dibuktikan test backend; browser hanya akun kosong | 8 | User dapat mengunduh export sah tanpa data lintas owner |
| B10 | 5/7 | Privacy | Account deletion + lifecycle Feedback/Auth/audit/avatar | Medium | PARTIAL | Rancangan tahap penghapusan, retry, FK, Storage dan retensi di laporan privasi | Keputusan pemilik produk dan approval terpisah untuk implementasi destruktif | 8 design / 11 execution | Retensi, ownership, final state disetujui dan diuji terisolasi |
| B11 | 5/7 | History | Manual consent, opt-out, delete | High | PARTIAL | Backend/PGlite; engine report nyata belum ada | Regresi; reports sah dari engine untuk E2E | 8/10 | Local invariant PASS; real report E2E saat engine ada |
| B12 | 7 | Avatar | Storage hash/overwrite/cross-user/revocation | High | DONE | A4 33 PASS + cleanup; Phase 7 report | Tidak ada perubahan relevan | 7 | Sudah tercapai; jangan tulis cloud ulang tanpa regresi |
| B13 | 6/7 | Feedback/CMS/Registry | D/E/F dan audit | High | DONE | Dua Feedback new v4, draft archived v3, domain archived/null verified_at | Regresi lokal/anon read | 7 | Bukti cloud retained; tanpa duplikasi records |
| B14 | 4/7 | Performance | Bundle sekitar 792 kB; runtime waterfall/CPU | Medium | PARTIAL | Build Phase 7; profiler runtime belum ada | Build terkini dan browser measurement | 8/11 | Ukur kontributor; optimasi hanya bila measurable; no threshold masking |
| B15 | 4/7 | A11y | Mobile/keyboard/focus/reduced motion; reader/Firefox | Medium | PARTIAL | Settings fixes dan tes; bukan WCAG penuh | Browser/perangkat/reader | 8/11 | Critical flows diuji, batas cakupan dicatat |
| B16 | 1–7 | Reliability | Safe errors, unavailable API, async races | High | DONE | Regresi 104 frontend dan 131 backend lulus. Cakupan error aman, API offline, timeout, race dan identitas stale | Latihan gangguan infrastruktur pada gate deployment | 8 | Fail closed, retry tepat dan output error tidak mengekspos input sensitif pada skenario yang diuji |
| B17 | 1–7 | Deployment | HTTPS, headers/CSP, secrets, proxy, monitoring, trusted IP | High production | OUT_OF_SCOPE | Development local; belum deploy | Hosting/gateway dan runbook | 11 | Deployment audit tanpa mengekspos secret |
| B18 | 1–8 | Analysis contracts | Jobs, provenance, evidence/source status, consent | Medium | PARTIAL | history contracts dan schema; no engine endpoints | Desain orchestrator | 9 | Kontrak versi dan trust boundary disepakati, tanpa verdict palsu |
| B19 | 1–8 | Link Inspector | Engine + real URL analysis | Future scope | OUT_OF_SCOPE | UI/input only | Architecture, sources, sandbox/SSRF design | 9/10 | Engine nyata, provenance dan evaluation |
| B20 | 1–8 | Message Analyzer | Engine pesan | Future scope | OUT_OF_SCOPE | UI/input only | Architecture/model/data review | 9/10 | Engine nyata dan evaluation |
| B21 | 1–8 | Fake Website | Engine website | Future scope | OUT_OF_SCOPE | UI/input only | Safe fetch/process isolation | 9/10 | Engine nyata, SSRF/isolation tests |
| B22 | 1–8 | QR Security | QR decode bukan verdict keamanan | Future scope | OUT_OF_SCOPE | jsQR local decode; no analysis | Link engine/orchestrator | 9/10 | Analisis nyata + unsupported/error semantics |
| B23 | 1–8 | AI Media | Image/video authenticity engine | Future scope | OUT_OF_SCOPE | MIME/size/preview only | Model/provenance architecture | 9/10 | Engine nyata dan evaluation |
| B24 | 6–8 | Sources/Registry | Threat intelligence management/automatic collection | Future scope | OUT_OF_SCOPE | Manual registry existing; no fake verified source | Real provider licensing/threat model | 9/11 | Sources design; automated collection tetap excluded |
| B25 | 1–8 | Final gate | Full system verification dan production sign-off | High production | PENDING | B01–B24 retained | Engine integration + production environment | 11 | Seluruh backlog punya executed closure atau acceptance eksplisit |

| B26 | 8 | Supply chain | Runtime advisories checked; dev-toolchain/dependency lifecycle review | Medium production | DONE | Override minimatch@10 ke 11.0.1. Audit npm penuh 0 advisory. ESLint 149 file sama, 0 error/warning. 241 tes dan production build PASS | Tinjau dan hapus override setelah upstream memakai versi patched. Audit berkala pada Phase 11 | 8/11 | Remediasi advisory dan kompatibilitas toolchain terverifikasi |

## Target pengguna, 16 November 2026

Pengguna menetapkan 16 November sebagai deadline dan mempertahankan fitur yang
sudah dibahas. Scope mencakup Link Inspector, Message Analyzer, Fake Website
Detector, QR Code Security Scanner, dan AI Media Authenticity Analyzer dengan
mode gambar serta video. Fitur akun, History/consent, edukasi dan Admin mengikuti
fondasi existing. Perencanaan ini menggunakan akhir hari 16 November WIB sebagai
asumsi waktu. Implementasi engine dimulai setelah gate fondasi diselesaikan.

| Tanggal | Alokasi kerja yang dituju | Dependency utama |
| --- | --- | --- |
| 11 November | Tutup bukti sesi dan audit keamanan yang dapat dijalankan. Tetapkan risiko tersisa dan acceptance untuk controlled development. | Sesi F1, Supabase dan handoff recovery |
| 12 November | Kontrak request/job/result, penerbitan provenance tepercaya, sumber dan jalur analisis Link | Gate fondasi, pilihan sumber serta izin akses provider |
| 13 November | Analisis Pesan dan Website dengan batas fetch/SSRF serta kasus uji | Sumber/model, sandbox fetch dan fixture evaluasi |
| 14 November | QR terhubung ke analisis Link, lalu alur media gambar/video | Provider/model media yang dapat diakses, batas upload serta evaluasi |
| 15 November | Integrasi hasil nyata ke History, consent, detail dan Feedback. Uji lintas akun serta kegagalan layanan | Kelima jalur engine dan provenance sah |
| 16 November | Regresi akhir, perbaikan penghalang, dan keputusan kesiapan delivery | Bukti uji, environment tujuan dan risiko yang diterima |

Jadwal ini merupakan alokasi target. Kelima engine masih bergantung pada sumber,
model, akses layanan dan data evaluasi yang belum ditetapkan. Risiko terbesar
ada pada analisis autentisitas gambar/video dan pengujian fetch website. Setiap
engine memerlukan output nyata, provenance serta kasus uji sebelum dinyatakan
selesai. Penanggung jawab teknis adalah pengembang. Pemilik AWASIN memutuskan
akses layanan, biaya, retensi, acceptance risiko dan keputusan delivery.
