# AWASIN — Phase 7 Final Verification

Laporan diperbarui: **4 November 2026, Asia/Bangkok**. Pengujian cloud bertulis
dan browser dilakukan 3–4 November. Bagian **0** adalah checkpoint terbaru setelah
persetujuan A3/D/E/F; bagian 1–12 mempertahankan checkpoint sebelumnya untuk
menjelaskan baseline dan bukti awal. Status lama yang menyebut paket tersebut
belum disetujui telah digantikan oleh ledger bagian 0.

**Keputusan terbaru: C. PHASE 7 — VERIFICATION PENDING.**
Phase 7 belum fully verified dan laporan ini tidak menyatakan production ready.

## Final closure da4907d9 — checkpoint A4, 4 November 2026

SonarQube follow-up: 16 temuan pada screenshot ditangani melalui penghapusan regex
trailing slash berpotensi backtracking, Promise.all untuk probe HTTP independen,
pemisahan fungsi save profil/avatar, penggantian returnValue deprecated dengan
preventDefault, output/meter native, regex digit ringkas, handler sinkron dan
assertion toHaveLength. Visual empat bar kekuatan sandi dipertahankan; meter
native menjadi representasi aksesibelnya. Regresi beforeunload memeriksa guard
aktif hanya saat draft kotor. Tidak menambah suppression atau menonaktifkan rule.
Regresi terbaru: 235 frontend PASS, lint/build PASS, 31 HTTP baca-saja PASS.
SonarQube analyzer IDE tidak dijalankan lewat CLI; jumlah diagnostik nol perlu
dikonfirmasi melalui analisis ulang ekstensi, bukan disimpulkan dari ESLint.
Follow-up delapan temuan checker: loop kini hanya menyusun descriptor probe,
pasangan descriptor memakai satu push, dan eksekusi dilakukan sekali melalui
top-level `await Promise.all(probes.map(probe))`. Lint dan 31/31 HTTP kembali PASS.

Bagian ini menggantikan status avatar/API pending pada checkpoint A3 di bawah.
Branch `main`; HEAD `a76ab1483f3410d879f3cc336e86a42f48e6a07c`, perubahan lama
dipertahankan. D/E/F tidak diulang. Tidak ada migrasi, policy/role change, commit,
push atau deploy. Pengguna menyetujui tepat dua akun A4/B4 serta mengizinkan akun
utama untuk tes browser avatar; izin sesi/revokasi A4 tidak diterapkan ke pemilik.

### Helper yang diperbaiki

Helper SHA-256 sekarang terpisah dari identitas akun:
`frontend/scripts/avatar-qa-hash.mjs`. Sebelum jaringan, pemeriksaan known-answer
untuk `abc` dan input kosong harus lulus. Regresi
`frontend/scripts/check-avatar-qa-hash.mjs` juga memuat salinan helper dengan typo
`sha356` dan membuktikan pemeriksaan awal menolaknya. Tidak ada penggantian teks
massal nama akun pada fungsi hash. Satu assertion awal yang keliru mencoba
membandingkan seluruh source setelah substitution ikut mengubah digest fixture;
assertion itu diperbaiki menjadi reproduksi typo algoritma secara terisolasi.

Runner ignored `frontend/.phase7.local/a4-runner.mjs` memisahkan prepare, Storage,
session dan cleanup; perintah normal dapat memuat ulang step yang ditinjau tanpa
mengulang signup atau debugger. Password/sesi hanya di memori, tidak dicatat.

### A4 — Storage API dan Auth aktual: PASS

Preflight SELECT email tepat = 0 sebelum signup. Identitas ordinary dikonfirmasi
melalui FastAPI. A4 UID `58c03e80-e9d0-4a4f-82c6-62f4583f8404`, B4 UID
`762194a2-e28a-420e-8e38-647d97f9c536`; email sesuai rencana A4. Kedua akun retained.

| Skenario aktual | Hasil |
| --- | --- |
| Signup/ordinary identity/namespace awal | PASS, dua akun; HTTP 200 |
| Upload gambar A dan owner download | PASS 200, hash sesuai bytes upload |
| Overwrite gambar B | PASS 200 |
| Tiga download sesudah overwrite, nonce berbeda | PASS 200, seluruh hash sesuai B |
| Owner B4 membaca objeknya sendiri | PASS 200, hash sesuai A |
| Cross-account read dan overwrite, dua arah | PASS denial HTTP 400 masing-masing |
| Cross-account delete, dua arah | PASS HTTP 200 dengan nol objek dihapus; hash kedua owner tetap sesuai |
| Guest membaca objek existing A4 | PASS denial HTTP 400 |
| PNG mentah ke bucket JPEG | PASS penolakan; JPEG existing tetap sesuai hash |
| Logout A4 dan pakai JWT lama ke `/auth/me` | PASS logout 204, request JWT revoked ditolak 401 |
| Login ulang/identitas/avatar | PASS HTTP 200 dan hash avatar sesuai B |
| Owner delete dan download berikutnya | PASS objek dihapus; unduhan tidak tersedia |
| Cleanup A4/B4 | PASS list namespace kosong 200 dan logout 204 keduanya |

