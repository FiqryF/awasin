# AWASIN — Phase 10 Complete Report

11 November 2026 · Checkpoint 10A

## 1. Ringkasan

Phase 10A mengaudit 15 berkas dataset, mengelompokkannya melalui manifest referensi, menyatukan Link & Website pada antarmuka, dan menyiapkan fondasi URL offline. Keputusan **PASS WITH LIMITATIONS**. Label dan izin pakai beberapa sumber masih terbuka. File gambar autentisitas dan video evaluasi belum tersedia.

## 2. Baseline Git

Branch `main`, HEAD awal `eeaecbd`, working tree awal bersih. Acuan Phase 9 adalah `PHASE9_COMPLETE_REPORT.md`. Kontrak respons, alur History, Supabase, dan schema database tetap kompatibel.

## 3. Lokasi sumber

`C:/Users/User/Downloads/dataset/` ditemukan berisi 15 berkas dengan total 2.088.171.717 byte. Seluruh berkas diberi SHA-256 dan 20 tabel selesai dibaca. Folder sumber berada di luar repo. Manifest menyimpan referensi lokal dan pengelompokan logis di bawah `raw/url`, `raw/message`, `raw/qr`, dan `raw/image`. Kategori video belum memiliki sumber.

## 4. Inventaris dan kualitas

