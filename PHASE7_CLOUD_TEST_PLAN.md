# AWASIN — Rencana dan Ledger Uji Cloud Phase 7

Tanggal: 3 November 2026, Asia/Bangkok. Target tunggal: proyek `awasin`,
`nqruowgbxiopfhslznyb`, main / PRODUCTION. Dokumen ini BUKAN izin eksekusi.
Persetujuan harus menyebut paket yang diizinkan. Tidak ada migrasi, ledger repair,
service-role frontend, perubahan role atau reset password dalam rencana.

## R1 — Tinjauan artikel uji yang sekarang terbit

- Record aktual: `a6ec3806-bff2-4adc-a35f-bc05ef9c0964`.
- Slug `uji-phase6-20261029`, saat dibaca: published, version 4.
- Usulan: melalui CMS dan sesi Admin existing yang sah, ubah menjadi archived
  dengan optimistic version 4. Baca ulang status dan pastikan URL publik 404.
- Keadaan akhir: record tetap ada, archived; event audit perubahan dipertahankan.
- Cleanup: tidak menghapus record atau audit.
- Risiko: artikel uji tidak lagi tersedia pada URL publik. Tidak menyentuh empat
  artikel asli, termasuk `keaslian-media` yang sekarang published versi 3.
- Prasyarat: persetujuan R1 dan sesi Admin aplikasi yang secara eksplisit
  ditunjuk. Tidak memakai SQL langsung atau menambahkan role untuk melewati CMS.

## A — Dua akun biasa baru dan lifecycle avatar

Identitas paket A, kemudian disetujui dan dibuat (lihat ledger akhir):

- `phase7-final-20261103-143c736e-a@example.invalid` — label UJI PHASE7 A.
- `phase7-final-20261103-143c736e-b@example.invalid` — label UJI PHASE7 B.

Preflight harus memastikan kedua identitas belum ada. Jika ada, hentikan paket;
jangan login, mengubah metadata atau mereset password akun existing tersebut.
Kedua akun harus tetap ordinary user melalui alur signup existing. Password acak
hanya di memori proses uji, tidak dicatat ke report, log atau file konfigurasi.
Tidak membaca token/kredensial dari browser pemilik. Sesi hasil login SDK akun
uji hanya boleh dipakai di memori untuk request akun uji yang diizinkan.

Aset sintetis lokal, tanpa foto/data pribadi:

| File di frontend/.phase7.local/assets | Bytes | SHA-256 |
| --- | --- | --- |
| phase7-final-143c736e-avatar-a.png | 207 | a517bd71268b71f221625b414e2185cdbba44768d4dfdef58573486b1525572d |
| phase7-final-143c736e-avatar-b.png | 203 | 5dfc10db0f1bcbd3a8355b0ea0e098d23c874842c16b9886a86f4925b35b48d4 |

Operasi yang memerlukan izin A:

1. Buat tepat dua akun di atas beserta profil otomatis existing; jangan membuat
   akun Admin. Domain `.invalid` sengaja tidak memiliki inbox; recovery email
   deliverability tetap tidak diuji dengan identitas ini.
2. Login/logout/revokasi hanya sesi dua akun uji. Verifikasi restore, isolasi,
   denial Admin API/RPC baca dan private records memakai sesi akun uji.
3. Pada bucket private `account-avatars`, gunakan HANYA path
   `<UID akun uji A>/avatar.jpg` dan `<UID akun uji B>/avatar.jpg`.
4. Upload/ganti/hapus hanya dua aset sintetis di dua namespace baru tersebut.
   Uji silang hanya di antara dua akun baru, tidak menargetkan akun pemilik.
5. Nama tampilan hanya UJI PHASE7 A/B dan variasi bertanda UJI untuk menguji
   explicit Save/partial success. Jangan mengubah preferensi atau password owner.