SHA-256 JPEG A: `04ce5b63b032939769680788beb54c1a81941c840be8d9c533b2e958455d31ad`.
SHA-256 JPEG B: `b76886729d252e9c1541d885f91e56bb3195f64c28b6f0b778c0f1b59eff9c26`.
Header download: `cache-control: private, max-age=0, must-revalidate`; initial/MISS
kemudian beberapa HIT, tetapi hash tetap B pada setiap nonce baru. Bukti ini
menunjukkan jalur dengan nonce benar pada pengujian aktual, bukan klaim semua
cache/CDN di semua keadaan telah terbukti. Tidak ada A/B experiment tanpa nonce
baru; FAIL sebelum perbaikan tetap dicatat sebagai bukti historis.

Total **33 PASS, 0 FAIL**, ditambah **4 cleanup PASS**. Evidence hash, nonce,
HTTP dan header aman: `frontend/.phase7.local/package-a4-evidence.json` (ignored).
Tidak ada password/token/cookie dicatat. Expired JWT berdasarkan waktu, idle dan
multi-tab browser tidak dianggap lulus hanya dari tes revoked JWT tersebut.

### Regresi closure terbaru

PASS: frontend 235/22 files; backend 123; lint; TypeScript/Vite build; 24 routes;
History DB dan Admin DB lokal PGlite; 31 HTTP publik baca-saja; SHA-256 helper
known-answer/typo checks. Build main tetap 792.27 kB / gzip 243.65 kB, warning
>500 kB tetap ada. Pytest masih memberi warning Starlette/httpx dan cache permission.
Marker dummy History yang diperiksa tidak ada dalam 30 JS chunks produksi;
source maps 0. Lima route Admin render PASS; tes ini bukan pengulangan cloud write.

### Browser dan keputusan sign-off

Browser native akun utama digunakan setelah izin eksplisit pengguna. SELECT
baca-saja mengonfirmasi akun ini ordinary (`owner_is_admin=false`) dan avatar
awal kosong. Hasil aktual berikut menggantikan status browser belum diuji:

| Skenario browser | Hasil |
| --- | --- |
| Select A tanpa Save | PASS: preview A, navbar default, Storage count 0 |
| Navigasi dengan draft | PASS: dialog muncul; Batal mempertahankan draft; Ya tinggalkan membuangnya |
| Buka ulang Settings setelah discard | PASS: tidak ada foto; tombol Hapus nonaktif |
| Save A | PASS: sukses dan navbar langsung A |
| Refresh setelah Save A | PASS: Settings, identitas dan navbar memulihkan A |
| Dropdown akun / Escape | PASS: menu terbuka dan tertutup melalui keyboard |
| Pilih B tanpa Save | PASS: preview B, navbar tetap A |
| Save replacement B | PASS: sukses dan navbar langsung B |
| Refresh B | PASS visual pada kelanjutan: B tetap tampil setelah reload sebelumnya |
| Stage delete B | PASS: dialog dan preview default, navbar tetap B sebelum Save |
| Save delete B / cleanup utama | PASS: sukses, tombol Hapus nonaktif, navbar ikon User default; nama tetap |

Foto awal akun utama kosong, maka cleanup mengembalikannya ke tanpa foto; tidak
ada foto pribadi yang ditimpa. Tes dilakukan pada viewport desktop native yang
ditampilkan kontrol komputer (capture 960×1025); ukuran CSS mobile khusus belum
dibuktikan. Tidak ada password/token browser dibaca atau diekstrak.
SELECT final sesudah cleanup: **owner_avatar_count=0, a4_avatar_count=0,
a4_session_count=0**. Akun utama tetap login; hanya sesi A4/B4 yang dicabut.
Browser logout/login, switch akun, multiple tabs, idle/expired session dan
failed-upload network injection masih NOT RUN/BLOCKED. Tidak disamakan dengan
API A4 yang lulus. Tes sesi owner tidak mencakup reset password atau global revoke.
Pemulihan email masih BLOCKED tanpa inbox deliverable yang ditunjuk. Outcome
tetap **C** selama workflow browser wajib masih belum selesai atau belum diterima
secara eksplisit sebagai deferred. Development completion, integration verification
dan production readiness adalah tiga penilaian berbeda.

