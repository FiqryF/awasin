# AWASIN — Phase 8D Privacy, Storage & Integration

5 November 2026. Tidak ada tulisan cloud atau perubahan data pemilik.

## Implemented / fixed

API `/account/export` sebelumnya sudah menerapkan ownership/count/batas, tetapi
tidak dipanggil UI. Ditambahkan tombol **Unduh data akun** pada Privasi & Data,
memakai API existing. File JSON hanya dibuat sesudah session owner diperiksa lagi
dan `format_version=2`/profile.id cocok. Request dibatalkan ketika komponen unmount;
tidak download sesudah account switch/abort. Blob URL dibersihkan, filename tetap.
Tidak ada automatic export saat halaman dibuka.

Scope UI jelas: profil, preferensi, semua saved reports dan own linked Feedback;
foto/kredensial/raw uploads tidak termasuk. Backend gagal dengan 413 bila >500
reports atau >500 Feedback, dan 503 jika hasil count tidak lengkap. Tidak membuat
partial export yang mengaku lengkap. Error 413 write biasa tidak lagi diberi
pesan batas export yang salah.

## Verified locally

Focused `npm.cmd test -- tests/settings-api.test.ts tests/settings.test.tsx`:
**26 PASS**. Kasus baru: valid export Blob, response owner lain, switch identity
saat request berjalan, abort, serta beda pesan 413 export/write. Backend existing
export tests memeriksa own confirmed Feedback, private fields dan count completeness;
full regression pada 8F. Checkpoint lokal ini kemudian dilengkapi bukti unduhan
browser pada kelanjutan di bawah.

Kelanjutan browser 5 November: pada sesi Fiqry F1, tombol Unduh data akun
menghasilkan unduhan selesai `phase8-f1-account-export.json` (443 byte), disimpan
lokal dalam direktori QA yang git-ignored. Pemeriksaan JSON tanpa mencetak data
pribadi: format_version 2, profil cocok F1, preferences berisi history_retention
dan animation, saved_reports 0, feedback 0; tidak ditemukan field token/password/
internal_notes/service_role. Bukti ini melengkapi unit race/abort/owner guards;
bukan pengujian browser populated History atau pencabutan sesi saat download.
Tidak ada data cloud dimutasi dan file pribadi tidak dimasukkan ke Git/laporan.

## Privacy controls existing

- History manual consent, disabled retention menolak save di RPC; tidak auto-save.
- Delete History memerlukan konfirmasi dan scoped owner/session.
- Feedback tersimpan terpisah dari History; tamu tidak memperoleh ownership dari
  email kontak. Admin internal notes bukan bagian user export.
- Avatar private path/cacheNonce/Save/stage-delete/cross-user A4 PASS digunakan
  ulang; tidak mengulang mutasi.
- `useHistoryResource` abort/key guard dan context keyed by owner menahan stale
  async data. Current local tests menjadi bukti, bukan klaim live cloud tambahan.

## Account deletion / retention design dependency

Control tetap disabled. B10 punya rancangan untuk ditinjau pemilik produk.

| Data | Usulan tindakan |
| --- | --- |
| Auth, profil, preferensi, role dan laporan | Cabut sesi dan blok akses sebelum cleanup. Hard delete identitas Auth setelah cleanup eksternal selesai. FK cascade yang ada menghapus profil (termasuk preferensi), role dan laporan. |
| Avatar | Worker hapus objek `account-avatars/<uid>/avatar.jpg` melalui Storage API. Verifikasi objek sudah hilang sebelum hapus Auth. Objek yang sudah tidak ada dianggap berhasil saat retry. |
| Feedback tertaut | Usulan hapus Feedback yang ditautkan ke akun beserta `feedback_handling` dalam satu transaksi DB. Hapus handling dahulu karena FK tanpa cascade. `ON DELETE SET NULL` pada owner saja masih meninggalkan email, teks dan catatan Admin. Feedback tamu tetap mengikuti kebijakan retensi terpisah. |
| Audit dan registry | Pertahankan aksi administratif minimum. FK actor/reviewer menjadi null. Tinjau metadata dan entity ID yang masih bisa mengidentifikasi akun. Tentukan masa retensi untuk audit dan backup sebelum rilis. |
| Admin bootstrap | Tolak penghapusan melalui alur mandiri untuk akun Admin. Jalur operasional perlu verifikasi pengganti dan peninjauan row singleton `admin_bootstrap` yang tidak punya FK. |

Endpoint masa depan mengambil UID dari sesi terverifikasi, meminta autentikasi
ulang dan konfirmasi penghapusan. Job privat yang idempotent mengunci permintaan
per UID. Setelah diterima, akses tetap tertutup termasuk saat retry. Worker dengan
akses terbatas menyelesaikan Storage dan DB secara bertahap, menghapus Auth paling
akhir, lalu menyimpan status minimum tanpa konten pengguna. UI baru menyatakan
selesai setelah seluruh tahap terverifikasi. Restore backup perlu mencegah data
yang telah dihapus muncul kembali sebelum akses dibuka.

Sebelum implementasi Phase 11, pemilik produk perlu memutuskan retensi backup/audit,
perlakuan Feedback tertaut dan prosedur akun Admin. Uji terisolasi harus membuktikan
penolakan lintas akun, sesi lama ditolak, retry setelah Storage/DB gagal,
tidak ada objek yatim, dan akun lain serta Feedback tamu tetap utuh.

## Kontrak untuk Phase 9 (inspected, bukan engine implemented)

| Kontrak existing | Invariant / pekerjaan lanjutan |
| --- | --- |
| Enam input mode | link/message/website/qr/image/video; ukuran/MIME/panjang divalidasi; lima engine belum ada |
| Analysis status | completed/failed/not_performed/unsupported; noncompleted risk null |
| Result provenance | completed wajib engine, engine_version, analyzed_at; result risk konsisten |
| Findings/sources/checks | Array/panjang bounded, source reference dan per-check status; tidak menjamin kebenaran provider |
| Storage consent | Save RPC menerima report ID sah + consent; user tidak dapat mengarang completed report |
| History detail | Strict parse, own saved/preview access; dummy DEV-only |
| Source transparency | Nama/reference/status dapat ditampilkan; registry association bukan verdict aman |

Phase 9 masih harus menetapkan versioned job/analysis request contract, status
transitions/cancellation/idempotency, engine provenance issuance dan isolation,
source licensing/freshness, safe URL fetch/SSRF policy serta media processing
boundaries. Phase 10 mengimplementasikan engine nyata. Tidak menambah verdict,
scoring, inference, crawler, threat-feed activation atau fabricated scan reports.
