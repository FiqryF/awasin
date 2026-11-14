import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import { ShinyText } from '../components/motion/ShinyText'
import { BackgroundVideo } from '../components/motion/BackgroundVideo'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { Link } from 'react-router'
import { useAnnouncements } from '../features/announcements/useAnnouncements'

export function HeroSection({ personalized = false, displayName = '' }: Readonly<{ personalized?: boolean; displayName?: string }>) {
  const reducedMotion = usePrefersReducedMotion()
  const announcements = useAnnouncements()
  const announcementItems = announcements.map(item => <li key={item.id}>
    <img src={`${import.meta.env.BASE_URL}assets/brand/logo-blood-red.png`} alt="" width={24} height={24} />
    <span>{item.message}</span>
  </li>)
  const reveal = (delay: number) => ({
    initial: reducedMotion ? false as const : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reducedMotion ? 0 : 0.65, delay: reducedMotion ? 0 : delay, ease: [0.16, 1, 0.3, 1] as const },
  })
  return (
    <section id="beranda" className={`hero${personalized ? ' dashboard-hero' : ''}`} data-nav-theme="dark" aria-labelledby="home-title">
      <BackgroundVideo />
      <div className="hero-overlay" aria-hidden="true" />
      <div className="page-width hero-inner">
        <div className="hero-center">
        <h1 id="home-title" className="hero-title">
          {personalized ? <><motion.span {...reveal(0.08)}>Selamat datang kembali{displayName ? ',' : '.'}</motion.span>{displayName && <motion.span {...reveal(0.17)} className="hero-title-second"><ShinyText>{displayName}.</ShinyText></motion.span>}</> : <><motion.span {...reveal(0.08)}>Jangan asal klik.</motion.span>{' '}<motion.span {...reveal(0.17)} className="hero-title-second"><ShinyText>Cek dulu di <span className="hero-wordmark">AWASIN.</span></ShinyText></motion.span></>}
        </h1>
        <motion.div {...reveal(0.25)} className="hero-description"><p>{personalized ? 'Ruang pribadimu untuk memeriksa konten mencurigakan, meninjau riwayat pemeriksaan, dan meningkatkan keamanan aktivitas digital.' : 'Periksa link, website, pesan, dan QR Code dalam satu tempat.'}</p></motion.div>
        <motion.div {...reveal(0.34)} className="hero-actions">
          <a href="#periksa" className="button button-glass">Mulai Periksa <ArrowUpRight size={20} aria-hidden="true" /></a>{personalized ? <Link to="/history" className="button dashboard-history-action">Lihat Riwayat <ArrowUpRight size={18} aria-hidden="true" /></Link> : <span>Bisa dicoba tanpa login.</span>}
        </motion.div>
        </div>
        <div>
          {announcements.length > 0 && <section className="hero-announcements" aria-label="Pengumuman layanan">
            <div className={reducedMotion ? 'hero-announcements-static' : 'hero-announcements-window'}>
              <ul className="hero-announcements-track">{announcementItems}</ul>
            </div>
          </section>}
          <div className="hero-bottom"><span>LINK · PESAN · WEBSITE · QR</span><a href="#periksa" className="scroll-cue">GULIR UNTUK PERIKSA <ArrowDown size={17} aria-hidden="true" /></a></div>
        </div>
      </div>
    </section>
  )
}