**Sign-off 4 November 2026: C. PHASE 7 — VERIFICATION PENDING.** Storage API,
hash/overwrite, cross-account isolation, revoked JWT dan lifecycle dasar avatar
browser lulus. Matriks mobile, browser logout/relogin/account switch, multi-tab,
idle/expired session dan recovery belum mendapat bukti lengkap atau persetujuan
defer. Tidak ada blocker tersebut yang otomatis dianggap nonblocking. Implementasi
dipertahankan; perubahan closure hanya helper QA dan laporan, tanpa perubahan
produksi baru untuk menutupi typo helper.

## 0. Checkpoint terbaru — eksekusi A3, D, E, F pada 4 November

Pengguna secara eksplisit menyetujui A3, D, E, dan F. Preflight SELECT pada project
yang tepat menunjukkan semua email/ID submission/slug/nama organisasi/domain
target belum ada (lima kategori masing-masing count 0). Tidak ada signup ulang,
SQL write, migrasi, reset password atau perubahan role.

| Paket | Hasil terbaru | Keadaan akhir |
| --- | --- | --- |
| A3 | 44 pemeriksaan API PASS; kemudian BLOCKED oleh defect helper hash | Dua akun retained; nama dipulihkan; avatar kosong; logout 204 keduanya; empat cleanup checks PASS |
| D | PASS submit guest + A3, dua retry idempotent, Admin search/detail/status, persistence dan audit | Tepat dua record retained, new v4, note kosong, consent true, owner sesuai |
| E | PASS create draft v1, edit/preview/baca ulang v2, archive v3; akses publik ditolak ketika draft | Archived v3; tidak pernah published; tiga event audit sesuai |
| F | PASS organisasi baru, kandidat pending_review v1, rejected v2, archived v3, audit dan duplikat huruf kapital | Organisasi retained v1; tepat satu kandidat archived v3; verified_at null; tiga event audit |

### A3 — bukti, defect helper dan cleanup

Email A3/B3 mengikuti rencana `phase7-final-20261104-143c736e-a3@example.invalid`
dan `…-b3@example.invalid`. UID A3 `b9107c67-8a9e-43c1-ae51-b7c270ff3084`;
B3 `df1525d4-a0a3-4b85-9328-33cc3c3dc957`.

44 PASS meliputi signup/identitas ordinary, namespace awal kosong, profil sendiri
dan profil silang kosong, preferences/History sendiri, denial Admin API/RPC,
tabel internal kosong, perubahan/pemulihan nama A3, dan upload JPEG awal HTTP 200.
Helper berhenti pada penghitungan hash unduhan: penggantian teks `a2/b2` secara
terlalu luas ikut mengubah `sha256` menjadi `sha356`. Ini kesalahan helper yang
dibuat pada pekerjaan ini, bukan hasil gagal Storage atau bukti nonce sudah benar.
Nama algoritma pada helper lokal kemudian diperbaiki, tetapi runner yang sudah
berjalan tidak dimuat ulang dan signup tidak diulang.

**Retest overwrite dengan nonce, hash persistence, cross-avatar, relogin dan
revoked-token tetap BLOCKED/NOT RUN**, bukan PASS. Tidak ada akun A4 yang dibuat.
Cleanup melalui perintah runner normal menghapus hanya avatar milik akun uji,
memastikan namespace A3/B3 kosong (HTTP 200), lalu logout keduanya (HTTP 204).
Runner keluar normal; password/sesi hanya di memori dan tidak dipertahankan.
Evidence: `frontend/.phase7.local/package-a3-evidence.json` (ignored).
SELECT baca-saja sesudah cleanup juga membuktikan **0 objek avatar uji** pada
dua path A3/B3 dan **0 sesi Auth** untuk dua UID tersebut. Ini bukti keadaan akhir,
bukan pengujian request dengan access token revoked.

### D — receipt, browser Admin dan audit

| Pengirim | Receipt/record ID | Hasil |
| --- | --- | --- |
| Guest | 6feef481-c361-4ed8-9196-b3f29443aa11 | Submit 200, retry 200 dengan receipt sama |
| A3 | 0610fb5f-60a1-4741-b363-6b520bad4a03 | Submit 200, retry 200 dengan receipt sama |

