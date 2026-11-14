import { CircleAlert, Fingerprint, ListChecks } from 'lucide-react'

export function ScanSidebar() {
  return (
    <aside className="scan-sidebar" aria-label="Panduan pemeriksaan dan privasi">
      <div className="sidebar-panel">
        <div className="sidebar-label"><span className="section-label">CARA KERJA</span><ListChecks size={20} aria-hidden="true" /></div>
        <h3>Cukup tiga langkah.</h3>
        <ol className="scan-steps">
          <li><span aria-hidden="true">01</span>Pilih jenis pemeriksaan.</li>
          <li><span aria-hidden="true">02</span>Masukkan link, pesan, atau file.</li>
          <li><span aria-hidden="true">03</span>Tinjau bukti, indikasi risiko, dan saran yang tersedia.</li>
        </ol>
        <p className="sidebar-note">Periksa tautan, website, atau pesan. Mode QR dan media memiliki cakupan berbeda.</p>
      </div>
      <div className="sidebar-panel">
        <div className="sidebar-label"><span className="section-label">KEAMANAN DATA</span><Fingerprint size={20} aria-hidden="true" /></div>
        <h3>Privasi tetap utama.</h3>
        <p>Hindari mengirim kata sandi atau OTP. Kamu bisa mengatur penyimpanan Riwayat dari akunmu.</p>
      </div>
      <div className="sidebar-panel sidebar-reminder">
        <div className="sidebar-label"><span className="section-label">PERLU DIINGAT</span><CircleAlert size={20} aria-hidden="true" /></div>
        <p>Tidak ditemukan indikasi bukan berarti 100% aman. Selalu verifikasi lewat kanal resmi.</p>
      </div>
    </aside>
  )
}
