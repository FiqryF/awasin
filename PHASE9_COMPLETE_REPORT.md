# AWASIN — Phase 9 Complete Report

11 November 2026 · Security Analysis Engine Foundation · Pengembangan lokal

## 1. Executive Summary

Phase 9 menambahkan API dan orchestrator analisis bersama untuk lima fitur dengan enam mode. Workspace mengirim input ke FastAPI melalui aksi pengguna. Semua mode saat ini mengembalikan `unavailable` dan risiko `unknown` karena belum ada adapter engine yang diaktifkan.

## 2. Baseline and Repository State

Branch `main`, HEAD awal `b192cf0`, working tree awal bersih. Checkpoint historis Phase 8 mencatat 250 tes frontend, 131 tes backend, lint, build, serta tes History lokal lulus. Detail Phase 8 tetap berada di `PHASE8_FINAL_WORK.md`.

## 3. Implementation Scope

Kontrak enam mode, validasi backend, dispatch adapter, anggaran sumber daya, respons standar, dan integrasi workspace selesai dikerjakan secara lokal. Deteksi nyata, provider eksternal, penerbitan laporan tersimpan, dan deployment berada di fase berikutnya.

## 4. Architecture

Workspace mengirim JSON atau multipart ke FastAPI. Route memvalidasi sesi bila ada token, memeriksa input, memperoleh slot eksekusi, dan mengirim input tervalidasi ke orchestrator. Adapter yang terdaftar menghasilkan bukti dan provenance. Orchestrator menstandarkan respons. Tidak ada jalur tulis database dari modul analisis.

## 5. Files Changed

| File | Perubahan |
| --- | --- |
| `backend/app/modules/analysis/{schemas,validation,orchestrator,router}.py` | Kontrak, pemeriksaan input, adapter, eksekusi, dan transport |
| `backend/app/main.py`, `backend/app/api/v1/router.py`, `backend/app/core/body_limit.py` | Inisialisasi orchestrator, pendaftaran route, pengecualian streaming untuk endpoint media yang spesifik |
| `backend/pyproject.toml` | Pillow untuk struktur gambar, python-multipart untuk parsing, dan batas versi Starlette yang mendukung pembersihan spool saat pembacaan dibatalkan |
| `frontend/src/features/scan/{analysisApi.ts,ScanForm.tsx,ScanPanel.tsx}`, `frontend/src/services/api.ts` | Kontrak TypeScript, HTTP, feedback aksesibel, dan pembatalan hasil lama |
| `backend/tests/test_analysis.py`, `backend/tests/test_foundation.py`, `frontend/tests/scan-workspace.test.tsx` | Tes API, batas keamanan, inventaris OpenAPI, dan interaksi workspace |

## 6. API Endpoints

| Method dan path default | Input |
| --- | --- |
| `POST /api/v1/analysis` | JSON untuk link, website, pesan teks, atau payload QR |
| `POST /api/v1/analysis/media/{mode}` | Multipart dengan satu `file` dan `metadata` JSON opsional untuk message, qr, image, atau video |

Tamu bisa mengirim tanpa token, sesuai akses workspace. Bearer yang dikirim wajib lolos layanan identitas yang sudah ada. Respons tidak di-cache. Validasi memakai envelope error FastAPI yang sudah ada. HTTP 401 menandai sesi invalid, 408 upload timeout, 413 ukuran berlebih, 415 media type HTTP tidak didukung, 422 input invalid, dan 429 kapasitas sementara penuh. Engine kosong atau gagal memakai status eksplisit di respons 200 setelah input valid.

## 7. Input/Output Contracts

| Mode | Input yang diterima |
| --- | --- |
| `link` | URL HTTP(S), hingga 4.096 karakter |
| `website` | Domain atau URL HTTP(S), hingga 4.096 karakter |
| `message` | Teks 10–10.000 karakter atau screenshot dengan teks opsional |
| `qr` | Payload hingga 4.096 karakter atau gambar QR |
| `image` | JPEG, PNG, atau WebP |
| `video` | MP4 atau WebM |

Multipart opsional membawa metadata `mode`, `text` khusus pesan, `request_id`, dan `history_consent`. `mode` di metadata harus cocok dengan path. JSON membawa `mode` dan input sesuai tabel serta dapat membawa `request_id` dan `history_consent`. Server menghasilkan UUID bila ID permintaan tidak diberikan serta ID analisis terpisah. Respons membawa kedua ID, mode, waktu UTC, status, risiko, penjelasan, bukti, provenance, keterbatasan, kode error, metadata media tervalidasi, dan kelayakan History.