Payload tepat kategori bug, feature Lainnya, teks sintetis rencana, tanpa email
kontak atau report_id, consent true. Tidak mengirim submission baru di luar dua
ID yang disetujui. Browser Admin mencari `UJI PHASE7 FINAL 143c736e` dan menemukan
tepat dua record, kemudian membuka masing-masing dan menjalankan
`new v1 → in_review v2 → resolved v3 → new v4`. Catatan tetap kosong.

SELECT baca-saja setelah tindakan mengonfirmasi kedua record `new`, version 4,
`note_empty=true`, `consent=true`, `owner_is_expected=true`; masing-masing tiga
event audit persis mengikuti urutan status di atas. Guest owner null; authenticated
owner adalah UID A3. Tidak mengubah lima Feedback existing.
Submission dilakukan lewat HTTP/SDK; penanganan lewat browser nyata. Ini tidak
mengklaim wizard submission browser telah dijalankan.

### E — draft/preview/archive

Record ID `2128032a-694b-411a-b374-56365757e5b2`, slug
`uji-phase7-final-143c736e`. Konten seluruhnya fixture sintetis dengan sumber
`https://example.com`. Browser Admin menyimpan draft v1, mengubah ringkasan,
memeriksa pratinjau internal, menyimpan draft v2, membuka ulang untuk memastikan
ringkasan revisi tersimpan, lalu mengarsip lewat dialog konfirmasi menjadi v3.
Tidak pernah menekan Terbitkan.

HTTP anonim saat status draft: Supabase 200 array kosong dan FastAPI 404.
Checker publik diperluas dengan slug fixture ini; 31 pemeriksaan lulus pada
eksekusi saat draft, lalu **31/31 kembali PASS setelah archive**. SELECT final mengonfirmasi archived v3 dan audit
`draft v1 → draft v2 → archived v3`, tanpa event published. Empat artikel asli
dan arsip Phase 6 dipertahankan.

### F — input manual, rejection/archive dan batas tes

Organisasi `UJI PHASE7 FINAL 143c736e`, ID
`e1ae26a2-0c10-4e8e-9d86-89ef509029e2`, retained version 1.
Kandidat `phase7-final-143c736e.example.com`, ID
`d5e473f5-8954-44b1-ad5f-c4a2616f4b90`. Bukti `https://example.com` diberi
penjelasan eksplisit fixture dan bukan bukti hubungan resmi.

Browser Admin menyimpan kandidat pending_review v1, menolak dengan alasan
`UJI: tidak ada bukti hubungan resmi` menjadi rejected v2, lalu archive v3 dengan
dialog konfirmasi. SELECT final membuktikan `verified_at_null=true` dan tiga event
audit `pending_review → rejected → archived`. Tidak melakukan DNS/fetch/crawling
atau membuka tautan bukti. Kandidat Phase 6 tidak diubah.

Uji duplikat dilanjutkan: mengirim form kandidat dengan hostname yang sama dalam
huruf kapital menghasilkan pesan UI “Data sudah ada atau berubah sejak dibuka.
Muat ulang sebelum menyimpan lagi.” SELECT berikutnya mengonfirmasi **count 1**,
record tetap archived v3, verified_at null dan audit tetap **3 event**; percobaan
duplikat tidak membuat record/audit mutasi tambahan. Tidak ada status HTTP yang
direkam pada UI, sehingga laporan tidak mengarang kode 409. UI Automation sempat
mengalami malformed cache response; status dibaca ulang sebelum retry. Setelah
audit selesai, Computer Use dihentikan otomatis karena URL browser tidak dapat
dipastikan saat berpindah tab. Tidak melewati penghentian tersebut.

### Sisa penutupan

D dan E kini mempunyai bukti cloud baru; lifecycle utama F mempunyai bukti baru.
Prasyarat yang masih mencegah full closure adalah lifecycle avatar cloud/browser,
revoked/expired sessions dan recovery inbox. Kekurangan tersebut tidak ditutupi
oleh 235 tes frontend atau 123 tes backend. Izin A3/D/E/F tetap tercatat berlaku;
izin itu tidak mencakup membuat pasangan akun tambahan atau reset akun retained.
Tidak ada migrasi, commit, push, deployment atau perubahan akun pemilik. Pemeriksaan
HTTP baca-saja terbaru tersimpan dalam
`frontend/.phase7.local/public-cloud-final-20261104.json` (ignored, tanpa kredensial).

## Checkpoint sebelum persetujuan A3/D/E/F (bagian 1–12)

## 1. Repository dan baseline

- Branch `main`, HEAD `a76ab1483f3410d879f3cc336e86a42f48e6a07c` masih sama.
- Perubahan belum committed dari pekerjaan avatar/Settings dan Phase 7 sebelumnya
  dipertahankan. Tidak ada commit atau push.
