import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { ScrollReveal } from '../components/motion/ScrollReveal'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

const articles = [
  { category: 'Phishing', title: 'Cermati link, bukan hanya tampilannya.', description: 'Alamat website palsu sering meniru nama merek atau menambahkan subdomain yang menyesatkan. Periksa domain yang benar sebelum memasukkan data.', action: 'Pelajari phishing', image: '/assets/education/phishing.jpg' },
  { category: 'Modus pesan', title: 'Waspadai pesan yang membuat panik.', description: 'Ancaman pemblokiran akun dan tenggat waktu mendadak kerap digunakan untuk memaksa orang bertindak tanpa berpikir.', action: 'Kenali modus pesan', image: '/assets/education/message.jpg' },
  { category: 'Keamanan QR', title: 'QR Code juga bisa menipu.', description: 'Kode QR dapat menyimpan tautan ke halaman tiruan. Lihat alamat tujuan sebelum membukanya.', action: 'Pelajari risiko QR', image: '/assets/education/qr.jpg' },
  { category: 'Keaslian media', title: 'Gambar dan video perlu diverifikasi.', description: 'Konten sintetis bisa terlihat meyakinkan. Periksa konteks, sumber asli, dan bukti lain sebelum mempercayainya.', action: 'Kenali manipulasi media', image: '/assets/education/media.jpg' },
]

function EducationArticle({ article }: { article: typeof articles[number] }) {
  return (
    <article className="article-card">
      <div className="article-image"><img src={article.image} alt="" loading="lazy" decoding="async" width={640} height={480} /></div>
      <div className="article-content">
        <span className="article-category">{article.category}</span>
        <h4>{article.title}</h4>
        <p>{article.description}</p>
        <Link to="/education" className="article-action" aria-label={`${article.action}: ${article.title} (dalam pengembangan)`}>Baca artikel <ArrowUpRight size={17} aria-hidden="true" /></Link>
      </div>
    </article>
  )
}

export function EducationSection() {
  const track = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [controls, setControls] = useState({ previous: false, next: true })
  const updateControls = useCallback(() => {
    const element = track.current
    if (!element) return
    const previous = element.scrollLeft > 2
    const next = element.scrollLeft + element.clientWidth < element.scrollWidth - 2
    setControls((current) => current.previous === previous && current.next === next ? current : { previous, next })
  }, [])
  useEffect(() => {
    if (!track.current) return
    const observer = new ResizeObserver(updateControls)
    observer.observe(track.current)
    return () => observer.disconnect()
  }, [updateControls])
  function moveArticles(direction: number) {
    const element = track.current
    if (!element) return
    const cardWidth = element.firstElementChild?.getBoundingClientRect().width ?? element.clientWidth
    element.scrollBy({ left: direction * (cardWidth + 24), behavior: reducedMotion ? 'instant' : 'smooth' })
  }
  return (
    <section id="edukasi" className="education-section" aria-labelledby="education-title">
      <ScrollReveal>
        <div className="education-banner">
          <img className="education-banner-image" src={articles[0].image} alt="" loading="lazy" decoding="async" width={1200} height={900} />
          <div className="education-banner-overlay" aria-hidden="true" />
          <div className="page-width education-banner-inner"><div className="education-banner-copy">
            <p className="section-label">EDUKASI KEAMANAN DIGITAL</p>
            <h2 id="education-title">Cermati link, bukan hanya tampilannya.</h2>
            <p>Penipuan makin pintar. Kita juga harus. Kenali tanda phishing sebelum membuka tautan atau memasukkan data pribadi.</p>
            <div className="education-banner-actions"><Link to="/education" className="button button-red">Baca artikel <ArrowUpRight size={18} aria-hidden="true" /></Link><a href="#topik-edukasi" className="button education-topics-link">Lihat topik lain</a></div>
          </div></div>
        </div>
      </ScrollReveal>
      <div className="page-width education-topics" id="topik-edukasi">
        <div className="education-topics-heading"><h3>Dalam bacaan <span>ini</span></h3><div className="education-carousel-controls">
          <button type="button" className="icon-button" aria-label="Artikel sebelumnya" aria-controls="education-carousel" disabled={!controls.previous} onClick={() => moveArticles(-1)}><ArrowLeft size={19} aria-hidden="true" /></button>
          <button type="button" className="icon-button" aria-label="Artikel berikutnya" aria-controls="education-carousel" disabled={!controls.next} onClick={() => moveArticles(1)}><ArrowRight size={19} aria-hidden="true" /></button>
        </div></div>
        <div ref={track} id="education-carousel" className="education-carousel" role="region" aria-label="Topik edukasi, geser untuk melihat artikel lainnya" tabIndex={0} onScroll={updateControls}>{articles.map((article, index) => (
          <ScrollReveal key={article.title} className="article-reveal" delay={(index + 1) * 0.08}><EducationArticle article={article} /></ScrollReveal>
        ))}</div>
        <p className="education-note">Pratinjau topik edukasi. Artikel lengkap sedang disiapkan.</p>
      </div>
    </section>
  )
}
