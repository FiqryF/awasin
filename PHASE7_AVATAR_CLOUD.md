# AWASIN — Laporan Migrasi 007 dan Integrasi Avatar

**Tanggal:** 3 November 2026, Asia/Bangkok  
**Proyek cloud:** awasin (`nqruowgbxiopfhslznyb`)  
**Branch dashboard:** main / PRODUCTION  
**Migrasi:** `supabase/migrations/202610310007_account_avatars.sql`

## 1. Status akhir

**Penerapan skema migrasi 007 selesai dan diverifikasi pada database cloud.**
Bucket private, batas file, empat policy, serta aktivasi RLS sudah diperiksa.
Pengujian izin baca dan sebagian izin tulis dilakukan langsung di PostgreSQL
cloud dengan konteks role pengguna. Ini bukan klaim bahwa seluruh Phase 7 atau
seluruh alur browser/Storage API sudah teruji.

Migrasi 007 tidak dijalankan ulang pada audit lanjutan. Migrasi 001–006 tidak
_diubah_ atau dijalankan ulang dalam pekerjaan ini. Tidak ada commit atau push.

## 2. Penyebab masalah dan pekerjaan yang dilakukan

### Upload gagal karena konfigurasi cloud belum tersedia

Pemeriksaan awal dashboard menemukan daftar bucket dan policy Storage kosong.
Setelah persetujuan eksplisit pemilik, transaksi pada migrasi 007 diterapkan
melalui Supabase SQL Editor. Query verifikasi menghasilkan satu bucket dan
empat policy yang sesuai dengan file migrasi.

Audit lanjutan memeriksa kembali kondisi aktual, tanpa mengulang migrasi.
Pada audit lanjutan terdapat **satu objek** di bucket avatar. Keberadaan objek
tersebut tidak otomatis membuktikan seluruh alur upload terbaru melalui UI.

### Sinkronisasi foto dengan navbar

Hook dan event avatar yang sudah ada dipertahankan. Perbaikan mencakup:

- Event perubahan membawa owner dan foto yang baru disimpan, sehingga Settings
  dan navbar dapat diperbarui tanpa mengunduh ulang setelah setiap mutasi.
- Unduhan awal memakai `cache: 'no-store'`.
- Respons async lama diabaikan setelah perubahan foto atau akun.
- Object URL dibersihkan ketika diganti atau komponen dilepas.
- Sesi diperiksa kembali sebelum hasil mutasi diumumkan sebagai sukses.
- Gambar yang gagal ditampilkan kembali ke avatar default.

Foto navbar semula dibatasi 26 px di dalam tombol 52 px. Ukurannya diubah menjadi
100% area dalam tombol dengan padding nol, tetap bulat dan `object-fit: cover`.
Ukuran tombol desktop/mobile tetap mengikuti CSS navbar existing.

### Foto tersimpan sebelum tombol Simpan diklik

Penyebabnya adalah handler pemilihan dan penghapusan foto langsung memanggil
Storage, sementara tombol Simpan hanya menangani nama tampilan.

Alur terbaru:

1. **Pilih foto** memvalidasi gambar dan membuat pratinjau lokal.
2. Foto belum dikirim ke Storage dan navbar belum berubah.
3. **Simpan profil** menyimpan perubahan nama dan foto yang tertunda.
4. Penghapusan foto juga ditunda sampai Simpan profil.
5. Perubahan foto ikut memicu peringatan saat meninggalkan halaman.
6. Draf dipertahankan jika penyimpanan gagal agar dapat dicoba kembali.

Penyimpanan nama melalui API profil dan foto melalui Storage adalah dua operasi
terpisah, bukan satu transaksi atomik. Jika nama berhasil disimpan tetapi foto
gagal, UI menyatakan hasil sebagian tersebut; percobaan berikutnya tidak perlu
mengulangi perubahan nama yang sudah berhasil.

## 3. Konfigurasi cloud yang terverifikasi

| Properti | Hasil aktual |
| --- | --- |
| Bucket | `account-avatars` |
| Public | `false` — private |
| Batas file | `2097152` byte / 2 MiB |
| MIME penyimpanan | `image/jpeg` |
| Path kanonis | `<auth.uid()>/avatar.jpg` |
| RLS `storage.objects` | Aktif (`relrowsecurity = true`) |
| FORCE RLS `storage.objects` | `false`; tidak diubah dalam audit |
| Policy tambahan pada `storage.objects` | Tidak ada di luar empat policy avatar pada saat audit |