- Bukti awal: `PHASE7_IMPLEMENTATION.md`, `PHASE7_AVATAR_CLOUD.md`, laporan
  Phase 6/cloud plan dan progres 31 Oktober. Hasil historis dibedakan dari tes baru.
- Migrasi 001–007 tidak dijalankan ulang pada cloud. Ledger migrasi yang tidak
  tersedia tidak direkayasa. Checker PGlite menjalankan SQL di database lokal
  terisolasi; ini bukan penerapan ulang pada proyek Supabase.
- Tidak ada perubahan backend, dependensi, environment tersimpan, policy Storage,
  role, password pemilik, engine deteksi atau automated domain collection.

## 2. Lingkungan dan arti status

| Lingkungan | Penggunaan dan batas bukti |
| --- | --- |
| Vitest/jsdom | Komponen nyata dengan mock Auth/Storage/network; bukan cloud E2E |
| PGlite | PostgreSQL terisolasi untuk SQL/RLS/RPC; bukan database produksi |
| pytest | Regresi FastAPI lokal; bukan bukti semua integrasi cloud |
| HTTP anonim | FastAPI lokal dan Supabase persistent `awasin`, project `nqruowgbxiopfhslznyb` |
| SDK terautentikasi | Empat akun uji ordinary baru yang disetujui; tanpa sesi browser pemilik |
| Browser | Guest terpisah serta sesi Admin sah yang disiapkan pengguna |

PASS = operasi benar-benar lulus. FAIL = kegagalan teramati, tetap dicatat
meskipun ada perbaikan. BLOCKED = prasyarat/izin tidak tersedia. NOT RUN = tidak
dijalankan dalam cakupan aktual. PASS lokal tidak menggantikan bukti cloud/browser.
Tidak ada password, bearer token, cookie atau data pribadi pengguna dalam laporan.

## 3. Skenario A — Avatar dan Settings

| Skenario | Lokal | Cloud/API atau browser aktual |
| --- | --- | --- |
| Pilih foto tanpa Save | PASS: draft tidak memanggil upload | BLOCKED: belum diuji melalui browser akun uji |
| Save foto pertama | PASS: Storage dan event navbar | PASS API A2: upload 200 dan hash unduhan sesuai gambar A; navbar browser NOT RUN |
| Ganti foto | PASS: sinkronisasi navbar dan nonce baru | Upload 200; FAIL unduhan langsung sebelum perbaikan, lihat bagian 5 |
| Stage delete tanpa Save | PASS | BLOCKED browser |
| Konfirmasi delete dan ikon default | PASS | PASS penghapusan objek milik A2 saat cleanup dan list kosong; ikon browser NOT RUN |
| Refresh/mount ulang | PASS: membaca Storage dengan nonce berbeda | BLOCKED browser dan retest cache sesudah perbaikan |
| Navigasi antarhalaman | PASS: menu stabil dan state navigasi | BLOCKED avatar browser |
| Logout/login ulang | PASS lokal | Logout SDK 204 saat cleanup; login ulang NOT RUN |
| Beralih dua akun | PASS: mengabaikan download akun lama | Profil silang PASS; isolasi objek avatar silang NOT RUN |
| Upload gagal/sesi berubah/network interruption | PASS kasus lokal terkait | NOT RUN gangguan jaringan/sesi cloud terkendali |
| Unsaved changes dan partial save | PASS | BLOCKED browser akun uji |

Bucket tetap private `account-avatars`, path tetap `<uid>/avatar.jpg`. Aset hanya
dua gambar sintetis yang tercantum di rencana, dikonversi ke JPEG untuk bucket.
Tidak memakai foto atau namespace pemilik. Input PNG/JPG/WebP aplikasi diproses
menjadi JPEG; pengujian penolakan PNG langsung oleh bucket belum tercapai.

## 4. Skenario B — Auth dan lifecycle sesi

- PASS HTTP: signup A/B/A2/B2 dan identitas ordinary melalui server, HTTP 200.
- PASS HTTP A2/B2: preferences dan History milik sendiri HTTP 200.
- PASS cleanup: logout empat sesi akun uji HTTP 204. Akun/profil dipertahankan.
- PASS browser guest: Settings, History dan Admin dashboard mengarah ke Login.
- PASS lokal: suite regresi Auth, guards, Settings dan menu navigasi.
- BLOCKED browser: register/login akun uji, restore setelah refresh, login ulang,
  multi-tab, timeout idle, sleep/wake dan lifecycle avatar end-to-end.