## 8. Analysis Orchestrator

`AnalysisOrchestrator` menerima peta adapter per mode. Konfigurasi aplikasi saat ini memakai peta kosong. Batas teknis lokal adalah empat permintaan analisis aktif per worker, upload maksimal 15 detik, dan eksekusi adapter maksimal lima detik. Jalur error dan timeout mengembalikan kode stabil. Pembatalan task merambat ke adapter asinkron. Pembatalan browser mengabaikan respons lama. Penghentian kerja server secara langsung saat klien putus setelah upload belum tersedia.

## 9. Engine Adapter Specifications

`EngineAdapter.analyze(AnalysisInput) -> EngineResult` bersifat asinkron. Input berisi mode, konteks permintaan, dan data tervalidasi. Handle media berlaku selama permintaan berlangsung. Adapter harus menghormati pembatalan, menyajikan bukti yang aman ditampilkan, serta menjaga input dan detail provider tetap privat. Adapter uji hanya didefinisikan di tes. Penerbitan laporan persisten tetap menjadi tanggung jawab backend yang terpisah.

## 10. Evidence and Provenance

Bukti mencatat ID unik, kode, jenis, penjelasan, indikator opsional, sumber, waktu observasi berzona waktu, severity, status validasi, dan keterbatasan. Provenance mencatat engine, versi, jenis sumber, waktu pemeriksaan, dan versi dataset opsional. Respons engine kosong membawa provenance `null` dan daftar bukti kosong.

## 11. Risk Assessment

Status eksekusi memakai `completed`, `partial`, `inconclusive`, `unavailable`, dan `failed`. Kategori risiko memakai `low`, `medium`, `high`, dan `unknown`. Risiko selain `unknown` memerlukan hasil selesai dan minimal satu bukti terverifikasi. Respons saat ini tidak mengeluarkan skor, persentase, atau verdict keamanan.

## 12. Security Architecture

