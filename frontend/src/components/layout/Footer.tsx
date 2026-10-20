import { ArrowUp } from 'lucide-react'
import { Link } from 'react-router'

export function Footer() {
  return (
    <footer className="site-footer" data-nav-theme="dark"><div className="page-width">
      <div className="footer-main">
        <div className="footer-brand"><Link to="/#beranda" className="wordmark" aria-label="AWASIN, beranda">AWASIN.</Link><p className="footer-tagline">Cek Dulu, Lebih Aman.</p><p>Membantu pengguna memahami indikasi penipuan digital melalui pemeriksaan yang mudah diakses dan dijelaskan secara transparan.</p></div>
        <nav aria-label="Navigasi footer"><h2>Jelajahi</h2><Link to="/#beranda">Beranda</Link><Link to="/#periksa">Periksa</Link><Link to="/#edukasi">Edukasi</Link></nav>
        <div className="footer-information"><h2>Informasi</h2><Link to="/education">Materi edukasi</Link><Link to="/feedback">Feedback</Link><Link to="/login">Masuk</Link><span className="footer-unavailable">Kebijakan Privasi <small>Dalam pengembangan</small></span></div>
      </div>
      <div className="footer-bottom"><p>© 2026 AWASIN. Pemeriksaan bersifat pendukung keputusan, bukan jaminan keamanan.</p><Link to="/#beranda">Kembali ke atas <ArrowUp size={16} aria-hidden="true" /></Link></div>
    </div></footer>
  )
}