Keadaan akhir: kedua akun/profil user uji dipertahankan, semua sesi uji ditutup,
dua avatar uji dihapus lewat Storage API sesuai izin spesifik ini. Tidak menghapus
akun/Auth/profil atau menyentuh file pengguna lain. Record/audit teknis Auth
mungkin bertambah. Jika terjadi unexpected authorization success, hentikan dan
laporkan; jangan mencoba memperluas akses atau membersihkan data pengguna lain.

Browser login harus memakai sesi uji terpisah, tidak menimpa atau mengeluarkan
sesi pemilik. Jika entry credential/Terms memerlukan handoff browser, pemilik
melakukan langkah tersebut sendiri. Bila tidak tersedia, bedakan API test yang
berjalan dari browser E2E yang masih BLOCKED.

## D — Feedback uji baru (memerlukan identitas/sesi Admin ditunjuk)

- Dua request baru saja: kategori bug, feature Lainnya, tanpa email kontak.
- Client request ID tamu `7f700007-2026-4111-8111-143c736e0001`.
- Client request ID akun A `7f700007-2026-4111-8111-143c736e0002`.
- Teks tepat: `UJI PHASE7 FINAL 143c736e: masukan sintetis untuk verifikasi alur,
  bukan laporan keamanan nyata dan tidak memuat data pribadi.`
- Operasi: submit dengan consent, retry idempotent dengan ID sama, baca receipt;
  Admin hanya meninjau record baru ini, ubah new → in_review → resolved → new,
  lalu kosongkan catatan. Cocokkan audit.
- Akhir: dua record uji retained, status new, note kosong; audit retained.
- Jangan mengubah genuine Feedback atau menghapus receipt/record/audit.

## E — Draf CMS baru, tidak pernah dipublish

- Slug baru `uji-phase7-final-143c736e`; hentikan jika sudah ada.
- Judul `UJI PHASE7 FINAL 143c736e — Draf tidak untuk publik`.
- Isi hanya penanda uji sintetis, sumber `https://example.com`; bukan artikel
  edukasi nyata. Semua konten ditinjau sebelum Save.
- Operasi: Admin existing membuat draft, edit/preview, baca ulang, archive.
- Akhir: archived, tidak pernah published; URL publik selalu 404; audit retained.
- Tidak menyentuh lima artikel existing atau membuat duplikasi slug publik.

## F — Registry manual baru, tidak pernah verified

- Organisasi baru `UJI PHASE7 FINAL 143c736e`; hentikan jika sudah ada.
- Kandidat `phase7-final-143c736e.example.com`.
- Evidence URL `https://example.com`, dengan keterangan eksplisit bahwa ini
  fixture dan bukan bukti hubungan resmi. Tidak melakukan DNS/fetch/crawling.
- Operasi Admin: create pending_review, duplicate rejection, reject dengan note
  `UJI: tidak ada bukti hubungan resmi`, lalu archive; cocokkan audit.
- Akhir: organisasi retained, kandidat archived, verified_at null, audit retained.
- Tidak pernah meminta atau menetapkan verified dan tidak mengubah registry asli.

## A2 — Pasangan pengganti setelah checker A berhenti

Paket A disetujui dan sudah membuat dua akun yang tercantum di atas. Uji berhenti
pada query checker yang meminta kolom `id` pada `feedback_handling`; PK tabel
tersebut adalah `feedback_id`. Kedua namespace avatar kosong dan kedua sesi
sudah ditutup. Akun A/B dipertahankan; tidak direset atau dibuat ulang.

Identitas paket A2, kemudian disetujui dan dibuat (lihat ledger akhir):

- `phase7-final-20261103-143c736e-a2@example.invalid` — UJI PHASE7 A2.
- `phase7-final-20261103-143c736e-b2@example.invalid` — UJI PHASE7 B2.

Scope aset/operasi sama dengan A, tetapi HANYA di namespace dua akun A2/B2 baru.
Preflight harus membuktikan kedua alamat belum ada. Checker memakai SELECT valid
dan membedakan penolakan HTTP dari hasil RLS 200 dengan nol row. Password dan sesi
hanya di memori proses persisten sampai pengujian/cleanup selesai agar kegagalan
checker dapat diperbaiki tanpa membuat akun tambahan lagi.