- Validasi URL membatasi HTTP(S), memeriksa hostname dan IDN, menolak kredensial, karakter ambigu, literal IP nonpublik, serta sejumlah nama lokal. Tidak ada resolusi DNS, fetch URL, redirect, atau crawling. Pemeriksaan DNS/rebinding dan egress terisolasi diperlukan sebelum fitur inspeksi aktif.
- Batas JSON API yang ada tetap 256 KiB dan Feedback tetap 32 KiB. Endpoint multipart yang spesifik membatasi stream aktual per mode ke 10 MiB untuk gambar atau 50 MiB untuk video, ditambah maksimal 64 KiB overhead. Satu file dan satu field metadata diperbolehkan. Upload besar dapat memakai spool sementara yang ditutup setelah permintaan atau kegagalan parser. [Dokumentasi request Starlette](https://starlette.dev/requests/)
- Gambar diperiksa menurut format aktual dan struktur file, dengan batas 8.192 piksel per sisi dan 20 megapiksel. Video diperiksa pada batas container MP4/WebM. Codec, frame, dan isi stream tidak didekode. Pemeriksaan struktur ini tidak membuktikan media bisa diputar atau autentik. [Dokumentasi Pillow Image](https://pillow.readthedocs.io/en/stable/reference/Image.html)

## 13. Privacy and History

Input dikirim saat pengguna menekan tombol periksa. Frontend mengganti nama file unggahan dengan nama tetap. Respons dan error tidak memantulkan input mentah. Endpoint tidak menulis ke History, database, Storage, atau provider eksternal. Guest tidak dapat meneruskan persetujuan History sebagai persetujuan akun. Semua hasil Phase 9 memiliki `history_eligible: false`. B11 memerlukan penerbitan laporan dari engine nyata yang terikat pemilik, lalu uji opt-out dan persetujuan simpan dengan API History yang ada.

## 14. Frontend Integration

Workspace dan navigasi tetap memakai komponen yang ada. UI mengumumkan proses lewat `output` dan error lewat `role="alert"`. Perubahan input, mode, atau akun membatalkan request lama dari UI. Transport memeriksa bahwa token berasal dari sesi akun yang sedang tampil. QR tetap dibaca lokal, isinya ditampilkan sebagai teks, dan URL dikirim sebagai payload QR hanya lewat aksi pengguna. Tidak ada navigasi otomatis ke isi QR atau tombol simpan laporan Phase 9.

## 15. Database and Migration

Tidak ada perubahan skema, migrasi baru, replay 001–007 pada cloud, atau operasi Supabase. Tes PGlite menjalankan skema yang relevan pada database lokal terisolasi. Rekonsiliasi ledger dan restore cloud tetap tercatat sebagai pekerjaan terpisah.

## 16. Testing and Verification

| Pemeriksaan | Hasil |
| --- | --- |
| Backend `python -m pytest -q -p no:cacheprovider` | 177 lulus, termasuk 46 tes analisis. Satu warning deprecation Starlette TestClient |
| Frontend `npm test` | 260 lulus, 22 file |
| Frontend `npm run lint` dan `npm run build` | Lulus. Build mencakup `tsc -b`, dengan URL API placeholder HTTPS dan Supabase dinonaktifkan melalui environment proses |
| `npm run check:history-db` | Lulus pada PGlite untuk RLS, consent, opt-out, sesi dicabut, penghapusan History, dan batas kepemilikan |
| Smoke HTTP manual | Vite `/scan/link` 200. FastAPI POST 200 dengan `unavailable/unknown`, History tidak eligible, CORS loopback sesuai. URL nonpublik ditolak 422 |
| Browser melalui Codex Work | **BLOCKED**. Sesi menolak akses ke browser lokal walaupun pengaturan pengguna menunjukkan On |
| Browser melalui terminal | **PASS**. Chrome Headless 157.0.0.0 via Chrome DevTools Protocol, profil sementara, Vite dan FastAPI di loopback. Sepuluh skenario UI/HTTP lulus |
| Regresi terarah pemulihan browser | 88 tes backend analisis, fondasi, dan History lulus. 38 tes frontend workspace dan History API lulus. PGlite History lulus |

Tes backend dijalankan di luar sandbox jaringan untuk socket loopback TestClient di Windows. Server smoke test berjalan lokal dengan Supabase dinonaktifkan.

Chrome Headless menguji alur tamu dengan URL, teks, PNG, QR, dan WebM sintetis. Delapan skenario input valid menampilkan pesan analisis belum tersedia dengan HTTP 200 tanpa aksi simpan ke History, termasuk pesan dengan dan tanpa screenshot serta pengulangan Link Inspector di viewport 393 px. URL nonpublik dan PNG rusak ditolak dengan HTTP 422. QR tidak memicu permintaan API saat decode, dan hanya dikirim setelah klik. Pada lebar 393 px, tombol panah memindahkan pilihan dan fokus tab tanpa gulir horizontal. Harness membatasi lalu lintas aplikasi ke loopback. Pada uji ulang video dan mobile, browser mencatat nol percobaan akses ke origin eksternal.

Playwright tidak terpasang. Uji memakai Chrome yang sudah ada dan WebSocket bawaan Node. Generator QR kecil dipakai sementara untuk membuat fixture. Profil dan alat fixture sementara dibersihkan. Tidak ada dependensi repository yang berubah. [Dokumentasi Chrome Headless](https://developer.chrome.com/docs/chromium/headless)

## 17. Bugs and Fixes

Regresi awal backend menemukan daftar route OpenAPI di tes fondasi masih mengharapkan inventaris sebelum Phase 9. Dua route baru ditambahkan ke daftar eksplisit tanpa mengendurkan pemeriksaan route lama. Validasi server juga mencakup website tanpa skema dengan path, sesuai input yang diterima workspace. Fixture WebM pertama hanya berisi header dan ditolak 422. Setelah MediaRecorder menghasilkan frame, fixture diterima 200. Tidak diperlukan perubahan source code pada pemulihan tes browser.

## 18. Known Limitations

Parser video hanya memeriksa container. Isolasi worker, batas CPU lintas proses, quota provider, dan rate limit terdistribusi perlu diverifikasi sebelum engine aktif. Cakupan browser Phase 9 adalah Chrome Headless dengan sesi tamu. Firefox, pembaca layar, dan login cloud aktual tidak diuji pada checkpoint ini. Build tetap memberi peringatan chunk utama 796,10 kB, atau 244,98 kB gzip. Akurasi engine belum dapat diukur.

## 19. Consolidated Master Backlog

Daftar ini memuat pembaruan Phase 9. `AWASIN_MASTER_BACKLOG.md` dipertahankan sebagai catatan historis dan dapat direkonsiliasi pemilik memakai ID berikut.

| ID | Pekerjaan | Severity | Status / bukti | Target |
| --- | --- | --- | --- | --- |
| B05 | CAPTCHA dan pengujian anti-abuse | High produksi | Setting provider dan batas lokal diverifikasi pada cakupan masing-masing. Evaluasi publik terbuka | 11 |
| B07 | Rekonsiliasi ledger cloud | Medium | Audit checkpoint 001–007 selesai pada Phase 8. Ledger belum direkonsiliasi | Sebelum migrasi cloud berikutnya |
| B08 | Restore cloud terisolasi | High produksi | Simulasi sintetis PGlite lulus pada Phase 8. Restore data dan Storage aktual terbuka | 11 |
| B10 | Penghapusan akun aktual dan retensi | Medium | Desain dan tes sintetis Phase 8 tersedia. Endpoint dan kebijakan retensi final terbuka | 11 |
| B11 | History hasil engine nyata | High | Consent dan isolasi lokal lulus. Penerbitan dan penyimpanan hasil nyata belum diuji | 10 |
| B14 | Evaluasi bundle dan performa | Medium | CLS Pengaturan diperbaiki pada Phase 8. Peringatan chunk masih ada | 11 |
| B15 | Browser dan pembaca layar | Medium | Chrome Headless lokal lulus untuk alur tamu, keyboard, dan viewport 393 px. Jalur Work diblokir. Firefox dan pembaca layar terbuka | 10/11 |
| B18 | Kontrak, orchestrator, evidence dan provenance | Medium | Fondasi lokal tersedia. Adapter nyata dan penerbitan laporan masih terbuka | 9/10 |
| B19–B23 | Lima engine deteksi | Prioritas fitur | Semua mode saat ini melaporkan engine belum tersedia | 10 |
| B24 | Sumber intelijen dan registry | Medium | Registry manual tetap berlaku. Provider nyata menunggu evaluasi dan persetujuan | 10/11 |
| B17/B25 | Deployment dan final gate | High produksi | Belum dijalankan | 11 |
| P9-01 | Worker URL/media dan quota produksi | High produksi | API tidak melakukan fetch atau decode video. Inspeksi aktif dan pemrosesan media berat memerlukan worker terisolasi | 10/11 |

## 20. Phase 9 Checkpoint Matrix

| Checkpoint | Hasil |
| --- | --- |
| 9A | Audit terarah menemukan route, session resolver, guard body, ScanPanel, dan kontrak History yang dapat dipakai |
| 9B | Kontrak Pydantic dan TypeScript untuk enam mode, bukti, provenance, status, dan error |
| 9C | Dispatch, timeout, cancellation task, kapasitas, dan fallback engine kosong |
| 9D | Validasi URL tanpa fetch, pemeriksaan struktur media, dan batas byte/slot |
| 9E | Integrasi workspace, smoke HTTP, dan 10 skenario Chrome Headless lulus. Jalur browser Codex Work tetap BLOCKED |
| 9F | Batas History dipertahankan, tanpa penerbitan laporan buatan. B11 menunggu engine |
| 9G | 177 tes backend, 260 tes frontend, lint, typecheck/build, dan PGlite lulus |

## 21. Phase 10 Readiness

Implementasi adapter dan evaluasi lokal dapat dimulai dari kontrak ini. Sebelum menyalakan adapter, verifikasi sumber bukti, kebijakan penggunaan data, timeout dan cancellation provider, serta cara mengisolasi pemrosesan URL dan media sesuai kebutuhan engine. Alur History dengan hasil engine nyata tetap menjadi bagian integrasi.

## 22. Recommended Phase 10 Implementation Order

1. Intelijen URL pasif bersama dan Link Inspector.
2. QR memakai hasil decode dan adapter Link.
3. Message Analyzer dengan ekstraksi URL dan OCR setelah review privasi.
4. Fake Website Detector memakai bukti domain dan registry manual.
5. Keaslian gambar, lalu video, memakai pipeline terisolasi dan evaluasi terpisah.

## 23. Final Verdict

**READY WITH LIMITATIONS** untuk pengembangan Phase 10. Fondasi sudah terhubung ke workspace dan alur tamu lulus di Chrome Headless. Cakupan lintas browser, isolasi pemrosesan berat, dan bukti engine nyata masih terbuka. Kesiapan produksi tetap berada di Phase 11.

Seluruh dokumentasi Phase 9 berada di file ini. Tidak ada commit, push, deploy, migrasi cloud, atau perubahan data produksi.
