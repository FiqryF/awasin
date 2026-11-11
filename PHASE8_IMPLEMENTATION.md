# AWASIN — Phase 8 Implementation

5 November 2026. Baseline `main` / `69766069ae1b2ec3714733f7b2aa484a626fbf95`.
Working tree awal bersih. Tidak ada commit/push/deploy, migration atau cloud write.

## Checkpoint berurutan

| Checkpoint | Pekerjaan dan bukti |
| --- | --- |
| 8A | Audit selective, Phase 7 latest checkpoint direkonsiliasi; master backlog dibuat |
| 8B | Auth/recovery/session review; 75 focused tests PASS; izin sesi Fiqry untuk navigasi, akun kedua/inbox tidak tersedia |
| 8C | Request cap diperluas sebelum JSON; 4 red tests lalu focused 63 PASS; CORS/normal Feedback/Admin tetap; ledger/restore plan baca-saja |
| 8D | UI account export memakai API existing, owner recheck/abort/format guard; 26 focused tests PASS; deletion tetap butuh lifecycle design |
| 8E | Login validation memindahkan fokus; red regression lalu 41 Auth PASS; browser 8 guest guards + 9 responsive; runtime dependency advisory audit |
| 8F | Full regression, fresh local HTTP, anonymous Supabase read-only dan readiness report |

## Perubahan kode

- `backend/app/core/body_limit.py` memindahkan/menggeneralisasi limiter Feedback
  existing; `main.py` mendaftarkannya pada prefix API. 256 KiB JSON API write,
  Feedback 32 KiB, actual-byte/chunked cap dan response 413 aman sebelum parsing.
- `frontend/src/features/settings/api.ts`: owner-bound accountExport, format
  response guard, pesan 413 write dibedakan dari export-record cap.
- `SettingsPage.tsx`: tombol Unduh data akun di Privasi & Data; busy/error/abort
  guard, no auto-download, object URL cleanup.
- `LoginPage.tsx`: fokus input pertama invalid setelah submit gagal validasi.
- Regression: `test_request_limits.py`, `settings-api.test.ts`, `auth.test.tsx`.
  Tidak ada dependency, policy, verdict, scan engine atau crawler baru.

## Hasil dan batas

Frontend **241 PASS**, lint PASS, TypeScript/Vite build PASS; 24 route dan dua
checker PGlite PASS. HTTP anonim **31/31 PASS**, memakai fresh backend port 8001
serta cloud Supabase existing; bukti ignored
`frontend/.phase7.local/phase8-public-http.json`. HTTP health 200, oversized
profile dan Feedback 413 dengan CORS/no-store terverifikasi pada proses baru.
Backend final **131 PASS**; dua warning existing Starlette/httpx dan cache permission. Login error focus juga PASS browser (login-email, aria-invalid true). Server lokal sementara 8001 dihentikan setelah tes. Marker dummy tidak ditemukan pada 30 JS chunks; sourcemap 0. Browser authenticated dicatat pada readiness report.

Satu fixture boundary semula tidak menyertakan Content-Type JSON sehingga tepat
batas menghasilkan 401, bukan 422 yang diharapkan. Fix pada test menambahkan
header JSON; assertion 422/413 tidak dilemahkan. Tidak ada product fix tambahan
untuk menutupi kegagalan test tersebut.

Build main **792.93 kB / gzip 243.85 kB**; Settings chunk **18.87 / 6.30 kB**;
jsQR **130.72 / 47.46 kB**. Warning >500 kB tetap transparan. Build memakai HTTPS
placeholder API pada environment proses saja, bukan deployment atau edit .env.

Audit advisories runtime: npm 0 reported; 26 dependency runtime Python diperiksa
melalui `https://pypi.org/pypi/{name}/{version}/json`, 26 clear, 0 blocked/affected.
Hanya nama/versi paket publik dikirim; bukan full security audit atau proof of
absence. Dev-toolchain advisory audit dan production hardening tetap tercatat.

Dokumen terpisah mempertahankan Implemented / Verified locally / Verified cloud /
Verified browser / Blocked / Deferred. Bukti A4/D/E/F tidak ditulis ulang.

## Kelanjutan browser/provider 5 November

B01 login ulang/switch F1→Firmansyah→F1/antartab dan B09 ekspor browser selesai;
profil F1 dipulihkan, tab QA tambahan ditutup, ekspor pribadi git-ignored.
Idle awal belum konklusif; baseline marker baru dicatat, B02 tetap PARTIAL.
Audit dashboard menemukan minimum sandi provider 6 versus frontend 8. Pengguna
menyetujui P1 saja: minimum provider diubah 6→8, Save success, panel dibuka ulang
memperlihatkan 8 dan Save disabled; OTP tetap 3600/panjang 8. Ini perubahan
konfigurasi cloud berizin, tanpa edit akun/password/role atau toggle lain.
Tidak ada source-code baru pada kelanjutan ini; hasil regresi di atas tetap
berlaku, tidak diulang untuk perubahan dokumen dan konfigurasi provider.

Pengguna kemudian memilih tes sesi dengan waktu virtual agar tidak menunggu.
Subset session-activity/Auth/dashboard dijalankan ulang: 65 PASS/3 files dalam
5.27 detik (exit 0). Tidak menambah tes duplikat atau mengubah kode/timeout.
Pengamatan live lanjutan dibatalkan, DevTools ditutup; B02 tetap PARTIAL dengan
logika lokal verified dan bukti live idle belum konklusif.

## Remediasi B26 pada 11 November

`frontend/package.json` menambahkan override `minimatch@10` ke `11.0.1`.
`package-lock.json` memuat versi patched dan dependensi transitifnya.
Audit npm penuh 0 advisory. ESLint sebelum/sesudah mencakup 149 file yang sama,
0 error dan warning. Seluruh 241 tes frontend dan production build lulus.
B26 selesai. Jumlah backlog terkait Phase 8 yang terbuka menjadi 9.