Akhir: keempat akun uji retained, avatar A2/B2 dibersihkan melalui Storage API,
sesi A2/B2 ditutup. Tidak mengubah akun A/B lama, akun pemilik atau file orang lain.

## Status izin

Ledger diperbarui 4 November 2026, Asia/Bangkok.

| Paket | Izin | Eksekusi dan akhir |
| --- | --- | --- |
| A | Disetujui | 20 PASS/1 FAIL checker kolom; cleanup 4 PASS, akun retained, avatar kosong, logout 204 |
| A2 | Disetujui terpisah | 46 PASS/1 FAIL hash download setelah replace; cleanup 4 PASS, akun retained, avatar kosong, logout 204 |
| R1 | Disetujui, sesi Admin disiapkan pengguna | Selesai melalui CMS: published v4 menjadi archived v5; event Audit diperiksa; detail publik 404 |
| D | Disetujui | Dua submit + retry idempotent PASS; Admin new→in_review→resolved→new; kedua record new v4, note kosong, audit sesuai |
| E | Disetujui | Draft v1, revisi/preview/baca ulang v2, archived v3; tidak pernah published; audit sesuai |
| F | Disetujui | Organisasi retained v1; kandidat pending_review→rejected→archived v3, verified_at null; duplikat hostname huruf kapital ditolak UI; SELECT count 1, audit tetap 3 |
| A3 | Disetujui | 44 PASS API lalu helper hash sha356 gagal; cleanup 4 PASS, akun retained, avatar kosong, logout 204; runner keluar |

Akun A/B/A2/B2 tidak direset atau dibuat ulang. Empat UID dan hasil rinci dicatat
pada `PHASE7_FINAL_VERIFICATION.md`. Password tidak disimpan; runner sudah cleanup
lalu keluar. Jangan menggunakan evidence file sebagai sumber kredensial.
Empat artikel asli tetap published; R1 hanya mengarsip artikel uji. Tidak ada
migrasi/policy/role/password pemilik yang diubah. Checker anonim terbaru 31 PASS.
Selain empat akun lama, A3/B3 juga retained; dua avatar dan seluruh sesi A3/B3
dibersihkan. SELECT final: objek avatar target 0, sesi Auth target 0.

## A3 — Rencana yang telah disetujui dan dieksekusi sebagian

Rencana berikut disetujui; kedua akun sudah dibuat. Jangan menjalankan signup ulang.

- `phase7-final-20261104-143c736e-a3@example.invalid` — UJI PHASE7 A3.
- `phase7-final-20261104-143c736e-b3@example.invalid` — UJI PHASE7 B3.
- Preflight baca-saja harus memastikan kedua email belum ada; jika ada, hentikan.
- Hanya dua aset sintetis A/B di atas dan JPEG turunannya. Namespace hanya
  `<UID A3>/avatar.jpg` dan `<UID B3>/avatar.jpg`, bucket private yang sama.
- Signup ordinary, Save nama/foto, replace dengan download nonce, cek hash,
  stage/confirm deletion, restore/relogin, logout/revoked-token, dan isolasi
  baca/replace/delete hanya silang antara dua akun baru. Tidak menargetkan owner.
- Browser E2E memakai sesi uji terpisah jika handoff aman tersedia; bila tidak,
  tetap BLOCKED. API test tidak dianggap browser E2E.
- Helper mendukung langkah terbatas/retry/cleanup melalui perintah normal;
  tidak attach debugger atau mengekstrak kredensial dari proses/browser.
- Password acak/sesi hanya di memori. Tidak menyimpan password/token, mereset
  password, mengubah role, confirmation settings atau membuat Admin.
- Akhir: kedua akun/profil retained, nama kembali UJI PHASE7 A3/B3, semua avatar
  milik dua akun ini dihapus dan namespace diverifikasi kosong, sesi uji logout.