| Berkas | Hasil audit dan kesiapan |
| --- | --- |
| `phishing_features.csv` | 160.064 baris. Label mentah 1 sebanyak 159.244 dan 0 sebanyak 820. Ada 821 nilai TLD kosong dan 135 URL duplikat setelah normalisasi. Tahan pemakaian berlabel sampai asal dan makna label terverifikasi. |
| `phiusiil+phishing+url+dataset.zip` | CSV 235.795 baris. UCI mendefinisikan 1 legitimate (134.850) dan 0 phishing (100.945). Ada 1.107 URL duplikat setelah normalisasi. Kandidat evaluasi URL offline setelah dedup dan split. [UCI PhiUSIIL](https://archive.ics.uci.edu/dataset/967/phiusiil%2Bphishing%2Burl%2Bwebsite%2Bdataset) |
| `verified_online.csv.gz` | 46.779 baris, semuanya `verified=yes` dan `online=yes` di snapshot. Ada 145 URL duplikat. Cocok sebagai sumber positif historis. Nama dan format cocok dengan feed PhishTank, tetapi asal file dan tanggal unduh belum diverifikasi. [Skema resmi PhishTank](https://www.phishtank.org/developer_info.php) |
| `tranco_Y895G-1m.csv.zip` | 1.000.000 baris ranking/domain tanpa header. Sumber popularitas kandidat. ID snapshot belum diverifikasi dan ranking tidak memberi label keamanan. |
| `phishing+websites.zip` | 11.055 baris ARFF utama dan 2.456 pada `.old.arff`. Distribusi utama 6.157 nilai 1 dan 4.898 nilai −1. Ada 5.206 pengulangan vektor baris utuh pada tabel utama. Fitur tabular saja, tanpa URL per baris. [UCI Phishing Websites](https://archive.ics.uci.edu/dataset/327/phishing%2Bwebsites) |
| `Phishing dataset.zip` | 7.062 entri PNG screenshot website dan dua XLSX. Path menyatakan train 4.487, test 1.326, dan val 1.249, dibagi kelas folder legitimate/phishing. Ke-24 sampel lolos pemeriksaan signature PNG. Metadata arsip mengindikasikan 70 kandidat ukuran/CRC yang sama lintas split. XLSX dan sisa payload media belum diperiksa. Provenance dan lisensi belum terverifikasi. |
| `dataset_sms_spam_v1.csv` | 1.143 baris Indonesia. Pendamping arsip menetapkan 0 normal (569), 1 penipuan (335), 2 promosi (239). Satu duplikat baris. |
| `FraudSense-main.zip` | 1.143 SMS (574 spam, 569 ham) dan 2.636 email (1.368 spam, 1.268 ham). SMS berulang satu kali, email 16 kali. Kode dan model serialisasi tidak dijalankan. |
| `phishing_email_multilingual.csv` | 600 baris, label mentah 0/1 seimbang 300/300, 279 `id` dan 321 `en`. Ada 209 pengulangan teks setelah normalisasi. Semantik label belum diverifikasi. |
| `train.jsonl` | 69.286 baris. `is_scam` mentah 0=44.221, 1=25.065. Bahasa tercatat English 61.058, Hindi 5.436, Hinglish 2.792. Sumber mendeklarasikan 3.720 baris `Synthetic_Tier_C`. Ada 49 pengulangan teks setelah normalisasi. Asal campuran, perizinan, dan split perlu ditinjau. |
| `indonesia-sms-spam-dataset-main.zip` | 50 entri teks berlabel berdasarkan folder, termasuk 26 loan dan 1 evil-service. Satu pengulangan konten setelah normalisasi. Lisensi CC0 tercantum di arsip. |
| `Sentiment-Analysis-on-Indonesian-SMS-Dataset-main.zip` | CSV 1.143 baris identik byte demi byte dengan SMS lepas. Dokumen pendamping menjelaskan label dan atribusi. Pertahankan satu salinan logis untuk evaluasi. |
| `quishing-scanner-empirical-study-dataset-main.zip` | Lima CSV berjumlah 1.001 baris lokal, 852 phishing dan 149 safe menurut label studi. Repo penerbit menyebut 1.000, terdiri dari 850/150. Perbedaan perlu direkonsiliasi. Ada satu XLSX hasil scanner, tanpa gambar QR. Hasil scanner dipisahkan dari label studi. [Repo studi QR](https://github.com/Hyphen-14/quishing-scanner-empirical-study-dataset) |
| `genimage_metadata.csv` | 2.681.150 baris metadata dan 1.000 nilai numerik berbeda pada `class`. Tidak ada file gambar yang cocok. `class` dipertahankan sebagai kategori mentah. Hitungan duplikat baris dan ID adalah batas bawah karena batas memori kunci tercapai. |
| `data.csv` | 1.289 ID gambar, label mentah 589 real dan 700 fake. Pencocokan nama dengan file gambar lepas menghasilkan nol. Dataset belum siap untuk evaluasi media. |

`prompt-image_bank.csv`, arsip FaceForensics/DeepfakeBench, file video evaluasi, dan contoh berkas unrelated yang disebut di spesifikasi tidak ditemukan.

## 5. Organisasi dan keamanan ingest

Audit menggunakan `datasets/audit.py` dan menghasilkan `datasets/manifests/phase10a.json`. Manifest menyimpan ukuran, SHA-256, lokasi logis, sumber, lisensi, schema, distribusi, kehilangan nilai, duplikat, keberadaan media, serta kesiapan per sumber. Nilai mentah seperti isi pesan, URL sampel, nama gambar per baris, dan hash per rekaman tidak ditulis. Workbook dan notebook tetap tercatat sebagai entri arsip tanpa dibuka.

ZIP diperiksa sebelum streaming tabel. Pemeriksaan mencakup path traversal, path absolut/Windows reserved, collision nama, symlink, entri khusus, enkripsi, rasio kompresi, batas 10.000 entri dan 2 GiB total ukuran ekspansi. CSV/GZIP/JSONL/ARFF dibaca streaming dengan batas record, byte, baris, dan jumlah kunci dedup. Statistik bertanda `lower_bound` ketika batas kunci tercapai. Berkas arsip tidak diekstrak. Tidak ada dataset turunan yang berisi data mentah.

`.gitignore` melindungi `dataset/`, `datasets/raw/`, `datasets/processed/`, dan `datasets/evaluation/`. Utilitas, tes, dan manifest tetap bisa ditinjau di Git.

Reproduksi dari root repo:

```powershell
.\backend\.venv\Scripts\python.exe datasets/audit.py "C:/Users/User/Downloads/dataset" datasets/manifests/phase10a.json
```

## 6. Label, duplikat, dan kebocoran antar-split

- `phishing_features.csv` beririsan dengan PhishTank pada 30.240 kunci URL normalisasi dan semuanya berlabel 1 di file tersebut. Pada irisan dengan PhiUSIIL, 2.197 kunci berpasangan (1, phishing) dan tiga berpasangan (1, legitimate). Ini bukti ketidakcocokan antar-sumber, sehingga label mentah dipertahankan dan file ditahan dari evaluasi berlabel.
- PhiUSIIL dan snapshot PhishTank berbagi 1.990 kunci URL. Untuk split URL, keluarkan duplikat lintas sumber, kelompokkan menurut registered domain, dan gunakan waktu/snapshot bila tersedia. Simpan kategori unknown untuk label tanpa bukti.
- SMS lepas, salinan arsip Sentiment, dan SMS FraudSense berbagi 1.142 kunci teks unik. FraudSense memakai spam/ham dan tidak bisa langsung digabung dengan kelas penipuan/promosi. Kelompokkan split pesan menurut teks normalisasi, bahasa, dan sumber. Pertahankan data sintetis terpisah.
- Kunci normalisasi hanya dipakai untuk audit duplikat. URL mempertahankan path/query, menghapus fragmen, dan menormalkan hostname serta default port. Teks memakai NFC, case folding, dan normalisasi whitespace. Untuk screenshot, verifikasi kandidat CRC/ukuran dengan hash konten atau pemeriksaan kemiripan sebelum split baru.

## 7. Provenance, lisensi, dan kesiapan mode

PhiUSIIL dan UCI Phishing Websites terbit dengan CC BY 4.0. Arsip studi QR dan koleksi SMS kecil menyertakan CC0 1.0. Lisensi sumber lain dicatat sebagai `unknown` kecuali ada bukti yang dapat ditelusuri. Statistik atau label dari suatu file tidak memberi izin untuk mendistribusikan ulang isinya.

| Mode | Kesiapan data |
| --- | --- |
| Link & Website | PhiUSIIL tersedia untuk persiapan evaluasi URL offline. Snapshot PhishTank bisa dipertimbangkan sebagai bukti positif historis. Impersonasi merek perlu bukti domain resmi dan data terpisah. |
| Message | Kandidat Indonesia dan multilingual tersedia. Perlu privasi, dedup, bahasa, dan definisi label per sumber. |
| QR Code | Data URL tersedia. Gambar QR sintetis dapat dibuat nanti dari fixture inert. Evaluasi scanner dan label studi perlu direkonsiliasi. |
| AI Image | Metadata tersedia. File gambar berlabel autentisitas dan izin pakai masih diperlukan pada 10E. |
| AI Video | Video berlabel dan izin pakai belum tersedia untuk 10F. |

## 8. Migrasi cakupan produk

Empat fitur utama adalah **Link & Website Inspector**, **Message Analyzer**, **QR Code Security Scanner**, dan **AI Media Authenticity Analyzer**. Landing dan dashboard memakai workspace dengan lima tab **Link & Website**, **Pesan**, **QR Code**, **AI Image**, dan **AI Video**. Label login dan opsi Feedback mengikuti nama baru.

`/scan/website` dan `?mode=website` masih membuka tab gabungan. URL HTTP(S) dikirim sebagai `link`, sementara domain tanpa skema dikirim melalui kontrak `website` yang sudah mendukung domain. Klien lama tetap menerima mode yang diminta. History masih mengenali kedua nilai historis. Konten CMS dan migrasi lama tidak diubah.

## 9. Shared URL Foundation

`backend/app/modules/analysis/url.py` mengembalikan URL normalisasi, skema, hostname IDNA, port eksplisit, path, query, registered domain, dan status literal IP. Public Suffix List bawaan dipakai offline dan digunakan kembali oleh Admin. `link` dan `website` mendispatch ke adapter bersama. Payload URL pada QR menggunakan parser yang sama. Adapter lama dengan key `website` masih dapat dipakai ketika key `link` belum terdaftar.

Kontrak untuk threat intelligence, reputasi domain, dan impersonation memakai tipe `Evidence` Phase 9. Belum ada implementasi provider. Parser menolak kredensial, authority ambigu, skema lain, port invalid, dan IP nonpublik menurut kebijakan yang ada. Tidak ada DNS lookup, fetch, crawling, redirect, kunjungan URL dataset, atau penilaian risiko baru. Hostname yang berhasil diurai masih memerlukan kontrol DNS/egress terisolasi sebelum suatu worker boleh mengaksesnya.

## 10. Pengujian

| Pemeriksaan | Hasil |
| --- | --- |
| Audit dataset, `pytest datasets/test_audit.py` | 15 lulus, 0 gagal/skipped. Run awal terkendala direktori temporer pytest Windows. Run final memakai direktori sementara di area processed yang diabaikan Git. |
| Backend URL, analisis, dan Admin | 98 lulus, 0 gagal/skipped. Satu warning deprecation Starlette TestClient. |
| Frontend workspace, dashboard, QR dan History API | 62 lulus di empat file, 0 gagal/skipped. |
| `npm run check:routes` | Lulus 24 route, termasuk alias lama `/scan/website`, jumlah tab di landing/dashboard, dan validasi form. |
| `npm run lint`, `npm run build` | Lulus. Peringatan ukuran chunk utama masih ada. |
| Audit data aktual | 15 sumber terinventaris. 24 dari 24 sampel signature PNG valid. Tidak ada pengujian browser manual baru pada checkpoint ini. |

## 11. Prasyarat Phase 10B

Gunakan kandidat URL berprovenance, dedup lintas snapshot, dan split domain/waktu. Konfirmasi pemetaan `phishing_features.csv` sebelum memasukkannya ke benchmark. Analisis URL dan domain tidak menghasilkan bukti impersonation tanpa referensi organisasi yang sesuai. Validasi ketentuan provider sebelum integrasi dan siapkan isolasi khusus jika nantinya perlu inspeksi aktif.

## 12. Status checkpoint

| Checkpoint | Status |
| --- | --- |
| 10A | **PASS WITH LIMITATIONS** |
| 10B | **PASS WITH LIMITATIONS** |
| 10C | PENDING |
| 10D | PENDING |
| 10E | PENDING |
| 10F | PENDING |
| 10G | PENDING |

**Kesiapan 10B: READY WITH LIMITATIONS.** Fondasi teknis siap untuk implementasi lokal. Data URL siap dipersiapkan untuk evaluasi terbatas dengan batas provenance dan split di atas. Tidak ada commit, push, deploy, upload dataset, atau operasi Supabase cloud.

## Phase 10B — Link & Website Inspector

Branch awal `main`, HEAD `eeaecbd`. Working tree sudah memuat perubahan Phase 10A dan manifest sebelum 10B. Perubahan tersebut dipertahankan. Status 10B **PASS WITH LIMITATIONS** dan kesiapan 10C **READY WITH LIMITATIONS**.

### Backend, bukti, dan keamanan

`UrlInspector` memakai parser bersama 10A, kontrak `Evidence`, dan orchestrator Phase 9. Kedua mode historis `link` dan `website` memakai pemeriksaan yang sama. Untuk domain tanpa skema, backend menandai HTTPS sebagai asumsi. Hasil hanya memantulkan authority dan domain terdaftar, serta menandai path dan kueri yang disembunyikan. Fragmen dibuang saat parsing. Hasil tetap `no-store` dan `history_eligible: false`.

| Pemeriksaan | Bukti dan batas |
| --- | --- |
| Struktur URL | Kedalaman subdomain, literal IP publik, port nonstandar, URL panjang, komponen tersandi/simbol @, path terkait akun, dan parameter dengan tujuan redirect. Masing-masing dicatat sebagai observasi dengan keterbatasan. Embedded credentials ditolak sebelum inspeksi. |
| Identitas | Perbandingan batas hostname dan registered domain, subdomain yang mengandung referensi resmi, penyisipan nama, kemiripan satu edit untuk nama panjang, dan tabel kecil karakter confusable. Referensi lokal saat ini mencakup BCA dan Bank Indonesia. [BCA](https://www.bca.co.id/id/individu), [Bank Indonesia](https://www.bi.go.id/id/default.aspx) |
| Agregasi | Kecocokan provider menghasilkan risiko tinggi. Subdomain menyesatkan atau confusable yang cocok dengan referensi lokal menghasilkan indikasi sedang. Ciri lemah tetap berisiko unknown. Tanpa bukti yang cukup, hasil inconclusive. Tidak ada skor numerik atau hasil rendah hanya karena tidak ditemukan kecocokan. |
| Kontradiksi | Host di bawah domain resmi tetap dapat cocok dengan daftar ancaman. Kecocokan organisasi tidak membatalkan bukti provider. |

Verified Domain Registry Admin tetap privat. Implementasi lokal memakai dua referensi publik yang ditelusuri ke situs resmi, tanpa membaca atau menyinkronkan registry Supabase. Kemiripan nama tidak menentukan pemilik situs. Tidak ada fetch ke tujuan, DNS/RDAP, redirect otomatis, crawling, atau pembacaan konten halaman. Pemeriksaan lokal tidak mengurangi batas authority, IDNA, port, dan IP nonpublik dari 10A. Pembukaan halaman atau inspeksi aktif akan memerlukan worker terisolasi tersendiri.

### Google Web Risk pada implementasi awal 10B

Adapter Lookup dipilih dan **dinonaktifkan pada checkpoint ini**. Aktivasi membutuhkan persetujuan kebijakan, proyek berizin, dan API key server. Tes memakai `httpx.MockTransport`. Verifikasi live belum dilakukan. Adapter membedakan kecocokan, tidak ada kecocokan, tidak diminta, URL tidak didukung, timeout, rate limit, respons invalid, dan tidak tersedia. Pemeriksaan lokal tetap berjalan ketika provider tidak memberi hasil.

Lookup hanya dapat berlangsung jika konfigurasi diaktifkan dan pengguna menyetujui pengiriman per permintaan. Input dengan kueri, IP literal, skema yang diasumsikan, atau tanpa registered domain tidak dikirim. URL yang memenuhi syarat hanya dikirim ke endpoint Google yang tetap, dengan redirect dan proxy dari environment dinonaktifkan. Satu panggilan memiliki anggaran dua detik dan respons maksimal 16 KiB. Cache dalam proses menyimpan kecocokan positif menggunakan kunci HMAC dan menghormati expiry provider. Fallback lokal tidak menyimpan URL. [Lookup API](https://docs.cloud.google.com/web-risk/docs/lookup-api), [Cache](https://docs.cloud.google.com/web-risk/docs/caching)

Dokumentasi Google mencantumkan kategori social engineering, malware, dan unwanted software yang diperiksa adapter, serta kuota per proyek. Harga publik memuat tingkat penggunaan gratis dan biaya jika terlampaui. Ini belum diverifikasi terhadap proyek AWASIN. Lookup mengirim URL ke Google. Retensi yang berlaku pada proyek, persetujuan kebijakan, pembatasan pengeluaran, dan kuota abuse perlu dikonfirmasi sebelum mengaktifkan konfigurasi. [Daftar ancaman](https://docs.cloud.google.com/web-risk/docs/lists), [Kuota](https://docs.cloud.google.com/web-risk/quotas), [Harga](https://cloud.google.com/web-risk/pricing), [Ketentuan layanan](https://cloud.google.com/terms/service-terms)

### Pengalaman pengguna

Form Link & Website tetap menjadi satu tab dan menerima URL atau hostname. Permintaan yang sedang berjalan dibatalkan saat input berubah. UI merender ringkasan, status risiko, indikator URL, keadaan Google Web Risk, identitas domain, rincian sumber, tindakan yang disarankan, dan batas pemeriksaan. Pemberitahuan hasil dan error menggunakan status aksesibel yang sudah ada. Opsi pengiriman eksternal perlu dipilih untuk input saat ini. Alamat pengguna ditampilkan sebagai teks. Halaman landing, dashboard, dan alias `/scan/website` memakai komponen workspace yang sama.

### Evaluasi offline

`datasets/evaluate_url_inspector.py` memverifikasi SHA-256 arsip PhiUSIIL terhadap manifest 10A. Seed tetap `awasin-10b-v1`. Sampel memilih kelompok domain ketika byte pertama hash SHA-256 dari seed dan registered domain lebih kecil dari 13. URL dinormalisasi dan didedup dalam sampel. Kunci yang memiliki dua label dikeluarkan. URL yang ditolak parser produksi dilaporkan terpisah. Tidak ada training, temporal split, lookup provider, atau kunjungan URL. PhiUSIIL memakai 0 untuk phishing dan 1 untuk legitimate. [PhiUSIIL UCI](https://archive.ics.uci.edu/dataset/967/phiusiil%2Bphishing%2Burl%2Bwebsite%2Bdataset)

```powershell
$env:PYTHONPATH='backend'
.\backend\.venv\Scripts\python.exe datasets/evaluate_url_inspector.py 'C:/Users/User/Downloads/dataset/phiusiil+phishing+url+dataset.zip'
```

Metrik indikator memakai sinyal yang benar-benar dirender sebagai hasil partial atau risiko sedang sebagai flag. Ketiadaan flag hanya menjadi kelas pembanding untuk menghitung confusion matrix. Risiko unknown dihitung terpisah dan tidak diberi kredit sebagai keputusan benar. Dataset historis ini belum menunjukkan akurasi pada URL Indonesia atau cakupan ancaman terkini.

Dari 235.795 baris sumber, parser menolak 19 sebelum sampling. Evaluasi mencakup **12.145 URL** dari **10.104 kelompok domain**, dengan 5.286 phishing dan 6.859 legitimate. Ada 64 baris duplikat pada kelompok terpilih, tanpa konflik label setelah normalisasi.

| Metrik flag indikator | Hasil |
| --- | ---: |
| TP / FP / TN / FN | 547 / 4 / 6.855 / 4.739 |
| Akurasi indikator | 60,95% |
| Balanced accuracy | 55,14% |
| Precision | 99,27% |
| Recall | 10,35% |
| F1 | 18,74% |
| False positive / false negative rate | 0,06% / 89,65% |
| Risiko unknown / cakupan pemberian level risiko | 100% / 0% |

Engine menghasilkan 551 `partial/unknown` dan 11.594 `inconclusive/unknown`. Tidak ada panggilan provider. Precision flag yang tinggi berlaku pada sampel ini, dengan recall rendah. Hasil tersebut tidak mendukung pemakaian indikator lokal sebagai detektor phishing mandiri.

### Verifikasi dan batas 10C

| Pemeriksaan 10B | Hasil |
| --- | --- |
| Backend URL, analisis, fondasi, dan History | 122 lulus. Satu warning deprecation Starlette TestClient. |
| Frontend | 262 lulus di 22 file. Lint dan build lulus. Warning chunk utama masih ada, 799,78 kB. |
| Rute dan History lokal | Pemeriksaan 24 rute dan PGlite History lulus. |
| Fixture evaluasi sintetis | 1 lulus untuk sampling, konflik label, dedup, confusion matrix, dan pelaporan unknown. |

Computer Use menguji browser tamu melalui server loopback dengan Supabase dan Google Web Risk dinonaktifkan. Alias lama menampilkan lima tab dan bukti risiko sedang untuk domain sintetis yang menyerupai referensi. Hostname tanpa skema menampilkan asumsi HTTPS dan risiko unknown. URL loopback ditolak. Dari landing, path terkait login menampilkan indikator struktur. Lebar 393 px tidak menghasilkan gulir horizontal pada hasil uji. Perilaku sesi pengguna diuji dengan fixture. Login cloud aktual belum diuji pada checkpoint ini.

Backend mempertahankan empat slot analisis per proses dan timeout orchestrator lima detik. Jalur lokal tidak memuat dataset saat request dan tidak bergantung jaringan. Latensi provider live dan beban produksi belum diukur.

Untuk 10C, gunakan parser dan `UrlInspector.inspect` dari pipeline QR dengan payload lokal sintetis. Perluas tes agar decode tetap lokal sebelum aksi pemeriksaan. Aktivasi provider, perluasan referensi resmi, isolasi inspeksi konten, dan penyimpanan History menunggu pekerjaan terkait. 10C–10G tetap PENDING.

Tidak ada commit, push, deployment, migrasi, perubahan Supabase cloud, atau upload dataset.

### Integrasi Google Safe Browsing v5

FastAPI memakai Google Safe Browsing ketika `GOOGLE_SAFE_BROWSING_API_KEY` atau nama konfigurasi lokal sebelumnya tersedia. Key dibaca sebagai secret backend dari `backend/.env` yang diabaikan Git. Integrasi ini menggunakan endpoint tetap `GET /v5/hashes:search` dan mengirim key melalui header `x-goog-api-key`. AWASIN mengirim awalan SHA-256 empat byte dari ekspresi host dan path. Kecocokan baru dilaporkan setelah hash lengkap sesuai. AWASIN tidak mengunjungi URL tujuan. [API v5](https://developers.google.com/safe-browsing/reference/rest/v5/hashes/search) · [Aturan hashing URL](https://developers.google.com/safe-browsing/reference/URLs.and.Hashing) · [Panduan API key](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices)

Uji live menemukan bahwa Google mengembalikan `application/x-protobuf` untuk permintaan berhasil. Adapter membaca bentuk biner berdasarkan skema resmi dan juga menerima bentuk JSON. Timeout dua detik, rate limit, kegagalan transport, dan respons invalid tampil sebagai status berbeda. Cache dalam proses menyimpan hasil per awalan hash sesuai durasi dari Google. Bukti ancaman dibatasi paling lama 30 menit. Kategori dan atribut yang tidak didukung diabaikan. [Skema Protobuf v5](https://raw.githubusercontent.com/googleapis/googleapis/master/google/security/safebrowsing/v5/safebrowsing.proto) · [Ketentuan Safe Browsing](https://developers.google.com/safe-browsing/terms)

Bagian Intelijen Ancaman menampilkan nama provider, waktu pemeriksaan, kategori ancaman bila ditemukan, dan batas akurasi. Pada hasil tanpa kecocokan, UI menampilkan “Tidak ditemukan dalam daftar ancaman yang diperiksa”. Pemeriksaan eksternal memerlukan persetujuan per permintaan. Input dengan kueri, literal IP, skema yang diasumsikan, atau tanpa registered domain tetap diperiksa secara lokal. Google Safe Browsing digunakan untuk penggunaan nonkomersial. [Ketentuan penggunaan](https://developers.google.com/safe-browsing/reference/Appropriate.Usage)

| Verifikasi integrasi v5 | Hasil |
| --- | --- |
| Provider live lewat FastAPI | `https://example.com` memberi HTTP 200, `no_match`, waktu pemeriksaan terisi, dan risiko `unknown`. Tanpa persetujuan, status `not_requested`. |
| Browser localhost | Form dengan opsi pemeriksaan dicentang menampilkan hasil Google dan risiko belum diketahui. |
| Backend | 120 tes lulus. Mock mencakup kecocokan, benturan awalan, Protobuf, hasil kosong, timeout, 429, redirect, 503, dan respons invalid. |
| Frontend | 37 tes lulus. Lint dan build lulus dengan peringatan ukuran chunk. |
| Kerahasiaan key | Key tidak ditemukan dalam respons FastAPI, berkas sumber, hasil build, atau log lokal yang diperiksa. Pemeriksaan mencakup 314 berkas. |

Koneksi live terverifikasi untuk satu URL publik tanpa kecocokan. Kecocokan ancaman diverifikasi menggunakan mock. Status 10B tetap **PASS WITH LIMITATIONS** karena cakupan indikator lokal dan cakupan daftar ancaman tetap terbatas. Tahap 10C belum dimulai. Billing, Supabase Cloud, dan deployment tidak diubah.

### Integrasi multi-provider dan hardening akhir 10B

**Keputusan: PASS WITH LIMITATIONS.** FastAPI tetap memakai satu URL Inspector untuk mode `link` dan `website`. Form menambahkan persetujuan opsional yang terpisah dari Google, mati secara default, dan direset saat alamat berubah. Panel hasil menampilkan status per sumber, tanggal, cakupan kecocokan, usia arsip, kategori dan jumlah deteksi yang tersedia, serta informasi DNS, RDAP, dan identitas. Ringkasan tanpa indikasi menjelaskan bahwa hasil pemeriksaan tidak menjamin keamanan.

| Sumber | Integrasi dan batas |
| --- | --- |
| Google Safe Browsing v5 | Pencarian awalan hash dengan persetujuan Google, konfirmasi hash lengkap, dan kategori resmi. Kuota, timeout, hasil tanpa kecocokan, dan kegagalan tersedia sebagai status terpisah. [Referensi v5](https://developers.google.com/safe-browsing/reference/rest/v5/hashes/search) |
| VirusTotal | `GET /api/v3/urls/{id}` memakai ID Base64 URL-safe. Pencarian hanya untuk beranda domain terdaftar dengan HTTP/HTTPS eksplisit, tanpa subdomain, port eksplisit, path tambahan, atau kueri. Key diambil dari `VIRUSTOTAL_API_KEY`. API publik ditujukan untuk penggunaan nonkomersial atau akademik. Batas lokal per proses 4 permintaan/menit dan 500/hari. [URL reports](https://docs.virustotal.com/reference/url) · [Objek URL](https://docs.virustotal.com/reference/url-object) · [Ketentuan penggunaan API publik](https://docs.virustotal.com/docs/difference-public-private) |
| urlscan.io | `GET /api/v1/search` menerima domain terdaftar, maksimal 10 arsip publik. Peringkat pencocokan dihitung lokal dari URL awal pada arsip, dengan urutan URL yang sama, hostname yang sama, dan domain terkait. Verdict ditampilkan jika tersedia. Key diambil dari `URLSCAN_API_KEY`. Batas lokal per proses 6 permintaan/menit dan 500/hari. [Search API](https://docs.urlscan.io/apis/urlscan-openapi/search) · [Kuota](https://docs.urlscan.io/pages/api-rate-limits) · [Ketentuan](https://urlscan.io/terms/) |
| DNS | A dan AAAA melalui Google DoH, termasuk CNAME publik yang dikembalikan. Alamat nonpublik disembunyikan. Pemeriksaan arsip dilewati bila DNS gagal, tidak lengkap, atau mengembalikan alamat nonpublik. Pemeriksaan menggunakan domain terdaftar dan tidak membuktikan resolusi pada jaringan pengguna. [DNS over HTTPS](https://developers.google.com/speed/public-dns/docs/doh/json) |
| RDAP | Endpoint Verisign yang ditetapkan dari IANA untuk `.com` dan `.net`. Respons dicocokkan dengan domain yang diminta. Hanya tanggal, status, dan ID registrar yang ditampilkan jika tersedia. TLD lain dilewati. [Bootstrap IANA](https://data.iana.org/rdap/dns.json) |

Adapter tambahan memakai HTTPS ke endpoint tetap, tanpa redirect, dengan timeout 1,7 detik per permintaan dan batas respons 256 KiB. Cache per proses maksimal 256 entri per sumber dengan kunci HMAC, selama 5 menit untuk hasil ditemukan dan 2 menit untuk hasil kosong. Respons 429 dan header kuota yang didukung dapat mengaktifkan jeda. Persetujuan tambahan mengizinkan pengungkapan beranda yang memenuhi syarat ke VirusTotal dan domain terdaftar ke urlscan.io, DNS, serta RDAP. Input mentah, kueri sensitif, dan kredensial tidak disimpan di History. Backend tidak membuka alamat yang diperiksa, mengunduh konten halaman, atau mengirim scan baru.

Google match menghasilkan risiko tinggi. Arsip VirusTotal untuk URL yang sama, berusia maksimal 30 hari dan dengan dua atau lebih deteksi malicious, dapat menghasilkan risiko sedang. Bukti terverifikasi dalam aturan ini merujuk pada isi laporan yang diterima. Perbedaan hasil dengan Google dijelaskan dalam laporan. Deteksi tunggal, arsip lama, dan verdict urlscan.io tetap menjadi konteks. Arsip domain terkait tidak menentukan risiko alamat yang diperiksa. Metadata DNS/RDAP tidak menaikkan risiko. Tidak ada voting antarsumber, persentase risiko, atau asumsi independensi mesin.

Pencocokan identitas memakai public suffix, referensi resmi, Unicode confusables, perubahan satu karakter, transposisi bersebelahan, dan subdomain menyesatkan. Kemiripan ejaan tampil sebagai status tersendiri. Referensi resmi tetap dapat memiliki temuan ancaman. Verified Domain Registry yang dilindungi RLS dapat digunakan melalui salinan lokal tepercaya yang dibatasi ukuran dan hanya membaca baris `verified` dengan `organization_name`, `domain`, `alias`, `evidence_url`, dan `verified_at`. Opsi `VERIFIED_DOMAIN_SNAPSHOT` diuji dengan fixture. Uji live memakai referensi bawaan karena salinan Registry belum dikonfigurasi. Integrasi ini tidak membaca Registry langsung dari Supabase.

#### Bukti live dan regresi

Smoke test FastAPI dan browser lokal menggunakan `https://example.com` pada 11 November 2026 dengan kedua persetujuan. Respons API HTTP 200, hasil akhir `inconclusive/unknown`.

| Pemeriksaan | Hasil aktual |
| --- | --- |
| Google Safe Browsing v5 | `no_match`. |
| VirusTotal | Arsip URL yang sama ditemukan, `no_detection`, tanggal laporan 11 November 2026 15:45 UTC. |
| urlscan.io | Arsip publik URL yang sama ditemukan, tanggal 11 November 2026 11:54 UTC. Respons pencarian tidak menyertakan verdict. |
| DNS dan RDAP | DNS mengembalikan empat hasil alamat publik. RDAP mengembalikan enam butir metadata publik. |
| Backend | 114 tes terarah lulus. Cakupan meliputi kontrak API, persetujuan, privasi, status provider, timeout, cache, bukti historis, konflik, RDAP, dan referensi domain. Deteksi ancaman, 429, dan kegagalan terisolasi diuji dengan mock. |
| Frontend | 40 tes terarah lulus. Pemeriksaan rute, termasuk `/scan/website`, dan lint lulus. Build lulus dengan endpoint HTTPS placeholder hanya untuk kompilasi. Build bawaan lokal memerlukan URL HTTPS saat Supabase frontend dikonfigurasi. Vite masih melaporkan peringatan ukuran chunk. |
| Browser | Form menampilkan loading dan lima sumber. Kartu tambahan tersusun satu kolom tanpa overflow di lebar efektif 375 px, dengan checkbox berlabel dan hasil tersedia pada pohon aksesibilitas. Pengujian ini bukan audit aksesibilitas penuh. |
| Kredensial | Ketiga key tidak ditemukan dalam respons FastAPI live. Pencarian nilai persis pada 315 berkas kerja Git, hasil build, dan log lokal menghasilkan nol kecocokan. `backend/.env` diabaikan Git. |

#### Evaluasi offline setelah hardening

Evaluator menjalankan ulang split domain deterministik PhiUSIIL yang sama, tanpa tuning dan tanpa panggilan provider. Evaluasi mencakup 12.145 URL unik dari 10.104 kelompok domain. Label positif adalah phishing, dan indikator positif berarti status lokal `partial` atau risiko `medium`.

| Metrik indikator lokal | Hasil |
| --- | ---: |
| True positive / false positive | 547 / 4 |
| True negative / false negative | 6.855 / 4.739 |
| Akurasi / balanced accuracy | 60,95% / 55,14% |
| Precision / recall / F1 | 99,27% / 10,35% / 18,74% |
| False positive rate / false negative rate | 0,06% / 89,65% |
| Risiko `unknown` | 100% |

Recall rendah membatasi deteksi lokal. Satu smoke test membuktikan koneksi dan parsing provider, sedangkan akurasi multi-provider dan kapasitas produksi belum diukur. Kebijakan API publik dan batas kuota akun berlaku. **Siap untuk review dan melanjutkan 10C dengan batas tersebut. 10C–10G tetap PENDING.** Tidak ada commit, push, deployment, migrasi, atau perubahan Supabase Cloud.

### Phase 10B.2 — Local ML Experiment & Benchmark

Eksperimen offline ini mengukur apakah fitur yang tersedia dari sebuah URL dapat membantu mendeteksi phishing. Baseline repo adalah `main`, HEAD `eeaecbd`, dengan perubahan 10A/10B yang sudah ada di working tree. Heuristik lama dan ketiga model diuji pada partisi final yang sama. Recall historis 10B sebesar 10,35% berasal dari sampel berbeda dan disimpan sebagai konteks.

PhiUSIIL diperiksa terhadap ukuran dan SHA-256 di manifest 10A. CSV dibaca langsung dari ZIP dengan batas ukuran dan tanpa ekstraksi. Kolom yang digunakan hanya `URL` dan `label`. UCI mendokumentasikan label mentah `0 = phishing` dan `1 = legitimate`. Di benchmark, kelas positif internal `1` berarti phishing. [UCI PhiUSIIL](https://archive.ics.uci.edu/dataset/967/phiusiil%2Bphishing%2Burl%2Bwebsite%2Bdataset)

URL diproses oleh parser AWASIN. Host tanpa suffix yang dikenali dikeluarkan, sementara literal IP publik dikelompokkan menurut alamatnya. Deduplikasi memakai host terkanonisasi, path, dan kueri, dengan fragmen, port default, dan variasi skema diperlakukan sebagai ekuivalen. Kunci yang memiliki label berbeda dikeluarkan seluruhnya. SHA-256 dengan seed `10402` menetapkan grup domain terdaftar ke target 70%/15%/15%. Batas 60.000 baris training diterapkan dengan sampling berseed dari partisi latih. Kedua partisi lain dipakai penuh.

TF-IDF memakai n-gram karakter dari URL tanpa skema, sparse float32, maksimal 50.000 fitur, dan frekuensi dokumen minimum tiga. Dua uji memakai rentang 3–5 dengan `C=1` dan 2–5 dengan `C=3`. Dua model pohon berbagi 18 fitur leksikal, termasuk panjang, entropi host, digit, subdomain, path, kueri, percent encoding, token akun, punycode, port, dan literal IP. XGBoost memakai 140 pohon dengan kombinasi kedalaman/laju 4/0,10 dan 7/0,07. Random Forest memakai 90 pohon dengan kombinasi kedalaman/leaf minimum 12/8 dan 20/5. Semua transformasi yang perlu dipelajari hanya di-fit pada training.

Untuk setiap kandidat, validation memilih ambang dari grid 0,01 sampai 1,00 dengan FPR paling tinggi 3%. Pilihan diurutkan berdasarkan F1, recall, lalu FPR, dengan opsi melewati semua deteksi bila tidak ada ambang yang layak. Konfigurasi dan ambang dikunci sebelum partisi uji dipakai. Ambang 0,5 dibandingkan di validation. Di test, eksperimen abstention terpisah menahan skor yang berjarak kurang dari 0,05 dari ambang terpilih. Brier score dan ECE dengan 10 bin mengukur perilaku skor mentah.

Snapshot lokal `verified_online.csv.gz` diverifikasi terhadap manifest 10A. Hanya label `verified=yes` yang dipakai. URL dari seluruh grup PhiUSIIL dibuang, termasuk grup yang tidak dipakai dalam sampel latih. Snapshot historis hanya memberi recall eksternal dan tidak dapat mengukur FPR, akurasi, atau kondisi situs saat ini. `phishing_features.csv`, Tranco, dan data media tidak dipakai.

#### Data dan partisi aktual

Dari 235.795 baris mentah (100.945 phishing dan 134.850 legitimate), tersisa **232.081 URL**. Dikeluarkan 19 URL tidak valid, 774 hostname dengan domain ambigu, 2.878 baris duplikat (1.818 variasi skema), dan 43 kunci berlabel konflik setelah penghapusan duplikat. Tidak ada label mentah di luar pemetaan. Grup domain tidak tumpang tindih antarsplit.

| Partisi | URL | Phishing | Legitimate | Grup domain |
| --- | ---: | ---: | ---: | ---: |
| Train penuh | 159.706 | 65.163 | 94.543 | 138.408 |
| Sampel train aktual | 60.000 | 24.526 | 35.474 | 53.546 |
| Validation | 33.541 | 13.555 | 19.986 | 29.454 |
| Test tertahan | 38.834 | 18.556 | 20.278 | 29.780 |

#### Hasil uji tertahan

| Metode | TP | FP | TN | FN | Akurasi | Balanced accuracy | Precision | Recall | F1 | FPR | FNR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Heuristik AWASIN | 1.506 | 7 | 20.271 | 17.050 | 56,08% | 54,04% | 99,54% | 8,12% | 15,01% | 0,03% | 91,88% |
| TF-IDF + Logistic Regression | 15.777 | 599 | 19.679 | 2.779 | 91,30% | 91,03% | 96,34% | 85,02% | 90,33% | 2,95% | 14,98% |
| XGBoost | 14.736 | 627 | 19.651 | 3.820 | 88,55% | 88,16% | 95,92% | 79,41% | 86,89% | 3,09% | 20,59% |
| Random Forest | 14.690 | 658 | 19.620 | 3.866 | 88,35% | 87,96% | 95,71% | 79,17% | 86,66% | 3,24% | 20,83% |

Cakupan klasifikasi biner tabel 100% untuk semua baris. Pada heuristik, cakupan ini berarti setiap URL punya nilai indikator positif atau negatif, sesuai definisi evaluasi 10B. Nilai negatif tidak menetapkan keamanan akhir.

| Model | Konfigurasi terpilih | Ambang | F1/FPR validation pada ambang terpilih | F1/FPR validation pada 0,5 |
| --- | --- | ---: | ---: | ---: |
| Logistic Regression | n-gram 2–5, `C=3` | 0,47 | 86,48% / 2,98% | 86,44% / 2,47% |
| XGBoost | Kedalaman 7, laju 0,07 | 0,46 | 81,59% / 2,81% | 81,54% / 2,25% |
| Random Forest | Kedalaman 20, minimum leaf 5 | 0,46 | 81,37% / 2,84% | 81,10% / 2,35% |

| Model | Brier | ECE (10 bin) | Cakupan abstention | F1 dan FPR pada subset terklasifikasi | Phishing tertahan |
| --- | ---: | ---: | ---: | ---: | ---: |
| Logistic Regression | 0,0691 | 0,0204 | 97,95% | 91,18% / 2,15% | 362 |
| XGBoost | 0,0905 | 0,0079 | 98,84% | 87,38% / 2,44% | 202 |
| Random Forest | 0,0940 | 0,0244 | 98,22% | 87,19% / 2,47% | 393 |

Pada konfigurasi abstention Logistic Regression, 2,05% baris menjadi inconclusive. Recall pada subset yang diberi keputusan 85,75%, atau 84,08% dari seluruh phishing bila baris tertahan dihitung sebagai belum terdeteksi. Brier dan ECE diukur pada PhiUSIIL. Kalibrasi lintas sumber belum terbukti, sehingga skor mentah tidak dapat ditampilkan sebagai persentase kepastian.

#### Generalisasi dan pola kesalahan

PhishTank menyisakan **20.647 phishing historis** dari 13.263 grup. Dari 46.779 baris, 25.739 dibuang karena grupnya ada di PhiUSIIL, 343 duplikat, 41 URL invalid, dan 9 domain ambigu. Recall eksternal untuk heuristik, Logistic Regression, XGBoost, dan Random Forest berturut-turut **4,38%, 99,09%, 98,61%, dan 98,28%**. Snapshot ini tidak memuat legitimate dan izin redistribusinya belum ditetapkan dalam manifest 10A.

Semua URL legitimate PhiUSIIL setelah pembersihan menggunakan HTTPS dan path `/`, termasuk 20.278 pada test. Seluruh 5.361 URL test dengan path selain `/` berlabel phishing. Pada kelompok ini Logistic Regression mencatat recall 99,66% dan kedua model pohon 100%. Pada URL beranda yang juga memiliki kelas legitimate, recall Logistic Regression turun ke 79,08%. Pola pengumpulan data ini memungkinkan model membedakan jenis URL meski domain latih dan uji dipisah.

Seluruh 599 false positive Logistic Regression adalah URL beranda pada subdomain. Dari 2.779 false negative, 2.761 adalah URL beranda dan 2.746 memakai subdomain. Pada uji kepekaan sintetis dengan enam hostname tetap dan tanpa mengunjungi alamatnya, model menandai 4/6 beranda, 5/6 path dokumentasi, 6/6 path login, dan 5/6 kueri terenkode. Contoh sintetis ini mengukur respons terhadap perubahan bentuk input. Angkanya tidak masuk ke metrik kelas. Belum tersedia benchmark legitimate independen yang representatif untuk login, URL berparameter, shortener, IDN, atau konteks Indonesia.

#### Sumber daya dan artefak

Eksperimen memakai Python 3.14.5 di Windows, maksimal dua thread CPU, sekitar 1.768 MiB RAM tersedia saat mulai, dan puncak working set proses **620 MiB**. Angka puncak meliputi data dan semua kandidat yang masih di memori. Latensi adalah satu URL per panggilan dengan parser dan ekstraksi fitur, 200 sampel per model, tanpa I/O provider.

| Model | Fitur | Fit konfigurasi terpilih | Ukuran joblib terkompresi | Latensi rata-rata / p95 |
| --- | ---: | ---: | ---: | ---: |
| Logistic Regression | 50.000 | 6,10 dtk | 792.402 byte | 0,52 / 0,69 ms |
| XGBoost | 18 | 0,34 dtk | 109.886 byte | 0,55 / 0,93 ms |
| Random Forest | 18 | 1,37 dtk | 2.066.206 byte | 23,76 / 24,51 ms |

Enam percobaan fit total sekitar 14,1 detik, di luar persiapan dan evaluasi. Uji pemuatan ulang Logistic Regression pada proses terpisah setelah import mengukur sekitar 209 ms termasuk verifikasi hash, dengan kenaikan RSS sekitar 17,8 MiB. Satu-satunya model yang disimpan adalah champion validation. `datasets/processed/ml_experiments/phase10b2/` diabaikan Git dan berisi `metrics.json` serta `validation-champion.joblib`. Hash artefak yang diverifikasi adalah `585910e32e5f2967e941e7790d6f845a6c1c35318ea95ee533b059db18fc76f3`. Format joblib hanya boleh dimuat dari artefak tepercaya dengan hash yang diverifikasi dari sumber terpisah.

Dari root repo, contoh reproduksi PowerShell dengan direktori hasil baru:

```powershell
.\backend\.venv\Scripts\python.exe -m pip --isolated install --only-binary=:all: --target datasets/processed/ml_experiments/deps-py314 -r datasets/requirements-ml.txt
$env:PYTHONPATH='datasets/processed/ml_experiments/deps-py314;backend'
$env:OMP_NUM_THREADS='2'
$env:OPENBLAS_NUM_THREADS='2'
$env:LOKY_MAX_CPU_COUNT='2'
$data='C:/Users/User/Downloads/dataset'
.\backend\.venv\Scripts\python.exe datasets/benchmark_phishing_ml.py (Join-Path $data 'phiusiil+phishing+url+dataset.zip') --phishtank (Join-Path $data 'verified_online.csv.gz') --output datasets/processed/ml_experiments/phase10b2-repro
```

Sembilan tes terarah lulus, mencakup loader, split dan reproduksibilitas, pembatasan data eksternal, fitur, vocabulary training-only, pemetaan kelas, metrik, abstention, dependensi, dan integritas artefak.

#### Keputusan 10B.2 dan kesiapan 10B.3

**PASS WITH LIMITATIONS.** Logistic Regression adalah kandidat terbaik untuk eksperimen berikutnya. Pada PhiUSIIL, model itu satu-satunya yang memenuhi target F1 ≥85% dan FPR ≤3% pada ambang yang dikunci. **NO MODEL DEPLOYMENT. Phase 10B.3 belum siap untuk integrasi verdict.** FPR pada URL legitimate dengan path kompleks belum terukur dan hasil kontrol menunjukkan perubahan bentuk URL dapat memengaruhi keputusan. Skor juga belum memiliki kalibrasi eksternal.

Sebelum persetujuan 10B.3, siapkan benchmark benign independen yang mencakup path akun, dokumen, kueri, IDN, dan URL Indonesia. Tetapkan ambang, batas FPR, dan uji kalibrasi sebelum membuka test baru. Kandidat dapat dimuat satu kali dari artefak tepercaya dengan versi, skema, ambang, dan hash terpin. Usulan awal adalah menjalankan inferensi sebagai bukti internal dengan versi model dan cakupan data, sementara kegagalan load, input invalid, dan timeout mengembalikan alur yang sudah ada. Perubahan verdict menunggu bukti eksternal. Tes backend perlu mencakup parity fitur, artefak rusak, timeout, abstention, konflik bukti, dan fallback. Perubahan UI baru relevan setelah bukti tersebut disetujui untuk pengguna.

Perubahan terbatas pada eksperimen offline, tes, dan laporan. Tidak ada commit, push, deployment, panggilan provider untuk dataset, atau perubahan Supabase. 10B.3 dan 10C–10G tetap PENDING.

## Phase 10B.2.1 — Independent Benign Dataset & Generalization Testing

**PASS WITH LIMITATIONS. NO MODEL DEPLOYMENT. Phase 10B.3 NOT READY.** Evaluasi membekukan Logistic Regression dari 10B.2 pada ambang 0,47. Baseline repo `main` di `eeaecbd`. Hash model cocok dengan catatan tepercaya 10B.2 sebelum deserialisasi dan kembali cocok sesudah pengujian. Dependensi terpin, vectorizer karakter 2–5, vocabulary 50.000, `C=3`, urutan kelas `[0, 1]`, dan ukuran split 159.706/33.541/38.834 diverifikasi. Model membaca URL terkanonisasi tanpa skema, dengan kelas internal 1 untuk phishing. PhiUSIIL dan PhishTank juga cocok dengan ukuran serta hash di manifest 10A.

### Pilot benign dan provenance

Pilot berisi **632 URL publik unik dari 39 halaman sumber dan 31 domain terdaftar**. Sebanyak 608 dicatat dari tautan persis pada indeks penerbit atau dari halaman pencarian penerbit yang mengembalikan katalog. Sebanyak 24 dicatat lewat pemeriksaan halaman publik secara langsung. Pengumpul memakai maksimal satu permintaan per indeks yang ditetapkan, dengan batas respons dan 55 tautan per sumber. Tautan kandidat dari indeks diverifikasi lewat atribusi penerbit dan batas hostname serta pola path. Pemeriksaan ini tidak menguji status HTTP setiap tautan atau mendeteksi kompromi halaman. Sumber yang mengembalikan redirect, penolakan, atau kegagalan dicatat dan tidak menyumbang tautan otomatis.

| Kategori | Seluruh pilot | Domain baru |
| --- | ---: | ---: |
| Dokumentasi | 458 | 161 |
| Berita | 61 | 55 |
| Produk atau katalog produk | 57 | 1 |
| Entri katalog publik | 25 | 0 |
| Pendidikan | 14 | 0 |
| Beranda, kategori kurasi | 5 | 2 |
| Repositori publik | 3 | 3 |
| Login | 2 | 1 |
| Informasi akun | 2 | 1 |
| URL berparameter, kategori kurasi | 2 | 0 |
| Path terenkode, IDN, dan pemerintah | 1 masing-masing | 1 masing-masing |

Manifest menyimpan URL publik, sumber persis, metode dan dasar label, domain, kategori, konteks Indonesia, tanggal verifikasi UTC 11 November 2026, dan catatan redistribusi. Isi halaman tidak disimpan. Contoh sumber mencakup indeks dokumentasi, repositori penerbit, halaman login publik, dan artikel dengan path terenkode. [Python](https://docs.python.org/3/contents.html) · [NumPy](https://numpy.org/doc/stable/reference/index.html) · [GitHub CPython](https://github.com/python/cpython) · [SATUSEHAT](https://satusehat.kemkes.go.id/platform/login) · [ITB](https://itb.ac.id/berita) · [IKEA Indonesia](https://www.ikea.co.id/in/produk) · [Köln, Wikipedia Indonesia](https://id.wikipedia.org/wiki/K%C3%B6ln)

Audit overlap membandingkan domain dengan keseluruhan PhiUSIIL yang dapat dikelompokkan dan kunci URL dengan data bersih. Satu URL sama atau varian skema dikeluarkan dari hasil utama. Sebanyak 404 URL dengan domain yang pernah muncul dilaporkan terpisah. Di subset 227 URL pada domain baru, empat URL berbagi template path dengan PhiUSIIL setelah penyamaan ID numerik dan nama parameter kueri. Template lintas domain itu dilaporkan sebagai kemiripan struktur. FPR per domain dengan bobot sama adalah 80,46%, sehingga hasil buruk tetap terlihat ketika pengaruh domain dengan banyak URL dikurangi.

### Tiga pengukuran terpisah

| Dataset dan cakupan | N | Ditandai | Tidak ditandai | Ukuran utama |
| --- | ---: | ---: | ---: | --- |
| PhiUSIIL test historis | 38.834 | 16.376 | 22.458 | Recall 85,02%, FPR 2,95%, F1 90,33% |
| Benign pilot, 14 domain baru dari 19 sumber | 227 | 211 | 16 | **FPR 92,95%** |
| Benign pilot, 16 domain yang pernah muncul | 404 | 370 | 34 | FPR 91,58% |
| Benign pilot, URL sama atau varian skema | 1 | 0 | 1 | Dikeluarkan dari hasil utama |
| PhishTank historis, positive-only | 20.647 | 20.459 | 188 | **Recall 99,09%** |

Pada domain baru, model salah menandai 209/224 URL dengan path selain `/`, 156/161 dokumentasi, 46/55 berita, 3/3 repositori publik, dan 1/1 login. Di seluruh pilot terdapat 20 contoh berkonteks Indonesia. Tiga berada pada domain baru dan ketiganya ditandai. Jumlah tersebut terlalu kecil untuk mengukur FPR populasi Indonesia. Median skor mentah benign domain baru 0,866, dengan p05/p95 0,428/0,988. Pada lima kontribusi positif teratas per false positive, 561 dari 1.055 kontribusi pada domain baru berasal dari n-gram yang mengandung garis miring. Ini mendeskripsikan kontribusi model dan konsisten dengan bias path pada data latih.

PhishTank memakai penyaringan yang sama seperti 10B.2 dan mengecualikan 25.739 baris dari grup yang ada di PhiUSIIL. Cakupan skoring 100%. Dari 188 phishing yang terlewat, 126 memakai path `/` dan 163 memiliki panjang URL tanpa skema paling banyak 35 karakter. Angka recall ini berlaku pada snapshot positif historis yang sama, sehingga pengulangan ini memverifikasi model beku pada sumber tersebut. F1 independen gabungan belum dapat ditetapkan. Pilot benign didominasi dokumentasi dan kedua sumber memiliki cara pemilihan berbeda.

Semua 26 kasus sintetis ditandai, termasuk tiga beranda reservasi, variasi dokumentasi, login, akun, percent encoding, kueri, path panjang, subdomain, dan pasangan Unicode/punycode. Pasangan Unicode/punycode menghasilkan input dan skor identik setelah normalisasi. Kasus sintetis disimpan terpisah dari metrik benign.

### Reproduksi, verifikasi, dan keputusan

Evaluasi CPU memakan 24,95 detik dengan puncak working set sekitar 328 MiB. Tiga artefak eksperimen berukuran sekitar 404 KiB total. Artefak mencakup `curated.json`, `benign-manifest.json`, dan `metrics.json` pada `datasets/processed/ml_experiments/phase10b21/`. Manifest ber-hash `22fe7fb1d9d5913005f8fd74193de0195ffe53974696e26a6fe779e4641876a8`. Gunakan manifest beku untuk reproduksi. Mengambil ulang indeks dapat mengubah daftar tautan publik.

Sebanyak 15 tes terkait lulus, termasuk provenance, overlap dan template, penguncian ambang, penolakan hash yang salah sebelum deserialisasi, pemisahan sintetis, parity Unicode/punycode, dan regresi utilitas dataset 10B.2.

```powershell
$env:PYTHONPATH='datasets/processed/ml_experiments/deps-py314;backend'
$env:OMP_NUM_THREADS='2'
$env:OPENBLAS_NUM_THREADS='2'
$data='C:/Users/User/Downloads/dataset'
$run='datasets/processed/ml_experiments/phase10b21'
.\backend\.venv\Scripts\python.exe datasets/benchmark_phishing_generalization.py evaluate (Join-Path $data 'phiusiil+phishing+url+dataset.zip') (Join-Path $data 'verified_online.csv.gz') datasets/processed/ml_experiments/phase10b2 "$run/benign-manifest.json" "$run/metrics-repro.json"
```

Pilot menunjukkan FPR terlalu tinggi untuk verdict. Retraining tidak dijalankan karena checkpoint ini belum memiliki kumpulan benign kompleks yang terpisah dan memadai untuk pengembangan serta validasi akhir. Gunakan pilot ini sebagai bukti diagnostik. Eksperimen berikutnya memerlukan data pengembangan dan test baru yang dibekukan sebelum tuning, dengan cukup domain Indonesia, login, dan URL berparameter untuk mengukur FPR per kategori. Frontend, hasil analisis live, dan model champion tetap seperti semula. Tidak ada commit, push, deployment, panggilan provider reputasi, atau perubahan Supabase. 10B.3 dan 10C–10G tetap PENDING.

## Phase 10B-C1 — Repository Audit & Safe Cleanup

**PASS · 12 November 2026 WIB.** Baseline Git `main` pada `eeaecbd`. Working tree sudah berisi perubahan 10A/10B, termasuk perubahan frontend dan backend, utilitas dataset yang belum dilacak Git, dan laporan ini. Perubahan C1 pada berkas proyek terbatas pada `.gitignore` dan bagian laporan ini.

Arsitektur yang disetujui mengikuti urutan validasi dan normalisasi URL, algoritme internal bersama security intelligence, penggabungan bukti, lalu verdict deterministik. Tahap berikutnya menambahkan satu Gemini Security Analyst untuk menjelaskan bukti yang sudah diminimalkan. Validator deterministik memeriksa referensi bukti dan klaim sebelum penjelasan masuk ke Smart Report. Verdict berasal dari Evidence Fusion. Jika penjelasan AI gagal validasi, hasil deterministik tetap dapat ditampilkan. Gemini dan validator berstatus rencana C3/C4. C1 menetapkan **NO LOCAL ML MODEL DEPLOYMENT** untuk Logistic Regression, XGBoost, dan Random Forest. Keputusan didukung oleh FPR 92,95% pada pilot domain baru, termasuk 209/224 URL legitimate dengan path selain `/` yang salah ditandai.

### Inventaris

| Kelompok dan lokasi | Referensi, ukuran, dan status Git | Keputusan dan pemulihan |
| --- | --- | --- |
| A · `backend/app/`, `frontend/src/`, `frontend/public/` | FastAPI, rute, UI, dan aset aktif. Masing-masing 133.023, 431.385, dan 58.810.771 byte, tanpa bytecode. Berkas produksi mencakup berkas terlacak dan penambahan 10B yang belum terlacak. | Pertahankan. Build audit menggunakan sumber yang sama tanpa mengubahnya. |
| B · `backend/app/modules/analysis/`, `backend/app/core/domains.py` | Modul analisis 70.883 byte. Orchestrator memakai parser, PSL, heuristik, identitas, Safe Browsing, VirusTotal, urlscan.io, DNS/RDAP, dan Evidence Fusion. Sebagian modul 10B belum terlacak. | Pertahankan. Startup dan rute analisis memakai fondasi ini. |
| C · `datasets/audit.py`, `evaluate_url_inspector.py`, `manifests/phase10a.json`, tes terkait | 92.896 byte. Utilitas offline dan fixture mengacu ke manifest, sumber pemilik, serta parser dan engine yang sama. Belum terlacak Git. | Pertahankan untuk regresi offline. Hubungan impor berjalan dari utilitas ke aplikasi. |
| D · Dua skrip benchmark ML, tes, dan `datasets/requirements-ml.txt` | Dua skrip utama 35.707 byte. Digunakan untuk reproduksi historis 10B.2/10B.2.1. Belum terlacak Git dan berada di luar root paket aplikasi. | Pertahankan sebagai sumber audit. Dependensi dapat dipasang ulang ke direktori eksperimen dengan versi terpin. |
| D · `datasets/processed/ml_experiments/phase10b2/` dan `phase10b21/` | Masing-masing 816.681 dan 413.356 byte, diabaikan Git. Berisi satu champion beku, metrik, dan manifest benign. Evaluasi historis mereferensikan champion dan manifest. | Pertahankan sebagai bukti audit. Kedua hash diperiksa ulang sesudah pembersihan. |
| E · `datasets/processed/ml_experiments/deps-py314/` | 5.873 berkas, 241.411.556 byte, diabaikan Git. Salinan lokal tujuh distribusi terpin, skrip yang dibuat instalasi, bytecode, dan satu berkas wheel kosong. Rekaman paket yang diperiksa tidak menunjukkan perubahan isi. | Hapus salinan hasil instalasi. Pulihkan dengan `pip --target` dan `datasets/requirements-ml.txt` bila audit offline perlu diulang. |
| E · `datasets/__pycache__/` dan `datasets/processed/ml_experiments/pytest-phase10b21/` | 8 bytecode berukuran 175.077 byte dan 5 fixture sementara berukuran 897 byte. Keduanya diabaikan Git. Fixture `validation-champion.joblib` di direktori pytest adalah input palsu untuk uji hash. | Hapus. Python dan pytest dapat membuat ulang masing-masing. |
| F · `C:/Users/User/Downloads/dataset/` | Sumber milik pengguna di luar repo. Inventaris baca-saja menemukan 15 berkas sebesar 2.088.171.717 byte. Data lain dapat dibutuhkan pada checkpoint berikutnya. | Pertahankan. Penghapusan atau pemindahan bahan pemilik memerlukan tinjauan pemilik. |

Total ukuran logis yang dihapus **241.587.530 byte (230,4 MiB)**. Pemeriksaan sebelum penghapusan memastikan target absolut berada di workspace, diabaikan Git, tanpa berkas terlacak dan tanpa reparse point. Ukuran logis berbeda dari perubahan kapasitas bebas SSD. Folder eksperimen historis dan virtual environment tidak menjadi target cleanup.

### Runtime, kemasan, dan regresi

- Dependensi FastAPI dari `backend/pyproject.toml` serta dependensi dan lockfile frontend diperiksa. `scikit-learn`, `xgboost`, `joblib`, `numpy`, dan `scipy` tidak dideklarasikan sebagai dependensi produksi. Tidak ditemukan impor runtime atau wiring pemuatan champion. Tidak ada deklarasi dependensi yang perlu dihapus.
- Backend menemukan paket `app*` dari root backend. Wheel audit dari sumber aplikasi dan `pyproject.toml` berisi 46 berkas dan berukuran 52.905 byte. Sentinel CSV dan model yang disisipkan di root staging tidak ikut masuk. Metadata wheel tidak memuat dependensi ML. Repo tidak memiliki Dockerfile, `.dockerignore`, atau manifest platform deployment yang perlu disesuaikan. Audit ini mencakup wheel lokal, sementara citra deployment belum tersedia untuk diperiksa.
- Vite membangun dari root frontend dan menyalin aset `public/`. Build terisolasi menghasilkan 47 berkas berukuran 60.016.679 byte. Pemindaian nama dan path menemukan nol berkas dataset atau model. Aset media yang sudah dipakai tetap dipertahankan. Build menggunakan URL HTTPS placeholder untuk validasi konfigurasi dan melaporkan peringatan ukuran chunk. Build tidak dipublikasikan.
- `.gitignore` sekarang mencakup cache pytest di `datasets/` serta file `.joblib`, `.pkl`, `.pickle`, `.onnx`, `.safetensors`, dan `.whl` yang tercipta di luar folder output dataset yang sudah diabaikan. Untuk membalik perubahan ignore, hapus hanya baris C1. Artefak diabaikan Git tidak dapat dipulihkan melalui Git.
- **114 tes backend lulus.** Cakupan termasuk API, normalisasi, indikasi identitas, bukti dan konflik provider, respons Safe Browsing JSON/Protobuf, VirusTotal, urlscan.io, DNS, dan RDAP melalui fixture dan transport tiruan. Sesudah cleanup, startup FastAPI serta `/health`, `link`, dan `website` diuji lagi tanpa paket ML terpasang dan tanpa pemuatan modul ML. Verifikasi provider untuk C1 menggunakan mock.
- **40 tes frontend lulus.** Pemeriksaan rute, lint, TypeScript, dan Vite build lulus. Pemeriksaan rute mencakup `/scan/link`, `/scan/website`, History, dan navigasi pengguna/admin.

**C2 READY.** Parser, batas domain, hasil deterministik, dan fixture provider tersedia sebagai dasar pengerasan. Pilot benign 10B.2.1 dan fixture struktural dapat dipakai untuk regresi false positive dengan cakupan yang didokumentasikan. Backend memiliki titik sambung setelah Evidence Fusion untuk Gemini pada C3, setelah C2 dan persetujuan. Integrasi C3 masih memerlukan persetujuan pengguna atas pengiriman data, minimisasi bukti, konfigurasi server, pemilihan model, dan verifikasi kontrak keluaran. C2–C5 dan 10C–10G tetap PENDING. Tidak ada commit, push, deploy, migrasi, atau perubahan Supabase Cloud.

## Phase 10B-C2 — Internal Security Detection Hardening

**PASS WITH LIMITATIONS · 12 November 2026 WIB.** Engine `10b.2-c2` memperketat penafsiran bukti lokal. Path akun, panjang URL, encoding umum, dan campuran aksara Latin, Kiril, atau Yunani dalam satu label tetap terlihat sebagai konteks. Jika hanya konteks itu yang tersedia, hasilnya `inconclusive/unknown`. Karakter kontrol terenkode menjadi indikator tersendiri. Parser yang sudah ada menolak kredensial dalam authority. Temuan struktur sendiri tidak menetapkan risiko sedang atau tinggi.

- Parameter pengalihan yang dikenali diperiksa pada bentuk literal dan hingga dua putaran percent decoding. URL absolut atau protocol-relative yang valid dibandingkan menurut domain terdaftar, dengan hostname sebagai fallback ketika domain terdaftar tidak tersedia. Path relatif dan perpindahan dalam satu batas domain tidak menghasilkan temuan redirect lintas domain. Dua tenant pada private suffix dapat memiliki batas domain berbeda. Nilai tujuan tidak dimasukkan ke bukti. Pemeriksaan bersifat lokal. [Public Suffix List](https://publicsuffix.org/list/)
- Referensi organisasi yang dikurasi tetap dipakai. Subdomain hanya mewarisi kecocokan referensi dalam batas domain terdaftar yang sama. Jika lebih dari satu referensi relevan, indikasi peniruan kuat didahulukan dari kemiripan nama. Pemeriksaan ejaan dibatasi ke satu sisip, hapus, substitusi, atau transposisi bersebelahan. Pemetaan confusable tetap terbatas pada karakter yang ditetapkan, dengan IDNA untuk menyamakan representasi Unicode dan punycode. Campuran aksara saja tidak menyatakan peniruan. [Unicode UTS #39](https://www.unicode.org/reports/tr39/)
- Evidence Fusion mempertahankan prioritas kecocokan provider, peniruan kuat berbasis referensi, dan bukti historis yang memenuhi syarat. Bukti yang bertentangan tetap ditampilkan. Status `no_match` dari provider tidak menetapkan keamanan situs. Mode API `link` dan `website` tetap memakai satu engine.

### Evaluasi offline dan regresi

Benchmark memakai kembali sampel PhiUSIIL 10B sebanyak 12.145 URL, terdiri dari 5.286 phishing dan 6.859 legitimate. Definisi indikator positif tetap `partial` atau risiko `medium`. Pilot terpisah memakai 632 URL benign dari manifest beku 10B.2.1, termasuk 625 URL dengan path selain `/`. Kedua evaluasi berlangsung tanpa panggilan provider atau kunjungan ke URL dataset.

| Pengukuran indikator lokal | 10B.2 | C2 |
| --- | ---: | ---: |
| PhiUSIIL · TP / FP / TN / FN | 547 / 4 / 6.855 / 4.739 | 366 / 4 / 6.855 / 4.920 |
| PhiUSIIL · recall phishing | 10,35% | 6,92% |
| PhiUSIIL · precision / FPR | 99,27% / 0,06% | 98,92% / 0,06% |
| PhiUSIIL · F1 / balanced accuracy | 18,74% / 55,14% | 12,94% / 53,43% |
| Pilot benign · URL ditandai | 3/632 (0,47%) | 0/632 (0%) |

Tiga false positive lama pada pilot berasal dari path akun. Pada sampel PhiUSIIL, C2 menghasilkan 181 indikator positif phishing lebih sedikit, dengan jumlah false positive yang sama. Semua 12.145 verdict offline tetap `unknown`. Angka ini mengukur sinyal lokal pada dua sampel tetap. Akurasi sistem hybrid dan FPR populasi belum ditetapkan. Bukti ini mendukung pemakaian indikator sebagai konteks untuk laporan dan menunjukkan cakupan phishing lokal yang masih rendah.

**131 tes backend, 1 tes evaluator, dan 27 tes workspace frontend lulus.** Fixture mencakup batas private PSL, prioritas referensi, edit jarak satu, IDN, redirect satu dan dua lapis, encoding umum, URL akun, kompatibilitas mode, dan konflik provider. Provider diverifikasi lewat mock pada C2.

```powershell
$env:PYTHONPATH='backend'
.\backend\.venv\Scripts\python.exe datasets/evaluate_url_inspector.py 'C:/Users/User/Downloads/dataset/phiusiil+phishing+url+dataset.zip' --benign-manifest 'datasets/processed/ml_experiments/phase10b21/benign-manifest.json'
```

**C3 READY WITH LIMITATIONS.** Hasil deterministik sudah menyediakan bukti yang dapat dijelaskan dengan batas cakupan tersebut. C3–C5 dan 10C–10G masih PENDING. Tidak ada commit, push, deployment, migrasi, atau perubahan Supabase Cloud.

## Phase 10B-C3 — Gemini Security Analyst Backend Integration

**PASS WITH LIMITATIONS · 12 November 2026 WIB.** Baseline `main` di `eeaecbd` dengan perubahan 10A/10B sebelumnya di working tree. C3 menambahkan layanan internal `GeminiSecurityAnalyst.analyze(engine_result, consent=False)` di `backend/app/modules/analysis/gemini.py`. FastAPI menyediakan layanan di `app.state.security_analyst`. Analisis URL publik tetap mengikuti batas orchestrator lima detik dan tidak memanggil Gemini. Layanan menerima `EngineResult` setelah Evidence Fusion dan mengembalikan status internal beserta penjelasan terpisah.

| Berkas | Perubahan |
| --- | --- |
| `backend/app/core/config.py`, `backend/.env.example` | Konfigurasi server `GEMINI_API_KEY` sebagai `SecretStr`, `GEMINI_MODEL`, dan `AWASIN_AI_ENABLED=false` secara default. |
| `backend/pyproject.toml` | Extra opsional `gemini` memin `google-genai==3.2.0`. SDK dimuat saat layanan internal memperoleh persetujuan yang berlaku. |
| `backend/app/main.py` | Membuat layanan internal saat startup tanpa membuka koneksi Gemini. |
| `backend/app/modules/analysis/gemini.py`, `gemini_transport.py` | Proyeksi bukti, prompt, validasi struktur dan referensi, kontrol transport, serta fallback. |
| `backend/tests/test_gemini_analyst.py` | Fixture service, SDK melalui transport mock, dan regresi kontrak rute publik. |

Model konfigurasi dibiarkan kosong. `gemini-3.5-flash-lite` adalah contoh model stabil dengan structured output menurut dokumentasi Google dan ID yang digunakan pada mock. Ketersediaannya pada proyek pengguna belum diperiksa. SDK resmi terpasang dan diuji pada Python backend. Saat perlu menjalankan uji C3 dengan SDK, instal extra `gemini` dari direktori backend. [Google GenAI SDK](https://pypi.org/project/google-genai/3.2.0/) · [Gemini 3.5 Flash-Lite](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite) · [Structured output](https://ai.google.dev/gemini-api/docs/structured-output)

### Persetujuan, minimisasi, dan keluaran

Flag default mati. Setiap pemanggilan internal memerlukan nilai boolean `consent=True` untuk hasil analisis itu. Persetujuan Safe Browsing dan provider tambahan tidak terhubung dengan persetujuan Gemini. Permintaan publik dengan field persetujuan AI tak dikenal mengikuti validasi kontrak lama. Saat flag dimatikan ketika panggilan sudah berjalan, hasil yang kembali dibuang.

Payload hanya memuat status dan risiko deterministik, penanda bahwa konten situs belum diperiksa, maksimal 12 ID lokal `EV-xxx`, kode temuan, sumber dari allowlist, dan status, cakupan, atau usia bukti yang relevan. Hostname, URL, path, kueri, nama organisasi, teks bukti mentah, metadata provider, identitas pengguna, dan kredensial tidak masuk payload. Pemetaan status provider berasal dari `UrlReport` bertipe. Teks instruksi ditetapkan oleh backend dan meminta analisis singkat dalam Bahasa Indonesia berdasarkan bukti yang diberikan.

Keluaran JSON memuat ringkasan, temuan ber-ID, keterbatasan, dan tindakan dari kategori yang dibatasi. Pydantic menolak bidang tambahan, batas panjang yang dilanggar, tipe klaim di luar daftar, rujukan asing atau berulang, dan klaim kecocokan yang merujuk status provider tanpa kecocokan. Struktur juga menolak pola markup, instruksi pengambilalihan yang dikenali, alamat kontak, tautan eksplisit, persentase, dan pantulan nilai secret yang dikonfigurasi. Ringkasan dan penjelasan teks tetap data tak tepercaya hingga pemeriksaan semantik C4.

### Transport, status, dan batas C4

Transport membatasi SDK ke satu POST HTTPS `generateContent` pada host Gemini Developer API. Key dikirim pada header autentikasi. Redirect, proxy dari environment, retry, tools, grounding, dan rekam ulang SDK tidak digunakan. Batasnya 8 detik, dua panggilan paralel per proses, 4 KiB JSON bukti, 700 token keluaran, 32 KiB body respons, dan 8 KiB teks hasil. HTTP 429 memicu jeda 15 detik di proses yang sama. HTTP timeout, kredensial salah, model yang tidak ditemukan, kegagalan jaringan, JSON rusak, dan respons terpotong dikonversi menjadi status internal. Status yang tersedia adalah `disabled`, `not_requested`, `unavailable`, `rate_limited`, `timeout`, `invalid_response`, dan `completed`. Kegagalan tidak mengubah hasil deterministik.

Log C3 tidak menyimpan prompt, respons, atau key. `backend/.env` tetap diabaikan Git. Tidak ada riwayat AI, output AI publik, atau perubahan frontend. **LIVE GEMINI NOT VERIFIED** karena belum ada izin eksplisit untuk uji Gemini live. Kontrol transport, status provider, dan kontrak SDK diverifikasi dengan mock. Kualitas bahasa, latensi layanan live, kuota akun, dan penerimaan schema oleh model pada akun pengguna masih perlu diverifikasi.

Regresi backend menghasilkan **312 lulus, 0 gagal, 0 dilewati**, termasuk 50 kasus C3. Tes mencakup persetujuan terpisah, redaksi payload, serangan instruksi sintetis, batas body dan concurrency, alamat outbound yang ditolak, penolakan output terpotong, SDK resmi melalui transport mock, bentuk respons publik, serta parser dan provider deteksi yang sudah ada. Pemeriksaan dependensi dengan `pip check` lulus.

**C4 READY WITH LIMITATIONS.** Integrasi publik memerlukan validator klaim semantik, pembatasan penggunaan per pengguna, persetujuan terikat analisis, dan UI untuk penjelasan yang sudah divalidasi. C4 dan C5 serta 10C–10G tetap PENDING. Tidak ada commit, push, deployment, migrasi, atau perubahan Supabase Cloud.

## Phase 10B-C4 — Deterministic AI Validator, Gemini Live Verification & Smart Analysis Report

**PASS WITH LIMITATIONS · 12 November 2026 WIB.** Baseline Git `main` di `eeaecbd`, dengan 43 entri perubahan atau penambahan yang sudah ada di working tree. Link & Website Inspector mengembalikan verdict dari Evidence Fusion sebelum tahap AI. Frontend menampilkan hasil tersebut, lalu meminta penjelasan secara terpisah jika pengguna memilih Gemini.

### Alur, privasi, dan validasi

- `UrlRequest.ai_consent` adalah boolean ketat dengan default `false` untuk mode `link` dan `website`. Respons utama menambahkan objek opsional `ai`, dengan status `pending`, `disabled`, `unavailable`, atau `rate_limited`. Kotak persetujuan Gemini terpisah dari opsi provider keamanan dan dikosongkan ketika input berubah atau satu scan disubmit.
- `POST /api/v1/analysis/explanation` menerima tiket dan persetujuan eksplisit. Tiket acak 256 bit berlaku 60 detik, sekali pakai, disampaikan di body, dan hanya disimpan sebagai hash di memori proses. Untuk pengguna login, tiket terikat pada identitas terverifikasi dan hash bearer token asli. Untuk pengunjung tanpa login, tiket terikat pada alamat koneksi dan memerlukan kepemilikan token acak. Rute tidak menerima URL, verdict, atau bukti dari klien. Data yang disimpan sementara hanya DTO bukti minimum dan pengikat tiket. Respons memakai `Cache-Control: no-store`. Batas body rute adalah 1 KiB.
- `ai_validator.py` menerima JSON berisi pilihan kategori klaim, ID bukti, dan kode rekomendasi. Pydantic menolak field asing dan nilai di luar daftar. Validator memeriksa setiap referensi terhadap temuan scan dan memastikan status serta jenis sumber cocok. Riwayat domain terkait tetap disebut domain terkait. Usia lebih dari 30 hari ditampilkan jika arsip sudah lama. Konflik hanya dapat diklaim saat daftar primer memberi `no_match` dan arsip URL yang sama berisi indikasi positif. Ringkasan, fakta, batasan, dan rekomendasi ditulis dari template backend. Gemini menentukan pilihan temuan. Teks bebas, persentase, dan verdict dari Gemini tidak masuk kontrak publik.
- Tahap deterministik tetap memiliki batas lima detik. Tahap Gemini terpisah memiliki batas delapan detik, maksimal dua panggilan serentak per proses, satu generasi per tiket, dan jeda 15 detik setelah 429. Penerbitan tiket dibatasi empat per identitas atau IP anonim dan 30 total per proses per 60 detik. Frontend membatalkan permintaan saat input berubah atau komponen dilepas. Backend membatalkan task penjelasan ketika koneksi putus. Pembatalan tidak membuktikan provider membatalkan pemrosesan yang sudah diterima.
- Card **Analisis AI — Gemini** menampilkan loading, penjelasan tervalidasi dengan sumber dan ID bukti, serta status disabled, unavailable, rate limit, timeout, atau gagal validasi. Hasil deterministik tetap tersedia pada semua status. Penjelasan tidak masuk ke bukti tepercaya atau Riwayat. Aturan deteksi, provider, dan Evidence Fusion dari checkpoint sebelumnya dipertahankan.

### Verifikasi Gemini live

**BLOCKED.** Konfigurasi server memiliki key, `GEMINI_MODEL` kosong, dan flag lokal mati. Uji terisolasi memilih `gemini-3.5-flash-lite` pada proses verifikasi, memakai Google GenAI SDK 3.2.0. Model ini tercantum sebagai stabil dan mendukung structured output. Flag dan model hanya diubah pada objek konfigurasi proses tes. File key dan konfigurasi lokal tetap seperti semula. [Model Gemini](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite) · [SDK](https://pypi.org/project/google-genai/3.2.0/)

| Generasi live | Skenario dan hasil | Latensi |
| --- | --- | ---: |
| 1 | Bukti sintetis redirect, Google `no_match`, arsip dilewati. HTTP 400. | 1.074 ms |
| 2 | Diagnosis provider dengan bukti sintetis. HTTP 400 `INVALID_ARGUMENT`, tanpa alasan yang dapat dipastikan. | 1.066 ms |
| 3 | Diagnosis dengan skema inline yang lebih sederhana. HTTP 400 `INVALID_ARGUMENT`, tanpa detail tambahan. | 1.055 ms |

Ketiga panggilan hanya mengirim enum dan ID bukti sintetis, tanpa URL pengguna atau data pribadi. Verdict `unknown` tetap identik. Provider tidak mengembalikan output terstruktur yang dapat divalidasi atau metadata token. Status yang tersedia tidak mengonfirmasi apakah penolakan berasal dari akses proyek, batasan model, atau parameter lain. Anggaran tiga panggilan telah digunakan. Pemindaian 199 berkas runtime, sumber frontend, dan dist lokal menemukan nol kecocokan nilai key aktual.

### Hasil uji dan batas C5

| Pemeriksaan | Hasil |
| --- | --- |
| Backend | Regresi awal 333 lulus dan satu fixture OpenAPI lama gagal karena rute baru. Fixture diperbarui dan lulus saat dijalankan ulang. Cakupan meliputi persetujuan, tiket sekali pakai, expiry, isolasi sesi, privasi, konflik provider, arsip lama/domain terkait, dan percobaan perubahan verdict. |
| Frontend | 271 tes lulus, termasuk reset persetujuan, stale response, status penjelasan, dan verdict tetap terlihat. Rute, lint, TypeScript, dan build lulus dengan peringatan ukuran chunk Vite. |
| Browser lokal | `/scan/website` membuka workspace yang sama. Scan tanpa persetujuan tidak menampilkan card dan tidak memanggil mock. Tiga scan dengan persetujuan menghasilkan tepat tiga pemanggilan mock. Verifikasi mencakup keyboard, loading dengan verdict terlihat, ID bukti, fallback validasi, penghapusan hasil saat input berubah, dan layout efektif 375 px tanpa overflow. Gemini dan provider keamanan dipisahkan dari jaringan live dalam uji browser ini. |

**C5 READY WITH LIMITATIONS untuk verifikasi lokal.** Kesiapan penggunaan Gemini live masih tertahan oleh HTTP 400. Tiket dan kuota bersifat per proses, sehingga deployment multiworker perlu strategi routing atau penyimpanan tiket bersama yang ditinjau sebelum aktivasi. Flag default tetap mati. C5 serta 10C–10G masih PENDING. Tidak ada commit, push, deployment, migrasi, atau perubahan Supabase Cloud.

## Phase 10B-C4-FIX — Gemini HTTP 400 Diagnosis & Repair

**PASS WITH LIMITATIONS untuk perbaikan offline.** Baseline `main` di `eeaecbd`, dengan perubahan Phase 10 sebelumnya di working tree. Konfigurasi backend memiliki key, model lokal kosong, dan flag AI mati. SDK tetap `google-genai` 3.2.0. Model yang diperiksa adalah `gemini-3.5-flash-lite`, yaitu model yang dipakai pada tiga panggilan C4 sebelumnya.

### Bukti dan perbaikan

SDK memakai `models.generate_content` dengan POST HTTPS ke `/v1beta/models/{model}:generateContent`, autentikasi header `x-goog-api-key`, `systemInstruction` terpisah, dan DTO bukti pada `contents`. Request terstruktur memakai `responseMimeType=application/json` serta `responseJsonSchema`. Wire test C3 sebelumnya mengonfirmasi bahwa `candidate_count=1` di SDK benar-benar dikirim sebagai `generationConfig.candidateCount`. Google mendokumentasikan bahwa `candidateCount` tidak didukung pada Gemini 3 dan 4. Ini adalah ketidakcocokan konkret yang ada pada ketiga request C4, termasuk setelah skema C4 disederhanakan. Catatan historis menyimpan HTTP 400 dan `INVALID_ARGUMENT` tanpa pelanggaran field yang dapat digunakan. Penyebab eksklusif dari ketiga penolakan belum dapat dipastikan, termasuk akses proyek terhadap model. [Referensi API Gemini](https://aistudio.google.com/api-reference) · [SDK GenerateContent](https://googleapis.github.io/python-genai/) · [Panduan error parameter Google](https://aistudio.google.com/docs/troubleshooting#check-api) · [Model 3.5 Flash-Lite](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite)

- `backend/app/modules/analysis/gemini_transport.py` menghapus parameter `candidateCount` dari request dan tetap memeriksa bahwa respons berisi tepat satu kandidat dengan finish reason `STOP`. Skema C4, batas 700 token, timeout delapan detik, larangan redirect, dan batas satu request tanpa retry dipertahankan. Mode diagnostik teks minimal menggunakan transport yang sama dengan mengosongkan skema dan instruksi sistem.
- Transport sebelumnya membuang body semua respons non-200. Sekarang body JSON dibaca dengan batas 32 KiB. Logger menyimpan status HTTP, kode Google dan alasan yang ada di allowlist, nama parameter yang disederhanakan ke label aman, metadata model dan SDK, fase kegagalan, dan latensi. Pesan mentah, detail arbitrer, nilai parameter, payload, dan key tidak masuk log. Jika body rusak atau melebihi batas, status HTTP tetap diteruskan ke fallback.
- `backend/tests/test_gemini_diagnostics.py` menguji serialisasi teks minimal, JSON minimal, skema AWASIN, dan hasil yang lolos validator. Tes juga mencakup status provider dan redaksi diagnostik. `backend/tests/test_gemini_analyst.py` mengunci ketiadaan `candidateCount` pada request SDK. Persetujuan, tiket, minimisasi bukti, schema validator, verdict, dan UI menggunakan kontrak C4.

### Status live

Regresi lokal lulus dengan **127 tes backend terarah** dan **34 tes workspace frontend**. Pemeriksaan rute, lint, TypeScript, dan build lulus. Vite masih melaporkan peringatan ukuran chunk. Mock mengonfirmasi bentuk request SDK dan hasil validator. Penerimaan konfigurasi oleh proyek Gemini belum diuji ulang.

**LIVE GEMINI RE-VERIFICATION PENDING OWNER APPROVAL.** Nol panggilan live baru dilakukan pada checkpoint ini. Untuk mengonfirmasi perbaikan dan membedakan masalah akses proyek dari masalah structured output, diperlukan persetujuan baru untuk maksimal tiga panggilan `gemini-3.5-flash-lite`, dengan penghentian pada kegagalan pertama. Urutannya adalah prompt teks sintetis “Jawab OK”, tugas JSON sintetis `{"ok":true}`, kemudian DTO `unknown` dengan redirect, Google `no_match`, VirusTotal dan urlscan.io dilewati, serta konten situs belum diperiksa. Akses dan kuota free tier proyek belum diketahui, sehingga panggilan dapat ditagihkan jika key memakai tier berbayar. [Harga resmi Gemini](https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite)

C5 menunggu konfirmasi Gemini live. Tiket dan kuota tetap per proses, dengan dukungan multiworker sebagai pekerjaan terpisah. Tidak ada commit, push, deployment, migrasi, atau perubahan Supabase Cloud.

### Gemini Live Re-Verification · 12 November 2026 WIB

Pemilik menyetujui maksimal tiga panggilan live untuk `gemini-3.5-flash-lite`. Verifikasi memakai Google GenAI SDK 3.2.0, API `v1beta`, dan implementasi C4-FIX yang sudah menghapus `candidateCount`. Pemeriksaan akses model dihitung ke dalam batas tiga panggilan.

| Tahap | Hasil aktual | Latensi |
| --- | --- | ---: |
| Metadata model dengan key backend | HTTP 200. Proyek dapat membaca metadata model, yang mencantumkan dukungan `generateContent`. | 479 ms |
| Generasi teks minimal | HTTP 400 `INVALID_ARGUMENT`. Respons tidak menyediakan alasan atau field yang dapat dicatat oleh diagnostik. Request memakai prompt sintetis “Jawab hanya dengan teks OK.” tanpa skema atau instruksi sistem. | 1.253 ms total, 497 ms pada transport |
| Structured JSON dan validasi bukti AWASIN | Dihentikan sebelum generasi karena tahap teks gagal. | — |

**BLOCKED untuk verifikasi live.** Total dua panggilan, terdiri dari satu GET metadata dan satu POST generasi. Tidak ada retry atau metadata token yang diterima. HTTP 400 tetap muncul setelah `candidateCount` dihapus dan skema tidak disertakan, sehingga keduanya tidak menjelaskan kegagalan minimal yang baru. HTTP 200 pada metadata membuktikan akses metadata untuk key tersebut. Penyebab penolakan generasi masih belum diketahui karena respons aktual tidak memberikan detail yang dapat digunakan. Tidak ada hasil Gemini yang diteruskan ke Evidence Fusion atau mengubah verdict. C5 tetap menunggu verifikasi generasi dan validator live.

### C4-FIX · Diagnosis offline HTTP 400 · 12 November 2026 WIB

Tidak ada panggilan Gemini live. Request dari Google GenAI SDK 3.2.0 ditangkap sebelum dan sesudah transport AWASIN dengan `httpx.MockTransport` dan akses jaringan nyata diblokir pada tes wire.

| Pemeriksaan | Bukti |
| --- | --- |
| Endpoint dan autentikasi | `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`, tanpa query. `Content-Type: application/json`, key sintetis hanya di `x-goog-api-key`, tanpa `Authorization`. SDK juga menambahkan telemetri `User-Agent` dan `X-Goog-Api-Client`. |
| JSON teks minimal | `{"contents":[{"parts":[{"text":"Reply with OK only."}],"role":"user"}],"generationConfig":{"maxOutputTokens":700}}`. Contoh REST Google cukup dengan `contents[].parts[].text`; role dan batas token merupakan perbedaan yang sah menurut kontrak umum. Tidak ada `candidateCount`, system instruction, schema, tools, atau parameter generasi lain. |
| JSON terstruktur | Mock terpisah mengonfirmasi `responseMimeType: application/json` dan `responseJsonSchema` hanya saat skema diberikan. Tes alur AWASIN memeriksa instruksi sistem, evidence minimal, dan keluaran validator tanpa perubahan verdict. |
| Konfigurasi lingkungan | Override sintetis untuk URL, versi, Enterprise/Vertex, project/location, key, replay, pilihan HTTPX, proxy, dan CA valid tidak menyisipkan field atau mengganti tujuan/key pada request yang ditangkap. Tidak ada nama override yang diperiksa dalam shell audit. Path `SSL_CERT_FILE` yang tidak valid memicu kegagalan inisialisasi SSL SDK sebelum request; itu tidak menghasilkan HTTP 400 dari provider. |
| Transport dan respons error | Transport meneruskan byte JSON dan header SDK; satu-satunya perubahan header adalah `Accept-Encoding: identity`. Redirect dan retry tetap nonaktif. Pembaca mempertahankan status HTTP dan detail terstruktur yang diizinkan, dengan batas 32 KiB. Sebelumnya, penjelasan yang hanya ada di `error.message` tidak dapat dibedakan. Kini pesan yang cocok persis dengan daftar yang dikenal menghasilkan kategori tetap; pesan mentah dan detail bebas tetap dibuang. |

Rujukan: [kontrak resmi generateContent](https://aistudio.google.com/api-reference/generate-content/generate-content), [spesifikasi Gemini 3.5 Flash-Lite](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite), dan [format error Google](https://ai.google.dev/gemini-api/docs/generate-content/api-errors).

**Kesimpulan:** tidak ditemukan cacat serialisasi atau perubahan request oleh transport yang menjelaskan HTTP 400. Request historis tanpa skema masih mengirim `maxOutputTokens: 700`; kompatibilitas konfigurasi yang tersisa dengan model/endpoint dan kebijakan akses generasi pada proyek belum dapat dipisahkan. Metadata HTTP 200 hanya mengonfirmasi akses baca model. Perubahan kode terbatas pada diagnostik error dan tes; consent, minimisasi evidence, AI validator, rate limit, fallback, serta verdict deterministik tetap mengikuti alur yang sama.

**Regresi offline:** 156 tes backend lulus, termasuk wire SDK, redaksi error, validator, analisis, dan foundation. 34 tes workspace frontend dan `npm run check:routes` lulus. Status generasi live dan C5 masih menunggu verifikasi.

**Satu tes live yang direkomendasikan, menunggu persetujuan:** satu POST REST langsung ke endpoint di atas dengan key backend yang sama di header dan body `{"contents":[{"parts":[{"text":"Jawab hanya dengan teks OK."}]}]}`. Tanpa SDK, custom transport, `role`, atau `generationConfig`; batas respons, timeout, redaksi, dan larangan redirect/retry tetap diterapkan pada probe. Catat hanya status, latensi, kategori error yang aman, dan jumlah token bila tersedia. Jika sukses, bandingkan perbedaan jalur SDK; jika masih 400, penolakan juga terjadi pada request REST minimum. Tes ini tidak mengganti adapter produksi atau melanjutkan C5.

## Phase 10B-C4-MISTRAL — AI Provider Verification & Integration

**LIVE VERIFIED · INTEGRATION COMPLETE · 12 November 2026 WIB.** GET metadata mengembalikan HTTP 200 dalam 605 ms untuk `ministral-8b-latest` dan mengonfirmasi dukungan chat. Sisa kuota dan tier akun belum diketahui. [Referensi Models](https://docs.mistral.ai/api/endpoint/models) · [Usage and limits](https://docs.mistral.ai/admin/billing-usage/usage-limits).

| Generasi melalui SDK resmi Mistral 2.10.1 | HTTP | Latensi | Token input / output | Hasil |
| --- | ---: | ---: | ---: | --- |
| Prompt minimal “Jawab hanya dengan kata OK.” | 200 | 598 ms | 11 / 3 | Teks nonkosong dan respons lengkap. Pemeriksaan literal `OK` yang ditambahkan pada probe awal gagal. Spesifikasi menerima teks nonkosong yang valid, sehingga panggilan minimal dihitung berhasil tanpa pengulangan. |
| Structured output dengan fixture AWASIN | 200 | 1.788 ms | 410 / 91 | JSON, skema Pydantic, ID bukti, dan kecocokan klaim lolos validator. Dua temuan dan dua rekomendasi diterima. Verdict tetap `unknown`. |

Dua panggilan memakai bukti sintetis. Fixture terstruktur berisi redirect, Google `no_match`, VirusTotal dan urlscan `not_requested`, serta konten situs belum diperiksa. Tidak ada retry atau perubahan billing. [Model dan harga](https://docs.mistral.ai/models/ministral-8b-latest) · [SDK quickstart](https://docs.mistral.ai/inference/quickstarts/send-your-first-request) · [Structured output](https://docs.mistral.ai/inference/conversations/structured-output/custom).

`backend/app/modules/analysis/mistral.py` mengirim kontrak chat terstruktur yang sama melalui HTTPX yang sudah tersedia. `ai_analyst.py` mempertahankan DTO minimal, pengaturan backend, batas waktu delapan detik, maksimal dua panggilan serentak per proses, dan cooldown 429. Adapter membatasi respons hingga 32 KiB serta menolak redirect, respons terpotong dan pemanggilan alat. Rute, tiket sekali pakai, dan validator tetap membentuk penjelasan terpisah dari verdict. Frontend memakai label Mistral di persetujuan dan kartu Analisis AI. Nilai key tidak ditemukan di source frontend maupun hasil build.

Setelah regresi integrasi awal lulus (108 backend dan 34 frontend), modul Gemini, transport, tes khusus provider, entri konfigurasi contoh, serta deklarasi `google-genai` di `pyproject.toml` dihapus. Pencarian source dan konfigurasi aplikasi menemukan nol referensi Gemini. SDK Gemini juga dilepas dari virtual environment lokal dan `pip check` lulus. Tidak ada lock backend untuk diperbarui. Satu entri usang di `backend/.env` dihapus dengan entri lainnya dipertahankan, termasuk `MISTRAL_API_KEY` dan flag AI lokal yang masih mati.

| Pemeriksaan setelah pembersihan | Hasil |
| --- | --- |
| Backend | 299 tes lulus. Termasuk kontrak Mistral mock, consent, pemilihan model, redaksi, error provider, timeout, batas konkurensi, tiket, validator, serta integritas verdict. Setelah SDK Gemini dilepas dari virtual environment, 37 tes AI terarah lulus ulang. |
| Frontend | 271 tes lulus. Lint, pemeriksaan rute, TypeScript, dan build lulus. Build pertama membutuhkan URL HTTPS karena autentikasi lokal terkonfigurasi. Build verifikasi memakai URL HTTPS sintetis dan Vite melaporkan peringatan ukuran chunk. |
| Browser | Chrome headless pada 375 px dengan FastAPI lokal dan transport Mistral mock. Dua rute Link & Website terbuka. Consent mati secara default. Dua scan berizin memicu tepat dua panggilan mock. Penjelasan valid dan fallback untuk ID salah tampil, verdict tetap `unknown`, dan halaman tidak meluber horizontal. |

**Siap untuk checkpoint C5.** Mistral adalah satu-satunya provider generasi pada aplikasi. Aktivasi pada lingkungan pengguna mengikuti `AWASIN_AI_ENABLED` dan persetujuan per scan. Tiket serta kuota tetap per proses. C5 belum dimulai.

## Phase 10B-C5 — Diagnosis flag AI pada browser lokal

FastAPI yang aktif di port 8000 dimulai pukul 08.37 WIB. Perubahan flag pada `backend/.env` tersimpan pukul 09.15 WIB. Proses lama masih mengembalikan `ai.status=disabled` tanpa tiket saat menerima `ai_consent=true` untuk URL BCA. Scan tanpa consent mengembalikan `ai=null` dengan verdict `unknown`. Ini mengonfirmasi bahwa proses yang melayani browser masih memakai flag mati meskipun file sudah diubah. Audit tidak membaca key dari memori proses lama.

Audit startup juga mereproduksi masalah terpisah: path relatif `.env` membaca folder kerja. Dari akar repo flag terbaca mati dan key tidak ditemukan, sedangkan dari folder backend flag terbaca aktif dan key tersedia. `Settings` kini menunjuk ke `backend/.env` berdasarkan lokasi modul. Override dari environment proses tetap memiliki prioritas dan perubahan dotenv dimuat saat proses dimulai ulang.

FastAPI pengganti dijalankan dari akar repo. Objek konfigurasi pada proses yang melayani port 8000 mengonfirmasi `backend/.env`, flag aktif, model `ministral-8b-latest`, key tersedia, dan tidak ada override environment untuk tiga pengaturan AI. Nilai key tidak dicetak. Chrome pada frontend yang dipakai pengguna mengirim `ai_consent=true` ke `http://localhost:8000` dan menerima `pending`. Rute generasi diblokir pada pemeriksaan ini.

Chrome E2E pada 375 px juga memakai FastAPI lokal dengan transport Mistral mock untuk URL yang sama. Tanpa consent tidak ada POST penjelasan. Dengan consent, scan mengirim `ai_consent=true`, menerima tiket, lalu endpoint penjelasan menerima tiket dengan `consent=true`. Hasil deterministik tampil saat AI memuat. Respons mock yang sah menampilkan rujukan bukti, respons dengan ID salah menampilkan fallback, dan verdict tetap `unknown`. Regresi membedakan `disabled` untuk flag mati, `not_requested` untuk permintaan penjelasan tanpa consent, dan `unavailable` saat konfigurasi atau tiket tidak tersedia.

**Hasil:** 109 tes backend, 34 tes frontend, pemeriksaan rute, dan browser E2E lokal lulus. Nol panggilan Mistral live pada diagnosis C5. Uji live dari browser hanya diperlukan untuk mengonfirmasi generasi aktual melalui antarmuka; integrasi provider telah diverifikasi live secara terpisah pada C4.

## Phase 10B-C5 — Final End-to-End Verification

**PASS WITH LIMITATIONS untuk C5.** Regresi, browser lokal dengan mock, dan verifikasi browser dengan Mistral nyata lulus. Batas sementara untuk mengaktifkan AI pada deployment adalah satu instans FastAPI dengan satu worker. Deployment multiworker masih BLOCKED.

Audit Git dan riwayat C1–C4 mengonfirmasi satu alur dari URL Inspector dan Evidence Fusion ke verdict, tiket berizin, Mistral, validator deterministik, dan Smart Analysis Report. Pencarian runtime, tes, konfigurasi contoh, serta deklarasi dependensi tidak menemukan implementasi Gemini. Perubahan yang sudah ada dipertahankan. Checkpoint ini hanya memperbarui laporan.

### Browser dan skenario

Chrome headless menjalankan frontend dan FastAPI lokal. Google Safe Browsing, VirusTotal, urlscan.io, DNS, RDAP, dan Mistral memakai fixture atau transport mock. Browser dibatasi ke loopback.

| Sampel | Lebar | Hasil |
| --- | ---: | --- |
| `https://www.bca.co.id/id/individu` | 1.280 px | Origin tampil sebagai `https://www.bca.co.id`, path disamarkan pada ringkasan, domain `bca.co.id`, identitas cocok dengan referensi, verdict `unknown`, penjelasan selesai dengan `EV-001`. |
| `https://satusehat.kemkes.go.id/platform/login` | 320 px | Origin tampil sebagai `https://satusehat.kemkes.go.id`, path disamarkan pada ringkasan, domain `kemkes.go.id`, bukti identitas belum cukup dalam referensi fixture, verdict `unknown`, penjelasan selesai dengan `EV-001`. |
| BCA dengan ID bukti salah | 390 px | `EV-999` ditolak, fallback tampil, verdict tetap `unknown`. |
| `https://synthetic.example/login` | 390 px | Mock ancaman positif menampilkan kategori dan verdict `high`. Consent AI mati dan tidak ada permintaan penjelasan. |

Kedua sampel benign menampilkan Google `no_match`, VirusTotal dan urlscan.io `not_found`, DNS `found` dengan IP dokumentasi, dan RDAP `skipped`. Hasil fixture ini menguji penyajian dan penggabungan bukti. `no_match` tetap berarti tidak ditemukan dalam daftar yang diperiksa. Hasil deterministik terlihat ketika kartu AI masih memuat. Tiga permintaan penjelasan browser menghasilkan tepat tiga panggilan Mistral mock. Tidak ada overflow horizontal pada lebar yang diuji.

### Regresi, privasi, dan deployment

- **Regresi final:** backend 300 lulus, 0 gagal, 0 skipped, 0 peringatan. Frontend 271 lulus dalam 22 berkas, 0 gagal, 0 skipped. Lint, TypeScript, pemeriksaan rute, dan build lulus. Vitest menampilkan catatan performa jsdom. Build memakai konfigurasi HTTPS sintetis dan menampilkan satu peringatan ukuran chunk Vite (807,18 kB sebelum gzip).
- Regresi mock mencakup consent default mati, tiket sekali pakai, kedaluwarsa, isolasi sesi, rate limit, timeout, HTTP 400/401/403/429/503, JSON invalid, ID palsu, klaim tidak didukung, dan fallback. Respons penjelasan tidak memuat verdict. Uji browser tambahan memastikan API mengembalikan HTTP 422 untuk field klien `evidence`, `risk`, dan `verdict`.
- Uji Chrome tambahan dengan FastAPI dan Mistral mock mencatat lima scan, tiga consent, tiga POST penjelasan, dan tiga panggilan mock. Submit ulang tanpa mencentang AI tidak memicu panggilan baru. Mengubah input atau pindah ke Edukasi membatalkan masing-masing satu request browser dan satu task mock FastAPI. Saat kembali ke halaman scan, consent kembali mati dan kartu lama tidak tampil. Pembatalan pada transport mock tidak membuktikan penghentian pemrosesan yang sudah diterima Mistral.
- Audit runtime aktif mencakup kode backend dan frontend, deklarasi dependensi, lockfile frontend, hasil build, dan paket Python terpasang. Tidak ada referensi runtime atau paket SDK Gemini. `pip check` lulus.
- Pemeriksaan 201 berkas sumber, build, dan contoh konfigurasi terlacak tidak menemukan nilai API key Mistral. `backend/.env` diabaikan Git. Transport mock menerima ID dan ringkasan bukti tanpa domain, path contoh, atau key dalam body. Key hanya digunakan sebagai autentikasi pada header backend.
- **Deployment multiworker BLOCKED.** Audit dua instans menunjukkan tiket proses pertama tidak bisa dikonsumsi proses kedua. Penyimpanan tiket, kuota, cooldown, dan konkurensi berada di memori proses. Batasnya 60 detik, 4 tiket per subjek dan 30 tiket total per jendela, serta 2 generasi serentak. Gunakan satu instans dengan satu worker saat AI aktif. Restart menghapus tiket yang belum dipakai dan mereset pembatasan dalam memori.

### Verifikasi live dari browser

Setelah persetujuan, Chrome menjalankan satu scan atas URL BCA dengan consent AI aktif dan lookup eksternal lain mati. FastAPI lokal menerima satu POST analisis (HTTP 200, `pending`, verdict `unknown`, identitas `reference_match`) dan satu POST penjelasan (HTTP 200, `completed`). Transport mengirim tepat satu permintaan ke `ministral-8b-latest` tanpa retry. Mistral mengembalikan HTTP 200 dalam 1.592 ms pada transport.

Validator menerima dua temuan dan dua rekomendasi. Kartu menampilkan `EV-001` dan `EV-006`, keduanya berasal dari DTO bukti yang dikirim. Ringkasan deterministik tetap sama sebelum dan sesudah penjelasan, dengan verdict `unknown`. Pemeriksaan transport mengonfirmasi body tidak berisi domain BCA, path, atau API key. Verifikasi ini memakai Chrome dan FastAPI lokal dengan Mistral nyata.

Bukti live tersebut memenuhi alur browser hingga kartu hasil untuk satu scan berizin. Finalisasi memakai kembali bukti itu dan menambah nol panggilan live. Regresi final dan pemeriksaan browser tambahan tidak menemukan bug C5 yang perlu perubahan kode.

**Siap untuk pengembangan Phase 10C.** Deployment multiworker tetap tertahan karena tiket dan batas penggunaan per proses. Phase 10C belum dimulai.

## Phase 10B — Link & Website Inspector UI/UX Simplification

Tampilan sebelumnya memisahkan status provider ke banyak kartu dan menampilkan rekomendasi serta ID bukti langsung di laporan utama. Tampilan baru mendahulukan hostname, domain terdaftar, waktu pemeriksaan, verdict, dan kelengkapan. Hostname ditampilkan sebagai teks tanpa path, query, atau tautan yang dapat diklik.

- **Kelengkapan pemeriksaan.** Ring menampilkan jumlah sumber yang memberikan hasil dari total sumber yang dihitung. `match` dan `no_match` menghitung satu hasil intelijen ancaman. `found` dan `not_found` menghitung satu hasil per sumber tambahan. Timeout, kegagalan, batas permintaan, dan sumber yang belum tersedia tetap masuk total bila statusnya tercantum. Sumber `skipped`, `unsupported`, dan `not_requested` dikecualikan. Pemeriksaan struktur dan identitas disajikan terpisah. Ring tidak menampilkan persentase keamanan.
- **Verdict.** `unknown` tampil sebagai “Belum dapat dipastikan” dengan aksen amber. `medium` tampil sebagai “Ada indikasi mencurigakan”, `high` sebagai “Ancaman ditemukan”, dan `low` sebagai “Risiko rendah”. Kategori kecocokan ancaman tetap terlihat saat detail tertutup. Temuan historis menyebut batas waktu bukti, dan `no_match` tidak dianggap sebagai jaminan keamanan.
- **Mistral dan tindakan.** Kartu menampilkan ringkasan backend, maksimal tiga temuan tervalidasi, dan satu catatan keterbatasan. Satu daftar tindakan menggabungkan saran deterministik dan AI yang berbeda hingga tiga item. Kartu menampilkan status pemuatan dan fallback, atau petunjuk singkat jika AI belum diminta.
- **Detail pemeriksaan.** Panel bawaan `details` tertutup secara default. Isinya status provider, catatan eligibilitas, arsip dan usia, DNS/RDAP, referensi identitas, indikator struktur, sumber, ID bukti, dan keterbatasan. Kontrak backend, consent, tiket, validator, Evidence Fusion, dan Mistral tetap memakai implementasi yang ada.

**Verifikasi lokal:** 272 tes frontend lulus, bersama pemeriksaan rute, ESLint, TypeScript, dan build. 57 tes backend untuk kontrak URL Inspector dan AI lulus. Chrome headless dengan respons fixture menguji 320, 375, 390, 768, dan 1.280 px tanpa overflow halaman maupun laporan setelah ring ditumpuk pada ruang paling sempit. Keyboard Enter dan Space membuka serta menutup panel. Nama region terbaca melalui pohon aksesibilitas browser. Kartu tidak memiliki animasi dalam mode reduced motion. Pemeriksaan browser juga mengonfirmasi kategori ancaman terlihat saat panel tertutup, ID AI hanya tampak setelah panel dibuka, dan daftar tindakan tidak berulang.

Pengujian desain menggunakan mock tanpa panggilan provider live. Vite masih melaporkan peringatan ukuran chunk. Pemeriksaan visual menggunakan Chrome dan label aksesibilitas, tanpa audit manual pada aplikasi screen reader. Batas satu instans dan satu worker untuk AI masih mengikuti C5.

### Penyederhanaan persetujuan pemeriksaan

Form URL menampilkan satu opsi utama, **Izinkan pemeriksaan lengkap**, yang mati secara default. Saat dipilih, permintaan mengirim `threat_lookup_consent`, `enhanced_lookup_consent`, dan `ai_consent` bernilai `true`. Saat semua opsi mati, ketiga field dihilangkan sehingga backend memakai default `false`. Pilihan berlaku per scan dan direset setelah submit atau saat URL diedit. Form tidak membaca atau mengubah persetujuan tersimpan.

**Detail penggunaan data** tertutup secara default dan tetap memberi pilihan per layanan. Penjelasannya membedakan potongan hash Safe Browsing, alamat yang dinormalisasi beserta path untuk Web Risk, pengodean Base64 alamat beranda untuk VirusTotal, domain terdaftar untuk urlscan.io, Google Public DNS, dan RDAP, serta ringkasan bukti untuk Mistral. Eligibilitas, batas provider, dan validasi server tetap berlaku. Penjelasan Mistral mengikuti hasil pemeriksaan tervalidasi.

**Verifikasi:** 273 tes frontend dan 58 tes kontrak backend lulus. ESLint, TypeScript, pemeriksaan rute, dan build lulus. Chrome dengan fixture mengonfirmasi payload lengkap dan tanpa izin, satu permintaan penjelasan setelah izin, panel keyboard, serta layout tanpa overflow pada 320, 375, 390, 768, dan 1.280 px. Regresi juga mencakup pilihan satu layanan, reset saat mengedit, loading, respons lama, dan fallback. Build masih menampilkan peringatan ukuran chunk Vite. Tidak ada panggilan provider live.

## Phase 10B-C6 — AI Threat Detector Integration

**BLOCKED untuk aktivasi live.** Pipeline, validator, dan tampilan Detector tersedia dan diuji dengan mock. Audit konfigurasi tidak menemukan provider Detector yang telah diverifikasi. Tidak ada SDK baru, kredensial baru, atau panggilan live pada C6. `AI_THREAT_DETECTOR_ENABLED` default `false`. Mengaktifkan flag tanpa adapter menghasilkan `unavailable`.

FastAPI menjalankan Detector setelah pemeriksaan deterministik dan sebelum menerbitkan tiket Mistral. Detector menerima fitur terstruktur dari URL yang benar-benar dimasukkan, termasuk skema, pola subdomain, port, IDN, panjang dan pengodean path, kategori nama parameter, serta perbandingan dengan referensi domain resmi. Hostname, nama parameter tak dikenal, nilai query, dan teks path tetap lokal. DTO mengirim kode fitur dengan ID `UF-xx` dan ringkasan bukti AWASIN. Tidak ada akses ke situs target atau pengujian rantai pengalihan.

Adapter mengembalikan JSON berisi kategori dan ID fitur. Pydantic menolak field tambahan, dan validator memeriksa setiap ID, duplikat, serta kombinasi fitur yang diperlukan. Backend menyusun deskripsi tetap dan membedakan pola yang teramati dari dugaan AI. Misalnya, pola akun pada hostname yang menyebut merek di luar domain resmi dapat mendukung dugaan yang perlu diperiksa. Parameter pengalihan hanya mendukung temuan bahwa parameter itu ada. Output AI tidak menjadi bukti provider dan tidak mengubah verdict. Mistral tetap menjadi penjelas terpisah. Tiketnya dapat membawa kategori observasi Detector yang lolos validasi, sementara dugaan dan keluaran mentah dikecualikan.

`detector_consent` adalah boolean ketat terpisah dan mati secara default. Checkbox pemeriksaan lengkap yang sudah ada tidak memberikan izin Detector. Nama provider hanya ditampilkan bila `VITE_AI_THREAT_DETECTOR_PROVIDER` diatur untuk provider yang telah diverifikasi. Pilihan Detector direset saat URL diedit atau scan disubmit. Hasil tampil di akhir laporan dengan label pola atau dugaan dan catatan bahwa konten website belum diperiksa langsung. Bila Detector gagal, laporan deterministik serta alur Mistral tetap tersedia.

Detector memiliki timeout 2,5 detik, batas dua panggilan serentak, kuota empat per subjek dan 30 total per 60 detik, serta cooldown setelah HTTP 429. State berada di memori proses. Batas C5 untuk satu instans dan satu worker masih berlaku.

Fixture menguji domain resmi, penyamaran merek, typo, IDN, subdomain menyesatkan, path panjang, penghapusan data sensitif, URL invalid, persetujuan terpisah, penolakan klaim/ID palsu, respons invalid, timeout, status HTTP 400/401/403/429/500, batas permintaan, pembatalan, dan replay tiket Mistral. Chrome dengan respons fixture menampilkan pola teramati dan dugaan di lima lebar dari 320 sampai 1.280 px tanpa perubahan verdict.

Regresi final mencatat 320 tes backend dan 274 tes frontend lulus. ESLint, TypeScript, pemeriksaan rute, dan build lulus. Vite masih melaporkan peringatan ukuran chunk.

Evaluasi independen belum bisa membandingkan baseline, prediksi Detector, dan kandidat fusion karena belum ada model Detector live. Fixture hanya mengukur perilaku integrasi dan validasi. Precision, recall, F1, confusion matrix, kesalahan klasifikasi, cakupan, biaya dan latensi model belum diukur. Tidak ada klaim kenaikan akurasi atau perubahan Evidence Fusion.

## Phase 10B-C6-FIX — OpenRouter Live AI Detector

**BLOCKED untuk aktivasi.** FastAPI sekarang memakai adapter OpenRouter ketika flag aktif, key backend tersedia, dan `OPENROUTER_DETECTOR_MODEL` menunjuk model spesifik berakhiran `:free`. Katalog publik menampilkan `liquid/lfm-3-1.7b:free` dengan harga input/output nol dan dukungan structured output. Model dipilih karena menerima JSON Schema untuk tugas pemetaan fitur ke temuan. Model otomatis, model berbayar, dan fallback ditolak. Permintaan membatasi harga ke nol, mewajibkan dukungan parameter, dan hanya memakai satu model. [Model OpenRouter](https://openrouter.ai/liquid/lfm-3-1.7b:free) · [Structured Outputs](https://openrouter.ai/docs/guides/features/structured-outputs) · [Provider Routing](https://openrouter.ai/docs/guides/routing/provider-selection).

Adapter memakai HTTPX dengan respons maksimal 32 KiB, deadline Detector 10 detik, tanpa redirect atau retry otomatis, dan memeriksa model serta biaya dalam respons. DTO fitur URL, validasi Pydantic, validator bukti, verdict deterministik, dan tiket Mistral memakai alur C6. Persetujuan OpenRouter tetap terpisah dari pemeriksaan lengkap. Detail UI menjelaskan data yang dikirim, potensi retensi oleh penyedia model gratis, dan peran Mistral. Pemeriksaan frontend, build, dan contoh konfigurasi terlacak mencakup 164 berkas tanpa menemukan nilai key. Key dipakai hanya dari backend. Flag dan label Detector untuk penggunaan normal tetap mati/belum disetel.

| Smoke Chrome dengan URL sintetis | Respons OpenRouter | Penggunaan | Hasil AWASIN |
| --- | --- | --- | --- |
| Batas output 600, reasoning rendah | HTTP 200, header 1.129 ms | 381 input, 600 output, biaya 0 | Temuan lengkap tidak tersedia. `validation_failed`. |
| Batas output 1.200, reasoning rendah | HTTP 200, header 530 ms, `finish_reason=length` | 381 input, 1.200 output, biaya 0 | Respons terpotong. `validation_failed`. |
| Batas output 1.200, reasoning dinonaktifkan | HTTP 400, header 102 ms | Metadata penggunaan tidak tersedia | `unavailable`. Detail aman respons tidak mengidentifikasi penyebab 400 lebih spesifik. |

Setiap percobaan memakai satu request setelah consent. Scan pembanding tanpa consent tidak mengirim request OpenRouter. Chrome menampilkan fallback, verdict tetap `unknown`, dan Mistral mock berhasil memberi penjelasan deterministik. Panggilan kedua menunjukkan model menghabiskan batas output sebelum menyelesaikan respons. Perubahan untuk mematikan reasoning ditolak, sehingga adapter dikembalikan ke konfigurasi reasoning rendah yang diterima HTTP. Tidak ada temuan OpenRouter live yang lolos validator atau tampil di UI. Mistral live tetap memakai bukti verifikasi C5. Tidak ada panggilan Mistral baru.

**Regresi:** 335 backend lulus, termasuk 15 tes wire OpenRouter yang dijalankan ulang setelah konfigurasi akhir. 274 frontend, ESLint, TypeScript, pemeriksaan rute, dan build lulus. Vite masih memberi peringatan ukuran chunk. Fixture sah lolos validator, sedangkan model tak sesuai, biaya positif, hasil terpotong, dan error provider ditolak atau memakai fallback. Evaluasi dataset dan pengukuran akurasi belum dilakukan karena belum ada prediksi live yang valid. Batas satu instans dengan satu worker tetap berlaku. Serverless dan multiworker masih tertahan oleh tiket serta kuota yang disimpan per proses.

## Phase 10B-C6-FIX2 — OpenRouter Free Model Compatibility & Live Validation

**BLOCKED untuk aktivasi Detector.** Chrome menerima hasil Detector live dengan JSON sah pada tiga kasus Nemotron. Semua hasilnya kosong, termasuk kasus penyamaran merek. Belum ada temuan positif live yang lolos validator dan dapat ditampilkan. Detector tetap nonaktif secara default dan pada konfigurasi lokal.

### Diagnosis dan perubahan kompatibilitas

Pada C6-FIX, LFM3 memakai seluruh batas 600 dan 1.200 token. Percobaan 1.200 token melaporkan `finish_reason=length`, sehingga adapter tidak menerima respons sebagai temuan lengkap. Log lama tidak menyimpan rincian token reasoning atau isi respons, jadi tidak dapat dipastikan apakah konten kosong atau terpotong di tengah dan berapa token yang dipakai untuk reasoning. HTTP 200 menunjukkan permintaan diterima. Tidak ada bukti bahwa skema lama sendirian menyebabkan kegagalan. Permintaan yang mematikan reasoning untuk LFM3 menerima HTTP 400.

Katalog OpenRouter mencantumkan dua kandidat dengan harga input/output nol dan dukungan structured output. Nemotron mendokumentasikan reasoning yang dapat dinonaktifkan. ERNIE diperiksa sebagai kandidat pembanding. Model hanya menghasilkan kode kategori dan ID fitur. Deskripsi Indonesia tetap disusun backend, sehingga uji ini tidak mengukur kemampuan menulis bahasa Indonesia model. [Katalog OpenRouter](https://openrouter.ai/api/v1/models) · [Nemotron](https://openrouter.ai/nvidia/nemotron-3.5-super-vl:free) · [ERNIE](https://openrouter.ai/baidu/ernie-5.5-flash-preview:free).

Skema wire meratakan satu referensi objek tanpa menghapus enum, pola ID, batas jumlah, larangan field tambahan, atau validator lokal. Batas 320 token mencakup maksimal lima temuan pendek. Tidak ada router otomatis, retry, atau fallback berbayar. Respons hanya diterima untuk model yang diharapkan dan biaya eksplisit nol.

### Bukti live Chrome

Enam permintaan OpenRouter dikirim, tiga per kandidat. Chrome melakukan scan pembanding tanpa consent, lalu scan berizin dengan lookup keamanan lain mati. URL sampel tidak dibuka. Untuk kasus penyamaran merek, Mistral diuji dengan fixture melalui tiket yang sama. Verdict tetap `unknown` pada setiap pasangan scan.

| Kandidat | Kasus | HTTP OpenRouter / latensi header | Token input/output dan biaya | Hasil backend dan Chrome |
| --- | --- | --- | --- | --- |
| `nvidia/nemotron-3.5-super-vl:free` | Legitimate | 200 / 555 ms | 384/7, 0 | `completed`, 0 temuan |
| Nemotron | Pola penyamaran merek | 200 / 382 ms | 401/7, 0 | `completed`, 0 temuan. Pola yang tersedia pada fixture terlewat. |
| Nemotron | Parameter panjang benign | 200 / 370 ms | 371/7, 0 | `completed`, 0 temuan |
| `baidu/ernie-5.5-flash-preview:free` | Legitimate, merek, parameter panjang | 400 / 135, 89, 112 ms | Penggunaan dan biaya tidak dilaporkan | `unavailable` pada ketiganya. Kategori error yang disimpan tidak cukup untuk menetapkan penyebab 400. |

Nemotron melaporkan `stop` dan nol token reasoning pada ketiga respons. JSON dan Pydantic lulus, tetapi validator tidak menerima temuan positif karena model tidak mengajukannya. Kartu UI menampilkan keadaan tanpa temuan. ERNIE hanya menampilkan fallback. Pilihan konfigurasi `OPENROUTER_DETECTOR_MODEL` beralih ke Nemotron sebagai kandidat dengan kompatibilitas format terbaik. Kandidat ini belum memenuhi syarat aktivasi. Tidak ada klaim akurasi dari smoke test. Batas satu instans dan satu worker masih berlaku.

Regresi akhir mencatat 336 tes backend dan 274 tes frontend lulus. ESLint, TypeScript, pemeriksaan rute, dan build lulus. Vite masih melaporkan peringatan ukuran chunk. Tes wire memeriksa model gratis eksplisit, skema ketat, biaya nol, ID kanonis yang dikenal, hasil terpotong, dan penolakan redirect atau retry.