- NOT RUN cloud: request menggunakan access token yang sudah revoked/expired;
  keberhasilan logout saja tidak dianggap bukti penolakan token tersebut.
- BLOCKED recovery: belum ada inbox uji deliverable. Alamat `.invalid` tidak
  digunakan untuk mengklaim keberhasilan pengiriman email/reset password.

Tidak ada perubahan confirmation settings atau bypass provisioning Admin.

## 5. Defect yang teramati, penyebab dan perubahan

### 5.1 Pemeriksa paket A salah memilih kolom

Paket A mencatat 20 PASS dan 1 FAIL. Query `feedback_handling.select('id')`
menghasilkan HTTP 400 karena primary key tabel adalah `feedback_id`. Ini defect
checker, bukan bukti bypass otorisasi. Checker uji diubah menggunakan SELECT valid
dan menerima penolakan HTTP atau RLS 200 dengan nol row. Pada A2/B2, keempat tabel
internal yang diperiksa masing-masing mengembalikan HTTP 200 dengan hasil kosong.
Kegagalan awal tetap dipertahankan dalam evidence.

### 5.2 Unduhan sesudah overwrite avatar tidak sesuai gambar baru

Paket A2 mencatat 46 PASS dan 1 FAIL. Upload gambar A, unduhan/hash A, dan overwrite
dengan gambar B berhasil HTTP 200. Unduhan langsung setelah overwrite juga HTTP
200, tetapi predicate hash gambar B gagal. Hash respons dan header cache tidak
direkam; laporan tidak menyimpulkan respons pasti sama dengan gambar A.