Input JPG, PNG, dan WebP pada frontend diproses menjadi JPG sebelum disimpan.
Batas MIME dan ukuran bucket di atas diperiksa melalui konfigurasi database;
penolakan file oleh endpoint Storage belum diuji pada layanan nyata.

| Policy | Command | Role | Pembatasan |
| --- | --- | --- | --- |
| Read own account avatar | SELECT | authenticated | USING: bucket dan path owner cocok |
| Insert own account avatar | INSERT | authenticated | WITH CHECK: bucket dan path owner cocok |
| Update own account avatar | UPDATE | authenticated | USING dan WITH CHECK: bucket dan path owner cocok |
| Delete own account avatar | DELETE | authenticated | USING: bucket dan path owner cocok |

Ekspresi owner pada policy: `name = auth.uid()::text || '/avatar.jpg'`, bersama
`bucket_id = 'account-avatars'`. Tidak ada bucket public, URL public, atau
service-role key yang ditambahkan pada frontend.

## 4. Pemeriksaan ledger migrasi

Audit baca-saja menggunakan `to_regclass` dan `information_schema.columns`
menemukan:

```json
{"table": null, "columns": null}
```

Artinya tabel `supabase_migrations.schema_migrations` **belum tersedia** pada
proyek ini. Ledger bukan sekadar belum diperiksa: ketiadaannya sudah diverifikasi.

007 diterapkan melalui SQL Editor, sehingga status selesai dibuktikan oleh
skema aktual dan laporan ini, bukan entri ledger CLI. Audit tidak membuat tabel
ledger baru atau mengarang riwayat migrasi 001–006. Tidak ada ledger existing yang
perlu diperbaiki khusus untuk 007.

**Panduan berikutnya:** jangan menjalankan `db push`, migrasi 007, atau repair
ledger secara buta. Jika nanti beralih ke deployment berbasis CLI, rekonsiliasi
seluruh baseline 001–007 dengan skema aktual terlebih dahulu. Pekerjaan baseline
tersebut merupakan pekerjaan terpisah dari konfigurasi avatar 007.

## 5. Hasil pengujian cloud

### A. Isolasi baca — PostgreSQL cloud

Pengujian memakai objek avatar existing dan ID dua akun existing. Role database
serta JWT claims diatur secara lokal dalam transaksi oleh SQL Editor. Tidak ada
password/token pengguna yang dibaca atau dicatat. Ini pengujian RLS database,
**bukan login SDK dua akun atau pengujian HTTP Storage API**.

| Kasus | Hasil |
| --- | --- |
| Role authenticated + UID owner membaca avatar sendiri | Lulus: tepat 1 row terlihat |
| Role authenticated + UID akun lain membaca avatar owner | Lulus: 0 row terlihat |
| Role anon membaca objek bucket avatar | Lulus: 0 row terlihat |

Query berisi assertion yang menggagalkan eksekusi jika hasil berbeda.
Transaksi pertama bersifat READ ONLY dan diakhiri ROLLBACK. Hasil dashboard:

```text
owner_read: PASS
cross_account_read_denied: PASS
anonymous_read_denied: PASS
data_changes: READ ONLY / ROLLBACK
```

### B. Izin tulis — metadata sementara dengan rollback

Dipakai akun existing lain yang belum mempunyai objek avatar. Metadata objek
sementara dibuat hanya di dalam transaksi; tidak ada file yang dikirim ke
object storage. Tidak ada perubahan yang di-commit.

| Kasus | Hasil |
| --- | --- |
| Owner INSERT metadata pada path kanonis miliknya | Lulus |
| Owner SELECT metadata yang baru dibuat | Lulus |
| Owner UPDATE metadata miliknya | Lulus |
| Akun lain INSERT pada path owner existing | Ditolak oleh RLS; lulus |
| Akun lain UPDATE objek owner existing | 0 row; lulus |
| Owner INSERT dengan nama selain `avatar.jpg` | Ditolak oleh RLS; lulus |
| Anon INSERT | Ditolak; lulus |
| Anon UPDATE | 0 row; lulus |

