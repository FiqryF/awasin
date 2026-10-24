import { ArrowUp } from 'lucide-react'
import { Link } from 'react-router'
import { useState } from 'react'
import { useAuth } from '../../features/auth/useAuth'
import { LegalDialog } from '../../features/legal/LegalDialog'

export function Footer() {
  const {identity}=useAuth()
  const home=identity?'/dashboard':'/'
  const [privacy,setPrivacy]=useState(false)
  return (
    <footer className="site-footer" data-nav-theme="dark"><div className="page-width">
      <div className="footer-main">
        <div className="footer-brand"><Link to={`${home}#beranda`} className="wordmark" aria-label="AWASIN, beranda">AWASIN.</Link><p className="footer-tagline">Cek Dulu, Lebih Aman.</p><p>Membantu pengguna memahami indikasi penipuan digital melalui pemeriksaan yang mudah diakses dan dijelaskan secara transparan.</p></div>
        <nav aria-label="Navigasi footer"><h2>Jelajahi</h2><Link to={`${home}#beranda`}>Beranda</Link><Link to={`${home}#periksa`}>Periksa</Link><Link to="/education">Edukasi</Link></nav>
        <div className="footer-information"><h2>Informasi</h2><Link to="/education">Materi edukasi</Link><Link to="/feedback">Feedback</Link><Link to={identity?'/settings':'/login'}>{identity?'Pengaturan Akun':'Masuk'}</Link><button className="footer-legal-link" type="button" onClick={()=>setPrivacy(true)}>Kebijakan Privasi</button></div>
      </div>
      <div className="footer-bottom"><p>© 2026 AWASIN. Pemeriksaan bersifat pendukung keputusan, bukan jaminan keamanan.</p><Link to={`${home}#beranda`}>Kembali ke atas <ArrowUp size={16} aria-hidden="true" /></Link></div>
    </div>{privacy&&<LegalDialog kind="privacy" onClose={()=>setPrivacy(false)}/>}</footer>
  )
}