`cache: 'no-store'` saja belum memastikan respons terbaru pada pengujian tersebut.
Cache di jalur unduhan/propagasi overwrite merupakan dugaan yang sesuai dengan
dokumentasi, bukan hasil forensik header. Perubahan minimal pada
`frontend/src/features/settings/avatar.ts`: setiap download memakai
`{ cacheNonce: crypto.randomUUID() }` sekaligus mempertahankan `cache: 'no-store'`.
SDK terpasang mendukung opsi ini. Dokumentasi resmi menjelaskan
[cacheNonce download](https://supabase.com/docs/reference/javascript/file-buckets-download)
dan kemungkinan konten lama setelah
[overwrite objek](https://supabase.com/docs/guides/storage/uploads/standard-uploads).

Regresi `frontend/tests/avatar.test.tsx` memeriksa nonce ada dan berbeda pada
empat pemanggilan download saat mount ulang. Sebelum perubahan produksi: dua
assertion gagal. Sesudah perubahan: seluruh 235 tes frontend lulus.

**Status perbaikan: PASS lokal; BLOCKED verifikasi ulang cloud/browser.**
Tidak mengubah FAIL cloud lama menjadi PASS. Suite berhenti sebelum isolasi objek
avatar silang, relogin dan revoked-token test. Sesi uji kemudian dibersihkan;
password tidak disimpan dan tidak direset untuk melanjutkan.

### 5.3 Checker akses publik dan perubahan state CMS

Ditambahkan `frontend/scripts/check-public-access.mjs`, hanya membaca lewat key
publishable, tanpa login/tulisan/migrasi atau mencetak data privat. Pada pembacaan
awal, ekspektasi status artikel historis menghasilkan empat kegagalan: state cloud
sudah berubah menjadi empat artikel asli published dan artikel uji published v4.
Ini perbedaan state terhadap laporan lama, bukan kesimpulan kebocoran RLS.
Checker sekarang memeriksa state aktual setelah R1 yang disetujui; seluruh 29
pemeriksaan lulus. Draft isolation tidak dilabeli PASS karena fixture draft belum
tersedia. Tidak ada fallback lokal yang dipakai untuk menyamarkan status HTTP.

## 6. Skenario C — Authorization dan isolasi data

| Aktor/operasi | Hasil aktual |
| --- | --- |
| Guest: delapan tabel privat Supabase | PASS, HTTP 401 masing-masing |
| Guest: sebelas endpoint FastAPI privat/Admin | PASS, HTTP 401 masing-masing |
| A2/B2: profil sendiri | PASS, HTTP 200 satu row milik sendiri |
| A2/B2: profil akun uji lain | PASS, HTTP 200 array kosong |
| A2/B2: tujuh endpoint Admin per akun | PASS, 14 respons HTTP 403 |
| A2/B2: dua RPC Admin per akun | PASS, empat respons HTTP 403 / PostgreSQL 42501 |
| A2/B2: feedback_handling, registry_organizations, registry_domains, admin_audit_events | PASS, delapan respons HTTP 200 dengan nol row |
| Admin sah: CMS dan Audit | PASS browser: daftar/editor, arsip R1, event audit |
| Guest/akun lain: objek avatar existing | NOT RUN: suite berhenti sebelum fixture B2 di-upload |
| Mutasi silang avatar/registry dan History antar-user dengan report nyata | NOT RUN cloud; otorisasi terkait diuji lokal |
| Draft artikel baru tersembunyi | BLOCKED: paket E belum disetujui |

Respons RLS 200 kosong dibedakan dari HTTP 403. Tidak ada perubahan `user_roles`
atau grant Admin kepada akun uji. Tidak menganggap guard frontend sebagai satu-satunya
bukti otorisasi.

## 7. Skenario D — Feedback

PASS lokal: validasi kategori/required fields/consent, duplicate prevention,
idempotency, receipt, kepemilikan, private notes, status/audit dan penolakan akses
melalui suite frontend/backend serta PGlite. Ini bukan alur cloud end-to-end baru.

BLOCKED cloud: paket D berisi dua submission sintetis, retry ID sama, review dan
transisi status Admin belum disetujui. Tidak ada genuine Feedback yang diubah.
Penolakan endpoint Admin bagi guest/user sudah PASS HTTP pada bagian 6.

## 8. Skenario E — Education CMS dan R1

R1 disetujui pengguna, lalu dilakukan melalui sesi Admin browser yang sah:

- Record `a6ec3806-bff2-4adc-a35f-bc05ef9c0964`, slug `uji-phase6-20261029`.
- CMS: published v4 → archived v5, melalui Arsipkan dan dialog konfirmasi.
- Audit browser menunjukkan event 3 November 2026 pukul 22:54, metadata
  `status=archived`, `version=5`, `previous_status=published`, `previous_version=4`.
- PASS: baca anonim PostgREST HTTP 200 dengan array kosong; detail FastAPI HTTP
  404; browser guest menampilkan artikel tidak ditemukan. HTTP diulang 4 November.
- Empat slug asli `phishing`, `pesan-dan-otp`, `keamanan-qr`, `keaslian-media`
  masing-masing PASS HTTP 200 di cloud dan FastAPI. Browser Education menampilkan
  empat tautan asli. `keaslian-media` sudah published v3 sebelum tindakan R1;
  tidak diterbitkan ulang atau dikembalikan ke draft oleh pekerjaan ini.

Tidak mengedit konten, menghapus record/audit atau mempublish artikel buatan.
PASS lokal: safe rendering/publishing, slug immutable, konflik versi dan RLS.
BLOCKED cloud: create/edit/preview/archive fixture draft baru pada paket E.
Pengujian keamanan HTML browser untuk konten berbahaya baru NOT RUN.

## 9. Skenario F — Registry manual

PASS lokal PGlite/backend: normalisasi, duplikasi, evidence review, status,
otorisasi RPC dan audit. PASS HTTP: guest/user tidak mendapat data internal dan
tidak dapat mengakses endpoint Admin baca.

BLOCKED cloud: fixture organisasi/domain baru, rejection, archive dan audit pada
paket F belum disetujui. Tidak membuat domain verified palsu. Tidak mengubah
registry asli, melakukan crawling, atau menganggap domain verified menjamin
semua URL aman.

## 10. Browser, responsive dan performance

- Browser aktual 3 November: Education guest pada lebar 375/768/1440, lebar aktual
  diperiksa, tanpa overflow halaman atau tautan artikel kehilangan label.
- Admin CMS list/editor, konfirmasi archive dan Audit diperiksa pada browser
  native pengguna. Tidak mengeluarkan sesi Admin pengguna.
- Angka 144 responsive shell checks pada laporan implementasi adalah bukti
  terdahulu; tidak diklaim sebagai 144 tes browser baru pada kelanjutan ini.
- Keyboard/focus/reduced-motion yang dicakup tes lokal tetap PASS. Matriks browser
  penuh Settings, Feedback, Admin, mobile nav dan semua keyboard flow NOT RUN.
- Physical device, Firefox dan screen reader NOT RUN; tidak menyatakan WCAG penuh.
- Build aktual: main JS 792.27 kB, gzip 243.65 kB; jsQR 130.72/47.46 kB;
  main CSS 60.98/13.18 kB. Peringatan chunk >500 kB masih ada.
- Network waterfall, CPU/throttle dan slow-network measurements NOT RUN. Evaluasi
  `performance` melalui browser proxy tidak tersedia; tidak ada angka timing yang
  direkayasa. Tidak menambah speculative splitting atau dependensi baru.
- Pengurangan download saat Save/avatar event dan lifetime menu dibuktikan tes
  lokal; bukan pengukuran waterfall cloud browser.

## 11. Regresi terbaru dan ledger operasi cloud

| Perintah (4 November) | Hasil |
| --- | --- |
| `npm.cmd test` | PASS: 235 tests, 22 files |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS TypeScript/Vite; warning chunk besar |
| `npm.cmd run check:routes` | PASS 24 route dan validasi tambahan |
| `npm.cmd run check:history-db` | PASS lokal PGlite |
| `npm.cmd run check:admin-db` | PASS lokal PGlite |
| `.venv\Scripts\python.exe -m pytest -q` dari backend | PASS 123; dua warning |
| `node scripts/check-public-access.mjs` | PASS 29 HTTP baca-saja |
| `git diff --check` | PASS; pemberitahuan normalisasi LF/CRLF |

Build memakai `VITE_API_BASE_URL=https://api.example.invalid` hanya pada proses
verifikasi; tidak mengubah file environment atau mendeploy build. Pytest warning:
Starlette/httpx deprecation dan cache nodeids tidak dapat ditulis. HTTP awal dalam
sandbox terblokir; pengulangan di luar sandbox lulus. Ini batas lingkungan,
bukan 29 kegagalan aplikasi. Pytest juga dijalankan di luar sandbox karena kendala
asyncio pada lingkungan terbatas.

| Paket disetujui | Operasi aktual dan keadaan akhir |
| --- | --- |
| A | Dua signup ordinary; 20 PASS/1 FAIL checker; empat cleanup checks PASS; akun retained, namespace kosong dan logout 204 |
| A2 | Dua signup ordinary; 46 PASS/1 FAIL hash replacement; nama A2 diubah lalu dikembalikan; upload/replace hanya avatar A2; empat cleanup checks PASS, namespace A2/B2 kosong dan logout 204; akun retained |
| R1 | Arsip artikel uji melalui CMS v4→v5, audit retained, URL publik 404 |
| D/E/F | Belum disetujui dan tidak dieksekusi |

Identitas sintetis retained (tanpa password):

| Label | Email | UID |
| --- | --- | --- |
| A | phase7-final-20261103-143c736e-a@example.invalid | dc09b0ba-cee2-4ad8-addb-1ad7ed5b00b0 |
| B | phase7-final-20261103-143c736e-b@example.invalid | 413a2f88-3e7e-4a63-84cb-935326ea76bd |
| A2 | phase7-final-20261103-143c736e-a2@example.invalid | 51b172c5-61bf-4ba2-8e10-e9835e59a508 |
| B2 | phase7-final-20261103-143c736e-b2@example.invalid | ea08b095-0833-4eb9-a776-41b0750efc9f |

Evidence lokal di `frontend/.phase7.local/package-a-evidence.json` dan
`package-a2-evidence.json` (ignored, tidak menjadi artefak commit); kegagalan lama
tidak ditimpa. Tidak ada reset password atau penghapusan akun. Runner berhasil
di-cleanup melalui perintah normal kemudian keluar; kredensial hanya di memori.

## 12. Prasyarat tersisa dan keputusan penutupan

P1 yang masih diperlukan: retest avatar overwrite setelah nonce dengan sesi uji
yang sah, isolasi objek avatar dua akun, browser Save/delete/refresh/account switch,
revoked/expired session; cloud Feedback, draft CMS, dan registry manual dengan
record sintetis yang disetujui. Recovery memerlukan inbox deliverable.

Rencana operasi tersedia di `PHASE7_CLOUD_TEST_PLAN.md`. A/B/A2/B2 tidak boleh
di-reset atau dibuat ulang untuk memperoleh sesi. D/E/F memerlukan persetujuan
eksplisit sesuai instruksi cloud safety pada master prompt bagian 14.

Automatic approval review menolak percobaan attach debugger ke runner hidup yang
memegang kredensial uji, karena izin paket A2 tidak mencakup debugger injection
melintasi batas proses. Penolakan terjadi sebelum eksekusi. Tidak ada debugger
dipasang, kredensial diekstrak, atau workaround untuk melewati penolakan. Cleanup
dijalankan melalui perintah runner yang normal. Retest cloud tidak dilaporkan lulus.

**Implementation complete — final verification pending.** Regresi lokal dan
operasi R1 yang disetujui telah selesai; kekurangan bukti P1 di atas mencegah
penutupan Phase 7 sebagai fully verified.