Assertion berhasil diselesaikan, transaksi di-rollback, dan query pemeriksaan
setelahnya menghasilkan:

```text
original_object_count_unchanged: true
no_test_metadata_remaining: true
```

Jumlah objek tetap **1** dan tidak ada metadata bertanda uji tertinggal.
Tidak ada upload, penggantian, atau penghapusan file pengguna melalui Storage API.

### C. Batas uji DELETE

Percobaan awal DELETE metadata melalui SQL diblokir oleh proteksi bawaan
Supabase:

```text
ERROR 42501: Direct deletion from storage tables is not allowed.
Use the Storage API instead.
CONTEXT: storage.protect_delete()
```

Percobaan tersebut tidak menyelesaikan suite awal dan tidak dilaporkan sebagai
DELETE policy yang lulus. Transaksi dibatalkan; uji berikutnya diawali ROLLBACK,
menghilangkan DELETE langsung, lalu memeriksa tidak ada data uji tertinggal.
Proteksi tersebut tidak dinonaktifkan atau dilewati.

Definisi policy DELETE sudah sesuai migrasi, tetapi eksekusi DELETE aktual harus
diverifikasi melalui Storage API. SQL bukan pengganti uji penghapusan file.

## 6. Hasil pemeriksaan lokal terbaru

Pemeriksaan dijalankan ulang setelah perubahan frontend terakhir:

| Pemeriksaan | Hasil |
| --- | --- |
| `npm.cmd test` | Lulus: 22 file, 232 tes |
| `npm.cmd run lint` | Lulus, exit code 0 |
| TypeScript dan Vite build | Lulus, exit code 0 |
| Pemeriksaan diff | Tidak ada error whitespace; ada pemberitahuan normalisasi LF/CRLF |

Build menggunakan `VITE_API_BASE_URL=https://api.example.invalid` hanya pada
proses pemeriksaan. Placeholder ini bukan deployment atau endpoint produksi yang
berfungsi, dan tidak ditulis ke `.env`. Guard HTTPS existing tetap dipertahankan.
Build masih memberi peringatan chunk utama melebihi 500 kB.

Tes lokal mencakup pratinjau tanpa upload, simpan eksplisit, penundaan hapus,
validasi nama, pembatalan navigasi, kegagalan Storage, retry, hasil simpan sebagian,
sinkronisasi menu, pergantian akun, dan respons async lama. Hasil mock/DOM ini
tidak menggantikan pengujian browser ke layanan nyata.

## 7. File pekerjaan dalam sesi ini

- `frontend/src/features/settings/avatar.ts`
- `frontend/src/components/layout/ProfileMenu.tsx`
- `frontend/src/components/layout/profile-menu.css`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/tests/avatar.test.tsx`
- `frontend/tests/settings.test.tsx`
- `PHASE7_AVATAR_CLOUD.md` — laporan ini.

File SQL migrasi 007 dipakai sebagai sumber penerapan, tidak diedit. Migrasi
001–006, autentikasi, role akun, engine analisis, dan fitur lain tidak diubah.

## 8. Yang masih tersisa di luar penutupan skema 007

**Jangan menyebut seluruh Phase 7 selesai berdasarkan laporan ini.** Yang belum
terbukti pada alur terbaru ke Storage API/browser nyata:

- Pilih foto tanpa Simpan tidak mengubah objek cloud atau navbar.
- Simpan/ganti/hapus melalui UI menghasilkan keadaan cloud yang tepat.
- Foto tetap benar setelah refresh, navigasi, logout, dan pergantian akun.
- Penolakan akses silang memakai JWT sesi nyata pada endpoint Storage.
- Penanganan putus jaringan, sesi kedaluwarsa, dan penolakan upload layanan nyata.
- Pemeriksaan perangkat mobile fisik dan aksesibilitas browser yang menyeluruh.

Tampilan foto navbar telah diamati pada viewport lebar dan sempit sebelumnya,
dan foto existing terlihat di Settings/navbar. Pengamatan itu tidak membuktikan
seluruh skenario simpan eksplisit terbaru.

**Kesimpulan:** konfigurasi database migrasi 007 sudah selesai, status ledger
sudah diketahui, dan uji RLS database yang dirinci di atas lulus. Pengujian
Storage API serta lifecycle browser penuh tetap merupakan pekerjaan verifikasi
integrasi Phase 7 yang terpisah.