- Risiko: menambah dua akun sintetis dan catatan teknis Auth; hanya objek uji baru
  yang diubah/dibersihkan. Tidak menghapus akun atau data pengguna lain.

A3 dan D telah disetujui; submission authenticated memakai akun A3 baru menggantikan
akun A pada rencana D; ID request, isi, dua record maksimum dan final state D
tetap sama. Paket E/F hanya memakai sesi Admin sah yang pengguna siapkan.

## A4 — Closure avatar/API (disetujui dan selesai)

Instruksi final `da4907d9`, bagian 3, meminta izin baru sebelum akun tambahan.
Pengguna menyetujui A4 pada 4 November. Eksekusi: 33 pemeriksaan PASS, nol FAIL,
empat cleanup checks PASS; runner dihentikan setelah cleanup (Ctrl+C karena proses
masih hidup sesudah perintah exit). Evidence di
`frontend/.phase7.local/package-a4-evidence.json`. Akun retained, avatar kosong,
logout 204. Tidak mengulang D/E/F. Pengguna juga secara eksplisit mengizinkan
akun utama Fiqry Firmansyah untuk tes browser avatar; pencabutan sesi/reset
password tetap tidak dilakukan pada akun utama.
Browser akun utama ordinary: select/discard/Save/refresh A, replacement B, staged
delete dan Save delete lulus. Foto sintetis sudah dihapus, nama tetap; keadaan
awal tanpa foto dipulihkan. Mobile dan lifecycle login browser masih pending.

- Tepat dua email baru: `phase7-close-20261104-da4907d9-a4@example.invalid` dan
  `phase7-close-20261104-da4907d9-b4@example.invalid`; nama UJI PHASE7 A4/B4.
- Preflight SELECT memastikan email belum ada; bila sudah ada, hentikan signup.
- Dua aset sintetis A/B yang sama dari tabel rencana A dan JPEG turunannya;
  tidak membuat aset cloud lain. Bucket private/path canonical yang sama,
  hanya `<UID A4>/avatar.jpg` dan `<UID B4>/avatar.jpg`.
- Helper SHA-256 menjalankan known-answer self-check sebelum jaringan. Identitas
  ditulis eksplisit, tanpa penggantian teks massal. Tahap signup, storage, session
  dan cleanup dipisah; retry tidak mengulang signup atau memerlukan debugger.
- Operasi: ordinary signup/login; upload A, hash download, replace B, ulang
  download dengan nonce berbeda; owner read; guest dan cross-account read/write/
  delete denial hanya antara A4/B4; bucket invalid MIME rejection; owner delete
  dan namespace akhir kosong; logout, request dengan token revoked, relogin dan
  verifikasi identitas. Hash/HTTP/cache headers yang aman dicatat, token tidak.
- Password acak dan sesi hanya di memori runner. Tidak mengambil kredensial
  browser; tidak reset akun lama, promote role, mengubah Auth settings atau policy.
- Akhir: dua akun/profil retained dengan nama UJI PHASE7 A4/B4, hanya avatar uji
  dihapus melalui Storage API dan diverifikasi kosong, sesi akun uji logout.
- Risiko: dua akun sintetis serta event teknis Auth baru; tidak menyentuh avatar,
  password, preferensi atau sesi pemilik. Tidak menghapus akun atau audit.

Browser E2E terpisah memerlukan pengguna login sendiri pada ordinary test account
yang secara eksplisit boleh diubah. Pengguna menyebut email/label akun dan tab,
tanpa mengirim password/token. Hanya dua gambar sintetis yang sama boleh dipakai;
nama dipulihkan, avatar uji dihapus di akhir, lalu logout hanya akun uji tersebut.
Jika akun uji browser memiliki avatar existing, hentikan sebelum menggantinya
sampai cakupan aset disetujui. Jangan memakai Admin/akun pribadi pemilik.
