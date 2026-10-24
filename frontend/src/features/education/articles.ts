// Shared by the landing/dashboard previews and the public Education Center.
// Editorial summaries, not research findings, personalized advice or scan verdicts.
import type { ScanMode } from '../history/contracts'
export const articles = [
  { slug: 'phishing', category: 'Phishing', title: 'Cermati link, bukan hanya tampilannya.', description: 'Alamat website palsu sering meniru nama merek atau menambahkan subdomain yang menyesatkan. Periksa domain yang benar sebelum memasukkan data.', action: 'Pelajari phishing', image: '/assets/education/phishing.jpg',
    sections: [
      { title: 'Berhenti sebelum membuka', paragraphs: ['Phishing berusaha mendorong seseorang membagikan informasi atau membuka tautan berbahaya melalui pesan yang terlihat tepercaya. Perhatikan permintaan data pribadi dan tekanan untuk bertindak cepat.'] },
      { title: 'Verifikasi melalui jalur terpisah', paragraphs: ['Jangan memakai tautan dalam pesan yang meragukan untuk membuktikan keasliannya. Buka aplikasi resmi atau gunakan alamat dan kontak yang sudah kamu ketahui. Nama pengirim, logo, dan tampilan halaman saja belum cukup untuk memastikan identitas.'] },
      { title: 'Jika sudah terlanjur berinteraksi', paragraphs: ['Hentikan percakapan dan jangan berikan data tambahan. Jika kata sandi telah dibagikan, ubah melalui layanan resminya. Hubungi penyedia akun untuk langkah pemulihan yang sesuai. Panduan ini bersifat umum; validasi URL AWASIN belum merupakan analisis keamanan.'] },
    ], source: { name: 'FTC — Mengenali dan menghindari phishing', url: 'https://consumer.ftc.gov/articles/how-recognize-avoid-phishing-scams' } },
  { slug: 'pesan-dan-otp', category: 'Modus pesan', title: 'Waspadai pesan yang membuat panik.', description: 'Ancaman pemblokiran akun dan tenggat waktu mendadak kerap digunakan untuk memaksa orang bertindak tanpa berpikir.', action: 'Kenali modus pesan', image: '/assets/education/message.jpg',
    sections: [
      { title: 'Kenali tekanan emosional', paragraphs: ['Permintaan mendadak atas uang atau informasi pribadi, terutama ketika seseorang mengaku sebagai pihak yang kamu kenal, perlu diverifikasi. Jangan mengambil keputusan hanya karena ada ancaman atau kesempatan yang disebut akan segera berakhir.'] },
      { title: 'Rahasiakan akses akun', paragraphs: ['Jangan membagikan kata sandi atau kode akses akun. Hubungi organisasi atau orang terkait melalui kontak resmi yang diperoleh secara mandiri. Bila tidak dapat menghubungi orang tersebut, coba verifikasi melalui orang tepercaya lain.'] },
      { title: 'Ambil jeda', paragraphs: ['Beri diri waktu membaca permintaan dan bertanya sebelum menyetujui pembayaran. Simpan konteks yang diperlukan bila meminta bantuan, sambil menyamarkan data pihak lain. Pesan yang terasa meyakinkan tetap perlu dicek melalui kanal terpisah.'] },
    ], source: { name: 'CFPB — Verifikasi permintaan mendesak', url: 'https://www.consumerfinance.gov/ask-cfpb/what-are-some-classic-warning-signs-of-possible-fraud-and-scams-en-2094/' } },
  { slug: 'keamanan-qr', category: 'Keamanan QR', title: 'QR Code juga bisa menipu.', description: 'Kode QR dapat menyimpan tautan ke halaman tiruan. Lihat alamat tujuan sebelum membukanya.', action: 'Pelajari risiko QR', image: '/assets/education/qr.jpg',
    sections: [
      { title: 'QR adalah pintu masuk', paragraphs: ['Kode QR dapat mengarahkan pengguna ke halaman tiruan. Kode di tempat umum juga dapat ditutupi kode lain. Pesan yang tidak diharapkan bisa menggunakan alasan masalah paket atau akun untuk mendorong pemindaian terburu-buru.'] },
      { title: 'Lihat tujuan lebih dahulu', paragraphs: ['Periksa alamat yang ditampilkan sebelum membukanya. Waspadai salah ejaan dan huruf yang ditukar. Untuk pesan mendadak, konfirmasikan kebutuhan pemindaian melalui kontak organisasi yang sudah kamu ketahui.'] },
      { title: 'Membaca bukan memastikan aman', paragraphs: ['Pembaca QR lokal AWASIN menampilkan isi kode tanpa membukanya otomatis. Isi non-URL tetap berupa teks. Keberhasilan membaca kode bukan penilaian keamanan. Perbarui perangkat dan gunakan perlindungan akun dari penyedia layanan.'] },
    ], source: { name: 'FTC — Tautan berbahaya di balik QR Code', url: 'https://consumer.ftc.gov/consumer-alerts/2023/12/scammers-hide-harmful-links-qr-codes-steal-your-information' } },
  { slug: 'keaslian-media', category: 'Keaslian media', title: 'Gambar dan video perlu diverifikasi.', description: 'Konten sintetis bisa terlihat meyakinkan. Periksa konteks, sumber asli, dan bukti lain sebelum mempercayainya.', action: 'Kenali manipulasi media', image: '/assets/education/media.jpg',
    sections: [
      { title: 'Tampilan nyata belum cukup', paragraphs: ['AI generatif dapat dipakai untuk membuat gambar, rekaman suara, dan video yang meyakinkan dalam penipuan. Namun, konten sintetis tidak dengan sendirinya membuktikan adanya tindak kejahatan. Tujuan dan konteks penggunaannya tetap perlu diperhatikan.'] },
      { title: 'Periksa permintaan di balik konten', paragraphs: ['Berhati-hatilah bila media dipakai untuk membuktikan identitas atau meminta pembayaran mendadak. Konfirmasikan cerita kepada pihak terkait menggunakan kontak yang sudah kamu kenal, bukan kontak yang hanya diberikan oleh pengirim.'] },
      { title: 'Hindari kepastian dari satu tanda', paragraphs: ['Jangan menyimpulkan keaslian hanya dari kualitas gambar atau suara. Cari sumber dan konteks tambahan sebelum membagikan konten. Analisis keaslian media AWASIN belum tersedia; pratinjau file tidak menghasilkan klasifikasi deepfake.'] },
    ], source: { name: 'FBI / IC3 — Penyalahgunaan AI generatif untuk penipuan', url: 'https://www.ic3.gov/PSA/2024/PSA241203' } },
] as const

export function articleForMode(mode: ScanMode) {
  const slugs = { link: 'phishing', website: 'phishing', message: 'pesan-dan-otp', qr: 'keamanan-qr', image: 'keaslian-media', video: 'keaslian-media' }
  return articles.find(article => article.slug === slugs[mode])
}
